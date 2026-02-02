import json
from fastapi import FastAPI
from pydantic import BaseModel

from agent.planner import detect_intent
from tools.resume import answer_resume_question

app = FastAPI()

with open("resume.json") as f:
    RESUME = json.load(f)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    intent = detect_intent(req.message)

    if intent == "schedule_meeting":
        return {
            "reply": (
                "I can help schedule a meeting with Sagar. "
                "Please share a preferred date and time, and I’ll check availability."
            )
        }

    reply = answer_resume_question(req.message, RESUME)
    return {"reply": reply}
