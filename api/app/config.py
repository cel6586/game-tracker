""" Holds settings, secrets, keys, urls """

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """  Settings for database and security """
    database_url: str
    secret_key: str
    signup_code: str | None = None
    # only needed for the game search, without them search returns a 502
    igdb_client_id: str | None = None
    igdb_client_secret: str | None = None
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 40
    # .env is for running locally, in the cluster these come from the secret
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
