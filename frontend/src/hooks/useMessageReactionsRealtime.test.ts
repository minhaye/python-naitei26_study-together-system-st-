import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { supabase } from '../lib/supabase';
import { getMessageReactions } from '../lib/message.api';
import { useMessageReactionsRealtime } from './useMessageReactionsRealtime';
import type { MessageReactionSummary } from '../lib/message.types';

vi.mock('../lib/supabase', () => ({
  supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}));
vi.mock('../lib/message.api', () => ({
  getMessageReactions: vi.fn(),
}));

const mockedChannel = vi.mocked(supabase.channel);
const mockedRemoveChannel = vi.mocked(supabase.removeChannel);
const mockedGetMessageReactions = vi.mocked(getMessageReactions);

/** Stand-in for the real supabase-js RealtimeChannel: captures the '*' handler passed to
 * `.on(...)` so a test can invoke it directly with a fake payload shaped like a real
 * postgres_changes event (`{ new, old }`, either possibly absent depending on the event
 * type -- INSERT has no `old`, DELETE has no `new`). */
function createFakeChannel() {
  let handler: (payload: { new?: unknown; old?: unknown }) => void = () => {};
  const fake = {
    on: vi.fn((_event: string, _filter: unknown, cb: (payload: { new?: unknown; old?: unknown }) => void) => {
      handler = cb;
      return fake;
    }),
    subscribe: vi.fn((cb?: (status: string, err?: unknown) => void) => {
      cb?.('SUBSCRIBED');
      return fake;
    }),
  };
  return { fake, trigger: (payload: { new?: unknown; old?: unknown }) => handler(payload) };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return { id: 'reaction-1', message_id: 'msg-1', conversation_id: 'conv-1', user_id: 'user-2', emoji: '👍', ...overrides };
}

const summary: MessageReactionSummary[] = [{ emoji: '👍', count: 1, reacted_by_me: false }];

beforeEach(() => {
  mockedChannel.mockReset();
  mockedRemoveChannel.mockReset();
  mockedGetMessageReactions.mockReset();
});

describe('useMessageReactionsRealtime', () => {
  it('does not subscribe when conversationId is null', () => {
    renderHook(() => useMessageReactionsRealtime(null, vi.fn()));
    expect(mockedChannel).not.toHaveBeenCalled();
  });

  it('hydrates an INSERT event via GET /messages/{id}/reactions before notifying the caller', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    mockedGetMessageReactions.mockResolvedValue(summary);
    const onChange = vi.fn();

    renderHook(() => useMessageReactionsRealtime('conv-1', onChange));

    act(() => {
      trigger({ new: makeRow() });
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(mockedGetMessageReactions).toHaveBeenCalledWith('msg-1');
    expect(onChange).toHaveBeenCalledWith('msg-1', summary);
  });

  it('hydrates a DELETE event using the `old` payload (message_reactions has REPLICA IDENTITY FULL)', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    mockedGetMessageReactions.mockResolvedValue([]);
    const onChange = vi.fn();

    renderHook(() => useMessageReactionsRealtime('conv-1', onChange));

    act(() => {
      trigger({ old: makeRow({ message_id: 'msg-2' }) });
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(mockedGetMessageReactions).toHaveBeenCalledWith('msg-2');
    expect(onChange).toHaveBeenCalledWith('msg-2', []);
  });

  it('ignores an event for a different conversation_id (filter is defense in depth, not the only check)', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const onChange = vi.fn();

    renderHook(() => useMessageReactionsRealtime('conv-1', onChange));

    act(() => {
      trigger({ new: makeRow({ conversation_id: 'conv-other' }) });
    });

    expect(mockedGetMessageReactions).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops the event without calling onChange when hydration fails', async () => {
    const { fake, trigger } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    mockedGetMessageReactions.mockRejectedValue(new Error('404'));
    const onChange = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useMessageReactionsRealtime('conv-1', onChange));

    act(() => {
      trigger({ new: makeRow() });
    });

    await waitFor(() => expect(mockedGetMessageReactions).toHaveBeenCalledTimes(1));
    expect(onChange).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('discards a late hydration response after conversationId changes', async () => {
    const { fake: fakeA, trigger: triggerA } = createFakeChannel();
    const { fake: fakeB } = createFakeChannel();
    mockedChannel.mockReturnValueOnce(fakeA as unknown as ReturnType<typeof supabase.channel>);
    mockedChannel.mockReturnValueOnce(fakeB as unknown as ReturnType<typeof supabase.channel>);

    let resolveGet!: (reactions: MessageReactionSummary[]) => void;
    mockedGetMessageReactions.mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      })
    );
    const onChange = vi.fn();

    const { rerender } = renderHook(({ conversationId }) => useMessageReactionsRealtime(conversationId, onChange), {
      initialProps: { conversationId: 'conv-1' as string | null },
    });

    act(() => {
      triggerA({ new: makeRow() });
    });
    await waitFor(() => expect(mockedGetMessageReactions).toHaveBeenCalledTimes(1));

    rerender({ conversationId: 'conv-2' });
    expect(mockedRemoveChannel).toHaveBeenCalledWith(fakeA);

    await act(async () => {
      resolveGet(summary);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { fake } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);

    const { unmount } = renderHook(() => useMessageReactionsRealtime('conv-1', vi.fn()));
    unmount();

    expect(mockedRemoveChannel).toHaveBeenCalledWith(fake);
  });
});
