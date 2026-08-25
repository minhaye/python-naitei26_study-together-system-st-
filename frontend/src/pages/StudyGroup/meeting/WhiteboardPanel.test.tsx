import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WhiteboardPanel } from './WhiteboardPanel';

const syncedWhiteboardSpy = vi.fn();

beforeEach(() => {
  syncedWhiteboardSpy.mockClear();
});

// SyncedWhiteboard mounts the real Tldraw editor (and its useWhiteboardSync/LiveKit
// dependencies) -- mocking it here lets these tests assert purely on WhiteboardPanel's own
// gating logic: whether Tldraw gets mounted at all, not how it behaves once mounted.
vi.mock('./SyncedWhiteboard', () => ({
  SyncedWhiteboard: (props: unknown) => {
    syncedWhiteboardSpy(props);
    return <div data-testid="synced-whiteboard" />;
  },
}));

describe('WhiteboardPanel', () => {
  it('mounts SyncedWhiteboard when available', () => {
    render(
      <WhiteboardPanel
        roomId="room-1"
        initialState={null}
        isReadonly={false}
        isAvailable
        onUnavailableClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('synced-whiteboard')).toBeInTheDocument();
    expect(syncedWhiteboardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-1', initialState: null, isReadonly: false }),
    );
  });

  it('does not mount SyncedWhiteboard when unavailable, and shows the fallback instead', async () => {
    const onUnavailableClick = vi.fn();
    render(
      <WhiteboardPanel
        roomId="room-1"
        initialState={null}
        isReadonly={false}
        isAvailable={false}
        onUnavailableClick={onUnavailableClick}
      />,
    );

    expect(screen.queryByTestId('synced-whiteboard')).not.toBeInTheDocument();
    expect(syncedWhiteboardSpy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(onUnavailableClick).toHaveBeenCalledTimes(1);
  });
});
