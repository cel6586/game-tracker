"""Tests for the IGDB search. IGDB is never called, requests.post is replaced."""
import time
from datetime import date

import pytest
import requests

from app import igdb
from tests.conftest import API

SEARCH = f"{API}/games/search"

DAWNWALKER = {
    "id": 282831,
    "name": "The Blood of Dawnwalker",
    "cover": {"id": 523534, "image_id": "cob7ym"},
    "first_release_date": 1788393600,
    "involved_companies": [
        {"company": {"name": "Rebel Wolves"}, "developer": True},
        {"company": {"name": "Bandai Namco Entertainment"}, "developer": False},
    ],
    "platforms": [
        {"id": 169, "name": "Xbox Series X|S"},
        {"id": 6, "name": "PC (Microsoft Windows)"},
        {"id": 167, "name": "PlayStation 5"},
    ],
}


# ---- parse_game ----

def test_parse_game_full():
    parsed = igdb.parse_game(DAWNWALKER)
    assert parsed == {
        "igdb_id": 282831,
        "title": "The Blood of Dawnwalker",
        "release_date": date(2026, 9, 3),
        "cover_url": "https://images.igdb.com/igdb/image/upload/t_cover_big/cob7ym.jpg",
        "platforms": ["Xbox", "PC", "PS5"],
        "developer": "Rebel Wolves",
    }


def test_parse_game_missing_fields():
    """IGDB leaves keys out when it has no data, none of them may crash."""
    parsed = igdb.parse_game({"id": 1, "name": "Bare Game"})
    assert parsed["release_date"] is None
    assert parsed["cover_url"] is None
    assert parsed["developer"] is None
    assert parsed["platforms"] == ["Other"]


def test_parse_game_both_switches_become_one_platform():
    game = {"id": 1, "name": "Zelda",
            "platforms": [{"id": 130, "name": "Nintendo Switch"},
                          {"id": 508, "name": "Nintendo Switch 2"}]}
    assert igdb.parse_game(game)["platforms"] == ["Switch 2"]


def test_parse_game_unmapped_platforms_are_dropped():
    game = {"id": 1, "name": "Old Game",
            "platforms": [{"id": 19, "name": "Super Nintendo"},
                          {"id": 6, "name": "PC (Microsoft Windows)"}]}
    assert igdb.parse_game(game)["platforms"] == ["PC"]


def test_parse_game_joins_several_developers():
    game = {"id": 1, "name": "Halo",
            "involved_companies": [
                {"company": {"name": "Rockstar North"}, "developer": True},
                {"company": {"name": "Rockstar Games"}, "developer": True},
                {"company": {"name": "Take-Two"}, "developer": False}]}
    assert igdb.parse_game(game)["developer"] == "Rockstar North, Rockstar Games"


# ---- sort_games ----

def test_sort_games_drops_games_without_a_cover():
    games = [{"name": "Halo", "cover": {"image_id": "a"}}, {"name": "Halo Mod"}]
    assert [g["name"] for g in igdb.sort_games(games, "halo")] == ["Halo"]


def test_sort_games_puts_best_matches_first():
    cover = {"image_id": "x"}
    games = [
        {"name": "Super Halo Bros", "cover": cover},
        {"name": "Halo Wars", "cover": cover},
        {"name": "Totally Different", "cover": cover},
        {"name": "Halo", "cover": cover},
    ]
    ordered = [g["name"] for g in igdb.sort_games(games, " HALO ")]
    assert ordered == ["Halo", "Halo Wars", "Super Halo Bros", "Totally Different"]


# ---- game_query ----

class FakeResponse:
    def __init__(self, status_code=200, data=None):
        self.status_code = status_code
        self._data = data if data is not None else []

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")


@pytest.fixture
def good_token(monkeypatch):
    """A token that is still valid, so game_query doesn't ask Twitch for one."""
    monkeypatch.setitem(igdb._token, "value", "test-token")
    monkeypatch.setitem(igdb._token, "expires_at", time.time() + 10000)


@pytest.fixture
def fake_post(monkeypatch):
    """Fake requests.post. Put its answers in .igdb_replies and .token_replies."""
    class Fake:
        def __init__(self):
            self.calls = []
            self.igdb_replies = []
            self.token_replies = []

        def __call__(self, url, data=None, headers=None, timeout=None):
            self.calls.append({"url": url, "data": data, "headers": headers})
            if url == igdb.igdb_auth_url:
                replies = self.token_replies
            else:
                replies = self.igdb_replies
            reply = replies.pop(0)
            if isinstance(reply, Exception):
                raise reply
            return reply

    fake = Fake()
    monkeypatch.setattr(igdb.requests, "post", fake)
    return fake


def test_game_query_returns_parsed_games(good_token, fake_post):
    fake_post.igdb_replies = [FakeResponse(200, [DAWNWALKER])]
    games = igdb.game_query("dawnwalker")
    assert [g["title"] for g in games] == ["The Blood of Dawnwalker"]
    call = fake_post.calls[0]
    assert call["url"] == igdb.igdb_url
    assert call["headers"]["Authorization"] == "Bearer test-token"
    assert 'search "dawnwalker";' in call["data"]
    assert "where game_type = (0, 2, 4, 8, 9, 10, 11)" in call["data"]


def test_game_query_escapes_quotes(good_token, fake_post):
    fake_post.igdb_replies = [FakeResponse(200, [])]
    igdb.game_query('say "hi" \\')
    assert 'search "say \\"hi\\" \\\\";' in fake_post.calls[0]["data"]


def test_game_query_fetches_a_token_when_expired(monkeypatch, fake_post):
    monkeypatch.setitem(igdb._token, "value", None)
    monkeypatch.setitem(igdb._token, "expires_at", 0.0)
    fake_post.token_replies = [
        FakeResponse(200, {"access_token": "fresh", "expires_in": 5000})]
    fake_post.igdb_replies = [FakeResponse(200, [])]
    igdb.game_query("halo")
    assert fake_post.calls[0]["url"] == igdb.igdb_auth_url
    assert fake_post.calls[1]["headers"]["Authorization"] == "Bearer fresh"


def test_game_query_reuses_a_valid_token(good_token, fake_post):
    fake_post.igdb_replies = [FakeResponse(200, []), FakeResponse(200, [])]
    igdb.game_query("halo")
    igdb.game_query("mario")
    assert all(call["url"] == igdb.igdb_url for call in fake_post.calls)


def test_game_query_retries_once_on_401(good_token, fake_post):
    fake_post.igdb_replies = [FakeResponse(401), FakeResponse(200, [DAWNWALKER])]
    fake_post.token_replies = [
        FakeResponse(200, {"access_token": "fresh", "expires_in": 5000})]
    games = igdb.game_query("dawnwalker")
    assert len(games) == 1
    assert fake_post.calls[-1]["headers"]["Authorization"] == "Bearer fresh"


def test_game_query_gives_up_after_a_second_401(good_token, fake_post):
    fake_post.igdb_replies = [FakeResponse(401), FakeResponse(401)]
    fake_post.token_replies = [
        FakeResponse(200, {"access_token": "fresh", "expires_in": 5000})]
    with pytest.raises(igdb.IGDBError):
        igdb.game_query("halo")


def test_game_query_other_errors_raise_without_retry(good_token, fake_post):
    fake_post.igdb_replies = [FakeResponse(400)]
    with pytest.raises(igdb.IGDBError):
        igdb.game_query("halo")
    assert len(fake_post.calls) == 1


def test_game_query_network_error_raises(good_token, fake_post):
    fake_post.igdb_replies = [requests.ConnectionError("no route")]
    with pytest.raises(igdb.IGDBError):
        igdb.game_query("halo")


def test_token_failure_raises(monkeypatch, fake_post):
    monkeypatch.setitem(igdb._token, "expires_at", 0.0)
    fake_post.token_replies = [FakeResponse(400)]
    with pytest.raises(igdb.IGDBError):
        igdb.game_query("halo")


# ---- the /games/search route ----

def test_search_requires_login(client):
    assert client.get(SEARCH, params={"game": "halo"}).status_code == 401


def test_search_returns_the_games(client, auth_headers, monkeypatch):
    found = [{"igdb_id": 1, "title": "Halo", "release_date": None,
              "cover_url": None, "platforms": ["Xbox"], "developer": None}]
    monkeypatch.setattr("app.endpoints.games.game_query", lambda text: found)
    response = client.get(SEARCH, params={"game": "halo"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == found


def test_search_strips_the_text(client, auth_headers, monkeypatch):
    seen = []
    monkeypatch.setattr("app.endpoints.games.game_query",
                        lambda text: seen.append(text) or [])
    client.get(SEARCH, params={"game": "  halo  "}, headers=auth_headers)
    assert seen == ["halo"]


@pytest.mark.parametrize("text", ["", "a", "   ", " a "])
def test_search_too_short_returns_422(client, auth_headers, monkeypatch, text):
    monkeypatch.setattr("app.endpoints.games.game_query", lambda text: [])
    response = client.get(SEARCH, params={"game": text}, headers=auth_headers)
    assert response.status_code == 422


def test_search_too_long_returns_422(client, auth_headers):
    response = client.get(SEARCH, params={"game": "x" * 101}, headers=auth_headers)
    assert response.status_code == 422


def test_search_igdb_failure_returns_502(client, auth_headers, monkeypatch):
    def broken(text):
        raise igdb.IGDBError("down")

    monkeypatch.setattr("app.endpoints.games.game_query", broken)
    response = client.get(SEARCH, params={"game": "halo"}, headers=auth_headers)
    assert response.status_code == 502
