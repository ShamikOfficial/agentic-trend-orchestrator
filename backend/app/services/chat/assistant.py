"""Chat-scoped Q&A using the configured LLM (no tools; transcript-only).

Uses the same stack as Team Assistant: `generate_text` + `load_llm_config()` — i.e.
`GEMINI_API_KEY`, `LLM_MODEL` / `GEMMA_TEST_MODEL`, default `gemma-3-27b-it`,
`GEMINI_FALLBACK_MODELS`, `GEMINI_BASE_URL`, Gemma system-instruction merge, etc.
(`response_mime_json=False` here because answers are plain text, not JSON.)
"""

from __future__ import annotations

from backend.app import auth_state
from backend.app.llm import LlmError, generate_text, load_llm_config

_MAX_TRANSCRIPT_CHARS = 56_000

CHAT_ASK_AI_SYSTEM = (
    "You answer questions using ONLY the chat transcript provided by the user message. "
    "Do not use outside knowledge, the web, or assumptions beyond what is explicitly stated in that transcript. "
    "If the transcript is empty, say there are no messages in this chat yet. "
    "If the transcript does not contain information needed to answer, say clearly that you found nothing "
    "relevant in this chat history—do not guess or invent details. "
    "Keep answers concise."
)


def _display_name(user_id: str) -> str:
    try:
        u = auth_state.safe_user(user_id)
        return str(u.get("display_name") or u.get("username") or user_id)
    except KeyError:
        return user_id


def format_transcript(messages: list[dict]) -> str:
    if not messages:
        return ""
    lines: list[str] = []
    for m in messages:
        sid = str(m.get("sender_id", ""))
        ts = str(m.get("created_at", ""))
        body = str(m.get("content", "")).replace("\r\n", "\n")
        lines.append(f"[{ts}] {_display_name(sid)}: {body}")
    text = "\n".join(lines)
    if len(text) > _MAX_TRANSCRIPT_CHARS:
        text = text[-_MAX_TRANSCRIPT_CHARS:]
        text = "[… earlier messages truncated …]\n" + text
    return text


def answer_from_transcript(transcript: str, question: str) -> str:
    q = question.strip()
    if not q:
        raise LlmError("Question is empty.")
    block = transcript.strip() if transcript.strip() else "(No messages in this conversation.)"
    user_prompt = (
        "Chat transcript — this is your ONLY source of facts:\n"
        "-----\n"
        f"{block}\n"
        "-----\n\n"
        f"Question: {q}\n\n"
        "Answer using only the transcript above. If it does not support an answer, say you found nothing relevant in this chat."
    )
    cfg = load_llm_config()
    return generate_text(
        user_prompt,
        system_prompt=CHAT_ASK_AI_SYSTEM,
        config=cfg,
        response_mime_json=False,
    )
