import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { createMessageAttachmentUploadUrl, uploadMessageAttachmentFile } from '../lib/attachment.api';

/** Kept in sync with the backend's ALLOWED_ATTACHMENT_CONTENT_TYPES
 * (app/attachments/constants.py) restricted to the image subset this chat composer
 * supports -- the backend bucket/DTO also accepts PDF/txt for other attachment
 * consumers, but chat image attachments are image-only by product scope. */
export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_CONTENT_TYPES.join(',');

/** Mirrors MAX_ATTACHMENT_SIZE_BYTES (app/attachments/constants.py) -- client-side check is
 * purely for fast feedback, the backend re-validates on both the upload-url and message
 * create requests regardless. */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export interface MessageAttachmentUploadError {
  status: number | null;
  message: string;
}

function toUploadError(err: unknown): MessageAttachmentUploadError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message };
  }
  return { status: null, message: 'Không thể tải ảnh lên.' };
}

/** Picks/previews/validates/uploads a single chat image attachment. Shared by Channel chat
 * (StudyGroupDetail.tsx) and Study Room chat (StudyRoom.tsx) composers -- both send through
 * the same generic `/conversations/{id}/messages` + `/conversations/{id}/attachments/upload-url`
 * endpoints, so the picker/preview/upload behavior is identical; only the surrounding
 * composer UI differs per page theme. */
export function useMessageImageAttachment() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<MessageAttachmentUploadError | null>(null);

  // Guards against a second upload firing while one is already in flight (mirrors
  // useGroupResources.ts's uploadInFlight ref), independent of the isUploading render state.
  const uploadInFlight = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const selectImage = useCallback((picked: File) => {
    setUploadError(null);
    if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(picked.type)) {
      setPickError('Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WebP.');
      return;
    }
    if (picked.size > MAX_IMAGE_SIZE_BYTES) {
      setPickError('Ảnh vượt quá dung lượng tối đa 10MB.');
      return;
    }
    setPickError(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(picked);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(picked);
  }, []);

  const clearImage = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFile(null);
    setPickError(null);
    setUploadError(null);
  }, []);

  /** Uploads the selected image (create signed URL, then PUT the bytes) and returns the
   * storage path to send as `attachment_path` on the message create call -- it does not
   * itself create the message, so a failed upload never produces an orphaned/misleading
   * message record. Does not clear the selection on success; callers clear it only after
   * the message create call also succeeds. */
  const uploadImage = useCallback(async (conversationId: string): Promise<string | null> => {
    if (!file || uploadInFlight.current) return null;
    uploadInFlight.current = true;
    setIsUploading(true);
    setUploadError(null);
    try {
      const contentType = file.type;
      const { path, upload_url } = await createMessageAttachmentUploadUrl(conversationId, {
        file_name: file.name,
        content_type: contentType,
        file_size: file.size,
      });
      await uploadMessageAttachmentFile(upload_url, file);
      return path;
    } catch (err) {
      setUploadError(toUploadError(err));
      throw err;
    } finally {
      uploadInFlight.current = false;
      setIsUploading(false);
    }
  }, [file]);

  return {
    file,
    hasImage: file !== null,
    previewUrl,
    pickError,
    isUploading,
    uploadError,
    selectImage,
    clearImage,
    uploadImage,
  };
}
