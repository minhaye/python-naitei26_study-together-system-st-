import type { UserSummary } from './profile.types';

/** Mirrors ResourceResponse (app/resources/dto/resource_dto.py). `uploader` is the canonical
 * identity source for the uploader -- see message.types.ts's Message.sender, never derive a
 * label from `uploader_id` alone. */
export interface Resource {
  id: string;
  group_id: string;
  uploader_id: string;
  folder_id: string | null;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  uploader: UserSummary;
}

/** Mirrors ResourceCreate -- no uploader_id: the backend always derives the uploader from the
 * authenticated caller (see resource_router.create_file). `file_path` must be the `path`
 * returned by createResourceUploadUrl, already uploaded to before calling this. */
export interface ResourceCreate {
  group_id: string;
  folder_id?: string | null;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
}

/** Mirrors ResourceUploadUrlRequest/Response. */
export interface ResourceUploadUrlRequest {
  file_name: string;
  content_type: string;
  file_size: number;
}

export interface ResourceUploadUrlResponse {
  path: string;
  upload_url: string;
  token: string;
}

/** Mirrors ResourceDownloadUrlResponse. */
export interface ResourceDownloadUrlResponse {
  url: string;
  expires_in: number;
}
