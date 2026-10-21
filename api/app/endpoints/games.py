from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Game, User
from app.schemas import GameCreate, GameList, GameOutput, GameSummary, GameUpdate
from app.security import get_current_user

router = APIRouter(prefix="/games", tags=["games"])


def get_user_game(game_id: int, user: User, db: Session):
    """  Helper that returns a game specific to a user"""
    return db.scalars(
        select(Game).where(Game.id == game_id, Game.user_id == user.id)).first()

def not_found():
    """ Game not found exception """
    return HTTPException(status_code=404, detail="Game not found")

@router.get("/", response_model=GameList)
def list_games(search: str | None = None, platform: str | None = None,
               status: str | None = None, released: bool | None = None,
               favorite: bool | None = None,
               sort: Literal["title", "released"] = "title",
               user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """ Returns a list of all games that belong to the current user. """
    query = select(Game).where(Game.user_id == user.id)
    if search:
        query = query.where(Game.title.ilike(f"%{search}%"))
    if platform:
        query = query.where(Game.platform == platform)
    if status:
        query = query.where(Game.status == status)
    if released:
        query = query.where(Game.release_date <= date.today())
    if favorite:
        query = query.where(Game.favorite == favorite)

    if sort == "released":
        query =query.order_by(Game.release_date.asc().nulls_last(), Game.title, Game.id)
    else:
        query = query.order_by(Game.title, Game.id)

    games = db.scalars(query).all()
    return {"games": games}

@router.post("/", response_model=GameOutput, status_code=201)
def create_game(data: GameCreate, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """ Creates a new game to add to the current users list """
    game = Game(**data.model_dump(), user_id=user.id)
    db.add(game)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="You already added this game for this system")
    db.refresh(game)
    return game

@router.get("/summary", response_model=GameSummary)
def game_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """ Returns statistics about the current user's games """
    game_count = db.scalar(select(func.count()).select_from(
        Game).where(Game.user_id == user.id))
    platform_count = db.execute(select(Game.platform, func.count()).where(
        Game.user_id == user.id).group_by(Game.platform)).all()
    status_count = db.execute(select(Game.status, func.count()).where(
        Game.user_id == user.id).group_by(Game.status)).all()
    platform_dict = {platform: count for platform, count in platform_count}
    status_dict = {status: count for status, count in status_count}
    return {"total": game_count, "by_platform": platform_dict, "by_status": status_dict}

@router.get("/{game_id}", response_model=GameOutput)
def game_details(game_id: int, user:User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """ Returns a games details """
    game = get_user_game(game_id, user, db)
    if not game:
        raise not_found()
    return game

@router.delete("/{game_id}", status_code=204)
def delete_game(game_id: int, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """ Deletes a game entry for a specific user """
    game = get_user_game(game_id, user, db)
    if not game:
        raise not_found()
    db.delete(game)
    db.commit()

@router.patch("/{game_id}", response_model=GameOutput)
def update_game(game_id: int, data: GameUpdate, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """ Updates a game entry for a specific user """
    game = get_user_game(game_id, user, db)
    if not game:
        raise not_found()
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(game, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="You already added this game for this system")
    db.refresh(game)
    return game




