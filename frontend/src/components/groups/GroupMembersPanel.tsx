import { Shield, ShieldOff, Trash2, UserPlus, Users } from 'lucide-react';
import type { GroupMember } from '../../lib/group.types';
import type { AuthUser } from '../../hooks/useAuth';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';
import { getDisplayName } from '../../utils/userDisplay';

export interface GroupMembersPanelProps {
  /** Active group members only -- callers filter by status before passing them in. */
  members: GroupMember[];
  currentUserId: string | null;
  currentUser: AuthUser;
  /** Owner-only: role changes (promote/demote) and removal. Backend independently re-checks
   * this via is_group_owner on PUT .../role and DELETE .../members/{id} -- this prop only
   * controls whether the buttons are shown, never the actual authorization. */
  isOwner: boolean;
  /** Owner or moderator: gates the Invite button (backend: is_group_manager on POST /invitations/). */
  isGroupManager: boolean;
  /** `member.id` of the membership row currently being mutated, or null. Used to disable
   * that row's buttons and prevent duplicate-click mutations. */
  pendingMemberId: string | null;
  error: string | null;
  onPromote: (member: GroupMember) => void;
  onDemote: (member: GroupMember) => void;
  onRemove: (member: GroupMember) => void;
  onInviteClick: () => void;
}

export function GroupMembersPanel({
  members,
  currentUserId,
  currentUser,
  isOwner,
  isGroupManager,
  pendingMemberId,
  error,
  onPromote,
  onDemote,
  onRemove,
  onInviteClick,
}: GroupMembersPanelProps) {
  const memberDisplay = (member: GroupMember) => {
    const isSelf = member.user_id === currentUserId;
    const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(member.user);
    return {
      name,
      initials: isSelf ? currentUser.initials : getAvatarInitials(name),
      color: isSelf ? currentUser.color : getAvatarColor(name),
      avatarUrl: isSelf ? null : member.user.avatar_url,
    };
  };

  const owners = members.filter((m) => m.role === 'owner');
  const others = members.filter((m) => m.role !== 'owner');

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
              return (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'default' }} onMouseOver={(e) => (e.currentTarget.style.background = '#E2E8F0')} onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}>
                  {display.avatarUrl ? (
                    <img src={display.avatarUrl} alt={display.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', fontSize: 13 }}>
                      {display.initials}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#0F172A', fontSize: 14, fontWeight: '600' }}>{display.name}</div>
                    <div style={{ color: '#64748B', fontSize: 12 }}>Host</div>
                  </div>
                </div>
              );
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
              return (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'default' }} onMouseOver={(e) => (e.currentTarget.style.background = '#E2E8F0')} onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}>
                  {display.avatarUrl ? (
                    <img src={display.avatarUrl} alt={display.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', fontSize: 13 }}>
                      {display.initials}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#0F172A', fontSize: 14, fontWeight: '600' }}>{display.name}</div>
                    {member.role === 'moderator' && <div style={{ color: '#7C3AED', fontSize: 12 }}>{isPending ? 'Đang xử lý...' : 'Điều hành viên'}</div>}
                  </div>
                  {/* Role changes and removal are owner-only (backend: is_group_owner on
                      PUT .../role and DELETE .../members/{id}) -- hidden for moderators/members,
                      never the sole authorization boundary. */}
                  {isOwner && (
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
                      <button
                        onClick={() => onRemove(member)}
                        disabled={isPending}
                        title="Xóa khỏi nhóm"
                        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: isPending ? 'not-allowed' : 'pointer', color: isPending ? '#CBD5E1' : '#DC2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
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
