import { useEffect, useRef, useState } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot } from 'tldraw';
import type { TLRecord, TLStore } from 'tldraw';
import { getStudyRoom, updateWhiteboardState } from '../lib/studyRoom.api';
import { createWhiteboardAssetStore } from '../lib/whiteboardAssetStore';
import {
  emptyWhiteboardChanges,
  isEmptyWhiteboardChanges,
  mergeWhiteboardChanges,
  type WhiteboardChanges,
} from '../lib/whiteboardChangeBatch';
import { RoomEvent } from 'livekit-client';

/** Batches rapid local edits (e.g. every point of a freehand stroke) into one LiveKit
 * data-channel packet per window instead of one per change -- short enough to still feel
 * live (well under the ~100-150ms most people notice as lag), long enough to meaningfully
 * cut packet count during fast drawing. */
const BROADCAST_THROTTLE_MS = 60;

/** How long to keep debouncing the persisted-snapshot PUT while the user keeps drawing --
 * unrelated to BROADCAST_THROTTLE_MS above (that's network batching, this is DB write
 * frequency); unchanged from the original implementation. */
const SAVE_DEBOUNCE_MS = 5000;

export function useWhiteboardSync(roomId: string, initialState: Record<string, any> | null, isReadonly: boolean) {
  const room = useMaybeRoomContext();
  const [store] = useState<TLStore>(() => {
    const newStore = createTLStore({ shapeUtils: defaultShapeUtils, assets: createWhiteboardAssetStore(roomId) });
    if (initialState) {
      try {
        loadSnapshot(newStore, initialState as any);
      } catch (err) {
        console.error('Failed to load whiteboard snapshot', err);
      }
    }
    return newStore;
  });

  const saveTimeoutRef = useRef<number | null>(null);
  const pendingBroadcastRef = useRef<WhiteboardChanges>(emptyWhiteboardChanges());
  const broadcastTimeoutRef = useRef<number | null>(null);

  // Setup throttled/batched broadcast to LiveKit data channels + debounced DB persistence.
  useEffect(() => {
    if (!room) return;

    const flushBroadcast = () => {
      broadcastTimeoutRef.current = null;
      const changes = pendingBroadcastRef.current;
      pendingBroadcastRef.current = emptyWhiteboardChanges();
      if (isEmptyWhiteboardChanges(changes)) return;

      const payload = JSON.stringify({ type: 'whiteboard_update', changes });
      const data = new TextEncoder().encode(payload);
      // Reliable (ordered, retransmitted) broadcast to all participants -- see
      // can_edit_whiteboard/create_meeting_token for why only host/moderator connections
      // even have can_publish_data=true; this call is a silent no-op for anyone else.
      room.localParticipant.publishData(data, { reliable: true });
    };

    const unsubscribe = store.listen(
      (update) => {
        // Only broadcast local user changes, never remote-merged ones (mergeRemoteChanges
        // below uses source 'remote' precisely so this listener ignores its own echo).
        if (update.source !== 'user') return;
        if (isReadonly) return;

        pendingBroadcastRef.current = mergeWhiteboardChanges(pendingBroadcastRef.current, update.changes);
        if (broadcastTimeoutRef.current === null) {
          broadcastTimeoutRef.current = window.setTimeout(flushBroadcast, BROADCAST_THROTTLE_MS);
        }

        // Debounce saving to DB (save once activity pauses for SAVE_DEBOUNCE_MS) -- this is
        // the durable fallback new/reconnecting participants load from (initialState) and
        // has nothing to do with the live broadcast path above.
        if (saveTimeoutRef.current) {
          window.clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = window.setTimeout(async () => {
          try {
            const snapshot = getSnapshot(store);
            await updateWhiteboardState(roomId, snapshot as any);
          } catch (err) {
            console.error('Failed to save whiteboard to DB', err);
          }
        }, SAVE_DEBOUNCE_MS);
      },
      { scope: 'document', source: 'user' }
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      if (broadcastTimeoutRef.current) {
        window.clearTimeout(broadcastTimeoutRef.current);
        broadcastTimeoutRef.current = null;
      }
      pendingBroadcastRef.current = emptyWhiteboardChanges();
    };
  }, [room, store, roomId, isReadonly]);

  // Setup receiving from LiveKit data channels.
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (
      payload: Uint8Array,
      _participant: any,
      _kind: any,
      _topic?: string
    ) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'whiteboard_update' && data.changes) {
          store.mergeRemoteChanges(() => {
            const { added, updated, removed } = data.changes;

            // Apply added and updated records. Both puts and removes are idempotent
            // (put-by-id, remove-by-id) so a duplicate or replayed packet is harmless, and
            // LiveKit's reliable data channel delivers each sender's own packets in order,
            // so out-of-order concerns only arise across different senders editing the same
            // record concurrently -- last write applied wins, same last-write-wins model
            // tldraw's own multiplayer sync uses for non-CRDT conflicts.
            const toPut = [
              ...Object.values(added),
              ...Object.values(updated).map((u: any) => u[1])
            ] as TLRecord[];
            if (toPut.length > 0) store.put(toPut);

            const toRemove = Object.keys(removed) as any[];
            if (toRemove.length > 0) store.remove(toRemove);
          });
        }
      } catch {
        // Ignore JSON parse errors for non-whiteboard packets
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, store]);

  // Resync from the persisted snapshot after a reconnect -- any live edits broadcast while
  // this client was offline were missed (LiveKit data messages aren't replayed), so on
  // reconnect we fall back to whatever the last debounced DB save captured. This does not
  // cover a still-in-progress edit made by someone else mid-stroke during the gap (a strictly
  // rare, cosmetic case), but guarantees the board converges rather than staying silently
  // stale for the rest of the session.
  useEffect(() => {
    if (!room) return;

    const resync = async () => {
      try {
        const latest = await getStudyRoom(roomId);
        if (latest.whiteboard_state) {
          loadSnapshot(store, latest.whiteboard_state as any);
        }
      } catch (err) {
        console.error('Failed to resync whiteboard after reconnect', err);
      }
    };

    room.on(RoomEvent.Reconnected, resync);
    return () => {
      room.off(RoomEvent.Reconnected, resync);
    };
  }, [room, store, roomId]);

  return store;
}
