""" Models for database tables """

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Model


class User(Model):
    """ Model for our users table """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(150), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),
                                                 server_default=func.now())


class Game(Model):
    """ Model for our video games table. Video games will be assigned to a user
     From the User table """
    __tablename__ = "games"
    # a user can add the same title once per platform
    __table_args__ = (
        UniqueConstraint("user_id", "title", "platform",
                         name="uq_games_user_title_platform"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # cascade so deleting a user also deletes their games
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    platform: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), server_default="wishlist")
    release_date: Mapped[date | None]
    developer: Mapped[str | None]
    rating: Mapped[float | None]
    notes: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(500))
    favorite: Mapped[bool] = mapped_column(Boolean, server_default=false())
    # cover_url and igdb_id only get filled when a game is picked from the IGDB search
    cover_url: Mapped[str | None] = mapped_column(String(500))
    igdb_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
