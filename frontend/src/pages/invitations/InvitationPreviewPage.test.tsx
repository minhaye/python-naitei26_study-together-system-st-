import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ApiError } from '../../lib/apiClient';
import { resolveInvitation, redeemInvitation, declineInvitation } from '../../lib/invitation.api';
import { useAuth } from '../../hooks/useAuth';
import { InvitationPreviewPage } from './InvitationPreviewPage';
import type { InvitationPreview } from '../../lib/invitation.types';

vi.mock('../../lib/invitation.api', () => ({
  resolveInvitation: vi.fn(),
  redeemInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveInvitation);
const mockedRedeem = vi.mocked(redeemInvitation);
const mockedDecline = vi.mocked(declineInvitation);
const mockedUseAuth = vi.mocked(useAuth);

const groupPreview: InvitationPreview = {
  id: 'inv-1',
  target: { type: 'group', id: 'group-1', name: 'Nhóm Python', group_id: 'group-1', group_name: 'Nhóm Python' },
  inviter_name: 'Alice',
  method: 'email',
  expires_at: new Date(Date.now() + 60_000).toISOString(),
};

function renderPage(secret = 'sometoken') {
  return render(
    <MemoryRouter initialEntries={[`/invitations/${secret}`]}>
      <Routes>
        <Route path="/invitations/:secret" element={<InvitationPreviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvitationPreviewPage', () => {
  beforeEach(() => {
    mockedResolve.mockReset();
    mockedRedeem.mockReset();
    mockedDecline.mockReset();
    mockedUseAuth.mockReset();
  });

  it('shows an error state for an invalid/expired secret', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, loading: false } as ReturnType<typeof useAuth>);
    mockedResolve.mockRejectedValue(new ApiError(404, 'Invitation not found or no longer valid'));

    renderPage();

    expect(await screen.findByText('Invitation not found or no longer valid')).toBeInTheDocument();
  });

  it('prompts login when not authenticated, without offering Accept/Decline yet', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: false, loading: false } as ReturnType<typeof useAuth>);
    mockedResolve.mockResolvedValue(groupPreview);

    renderPage();

    expect(await screen.findByText('Đăng nhập để tham gia')).toBeInTheDocument();
    expect(screen.queryByText('Tham gia')).not.toBeInTheDocument();
  });

  it('accepts the invitation and shows the target preview', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, loading: false } as ReturnType<typeof useAuth>);
    mockedResolve.mockResolvedValue(groupPreview);
    mockedRedeem.mockResolvedValue({ outcome: 'joined', target: groupPreview.target });

    renderPage();

    expect(await screen.findByText('Nhóm Python')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tham gia'));

    await waitFor(() => expect(mockedRedeem).toHaveBeenCalledWith('sometoken'));
  });

  it('shows a guidance message (not an error toast) when Group membership is required first', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, loading: false } as ReturnType<typeof useAuth>);
    const roomPreview: InvitationPreview = {
      id: 'inv-2',
      target: { type: 'study_room', id: 'room-1', name: 'Phòng luyện đề', group_id: 'group-1', group_name: 'Nhóm Python' },
      inviter_name: 'Alice',
      method: 'code',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    mockedResolve.mockResolvedValue(roomPreview);
    mockedRedeem.mockResolvedValue({ outcome: 'group_membership_required', target: roomPreview.target });

    renderPage();
    fireEvent.click(await screen.findByText('Tham gia'));

    await waitFor(() =>
      expect(screen.getByText(/Bạn cần tham gia nhóm "Nhóm Python" trước/)).toBeInTheDocument()
    );
    expect(mockedRedeem).toHaveBeenCalledTimes(1);
  });

  it('declines the invitation using its id (not the secret)', async () => {
    mockedUseAuth.mockReturnValue({ isLoggedIn: true, loading: false } as ReturnType<typeof useAuth>);
    mockedResolve.mockResolvedValue(groupPreview);
    mockedDecline.mockResolvedValue({
      id: 'inv-1',
      group_id: 'group-1',
      room_id: null,
      channel_id: null,
      method: 'email',
      status: 'declined',
      created_by: 'user-1',
      recipient_email: 'me@example.com',
      expires_at: groupPreview.expires_at,
      accepted_at: null,
      declined_at: new Date().toISOString(),
      revoked_at: null,
      created_at: new Date().toISOString(),
    });

    renderPage();
    fireEvent.click(await screen.findByText('Từ chối'));

    await waitFor(() => expect(mockedDecline).toHaveBeenCalledWith('inv-1'));
    expect(await screen.findByText('Bạn đã từ chối lời mời này.')).toBeInTheDocument();
  });
});
