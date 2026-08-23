import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    pendingMemberId: null,
    error: null,
    onPromote: vi.fn(),
    onDemote: vi.fn(),
    onRemove: vi.fn(),
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

  it('hides promote/demote/remove controls for non-owners (permission-dependent controls)', () => {
    renderPanel({ isOwner: false });
    expect(screen.queryByTitle('Thăng làm điều hành viên')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Hạ xuống thành viên')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Xóa khỏi nhóm')).not.toBeInTheDocument();
  });

  it('never renders role/remove controls for the owner row (Owner protection)', () => {
    renderPanel();
    // Only 2 non-owner rows exist, each has exactly one role-toggle + one remove button.
    expect(screen.getAllByTitle('Xóa khỏi nhóm')).toHaveLength(2);
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

  it('removes a member', () => {
    const props = renderPanel();
    screen.getAllByTitle('Xóa khỏi nhóm')[0].click();
    expect(props.onRemove).toHaveBeenCalled();
  });

  it('disables only the pending row while a mutation is in flight', () => {
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
