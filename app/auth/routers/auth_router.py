from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me", response_model=CurrentUser)
async def get_me(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return current_user
