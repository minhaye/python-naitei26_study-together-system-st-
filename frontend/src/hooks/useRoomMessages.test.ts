import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../lib/apiClient';
import { listConversationMessages, sendConversationMessage } from '../lib/message.api';
import { useChannelMessagesRealtime } from './useChannelMessagesRealtime';
import { useRoomMessages } from './useRoomMessages';
import type { Message } from '../lib/message.types';

vi.mock('../lib/message.api', () => ({
  listConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
}));
vi.mock('./useChannelMessagesRealtime', () => ({
  useChannelMessagesRealtime: vi.fn(),
}));

const mockedList = vi.mocked(listConversationMessages);
const mockedSend = vi.mocked(sendConversationMessage);
const mockedRealtime = vi.mocked(useChannelMessagesRealtime);

const sender = { id: 'user-1', username: 'alice', display_name: 'Alice', avatar_url: null };

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    content: 'hello',
    attachment_path: null,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    sender,
    ...overrides,
  };
}

beforeEach(() => {
  mockedList.mockReset();
  mockedSend.mockReset();
  mockedRealtime.mockReset();
});

describe('useRoomMessages', () => {
  it('does not load when conversationId is null', () => {
    const { result } = renderHook(() => useRoomMessages(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedRealtime).toHaveBeenCalledWith(null, expect.any(Function));
  });

  it('loads messages for the room conversation on mount (oldest-to-newest)', async () => {
    const newer = makeMessage({ id: 'msg-2', created_at: '2026-08-19T00:01:00Z' });
    const older = makeMessage({ id: 'msg-1', created_at: '2026-08-19T00:00:00Z' });
    mockedList.mockResolvedValue({ items: [newer, older], next_cursor: null });

    const { result } = renderHook(() => useRoomMessages('conv-1'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedList).toHaveBeenCalledWith('conv-1');
    expect(result.current.messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
    expect(result.current.loadError).toBeNull();
  });

  it('surfaces an empty room distinctly from an error', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.loadError).toBeNull();
  });

  it('surfaces a load error from the API', async () => {
    mockedList.mockRejectedValue(new ApiError(403, 'Forbidden'));

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.loadError).toEqual({ status: 403, message: 'Forbidden' });
  });

  it('renders sender identity via UserSummary on each message', async () => {
    mockedList.mockResolvedValue({ items: [makeMessage({ sender: { ...sender, display_name: 'Bob' } })], next_cursor: null });

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages[0].sender.display_name).toBe('Bob');
  });

  it('sends a message and appends it to the list immediately on success', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });
    const sent = makeMessage({ id: 'msg-new', content: 'hi there' });
    mockedSend.mockResolvedValue(sent);

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('hi there');
    });

    expect(mockedSend).toHaveBeenCalledWith('conv-1', { content: 'hi there', attachment_path: null });
    expect(result.current.messages.map((m) => m.id)).toEqual(['msg-new']);
    expect(result.current.isSending).toBe(false);
    expect(result.current.sendError).toBeNull();
  });

  it('sends an attachment_path alongside content when provided', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });
    const sent = makeMessage({ id: 'msg-img', content: 'check this out', attachment_path: 'study-rooms/room-1/user-1/obj/photo.png' });
    mockedSend.mockResolvedValue(sent);

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('check this out', 'study-rooms/room-1/user-1/obj/photo.png');
    });

    expect(mockedSend).toHaveBeenCalledWith('conv-1', {
      content: 'check this out',
      attachment_path: 'study-rooms/room-1/user-1/obj/photo.png',
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['msg-img']);
  });

  it('sends an image-only message (no text) when attachment_path is provided with blank content', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });
    const sent = makeMessage({ id: 'msg-img-only', content: null, attachment_path: 'study-rooms/room-1/user-1/obj/photo.png' });
    mockedSend.mockResolvedValue(sent);

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('', 'study-rooms/room-1/user-1/obj/photo.png');
    });

    expect(mockedSend).toHaveBeenCalledWith('conv-1', {
      content: null,
      attachment_path: 'study-rooms/room-1/user-1/obj/photo.png',
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['msg-img-only']);
  });

  it('is a no-op when both content and attachment_path are blank', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });
    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('   ', null);
    });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('surfaces a send error without adding a message', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });
    mockedSend.mockRejectedValue(new ApiError(403, 'You do not have access to this conversation'));

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.sendMessage('hi')).rejects.toThrow();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.sendError).toEqual({ status: 403, message: 'You do not have access to this conversation' });
    expect(result.current.isSending).toBe(false);
  });

  it('ignores sendMessage with blank content or no conversationId', async () => {
    const { result } = renderHook(() => useRoomMessages(null));
    await act(async () => {
      await result.current.sendMessage('   ');
    });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('dedupes a Realtime insert of the same message already added by a successful send', async () => {
    mockedList.mockResolvedValue({ items: [], next_cursor: null });
    const sent = makeMessage({ id: 'msg-new', content: 'hi there' });
    mockedSend.mockResolvedValue(sent);

    let realtimeCallback: (m: Message) => void = () => {};
    mockedRealtime.mockImplementation((_conversationId, onInsert) => {
      realtimeCallback = onInsert;
    });

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('hi there');
    });
    act(() => {
      realtimeCallback(sent);
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it('renders the real hydrated sender for a remote message delivered via Realtime, not a generic placeholder', async () => {
    // useChannelMessagesRealtime is responsible for hydrating a raw Realtime row into a real
    // `Message` (see that hook's own tests for the hydration mechanics) -- this hook must not
    // re-normalize or override whatever it receives. A remote user's actual UserSummary must
    // reach the UI untouched, not degrade to a generic "Người dùng" placeholder.
    mockedList.mockResolvedValue({ items: [], next_cursor: null });

    let realtimeCallback: (m: Message) => void = () => {};
    mockedRealtime.mockImplementation((_conversationId, onInsert) => {
      realtimeCallback = onInsert;
    });

    const { result } = renderHook(() => useRoomMessages('conv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const hydratedRemoteMessage = makeMessage({
      id: 'msg-from-other',
      sender_id: 'user-2',
      sender: { id: 'user-2', username: 'bob', display_name: 'Bob Nguyen', avatar_url: 'https://example.com/bob.png' },
    });

    act(() => {
      realtimeCallback(hydratedRemoteMessage);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].sender).toEqual({
      id: 'user-2',
      username: 'bob',
      display_name: 'Bob Nguyen',
      avatar_url: 'https://example.com/bob.png',
    });
  });
});
