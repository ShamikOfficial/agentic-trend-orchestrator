import os
from datetime import UTC, datetime

import jwt
import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./data/test_app.db"
os.environ["AUTH_JWT_SECRET"] = "test-secret-for-jwt"
os.environ["LLM_MONTHLY_TOKEN_BUDGET"] = "1000"
os.environ["LLM_MAX_REQUESTS_PER_DAY"] = "10"
os.environ["ALLOW_PASSWORD_AUTH"] = "true"

from backend.app.main import app  # noqa: E402
from backend.app.persistence import auth_repo, llm_repo, workflow_repo  # noqa: E402
from backend.app.persistence.db import get_engine  # noqa: E402
from backend.app.persistence.models import Base  # noqa: E402
from backend.app.models.workflow import WorkflowItem  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_db():
    engine = get_engine()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_jwt_invalid_returns_401(client):
    response = client.get("/api/v1/chat/users", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401


def test_oauth_sync_creates_user(client):
    token = jwt.encode(
        {
            "email": "demo@example.com",
            "name": "Demo User",
            "provider": "google",
            "providerAccountId": "google-123",
        },
        "test-secret-for-jwt",
        algorithm="HS256",
    )
    response = client.post(
        "/api/v1/auth/oauth/sync",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"].startswith("usr_")


def test_workflow_repo_round_trip():
    item = WorkflowItem(
        item_id="item_test1",
        title="Test",
        description="",
        stage="Idea",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    workflow_repo.save_workflow_item(item)
    loaded = workflow_repo.get_workflow_item("item_test1")
    assert loaded is not None
    assert loaded.title == "Test"


def test_long_password_register_and_login(client):
    long_password = "p" * 100
    register = client.post(
        "/api/v1/auth/register",
        json={"username": "longpwuser", "password": long_password, "display_name": "Long PW"},
    )
    assert register.status_code == 200, register.text
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "longpwuser", "password": long_password},
    )
    assert login.status_code == 200, login.text
    assert login.json().get("token")


def test_llm_quota_blocks_when_exceeded():
    auth_repo.create_user_record(
        {
            "user_id": "usr_quota",
            "username": "quotauser",
            "display_name": "Quota",
            "password_hash": None,
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    with pytest.raises(llm_repo.QuotaExceededError):
        for _ in range(20):
            llm_repo.check_and_reserve_quota("usr_quota", estimated_tokens=100)
