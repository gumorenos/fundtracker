from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    admin_username: str = "admin"
    admin_password: str
    viewer_username: str = "viewer"
    viewer_password: str
    initial_balance_usd: float = 30000.0
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
