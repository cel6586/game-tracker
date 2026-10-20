from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """  Settings for database and security """
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 40
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
