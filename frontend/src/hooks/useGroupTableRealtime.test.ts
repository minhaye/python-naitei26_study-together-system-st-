import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { supabase } from '../lib/supabase';
import { useGroupTableRealtime } from './useGroupTableRealtime';

vi.mock('../lib/supabase', () => ({
  supabase: { channel: vi.fn(), removeChannel: vi.fn() },
}));

const mockedChannel = vi.mocked(supabase.channel);
const mockedRemoveChannel = vi.mocked(supabase.removeChannel);

/** Stand-in for the real supabase-js RealtimeChannel: captures the INSERT/UPDATE handlers
 * passed to `.on(...)` so a test can invoke them with a fake payload. Only `id`/`group_id`
 * are modeled on the raw row -- exactly what a real `channels`/`study_rooms` postgres_changes
 * row carries (never `conversation_id`, which is a backend-computed field -- see
 * useGroupTableRealtime.ts's header). */
function createFakeChannel() {
  const handlers: Record<string, (payload: { new: unknown }) => void> = {};
  const fake = {
    on: vi.fn((_event: string, filter: { event: string }, cb: (payload: { new: unknown }) => void) => {
      handlers[filter.event] = cb;
      return fake;
    }),
    subscribe: vi.fn((cb?: (status: string, err?: unknown) => void) => {
      cb?.('SUBSCRIBED');
      return fake;
    }),
  };
  return {
    fake,
    triggerInsert: (row: { id: string; group_id: string }) => handlers['INSERT']({ new: row }),
    triggerUpdate: (row: { id: string; group_id: string }) => handlers['UPDATE']({ new: row }),
  };
}

interface FakeHydrated {
  id: string;
  group_id: string;
  name: string;
  conversation_id: string;
  deleted_at: string | null;
}

function makeHydrated(overrides: Partial<FakeHydrated> = {}): FakeHydrated {
  return { id: 'row-1', group_id: 'group-1', name: 'general', conversation_id: 'conv-1', deleted_at: null, ...overrides };
}

beforeEach(() => {
  mockedChannel.mockReset();
  mockedRemoveChannel.mockReset();
});

describe('useGroupTableRealtime', () => {
  it('does not subscribe when groupId is null', () => {
    const hydrate = vi.fn();
    renderHook(() => useGroupTableRealtime<FakeHydrated>('channels', null, hydrate, { onInsert: vi.fn(), onUpdate: vi.fn() }));
    expect(mockedChannel).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('subscribes to the given table, scoped to the group', () => {
    const { fake } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);

    renderHook(() =>
      useGroupTableRealtime<FakeHydrated>('channels', 'group-1', vi.fn(), { onInsert: vi.fn(), onUpdate: vi.fn() })
    );

    expect(mockedChannel).toHaveBeenCalledWith('channels:group:group-1');
    expect(fake.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: 'INSERT', table: 'channels', filter: 'group_id=eq.group-1' }),
      expect.any(Function)
    );
    expect(fake.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: 'UPDATE', table: 'channels', filter: 'group_id=eq.group-1' }),
      expect.any(Function)
    );
  });

  it('hydrates a raw INSERT row via the given REST GET-by-id before calling onInsert (never casts the raw row -- see conversation_id header note)', async () => {
    const { fake, triggerInsert } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrated = makeHydrated({ id: 'c-1', conversation_id: 'conv-42' });
    const hydrate = vi.fn().mockResolvedValue(hydrated);
    const onInsert = vi.fn();

    renderHook(() => useGroupTableRealtime<FakeHydrated>('channels', 'group-1', hydrate, { onInsert, onUpdate: vi.fn() }));

    act(() => triggerInsert({ id: 'c-1', group_id: 'group-1' }));

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
    expect(hydrate).toHaveBeenCalledWith('c-1');
    expect(onInsert).toHaveBeenCalledWith(hydrated);
    expect(onInsert.mock.calls[0][0].conversation_id).toBe('conv-42');
  });

  it('hydrates a raw UPDATE row via the given REST GET-by-id before calling onUpdate', async () => {
    const { fake, triggerUpdate } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrated = makeHydrated({ id: 'r-1', name: 'Renamed' });
    const hydrate = vi.fn().mockResolvedValue(hydrated);
    const onUpdate = vi.fn();

    renderHook(() =>
      useGroupTableRealtime<FakeHydrated>('study_rooms', 'group-1', hydrate, { onInsert: vi.fn(), onUpdate })
    );

    act(() => triggerUpdate({ id: 'r-1', group_id: 'group-1' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(hydrate).toHaveBeenCalledWith('r-1');
    expect(onUpdate).toHaveBeenCalledWith(hydrated);
  });

  it('drops the event without calling onInsert when hydration fails (e.g. a soft-deleted row 404s)', async () => {
    const { fake, triggerInsert } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrate = vi.fn().mockRejectedValue(new Error('404'));
    const onInsert = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useGroupTableRealtime<FakeHydrated>('channels', 'group-1', hydrate, { onInsert, onUpdate: vi.fn() }));

    act(() => triggerInsert({ id: 'c-1', group_id: 'group-1' }));

    await waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1));
    expect(onInsert).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores a row for a different group_id and never hydrates it (defense in depth on top of the server-side filter)', () => {
    const { fake, triggerInsert } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrate = vi.fn();
    const onInsert = vi.fn();

    renderHook(() => useGroupTableRealtime<FakeHydrated>('channels', 'group-1', hydrate, { onInsert, onUpdate: vi.fn() }));

    act(() => triggerInsert({ id: 'c-1', group_id: 'group-other' }));

    expect(hydrate).not.toHaveBeenCalled();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('always calls the latest handlers even if the caller passes new function identities each render', async () => {
    const { fake, triggerInsert } = createFakeChannel();
    mockedChannel.mockReturnValue(fake as unknown as ReturnType<typeof supabase.channel>);
    const hydrate = vi.fn().mockResolvedValue(makeHydrated());
    const firstOnInsert = vi.fn();
    const secondOnInsert = vi.fn();

    const { rerender } = renderHook(
      ({ onInsert }) => useGroupTableRealtime<FakeHydrated>('channels', 'group-1', hydrate, { onInsert, onUpdate: vi.fn() }),
      { initialProps: { onInsert: firstOnInsert } }
    );
    rerender({ onInsert: secondOnInsert });

    act(() => triggerInsert({ id: 'c-1', group_id: 'group-1' }));

    await waitFor(() => expect(secondOnInsert).toHaveBeenCalledTimes(1));
    expect(firstOnInsert).not.toHaveBeenCalled();
  });

  it('discards a late hydration response after groupId changes, so it cannot leak into the new group', async () => {
    const { fake: fakeA, triggerInsert: triggerInsertA } = createFakeChannel();
    const { fake: fakeB } = createFakeChannel();
    mockedChannel.mockReturnValueOnce(fakeA as unknown as ReturnType<typeof supabase.channel>);
    mockedChannel.mockReturnValueOnce(fakeB as unknown as ReturnType<typeof supabase.channel>);

    let resolveHydrate!: (row: FakeHydrated) => void;
    const hydrate = vi.fn().mockReturnValue(
      new Promise<FakeHydrated>((resolve) => {
        resolveHydrate = resolve;
      })
    );
    const onInsert = vi.fn();

    const { rerender } = renderHook(
      ({ groupId }) => useGroupTableRealtime<FakeHydrated>('channels', groupId, hydrate, { onInsert, onUpdate: vi.fn() }),
      { initialProps: { groupId: 'group-1' as string | null } }
    );

    act(() => triggerInsertA({ id: 'c-1', group_id: 'group-1' }));
    await waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1));

    rerender({ groupId: 'group-2' });
    expect(mockedRemoveChannel).toHaveBeenCalledWith(fakeA);

    await act(async () => {
      resolveHydrate(makeHydrated({ id: 'c-1', group_id: 'group-1' }));
    });

    expect(onInsert).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount and re-subscribes (unsubscribing the old channel first) when groupId changes', () => {
    const { fake: fakeA } = createFakeChannel();
    const { fake: fakeB } = createFakeChannel();
    mockedChannel.mockReturnValueOnce(fakeA as unknown as ReturnType<typeof supabase.channel>);
    mockedChannel.mockReturnValueOnce(fakeB as unknown as ReturnType<typeof supabase.channel>);

    const { rerender, unmount } = renderHook(
      ({ groupId }) =>
        useGroupTableRealtime<FakeHydrated>('channels', groupId, vi.fn(), { onInsert: vi.fn(), onUpdate: vi.fn() }),
      { initialProps: { groupId: 'group-1' as string | null } }
    );
    expect(mockedChannel).toHaveBeenCalledWith('channels:group:group-1');
    expect(mockedRemoveChannel).not.toHaveBeenCalled();

    rerender({ groupId: 'group-2' });
    expect(mockedRemoveChannel).toHaveBeenCalledWith(fakeA);
    expect(mockedChannel).toHaveBeenCalledWith('channels:group:group-2');

    unmount();
    expect(mockedRemoveChannel).toHaveBeenCalledWith(fakeB);
  });
});
