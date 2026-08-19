import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { supabase } from '../lib/supabase';
import { getMessage } from '../lib/message.api';
import { useChannelMessagesRealtime } from './useChannelMessagesRealtime';
import type { Message } from '../lib/message.types';

vi.mock('../lib/supabase', () => ({
  supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}));
vi.mock('../lib/message.api', () => ({
  getMessage: vi.fn(),
}));

const mockedChannel = vi.mocked(supabase.channel);
const mockedRemoveChannel = vi.mocked(supabase.removeChannel);
const mockedGetMessage = vi.mocked(getMessage);

/** Stand-in for the real supabase-js RealtimeChannel: captures the INSERT handler passed to
 * `.on(...)` so a test can invoke it directly with a fake payload, exactly the shape Supabase
 * itself would deliver (`{ new: <raw row> }`, no `old`/`errors` needed for this hook's INSERT-only
 * subscription). */
function createFakeChannel() {
  let insertHandler: (payload: { new: unknown }) => void = () => {};
  const fake = {
    on: vi.fn((_event: string, _filter: unknown, cb: (payload: { new: unknown }) => void) => {
      insertHandler = cb;
      return fake;
    }),
    subscribe: vi.fn((cb?: (status: string, err?: unknown) => void) => {
      cb?.('SUBSCRIBED');
      return fake;
    }),
  };
  return { fake, trigger: (payload: { new: unknown }) => insertHandler(payload) };
}

function makeRawRow(overrides: Record<string, unknown> = {}) {
  // Exactly what Supabase's postgres_changes INSERT payload.new contains for the `messages`
  // table: its own columns only, never a joined `sender` -- there is deliberately no `sender`
  // key here at all, matching the real wire shape (not `sender: undefined`).
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    content: 'hello',
    attachment_path: null,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    ...overrides,
  };
}

function makeHydratedMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-2',
    content: 'hello',
    attachment_path: null,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    sender: { id: 'user-2', username: 'bob', display_name: 'Bob Nguyen', avatar_url: 'https://example.com/bob.png' },
    ...overrides,
  };
}

beforeEach(() => {
  mockedChannel.mockReset();
  mockedRemoveChannel.mockReset();
  mockedGetMessage.mockReset();
});

describe('useChannelMessagesRealtime', () => {
  it('does not subscribe when conversationId is null', () => {
    renderHook(() => useChannelMessagesRealtime(null, vi.fn()));
    expect(mockedChannel).not.toHaveBeenCalled();
  });

  it('hydrates a raw INSERT row (no sender) via GET /messages/{id} before notifying the caller', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrated = makeHydratedMessage();
    mockedGetMessage.mockResolvedValue(hydrated);
    const onInsert = vi.fn();

    renderHook(() => useChannelMessagesRealtime('conv-1', onInsert));

    act(() => {
      trigger({ new: makeRawRow() });
    });

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
    expect(mockedGetMessage).toHaveBeenCalledWith('msg-1');
    // The exact hydrated REST object reaches the caller -- a real UserSummary, never a
    // generic placeholder and never the raw un-hydrated row.
    expect(onInsert).toHaveBeenCalledWith(hydrated);
    expect(onInsert.mock.calls[0][0].sender).toEqual(hydrated.sender);
  });

  it('never passes the raw Realtime row itself to the caller, even though it structurally overlaps Message', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrated = makeHydratedMessage();
    mockedGetMessage.mockResolvedValue(hydrated);
    const onInsert = vi.fn();

    renderHook(() => useChannelMessagesRealtime('conv-1', onInsert));
    const rawRow = makeRawRow();

    act(() => {
      trigger({ new: rawRow });
    });

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
    const delivered = onInsert.mock.calls[0][0] as Message;
    expect(delivered).not.toBe(rawRow);
    expect(delivered.sender).toBeDefined();
    expect('sender' in rawRow).toBe(false);
  });

  it('drops the event without calling onInsert when hydration fails', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    mockedGetMessage.mockRejectedValue(new Error('404'));
    const onInsert = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useChannelMessagesRealtime('conv-1', onInsert));

    act(() => {
      trigger({ new: makeRawRow() });
    });

    await waitFor(() => expect(mockedGetMessage).toHaveBeenCalledTimes(1));
    expect(onInsert).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores an INSERT row for a different conversation_id (subscription filter is defense in depth, not the only check)', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const onInsert = vi.fn();

    renderHook(() => useChannelMessagesRealtime('conv-1', onInsert));

    act(() => {
      trigger({ new: makeRawRow({ conversation_id: 'conv-other' }) });
    });

    expect(mockedGetMessage).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('discards a late hydration response after conversationId changes, so it cannot leak into the new conversation', async () => {
    const { fake: fakeA, trigger: triggerA } = createFakeChannel();
    const { fake: fakeB } = createFakeChannel();
    mockedChannel.mockReturnValueOnce(fakeA as unknown as ReturnType<typeof supabase.channel>);
    mockedChannel.mockReturnValueOnce(fakeB as unknown as ReturnType<typeof supabase.channel>);

    let resolveGetMessage!: (message: Message) => void;
    mockedGetMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveGetMessage = resolve;
      })
    );
    const onInsert = vi.fn();

    const { rerender } = renderHook(({ conversationId }) => useChannelMessagesRealtime(conversationId, onInsert), {
      initialProps: { conversationId: 'conv-1' as string | null },
    });

    act(() => {
      triggerA({ new: makeRawRow() });
    });
    await waitFor(() => expect(mockedGetMessage).toHaveBeenCalledTimes(1));

    // Caller navigates to a different conversation before the hydration GET resolves.
    rerender({ conversationId: 'conv-2' });
    expect(mockedRemoveChannel).toHaveBeenCalledWith(fakeA);

    await act(async () => {
      resolveGetMessage(makeHydratedMessage());
    });

    expect(onInsert).not.toHaveBeenCalled();
  });
});
