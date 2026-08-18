import hashlib
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.enums import InvitationMethod, InvitationStatus
from app.invitations.entities.invitation_entity import Invitation

# Unambiguous alphabet: no 0/O/1/I/L, so a human reading a code aloud/by hand can't confuse
# characters. 8 chars formatted XXXX-XXXX, generated with `secrets` (CSPRNG), never a
# predictable/sequential value.
_CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1IL")


class InvitationsService:
    """Thin data layer, mirrors GroupsService/ChannelsService/StudyRoomsService --
    authorization, eligibility, and cross-domain orchestration (which canonical
    GroupMembershipService/StudyRoomsService/ChannelsService join call to make) live in
    invitation_router.py, same convention as every other router in this codebase."""

    def generate_code(self) -> str:
        chars = [secrets.choice(_CODE_ALPHABET) for _ in range(8)]
        return f"{''.join(chars[:4])}-{''.join(chars[4:])}"

    def generate_token(self) -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def hash_secret(secret: str) -> str:
        return hashlib.sha256(secret.encode("utf-8")).hexdigest()

    @staticmethod
    def _target_conditions(group_id: uuid.UUID | None, room_id: uuid.UUID | None, channel_id: uuid.UUID | None):
        if group_id is not None:
            return [Invitation.group_id == group_id]
        if room_id is not None:
            return [Invitation.room_id == room_id]
        return [Invitation.channel_id == channel_id]

    async def get_by_id(self, session: AsyncSession, invitation_id: uuid.UUID) -> Invitation | None:
        return await session.get(Invitation, invitation_id)

    async def get_by_secret(self, session: AsyncSession, secret: str) -> Invitation | None:
        result = await session.execute(select(Invitation).where(Invitation.secret_hash == self.hash_secret(secret)))
        return result.scalar_one_or_none()

    async def revoke_pending_codes_for_target(
        self,
        session: AsyncSession,
        group_id: uuid.UUID | None,
        room_id: uuid.UUID | None,
        channel_id: uuid.UUID | None,
    ) -> None:
        """Enforces "at most one active CODE invitation per target": called before inserting
        a new CODE invitation, in the same transaction/commit as that insert."""
        now = datetime.now(timezone.utc)
        conditions = [
            Invitation.method == InvitationMethod.CODE,
            Invitation.status == InvitationStatus.PENDING,
            *self._target_conditions(group_id, room_id, channel_id),
        ]
        await session.execute(
            update(Invitation).where(*conditions).values(status=InvitationStatus.REVOKED, revoked_at=now)
        )

    async def create(
        self,
        session: AsyncSession,
        *,
        group_id: uuid.UUID | None,
        room_id: uuid.UUID | None,
        channel_id: uuid.UUID | None,
        method: InvitationMethod,
        created_by: uuid.UUID,
        recipient_email: str | None,
    ) -> tuple[Invitation, str]:
        """Returns (invitation, plaintext_secret) -- the plaintext is never persisted (see
        Invitation.secret_hash) and this is the only place it's ever available. Caller
        (router) must already have authorized this creation and validated the target."""
        if method == InvitationMethod.CODE:
            await self.revoke_pending_codes_for_target(session, group_id, room_id, channel_id)
            secret = self.generate_code()
            ttl_seconds = settings.invitation_code_ttl_seconds
        else:
            secret = self.generate_token()
            ttl_seconds = settings.invitation_email_ttl_seconds

        invitation = Invitation(
            group_id=group_id,
            room_id=room_id,
            channel_id=channel_id,
            method=method,
            created_by=created_by,
            recipient_email=recipient_email,
            secret_hash=self.hash_secret(secret),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        )
        session.add(invitation)
        await session.flush()
        return invitation, secret

    async def get_active_code_for_target(
        self,
        session: AsyncSession,
        *,
        group_id: uuid.UUID | None,
        room_id: uuid.UUID | None,
        channel_id: uuid.UUID | None,
    ) -> Invitation | None:
        now = datetime.now(timezone.utc)
        conditions = [
            Invitation.method == InvitationMethod.CODE,
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > now,
            *self._target_conditions(group_id, room_id, channel_id),
        ]
        result = await session.execute(select(Invitation).where(*conditions).order_by(Invitation.created_at.desc()))
        return result.scalars().first()

    async def list_incoming(self, session: AsyncSession, email: str) -> list[Invitation]:
        now = datetime.now(timezone.utc)
        result = await session.execute(
            select(Invitation)
            .where(
                Invitation.method == InvitationMethod.EMAIL,
                Invitation.status == InvitationStatus.PENDING,
                Invitation.expires_at > now,
                Invitation.recipient_email == email,
            )
            .order_by(Invitation.created_at.desc())
        )
        return list(result.scalars().all())

    async def try_accept(self, session: AsyncSession, invitation_id: uuid.UUID) -> bool:
        """Atomic pending(+unexpired)->accepted transition. False means the row was not
        matched at the moment of this UPDATE -- already consumed/expired/revoked, or a
        concurrent redemption won the race -- the caller must NOT perform the membership
        join if this returns False. Single guarded UPDATE, no separate SELECT+INSERT, so two
        concurrent redemptions cannot both succeed (the second's WHERE re-evaluates against
        the first's already-committed/locked row)."""
        now = datetime.now(timezone.utc)
        result = await session.execute(
            update(Invitation)
            .where(
                Invitation.id == invitation_id,
                Invitation.status == InvitationStatus.PENDING,
                Invitation.expires_at > now,
            )
            .values(status=InvitationStatus.ACCEPTED, accepted_at=now)
        )
        return result.rowcount == 1

    async def try_decline(self, session: AsyncSession, invitation_id: uuid.UUID) -> bool:
        now = datetime.now(timezone.utc)
        result = await session.execute(
            update(Invitation)
            .where(Invitation.id == invitation_id, Invitation.status == InvitationStatus.PENDING)
            .values(status=InvitationStatus.DECLINED, declined_at=now)
        )
        return result.rowcount == 1

    async def try_revoke(self, session: AsyncSession, invitation_id: uuid.UUID) -> bool:
        now = datetime.now(timezone.utc)
        result = await session.execute(
            update(Invitation)
            .where(Invitation.id == invitation_id, Invitation.status == InvitationStatus.PENDING)
            .values(status=InvitationStatus.REVOKED, revoked_at=now)
        )
        return result.rowcount == 1

    def is_pending_and_unexpired(self, invitation: Invitation) -> bool:
        return invitation.status == InvitationStatus.PENDING and invitation.expires_at > datetime.now(timezone.utc)

    async def lookup_user_id_by_email(self, session: AsyncSession, email: str) -> uuid.UUID | None:
        """Raw SQL against auth.users -- Supabase's auth schema lives in the same Postgres
        database as public.*, and `profiles` has no email column to join on. Used only to
        decide whether to also create an in-app Notification at invitation-creation time;
        the result is never returned to the API caller, so this cannot be used to probe
        account existence through this feature."""
        result = await session.execute(
            text("select id from auth.users where lower(email) = :email limit 1"), {"email": email}
        )
        row = result.first()
        return row[0] if row else None
