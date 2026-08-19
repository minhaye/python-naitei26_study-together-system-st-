"""QA multi-user seed utility -- DEV/TEST Supabase environments ONLY.

Creates 20 deterministic Supabase Auth users (qa.user01..qa.user20@example.com,
password "12341234" by default), their `profiles` rows, one deterministic QA
Group ("QA Multi User Test Group"), and its memberships:

    qa_user01          -> OWNER
    qa_user02..05       -> MODERATOR
    qa_user06..20       -> MEMBER

Reuses the project's existing canonical write paths -- GroupsService.create
(the DB trigger `groups_add_owner` inserts the owner's membership row; this
script NEVER inserts an owner GroupMember itself, see `verify_owner_membership`
below) and GroupsService.add_member/update_member_role/update_member_status for
everyone else -- rather than hand-rolled INSERT/UPDATE SQL.

Safe to run repeatedly: existing QA auth users/profiles/group/memberships are
detected by their deterministic email/name and reused or reconciled, never
duplicated.

No `environment` flag exists anywhere in this project's Settings/.env -- see
app/core/config.py. Rather than guessing at fragile production-detection
heuristics, this script requires an explicit --confirm-dev flag for any
writing/deleting operation, and always prints the resolved SUPABASE_URL /
DATABASE_URL host up front so you can eyeball it before passing that flag.

Usage:
    python scripts/seed_qa_users.py                          # dry run (default, read-only)
    python scripts/seed_qa_users.py --apply --confirm-dev     # actually create/reconcile
    python scripts/seed_qa_users.py --verify                  # read-only verification checks only
    python scripts/seed_qa_users.py --cleanup --confirm-dev   # delete ONLY QA seed data

The shared password defaults to "12341234" (this is explicitly local/dev-only
QA tooling, per the project owner's request) -- override with --password or
the QA_SEED_PASSWORD env var if your local conventions prefer that.
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    # Default Windows console codepages (e.g. cp1252) can't encode this repo's own path
    # (it contains Vietnamese characters) or the Vietnamese QA group description below.
    for _stream in (sys.stdout, sys.stderr):
        if hasattr(_stream, "reconfigure"):
            _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import httpx  # noqa: E402
from sqlalchemy import select, text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

import app.main  # noqa: E402,F401  Imports every router/service/entity module, which is what
# actually registers every entity class (Channel, StudyRoom, Resource, ...) referenced by
# Group's/Profile's own relationship() string names -- without this, SQLAlchemy fails to
# configure the Group/Profile mappers with "failed to locate a name" the moment any ORM
# query on them runs, since this script otherwise only imports a few entity modules directly
# (mirrors how tests/test_groups.py imports `from app.main import app` for the same reason).
from app.core.config import settings  # noqa: E402
from app.db.enums import GroupMemberRole, MemberStatus  # noqa: E402
from app.db.session import async_session_factory  # noqa: E402
from app.groups.dto.group_dto import GroupCreate  # noqa: E402
from app.groups.entities.group_entity import Group  # noqa: E402
from app.groups.services.group_service import GroupsService  # noqa: E402
from app.profiles.dto.profile_dto import ProfileCreate  # noqa: E402
from app.profiles.entities.profile_entity import Profile  # noqa: E402
from app.profiles.services.profile_service import ProfilesService  # noqa: E402

# --- Deterministic QA identity ----------------------------------------------------

NUM_USERS = 20
OWNER_INDEX = 1
MODERATOR_INDICES = range(2, 6)  # user02..user05
QA_EMAIL_DOMAIN = "example.com"
QA_EMAIL_PREFIX = "qa.user"
QA_USERNAME_PREFIX = "qa_user"
QA_DISPLAY_PREFIX = "QA User"
QA_GROUP_NAME = "QA Multi User Test Group"
QA_GROUP_DESCRIPTION = (
    "Seeded by scripts/seed_qa_users.py for manual Group permission / multi-user QA testing. "
    "Safe to reset via --cleanup."
)
DEFAULT_PASSWORD = "12341234"
DEFAULT_CREDENTIALS_PATH = ROOT_DIR / ".local" / "qa-test-users.json"

groups_service = GroupsService()
profiles_service = ProfilesService()


def qa_email(n: int) -> str:
    return f"{QA_EMAIL_PREFIX}{n:02d}@{QA_EMAIL_DOMAIN}"


def qa_username(n: int) -> str:
    return f"{QA_USERNAME_PREFIX}{n:02d}"


def qa_display_name(n: int) -> str:
    return f"{QA_DISPLAY_PREFIX} {n:02d}"


def qa_role(n: int) -> GroupMemberRole:
    if n == OWNER_INDEX:
        return GroupMemberRole.OWNER
    if n in MODERATOR_INDICES:
        return GroupMemberRole.MODERATOR
    return GroupMemberRole.MEMBER


# --- Supabase Auth Admin API (server-side elevated key only; never exposed) -------


class SupabaseAdminError(Exception):
    pass


class SupabaseAdminClient:
    """Thin wrapper around the Supabase Auth Admin REST API, mirroring the
    httpx + Settings.supabase_server_key pattern already used for Storage admin
    calls (see app/resources/services/resource_storage_service.py). The Admin
    Auth API needs BOTH `apikey` and `Authorization: Bearer <key>` -- unlike
    Storage, which only needs `apikey` for the current secret-key format."""

    def __init__(self) -> None:
        key = settings.supabase_server_key
        if not key:
            raise SupabaseAdminError(
                "No Supabase server-side key configured -- set SUPABASE_SECRET_KEY "
                "(or the legacy SUPABASE_SERVICE_ROLE_KEY) in .env"
            )
        self._base_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin"
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    async def create_user(self, *, email: str, password: str, full_name: str) -> uuid.UUID:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{self._base_url}/users",
                headers=self._headers,
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,  # can log in immediately, no confirmation email sent
                    "user_metadata": {"full_name": full_name},
                },
            )
        if response.status_code not in (200, 201):
            raise SupabaseAdminError(f"Could not create auth user {email}: HTTP {response.status_code} {response.text}")
        return uuid.UUID(response.json()["id"])

    async def delete_user(self, user_id: uuid.UUID) -> None:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.delete(f"{self._base_url}/users/{user_id}", headers=self._headers)
        if response.status_code not in (200, 204, 404):
            raise SupabaseAdminError(f"Could not delete auth user {user_id}: HTTP {response.status_code} {response.text}")


async def find_auth_user_id_by_email(session: AsyncSession, email: str) -> uuid.UUID | None:
    """Raw SQL against auth.users -- same pattern as
    InvitationsService.lookup_user_id_by_email (app/invitations/services/invitation_service.py):
    the connecting role has confirmed read access to auth.users (see
    docs/db/migrations/013_preflight.sql)."""
    result = await session.execute(text("select id from auth.users where lower(email) = :email limit 1"), {"email": email.lower()})
    row = result.first()
    return row[0] if row else None


# --- Seed plan/result bookkeeping --------------------------------------------------


@dataclass
class UserSeedResult:
    index: int
    email: str
    username: str
    display_name: str
    role: GroupMemberRole
    user_id: uuid.UUID | None = None
    auth_status: str = "pending"
    profile_status: str = "pending"
    membership_status: str = "pending"


@dataclass
class SeedResult:
    apply: bool
    users: list[UserSeedResult] = field(default_factory=list)
    group_id: uuid.UUID | None = None
    group_status: str = "pending"
    errors: list[str] = field(default_factory=list)


async def ensure_auth_user(session: AsyncSession, admin: "SupabaseAdminClient | None", u: UserSeedResult, password: str, apply: bool) -> None:
    existing_id = await find_auth_user_id_by_email(session, u.email)
    if existing_id is not None:
        u.user_id = existing_id
        u.auth_status = "exists"
        return
    if not apply:
        u.auth_status = "would_create"
        return
    assert admin is not None
    u.user_id = await admin.create_user(email=u.email, password=password, full_name=u.display_name)
    u.auth_status = "created"


async def ensure_profile(session: AsyncSession, u: UserSeedResult, apply: bool) -> None:
    if u.user_id is None:
        u.profile_status = "skipped (auth user not created yet)"
        return
    profile = await profiles_service.get_by_id(session, u.user_id)
    if profile is not None:
        u.profile_status = "exists"
        return
    if not apply:
        u.profile_status = "would_create"
        return
    await profiles_service.create(session, ProfileCreate(id=u.user_id, username=u.username, display_name=u.display_name))
    u.profile_status = "created"


async def ensure_group(session: AsyncSession, owner_id: uuid.UUID | None, apply: bool) -> tuple[Group | None, str]:
    if owner_id is None:
        return None, "pending (owner not created yet)"
    result = await session.execute(select(Group).where(Group.name == QA_GROUP_NAME, Group.owner_id == owner_id))
    group = result.scalar_one_or_none()
    if group is not None:
        return group, "exists"
    if not apply:
        return None, "would_create"
    # GroupsService.create deliberately does NOT insert the owner's group_members row --
    # the live DB trigger `groups_add_owner` does that unconditionally for every `groups`
    # insert (see GroupsService.create's own docstring). Duplicating that insert here would
    # race the trigger and hit group_members_group_id_user_id_key, exactly the bug this
    # canonical path already exists to avoid.
    group = await groups_service.create(
        session, GroupCreate(name=QA_GROUP_NAME, description=QA_GROUP_DESCRIPTION, is_public=False), owner_id=owner_id
    )
    return group, "created"


async def verify_owner_membership(session: AsyncSession, group: Group | None, owner_id: uuid.UUID | None) -> str:
    """Read-only check that the trigger did its job -- NEVER inserts/updates the owner's
    membership row itself (that would risk the exact duplicate-insert bug this project hit
    before, see GroupsService.create's docstring)."""
    if group is None or owner_id is None:
        return "pending"
    member = await groups_service.get_member(session, group.id, owner_id)
    if member is None:
        return "ERROR: owner membership row missing -- groups_add_owner trigger did not fire as expected"
    issues = []
    if member.role != GroupMemberRole.OWNER:
        issues.append(f"role={member.role.value} (expected owner)")
    if member.status != MemberStatus.ACTIVE:
        issues.append(f"status={member.status.value} (expected active)")
    return "OK" if not issues else "ERROR: " + ", ".join(issues)


async def ensure_membership(session: AsyncSession, group: Group | None, u: UserSeedResult, apply: bool) -> None:
    if group is None or u.user_id is None:
        u.membership_status = "pending (group or user not ready yet)"
        return
    member = await groups_service.get_member(session, group.id, u.user_id)
    if member is None:
        if not apply:
            u.membership_status = f"would_add as {u.role.value}"
            return
        member = await groups_service.add_member(session, group.id, u.user_id)  # always MEMBER/ACTIVE

    changes: list[str] = []
    if member.status != MemberStatus.ACTIVE:
        changes.append(f"status {member.status.value}->active")
        if apply:
            member = await groups_service.update_member_status(session, member, MemberStatus.ACTIVE)
    if member.role != u.role:
        changes.append(f"role {member.role.value}->{u.role.value}")
        if apply:
            member = await groups_service.update_member_role(session, member, u.role)

    if not changes:
        u.membership_status = "exists-correct"
    else:
        u.membership_status = ("would reconcile: " if not apply else "reconciled: ") + ", ".join(changes)


async def run_seed(session: AsyncSession, admin: "SupabaseAdminClient | None", password: str, apply: bool) -> SeedResult:
    result = SeedResult(apply=apply)
    for n in range(1, NUM_USERS + 1):
        u = UserSeedResult(index=n, email=qa_email(n), username=qa_username(n), display_name=qa_display_name(n), role=qa_role(n))
        result.users.append(u)

    owner = result.users[OWNER_INDEX - 1]
    # Owner first -- the group needs owner.user_id to exist/be created before it can be
    # created or looked up.
    await ensure_auth_user(session, admin, owner, password, apply)
    await ensure_profile(session, owner, apply)

    group, group_status = await ensure_group(session, owner.user_id, apply)
    result.group_id = group.id if group else None
    result.group_status = group_status
    owner.membership_status = await verify_owner_membership(session, group, owner.user_id)

    for u in result.users:
        if u.index == OWNER_INDEX:
            continue
        await ensure_auth_user(session, admin, u, password, apply)
        await ensure_profile(session, u, apply)
        await ensure_membership(session, group, u, apply)

    return result


# --- Verification (10-point checklist from the task) -------------------------------


@dataclass
class VerificationReport:
    ok: bool
    lines: list[str]
    counts: dict[str, int]


async def verify_seed(session: AsyncSession) -> VerificationReport:
    lines: list[str] = []
    ok = True

    def check(label: str, passed: bool, detail: str = "") -> None:
        nonlocal ok
        ok = ok and passed
        status = "OK" if passed else "FAIL"
        lines.append(f"[{status}] {label}" + (f" -- {detail}" if detail else ""))

    emails = [qa_email(n) for n in range(1, NUM_USERS + 1)]
    result = await session.execute(text("select id, email from auth.users where lower(email) = any(:emails)"), {"emails": emails})
    auth_rows = result.all()
    check("exactly 20 QA Auth users exist", len(auth_rows) == NUM_USERS, f"found {len(auth_rows)}")
    user_ids = [row[0] for row in auth_rows]

    profile_count = 0
    if user_ids:
        result = await session.execute(select(Profile.id).where(Profile.id.in_(user_ids)))
        profile_count = len(result.scalars().all())
    check("each QA Auth user has a Profile", profile_count == len(user_ids), f"{profile_count}/{len(user_ids)} profiles found")

    result = await session.execute(select(Group).where(Group.name == QA_GROUP_NAME))
    groups = result.scalars().all()
    check("exactly one QA Group exists", len(groups) == 1, f"found {len(groups)}")
    group = groups[0] if len(groups) == 1 else None

    owner_id = None
    if group is not None and user_ids:
        result = await session.execute(text("select id from auth.users where lower(email) = :email"), {"email": qa_email(OWNER_INDEX)})
        row = result.first()
        owner_id = row[0] if row else None
        check("group.owner_id matches QA User 01", group.owner_id == owner_id, f"owner_id={group.owner_id}")

    role_counts = {"owner": 0, "moderator": 0, "member": 0}
    active_count = 0
    total_rows = 0
    if group is not None and user_ids:
        result = await session.execute(
            text("select role, status, count(*) from group_members where group_id = :gid and user_id = any(:uids) group by role, status"),
            {"gid": group.id, "uids": user_ids},
        )
        for role, status, cnt in result.all():
            total_rows += cnt
            if status == MemberStatus.ACTIVE.value:
                active_count += cnt
            role_counts[role] = role_counts.get(role, 0) + (cnt if status == MemberStatus.ACTIVE.value else 0)

    check("all 20 QA users are active Group members", active_count == NUM_USERS, f"{active_count}/{NUM_USERS} active")
    check("exactly one OWNER membership", role_counts.get("owner", 0) == 1, f"found {role_counts.get('owner', 0)}")
    check("exactly four MODERATOR memberships", role_counts.get("moderator", 0) == 4, f"found {role_counts.get('moderator', 0)}")
    check("exactly fifteen MEMBER memberships", role_counts.get("member", 0) == 15, f"found {role_counts.get('member', 0)}")
    check("no duplicate membership rows", total_rows == NUM_USERS, f"{total_rows} membership rows for {NUM_USERS} users")

    if group is not None and owner_id is not None:
        owner_role_check = await session.execute(
            text("select role, status from group_members where group_id = :gid and user_id = :uid"),
            {"gid": group.id, "uid": owner_id},
        )
        owner_row = owner_role_check.first()
        check(
            "owner membership role is OWNER (active)",
            bool(owner_row) and owner_row[0] == GroupMemberRole.OWNER.value and owner_row[1] == MemberStatus.ACTIVE.value,
            f"row={owner_row}",
        )

    counts = {
        "users": len(auth_rows),
        "owners": role_counts.get("owner", 0),
        "moderators": role_counts.get("moderator", 0),
        "members": role_counts.get("member", 0),
    }
    return VerificationReport(ok=ok, lines=lines, counts=counts)


# --- Cleanup (narrowly scoped: only records matching the deterministic QA markers) -


async def run_cleanup(session: AsyncSession, admin: SupabaseAdminClient) -> list[str]:
    log: list[str] = []
    emails = [qa_email(n) for n in range(1, NUM_USERS + 1)]

    result = await session.execute(text("select id from auth.users where lower(email) = :email"), {"email": qa_email(OWNER_INDEX)})
    owner_row = result.first()
    owner_id = owner_row[0] if owner_row else None

    if owner_id is not None:
        result = await session.execute(select(Group).where(Group.name == QA_GROUP_NAME, Group.owner_id == owner_id))
        group = result.scalar_one_or_none()
        if group is not None:
            # GroupMember.group_id has ondelete="CASCADE" (see app/groups/entities/group_entity.py)
            # -- deleting the Group row is enough to remove every membership row with it.
            await session.delete(group)
            await session.flush()
            log.append(f"Deleted QA Group {group.id} ({QA_GROUP_NAME}) and its memberships")
        else:
            log.append("No QA Group found to delete")
    else:
        log.append("QA owner (qa_user01) not found -- skipping Group lookup/delete")

    result = await session.execute(text("select id, email from auth.users where lower(email) = any(:emails)"), {"emails": emails})
    auth_rows = result.all()

    for row in auth_rows:
        user_id, email = row[0], row[1]
        profile = await profiles_service.get_by_id(session, user_id)
        if profile is not None:
            await profiles_service.delete(session, profile)
            log.append(f"Deleted profile for {email}")

    await session.flush()
    await session.commit()

    for row in auth_rows:
        user_id, email = row[0], row[1]
        await admin.delete_user(user_id)
        log.append(f"Deleted auth user {email}")

    return log


# --- Credentials file ---------------------------------------------------------------


def write_credentials_file(result: SeedResult, path: Path, password: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "group": {"id": str(result.group_id) if result.group_id else None, "name": QA_GROUP_NAME},
        "password": password,
        "users": [
            {"email": u.email, "password": password, "role": u.role.value}
            for u in result.users
        ],
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# --- CLI / orchestration -------------------------------------------------------------


def print_target_banner() -> None:
    db_host = settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url
    print("=" * 78)
    print("QA seed utility -- DEV/TEST Supabase environments ONLY. Never point this at production.")
    print(f"  SUPABASE_URL : {settings.supabase_url}")
    print(f"  DATABASE_URL : ...@{db_host}")
    print("=" * 78)


def abort(message: str) -> None:
    print(f"\nABORTED: {message}\n", file=sys.stderr)
    sys.exit(1)


def print_plan(result: SeedResult) -> None:
    print("\nDry run -- no writes performed. Re-run with --apply --confirm-dev to execute this plan.\n")
    print(f"Group '{QA_GROUP_NAME}': {result.group_status}")
    for u in result.users:
        print(f"  user{u.index:02d} {u.email:<28} role={u.role.value:<9} auth={u.auth_status:<14} profile={u.profile_status:<14} membership={u.membership_status}")


def print_apply_summary(result: SeedResult, verification: VerificationReport, credentials_path: Path) -> None:
    print("\nQA seed complete\n" if verification.ok else "\nQA seed finished WITH VERIFICATION FAILURES\n")
    print("Group:")
    print(f"  {QA_GROUP_NAME}  ({result.group_id})\n")
    print(f"Users:       {verification.counts['users']}")
    print(f"Owners:      {verification.counts['owners']}")
    print(f"Moderators:  {verification.counts['moderators']}")
    print(f"Members:     {verification.counts['members']}\n")
    print("Verification:")
    for line in verification.lines:
        print(f"  {line}")
    print(f"\nCredentials:\n  {credentials_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="Actually create/reconcile QA data (default: dry run).")
    parser.add_argument("--cleanup", action="store_true", help="Delete ONLY QA seed data (matching the deterministic qa.userNN@example.com / QA Group markers).")
    parser.add_argument("--verify", action="store_true", help="Run the read-only verification checklist only; no writes.")
    parser.add_argument(
        "--confirm-dev", action="store_true",
        help="Required together with --apply/--cleanup: explicit confirmation that SUPABASE_URL/DATABASE_URL "
             "(printed above) point at a dev/test project, not production. This project has no automated "
             "environment marker to check instead.",
    )
    parser.add_argument("--password", default=os.environ.get("QA_SEED_PASSWORD", DEFAULT_PASSWORD), help="Shared password for all QA users (default: 12341234; override via --password or QA_SEED_PASSWORD).")
    parser.add_argument("--credentials-path", default=str(DEFAULT_CREDENTIALS_PATH), help=f"Where to write the local credentials JSON (default: {DEFAULT_CREDENTIALS_PATH}).")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    print_target_banner()

    if args.cleanup:
        if not args.confirm_dev:
            abort("Refusing to --cleanup without --confirm-dev. Re-run with --cleanup --confirm-dev once you've verified the target above.")
        admin = SupabaseAdminClient()
        async with async_session_factory() as session:
            log = await run_cleanup(session, admin)
        print("\nCleanup complete:")
        for line in log:
            print(f"  {line}")
        return

    if args.verify and not args.apply:
        async with async_session_factory() as session:
            verification = await verify_seed(session)
        print()
        for line in verification.lines:
            print(line)
        print("\nAll checks passed." if verification.ok else "\nSome checks FAILED -- see above.")
        return

    if args.apply and not args.confirm_dev:
        abort("Refusing to --apply without --confirm-dev. Re-run with --apply --confirm-dev once you've verified the target above.")

    admin = SupabaseAdminClient() if args.apply else None
    async with async_session_factory() as session:
        try:
            result = await run_seed(session, admin, args.password, args.apply)
            if args.apply:
                await session.commit()
            else:
                await session.rollback()
        except Exception:
            await session.rollback()
            raise

        if not args.apply:
            print_plan(result)
            return

        verification = await verify_seed(session)

    credentials_path = Path(args.credentials_path)
    write_credentials_file(result, credentials_path, args.password)
    print_apply_summary(result, verification, credentials_path)
    if not verification.ok:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
