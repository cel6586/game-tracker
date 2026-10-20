from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

engine = create_engine(settings.database_url, pool_pre_ping=True)

session_factory = sessionmaker(bind=engine)

class Model(DeclarativeBase):
    """ root for all models """
    metadata = MetaData(naming_convention=convention)

def get_db():
    """ Retrieves database session """
    db = session_factory()
    try:
        yield db
    finally:
        db.close()