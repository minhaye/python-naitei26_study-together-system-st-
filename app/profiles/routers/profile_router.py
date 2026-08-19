import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.profiles.dto.profile_dto import AvatarUploadUrlRequest, AvatarUploadUrlResponse, ProfileCreate, ProfileResponse, ProfileUpdate
from app.profiles.services.profile_service import ProfilesService
from app.profiles.services.avatar_storage_service import AvatarStorageError, AvatarStorageNotConfigured, AvatarStorageService, PROFILE_AVATARS_BUCKET

router = APIRouter(prefix="/profiles", tags=["Profiles"])
service = ProfilesService()
avatar_storage_service = AvatarStorageService()


@router.post("/me/avatar/upload-url", response_model=AvatarUploadUrlResponse)
async def create_avatar_upload_url(
    data: AvatarUploadUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        result = await avatar_storage_service.create_signed_upload_url(
            avatar_storage_service.build_object_path(current_user.id)
        )
    except AvatarStorageNotConfigured as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Avatar storage is not configured") from exc
    except AvatarStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return AvatarUploadUrlResponse(**result)


@router.post("/me/avatar", response_model=ProfileResponse)
async def confirm_avatar_upload(
    data: AvatarUploadUrlResponse,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    prefix = f"users/{current_user.id}/"
    if not data.path.startswith(prefix) or not data.path.endswith(".avatar"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid avatar reference")
    profile = await service.get_by_id(session, current_user.id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    try:
        if not await avatar_storage_service.object_exists(data.path):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Avatar was not found, upload it first")
        old_url = profile.avatar_url
        profile.avatar_url = avatar_storage_service.public_url(data.path)
        await session.commit()
        if old_url and f"/{PROFILE_AVATARS_BUCKET}/users/{current_user.id}/" in old_url:
            try:
                await avatar_storage_service.delete_object(old_url.split(f"/{PROFILE_AVATARS_BUCKET}/", 1)[1])
            except AvatarStorageError:
                pass
        return profile
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not save avatar") from exc


@router.post("/", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: ProfileCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    if data.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create your own profile",
        )
    try:
        profile = await service.create(session, data)
        await session.commit()
        return profile
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create profile: {str(e)}",
        )


@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)
):
    profile = await service.get_by_id(session, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )
    return profile


@router.get("/", response_model=list[ProfileResponse])
async def list_profiles(
    skip: int = 0, limit: int = 50, session: AsyncSession = Depends(get_db_session)
):
    return await service.list_all(session, skip=skip, limit=limit)


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: uuid.UUID,
    data: ProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    if profile_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile",
        )
    profile = await service.get_by_id(session, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )
    try:
        updated = await service.update(session, profile, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update profile: {str(e)}",
        )


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    if profile_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own profile",
        )
    profile = await service.get_by_id(session, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )
    try:
        await service.delete(session, profile)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete profile: {str(e)}",
        )
