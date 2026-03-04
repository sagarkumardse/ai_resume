from backend.agent.llm import call_llm
from backend.tools.rag import (
    build_resume_index,
    load_cached_index,
    retrieve_relevant_chunks,
    save_cached_index,
)

_CACHE_PATH = "backend/tools/.cache/resume_bm25.json"
_INDEX = None

def answer_resume_question(
    user_message: str,
    resume: dict,
    history: list[str] | None = None) -> str:
    global _INDEX
    if _INDEX is None:
        cached = load_cached_index(_CACHE_PATH)
        current_id = None
        if cached:
            current_id, _, _ = build_resume_index(resume)
            if cached[0] == current_id:
                _INDEX = cached

        if _INDEX is None:
            _INDEX = build_resume_index(resume)
            save_cached_index(_CACHE_PATH, *_INDEX)

    history_text = ""
    if history:
        history_text = "\n".join(history[-6:])  # last 3 turns

    _, chunks, tokenized_chunks = _INDEX
    relevant = retrieve_relevant_chunks(user_message, chunks, tokenized_chunks, top_k=4)
    context = "\n\n".join(relevant)

    prompt = f"""
Relevant resume context:
{context}

Conversation so far:
{history_text}

User question:
{user_message}

Answer professionally, concisely, and only using the resume above.
"""

    return call_llm(prompt)
