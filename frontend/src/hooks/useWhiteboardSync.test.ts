import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RoomEvent } from 'livekit-client';
import { getSnapshot } from 'tldraw';
import type { TLStore } from 'tldraw';
import { useWhiteboardSync } from './useWhiteboardSync';
import { getStudyRoom, updateWhiteboardState } from '../lib/studyRoom.api';

vi.mock('../lib/studyRoom.api', () => ({
  getStudyRoom: vi.fn(),
  updateWhiteboardState: vi.fn(),
}));

type Handler = (...args: any[]) => void;

function createFakeRoom() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    localParticipant: { publishData: vi.fn() },
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
    }),
    emit(event: string, ...args: any[]) {
      handlers.get(event)?.forEach((h) => h(...args));
    },
  };
}

let fakeRoom: ReturnType<typeof createFakeRoom> | null = null;

// Only useMaybeRoomContext is exercised by this hook -- everything else about the real
// LiveKit connection (WebRTC, signaling) is out of scope for a unit test.
vi.mock('@livekit/components-react', () => ({
  useMaybeRoomContext: () => fakeRoom,
}));

const mockedGetStudyRoom = vi.mocked(getStudyRoom);
const mockedUpdateWhiteboardState = vi.mocked(updateWhiteboardState);

/** `createTLStore()` alone (without ever mounting a real `<Tldraw>` editor) seeds no records
 * at all -- the editor's own integrity-checker normally creates the singleton `document`
 * record, default page, camera, etc. on mount. Mounting the full editor in a unit test drags
 * in canvas/ResizeObserver/pointer-event jsdom gaps that aren't worth it here, so this seeds
 * just the one record this suite needs (the document's own `name` field is a real, always-
 * present, trivially mutable field) directly, matching `documentValidator`'s exact shape
 * (`@tldraw/tlschema`'s TLDocument.ts) -- via `mergeRemoteChanges` so the seed itself isn't
 * picked up as a broadcastable 'user' change. */
function seedDocumentRecord(store: TLStore) {
  const doc = { id: 'document:document', typeName: 'document', gridSize: 10, name: 'Initial', meta: {} } as any;
  store.mergeRemoteChanges(() => store.put([doc]));
  return doc;
}

function decodePublishedPayload(data: Uint8Array) {
  return JSON.parse(new TextDecoder().decode(data));
}

describe('useWhiteboardSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeRoom = createFakeRoom();
    mockedGetStudyRoom.mockReset();
    mockedUpdateWhiteboardState.mockReset().mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches rapid local edits into a single publishData call after the throttle window', () => {
    const { result } = renderHook(() => useWhiteboardSync('room-1', null, false));
    const store = result.current;
    const doc = seedDocumentRecord(store);

    act(() => {
      store.put([{ ...doc, name: 'First' }]);
      store.put([{ ...doc, name: 'Second' }]);
    });
    expect(fakeRoom!.localParticipant.publishData).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(fakeRoom!.localParticipant.publishData).toHaveBeenCalledTimes(1);
    const [data, opts] = fakeRoom!.localParticipant.publishData.mock.calls[0];
    expect(opts).toEqual({ reliable: true });
    const payload = decodePublishedPayload(data);
    expect(payload.type).toBe('whiteboard_update');
    // Only the final value survives batching, not one packet per intermediate edit.
    expect(payload.changes.updated[doc.id][1].name).toBe('Second');
  });

  it('does not broadcast local edits when isReadonly is true', () => {
    const { result } = renderHook(() => useWhiteboardSync('room-1', null, true));
    const store = result.current;
    const doc = seedDocumentRecord(store);

    act(() => {
      store.put([{ ...doc, name: 'Changed' }]);
      vi.advanceTimersByTime(60);
    });

    expect(fakeRoom!.localParticipant.publishData).not.toHaveBeenCalled();
  });

  it('does not include remotely-merged changes in what it broadcasts', () => {
    // `store.mergeRemoteChanges` also runs tldraw's own integrity-checker housekeeping
    // (`ensureStoreIsUsable`) as a side effect, which can itself insert missing scaffolding
    // records (e.g. a default page) as ordinary 'user'-sourced writes -- that's an unrelated
    // tldraw internal, not what this test cares about, so the assertion below checks the
    // *content* of whatever gets broadcast rather than asserting zero calls.
    const { result } = renderHook(() => useWhiteboardSync('room-1', null, false));
    const store = result.current;
    const doc = seedDocumentRecord(store);

    act(() => {
      store.mergeRemoteChanges(() => {
        store.put([{ ...doc, name: 'From remote' }]);
      });
      vi.advanceTimersByTime(60);
    });

    for (const call of fakeRoom!.localParticipant.publishData.mock.calls) {
      const payload = decodePublishedPayload(call[0]);
      expect(payload.changes.updated[doc.id]).toBeUndefined();
      expect(payload.changes.added[doc.id]).toBeUndefined();
    }
  });

  it('debounces the persisted-state save separately from the broadcast throttle', () => {
    const { result } = renderHook(() => useWhiteboardSync('room-1', null, false));
    const store = result.current;
    const doc = seedDocumentRecord(store);

    act(() => {
      store.put([{ ...doc, name: 'Changed' }]);
      vi.advanceTimersByTime(60);
    });
    expect(mockedUpdateWhiteboardState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockedUpdateWhiteboardState).toHaveBeenCalledTimes(1);
    expect(mockedUpdateWhiteboardState.mock.calls[0][0]).toBe('room-1');
  });

  it('merges an incoming whiteboard_update packet from LiveKit into the store', () => {
    const { result } = renderHook(() => useWhiteboardSync('room-1', null, true));
    const store = result.current;
    const added = { id: 'document:document', typeName: 'document', gridSize: 10, name: 'Remote Name', meta: {} };

    const payload = JSON.stringify({
      type: 'whiteboard_update',
      changes: { added: { [added.id]: added }, updated: {}, removed: {} },
    });

    act(() => {
      fakeRoom!.emit(RoomEvent.DataReceived, new TextEncoder().encode(payload), {});
    });

    expect((store.get(added.id as any) as any).name).toBe('Remote Name');
  });

  it('resyncs from the persisted snapshot on RoomEvent.Reconnected', async () => {
    const { result } = renderHook(() => useWhiteboardSync('room-1', null, false));
    const store = result.current;
    const doc = seedDocumentRecord(store);
    store.mergeRemoteChanges(() => store.put([{ ...doc, name: 'Persisted elsewhere' }]));
    const snapshot = getSnapshot(store);
    mockedGetStudyRoom.mockResolvedValue({ whiteboard_state: snapshot } as any);

    // Simulate this client having missed the edit above (e.g. made on another client while
    // this one was offline) by reverting its own local copy first.
    store.mergeRemoteChanges(() => store.put([{ ...doc, name: 'Stale local copy' }]));

    await act(async () => {
      fakeRoom!.emit(RoomEvent.Reconnected);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedGetStudyRoom).toHaveBeenCalledWith('room-1');
    expect((store.get(doc.id) as any).name).toBe('Persisted elsewhere');
  });

  it('unsubscribes from LiveKit room events on unmount', () => {
    const { unmount } = renderHook(() => useWhiteboardSync('room-1', null, false));
    unmount();

    expect(fakeRoom!.off).toHaveBeenCalledWith(RoomEvent.DataReceived, expect.any(Function));
    expect(fakeRoom!.off).toHaveBeenCalledWith(RoomEvent.Reconnected, expect.any(Function));
  });
});
