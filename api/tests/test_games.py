from tests.conftest import API

GAMES = f"{API}/games/"


def titles(response):
    """Pulls just the titles out of a list response, in the order returned."""
    return [game["title"] for game in response.json()["games"]]


# ---- create ----

def test_create_game_success(client, auth_headers, make_game):
    """201, and defaults are filled in."""
    response = make_game(auth_headers, title="Zelda", platform="Switch 2")
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Zelda"
    assert body["status"] == "wishlist"
    assert body["favorite"] is False
    assert "id" in body


def test_create_game_requires_auth(client):
    response = client.post(GAMES, json={"title": "Halo", "platform": "Xbox"})
    assert response.status_code == 401


def test_create_game_empty_title_returns_422(client, auth_headers, make_game):
    assert make_game(auth_headers, title="").status_code == 422


def test_create_game_invalid_platform_returns_422(client, auth_headers, make_game):
    assert make_game(auth_headers, platform="Atari").status_code == 422


def test_create_game_invalid_status_returns_422(client, auth_headers, make_game):
    assert make_game(auth_headers, status="abandoned").status_code == 422


def test_create_game_rating_out_of_range_returns_422(client, auth_headers, make_game):
    assert make_game(auth_headers, rating=-1).status_code == 422
    assert make_game(auth_headers, rating=10.5).status_code == 422
    assert make_game(auth_headers, title="Low", rating=0).status_code == 201
    assert make_game(auth_headers, title="High", rating=10).status_code == 201


def test_create_game_bad_link_returns_422(client, auth_headers, make_game):
    assert make_game(auth_headers, link="ftp://example.com").status_code == 422
    assert make_game(auth_headers, link="example.com").status_code == 422
    assert make_game(auth_headers, link="https://example.com").status_code == 201


def test_create_duplicate_title_and_platform_returns_409(
    client, auth_headers, make_game
):
    assert make_game(auth_headers).status_code == 201
    assert make_game(auth_headers).status_code == 409


def test_same_title_on_different_platform_is_allowed(client, auth_headers, make_game):
    assert make_game(auth_headers, platform="Xbox").status_code == 201
    assert make_game(auth_headers, platform="PC").status_code == 201


def test_two_users_can_add_same_game(client, auth_headers, other_headers, make_game):
    assert make_game(auth_headers).status_code == 201
    assert make_game(other_headers).status_code == 201


# ---- list / filters / sort ----

def test_list_empty(client, auth_headers):
    response = client.get(GAMES, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"games": []}


def test_list_only_returns_my_games(client, auth_headers, other_headers, make_game):
    make_game(auth_headers, title="Halo")
    make_game(other_headers, title="Zelda")
    assert titles(client.get(GAMES, headers=auth_headers)) == ["Halo"]
    assert titles(client.get(GAMES, headers=other_headers)) == ["Zelda"]


def test_list_default_sort_is_by_title(client, auth_headers, make_game):
    for title in ["Zelda", "Sonic", "Halo"]:
        make_game(auth_headers, title=title)
    response = client.get(GAMES, headers=auth_headers)
    assert titles(response) == ["Halo", "Sonic", "Zelda"]


def test_list_sort_by_released_puts_null_dates_last(client, auth_headers, make_game):
    make_game(auth_headers, title="A No Date")
    make_game(auth_headers, title="B Newer", release_date="2022-01-01")
    make_game(auth_headers, title="C Older", release_date="2020-01-01")
    response = client.get(GAMES, params={"sort": "released"}, headers=auth_headers)
    assert titles(response) == ["C Older", "B Newer", "A No Date"]


def test_list_invalid_sort_returns_422(client, auth_headers):
    response = client.get(GAMES, params={"sort": "banana"}, headers=auth_headers)
    assert response.status_code == 422


def test_list_search_is_case_insensitive_substring(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo Infinite")
    make_game(auth_headers, title="Celeste")
    for term in ["halo", "HALO", "infin"]:
        response = client.get(GAMES, params={"search": term}, headers=auth_headers)
        assert titles(response) == ["Halo Infinite"]


def test_list_filter_by_platform(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo", platform="Xbox")
    make_game(auth_headers, title="Hades", platform="PC")
    response = client.get(GAMES, params={"platform": "PC"}, headers=auth_headers)
    assert titles(response) == ["Hades"]


def test_list_filter_by_status(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo", status="playing")
    make_game(auth_headers, title="Hades")  # defaults to wishlist
    response = client.get(GAMES, params={"status": "playing"}, headers=auth_headers)
    assert titles(response) == ["Halo"]


def test_list_filter_favorite(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo", favorite=True)
    make_game(auth_headers, title="Hades")
    response = client.get(GAMES, params={"favorite": True}, headers=auth_headers)
    assert titles(response) == ["Halo"]


def test_list_filter_released(client, auth_headers, make_game):
    make_game(auth_headers, title="Past", release_date="2000-01-01")
    make_game(auth_headers, title="Future", release_date="2999-01-01")
    make_game(auth_headers, title="No Date")
    response = client.get(GAMES, params={"released": True}, headers=auth_headers)
    assert titles(response) == ["Past"]


def test_list_filters_combine(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo", platform="Xbox", status="playing")
    make_game(auth_headers, title="Hades", platform="PC", status="playing")
    make_game(auth_headers, title="Gears", platform="Xbox", status="wishlist")
    response = client.get(
        GAMES, params={"platform": "Xbox", "status": "playing"}, headers=auth_headers
    )
    assert titles(response) == ["Halo"]


# ---- details ----

def test_get_game(client, auth_headers, make_game):
    game_id = make_game(auth_headers, title="Halo").json()["id"]
    response = client.get(f"{GAMES}{game_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Halo"


def test_get_missing_game_returns_404(client, auth_headers):
    response = client.get(f"{GAMES}999", headers=auth_headers)
    assert response.status_code == 404


def test_get_other_users_game_returns_404(
    client, auth_headers, other_headers, make_game
):
    game_id = make_game(other_headers).json()["id"]
    response = client.get(f"{GAMES}{game_id}", headers=auth_headers)
    assert response.status_code == 404


# ---- update ----

def test_update_game_changes_only_sent_fields(client, auth_headers, make_game):
    game_id = make_game(auth_headers, title="Halo", rating=8).json()["id"]
    response = client.patch(
        f"{GAMES}{game_id}", json={"status": "playing"}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "playing"
    assert body["title"] == "Halo"
    assert body["rating"] == 8


def test_update_can_set_nullable_field_to_null(client, auth_headers, make_game):
    game_id = make_game(auth_headers, notes="old notes").json()["id"]
    response = client.patch(
        f"{GAMES}{game_id}", json={"notes": None}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["notes"] is None


def test_update_required_field_to_null_returns_422(client, auth_headers, make_game):
    game_id = make_game(auth_headers).json()["id"]
    for field in ["title", "platform", "status", "favorite"]:
        response = client.patch(
            f"{GAMES}{game_id}", json={field: None}, headers=auth_headers
        )
        assert response.status_code == 422, field


def test_update_into_duplicate_returns_409(client, auth_headers, make_game):
    make_game(auth_headers, title="Halo", platform="Xbox")
    pc_id = make_game(auth_headers, title="Halo", platform="PC").json()["id"]
    # moving the PC copy to Xbox would make it identical to the first one
    response = client.patch(
        f"{GAMES}{pc_id}", json={"platform": "Xbox"}, headers=auth_headers
    )
    assert response.status_code == 409


def test_update_other_users_game_returns_404(
    client, auth_headers, other_headers, make_game
):
    game_id = make_game(other_headers, title="Halo").json()["id"]
    response = client.patch(
        f"{GAMES}{game_id}", json={"title": "Hacked"}, headers=auth_headers
    )
    assert response.status_code == 404
    # B's game is untouched
    mine = client.get(f"{GAMES}{game_id}", headers=other_headers)
    assert mine.json()["title"] == "Halo"


def test_update_missing_game_returns_404(client, auth_headers):
    response = client.patch(f"{GAMES}999", json={"title": "x"}, headers=auth_headers)
    assert response.status_code == 404


# ---- delete ----

def test_delete_game_returns_204_then_404(client, auth_headers, make_game):
    game_id = make_game(auth_headers).json()["id"]
    assert client.delete(f"{GAMES}{game_id}", headers=auth_headers).status_code == 204
    assert client.get(f"{GAMES}{game_id}", headers=auth_headers).status_code == 404


def test_delete_other_users_game_returns_404(
    client, auth_headers, other_headers, make_game
):
    game_id = make_game(other_headers).json()["id"]
    response = client.delete(f"{GAMES}{game_id}", headers=auth_headers)
    assert response.status_code == 404
    # B's game still exists
    assert client.get(f"{GAMES}{game_id}", headers=other_headers).status_code == 200


# ---- summary ----

def test_summary_empty(client, auth_headers):
    response = client.get(f"{GAMES}summary", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"total": 0, "by_platform": {}, "by_status": {}}


def test_summary_counts(client, auth_headers, make_game):
    # status defaults to wishlist
    make_game(auth_headers, title="Halo", platform="Xbox")
    make_game(auth_headers, title="Hades", platform="PC", status="playing")
    make_game(auth_headers, title="Gears", platform="Xbox", status="completed")
    response = client.get(f"{GAMES}summary", headers=auth_headers)
    assert response.json() == {
        "total": 3,
        "by_platform": {"Xbox": 2, "PC": 1},
        "by_status": {"wishlist": 1, "playing": 1, "completed": 1},
    }


def test_summary_ignores_other_users_games(
    client, auth_headers, other_headers, make_game
):
    make_game(other_headers)
    response = client.get(f"{GAMES}summary", headers=auth_headers)
    assert response.json()["total"] == 0


def test_summary_route_not_swallowed_by_game_id_route(client, auth_headers):
    response = client.get(f"{GAMES}summary", headers=auth_headers)
    assert response.status_code == 200
