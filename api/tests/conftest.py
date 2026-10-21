"""Shared test setup. Every test gets a brand-new empty in-memory SQLite database."""
import os

# Settings() runs when app.config is imported, and it needs these two values.
# They must be set BEFORE any "from app..." import below.
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-real-use")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  (importing registers the tables on Model.metadata)
from app.database import Model, get_db
from app.main import app

API = "/api/v1"
PASSWORD = "password123"


@pytest.fixture
def db_engine():
    """A fresh in-memory database with all tables, thrown away after each test."""
    # StaticPool = one shared connection, so the in-memory DB isn't lost
    # between sessions.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_conn, _record):
        # SQLite ignores foreign keys (and ON DELETE CASCADE) unless told to
        # enforce them.
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Model.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(db_engine):
    """A TestClient whose get_db dependency points at the test database."""
    test_session = sessionmaker(bind=db_engine)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def register_and_login(client, email, password=PASSWORD):
    """Creates a user and returns the Authorization header for them."""
    client.post(f"{API}/auth/register", json={"email": email, "password": password})
    # Login is a form post, and the email goes in the "username" field.
    response = client.post(
        f"{API}/auth/login", data={"username": email, "password": password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers(client):
    """Headers for user A (logged in)."""
    return register_and_login(client, "a@example.com")


@pytest.fixture
def other_headers(client):
    """Headers for user B, used to check users can't touch each other's data."""
    return register_and_login(client, "b@example.com")


@pytest.fixture
def make_game(client):
    """Returns a function that creates a game. Override any field with kwargs."""

    def _make_game(headers, **overrides):
        body = {"title": "Halo", "platform": "Xbox"}
        body.update(overrides)
        return client.post(f"{API}/games/", json=body, headers=headers)

    return _make_game
