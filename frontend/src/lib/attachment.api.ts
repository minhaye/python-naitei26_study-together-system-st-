import { apiClient } from './apiClient';
import type { DownloadUrlResponse, UploadUrlRequest, UploadUrlResponse } from './attachment.types';

/** Step 1 of upload: get a signed Storage upload URL for the `message-attachments` bucket,
 * scoped to this conversation + the caller (backend derives the object path from
 * conversation type -- channel/room/direct -- and validates it again on message create; see
 * attachment_router.create_upload_url). Mirrors resource.api.ts's createResourceUploadUrl. */
export function createMessageAttachmentUploadUrl(
  conversationId: string,
  data: UploadUrlRequest
): Promise<UploadUrlResponse> {
  return apiClient.post<UploadUrlResponse>(`/conversations/${conversationId}/attachments/upload-url`, data);
}

/** Step 2: PUT the raw file bytes directly to Supabase Storage using the signed URL from
 * createMessageAttachmentUploadUrl -- FastAPI never proxies the file body itself. */
export async function uploadMessageAttachmentFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

/** Fetches a short-lived signed view URL for a message's attachment. Authorization is the
 * same `can_access_conversation` check as every other message endpoint (see
 * attachment_router.get_attachment_url) -- a user who cannot access the message cannot get a
 * URL for its image either, regardless of the storage path. */
export function getMessageAttachmentUrl(messageId: string): Promise<DownloadUrlResponse> {
  return apiClient.get<DownloadUrlResponse>(`/messages/${messageId}/attachment-url`);
}
