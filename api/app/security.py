from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
password_hash = PasswordHash.recommended()

def hash_password(paswd: str) -> str:
    """ Will hash a string password"""
    return password_hash.hash(paswd)

def verify_password(paswd: str, hashed: str) -> bool:
    """ Verifies if the password matches the hashed password """
    return password_hash.verify(paswd, hashed)

def create_token(user_id: int) -> str:
    """ Creates a JWT token for a logged in user"""
    expires = (datetime.now(UTC) +
               timedelta(minutes=settings.access_token_expire_minutes))
    payload = {"sub": str(user_id), "exp": expires}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

def decode_token(token: str) -> int:
    """ Decodes a JWT token """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return int(payload["sub"])

def get_current_user(token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)):
    """ Returns the current user if logged in """
    try:
        user_id = decode_token(token)
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.scalars(select(User).where(User.id == user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user