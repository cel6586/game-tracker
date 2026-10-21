# Game Tracker

A small web app to track the games I want to play and the ones I've finished. Each user gets their own list.

Stack: nginx + plain HTML/JS frontend, FastAPI backend, Postgres. Everything runs in Docker Compose.

## Run it

You need Docker and Python 3.13.

1. Clone the repo and go into it

```
git clone <repo url>
cd game-tracker
```

2. Make a `.env` file in the repo root

```
POSTGRES_PASSWORD=pick-a-password
SECRET_KEY=any-long-random-string
```

Keep the password to letters and numbers only.

3. Start the database

```
docker compose up -d db
```

4. Create the tables (one time)

```
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Open `api/.env` and put your password in `DATABASE_URL`, then:

```
alembic upgrade head
cd ..
```

On Mac/Linux use `source .venv/bin/activate` and `cp` instead.

5. Start everything

```
docker compose up -d --build
```

Go to http://localhost:8080 and make an account.

## Stop it

```
docker compose down
```

Add `-v` to also delete the database.

## Tests

```
cd api
pip install -r requirements-dev.txt
pytest
```
