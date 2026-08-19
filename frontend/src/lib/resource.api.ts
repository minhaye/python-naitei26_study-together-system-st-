import { apiClient } from './apiClient';
import type {
  Resource,
  ResourceCreate,
  ResourceDownloadUrlResponse,
  ResourceUploadUrlRequest,
  ResourceUploadUrlResponse,
} from './resource.types';

export function listGroupResources(groupId: string): Promise<Resource[]> {
  const params = new URLSearchParams({ group_id: groupId });
  return apiClient.get<Resource[]>(`/resources/files?${params.toString()}`);
}

/** Step 1 of upload: get a signed Storage upload URL scoped to this group + the caller
 * (backend validates the resulting file_path against group_id/uploader on create). */
export function createResourceUploadUrl(
  groupId: string,
  data: ResourceUploadUrlRequest
): Promise<ResourceUploadUrlResponse> {
  const params = new URLSearchParams({ group_id: groupId });
  return apiClient.post<ResourceUploadUrlResponse>(`/resources/upload-url?${params.toString()}`, data);
}

/** Step 2: PUT the raw file bytes directly to Supabase Storage using the signed URL from
 * createResourceUploadUrl -- FastAPI never proxies the file body itself. */
export async function uploadResourceFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

/** Step 3: register the uploaded object as a Resource row. */
export function createResourceFile(data: ResourceCreate): Promise<Resource> {
  return apiClient.post<Resource>('/resources/files', data);
}

/** `download=false` (default, Open/Preview): plain signed URL, previewable inline in the
 * browser. `download=true` (explicit Download action): the backend builds the signed URL with
 * `Content-Disposition: attachment` and the original filename, forcing a real file download
 * for every resource type -- see resource_router.get_download_url. */
export function getResourceDownloadUrl(fileId: string, download = false): Promise<ResourceDownloadUrlResponse> {
  const params = download ? `?${new URLSearchParams({ download: 'true' }).toString()}` : '';
  return apiClient.get<ResourceDownloadUrlResponse>(`/resources/files/${fileId}/download-url${params}`);
}

export function deleteResourceFile(fileId: string): Promise<void> {
  return apiClient.delete<void>(`/resources/files/${fileId}`);
}
