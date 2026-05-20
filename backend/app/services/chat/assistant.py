"""Chat-scoped Q&A using the configured LLM (no tools; transcript-only).

Uses the same stack as Team Assistant: `generate_text` + `load_llm_config()` — i.e.
`GEMINI_API_KEY`, `LLM_MODEL` / `GEMMA_TEST_MODEL`, default `gemma-3-27b-it`,
`GEMINI_FALLBACK_MODELS`, `GEMINI_BASE_URL`, Gemma system-instruction merge, etc.
(`response_mime_json=False` here because answers are plain text, not JSON.)
"""

from __future__ import annotations

from backend.app import auth_state
from backend.app.llm import LlmError, generate_text, generate_text_guarded, load_llm_config

_MAX_TRANSCRIPT_CHARS = 56_000

CHAT_ASK_AI_SYSTEM = (
    "You answer questions using the chat transcript and any SCHEDULE CONTEXT block when provided. "
    "For scheduling, availability, free slots, or meeting-time questions, rely on SCHEDULE CONTEXT first. "
    "Do not say 'nothing relevant in this chat' when SCHEDULE CONTEXT answers the question. "
    "For other topics, use only the transcript; if it lacks the answer, say you found nothing relevant in the chat history. "
    "Do not invent facts. Keep answers concise."
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


def answer_from_transcript(
    transcript: str,
    question: str,
    *,
    user_id: str | None = None,
    schedule_context: str | None = None,
) -> str:
    q = question.strip()
    if not q:
        raise LlmError("Question is empty.")
    block = transcript.strip() if transcript.strip() else "(No messages in this conversation.)"
    schedule_block = ""
    if schedule_context and schedule_context.strip():
        schedule_block = (
            "\n\nSCHEDULE CONTEXT (use this for availability / meeting-time / calendar questions):\n"
            "-----\n"
            f"{schedule_context.strip()}\n"
            "-----\n"
        )
    user_prompt = (
        "Chat transcript:\n"
        "-----\n"
        f"{block}\n"
        "-----"
        f"{schedule_block}\n\n"
        f"Question: {q}\n\n"
        "Answer the question. Use SCHEDULE CONTEXT for scheduling/availability; otherwise use the transcript. "
        "Do not claim nothing was found if SCHEDULE CONTEXT already lists open slots."
    )
    cfg = load_llm_config()
    if user_id:
        return generate_text_guarded(
            user_id,
            "chat",
            user_prompt,
            system_prompt=CHAT_ASK_AI_SYSTEM,
            config=cfg,
            response_mime_json=False,
        )
    return generate_text(
        user_prompt,
        system_prompt=CHAT_ASK_AI_SYSTEM,
        config=cfg,
        response_mime_json=False,
    )
