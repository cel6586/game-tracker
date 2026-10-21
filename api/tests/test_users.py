from tests.conftest import API, PASSWORD, register_and_login

NEW_PASSWORD = "mypassword"


def test_get_me_returns_current_user(client, auth_headers):
    response = client.get(f"{API}/users/me", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "a@example.com"
    assert "hashed_password" not in body


def test_update_name(client, auth_headers):
    response = client.patch(
        f"{API}/users/me", json={"name": "Craig"}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Craig"
    assert response.json()["email"] == "a@example.com"  # not sent, so unchanged


def test_update_email(client, auth_headers):
    response = client.patch(
        f"{API}/users/me", json={"email": "new@example.com"}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"


def test_update_email_to_existing_email_returns_409(
    client, auth_headers, other_headers
):
    response = client.patch(
        f"{API}/users/me", json={"email": "b@example.com"}, headers=auth_headers
    )
    assert response.status_code == 409


def test_update_email_null_returns_422(client, auth_headers):
    response = client.patch(
        f"{API}/users/me", json={"email": None}, headers=auth_headers
    )
    assert response.status_code == 422


def test_change_password_success(client, auth_headers):
    response = client.patch(
        f"{API}/users/me/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=auth_headers,
    )
    assert response.status_code == 204

    old = client.post(
        f"{API}/auth/login", data={"username": "a@example.com", "password": PASSWORD}
    )
    new = client.post(
        f"{API}/auth/login",
        data={"username": "a@example.com", "password": NEW_PASSWORD},
    )
    assert old.status_code == 401
    assert new.status_code == 200


def test_change_password_wrong_current_returns_400(client, auth_headers):
    response = client.patch(
        f"{API}/users/me/password",
        json={"current_password": "not-my-password", "new_password": NEW_PASSWORD},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_change_password_too_short_returns_422(client, auth_headers):
    response = client.patch(
        f"{API}/users/me/password",
        json={"current_password": PASSWORD, "new_password": "short"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_delete_account_returns_204_and_user_cannot_login(client, auth_headers):
    response = client.delete(f"{API}/users/me", headers=auth_headers)
    assert response.status_code == 204

    login = client.post(
        f"{API}/auth/login", data={"username": "a@example.com", "password": PASSWORD}
    )
    assert login.status_code == 401


def test_delete_account_deletes_their_games(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo")
    make_game(auth_headers, title="Hades")
    client.delete(f"{API}/users/me", headers=auth_headers)

    new_headers = register_and_login(client, "a@example.com")
    response = client.get(f"{API}/games/", headers=new_headers)
    assert response.json() == {"games": []}


def test_delete_account_does_not_delete_other_users_games(
    client, auth_headers, other_headers, make_game
):
    make_game(other_headers, title="Zelda")
    client.delete(f"{API}/users/me", headers=auth_headers)

    response = client.get(f"{API}/games/", headers=other_headers)
    assert [g["title"] for g in response.json()["games"]] == ["Zelda"]
