import hashlib
import json
import os
from typing import List, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer


_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_MODEL = None


def _get_model() -> SentenceTransformer:
    global _MODEL
    if _MODEL is None:
        _MODEL = SentenceTransformer(_MODEL_NAME)
    return _MODEL


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


def build_resume_index(resume: dict) -> Tuple[str, List[str], np.ndarray]:
    resume_id = _resume_hash(resume)
    flattened = _flatten_resume(resume)
    chunks = _chunk_texts(flattened)
    model = _get_model()
    embeddings = model.encode(chunks, normalize_embeddings=True)
    return resume_id, chunks, embeddings


def retrieve_relevant_chunks(
    query: str,
    chunks: List[str],
    embeddings: np.ndarray,
    top_k: int = 4,
) -> List[str]:
    model = _get_model()
    q_emb = model.encode([query], normalize_embeddings=True)[0]
    scores = np.dot(embeddings, q_emb)
    top_indices = np.argsort(scores)[-top_k:][::-1]
    return [chunks[i] for i in top_indices]


def load_cached_index(cache_path: str) -> Tuple[str, List[str], np.ndarray] | None:
    if not os.path.exists(cache_path):
        return None
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        resume_id = data["resume_id"]
        chunks = data["chunks"]
        embeddings = np.array(data["embeddings"], dtype=np.float32)
        return resume_id, chunks, embeddings
    except Exception:
        return None


def save_cached_index(cache_path: str, resume_id: str, chunks: List[str], embeddings: np.ndarray) -> None:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    payload = {
        "resume_id": resume_id,
        "chunks": chunks,
        "embeddings": embeddings.tolist(),
    }
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=True)
