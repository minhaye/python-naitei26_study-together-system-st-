import { useEffect, useRef, useState } from 'react';
import { Shield, ShieldOff, Trash2, UserCircle2, UserMinus, UserPlus, Users } from 'lucide-react';
import type { GroupMember } from '../../lib/group.types';
import type { AuthUser } from '../../hooks/useAuth';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';
import { getDisplayName } from '../../utils/userDisplay';

export interface GroupMembersPanelProps {
  /** Active group members only -- callers filter by status before passing them in. For a
   * private Channel this may instead be the composed private-channel participant list
   * (channel_members + Group managers) -- see StudyGroupDetail.tsx's `displayedMembers`.
   * This component only renders whatever list it's given; it doesn't know which one it is. */
  members: GroupMember[];
  currentUserId: string | null;
  currentUser: AuthUser;
  /** Owner-only: role changes (promote/demote), "Xóa khỏi nhóm". Backend independently
   * re-checks this via is_group_owner on PUT .../role and DELETE /groups/{id}/members/{id}
   * -- this prop only controls whether the controls are shown, never the actual authorization. */
  isOwner: boolean;
  /** Owner or active moderator: gates the Invite button and "Xóa khỏi kênh" (backend:
   * is_group_manager on POST /invitations/ and DELETE /channels/{id}/members/{id}). */
  isGroupManager: boolean;
  /** Whether the currently active Channel is private -- "Xóa khỏi kênh" only exists as a
   * concept for a private Channel (public-channel access derives entirely from Group
   * membership, there is nothing channel-specific to revoke). */
  isPrivateChannel: boolean;
  /** user_id set of members with an explicit `channel_members` row for the active private
   * Channel (see StudyGroupDetail.tsx's `channelMembers`). A Group owner/moderator who is
   * only present in `members` via manager-access fallback (no explicit row) is NOT in this
   * set -- DELETE /channels/{id}/members/{id} would 404 for them, so "Xóa khỏi kênh" must
   * not be offered for them at all (removing their private-channel access, if that's even
   * desired, is a Group-role decision, not this endpoint's job). */
  explicitChannelMemberUserIds: Set<string>;
  /** `member.id` of the membership row currently being mutated (promote/demote/"Xóa khỏi
   * nhóm"), or null. Used to disable that row's controls and prevent duplicate-click
   * mutations. */
  pendingMemberId: string | null;
  /** `user_id` of the member currently being removed from the active Channel ("Xóa khỏi
   * kênh"), or null -- separate tracker from `pendingMemberId` since a channel_members row
   * has no corresponding GroupMember.id of its own (see the synthetic fallback entries in
   * StudyGroupDetail.tsx's composeDisplayedMembers). */
  channelActionPendingUserId: string | null;
  error: string | null;
  onPromote: (member: GroupMember) => void;
  onDemote: (member: GroupMember) => void;
  /** "Xóa khỏi nhóm" -- reuses the Group's existing member-removal flow (confirmation +
   * DELETE /groups/{id}/members/{id}), unchanged from before this menu existed. */
  onRemove: (member: GroupMember) => void;
  /** "Xóa khỏi kênh" -- removes the member's explicit `channel_members` row for the active
   * private Channel (confirmation + DELETE /channels/{id}/members/{id}). */
  onKickFromChannel: (member: GroupMember) => void;
  onInviteClick: () => void;
}

/** Opens the target user's existing public profile route in a new tab -- exactly the
 * navigation MessageUserTrigger used to perform on click, now reached via the "Xem hồ sơ"
 * menu item below instead of firing immediately on click. */
function openProfile(userId: string) {
  window.open(`/users/${userId}`, '_blank', 'noopener,noreferrer');
}

interface MemberRowProps {
  display: { name: string; initials: string; color: string; avatarUrl: string | null };
  roleLabel?: string | null;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onViewProfile: () => void;
  canKickFromChannel: boolean;
  isChannelKickPending: boolean;
  onKickFromChannel: () => void;
  canKickFromGroup: boolean;
  isGroupKickPending: boolean;
  onKickFromGroup: () => void;
  actions?: React.ReactNode;
}

/** A single member row: avatar + name open a small action menu (Xem hồ sơ / Xóa khỏi kênh /
 * Xóa khỏi nhóm) instead of navigating immediately -- mirrors the existing per-row "⋮" menu
 * pattern used for Channels/Study Rooms in StudyGroupDetail.tsx and the click-outside-to-close
 * pattern from PostCard.tsx (own ref + mousedown listener, only attached while this row's menu
 * is open). Lifting `isMenuOpen` to the parent (rather than local state per row) guarantees at
 * most one menu is open across the whole list -- opening one row's menu implicitly closes any
 * other. Clicking your OWN row still opens this menu (the caller simply never passes
 * `canKickFromChannel`/`canKickFromGroup` as true for it) -- "Xem hồ sơ" must stay reachable
 * for everyone, including yourself; it is never a no-op. */
function MemberRow({
  display,
  roleLabel,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onViewProfile,
  canKickFromChannel,
  isChannelKickPending,
  onKickFromChannel,
  canKickFromGroup,
  isGroupKickPending,
  onKickFromGroup,
  actions,
}: MemberRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, onCloseMenu]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6 }} onMouseOver={(e) => (e.currentTarget.style.background = '#E2E8F0')} onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div ref={rowRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div onClick={onToggleMenu} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          {display.avatarUrl ? (
            <img src={display.avatarUrl} alt={display.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', fontSize: 13 }}>
              {display.initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#0F172A', fontSize: 14, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display.name}</div>
            {roleLabel && <div style={{ color: '#64748B', fontSize: 12 }}>{roleLabel}</div>}
          </div>
        </div>

        {isMenuOpen && (
          <div
            style={{ position: 'absolute', top: '100%', left: 0, zIndex: 80, background: 'white', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid #E2E8F0', padding: '6px', marginTop: 4, minWidth: 190 }}
          >
            <div
              onClick={() => { onCloseMenu(); onViewProfile(); }}
              style={{ padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#0F172A', cursor: 'pointer' }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#F1F5F9')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <UserCircle2 size={16} color="#475569" /> Xem hồ sơ
            </div>
            {canKickFromChannel && (
              <div
                onClick={() => { onCloseMenu(); onKickFromChannel(); }}
                style={{ padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#DC2626', cursor: 'pointer' }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <UserMinus size={16} color="#DC2626" /> {isChannelKickPending ? 'Đang xóa...' : 'Xóa khỏi kênh'}
              </div>
            )}
            {canKickFromGroup && (
              <div
                onClick={() => { onCloseMenu(); onKickFromGroup(); }}
                style={{ padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#DC2626', cursor: 'pointer' }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={16} color="#DC2626" /> {isGroupKickPending ? 'Đang xóa...' : 'Xóa khỏi nhóm'}
              </div>
            )}
          </div>
        )}
      </div>
      {actions}
    </div>
  );
}

export function GroupMembersPanel({
  members,
  currentUserId,
  currentUser,
  isOwner,
  isGroupManager,
  isPrivateChannel,
  explicitChannelMemberUserIds,
  pendingMemberId,
  channelActionPendingUserId,
  error,
  onPromote,
  onDemote,
  onRemove,
  onKickFromChannel,
  onInviteClick,
}: GroupMembersPanelProps) {
  // At most one row's action menu open at a time (see MemberRow's header comment).
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);

  const memberDisplay = (member: GroupMember) => {
    const isSelf = member.user_id === currentUserId;
    const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(member.user);
    return {
      name,
      initials: isSelf ? currentUser.initials : getAvatarInitials(name),
      color: isSelf ? currentUser.color : getAvatarColor(name),
      avatarUrl: isSelf ? currentUser.avatarUrl : member.user.avatar_url,
    };
  };

  const owners = members.filter((m) => m.role === 'owner');
  const others = members.filter((m) => m.role !== 'owner');

  const rowMenuProps = (member: GroupMember) => {
    const isSelf = member.user_id === currentUserId;
    return {
      isMenuOpen: openMenuUserId === member.user_id,
      onToggleMenu: () => setOpenMenuUserId((prev) => (prev === member.user_id ? null : member.user_id)),
      onCloseMenu: () => setOpenMenuUserId((prev) => (prev === member.user_id ? null : prev)),
      onViewProfile: () => openProfile(member.user_id),
      // "Xóa khỏi kênh": only for an explicit channel_members row -- a manager present purely
      // via fallback access has no row for this endpoint to delete (see the prop doc above).
      canKickFromChannel: isPrivateChannel && !isSelf && isGroupManager && explicitChannelMemberUserIds.has(member.user_id),
      isChannelKickPending: channelActionPendingUserId === member.user_id,
      onKickFromChannel: () => onKickFromChannel(member),
      // "Xóa khỏi nhóm": owner-only (backend: is_group_owner on DELETE /groups/{id}/members/{id}).
      // The owner's own row is structurally never a valid target (there is exactly one owner,
      // and isSelf already excludes it) -- `role !== 'owner'` is defense-in-depth, not load-bearing.
      canKickFromGroup: !isSelf && isOwner && member.role !== 'owner',
      isGroupKickPending: pendingMemberId === member.id,
      onKickFromGroup: () => onRemove(member),
    };
  };

  return (
    <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderLeft: '1px solid #E2E8F0' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div style={{ color: '#0F172A', fontWeight: '700', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
          <Users size={18} color="#00236F" /> Thành viên ({members.length})
        </div>
      </div>

      {error && (
        <div style={{ margin: '12px 16px 0 16px', padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{ color: '#64748B', fontSize: 11, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 }}>Trưởng nhóm</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {owners.map((member) => {
              const display = memberDisplay(member);
              return <MemberRow key={member.id} display={display} roleLabel="Host" {...rowMenuProps(member)} />;
            })}
          </div>
        </div>

        <div>
          <div style={{ color: '#64748B', fontSize: 11, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 }}>Thành viên</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {others.length === 0 && <div style={{ color: '#94A3B8', fontSize: 13, padding: '8px' }}>Chưa có thành viên khác.</div>}
            {others.map((member) => {
              const display = memberDisplay(member);
              const isPending = pendingMemberId === member.id;
              const roleLabel = member.role === 'moderator' ? (isPending ? 'Đang xử lý...' : 'Điều hành viên') : null;
              return (
                <MemberRow
                  key={member.id}
                  display={display}
                  roleLabel={roleLabel}
                  {...rowMenuProps(member)}
                  actions={
                    /* Role changes (promote/demote) are owner-only (backend: is_group_owner
                       on PUT .../role) -- unrelated to the click-menu's kick actions, kept as
                       standalone icon buttons like before. */
                    isOwner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        {member.role === 'member' ? (
                          <button
                            onClick={() => onPromote(member)}
                            disabled={isPending}
                            title="Thăng làm điều hành viên"
                            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: isPending ? 'not-allowed' : 'pointer', color: isPending ? '#CBD5E1' : '#7C3AED' }}
                          >
                            <Shield size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => onDemote(member)}
                            disabled={isPending}
                            title="Hạ xuống thành viên"
                            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: isPending ? 'not-allowed' : 'pointer', color: isPending ? '#CBD5E1' : '#7C3AED' }}
                          >
                            <ShieldOff size={14} />
                          </button>
                        )}
                      </div>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Invite Button -- only an active group owner/moderator may create invitations
          (backend rule, is_group_manager on POST /invitations/); this is UX-only, the
          endpoint independently re-checks the same rule. */}
      {isGroupManager && (
        <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0', background: 'white' }}>
          <button
            onClick={onInviteClick}
            style={{ width: '100%', padding: '10px', background: '#00236F', color: 'white', border: 'none', borderRadius: 6, fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <UserPlus size={18} /> Mời thêm người
          </button>
        </div>
      )}
    </div>
  );
}
