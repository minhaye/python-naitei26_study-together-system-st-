import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupMembersPanel } from './GroupMembersPanel';
import type { GroupMember } from '../../lib/group.types';
import type { AuthUser } from '../../hooks/useAuth';

const currentUser: AuthUser = { id: 'me', name: 'Tôi', initials: 'T', color: '#000', avatarUrl: null };

function member(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    id: overrides.id ?? 'member-1',
    group_id: 'group-1',
    user_id: overrides.user_id ?? 'user-1',
    role: overrides.role ?? 'member',
    status: 'active',
    joined_at: new Date().toISOString(),
    user: { id: overrides.user_id ?? 'user-1', username: 'alice', display_name: 'Alice', avatar_url: null, role: 'user' },
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof GroupMembersPanel>> = {}) {
  const props = {
    members: [
      member({ id: 'm-owner', user_id: 'owner-1', role: 'owner' as const }),
      member({ id: 'm-mod', user_id: 'mod-1', role: 'moderator' as const, user: { id: 'mod-1', username: 'bob', display_name: 'Bob', avatar_url: null, role: 'user' } }),
      member({ id: 'm-member', user_id: 'member-1', role: 'member' as const, user: { id: 'member-1', username: 'carol', display_name: 'Carol', avatar_url: null, role: 'user' } }),
    ],
    currentUserId: 'owner-1',
    currentUser,
    isOwner: true,
    isGroupManager: true,
    isPrivateChannel: false,
    explicitChannelMemberUserIds: new Set<string>(),
    pendingMemberId: null,
    channelActionPendingUserId: null,
    error: null,
    onPromote: vi.fn(),
    onDemote: vi.fn(),
    onRemove: vi.fn(),
    onKickFromChannel: vi.fn(),
    onInviteClick: vi.fn(),
    ...overrides,
  };
  render(<GroupMembersPanel {...props} />);
  return props;
}

describe('GroupMembersPanel', () => {
  it('renders the real member list with Owner/Moderator/Member distinction', () => {
    renderPanel();
    expect(screen.getByText('Tôi (Bạn)')).toBeInTheDocument(); // owner is currentUser here
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Điều hành viên')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Thành viên (3)')).toBeInTheDocument();
  });

  it('shows an empty state when there are no non-owner members', () => {
    renderPanel({ members: [member({ id: 'm-owner', user_id: 'owner-1', role: 'owner' })] });
    expect(screen.getByText('Chưa có thành viên khác.')).toBeInTheDocument();
  });

  it('hides promote/demote controls for non-owners (permission-dependent controls)', () => {
    renderPanel({ isOwner: false });
    expect(screen.queryByTitle('Thăng làm điều hành viên')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Hạ xuống thành viên')).not.toBeInTheDocument();
  });

  it('promotes a plain member to moderator', () => {
    const props = renderPanel();
    screen.getByTitle('Thăng làm điều hành viên').click();
    expect(props.onPromote).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-member', role: 'member' }));
  });

  it('demotes a moderator to member', () => {
    const props = renderPanel();
    screen.getByTitle('Hạ xuống thành viên').click();
    expect(props.onDemote).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-mod', role: 'moderator' }));
  });

  it('disables only the pending row while a promote/demote mutation is in flight', () => {
    renderPanel({ pendingMemberId: 'm-member' });
    expect(screen.getByTitle('Thăng làm điều hành viên')).toBeDisabled();
    expect(screen.getByTitle('Hạ xuống thành viên')).not.toBeDisabled();
  });

  it('surfaces a mutation error', () => {
    renderPanel({ error: 'Không thể xóa thành viên.' });
    expect(screen.getByText('Không thể xóa thành viên.')).toBeInTheDocument();
  });

  it('shows the Invite button only for an active manager and reuses the click handler', () => {
    const props = renderPanel();
    screen.getByText('Mời thêm người').click();
    expect(props.onInviteClick).toHaveBeenCalled();
  });

  it('hides the Invite button for a plain member', () => {
    renderPanel({ isGroupManager: false });
    expect(screen.queryByText('Mời thêm người')).not.toBeInTheDocument();
  });
});

describe('GroupMembersPanel -- click-to-open member action menu', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('does not navigate immediately on click', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Carol'));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens the action menu on click, with "Xem hồ sơ" always present', () => {
    renderPanel();
    expect(screen.queryByText('Xem hồ sơ')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getByText('Xem hồ sơ')).toBeInTheDocument();
  });

  it('navigates to the profile route only after "Xem hồ sơ" is clicked, and closes the menu', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Carol'));
    fireEvent.click(screen.getByText('Xem hồ sơ'));
    expect(openSpy).toHaveBeenCalledWith('/users/member-1', '_blank', 'noopener,noreferrer');
    expect(screen.queryByText('Xem hồ sơ')).not.toBeInTheDocument();
  });

  it("clicking the viewer's own row still opens a menu offering \"Xem hồ sơ\" (never a no-op)", () => {
    renderPanel();
    fireEvent.click(screen.getByText('Tôi (Bạn)'));
    expect(screen.getByText('Xem hồ sơ')).toBeInTheDocument();
  });

  it("never offers a kick action on the viewer's own row, even as owner", () => {
    renderPanel();
    fireEvent.click(screen.getByText('Tôi (Bạn)'));
    expect(screen.queryByText('Xóa khỏi nhóm')).not.toBeInTheDocument();
    expect(screen.queryByText('Xóa khỏi kênh')).not.toBeInTheDocument();
  });

  it('closes the menu when clicking outside', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getByText('Xem hồ sơ')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Xem hồ sơ')).not.toBeInTheDocument();
  });

  it('never has more than one row menu open at a time', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getAllByText('Xem hồ sơ')).toHaveLength(1);
    fireEvent.click(screen.getByText('Bob'));
    // Still exactly one menu open (Bob's), Carol's own closed automatically.
    expect(screen.getAllByText('Xem hồ sơ')).toHaveLength(1);
  });
});

describe('GroupMembersPanel -- public channel remove behavior', () => {
  it('never shows "Xóa khỏi kênh" for a public channel', () => {
    renderPanel({ isPrivateChannel: false, explicitChannelMemberUserIds: new Set(['member-1']) });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.queryByText('Xóa khỏi kênh')).not.toBeInTheDocument();
  });

  it('an authorized Group owner sees "Xóa khỏi nhóm" for another member', () => {
    renderPanel({ isPrivateChannel: false, isOwner: true });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getByText('Xóa khỏi nhóm')).toBeInTheDocument();
  });

  it('clicking "Xóa khỏi nhóm" calls onRemove with the target member', () => {
    const props = renderPanel({ isPrivateChannel: false, isOwner: true });
    fireEvent.click(screen.getByText('Carol'));
    fireEvent.click(screen.getByText('Xóa khỏi nhóm'));
    expect(props.onRemove).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'member-1' }));
  });

  it('an unauthorized plain member (not owner, not moderator) sees no remove actions', () => {
    renderPanel({ isPrivateChannel: false, isOwner: false, isGroupManager: false });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.queryByText('Xóa khỏi nhóm')).not.toBeInTheDocument();
    expect(screen.queryByText('Xóa khỏi kênh')).not.toBeInTheDocument();
  });

  it('a moderator (Group manager but not owner) does not see "Xóa khỏi nhóm" (owner-only)', () => {
    renderPanel({ isPrivateChannel: false, isOwner: false, isGroupManager: true });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.queryByText('Xóa khỏi nhóm')).not.toBeInTheDocument();
  });
});

describe('GroupMembersPanel -- private channel kick behavior', () => {
  it('an explicit channel member shows "Xóa khỏi kênh" to an authorized Group manager', () => {
    renderPanel({ isPrivateChannel: true, isGroupManager: true, explicitChannelMemberUserIds: new Set(['member-1']) });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getByText('Xóa khỏi kênh')).toBeInTheDocument();
  });

  it('clicking "Xóa khỏi kênh" calls onKickFromChannel with the target member', () => {
    const props = renderPanel({ isPrivateChannel: true, isGroupManager: true, explicitChannelMemberUserIds: new Set(['member-1']) });
    fireEvent.click(screen.getByText('Carol'));
    fireEvent.click(screen.getByText('Xóa khỏi kênh'));
    expect(props.onKickFromChannel).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'member-1' }));
  });

  it('does not show "Xóa khỏi kênh" for a manager-access-only participant with no explicit channel_members row', () => {
    // Bob (moderator) is displayed via manager-access fallback, not an explicit row.
    renderPanel({ isPrivateChannel: true, isGroupManager: true, explicitChannelMemberUserIds: new Set(['member-1']) });
    fireEvent.click(screen.getByText('Bob'));
    expect(screen.queryByText('Xóa khỏi kênh')).not.toBeInTheDocument();
  });

  it('does not show "Xóa khỏi kênh" for an unauthorized (non-manager) viewer even with an explicit row', () => {
    renderPanel({ isPrivateChannel: true, isOwner: false, isGroupManager: false, explicitChannelMemberUserIds: new Set(['member-1']) });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.queryByText('Xóa khỏi kênh')).not.toBeInTheDocument();
  });

  it('"Xóa khỏi nhóm" still follows the existing Group role rules (owner-only) in a private channel', () => {
    renderPanel({ isPrivateChannel: true, isOwner: false, isGroupManager: true, explicitChannelMemberUserIds: new Set(['member-1']) });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.queryByText('Xóa khỏi nhóm')).not.toBeInTheDocument();
  });

  it('shows a pending label while a channel-kick mutation is in flight', () => {
    renderPanel({ isPrivateChannel: true, isGroupManager: true, explicitChannelMemberUserIds: new Set(['member-1']), channelActionPendingUserId: 'member-1' });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getByText('Đang xóa...')).toBeInTheDocument();
  });
});
