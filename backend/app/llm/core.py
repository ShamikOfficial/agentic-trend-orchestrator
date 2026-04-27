"""Single entry point for calling different LLM providers."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv()


@dataclass
class LlmConfig:
    provider: str
    model: str
    fallback_models: list[str]
    api_key: str
    timeout_seconds: int = 30
    base_url: str = "https://generativelanguage.googleapis.com/v1beta"


class LlmError(RuntimeError):
    """Raised for LLM transport/provider failures."""


def load_llm_config() -> LlmConfig:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    model = os.getenv("LLM_MODEL", "gemini-flash-latest").strip()
    fallback_models_raw = os.getenv("GEMINI_FALLBACK_MODELS", "").strip()
    fallback_models = [item.strip() for item in fallback_models_raw.split(",") if item.strip()]
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
    base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").strip()
    return LlmConfig(
        provider=provider,
        model=model,
        fallback_models=fallback_models,
        api_key=api_key,
        timeout_seconds=timeout,
        base_url=base_url,
    )


def generate_text(prompt: str, *, system_prompt: str | None = None, config: LlmConfig | None = None) -> str:
    cfg = config or load_llm_config()
    if cfg.provider == "gemini":
        return _generate_text_gemini(prompt=prompt, system_prompt=system_prompt, config=cfg)
    raise LlmError(f"Unsupported LLM provider: {cfg.provider}")


def _generate_text_gemini(prompt: str, *, system_prompt: str | None, config: LlmConfig) -> str:
    if not config.api_key:
        raise LlmError("Missing GEMINI_API_KEY in environment.")

    models_to_try = [config.model, *config.fallback_models]
    last_error: str | None = None
    for model_name in models_to_try:
        try:
            return _generate_text_gemini_for_model(
                prompt=prompt,
                system_prompt=system_prompt,
                config=config,
                model_name=model_name,
            )
        except LlmError as exc:
            error_text = str(exc)
            last_error = error_text
            if _is_quota_or_limit_error(error_text):
                continue
            raise
    raise LlmError(f"All Gemini models failed. Last error: {last_error or 'unknown error'}")


def _generate_text_gemini_for_model(
    *,
    prompt: str,
    system_prompt: str | None,
    config: LlmConfig,
    model_name: str,
) -> str:
    url = f"{config.base_url}/models/{model_name}:generateContent"
    payload: dict[str, Any] = {
        "contents": [{"parts": [{"text": prompt}]}],
    }
    if system_prompt:
        payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

    req = Request(
        url=url,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-goog-api-key": config.api_key,
        },
        data=json.dumps(payload).encode("utf-8"),
    )
    try:
        with urlopen(req, timeout=config.timeout_seconds) as response:
            raw = response.read().decode("utf-8")
            if os.getenv("LLM_DEBUG_RAW", "1").strip().lower() in ("1", "true", "yes"):
                print(f"[llm-debug] model={model_name} raw_response=\n{raw}")
            data = json.loads(raw)
            _log_gemini_token_usage(model_name, data)
            extracted = _extract_gemini_text(data)
            if os.getenv("LLM_DEBUG_RAW", "1").strip().lower() in ("1", "true", "yes"):
                print(f"[llm-debug] model={model_name} extracted_text=\n{extracted}")
            return extracted
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise LlmError(f"Gemini model {model_name} HTTP error {exc.code}: {detail}") from exc
    except URLError as exc:
        raise LlmError(f"Gemini model {model_name} network error: {exc}") from exc


def _is_quota_or_limit_error(error_text: str) -> bool:
    lowered = error_text.lower()
    return any(
        token in lowered
        for token in ("429", "quota", "rate limit", "resource_exhausted", "too many requests")
    )


def _extract_gemini_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        raise LlmError("Gemini response has no candidates.")
    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    text = "\n".join(chunk for chunk in texts if chunk).strip()
    if not text:
        raise LlmError("Gemini returned empty text.")
    return text


def _log_gemini_token_usage(model_name: str, data: dict[str, Any]) -> None:
    """Temporary terminal logging for prompt/completion token debugging."""
    usage = data.get("usageMetadata") or {}
    prompt_tokens = usage.get("promptTokenCount", 0)
    output_tokens = usage.get("candidatesTokenCount", 0)
    total_tokens = usage.get("totalTokenCount", 0)
    print(
        f"[llm-debug] provider=gemini model={model_name} "
        f"prompt_tokens={prompt_tokens} output_tokens={output_tokens} total_tokens={total_tokens}"
    )

