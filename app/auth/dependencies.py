import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dto.auth_dto import CurrentUser
from app.auth.services.auth_service import supabase_auth_service
from app.db.session import get_db_session

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


async def require_forum_moderator(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CurrentUser:
    """Gate for moderator-or-admin-only endpoints. Imports app.core.permissions locally to
    avoid a module-import cycle (permissions.py pulls in several feature services at import
    time; keeping this dependency's import lazy means auth.dependencies stays a leaf module
    everything else -- including permissions.py itself -- can safely import)."""
    from app.core.permissions import is_forum_moderator

    if not await is_forum_moderator(session, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Moderator or Admin role required")
    return current_user


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CurrentUser:
    from app.core.permissions import is_admin

    if not await is_admin(session, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return current_user
