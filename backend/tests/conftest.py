import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "adminpass")
os.environ.setdefault("VIEWER_USERNAME", "viewer")
os.environ.setdefault("VIEWER_PASSWORD", "viewerpass")
os.environ.setdefault("INITIAL_BALANCE_USD", "30000")

from app.auth import hash_password  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, FundConfig, ProjectionParams, User  # noqa: E402

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    db = TestingSessionLocal()
    db.add(User(username="admin", password_hash=hash_password("adminpass"), role="admin"))
    db.add(User(username="viewer", password_hash=hash_password("viewerpass"), role="viewer"))
    db.add(Category(name="Otros", color="#94a3b8", is_default=True))
    db.add(FundConfig(initial_balance_usd=30000, current_balance_usd=30000))
    db.add(ProjectionParams(adjustment_percentage=0))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "adminpass"})
    return r.json()["access_token"]


@pytest.fixture
def viewer_token(client):
    r = client.post("/auth/login", json={"username": "viewer", "password": "viewerpass"})
    return r.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}
