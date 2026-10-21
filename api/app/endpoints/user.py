from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import PasswordUpdate, UserOutput, UserUpdate
from app.security import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserOutput)
def user_details(user: User = Depends(get_current_user)):
    """ Returns the current user's details """
    return user

@router.patch("/me", response_model=UserOutput)
def update_user(data: UserUpdate, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """ Updates a users email or name"""
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="email already exists")
    db.refresh(user)
    return user

@router.patch("/me/password", status_code=204)
def change_password(pdata: PasswordUpdate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """ Updates a user's password """
    if not verify_password(pdata.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user.hashed_password = hash_password(pdata.new_password)
    db.commit()

@router.delete("/me", status_code=204)
def delete_user(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """ Deletes a user's account """
    db.delete(user)
    db.commit()
