from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "services": {
            "openai_configured": False,
            "milvus_connected": False,
        },
    }
