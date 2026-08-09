import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.resources.dto.resource_dto import (
    ResourceCreate,
    ResourceFolderCreate,
    ResourceFolderResponse,
    ResourceFolderUpdate,
    ResourceResponse,
    ResourceUpdate,
)
from app.resources.services.resource_service import ResourcesService

router = APIRouter(prefix="/resources", tags=["Resources"])
service = ResourcesService()


# --- Folders ---


@router.post("/folders", response_model=ResourceFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(data: ResourceFolderCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        folder = await service.create_folder(session, data)
        await session.commit()
        return folder
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create resource folder: {str(e)}"
        )


@router.get("/folders/{folder_id}", response_model=ResourceFolderResponse)
async def get_folder(folder_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    return folder


@router.get("/folders", response_model=list[ResourceFolderResponse])
async def list_folders(group_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    return await service.list_folders_by_group(session, group_id)


@router.get("/folders/{folder_id}/subfolders", response_model=list[ResourceFolderResponse])
async def list_subfolders(folder_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    # Ensure folder exists
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
    return await service.list_subfolders(session, folder_id)


@router.put("/folders/{folder_id}", response_model=ResourceFolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    data: ResourceFolderUpdate,
    session: AsyncSession = Depends(get_db_session)
):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
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
async def delete_folder(folder_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    folder = await service.get_folder_by_id(session, folder_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )
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
async def create_file(data: ResourceCreate, session: AsyncSession = Depends(get_db_session)):
    try:
        resource = await service.create_file(session, data)
        await session.commit()
        return resource
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create resource file: {str(e)}"
        )


@router.get("/files/{file_id}", response_model=ResourceResponse)
async def get_file(file_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource file not found"
        )
    return resource


@router.get("/files", response_model=list[ResourceResponse])
async def list_files(
    group_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db_session)
):
    if group_id:
        return await service.list_files_by_group(session, group_id)
    elif folder_id:
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
    session: AsyncSession = Depends(get_db_session)
):
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource file not found"
        )
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
async def delete_file(file_id: uuid.UUID, session: AsyncSession = Depends(get_db_session)):
    resource = await service.get_file_by_id(session, file_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource file not found"
        )
    try:
        await service.delete_file(session, resource)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not delete resource file: {str(e)}"
        )
