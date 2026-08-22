from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    supabase_url: str
    supabase_publishable_key: str | None = None
    # Current Supabase server-side elevated key (sb_secret_...). Preferred over the legacy
    # service_role JWT below -- see supabase_server_key.
    supabase_secret_key: str | None = None
    # Legacy elevated key, kept only as a fallback for setups that haven't migrated to
    # SUPABASE_SECRET_KEY yet. Not required when supabase_secret_key is set.
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

    # AI roadmap suggestions (optional -- the /roadmaps/suggest endpoint returns 503 when
    # unconfigured). ai_provider picks which service RoadmapAiService calls; only that
    # provider's key needs to be set. See app/roadmaps/services/roadmap_ai_service.py.
    ai_provider: str = "anthropic"  # "anthropic" or "gemini"
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def supabase_server_key(self) -> str | None:
        """The elevated server-side Supabase credential, whichever is configured. Prefers the
        current Secret Key (sb_secret_...) over the legacy service_role JWT so new setups
        never need the deprecated key. Prefer `supabase_storage_headers` for actually calling
        Supabase's Storage REST API -- the two key formats need different header shapes (see
        its docstring), so this raw string is mostly useful for "is anything configured"
        checks."""
        return self.supabase_secret_key or self.supabase_service_role_key

    @property
    def supabase_storage_headers(self) -> dict[str, str] | None:
        """Headers for elevated Supabase Storage REST calls (signed upload/download URLs) --
        shared by Attachment Storage and Resource Storage, see
        app/attachments/services/attachment_service.py and
        app/resources/services/resource_storage_service.py. The two supported credential
        formats are NOT interchangeable header-wise:
        - Current Secret Key (sb_secret_...): an opaque key validated by Supabase's API
          gateway itself, not a JWT. Only `apikey` is correct; sending it as
          `Authorization: Bearer sb_secret_...` is not the intended usage.
        - Legacy service_role key: a JWT whose `role` claim grants elevated/RLS-bypassing
          access, resolved by Storage from the `Authorization: Bearer <jwt>` header -- both
          `apikey` and `Authorization` are required here, same as before.
        Returns None if neither key is configured."""
        if self.supabase_secret_key:
            return {"apikey": self.supabase_secret_key}
        if self.supabase_service_role_key:
            return {
                "apikey": self.supabase_service_role_key,
                "Authorization": f"Bearer {self.supabase_service_role_key}",
            }
        return None

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def supabase_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"


settings = Settings()
