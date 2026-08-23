import type { TLAsset, TLAssetStore } from 'tldraw';
import {
  createWhiteboardAssetUploadUrl,
  getWhiteboardAssetDownloadUrl,
  uploadWhiteboardAssetFile,
} from './whiteboardAsset.api';

/** Mirrors MAX_ATTACHMENT_SIZE_BYTES (app/attachments/constants.py) -- client-side check is
 * purely for fast feedback, the backend re-validates on the upload-url request regardless. */
export const MAX_WHITEBOARD_ASSET_SIZE_BYTES = 10 * 1024 * 1024;

/** Prefix marking a tldraw asset `src` as a Storage object PATH rather than a real URL --
 * `resolve()` below turns it back into a fresh signed URL on every render. This is what
 * actually gets synced (broadcast + persisted into study_rooms.whiteboard_state), so it must
 * stay valid indefinitely, unlike a signed URL which expires. */
const PATH_SCHEME = 'wbasset:';

/**
 * A tldraw `TLAssetStore` (the board's `assets` option) backed by the existing
 * message-attachments Storage bucket, room-scoped via `study_room_router`'s whiteboard asset
 * endpoints -- reuses AttachmentsService rather than embedding dropped images/PDFs as base64
 * inside the synced snapshot, which would blow up both the LiveKit broadcast payload and the
 * persisted `whiteboard_state` JSONB column. One instance per room; `roomId` never changes
 * for the lifetime of a whiteboard session so it's safe to close over.
 */
export function createWhiteboardAssetStore(roomId: string): TLAssetStore {
  return {
    async upload(_asset: TLAsset, file: File) {
      if (file.size > MAX_WHITEBOARD_ASSET_SIZE_BYTES) {
        throw new Error('Tệp vượt quá dung lượng tối đa 10MB.');
      }
      const { path, upload_url } = await createWhiteboardAssetUploadUrl(roomId, {
        file_name: file.name,
        content_type: file.type || 'application/octet-stream',
        file_size: file.size,
      });
      await uploadWhiteboardAssetFile(upload_url, file, file.type);
      return { src: `${PATH_SCHEME}${path}` };
    },

    async resolve(asset: TLAsset) {
      const src = asset.props.src;
      if (!src) return null;
      if (!src.startsWith(PATH_SCHEME)) {
        // Not one of ours (e.g. an http(s) URL from a pasted link/bookmark) -- pass through.
        return src;
      }
      const path = src.slice(PATH_SCHEME.length);
      try {
        const { url } = await getWhiteboardAssetDownloadUrl(roomId, path);
        return url;
      } catch (err) {
        console.error('Failed to resolve whiteboard asset', err);
        return null;
      }
    },
  };
}
