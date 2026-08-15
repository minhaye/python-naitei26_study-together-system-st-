import uuid
from urllib.parse import parse_qs, urlparse

import httpx

from app.attachments.constants import MESSAGE_ATTACHMENTS_BUCKET
from app.attachments.utils import sanitize_filename
from app.core.config import settings


class AttachmentStorageError(Exception):
    """Raised when the Supabase Storage REST API is unreachable or returns an error."""


class AttachmentServiceNotConfigured(Exception):
    """Raised when SUPABASE_SERVICE_ROLE_KEY is missing from the environment."""


class AttachmentsService:
    def __init__(self) -> None:
        self._storage_url = f"{settings.supabase_url.rstrip('/')}/storage/v1"
        self._bucket = MESSAGE_ATTACHMENTS_BUCKET

    def _headers(self) -> dict[str, str]:
        key = settings.supabase_service_role_key
        if not key:
            raise AttachmentServiceNotConfigured("SUPABASE_SERVICE_ROLE_KEY is not configured")
        return {"apikey": key, "Authorization": f"Bearer {key}"}

    def build_object_path(
        self, group_id: uuid.UUID, channel_id: uuid.UUID, user_id: uuid.UUID, file_name: str
    ) -> str:
        safe_name = sanitize_filename(file_name)
        object_id = uuid.uuid4()
        return f"groups/{group_id}/channels/{channel_id}/{user_id}/{object_id}/{safe_name}"

    def build_room_object_path(self, room_id: uuid.UUID, user_id: uuid.UUID, file_name: str) -> str:
        safe_name = sanitize_filename(file_name)
        object_id = uuid.uuid4()
        return f"study-rooms/{room_id}/{user_id}/{object_id}/{safe_name}"

    def build_direct_object_path(self, conversation_id: uuid.UUID, user_id: uuid.UUID, file_name: str) -> str:
        safe_name = sanitize_filename(file_name)
        object_id = uuid.uuid4()
        return f"direct/{conversation_id}/{user_id}/{object_id}/{safe_name}"

    def _validate_prefixed_path(self, attachment_path: str, expected_prefix: str) -> bool:
        """Structural check that a client-supplied attachment_path was actually issued to this
        user under the given namespace (path format from `build_object_path`/
        `build_room_object_path`). No network call."""
        if not attachment_path.startswith(expected_prefix):
            return False
        remainder = attachment_path[len(expected_prefix):]
        parts = remainder.split("/")
        if len(parts) != 2:
            return False
        object_id, file_name = parts
        try:
            uuid.UUID(object_id)
        except ValueError:
            return False
        return bool(file_name) and file_name == sanitize_filename(file_name)

    def validate_ownership(
        self, attachment_path: str, group_id: uuid.UUID, channel_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        return self._validate_prefixed_path(
            attachment_path, f"groups/{group_id}/channels/{channel_id}/{user_id}/"
        )

    def validate_room_ownership(self, attachment_path: str, room_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return self._validate_prefixed_path(attachment_path, f"study-rooms/{room_id}/{user_id}/")

    def validate_direct_ownership(self, attachment_path: str, conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return self._validate_prefixed_path(attachment_path, f"direct/{conversation_id}/{user_id}/")

    async def create_signed_upload_url(self, path: str) -> dict[str, str]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self._storage_url}/object/upload/sign/{self._bucket}/{path}",
                    headers=self._headers(),
                    json={},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AttachmentStorageError(f"Could not create signed upload URL: {exc}") from exc

        relative_url = response.json()["url"]
        token = parse_qs(urlparse(relative_url).query).get("token", [None])[0]
        return {
            "path": path,
            "token": token or "",
            "upload_url": f"{self._storage_url}{relative_url}",
        }

    async def create_signed_download_url(self, path: str, expires_in: int) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self._storage_url}/object/sign/{self._bucket}/{path}",
                    headers=self._headers(),
                    json={"expiresIn": expires_in},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AttachmentStorageError(f"Could not create signed download URL: {exc}") from exc

        signed_url = response.json()["signedURL"]
        return {"url": f"{self._storage_url}{signed_url}", "expires_in": expires_in}

    async def object_exists(self, path: str) -> bool:
        directory, _, file_name = path.rpartition("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self._storage_url}/object/list/{self._bucket}",
                    headers=self._headers(),
                    json={"prefix": directory, "search": file_name, "limit": 1},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AttachmentStorageError(f"Could not verify attachment upload: {exc}") from exc

        items = response.json()
        return any(item.get("name") == file_name for item in items)

    async def delete_object(self, path: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.request(
                    "DELETE",
                    f"{self._storage_url}/object/{self._bucket}",
                    headers=self._headers(),
                    json={"prefixes": [path]},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AttachmentStorageError(f"Could not delete attachment object: {exc}") from exc
