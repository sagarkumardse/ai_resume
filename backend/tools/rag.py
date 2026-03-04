import hashlib
import json
import os
import re
from typing import List, Tuple

from rank_bm25 import BM25Okapi


def _resume_hash(resume: dict) -> str:
    payload = json.dumps(resume, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _flatten_resume(resume: dict) -> List[str]:
    chunks = []

    for key, value in resume.items():
        if isinstance(value, list):
            for item in value:
                chunks.append(f"{key}: {json.dumps(item, ensure_ascii=True)}")
        elif isinstance(value, dict):
            chunks.append(f"{key}: {json.dumps(value, ensure_ascii=True)}")
        else:
            chunks.append(f"{key}: {value}")

    return chunks


def _chunk_texts(texts: List[str], max_chars: int = 900) -> List[str]:
    chunks = []
    current = []
    size = 0

    for text in texts:
        if size + len(text) + 1 > max_chars and current:
            chunks.append("\n".join(current))
            current = []
            size = 0
        current.append(text)
        size += len(text) + 1

    if current:
        chunks.append("\n".join(current))

    return chunks


def _tokenize(text: str) -> List[str]:
    # Lowercase alphanumeric tokenization keeps the retriever lightweight.
    return re.findall(r"\w+", text.lower())


def build_resume_index(resume: dict) -> Tuple[str, List[str], List[List[str]]]:
    resume_id = _resume_hash(resume)
    flattened = _flatten_resume(resume)
    chunks = _chunk_texts(flattened)
    tokenized_chunks = [_tokenize(chunk) for chunk in chunks]
    return resume_id, chunks, tokenized_chunks


def retrieve_relevant_chunks(
    query: str,
    chunks: List[str],
    tokenized_chunks: List[List[str]],
    top_k: int = 4,
) -> List[str]:
    if not chunks:
        return []
    bm25 = BM25Okapi(tokenized_chunks)
    query_tokens = _tokenize(query)
    if not query_tokens:
        return chunks[:top_k]
    scores = bm25.get_scores(query_tokens)
    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
    return [chunks[i] for i in top_indices]


def load_cached_index(cache_path: str) -> Tuple[str, List[str], List[List[str]]] | None:
    if not os.path.exists(cache_path):
        return None
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        resume_id = data["resume_id"]
        chunks = data["chunks"]
        tokenized_chunks = data.get("tokenized_chunks")
        if tokenized_chunks is None:
            return None
        return resume_id, chunks, tokenized_chunks
    except Exception:
        return None


def save_cached_index(
    cache_path: str,
    resume_id: str,
    chunks: List[str],
    tokenized_chunks: List[List[str]],
) -> None:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    payload = {
        "resume_id": resume_id,
        "chunks": chunks,
        "tokenized_chunks": tokenized_chunks,
    }
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=True)
