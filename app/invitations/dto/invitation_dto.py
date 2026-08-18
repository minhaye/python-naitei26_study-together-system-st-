import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.db.enums import InvitationMethod, InvitationStatus

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InvitationCreate(BaseModel):
    """No `created_by` field: attribution always comes from the authenticated caller
    (see invitation_router.create_invitation), never client-supplied. Exactly one of
    group_id/room_id/channel_id must be set; recipient_email is required iff
    method == EMAIL (and ignored/must be absent for CODE).

    Deliberately a plain `str` (not pydantic's EmailStr) -- that requires the optional
    `email-validator` package, which isn't a project dependency; a lightweight regex is
    enough for a well-formedness check, with normalization (strip/lowercase) done here."""

    group_id: uuid.UUID | None = None
    room_id: uuid.UUID | None = None
    channel_id: uuid.UUID | None = None
    method: InvitationMethod
    recipient_email: str | None = None

    @model_validator(mode="after")
    def _validate_shape(self) -> "InvitationCreate":
        targets = [self.group_id, self.room_id, self.channel_id]
        if sum(t is not None for t in targets) != 1:
            raise ValueError("Exactly one of group_id, room_id, channel_id must be provided")
        if self.method == InvitationMethod.EMAIL:
            if self.recipient_email is None:
                raise ValueError("recipient_email is required for EMAIL invitations")
            normalized = self.recipient_email.strip().lower()
            if not _EMAIL_RE.match(normalized):
                raise ValueError("recipient_email is not a valid email address")
            self.recipient_email = normalized
        elif self.recipient_email is not None:
            raise ValueError("recipient_email must not be set for CODE invitations")
        return self


class InvitationResponse(BaseModel):
    """Never includes secret_hash or the plaintext secret -- see InvitationCreated for the
    one-time plaintext-on-creation exception."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID | None
    room_id: uuid.UUID | None
    channel_id: uuid.UUID | None
    method: InvitationMethod
    status: InvitationStatus
    created_by: uuid.UUID
    recipient_email: str | None
    expires_at: datetime
    accepted_at: datetime | None
    declined_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class InvitationCreated(InvitationResponse):
    """Response for POST /invitations. `code` is populated only for method=CODE -- the
    plaintext is never persisted (see Invitation.secret_hash) and this is the only moment
    it is ever returned. EMAIL invitations never return their token here; it only ever
    reaches the recipient via the emailed link."""

    code: str | None = None


class ActiveCodeInfo(BaseModel):
    """Metadata-only view of a target's current pending CODE invitation, used by the Invite
    modal to render "a code is currently active" state without ever re-exposing (or being
    able to re-derive) the plaintext code."""

    id: uuid.UUID
    expires_at: datetime


class InvitationTarget(BaseModel):
    type: str  # "group" | "study_room" | "private_channel"
    id: uuid.UUID
    name: str
    group_id: uuid.UUID
    group_name: str


class InvitationPreview(BaseModel):
    """Safe fields only, for the public (optionally-authenticated) resolve endpoint --
    never reveals recipient_email, secret_hash, or which specific error applies to an
    invalid secret (expired vs revoked vs already-used vs unknown all look identical).
    `id` is included so the frontend preview page can call POST /invitations/{id}/decline
    without needing the secret again -- the invitation's own id is opaque and harmless to
    expose (unlike secret_hash, it doesn't grant redemption on its own)."""

    id: uuid.UUID
    target: InvitationTarget
    inviter_name: str
    method: InvitationMethod
    expires_at: datetime


class InvitationRedeemResult(BaseModel):
    """`outcome` distinguishes legitimate resolved states the frontend renders normally --
    none of these are error responses. Actual invalid/expired/wrong-recipient cases are
    raised as HTTP errors instead (see invitation_router.redeem_invitation)."""

    outcome: str  # "joined" | "reactivated" | "already_member" | "group_membership_required"
    target: InvitationTarget
