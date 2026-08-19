import uuid

import httpx

from app.core.config import settings

PROFILE_AVATARS_BUCKET = "profile-avatars"


class AvatarStorageError(Exception):
    """Raised when the Supabase Storage REST API cannot complete an avatar operation."""


class AvatarStorageNotConfigured(Exception):
    """Raised when the backend has no server-side Supabase credential."""


class AvatarStorageService:
    def __init__(self) -> None:
        self._storage_url = f"{settings.supabase_url.rstrip('/')}/storage/v1"

    def _headers(self) -> dict[str, str]:
        headers = settings.supabase_storage_headers
        if not headers:
            raise AvatarStorageNotConfigured("Supabase Storage is not configured")
        return headers

    def build_object_path(self, user_id: uuid.UUID) -> str:
        return f"users/{user_id}/{uuid.uuid4()}.avatar"

    def public_url(self, path: str) -> str:
        return f"{self._storage_url}/object/public/{PROFILE_AVATARS_BUCKET}/{path}"

    async def create_signed_upload_url(self, path: str) -> dict[str, str]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(f"{self._storage_url}/object/upload/sign/{PROFILE_AVATARS_BUCKET}/{path}", headers=self._headers(), json={})
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AvatarStorageError("Could not create avatar upload URL") from exc
        return {"path": path, "upload_url": f"{self._storage_url}{response.json()['url']}"}

    async def object_exists(self, path: str) -> bool:
        directory, _, file_name = path.rpartition("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(f"{self._storage_url}/object/list/{PROFILE_AVATARS_BUCKET}", headers=self._headers(), json={"prefix": directory, "search": file_name, "limit": 1})
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AvatarStorageError("Could not verify avatar upload") from exc
        return any(item.get("name") == file_name for item in response.json())

    async def delete_object(self, path: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.request("DELETE", f"{self._storage_url}/object/{PROFILE_AVATARS_BUCKET}", headers=self._headers(), json={"prefixes": [path]})
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AvatarStorageError("Could not remove the previous avatar") from exc
