print("LOADED:", __file__)

import json
import os
import re
import uuid
from typing import Dict, List
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.agent.planner import detect_intent
from backend.tools.resume import answer_resume_question

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

app = FastAPI()
CHAT_STORE: Dict[str, List[str]] = {}



SCHEDULER_API_URL = os.getenv("SCHEDULER_API_URL")
SCHEDULER_API_TIMEOUT_SEC = float(os.getenv("SCHEDULER_API_TIMEOUT_SEC", "15"))
SCHEDULER_COMMAND_EXAMPLE = {
    "command": "Schedule a meeting with john@example.com and sarah@company.com next Tuesday at 9:30 PM for 45 minutes about Q2 planning",
    "history": None,
}

with open("resume.json") as f:
    RESUME = json.load(f)

app.mount("/static", StaticFiles(directory="static"), name="static")


class ChatRequest(BaseModel):
    message: str


def debug_log(label: str, data=None) -> None:
    if data is None:
        print(f"[DEBUG] {label}", flush=True)
    else:
        print(f"[DEBUG] {label}: {data}", flush=True)


def build_scheduler_history(history: List[str], max_messages: int = 3) -> List[dict]:
    user_messages = []
    for item in history:
        if item.startswith("User : "):
            user_messages.append(item.replace("User : ", "", 1).strip())
    capped = user_messages[-max_messages:]
    debug_log(
        "build_scheduler_history",
        {
            "max_messages": max_messages,
            "total_user_messages": len(user_messages),
            "returned_count": len(capped),
            "returned_messages": capped,
        },
    )
    return capped


def extract_user_messages(history: List[str]) -> List[str]:
    return [
        item.replace("User : ", "", 1).strip()
        for item in history
        if item.startswith("User : ")
    ]


def looks_like_scheduler_details(message: str) -> bool:
    msg = message.lower()
    has_email = bool(re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", message))
    has_time = bool(re.search(r"\b\d{1,2}(:\d{2})?\s?(am|pm)\b", msg)) or " at " in f" {msg} "
    has_date = any(
        token in msg
        for token in [
            "today", "tomorrow", "monday", "tuesday", "wednesday", "thursday",
            "friday", "saturday", "sunday", "next week", "next month",
        ]
    ) or bool(re.search(r"\b\d{4}-\d{2}-\d{2}\b", msg))
    has_duration = bool(re.search(r"\b\d+\s?(min|mins|minute|minutes|hr|hrs|hour|hours)\b", msg))
    has_timezone = bool(re.search(r"\b(utc|gmt|ist|est|pst|cst|jst)\b", msg))
    has_attendee_hint = any(token in msg for token in ["attendee", "attendees", "invite", "with "])
    return any([has_email, has_time, has_date, has_duration, has_timezone, has_attendee_hint])


def should_continue_scheduler_flow(current_message: str, history: List[str], lookback: int = 3) -> bool:
    user_messages = extract_user_messages(history)
    if user_messages and user_messages[-1] == current_message.strip():
        previous_user_messages = user_messages[:-1]
    else:
        previous_user_messages = user_messages

    recent_user_messages = previous_user_messages[-lookback:]
    recent_user_scheduler_intent = any(
        detect_intent(msg) == "schedule_meeting" for msg in recent_user_messages
    )

    recent_assistant_messages = [
        item.lower() for item in history[-6:] if item.startswith("Assistant:")
    ]
    assistant_scheduler_prompted = any(
        token in msg
        for msg in recent_assistant_messages
        for token in [
            "schedule the meeting",
            "attendees",
            "meeting",
            "date, time",
            "incomplete",
        ]
    )

    details_like = looks_like_scheduler_details(current_message)
    result = (recent_user_scheduler_intent or assistant_scheduler_prompted) and details_like
    debug_log(
        "should_continue_scheduler_flow",
        {
            "lookback": lookback,
            "current_message": current_message,
            "recent_user_messages": recent_user_messages,
            "recent_user_scheduler_intent": recent_user_scheduler_intent,
            "assistant_scheduler_prompted": assistant_scheduler_prompted,
            "looks_like_scheduler_details": details_like,
            "result": result,
        },
    )
    return result


def call_scheduler_tool(payload: dict) -> dict:
    debug_log(
        "call_scheduler_tool.request",
        {
            "url": SCHEDULER_API_URL,
            "history_count": len(payload.get("history") or []),
            "command": payload.get("command"),
        },
    )
    try:
        response = requests.post(SCHEDULER_API_URL, json=payload, timeout=SCHEDULER_API_TIMEOUT_SEC)
    except requests.RequestException as exc:
        raise RuntimeError(f"scheduler service unavailable: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text
        try:
            detail = response.json()
        except ValueError:
            pass
        raise RuntimeError(f"scheduler returned {response.status_code}: {detail}")

    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError("scheduler returned non-JSON response") from exc


def chat_json_response(content: dict, session_id: str) -> JSONResponse:
    response = JSONResponse(content=content)
    response.set_cookie("session_id", session_id, httponly=True, samesite="lax")
    return response


@app.get("/")
def home():
    with open("static/new-index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/ping")
def ping():
    return JSONResponse(content={"ok": True})


@app.get("/resume")
def resume():
    return JSONResponse(content=RESUME)


@app.post("/chats")
def chat(payload: dict, request: Request):
    debug_log(
        "chat.request",
        {
            "payload_keys": list(payload.keys()) if isinstance(payload, dict) else str(type(payload)),
            "has_session_id": bool(payload.get("session_id")) if isinstance(payload, dict) else False,
            "message": payload.get("message", "") if isinstance(payload, dict) else "",
        },
    )
    cookie_session_id = request.cookies.get("session_id")
    payload_session_id = payload.get("session_id")
    session_id = payload_session_id or cookie_session_id or str(uuid.uuid4())
    debug_log(
        "chat.session_sources",
        {
            "payload_session_id": payload_session_id,
            "cookie_session_id": cookie_session_id,
            "resolved_session_id": session_id,
        },
    )
    message = payload.get("message", "")
    if not session_id:
        return chat_json_response({"error": "NO SESSION ID!"}, str(uuid.uuid4()))
    debug_log("chat.session_id", session_id)
    history = CHAT_STORE.setdefault(session_id, [])
    debug_log("chat.history_before_append", {"session_id": session_id, "history_count": len(history)})
    history.append(f"User : {message}")
    debug_log("chat.history_after_append", {"session_id": session_id, "history_count": len(history)})
    intent = detect_intent(message)
    debug_log("chat.intent.detected", intent)
    should_continue = should_continue_scheduler_flow(message, history) if intent != "schedule_meeting" else False
    debug_log("chat.intent.should_continue_scheduler_flow", should_continue)
    if intent != "schedule_meeting" and should_continue:
        intent = "schedule_meeting"
    debug_log("chat.intent.final", intent)
    

    if intent == "schedule_meeting":

        tool_payload = {
            "command": message,
            "history": build_scheduler_history(history, max_messages=10),
        }

        debug_log("chat.scheduler.tool_payload", tool_payload)
        try:
            tool_result = call_scheduler_tool(tool_payload)
            debug_log("chat.scheduler.tool_result", tool_result)
            status = tool_result.get("status")
            if status == "too_soon":
                response = "You are trying to schedule a meeting too soon. Please enter a time at least 3 hours from now to scheduling another meeting."
                history.append(f"Assistant: {response}")
                return chat_json_response({"response": response}, session_id)
            elif status == "not_working_hours":
                response = "You are trying to schedule a meeting within working hours in JST. Please enter a time other than 9am and 6pm to schedule a meeting."
                history.append(f"Assistant: {response}")
                return chat_json_response({"response": response}, session_id)
            elif status == "no_attendees":
                response = "You did not specify any attendees for the meeting. Please include at least one attendee to schedule a meeting."
                history.append(f"Assistant: {response}")
                return chat_json_response({"response": response}, session_id)
            elif status == "conflict":
                response = "You are trying to schedule a meeting that conflicts with an existing meeting. Please choose a different time or date."
                history.append(f"Assistant: {response}")
                return chat_json_response({"response": response}, session_id)
            elif status == "incomplete":
                response = tool_result.get("reason") or "The information provided to schedule the meeting was incomplete. Please provide all necessary details including date, time, and attendees."    
                history.append(f"Assistant: {response}")
                return chat_json_response({
                    "response": (
                        f"{response}\n\n"
                        "Example command format:\n"
                        f"{json.dumps(SCHEDULER_COMMAND_EXAMPLE['command'], indent=2)}"
                    ),
                    "example_command": SCHEDULER_COMMAND_EXAMPLE["command"],
                }, session_id)
            elif status != "valid":
                response = tool_result.get("reason") or "Could not schedule the meeting due to an unknown scheduler status."
                history.append(f"Assistant: {response}")
                return chat_json_response({"response": response}, session_id)
        except Exception as exc:
            response = f"Could not schedule the meeting: {exc}"
            history.append(f"Assistant: {response}")
            return chat_json_response({"response": response}, session_id)

        meeting_link = tool_result.get("meet_link")
        structured_output = {
            "status": tool_result.get("status") or "valid",
            "meet_link": meeting_link or "No meet link generated",
            "event_id": tool_result.get("event_id"),
            "start_time": tool_result.get("start_time"),
            "duration": tool_result.get("duration"),
            "topic": tool_result.get("topic"),
        }

        response_lines = ["**Meeting Confirmed**"]
        if structured_output.get("topic"):
            response_lines.append(f"- Topic: {structured_output['topic']}")
        if structured_output.get("start_time"):
            response_lines.append(f"- Start time: {structured_output['start_time']}")
        if structured_output.get("duration"):
            response_lines.append(f"- Duration: {structured_output['duration']}")
        if structured_output.get("meet_link") and structured_output["meet_link"] != "No meet link generated":
            response_lines.append(f"- Meeting link: {structured_output['meet_link']}")
        if structured_output.get("event_id"):
            response_lines.append(f"- Event ID: {structured_output['event_id']}")
        response_lines.append("- Invitation email has been sent to all attendees.")

        response = "\n".join(response_lines)
        structured_output["message"] = response

        history.append(f"Assistant: {response}")
        return chat_json_response({"response": response, "scheduler_result": structured_output}, session_id)

    response = str(answer_resume_question(message, RESUME))
    history.append(f"Assistant: {response}")
    return chat_json_response({"response": response}, session_id)
