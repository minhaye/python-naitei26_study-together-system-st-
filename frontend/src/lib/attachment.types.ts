/** Mirrors UploadUrlRequest/Response and DownloadUrlResponse
 * (app/attachments/dto/attachment_dto.py). Used for message (chat) image attachments --
 * see attachment.api.ts. */
export interface UploadUrlRequest {
  file_name: string;
  content_type: string;
  file_size: number;
}

export interface UploadUrlResponse {
  path: string;
  upload_url: string;
  token: string;
}

export interface DownloadUrlResponse {
  url: string;
  expires_in: number;
}
