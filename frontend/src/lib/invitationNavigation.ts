import type { InvitationTarget, InvitationTargetType } from './invitation.types';

/** Canonical post-redemption navigation target -- resolved entirely from the backend's
 * `target` (never a frontend-constructed id). Shared by JoinByCodeModal,
 * InvitationPreviewPage, and PendingInvitationsBell so this mapping only exists once. */
export function targetRoute(target: InvitationTarget): string {
  if (target.type === 'group') return `/groups/${target.id}`;
  if (target.type === 'study_room') return `/room/${target.id}`;
  // private_channel: channels render inline inside their parent Group's page -- there is no
  // dedicated channel route.
  return `/groups/${target.group_id}`;
}

export const TARGET_TYPE_LABEL: Record<InvitationTargetType, string> = {
  group: 'Nhóm học',
  study_room: 'Phòng học',
  private_channel: 'Kênh riêng tư',
};

export const JOIN_ACTION_LABEL: Record<InvitationTargetType, string> = {
  group: 'Tham gia Nhóm học',
  study_room: 'Tham gia Phòng học',
  private_channel: 'Tham gia Kênh riêng tư',
};
