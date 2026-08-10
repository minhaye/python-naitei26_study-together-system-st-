import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.dto.auth_dto import CurrentUser
from app.auth.services.auth_service import supabase_auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
