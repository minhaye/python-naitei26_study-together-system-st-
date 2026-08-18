import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../lib/apiClient';
import { resolveInvitation, redeemInvitation } from '../../lib/invitation.api';
import { JoinByCodeModal } from './JoinByCodeModal';
import type { InvitationPreview, InvitationTarget } from '../../lib/invitation.types';

vi.mock('../../lib/invitation.api', () => ({
  resolveInvitation: vi.fn(),
  redeemInvitation: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveInvitation);
const mockedRedeem = vi.mocked(redeemInvitation);

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const groupTarget: InvitationTarget = { type: 'group', id: 'group-1', name: 'Nhóm Python', group_id: 'group-1', group_name: 'Nhóm Python' };
const roomTarget: InvitationTarget = { type: 'study_room', id: 'room-1', name: 'Phòng luyện đề', group_id: 'group-1', group_name: 'Nhóm Python' };

function groupPreview(): InvitationPreview {
  return { id: 'inv-1', target: groupTarget, inviter_name: 'Alice', method: 'code', expires_at: new Date(Date.now() + 60_000).toISOString() };
}

function renderModal(expectedTarget: 'group' | 'study_room' | 'private_channel' = 'group') {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <JoinByCodeModal isOpen onClose={onClose} expectedTarget={expectedTarget} />
    </MemoryRouter>
  );
  return { onClose };
}

async function enterAndContinue(code = 'K9XR-7P2M') {
  fireEvent.change(screen.getByPlaceholderText('K9XR-7P2M'), { target: { value: code } });
  fireEvent.click(screen.getByText('Tiếp tục'));
}

describe('JoinByCodeModal', () => {
  beforeEach(() => {
    mockedResolve.mockReset();
    mockedRedeem.mockReset();
    navigateMock.mockReset();
  });

  it('accepts a matching Group code and shows the preview', async () => {
    mockedResolve.mockResolvedValue(groupPreview());
    renderModal('group');

    await enterAndContinue();

    expect(await screen.findByText('Nhóm Python')).toBeInTheDocument();
    expect(mockedResolve).toHaveBeenCalledWith('K9XR-7P2M');
  });

  it('rejects a Study Room code with a clear mismatch message when expecting a Group', async () => {
    mockedResolve.mockResolvedValue({ ...groupPreview(), target: roomTarget });
    renderModal('group');

    await enterAndContinue();

    expect(await screen.findByText(/Mã này dùng cho Phòng học, không phải Nhóm học/)).toBeInTheDocument();
    expect(screen.getByText(/Tham gia Phòng học/)).toBeInTheDocument();
    // Must not show a Group preview/join button for a mismatched code.
    expect(screen.queryByText('Nhóm Python')).not.toBeInTheDocument();
  });

  it('rejects a Group code when expecting a Study Room', async () => {
    mockedResolve.mockResolvedValue(groupPreview());
    renderModal('study_room');

    await enterAndContinue();

    expect(await screen.findByText(/Mã này dùng cho Nhóm học, không phải Phòng học/)).toBeInTheDocument();
  });

  it('accepts a matching Study Room code', async () => {
    mockedResolve.mockResolvedValue({ ...groupPreview(), target: roomTarget });
    renderModal('study_room');

    await enterAndContinue();

    expect(await screen.findByText('Phòng luyện đề')).toBeInTheDocument();
    expect(screen.getByText(/Thuộc nhóm: Nhóm Python/)).toBeInTheDocument();
  });

  it('shows an error state for an invalid/expired code', async () => {
    mockedResolve.mockRejectedValue(new ApiError(404, 'Invitation not found or no longer valid'));
    renderModal('group');

    await enterAndContinue();

    expect(await screen.findByText('Invitation not found or no longer valid')).toBeInTheDocument();
  });

  it('redeems a matching code and navigates to the resolved target', async () => {
    mockedResolve.mockResolvedValue(groupPreview());
    mockedRedeem.mockResolvedValue({ outcome: 'joined', target: groupTarget });
    const { onClose } = renderModal('group');

    await enterAndContinue();
    await screen.findByText('Nhóm Python');
    fireEvent.click(screen.getByRole('button', { name: 'Tham gia Nhóm học' }));

    await waitFor(() => expect(mockedRedeem).toHaveBeenCalledWith('K9XR-7P2M'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/groups/group-1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates to the exact Study Room on successful redemption', async () => {
    mockedResolve.mockResolvedValue({ ...groupPreview(), target: roomTarget });
    mockedRedeem.mockResolvedValue({ outcome: 'joined', target: roomTarget });
    renderModal('study_room');

    await enterAndContinue();
    await screen.findByText('Phòng luyện đề');
    fireEvent.click(screen.getByRole('button', { name: 'Tham gia Phòng học' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/room/room-1'));
  });

  it('shows Group-membership-required guidance without closing the modal, and offers navigation to the Group', async () => {
    mockedResolve.mockResolvedValue({ ...groupPreview(), target: roomTarget });
    mockedRedeem.mockResolvedValue({ outcome: 'group_membership_required', target: roomTarget });
    const { onClose } = renderModal('study_room');

    await enterAndContinue();
    await screen.findByText('Phòng luyện đề');
    fireEvent.click(screen.getByRole('button', { name: 'Tham gia Phòng học' }));

    expect(await screen.findByText(/Bạn cần tham gia nhóm "Nhóm Python" trước/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Đến trang Nhóm học'));
    expect(navigateMock).toHaveBeenCalledWith('/groups/group-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a redeem error (e.g. already-used/revoked) without navigating', async () => {
    mockedResolve.mockResolvedValue(groupPreview());
    mockedRedeem.mockRejectedValue(new ApiError(409, 'Invitation was already used, expired, or revoked'));
    renderModal('group');

    await enterAndContinue();
    await screen.findByText('Nhóm Python');
    fireEvent.click(screen.getByRole('button', { name: 'Tham gia Nhóm học' }));

    expect(await screen.findByText('Invitation was already used, expired, or revoked')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
