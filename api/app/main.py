from fastapi import FastAPI

from app.endpoints.auth import router as auth_router
from app.endpoints.games import router as game_router
from app.endpoints.user import router as user_router

app = FastAPI(title="Game Tracker API",
              version="1.0.0")
app.include_router(game_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
