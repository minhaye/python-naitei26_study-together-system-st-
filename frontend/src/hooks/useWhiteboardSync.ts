import { useEffect, useRef, useState } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot, TLRecord, TLStore } from 'tldraw';
import { updateWhiteboardState } from '../lib/studyRoom.api';
import { RoomEvent } from 'livekit-client';

export function useWhiteboardSync(roomId: string, initialState: Record<string, any> | null, isReadonly: boolean) {
  const room = useMaybeRoomContext();
  const [store] = useState<TLStore>(() => {
    const newStore = createTLStore({ shapeUtils: defaultShapeUtils });
    if (initialState) {
      try {
        loadSnapshot(newStore, initialState as any);
      } catch (err) {
        console.error("Failed to load whiteboard snapshot", err);
      }
    }
    return newStore;
  });

  const isSyncing = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Setup broadcast to LiveKit data channels
  useEffect(() => {
    if (!room) return;

    const unsubscribe = store.listen(
      (update) => {
        // Only broadcast local user changes
        if (update.source !== 'user') return;

        if (isReadonly) return;

        // Broadcast to LiveKit
        const payload = JSON.stringify({
          type: 'whiteboard_update',
          changes: update.changes,
        });
        const data = new TextEncoder().encode(payload);
        
        // Reliable broadcast to all participants
        room.localParticipant.publishData(data, { reliable: true });

        // Debounce saving to DB (save every 5 seconds of continuous drawing)
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
        }, 5000);
      },
      { scope: 'document', source: 'user' }
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [room, store, roomId, isReadonly]);

  // Setup receiving from LiveKit data channels
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (
      payload: Uint8Array,
      participant: any,
      kind: any,
      topic?: string
    ) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'whiteboard_update' && data.changes) {
          isSyncing.current = true;
          
          store.mergeRemoteChanges(() => {
            const { added, updated, removed } = data.changes;
            
            // Apply added and updated records
            const toPut = [
              ...Object.values(added),
              ...Object.values(updated).map((u: any) => u[1])
            ] as TLRecord[];
            if (toPut.length > 0) store.put(toPut);
            
            // Apply removed records
            const toRemove = Object.keys(removed) as any[];
            if (toRemove.length > 0) store.remove(toRemove);
          });
          
          isSyncing.current = false;
        }
      } catch (err) {
        // Ignore JSON parse errors for non-whiteboard packets
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, store]);

  return store;
}
