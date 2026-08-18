/** Mirrors app/db/enums.py */
export type InvitationMethod = 'email' | 'code';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
export type InvitationTargetType = 'group' | 'study_room' | 'private_channel';

/** One of groupId/roomId/channelId identifies what's being invited to. */
export interface InvitationTargetRef {
  groupId?: string;
  roomId?: string;
  channelId?: string;
}

/** Mirrors InvitationCreate (app/invitations/dto/invitation_dto.py). No created_by field --
 * the backend always derives the inviter from the bearer token. */
export interface InvitationCreateRequest {
  group_id?: string;
  room_id?: string;
  channel_id?: string;
  method: InvitationMethod;
  recipient_email?: string;
}

/** Mirrors InvitationResponse. Never includes the plaintext secret. */
export interface Invitation {
  id: string;
  group_id: string | null;
  room_id: string | null;
  channel_id: string | null;
  method: InvitationMethod;
  status: InvitationStatus;
  created_by: string;
  recipient_email: string | null;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** Mirrors InvitationCreated -- `code` is populated only for method="code", and only in
 * this one response; it's never retrievable again afterward. */
export interface InvitationCreated extends Invitation {
  code: string | null;
}

/** Mirrors ActiveCodeInfo -- metadata only, never the plaintext code. */
export interface ActiveCodeInfo {
  id: string;
  expires_at: string;
}

/** Mirrors InvitationTarget. */
export interface InvitationTarget {
  type: InvitationTargetType;
  id: string;
  name: string;
  group_id: string;
  group_name: string;
}

/** Mirrors InvitationPreview -- safe fields only, returned by the public resolve endpoint.
 * `id` is opaque and harmless to expose (unlike the secret, it doesn't grant redemption on
 * its own) -- included so the preview page can call declineInvitation(id) without needing
 * the secret again. */
export interface InvitationPreview {
  id: string;
  target: InvitationTarget;
  inviter_name: string;
  method: InvitationMethod;
  expires_at: string;
}

export type InvitationRedeemOutcome = 'joined' | 'reactivated' | 'already_member' | 'group_membership_required';

/** Mirrors InvitationRedeemResult. */
export interface InvitationRedeemResult {
  outcome: InvitationRedeemOutcome;
  target: InvitationTarget;
}
