import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiError } from '../../lib/apiClient';
import { createInvitation, getActiveCode, revokeInvitation } from '../../lib/invitation.api';
import { InviteModal } from './InviteModal';
import type { ActiveCodeInfo, InvitationCreated } from '../../lib/invitation.types';

vi.mock('../../lib/invitation.api', () => ({
  createInvitation: vi.fn(),
  getActiveCode: vi.fn(),
  revokeInvitation: vi.fn(),
}));

const mockedCreateInvitation = vi.mocked(createInvitation);
const mockedGetActiveCode = vi.mocked(getActiveCode);
const mockedRevokeInvitation = vi.mocked(revokeInvitation);

const baseInvitation = {
  id: 'inv-1',
  group_id: 'group-1',
  room_id: null,
  channel_id: null,
  status: 'pending' as const,
  created_by: 'user-1',
  accepted_at: null,
  declined_at: null,
  revoked_at: null,
  created_at: new Date().toISOString(),
};

describe('InviteModal', () => {
  beforeEach(() => {
    mockedCreateInvitation.mockReset();
    mockedGetActiveCode.mockReset();
    mockedRevokeInvitation.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderModal() {
    return render(
      <InviteModal
        isOpen
        onClose={() => {}}
        target={{ groupId: 'group-1' }}
        targetLabel="Nhóm học Python"
      />
    );
  }

  it('defaults to the Email tab', () => {
    mockedGetActiveCode.mockResolvedValue(null);
    renderModal();
    expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
  });

  it('sends an email invitation and shows success', async () => {
    mockedGetActiveCode.mockResolvedValue(null);
    mockedCreateInvitation.mockResolvedValue({
      ...baseInvitation,
      method: 'email',
      recipient_email: 'bob@example.com',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      code: null,
    } as InvitationCreated);

    renderModal();
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByText('Gửi lời mời'));

    await waitFor(() => expect(screen.getByText(/Đã gửi lời mời tới bob@example.com/)).toBeInTheDocument());
    expect(mockedCreateInvitation).toHaveBeenCalledWith({ groupId: 'group-1' }, 'email', 'bob@example.com');
  });

  it('shows a validation/backend error when sending fails', async () => {
    mockedGetActiveCode.mockResolvedValue(null);
    mockedCreateInvitation.mockRejectedValue(new ApiError(403, 'Only an active group owner or moderator can create invitations for this target'));

    renderModal();
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'bob@example.com' } });
    fireEvent.click(screen.getByText('Gửi lời mời'));

    await waitFor(() =>
      expect(screen.getByText('Only an active group owner or moderator can create invitations for this target')).toBeInTheDocument()
    );
  });

  it('switches to the Code tab and shows "no active code" state', async () => {
    mockedGetActiveCode.mockResolvedValue(null);
    renderModal();

    fireEvent.click(screen.getByText('Mã mời'));
    await waitFor(() => expect(mockedGetActiveCode).toHaveBeenCalledWith({ groupId: 'group-1' }));
    expect(await screen.findByText('Tạo mã mời')).toBeInTheDocument();
  });

  it('generates a code, shows it with a live countdown, and allows copying it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedGetActiveCode.mockResolvedValue(null);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    mockedCreateInvitation.mockResolvedValue({
      ...baseInvitation,
      method: 'code',
      recipient_email: null,
      expires_at: expiresAt,
      code: 'K9XR-7P2M',
    } as InvitationCreated);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    renderModal();
    fireEvent.click(screen.getByText('Mã mời'));
    await screen.findByText('Tạo mã mời');
    fireEvent.click(screen.getByText('Tạo mã mời'));

    await waitFor(() => expect(screen.getByText('K9XR-7P2M')).toBeInTheDocument());
    expect(screen.getByText(/Còn hiệu lực: 05:00/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Sao chép mã/));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('K9XR-7P2M'));
    expect(await screen.findByText('Đã sao chép')).toBeInTheDocument();
  });

  it('shows the active-code state (without plaintext) when one already exists, and revoking clears it', async () => {
    const activeCode: ActiveCodeInfo = { id: 'inv-2', expires_at: new Date(Date.now() + 120_000).toISOString() };
    mockedGetActiveCode.mockResolvedValue(activeCode);
    mockedRevokeInvitation.mockResolvedValue({ ...baseInvitation, method: 'code', recipient_email: null, expires_at: activeCode.expires_at });

    renderModal();
    fireEvent.click(screen.getByText('Mã mời'));

    await screen.findByText(/Đang có một mã mời hoạt động/);
    // The plaintext is never shown for a pre-existing code -- only metadata.
    expect(screen.queryByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Hủy mã'));
    await waitFor(() => expect(mockedRevokeInvitation).toHaveBeenCalledWith('inv-2'));
    await waitFor(() => expect(screen.getByText('Tạo mã mời')).toBeInTheDocument());
  });
});
