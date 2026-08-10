from typing import Any

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientError

from app.core.config import settings

SUPABASE_AUDIENCE = "authenticated"
_UNAUTHORIZED_HEADERS = {"WWW-Authenticate": "Bearer"}


class SupabaseAuthService:
    """Verifies Supabase-issued access tokens. Never stores or checks passwords locally."""

    def __init__(self) -> None:
        self._jwk_client = PyJWKClient(settings.supabase_jwks_url, cache_keys=True, lifespan=3600)

    def verify(self, token: str) -> dict[str, Any]:
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(token)
        except PyJWKClientError:
            # Legacy HS256 projects publish no JWKS keys for their shared secret.
            # Verify against Supabase's own Auth server instead of hardcoding that secret here.
            return self._verify_remote(token)
        except InvalidTokenError as exc:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Malformed token", headers=_UNAUTHORIZED_HEADERS
            ) from exc

        try:
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=SUPABASE_AUDIENCE,
                issuer=settings.supabase_issuer,
            )
        except InvalidTokenError as exc:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}", headers=_UNAUTHORIZED_HEADERS
            ) from exc

    def _verify_remote(self, token: str) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {token}"}
        if settings.supabase_publishable_key:
            headers["apikey"] = settings.supabase_publishable_key

        try:
            response = httpx.get(f"{settings.supabase_url}/auth/v1/user", headers=headers, timeout=5.0)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Could not verify token", headers=_UNAUTHORIZED_HEADERS
            ) from exc

        if response.status_code != 200:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Invalid or expired token", headers=_UNAUTHORIZED_HEADERS
            )

        data = response.json()
        return {"sub": data["id"], "email": data.get("email"), "role": data.get("role")}


supabase_auth_service = SupabaseAuthService()
