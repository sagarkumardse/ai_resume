def detect_intent(user_message: str) -> str:
    msg = user_message.lower()

    if any(word in msg for word in ["schedule", "meeting", "calendar", 'set-up']):
        return "schedule_meeting"

    return "resume_question"
