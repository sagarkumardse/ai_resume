print("LOADED:", __file__)

import json
import os
import uuid
from typing import Dict, List

import requests
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.agent.planner import detect_intent
from backend.tools.resume import answer_resume_question

app = FastAPI()
CHAT_STORE: Dict[str, List[str]] = {}
SCHEDULER_API_BASE_URL = os.getenv("SCHEDULER_API_BASE_URL", "http://localhost:5000").rstrip("/")
SCHEDULER_API_PATH = os.getenv("SCHEDULER_API_PATH", "/schedule")
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


def build_scheduler_history(history: List[str], max_messages: int = 3) -> List[dict]:
    user_messages = []
    for item in history:
        if item.startswith("User : "):
            user_messages.append(item.replace("User : ", "", 1).strip())

    return user_messages[-max_messages:]


def call_scheduler_tool(payload: dict) -> dict:
    url = f"{SCHEDULER_API_BASE_URL}{SCHEDULER_API_PATH}"
    try:
        response = requests.post(url, json=payload, timeout=SCHEDULER_API_TIMEOUT_SEC)
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
def chat(payload: dict):
    session_id = payload.get("session_id") or str(uuid.uuid4())
    message = payload.get("message", "")
    if not session_id:
        return JSONResponse(content={"error": "NO SESSION ID!"})
    history = CHAT_STORE.setdefault(session_id, [])
    history.append(f"User : {message}")
    intent = detect_intent(message)
    

    if intent == "schedule_meeting":

        tool_payload = {
            "command": message,
            "history": build_scheduler_history(history, max_messages=3),
        }

        print("Scheduler tool payload:", tool_payload)
        try:
            tool_result = call_scheduler_tool(tool_payload)
            print(tool_result)
            status = tool_result.get("status")
            if status == "too_soon":
                response = "You are trying to schedule a meeting too soon. Please enter a time at least 3 hours from now to scheduling another meeting."
                history.append(f"Assistant: {response}")
                return JSONResponse(content={"response": response})
            elif status == "not_working_hours":
                response = "You are trying to schedule a meeting within working hours in JST. Please enter a time other than 9am and 6pm to schedule a meeting."
                history.append(f"Assistant: {response}")
                return JSONResponse(content={"response": response})
            elif status == "no_attendees":
                response = "You did not specify any attendees for the meeting. Please include at least one attendee to schedule a meeting."
                history.append(f"Assistant: {response}")
                return JSONResponse(content={"response": response})
            elif status == "conflict":
                response = "You are trying to schedule a meeting that conflicts with an existing meeting. Please choose a different time or date."
                history.append(f"Assistant: {response}")
                return JSONResponse(content={"response": response})
            elif status == "incomplete":
                response = tool_result.get("reason") or "The information provided to schedule the meeting was incomplete. Please provide all necessary details including date, time, and attendees."    
                history.append(f"Assistant: {response}")
                return JSONResponse(content={
                    "response": (
                        f"{response}\n\n"
                        "Example command format:\n"
                        f"{json.dumps(SCHEDULER_COMMAND_EXAMPLE['command'], indent=2)}"
                    ),
                    "example_command": SCHEDULER_COMMAND_EXAMPLE["command"],
                })
            elif status != "valid":
                response = tool_result.get("reason") or "Could not schedule the meeting due to an unknown scheduler status."
                history.append(f"Assistant: {response}")
                return JSONResponse(content={"response": response})
        except Exception as exc:
            response = f"Could not schedule the meeting: {exc}"
            history.append(f"Assistant: {response}")
            return JSONResponse(content={"response": response})

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
        return JSONResponse(content={"response": response, "scheduler_result": structured_output})

    response = str(answer_resume_question(message, RESUME))
    history.append(f"Assistant: {response}")
    return JSONResponse(content={"response": response})

