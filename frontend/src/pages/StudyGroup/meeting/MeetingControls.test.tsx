import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingControls } from './MeetingControls';
import { MeetingContext } from './MeetingContext';
import type { MeetingContextValue } from './MeetingContext';

const setMicrophoneEnabled = vi.fn();
const setCameraEnabled = vi.fn();
const setScreenShareEnabled = vi.fn();

let mockLocalParticipantState = { isMicrophoneEnabled: true, isCameraEnabled: true, isScreenShareEnabled: false };

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    isMicrophoneEnabled: mockLocalParticipantState.isMicrophoneEnabled,
    isCameraEnabled: mockLocalParticipantState.isCameraEnabled,
    isScreenShareEnabled: mockLocalParticipantState.isScreenShareEnabled,
    localParticipant: { setMicrophoneEnabled, setCameraEnabled, setScreenShareEnabled },
  }),
}));

function renderControls(connected: boolean, disabled = false) {
  const value: MeetingContextValue = { status: connected ? 'ready' : 'loading', error: null, retry: vi.fn(), connected, liveKitError: null };
  return render(
    <MeetingContext.Provider value={value}>
      <MeetingControls disabled={disabled} />
    </MeetingContext.Provider>
  );
}

describe('MeetingControls', () => {
  beforeEach(() => {
    setMicrophoneEnabled.mockReset();
    setCameraEnabled.mockReset();
    setScreenShareEnabled.mockReset();
    mockLocalParticipantState = { isMicrophoneEnabled: true, isCameraEnabled: true, isScreenShareEnabled: false };
  });

  it('renders disabled placeholder buttons before the LiveKit room is connected', () => {
    renderControls(false);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
    expect(setMicrophoneEnabled).not.toHaveBeenCalled();
  });

  it('mutes the microphone when clicked while enabled', async () => {
    renderControls(true);
    await userEvent.click(screen.getByTitle('Tắt micro'));
    expect(setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  it('unmutes the microphone when clicked while muted', async () => {
    mockLocalParticipantState.isMicrophoneEnabled = false;
    renderControls(true);
    await userEvent.click(screen.getByTitle('Bật micro'));
    expect(setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });

  it('turns the camera off when clicked while enabled', async () => {
    renderControls(true);
    await userEvent.click(screen.getByTitle('Tắt camera'));
    expect(setCameraEnabled).toHaveBeenCalledWith(false);
  });

  it('turns the camera on when clicked while disabled', async () => {
    mockLocalParticipantState.isCameraEnabled = false;
    renderControls(true);
    await userEvent.click(screen.getByTitle('Bật camera'));
    expect(setCameraEnabled).toHaveBeenCalledWith(true);
  });

  it('disables both buttons when the room has ended, even while connected', () => {
    renderControls(true, true);
    expect(screen.getByTitle('Tắt micro')).toBeDisabled();
    expect(screen.getByTitle('Tắt camera')).toBeDisabled();
  });

  it('starts screen sharing when clicked while inactive', async () => {
    setScreenShareEnabled.mockResolvedValue(undefined);
    renderControls(true);
    await userEvent.click(screen.getByTitle('Chia sẻ màn hình'));
    expect(setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: true });
  });

  it('stops screen sharing when clicked while active', async () => {
    mockLocalParticipantState.isScreenShareEnabled = true;
    setScreenShareEnabled.mockResolvedValue(undefined);
    renderControls(true);
    await userEvent.click(screen.getByTitle('Dừng chia sẻ màn hình'));
    expect(setScreenShareEnabled).toHaveBeenCalledWith(false, { audio: true });
  });

  it('ignores a repeated click while a screen-share request is still in flight', async () => {
    let resolveShare: () => void = () => {};
    setScreenShareEnabled.mockReturnValue(new Promise<void>((resolve) => { resolveShare = resolve; }));
    renderControls(true);

    const button = screen.getByTitle('Chia sẻ màn hình');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(setScreenShareEnabled).toHaveBeenCalledTimes(1);

    resolveShare();
  });

  it('recovers (does not get stuck disabled) when the browser picker is cancelled', async () => {
    setScreenShareEnabled.mockRejectedValue(new Error('Permission denied'));
    renderControls(true);

    const button = screen.getByTitle('Chia sẻ màn hình');
    await userEvent.click(button);

    expect(await screen.findByTitle('Chia sẻ màn hình')).not.toBeDisabled();
  });

  it('disables the screen-share button when the room has ended, even while connected', () => {
    renderControls(true, true);
    expect(screen.getByTitle('Chia sẻ màn hình')).toBeDisabled();
  });

  it('surfaces a proportionate error (and does not throw) when the microphone permission is denied', async () => {
    setMicrophoneEnabled.mockRejectedValue(new Error('Permission denied'));
    renderControls(true);

    await userEvent.click(screen.getByTitle('Tắt micro'));

    expect(await screen.findByText(/Không thể truy cập micro/)).toBeInTheDocument();
    // The button reflects real (unchanged) LiveKit state -- it must not get stuck disabled.
    expect(screen.getByTitle('Tắt micro')).not.toBeDisabled();
  });

  it('surfaces a proportionate error when the camera is unavailable, without unmounting the controls', async () => {
    setCameraEnabled.mockRejectedValue(new Error('Device not found'));
    renderControls(true);

    await userEvent.click(screen.getByTitle('Tắt camera'));

    expect(await screen.findByText(/Không thể truy cập camera/)).toBeInTheDocument();
    // A failed camera toggle must not tear down the rest of the controls (e.g. mic/share stay usable).
    expect(screen.getByTitle('Tắt micro')).toBeInTheDocument();
    expect(screen.getByTitle('Chia sẻ màn hình')).toBeInTheDocument();
  });

  it('clears a previous media error once a toggle succeeds', async () => {
    setMicrophoneEnabled.mockRejectedValueOnce(new Error('Permission denied'));
    setMicrophoneEnabled.mockResolvedValueOnce(undefined);
    renderControls(true);

    const button = screen.getByTitle('Tắt micro');
    await userEvent.click(button);
    expect(await screen.findByText(/Không thể truy cập micro/)).toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.queryByText(/Không thể truy cập micro/)).not.toBeInTheDocument();
  });
});
