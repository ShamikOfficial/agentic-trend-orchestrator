"""Single entry point for calling different LLM providers."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.app.env import load_app_env

load_app_env()


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


class LlmQuotaError(LlmError):
    """Raised when per-user trial quota is exceeded."""

    def __init__(self, detail: str, *, tokens_used: int, token_budget: int) -> None:
        super().__init__(detail)
        self.tokens_used = tokens_used
        self.token_budget = token_budget


@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    model: str = ""


_last_token_usage: TokenUsage | None = None


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


def _is_gemma4_model(model_name: str) -> bool:
    return "gemma-4" in model_name.lower() or "gemma4" in model_name.lower()


def _gemma_thinking_config(model_name: str) -> dict[str, Any] | None:
    """Gemma 4 defaults to heavy internal reasoning; MINIMAL cuts latency and 500s."""
    if not _is_gemma4_model(model_name):
        return None
    level = os.getenv("GEMMA_THINKING_LEVEL", "MINIMAL").strip().upper()
    if level in ("", "0", "OFF", "NONE", "DISABLE"):
        return None
    return {"thinkingLevel": level}


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


def _is_gemma_model(model_name: str) -> bool:
    """Gemma ids only — exclude Gemini Flash/Pro (separate quota)."""
    lowered = model_name.lower()
    return "gemma" in lowered and "flash" not in lowered and not lowered.startswith("gemini-")


def _gemma_model_chain(*names: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for name in names:
        n = name.strip()
        if not n or n in seen or not _is_gemma_model(n):
            continue
        seen.add(n)
        out.append(n)
    return out


_DEFAULT_GEMMA_FALLBACKS = ["gemma-4-26b-a4b-it"]
_DEFAULT_GEMMA_PRIMARY = "gemma-4-31b-it"


def resolved_gemma_model_chain(config: LlmConfig | None = None) -> list[str]:
    """Primary + fallbacks actually used for API calls (Gemma only)."""
    cfg = config or load_llm_config()
    return _gemma_model_chain(cfg.model, *cfg.fallback_models)


def load_llm_config() -> LlmConfig:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    # Prefer explicit LLM_MODEL; else GEMMA_TEST_MODEL (same as gemini_test.ipynb); else Gemma default.
    _explicit = os.getenv("LLM_MODEL", "").strip()
    _notebook = os.getenv("GEMMA_TEST_MODEL", "").strip()
    raw_primary = _explicit or _notebook or _DEFAULT_GEMMA_PRIMARY
    model = raw_primary if _is_gemma_model(raw_primary) else _DEFAULT_GEMMA_PRIMARY
    fallback_models_raw = os.getenv("GEMINI_FALLBACK_MODELS", "").strip()
    parsed = [item.strip() for item in fallback_models_raw.split(",") if item.strip()]
    fallback_models = _gemma_model_chain(*parsed) or _gemma_model_chain(*_DEFAULT_GEMMA_FALLBACKS)
    fallback_models = [m for m in fallback_models if m != model]
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
    text, _usage, _model = _generate_text_with_usage(
        prompt=prompt,
        system_prompt=system_prompt,
        config=config,
        response_mime_json=response_mime_json,
    )
    return text


def generate_text_guarded(
    user_id: str,
    feature: str,
    prompt: str,
    *,
    system_prompt: str | None = None,
    config: LlmConfig | None = None,
    response_mime_json: bool = False,
    estimated_tokens: int = 4000,
) -> str:
    if os.getenv("LLM_GLOBAL_DISABLED", "").strip().lower() in ("1", "true", "yes"):
        raise LlmError("AI features are temporarily disabled.")

    from backend.app.persistence import llm_repo

    try:
        llm_repo.check_and_reserve_quota(user_id, estimated_tokens=estimated_tokens)
    except llm_repo.QuotaExceededError as exc:
        raise LlmQuotaError(
            exc.detail,
            tokens_used=exc.tokens_used,
            token_budget=exc.token_budget,
        ) from exc

    text, usage, model_name = _generate_text_with_usage(
        prompt=prompt,
        system_prompt=system_prompt,
        config=config,
        response_mime_json=response_mime_json,
    )
    llm_repo.record_usage(
        user_id,
        feature=feature,
        model=model_name or (config.model if config else load_llm_config().model),
        prompt_tokens=usage.prompt_tokens,
        output_tokens=usage.output_tokens,
        total_tokens=usage.total_tokens,
    )
    return text


def pop_last_token_usage() -> TokenUsage | None:
    global _last_token_usage
    usage = _last_token_usage
    _last_token_usage = None
    return usage


def _generate_text_with_usage(
    prompt: str,
    *,
    system_prompt: str | None = None,
    config: LlmConfig | None = None,
    response_mime_json: bool = False,
) -> tuple[str, TokenUsage, str]:
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
) -> tuple[str, TokenUsage, str]:
    if not config.api_key:
        raise LlmError("Missing GEMINI_API_KEY in environment.")

    models_to_try = resolved_gemma_model_chain(config)
    if not models_to_try:
        models_to_try = _gemma_model_chain(_DEFAULT_GEMMA_PRIMARY, *_DEFAULT_GEMMA_FALLBACKS)
    last_error: str | None = None
    for model_name in models_to_try:
        if not _is_gemma_model(model_name):
            continue
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
            if (
                _is_quota_or_limit_error(error_text)
                or _is_model_not_found_error(error_text)
                or _is_transient_server_error(error_text)
            ):
                if _llm_verbose() and _is_transient_server_error(error_text):
                    print(f"[llm-debug] transient error on {model_name}, trying next Gemma model")
                continue
            raise
    raise LlmError(f"All Gemma models failed. Last error: {last_error or 'unknown error'}")


def _generate_text_gemini_for_model(
    *,
    prompt: str,
    system_prompt: str | None,
    config: LlmConfig,
    model_name: str,
    response_mime_json: bool = False,
) -> tuple[str, TokenUsage, str]:
    if not _is_gemma_model(model_name):
        raise LlmError(
            f"Model {model_name!r} is blocked. Use Gemma only (e.g. gemma-4-31b-it). "
            "Remove gemini-*-flash from LLM_MODEL / GEMINI_FALLBACK_MODELS and restart the server."
        )
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
        thinking = _gemma_thinking_config(model_name)
        if thinking:
            gc["thinkingConfig"] = thinking
        payload["generationConfig"] = gc
        return payload

    transient_retries = max(0, int(os.getenv("GEMINI_TRANSIENT_RETRIES", "2")))
    last_detail: str | None = None
    for attempt_json_mime in mime_attempts:
        payload = build_payload(attempt_json_mime)
        retry_without_json_mime = False
        for transient_attempt in range(transient_retries + 1):
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
                        print(
                            f"[llm-debug] model={model_name} json_mime={attempt_json_mime} "
                            f"raw_response=\n{raw}"
                        )
                    data = json.loads(raw)
                    usage = _parse_gemini_token_usage(model_name, data)
                    global _last_token_usage
                    _last_token_usage = usage
                    if _llm_verbose():
                        print(
                            f"[llm-debug] provider=gemini model={model_name} "
                            f"prompt_tokens={usage.prompt_tokens} output_tokens={usage.output_tokens} "
                            f"total_tokens={usage.total_tokens}"
                        )
                    extracted = _extract_gemini_text(data)
                    if _llm_debug_raw():
                        print(f"[llm-debug] model={model_name} extracted_text=\n{extracted}")
                    return extracted, usage, model_name
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
                    retry_without_json_mime = True
                    break
                if _is_transient_http_code(exc.code) and transient_attempt < transient_retries:
                    delay = 1.0 * (transient_attempt + 1)
                    if _llm_verbose():
                        print(
                            f"[llm-debug] model={model_name} HTTP {exc.code}, "
                            f"retry {transient_attempt + 1}/{transient_retries} in {delay}s"
                        )
                    time.sleep(delay)
                    continue
                raise LlmError(f"Gemini model {model_name} HTTP error {exc.code}: {detail}") from exc
            except URLError as exc:
                if transient_attempt < transient_retries:
                    time.sleep(1.0 * (transient_attempt + 1))
                    continue
                raise LlmError(f"Gemini model {model_name} network error: {exc}") from exc
        if retry_without_json_mime:
            continue

    raise LlmError(f"Gemini model {model_name} failed after MIME retries: {last_detail or 'unknown'}")


def _is_quota_or_limit_error(error_text: str) -> bool:
    lowered = error_text.lower()
    return any(
        token in lowered
        for token in ("429", "quota", "rate limit", "resource_exhausted", "too many requests")
    )


def _is_model_not_found_error(error_text: str) -> bool:
    lowered = error_text.lower()
    return "404" in lowered and "not_found" in lowered


def _is_transient_http_code(code: int) -> bool:
    return code in (500, 502, 503, 504)


def _is_transient_server_error(error_text: str) -> bool:
    lowered = error_text.lower()
    if any(f"http error {code}" in lowered for code in (500, 502, 503, 504)):
        return True
    return '"status": "internal"' in lowered or '"code": 500' in lowered


def _extract_gemini_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        raise LlmError("Gemini response has no candidates.")
    first = candidates[0] if isinstance(candidates[0], dict) else {}
    reason = first.get("finishReason") or first.get("finish_reason")
    parts = first.get("content", {}).get("parts", [])
    answer_parts = [
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and not part.get("thought")
    ]
    if not any(p.strip() for p in answer_parts):
        answer_parts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    text = "\n".join(chunk for chunk in answer_parts if chunk).strip()
    if not text:
        extra = f" finishReason={reason!r}" if reason else ""
        raise LlmError(f"Gemini returned empty text.{extra}")
    return text


def _parse_gemini_token_usage(model_name: str, data: dict[str, Any]) -> TokenUsage:
    usage = data.get("usageMetadata") or {}
    prompt_tokens = int(usage.get("promptTokenCount", 0) or 0)
    output_tokens = int(usage.get("candidatesTokenCount", 0) or 0)
    total_tokens = int(usage.get("totalTokenCount", 0) or 0) or (prompt_tokens + output_tokens)
    return TokenUsage(
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        model=model_name,
    )

