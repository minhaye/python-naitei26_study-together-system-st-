import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.groups.entities.group_entity import Group
from app.notifications.services.notification_service import NotificationsService
from app.resources.entities.resource_entity import Resource, ResourceFolder
from app.resources.dto.resource_dto import (
    ResourceCreate,
    ResourceFolderCreate,
    ResourceFolderUpdate,
    ResourceUpdate,
)

notifications_service = NotificationsService()


class ResourcesService:
    # --- Folders ---

    async def create_folder(
        self, session: AsyncSession, data: ResourceFolderCreate, created_by: uuid.UUID
    ) -> ResourceFolder:
        folder = ResourceFolder(**data.model_dump(), created_by=created_by)
        session.add(folder)
        await session.flush()
        return folder

    async def get_folder_by_id(self, session: AsyncSession, folder_id: uuid.UUID) -> ResourceFolder | None:
        return await session.get(ResourceFolder, folder_id)

    async def list_folders_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[ResourceFolder]:
        result = await session.execute(select(ResourceFolder).where(ResourceFolder.group_id == group_id))
        return list(result.scalars().all())

    async def list_subfolders(self, session: AsyncSession, parent_folder_id: uuid.UUID) -> list[ResourceFolder]:
        result = await session.execute(
            select(ResourceFolder).where(ResourceFolder.parent_folder_id == parent_folder_id)
        )
        return list(result.scalars().all())

    async def update_folder(
        self, session: AsyncSession, folder: ResourceFolder, data: ResourceFolderUpdate
    ) -> ResourceFolder:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(folder, field, value)
        await session.flush()
        return folder

    async def delete_folder(self, session: AsyncSession, folder: ResourceFolder) -> None:
        await session.delete(folder)
        await session.flush()

    # --- Files (Resources) ---

    async def create_file(self, session: AsyncSession, data: ResourceCreate, uploader_id: uuid.UUID) -> Resource:
        resource = Resource(**data.model_dump(), uploader_id=uploader_id)
        session.add(resource)
        await session.flush()
        await session.refresh(resource, attribute_names=["uploader"])

        try:
            group = await session.get(Group, resource.group_id)
            uploader_name = (resource.uploader.display_name or resource.uploader.username or "Thành viên") if resource.uploader else "Thành viên"
            group_name = (group.name if group else None) or "Nhóm"
            await notifications_service.notify_new_resource(
                session,
                group_id=resource.group_id,
                group_name=group_name,
                resource_name=resource.name,
                uploader_id=uploader_id,
                uploader_name=uploader_name,
            )
        except Exception:
            pass

        return resource

    async def get_file_by_id(self, session: AsyncSession, resource_id: uuid.UUID) -> Resource | None:
        return await session.get(Resource, resource_id, options=[selectinload(Resource.uploader)])

    async def list_files_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[Resource]:
        result = await session.execute(
            select(Resource).options(selectinload(Resource.uploader)).where(Resource.group_id == group_id)
        )
        return list(result.scalars().all())

    async def list_files_by_folder(self, session: AsyncSession, folder_id: uuid.UUID) -> list[Resource]:
        result = await session.execute(
            select(Resource).options(selectinload(Resource.uploader)).where(Resource.folder_id == folder_id)
        )
        return list(result.scalars().all())

    async def update_file(self, session: AsyncSession, resource: Resource, data: ResourceUpdate) -> Resource:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(resource, field, value)
        await session.flush()
        return resource

    async def delete_file(self, session: AsyncSession, resource: Resource) -> None:
        await session.delete(resource)
        await session.flush()
