import { apiClient } from './apiClient';
import type { DownloadUrlResponse, UploadUrlRequest, UploadUrlResponse } from './attachment.types';

/** Step 1 of sharing an image/document on a Study Room whiteboard: a signed Storage upload
 * URL scoped to this room (backend: study_room_router.create_whiteboard_asset_upload_url,
 * host/moderator only -- mirrors createMessageAttachmentUploadUrl but room-scoped rather than
 * conversation-scoped, since a board asset isn't attached to any single chat message). */
export function createWhiteboardAssetUploadUrl(roomId: string, data: UploadUrlRequest): Promise<UploadUrlResponse> {
  return apiClient.post<UploadUrlResponse>(`/study-rooms/${roomId}/whiteboard/assets/upload-url`, data);
}

/** Step 2: PUT the raw file bytes directly to Supabase Storage using the signed URL -- FastAPI
 * never proxies the file body itself. Mirrors uploadMessageAttachmentFile. */
export async function uploadWhiteboardAssetFile(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

/** Resolves a signed view URL for a board asset by its storage path -- any active room
 * participant may call this (viewing isn't editor-only), unlike the upload-url endpoint
 * above. `path` is the value persisted as the tldraw asset's `src` (see
 * whiteboardAssetStore.ts), not a message id -- there's no message backing a board image. */
export function getWhiteboardAssetDownloadUrl(roomId: string, path: string): Promise<DownloadUrlResponse> {
  return apiClient.get<DownloadUrlResponse>(
    `/study-rooms/${roomId}/whiteboard/assets/download-url?path=${encodeURIComponent(path)}`
  );
}
