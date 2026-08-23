import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { RoomEvent } from 'livekit-client';
import { usePresentationSync } from './usePresentationSync';
import { getStudyRoom, updatePresentationState } from '../lib/studyRoom.api';
import { createWhiteboardAssetUploadUrl, uploadWhiteboardAssetFile } from '../lib/whiteboardAsset.api';
import { countPdfPages } from '../lib/pdf';
import type { PresentationState } from '../lib/studyRoom.types';

vi.mock('../lib/studyRoom.api', () => ({
  getStudyRoom: vi.fn(),
  updatePresentationState: vi.fn(),
}));

vi.mock('../lib/whiteboardAsset.api', () => ({
  createWhiteboardAssetUploadUrl: vi.fn(),
  uploadWhiteboardAssetFile: vi.fn(),
}));

vi.mock('../lib/pdf', () => ({
  countPdfPages: vi.fn(),
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

vi.mock('@livekit/components-react', () => ({
  useMaybeRoomContext: () => fakeRoom,
}));

const mockedGetStudyRoom = vi.mocked(getStudyRoom);
const mockedUpdatePresentationState = vi.mocked(updatePresentationState);
const mockedCreateUploadUrl = vi.mocked(createWhiteboardAssetUploadUrl);
const mockedUploadFile = vi.mocked(uploadWhiteboardAssetFile);
const mockedCountPdfPages = vi.mocked(countPdfPages);

function decodePublishedPayload(data: Uint8Array) {
  return JSON.parse(new TextDecoder().decode(data));
}

const SAMPLE_STATE: PresentationState = {
  asset_path: 'study-rooms/room-1/user-1/uuid/deck.pdf',
  file_name: 'deck.pdf',
  page: 1,
  page_count: 5,
};

describe('usePresentationSync', () => {
  beforeEach(() => {
    fakeRoom = createFakeRoom();
    mockedGetStudyRoom.mockReset();
    mockedUpdatePresentationState.mockReset().mockResolvedValue({} as any);
    mockedCreateUploadUrl.mockReset();
    mockedUploadFile.mockReset().mockResolvedValue(undefined);
    mockedCountPdfPages.mockReset();
  });

  it('starts with the initial state passed in (e.g. loaded from the room on page load)', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, false));
    expect(result.current.presentation).toEqual(SAMPLE_STATE);
    expect(result.current.canControl).toBe(true);
  });

  it('broadcasts and persists a page change for an editor', async () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, false));

    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.presentation?.page).toBe(3);
    expect(fakeRoom!.localParticipant.publishData).toHaveBeenCalledTimes(1);
    const [data, opts] = fakeRoom!.localParticipant.publishData.mock.calls[0];
    expect(opts).toEqual({ reliable: true });
    const payload = decodePublishedPayload(data);
    expect(payload).toEqual({ type: 'presentation_update', state: { ...SAMPLE_STATE, page: 3 } });

    await waitFor(() => {
      expect(mockedUpdatePresentationState).toHaveBeenCalledWith('room-1', { ...SAMPLE_STATE, page: 3 });
    });
  });

  it('clamps page navigation to [1, page_count]', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, false));

    act(() => result.current.goToPage(999));
    expect(result.current.presentation?.page).toBe(5);

    act(() => result.current.goToPage(-10));
    expect(result.current.presentation?.page).toBe(1);
  });

  it('does not change page, broadcast, or persist when the target page is unchanged', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, false));

    act(() => result.current.goToPage(1));

    expect(fakeRoom!.localParticipant.publishData).not.toHaveBeenCalled();
    expect(mockedUpdatePresentationState).not.toHaveBeenCalled();
  });

  it('a read-only participant cannot change pages or broadcast', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, true));

    act(() => result.current.goToPage(3));

    expect(result.current.presentation?.page).toBe(1);
    expect(fakeRoom!.localParticipant.publishData).not.toHaveBeenCalled();
    expect(mockedUpdatePresentationState).not.toHaveBeenCalled();
    expect(result.current.canControl).toBe(false);
  });

  it('uploads a deck, counts its pages, and broadcasts the resulting state at page 1', async () => {
    mockedCreateUploadUrl.mockResolvedValue({ path: 'study-rooms/room-1/user-1/uuid/new.pdf', upload_url: 'https://x/upload', token: 'tok' });
    mockedCountPdfPages.mockResolvedValue(9);
    const { result } = renderHook(() => usePresentationSync('room-1', null, false));
    const file = new File([new Uint8Array([1, 2, 3])], 'new.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.uploadDeck(file);
    });

    expect(mockedCreateUploadUrl).toHaveBeenCalledWith('room-1', {
      file_name: 'new.pdf',
      content_type: 'application/pdf',
      file_size: file.size,
    });
    expect(mockedUploadFile).toHaveBeenCalledWith('https://x/upload', file, 'application/pdf');
    expect(result.current.presentation).toEqual({
      asset_path: 'study-rooms/room-1/user-1/uuid/new.pdf',
      file_name: 'new.pdf',
      page: 1,
      page_count: 9,
    });
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadError).toBeNull();
  });

  it('surfaces a user-facing error and resets isUploading when the upload fails', async () => {
    mockedCreateUploadUrl.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => usePresentationSync('room-1', null, false));
    const file = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.uploadDeck(file);
    });

    expect(result.current.presentation).toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadError).toBe('Không thể tải lên slide bài giảng.');
  });

  it('clears the deck, broadcasting null', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, false));

    act(() => result.current.clearDeck());

    expect(result.current.presentation).toBeNull();
    const [data] = fakeRoom!.localParticipant.publishData.mock.calls[0];
    expect(decodePublishedPayload(data)).toEqual({ type: 'presentation_update', state: null });
  });

  it('applies an incoming presentation_update packet from LiveKit', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, true));
    const incoming = { ...SAMPLE_STATE, page: 4 };
    const payload = JSON.stringify({ type: 'presentation_update', state: incoming });

    act(() => {
      fakeRoom!.emit(RoomEvent.DataReceived, new TextEncoder().encode(payload), {});
    });

    expect(result.current.presentation).toEqual(incoming);
  });

  it('ignores non-presentation packets (e.g. whiteboard_update)', () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, true));
    const payload = JSON.stringify({ type: 'whiteboard_update', changes: {} });

    act(() => {
      fakeRoom!.emit(RoomEvent.DataReceived, new TextEncoder().encode(payload), {});
    });

    expect(result.current.presentation).toEqual(SAMPLE_STATE);
  });

  it('resyncs the presentation state from REST on RoomEvent.Reconnected', async () => {
    const { result } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, true));
    const resynced = { ...SAMPLE_STATE, page: 2 };
    mockedGetStudyRoom.mockResolvedValue({ presentation_state: resynced } as any);

    await act(async () => {
      fakeRoom!.emit(RoomEvent.Reconnected);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedGetStudyRoom).toHaveBeenCalledWith('room-1');
    expect(result.current.presentation).toEqual(resynced);
  });

  it('unsubscribes from LiveKit room events on unmount', () => {
    const { unmount } = renderHook(() => usePresentationSync('room-1', SAMPLE_STATE, false));
    unmount();

    expect(fakeRoom!.off).toHaveBeenCalledWith(RoomEvent.DataReceived, expect.any(Function));
    expect(fakeRoom!.off).toHaveBeenCalledWith(RoomEvent.Reconnected, expect.any(Function));
  });
});
