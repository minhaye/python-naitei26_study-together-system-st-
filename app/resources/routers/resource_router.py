import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.core.permissions import is_active_group_member, is_group_manager
from app.db.session import get_db_session
from app.resources.dto.resource_dto import (
    ResourceCreate,
    ResourceDownloadUrlResponse,
    ResourceFolderCreate,
    ResourceFolderResponse,
    ResourceFolderUpdate,
    ResourceResponse,
    ResourceUpdate,
    ResourceUploadUrlRequest,
    ResourceUploadUrlResponse,
)
from app.resources.services.resource_service import ResourcesService
from app.resources.services.resource_storage_service import (
    ResourceStorageError,
    ResourceStorageNotConfigured,
    ResourceStorageService,
)
from app.core.config import settings

router = APIRouter(prefix="/resources", tags=["Resources"])
service = ResourcesService()
storage_service = ResourceStorageService()


async def _require_group_member(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
    if not await is_active_group_member(session, group_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this group")


# --- Upload / download URLs ---


@router.post("/upload-url", response_model=ResourceUploadUrlResponse)
async def create_upload_url(
    group_id: uuid.UUID,
    data: ResourceUploadUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    await _require_group_member(session, group_id, current_user.id)
    path = storage_service.build_object_path(group_id, current_user.id, data.file_name)
    try:
        result = await storage_service.create_signed_upload_url(path)
    except ResourceStorageNotConfigured as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Resource storage is not configured") from exc
    except ResourceStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return ResourceUploadUrlResponse(**result)


@router.get("/files/{file_id}/download-url", response_model=ResourceDownloadUrlResponse)
async def get_download_url(
    file_id: uuid.UUID,
    download: bool = False,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """`download=false` (default): Open/Preview -- a plain signed URL, previewable inline in
    the browser for images/PDF/txt (unchanged behavior). `download=true`: Download -- the
    signed URL is built with the resource's original `name` as the Storage `download` option,
    so Supabase serves it with `Content-Disposition: attachment`, forcing a real file download
    with the original filename preserved, for every resource type. Same signed-URL mechanism
    both ways -- see ResourceStorageService.create_signed_download_url."""
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource file not found")
    await _require_group_member(session, resource.group_id, current_user.id)

    try:
        result = await storage_service.create_signed_download_url(
            resource.file_path,
            expires_in=settings.attachment_download_url_expires_in,
            download_filename=resource.name if download else None,
        )
    except ResourceStorageNotConfigured as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Resource storage is not configured") from exc
    except ResourceStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return ResourceDownloadUrlResponse(**result)


# --- Folders ---


@router.post("/folders", response_model=ResourceFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    data: ResourceFolderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    await _require_group_member(session, data.group_id, current_user.id)
    try:
        folder = await service.create_folder(session, data, created_by=current_user.id)
        await session.commit()
        return folder
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create resource folder: {str(e)}"
        )


@router.get("/folders/{folder_id}", response_model=ResourceFolderResponse)
async def get_folder(
    folder_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    await _require_group_member(session, folder.group_id, current_user.id)
    return folder


@router.get("/folders", response_model=list[ResourceFolderResponse])
async def list_folders(
    group_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    await _require_group_member(session, group_id, current_user.id)
    return await service.list_folders_by_group(session, group_id)


@router.get("/folders/{folder_id}/subfolders", response_model=list[ResourceFolderResponse])
async def list_subfolders(
    folder_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    await _require_group_member(session, folder.group_id, current_user.id)
    return await service.list_subfolders(session, folder_id)


@router.put("/folders/{folder_id}", response_model=ResourceFolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    data: ResourceFolderUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    if folder.created_by != current_user.id and not await is_group_manager(session, folder.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to update this folder")
    try:
        updated = await service.update_folder(session, folder, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update folder: {str(e)}"
        )


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    if folder.created_by != current_user.id and not await is_group_manager(session, folder.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this folder")
    try:
        await service.delete_folder(session, folder)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete folder: {str(e)}"
        )


# --- Files (Resources) ---


@router.post("/files", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_file(
    data: ResourceCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    await _require_group_member(session, data.group_id, current_user.id)

    if not storage_service.validate_ownership(data.file_path, data.group_id, current_user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid resource file reference")
    try:
        exists = await storage_service.object_exists(data.file_path)
    except ResourceStorageNotConfigured as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Resource storage is not configured") from exc
    except ResourceStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    if not exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File was not found, upload it first")

    try:
        resource = await service.create_file(session, data, uploader_id=current_user.id)
        await session.commit()
        return resource
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create resource file: {str(e)}"
        )


@router.get("/files/{file_id}", response_model=ResourceResponse)
async def get_file(
    file_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource file not found"
        )
    await _require_group_member(session, resource.group_id, current_user.id)
    return resource


@router.get("/files", response_model=list[ResourceResponse])
async def list_files(
    group_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    if group_id:
        await _require_group_member(session, group_id, current_user.id)
        return await service.list_files_by_group(session, group_id)
    elif folder_id:
        folder = await service.get_folder_by_id(session, folder_id)
        if not folder:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Folder not found")
        await _require_group_member(session, folder.group_id, current_user.id)
        return await service.list_files_by_folder(session, folder_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either group_id or folder_id query parameter is required"
        )


@router.put("/files/{file_id}", response_model=ResourceResponse)
async def update_file(
    file_id: uuid.UUID,
    data: ResourceUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource file not found"
        )
    if resource.uploader_id != current_user.id and not await is_group_manager(
        session, resource.group_id, current_user.id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to update this file")
    try:
        updated = await service.update_file(session, resource, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update resource file: {str(e)}"
        )


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource file not found"
        )
    if resource.uploader_id != current_user.id and not await is_group_manager(
        session, resource.group_id, current_user.id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to delete this file")
    try:
        await service.delete_file(session, resource)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete resource file: {str(e)}"
        )

    try:
        await storage_service.delete_object(resource.file_path)
    except (ResourceStorageNotConfigured, ResourceStorageError):
        # The DB row is already gone; a leftover storage object is not user-facing and can be
        # cleaned up separately (same tradeoff as attachments -- see AttachmentsService).
        pass
