import time

import jwt

from app.config import settings
from tests.conftest import API, PASSWORD


def test_register_success(client):
    """ register returns 201 and the user, without the password."""
    response = client.post(
        f"{API}/auth/register",
        json={"email": "new@example.com", "password": PASSWORD, "name": "New"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_duplicate_email_returns_409(client):
    """ Register same email twice, returns 409 """
    body = {"email": "test@example.com", "password": PASSWORD, "name": "Mike"}
    response = client.post(f"{API}/auth/register", json=body)
    assert response.status_code == 201
    response = client.post(f"{API}/auth/register", json=body)
    assert response.status_code == 409


def test_register_short_password_returns_422(client):
    """ Errors on password shorter then 8 characters, returns 422 """
    response = client.post(
        f"{API}/auth/register",
        json={"email": "new@example.com", "password": "1234", "name": "New"},
    )
    assert response.status_code == 422


def test_register_invalid_email_returns_422(client):
    """ returns 422 with invalid email """
    response = client.post(
        f"{API}/auth/register",
        json={"email": "testuser", "password": PASSWORD, "name": "New"},
    )
    assert response.status_code == 422


def test_login_success_returns_token(client):
    """ login success and returns token  """
    client.post(
        f"{API}/auth/register",
        json={"email": "new@example.com", "password": PASSWORD, "name": "New"},
    )

    response = client.post(
        f"{API}/auth/login",
        data={"username": "new@example.com", "password": PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password_returns_401(client):
    """ login fail with wrong password """
    client.post(
        f"{API}/auth/register",
        json={"email": "new@example.com", "password": PASSWORD, "name": "New"},
    )
    response = client.post(
        f"{API}/auth/login",
        data={"username": "new@example.com", "password": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_login_unknown_email_returns_401(client):
    """ login with an email that was never registered: same 401 and same message
    as a wrong password, so nobody can tell which emails exist """
    response = client.post(
        f"{API}/auth/login",
        data={"username": "nobody@example.com", "password": PASSWORD},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"


def test_protected_route_without_token_returns_401(client):
    """ A route that needs login rejects a request with no token """
    response = client.get(f"{API}/users/me")
    assert response.status_code == 401


def test_garbage_token_returns_401(client):
    """ A token that isn't a real JWT is rejected """
    response = client.get(f"{API}/users/me", headers={"Authorization": "Bearer abc"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


def test_token_signed_with_wrong_key_returns_401(client):
    """ A well-formed token signed with a different secret is rejected """
    token = jwt.encode(
        {"sub": "1", "exp": int(time.time()) + 3600},
        "x" * 32,  # not the app's secret key
        algorithm="HS256",
    )
    response = client.get(
        f"{API}/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_expired_token_returns_401(client):
    """ A token signed with the right key but already past its expiry is rejected """
    token = jwt.encode(
        {"sub": "1", "exp": int(time.time()) - 60},
        settings.secret_key,
        algorithm="HS256",
    )
    response = client.get(
        f"{API}/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_token_for_deleted_user_returns_401(client, auth_headers):
    """ A valid token stops working once its user is deleted """
    assert client.get(f"{API}/users/me", headers=auth_headers).status_code == 200
    client.delete(f"{API}/users/me", headers=auth_headers)
    response = client.get(f"{API}/users/me", headers=auth_headers)
    assert response.status_code == 401
