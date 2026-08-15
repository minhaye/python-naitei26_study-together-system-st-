from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    supabase_url: str
    supabase_publishable_key: str | None = None
    supabase_service_role_key: str | None = None
    attachment_download_url_expires_in: int = 300
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    livekit_token_ttl_seconds: int = 600

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


settings = Settings()
