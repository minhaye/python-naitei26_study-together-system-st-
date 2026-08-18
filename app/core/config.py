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
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"

    # Invitations
    invitation_code_ttl_seconds: int = 300
    # Email invitations get a much longer TTL than codes -- a code is meant to be shared and
    # redeemed within a short live window, an emailed link is checked whenever the recipient
    # next opens their inbox. 7 days, configurable separately from the code TTL.
    invitation_email_ttl_seconds: int = 60 * 60 * 24 * 7
    frontend_base_url: str = "http://localhost:5173"

    # Email (optional -- ConsoleEmailService is used when smtp_host is unset, see
    # app/core/email_service.py). Never a silently-fake production provider: if these are
    # unset, sent invitation emails are logged, not delivered.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    email_from_address: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


settings = Settings()
