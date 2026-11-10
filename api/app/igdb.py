""" Query IGDB fo game data from keyword search from user.  Returns a list of games
    and all the data that is used in gametracker """
import time
from datetime import UTC, datetime

import requests

from app.config import settings

igdb_url = "https://api.igdb.com/v4/games"
igdb_auth_url = "https://id.twitch.tv/oauth2/token"
# token lives in memory only, if the api restarts we just grab a new one
_token = {"value": None, "expires_at": 0.0}
_limit = 100
# IGDB platform id -> our platform names, ids came from the /platforms endpoint
# anything not in here gets dropped (both switches are lumped into Switch 2)
PLATFORM_MAP = {
    167: "PS5",             # PlayStation 5
    169: "Xbox",            # Xbox Series X|S
    130: "Switch 2",        # Nintendo Switch
    508: "Switch 2",        # Nintendo Switch 2
    6: "PC",                # PC (Microsoft Windows)
    386: "VR",              # Meta Quest 2
    471: "VR",              # Meta Quest 3
    390: "VR",              # PlayStation VR2
}


class IGDBError(Exception):
    """ IGDB could not be reached or gave an unusable answer """


def retrieve_token():
    """ Authenticates with IGDB.  Retrieves token to use in query """
    body = {
        "client_id": settings.igdb_client_id,
        "client_secret": settings.igdb_client_secret,
        "grant_type": "client_credentials",
    }
    try:
        response = requests.post(igdb_auth_url, data=body, timeout=10)
        response.raise_for_status()
    except requests.RequestException as e:
        raise IGDBError("Could not retrieve IGDB token") from e

    data = response.json()
    _token["value"] = data["access_token"]
    _token["expires_at"] = time.time() + data["expires_in"]


def parse_game(game):
    """ Parses IGDB game data for our use """
    parsed_game = {}
    # release date comes back as a unix timestamp, and some games have none
    timestamp = game.get("first_release_date")
    release = datetime.fromtimestamp(timestamp,
                                     tz=UTC).date() if timestamp else None
    # IGDB only gives us an image id, the url has to be built
    image_id = game.get("cover", {}).get("image_id")
    if image_id:
        cover = f"https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"
    else:
        cover = None
    # involved_companies has publishers too, only keep the ones flagged developer
    developers = []
    for company in game.get("involved_companies") or []:
        if company.get("developer"):
            developers.append(company["company"]["name"])
    all_devs = ", ".join(developers) or None
    mapped = []
    for platform in game.get("platforms") or []:
        platform_id = platform["id"]
        if platform_id in PLATFORM_MAP:
            name = PLATFORM_MAP[platform_id]
            if name not in mapped:
                mapped.append(name)
    # web needs at least one value, so Other if none of our platforms matched
    platforms = mapped or ["Other"]

    parsed_game["igdb_id"] = game["id"]
    parsed_game["title"] = game["name"]
    parsed_game["release_date"] = release
    parsed_game["cover_url"] = cover
    parsed_game["platforms"] = platforms
    parsed_game["developer"] = all_devs
    return parsed_game


def sort_games(games, text):
    """ Drops junk entries and puts the best matches first """
    text = text.strip().lower()
    games = [game for game in games if game.get("cover")]

    def sort_key(game):
        title = game["name"].lower()
        if title == text:
            match = 0
        elif title.startswith(text):
            match = 1
        elif text in title:
            match = 2
        else:
            match = 3
        return match

    return sorted(games, key=sort_key)


def game_query(search):
    """ Queries IGDB for game data """
    text = search
    # escape slashes and quotes so the search text cant break out of the query
    search = search.replace("\\", "\\\\").replace('"', '\\"')
    # game_type filter: main game, expansion, standalone expansion, remake,
    # remaster, expanded game and port. leaves out mods, dlc, bundles, seasons etc
    query = (
        f'search "{search}"; where game_type = (0, 2, 4, 8, 9, 10, 11); '
        "fields name,first_release_date,cover.image_id,platforms.name,"
        "involved_companies.company.name,involved_companies.developer;"
        f"limit {_limit};"
    )

    # attempt 2 only happens if IGDB rejected the token (401), so force a new one
    for attempt in (1, 2):
        # refresh 2 min early so it doesnt expire in the middle of a request
        if attempt == 2 or time.time() > _token["expires_at"] - 120:
            retrieve_token()

        headers = {
            "Client-ID": settings.igdb_client_id,
            "Authorization": f"Bearer {_token['value']}",
        }
        try:
            response = requests.post(igdb_url, data=query, headers=headers, timeout=10)
        except requests.RequestException as e:
            raise IGDBError("Could not reach IGDB") from e
        # no raise_for_status above on purpose, it would turn the 401 into an
        # error before we get the chance to retry
        if response.status_code == 401 and attempt == 1:
            continue
        try:
            response.raise_for_status()
        except requests.HTTPError as e:
            raise IGDBError(f"IGDB answered {response.status_code}") from e
        return [parse_game(game) for game in sort_games(response.json(), text)]

