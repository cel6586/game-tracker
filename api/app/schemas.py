from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class GameCreate(BaseModel):
    """ Schema for creating a new game """
    title: str = Field(min_length=1)
    platform: str = Field(min_length=1)
    status: str = Field(default="wishlist", description="The users status on the game" )
    release_date: date | None = None
    developer: str | None = Field(default=None, description="The developer of the game")
    rating: float | None = Field(default=None, ge=0, le=10,
                                 description="The users rating of the game")
    link: str | None = Field(default=None, description="Link to games storefront")
    notes: str | None = Field(default=None, description="Users notes of the game")


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


class GameList(BaseModel):
    """ Returned output after listing a users games """
    games: list[GameOutput]

class GameUpdate(BaseModel):
    """ Schema for updating an existing game """
    title: str | None = Field(default=None, min_length=1)
    platform: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, min_length=1)
    release_date: date | None = None
    developer: str | None = None
    rating: float | None = Field(default=None, ge=0, le=10)
    link: str | None = None
    notes: str | None = None

    @field_validator("title", "platform", "status")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Cannot be null")
        return value


class UserCreate(BaseModel):
    """ Schema for creating a new user """
    email: EmailStr
    password: str
    name: str | None = None


class UserOutput(BaseModel):
    """ Returned output after creating a new user """
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str | None



