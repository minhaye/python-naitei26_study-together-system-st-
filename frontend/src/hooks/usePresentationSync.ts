import { useCallback, useEffect, useState } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { getStudyRoom, updatePresentationState } from '../lib/studyRoom.api';
import type { PresentationState } from '../lib/studyRoom.types';
// Reuses the whiteboard's room-scoped asset upload/download endpoints -- a presentation deck
// is just another file in the same room storage namespace (see study_room_router's
// /whiteboard/assets/* docstrings), not a separate feature worth its own upload plumbing.
import { createWhiteboardAssetUploadUrl, uploadWhiteboardAssetFile } from '../lib/whiteboardAsset.api';
import { countPdfPages } from '../lib/pdf';

const PRESENTATION_UPDATE_TYPE = 'presentation_update';

export interface UsePresentationSyncResult {
  presentation: PresentationState | null;
  isUploading: boolean;
  uploadError: string | null;
  /** Whether this client may upload/change page/clear the deck for everyone -- host/moderator
   * only, same authority as the whiteboard (mirrors the `isReadonly` the caller computes for
   * SyncedWhiteboard). The backend independently re-enforces this on every write. */
  canControl: boolean;
  uploadDeck: (file: File) => Promise<void>;
  goToPage: (page: number) => void;
  clearDeck: () => void;
}

/**
 * Syncs the Study Room's shared presentation deck the same way useWhiteboardSync syncs the
 * board: LiveKit's reliable data channel for near-instant page-turn broadcast to everyone
 * currently connected, plus an immediate REST PUT so new/reconnecting participants (and a
 * REST resync after a network drop) load the current deck+page. Page turns are low-frequency
 * user actions (not a continuous stream like freehand drawing), so unlike useWhiteboardSync
 * there's no batching/throttling here -- every change is broadcast and saved immediately.
 */
export function usePresentationSync(
  roomId: string,
  initialState: PresentationState | null,
  isReadonly: boolean
): UsePresentationSyncResult {
  const room = useMaybeRoomContext();
  const [presentation, setPresentation] = useState<PresentationState | null>(initialState);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const applyLocalChange = useCallback(
    (next: PresentationState | null) => {
      if (isReadonly) return;
      setPresentation(next);
      if (room) {
        const payload = JSON.stringify({ type: PRESENTATION_UPDATE_TYPE, state: next });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      }
      updatePresentationState(roomId, next).catch((err) => {
        console.error('Failed to save presentation state', err);
      });
    },
    [isReadonly, room, roomId]
  );

  const uploadDeck = useCallback(
    async (file: File) => {
      if (isReadonly) return;
      setIsUploading(true);
      setUploadError(null);
      try {
        const { path, upload_url } = await createWhiteboardAssetUploadUrl(roomId, {
          file_name: file.name,
          content_type: file.type || 'application/pdf',
          file_size: file.size,
        });
        await uploadWhiteboardAssetFile(upload_url, file, file.type);
        const pageCount = await countPdfPages(file);
        applyLocalChange({ asset_path: path, file_name: file.name, page: 1, page_count: pageCount });
      } catch (err) {
        console.error('Failed to upload presentation deck', err);
        setUploadError('Không thể tải lên slide bài giảng.');
      } finally {
        setIsUploading(false);
      }
    },
    [roomId, isReadonly, applyLocalChange]
  );

  const goToPage = useCallback(
    (page: number) => {
      if (!presentation || isReadonly) return;
      const clamped = Math.min(Math.max(page, 1), presentation.page_count);
      if (clamped === presentation.page) return;
      applyLocalChange({ ...presentation, page: clamped });
    },
    [presentation, isReadonly, applyLocalChange]
  );

  const clearDeck = useCallback(() => {
    applyLocalChange(null);
  }, [applyLocalChange]);

  // Receive page-turns/deck changes broadcast by whoever controls the deck.
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === PRESENTATION_UPDATE_TYPE) {
          setPresentation(data.state ?? null);
        }
      } catch {
        // Ignore non-JSON or non-presentation packets (e.g. whiteboard_update).
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Resync from the persisted state after a reconnect -- mirrors useWhiteboardSync's own
  // reconnect handling (LiveKit doesn't replay data messages missed while disconnected).
  useEffect(() => {
    if (!room) return;

    const resync = async () => {
      try {
        const latest = await getStudyRoom(roomId);
        setPresentation(latest.presentation_state);
      } catch (err) {
        console.error('Failed to resync presentation after reconnect', err);
      }
    };

    room.on(RoomEvent.Reconnected, resync);
    return () => {
      room.off(RoomEvent.Reconnected, resync);
    };
  }, [room, roomId]);

  return {
    presentation,
    isUploading,
    uploadError,
    canControl: !isReadonly,
    uploadDeck,
    goToPage,
    clearDeck,
  };
}
