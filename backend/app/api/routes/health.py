from fastapi import APIRouter

from backend.app.llm.core import load_llm_config, resolved_gemma_model_chain

router = APIRouter()


@router.get("/health")
def health_check() -> dict:
    cfg = load_llm_config()
    chain = resolved_gemma_model_chain(cfg)
    return {
        "status": "ok",
        "services": {
            "openai_configured": False,
            "faiss_ready": True,
        },
        "llm": {
            "provider": cfg.provider,
            "primary": cfg.model,
            "fallbacks": cfg.fallback_models,
            "chain": chain,
            "gemma_only": all("gemma" in m for m in chain),
        },
    }
