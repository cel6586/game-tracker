import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOutput
from app.security import check_signup_code, create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

@router.post("/register", response_model=UserOutput, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """ Registers a new user """
    if not check_signup_code(data.signup_code):
        logger.warning("Bad signup code used for %s", data.email)
        raise HTTPException(status_code=403, detail="Invalid sign up code")
    user = User(email=data.email,
                hashed_password=hash_password(data.password),
                name=data.name)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User already exists")
    db.refresh(user)
    return user

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    """ Logs a user in """
    user = db.scalars(select(User).where(User.email == form_data.username)).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        logger.warning("Failed login for %s", form_data.username)
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return {"access_token": create_token(user.id), "token_type": "bearer"}
