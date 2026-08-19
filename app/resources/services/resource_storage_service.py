import uuid
from urllib.parse import parse_qs, urlparse

import httpx

from app.attachments.utils import sanitize_filename
from app.core.config import settings
from app.resources.constants import GROUP_RESOURCES_BUCKET


class ResourceStorageError(Exception):
    """Raised when the Supabase Storage REST API is unreachable or returns an error."""


class ResourceStorageNotConfigured(Exception):
    """Raised when neither SUPABASE_SECRET_KEY nor the legacy SUPABASE_SERVICE_ROLE_KEY is
    configured -- see Settings.supabase_server_key."""


class ResourceStorageService:
    """Signed-URL storage access for the `group-resources` bucket, mirroring
    app/attachments/services/attachment_service.py -- FastAPI (via
    Settings.supabase_storage_headers) stays the only party that talks to Supabase Storage
    directly; the frontend only ever sees short-lived signed URLs."""

    def __init__(self) -> None:
        self._storage_url = f"{settings.supabase_url.rstrip('/')}/storage/v1"
        self._bucket = GROUP_RESOURCES_BUCKET

    def _headers(self) -> dict[str, str]:
        headers = settings.supabase_storage_headers
        if not headers:
            raise ResourceStorageNotConfigured(
                "No Supabase server-side key configured -- set SUPABASE_SECRET_KEY "
                "(or the legacy SUPABASE_SERVICE_ROLE_KEY)"
            )
        return headers

    def build_object_path(self, group_id: uuid.UUID, user_id: uuid.UUID, file_name: str) -> str:
        safe_name = sanitize_filename(file_name)
        object_id = uuid.uuid4()
        return f"groups/{group_id}/{user_id}/{object_id}/{safe_name}"

    def validate_ownership(self, file_path: str, group_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Structural check that a client-supplied file_path was actually issued to this user
        under this group's namespace (path format from `build_object_path`). No network call."""
        expected_prefix = f"groups/{group_id}/{user_id}/"
        if not file_path.startswith(expected_prefix):
            return False
        remainder = file_path[len(expected_prefix):]
        parts = remainder.split("/")
        if len(parts) != 2:
            return False
        object_id, file_name = parts
        try:
            uuid.UUID(object_id)
        except ValueError:
            return False
        return bool(file_name) and file_name == sanitize_filename(file_name)

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
                raise ResourceStorageError(f"Could not create signed upload URL: {exc}") from exc

        relative_url = response.json()["url"]
        token = parse_qs(urlparse(relative_url).query).get("token", [None])[0]
        return {
            "path": path,
            "token": token or "",
            "upload_url": f"{self._storage_url}{relative_url}",
        }

    async def create_signed_download_url(
        self, path: str, expires_in: int, download_filename: str | None = None
    ) -> dict[str, object]:
        """`download_filename` set -> Supabase appends `?download=<filename>` to the signed
        URL, which makes Storage respond with `Content-Disposition: attachment;
        filename="<filename>"` -- forcing a real file download (with the original name
        preserved) instead of the browser's normal inline-preview behavior for that content
        type. Omitted (the default, used by Open/Preview) -> the plain signed URL, previewable
        inline for images/PDF/txt. Same signed-URL mechanism either way, just a query-string
        difference -- see Supabase Storage's `createSignedUrl` `download` option."""
        body: dict[str, object] = {"expiresIn": expires_in}
        if download_filename:
            body["download"] = download_filename

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    f"{self._storage_url}/object/sign/{self._bucket}/{path}",
                    headers=self._headers(),
                    json=body,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise ResourceStorageError(f"Could not create signed download URL: {exc}") from exc

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
                raise ResourceStorageError(f"Could not verify resource upload: {exc}") from exc

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
                raise ResourceStorageError(f"Could not delete resource object: {exc}") from exc
