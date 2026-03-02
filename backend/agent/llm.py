import os
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv
from backend.tools.prompts import system_prompt

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY environment variable")

client = Groq(api_key=GROQ_API_KEY)

MODEL = "llama-3.3-70b-versatile"

def call_llm(prompt: str) -> str:

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=8000
    )

    # usage = response.usage
    # print("TOKEN USED : ", usage)

    return response.choices[0].message.content
