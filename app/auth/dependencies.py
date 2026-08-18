import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.dto.auth_dto import CurrentUser
from app.auth.services.auth_service import supabase_auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def _current_user_from_credentials(credentials: HTTPAuthorizationCredentials) -> CurrentUser:
    claims = supabase_auth_service.verify(credentials.credentials)

    try:
        user_id = uuid.UUID(str(claims["sub"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return CurrentUser(id=user_id, email=claims.get("email"), role=claims.get("role"))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _current_user_from_credentials(credentials)


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser | None:
    """Like `get_current_user`, but returns None instead of 401 when no bearer token is
    supplied. For endpoints that must stay open for anonymous/public discovery but still
    need to recognize an authenticated caller to gate private-resource data."""
    if credentials is None:
        return None
    return _current_user_from_credentials(credentials)
