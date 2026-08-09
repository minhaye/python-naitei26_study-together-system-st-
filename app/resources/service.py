import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.resources.entities.resource import Resource, ResourceFolder
from app.resources.dto.resource import (
    ResourceCreate,
    ResourceFolderCreate,
    ResourceFolderUpdate,
    ResourceUpdate,
)


class ResourcesService:
    # --- Folders ---

    async def create_folder(self, session: AsyncSession, data: ResourceFolderCreate) -> ResourceFolder:
        folder = ResourceFolder(**data.model_dump())
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

    async def create_file(self, session: AsyncSession, data: ResourceCreate) -> Resource:
        resource = Resource(**data.model_dump())
        session.add(resource)
        await session.flush()
        return resource

    async def get_file_by_id(self, session: AsyncSession, resource_id: uuid.UUID) -> Resource | None:
        return await session.get(Resource, resource_id)

    async def list_files_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[Resource]:
        result = await session.execute(select(Resource).where(Resource.group_id == group_id))
        return list(result.scalars().all())

    async def list_files_by_folder(self, session: AsyncSession, folder_id: uuid.UUID) -> list[Resource]:
        result = await session.execute(select(Resource).where(Resource.folder_id == folder_id))
        return list(result.scalars().all())

    async def update_file(self, session: AsyncSession, resource: Resource, data: ResourceUpdate) -> Resource:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(resource, field, value)
        await session.flush()
        return resource

    async def delete_file(self, session: AsyncSession, resource: Resource) -> None:
        await session.delete(resource)
        await session.flush()
