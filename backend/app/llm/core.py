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


def _use_api_system_instruction(model_name: str) -> bool:
    """Some models (e.g. Gemma 3) return 400 if systemInstruction is set."""
    raw = os.getenv("GEMINI_USE_SYSTEM_INSTRUCTION", "auto").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    if raw in ("1", "true", "yes"):
        return True
    # auto: Gemma does not support developer/system instruction on the REST API
    return "gemma" not in model_name.lower()


def _merge_system_into_user_prompt(system_prompt: str, user_prompt: str) -> str:
    return f"{system_prompt.strip()}\n\n--- User prompt ---\n\n{user_prompt}"


def _supports_response_json_mime(model_name: str) -> bool:
    """Gemma models reject responseMimeType application/json on the REST API."""
    raw = os.getenv("GEMINI_USE_RESPONSE_JSON_MIME", "auto").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    if raw in ("1", "true", "yes"):
        return True
    return "gemma" not in model_name.lower()


def _llm_verbose() -> bool:
    return os.getenv("LLM_VERBOSE", "").strip().lower() in ("1", "true", "yes")


def _llm_debug_raw() -> bool:
    return os.getenv("LLM_DEBUG_RAW", "0").strip().lower() in ("1", "true", "yes")


def load_llm_config() -> LlmConfig:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    # Prefer explicit LLM_MODEL; else GEMMA_TEST_MODEL (same as gemini_test.ipynb); else Gemma default.
    _explicit = os.getenv("LLM_MODEL", "").strip()
    _notebook = os.getenv("GEMMA_TEST_MODEL", "").strip()
    model = _explicit or _notebook or "gemma-3-27b-it"
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


def generate_text(
    prompt: str,
    *,
    system_prompt: str | None = None,
    config: LlmConfig | None = None,
    response_mime_json: bool = False,
) -> str:
    cfg = config or load_llm_config()
    if cfg.provider == "gemini":
        return _generate_text_gemini(
            prompt=prompt,
            system_prompt=system_prompt,
            config=cfg,
            response_mime_json=response_mime_json,
        )
    raise LlmError(f"Unsupported LLM provider: {cfg.provider}")


def _generate_text_gemini(
    prompt: str,
    *,
    system_prompt: str | None,
    config: LlmConfig,
    response_mime_json: bool = False,
) -> str:
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
                response_mime_json=response_mime_json,
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
    response_mime_json: bool = False,
) -> str:
    url = f"{config.base_url}/models/{model_name}:generateContent"
    temp = float(os.getenv("LLM_TEMPERATURE", "0.25"))

    eff_prompt = prompt
    eff_system: str | None = system_prompt
    if system_prompt and not _use_api_system_instruction(model_name):
        eff_prompt = _merge_system_into_user_prompt(system_prompt, prompt)
        eff_system = None
        if _llm_verbose():
            print(
                f"[llm-debug] model={model_name} "
                "merged system into user content (no systemInstruction for this model)"
            )

    use_json_mime = response_mime_json and _supports_response_json_mime(model_name)
    mime_attempts = [True, False] if use_json_mime else [False]

    def build_payload(use_json_mime: bool) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": eff_prompt}]}],
        }
        if eff_system:
            payload["systemInstruction"] = {"parts": [{"text": eff_system}]}
        gc: dict[str, Any] = {"temperature": temp}
        if use_json_mime:
            gc["responseMimeType"] = "application/json"
        payload["generationConfig"] = gc
        return payload

    last_detail: str | None = None
    for attempt_json_mime in mime_attempts:
        payload = build_payload(attempt_json_mime)
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
                if _llm_debug_raw():
                    print(f"[llm-debug] model={model_name} json_mime={attempt_json_mime} raw_response=\n{raw}")
                data = json.loads(raw)
                _log_gemini_token_usage(model_name, data)
                extracted = _extract_gemini_text(data)
                if _llm_debug_raw():
                    print(f"[llm-debug] model={model_name} extracted_text=\n{extracted}")
                return extracted
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            last_detail = detail
            if (
                exc.code == 400
                and attempt_json_mime
                and use_json_mime
                and len(mime_attempts) > 1
            ):
                if _llm_verbose():
                    print(
                        f"[llm-debug] model={model_name} JSON MIME rejected; retrying without "
                        f"(detail={detail[:240]!r}…)"
                    )
                continue
            raise LlmError(f"Gemini model {model_name} HTTP error {exc.code}: {detail}") from exc
        except URLError as exc:
            raise LlmError(f"Gemini model {model_name} network error: {exc}") from exc

    raise LlmError(f"Gemini model {model_name} failed after MIME retries: {last_detail or 'unknown'}")


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
    first = candidates[0] if isinstance(candidates[0], dict) else {}
    reason = first.get("finishReason") or first.get("finish_reason")
    parts = first.get("content", {}).get("parts", [])
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    text = "\n".join(chunk for chunk in texts if chunk).strip()
    if not text:
        extra = f" finishReason={reason!r}" if reason else ""
        raise LlmError(f"Gemini returned empty text.{extra}")
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

