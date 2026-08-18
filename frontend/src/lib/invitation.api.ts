import { apiClient } from './apiClient';
import type {
  ActiveCodeInfo,
  Invitation,
  InvitationCreated,
  InvitationMethod,
  InvitationPreview,
  InvitationRedeemResult,
  InvitationTargetRef,
} from './invitation.types';

function toTargetFields(target: InvitationTargetRef): { group_id?: string; room_id?: string; channel_id?: string } {
  return { group_id: target.groupId, room_id: target.roomId, channel_id: target.channelId };
}

/** Manager-only; caller authority is enforced server-side (is_group_manager on the
 * target's group). For method="code" the plaintext code is only ever present in this one
 * response -- it cannot be retrieved again afterward. */
export function createInvitation(
  target: InvitationTargetRef,
  method: InvitationMethod,
  recipientEmail?: string
): Promise<InvitationCreated> {
  return apiClient.post<InvitationCreated>('/invitations/', {
    ...toTargetFields(target),
    method,
    recipient_email: recipientEmail,
  });
}

/** Public preview by secret (token from an email link, or a manually-typed code) -- no auth
 * required, so an unauthenticated recipient can see who invited them before logging in. */
export function resolveInvitation(secret: string): Promise<InvitationPreview> {
  return apiClient.get<InvitationPreview>(`/invitations/resolve/${encodeURIComponent(secret)}`);
}

/** Requires auth. Recipient binding (for email invitations) and the Study Room/Private
 * Channel Group-membership prerequisite are both enforced server-side -- this call never
 * trusts a target id from the client, the server resolves it from the secret. */
export function redeemInvitation(secret: string): Promise<InvitationRedeemResult> {
  return apiClient.post<InvitationRedeemResult>(`/invitations/redeem/${encodeURIComponent(secret)}`);
}

/** Id-based redemption for the in-app notification's Join button, where the frontend never
 * has the plaintext secret. EMAIL invitations only -- same recipient binding as
 * redeemInvitation, enforced server-side; CODE invitations cannot be redeemed this way. */
export function redeemInvitationById(invitationId: string): Promise<InvitationRedeemResult> {
  return apiClient.post<InvitationRedeemResult>(`/invitations/${invitationId}/redeem`);
}

export function declineInvitation(invitationId: string): Promise<Invitation> {
  return apiClient.post<Invitation>(`/invitations/${invitationId}/decline`);
}

/** Manager-only. */
export function revokeInvitation(invitationId: string): Promise<Invitation> {
  return apiClient.post<Invitation>(`/invitations/${invitationId}/revoke`);
}

/** The caller's own pending email invitations, scoped server-side to their verified email. */
export function listIncomingInvitations(): Promise<Invitation[]> {
  return apiClient.get<Invitation[]>('/invitations/incoming');
}

function targetQuery(target: InvitationTargetRef): string {
  const params = new URLSearchParams();
  if (target.groupId) params.set('group_id', target.groupId);
  if (target.roomId) params.set('room_id', target.roomId);
  if (target.channelId) params.set('channel_id', target.channelId);
  return params.toString();
}

/** Manager-only. Metadata only (id + expires_at) -- the plaintext code is never stored, so
 * it can't be re-shown here; returns null when no CODE invitation is currently pending for
 * this target. */
export function getActiveCode(target: InvitationTargetRef): Promise<ActiveCodeInfo | null> {
  return apiClient.get<ActiveCodeInfo | null>(`/invitations/active-code?${targetQuery(target)}`);
}
