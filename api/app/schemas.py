from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class GameCreate(BaseModel):
    """ Schema for creating a new game """
    title: str = Field(min_length=1, max_length=200)
    platform: Literal["PS5", "Xbox", "Switch 2", "PC", "VR", "Other"]
    status: Literal["wishlist", "completed", "playing"] = "wishlist"
    release_date: date | None = None
    developer: str | None = Field(default=None, max_length=200,
                                  description="The developer of the game")
    rating: float | None = Field(default=None, ge=0, le=10,
                                 description="The users rating of the game")
    link: str | None = Field(default=None, max_length=500,
                             description="Link to games storefront")
    notes: str | None = Field(default=None, max_length=5000,
                              description="Users notes of the game")
    favorite: bool = Field(default=False, description="Favorited game")

    @field_validator("link")
    @classmethod
    def check_link(cls, value):
        if value is not None and not value.lower().startswith(("http://", "https://")):
            raise ValueError("Link must start with http:// or https://")
        return value


class GameOutput(BaseModel):
    """ the returned output after creating a new game """
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    platform: str
    status: str
    release_date: date | None
    developer: str | None
    rating: float| None
    link: str | None
    notes: str | None
    favorite: bool = False


class GameList(BaseModel):
    """ Returned output after listing a users games """
    games: list[GameOutput]

class GameUpdate(BaseModel):
    """ Schema for updating an existing game """
    title: str | None = Field(default=None, min_length=1, max_length=200)
    platform: Literal["PS5", "Xbox", "Switch 2", "PC", "VR", "Other"] | None = None
    status: Literal["wishlist", "completed", "playing"] | None = None
    release_date: date | None = None
    developer: str | None = Field(default=None, max_length=200)
    rating: float | None = Field(default=None, ge=0, le=10)
    link: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=5000)
    favorite: bool | None = None

    @field_validator("title", "platform", "status", "favorite")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Cannot be null")
        return value

    @field_validator("link")
    @classmethod
    def check_link(cls, value):
        if value is not None and not value.lower().startswith(("http://", "https://")):
            raise ValueError("Link must start with http:// or https://")
        return value


class GameSummary(BaseModel):
    """ Returned Statistics about a user's games """
    total: int
    by_platform: dict[str, int]
    by_status: dict[str, int]


class UserCreate(BaseModel):
    """ Schema for creating a new user """
    email: EmailStr
    signup_code: str = Field(max_length=100)
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=200)


class UserUpdate(BaseModel):
    """ Schema for updating an existing user email and name """
    email: EmailStr | None = None
    name: str | None = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Email cannot be null")
        return value

class PasswordUpdate(BaseModel):
    """ Schema for updating an existing user password """
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserOutput(BaseModel):
    """ Returned output after creating a new user """
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str | None



