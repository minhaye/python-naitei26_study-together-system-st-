# Invitations — architecture and lifecycle

Real, backend-authoritative invitation system for Group / Study Room / Private Channel,
replacing the previous fake "copy invite link" button (`alert('Đã sao chép liên kết mời
tham gia nhóm học!')`, no backend involvement). Backend: `app/invitations/`. Migration:
`docs/db/migrations/013_create_invitations.sql` — **applied live and verified 2026-08-18**
(see `docs/db/migrations/README.md`'s "Running 013" section for the live verify results).

## Model

One `invitations` table, one row per invitation. Exactly one of `group_id` / `room_id` /
`channel_id` is set (DB CHECK) — the target's type is derived from which FK is populated,
never a separate unchecked `target_type` string.

```
id               uuid PK
group_id         uuid NULL FK groups(id) ON DELETE CASCADE
room_id          uuid NULL FK study_rooms(id) ON DELETE CASCADE
channel_id       uuid NULL FK channels(id) ON DELETE CASCADE
method           'email' | 'code'
status           'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
created_by       uuid FK profiles(id)   -- always the authenticated caller
recipient_email  text NULL              -- required iff method='email'
secret_hash      text UNIQUE            -- sha256 of the plaintext token/code; plaintext
                                         -- is never persisted, returned exactly once
expires_at       timestamptz
accepted_at / declined_at / revoked_at  timestamptz NULL
created_at       timestamptz
```

`expired` is never written by a background job — it's derived at read time
(`status='pending' AND expires_at < now()`); the atomic redemption UPDATE's own
`WHERE status='pending' AND expires_at > now()` guard rejects an expired row naturally.
There is no separate "used" flag: single-use is enforced by `status` leaving `pending` on
the first successful redemption (see Concurrency below).

`notifications` gained a nullable `invitation_id` FK and two new `notification_type`
values (`study_room_invitation`, `private_channel_invitation`); the existing (previously
unused) `group_invite` value is reused for Group invitations.

## Lifecycle / state machine

```
                 create
                   │
                   ▼
               ┌─────────┐
     ┌────────▶│ pending │────────┐
     │         └────┬────┘        │
     │              │             │
  (read-time,   redeem (atomic  revoke (manager)
   never          UPDATE ...      │
   written)     WHERE status=     ▼
     │           'pending')   ┌─────────┐
     ▼              │         │ revoked │
 ┌─────────┐        │         └─────────┘
 │ expired │        ▼
 └─────────┘   ┌──────────┐        decline (email
                │ accepted │        recipient only)
                └──────────┘             │
                                          ▼
                                    ┌──────────┐
                                    │ declined │
                                    └──────────┘
```

`accepted` / `declined` / `revoked` are all terminal. `expired` is terminal in effect
(the redemption guard excludes it) without ever being written.

## Two methods, two different trust models

- **EMAIL**: `recipient_email` is set at creation. Redemption (and decline) require the
  authenticated caller's **verified JWT email claim** (`CurrentUser.email`, never a
  client-supplied value — `profiles` has no email column at all) to match
  `recipient_email`. A different account can never redeem someone else's email invite even
  if they somehow obtain the link/token. TTL defaults to 7 days
  (`INVITATION_EMAIL_TTL_SECONDS`, since it's checked whenever the recipient next opens
  their inbox, not redeemed live).
- **CODE**: no recipient binding by design — the code itself (delivered out-of-band by the
  inviter, e.g. read aloud or pasted in chat) is the sole credential. TTL defaults to 5
  minutes (`INVITATION_CODE_TTL_SECONDS`). At most one active CODE invitation exists per
  target at any time: generating a new code atomically revokes any other still-pending CODE
  invitation for the same target in the same transaction (see `InvitationsService.create`
  → `revoke_pending_codes_for_target`). There is nothing to "reuse" for an idempotent modal
  reopen, because only `secret_hash` is ever persisted — the plaintext code cannot be
  re-shown once the response that created it is gone.

Codes are generated with `secrets.choice` from an unambiguous alphabet (no `0/O/1/I/L`),
formatted `XXXX-XXXX`. Email tokens are `secrets.token_urlsafe(32)`. Both are hashed with
SHA-256 before storage (`Invitation.secret_hash`); resolution/redemption always hashes the
supplied secret and looks up by hash, never by plaintext comparison.

## Recipient security / account-existence privacy

Creating an EMAIL invitation always "succeeds" (email is sent, invitation row created)
regardless of whether the address belongs to an existing account. Whether an in-app
`Notification` is *also* created depends on a lookup against `auth.users` (raw SQL — the
`public.profiles` table has no email column; `auth.users` lives in the same Postgres
database) — that lookup's result is never returned to the API caller, so this feature adds
no new way to enumerate which emails have accounts.

## Canonical join behavior — orchestration, not duplication

Redemption never inserts a membership row directly. `invitation_router._join_target`
dispatches to the same canonical service methods the existing membership endpoints already
use:

- **GROUP** → `GroupsService.get_member` / `add_member` / **`reactivate_member`** (new
  method, mirrors `StudyRoomsService.rejoin` — added because `GroupsService` had no
  reactivation path at all before this feature; the pre-existing manual
  `POST /groups/{id}/members` endpoint is untouched and still 400s on any existing row,
  active or not — that's a separate, pre-existing gap, not fixed here). Already-active →
  idempotent no-op (`outcome: "already_member"`). `banned` → 403, invitation not consumed.
- **STUDY_ROOM** → `StudyRoomsService.get_member` / `join` / `rejoin`, exactly as
  `study_room_router.join_room` already does. `can_join_room` (ended/deleted lifecycle
  gate) still applies.
- **PRIVATE_CHANNEL** → `ChannelsService.get_member` / `add_member`, exactly as
  `channel_router.add_member` already does.

**Study Room and Private Channel invitations never bypass Group membership.** Before any
redemption is attempted, `is_active_group_member(group_id, caller)` is checked
(`app/core/permissions.py`, unchanged). If false, the invitation is **not consumed** and the
Group is **not auto-joined** — the endpoint returns `outcome: "group_membership_required"`
with the target's `group_id`/`group_name` so the frontend can guide the user there. This
mirrors the same Python/RLS parity already enforced for `can_access_room`/
`can_access_channel` (a stale `channel_members`/`study_room_members` row cannot outlive
lost Group membership).

## Authorization

Creation and revocation of an invitation for any target (Group, Study Room, or Private
Channel) require `is_group_manager` (active owner/moderator) on the target's **actual**
`group_id`, resolved server-side from the target row — never trusted from the request body.
Conservative by design: normal members never gain invitation-management power. `host_id` on
a Study Room is never treated as an authorization grant (matches the rest of this codebase's
2026-08-18 policy).

## Concurrency / integrity

Accept/decline/revoke are each a single guarded `UPDATE ... WHERE status='pending' [AND
expires_at > now()] RETURNING`, executed in the same transaction as the downstream
membership join and committed together. Two concurrent redemption attempts on the same
invitation cannot both succeed: the second UPDATE re-evaluates its `WHERE` clause against
the row the first already committed/locked, matches zero rows, and the endpoint returns 409.
If the downstream membership join raises, the whole transaction (including the status
UPDATE) rolls back, so a failed join never leaves an invitation stuck in `accepted`.

## Notifications

`app/notifications/routers/notification_router.py`'s public `POST /notifications/` endpoint
was **removed** as part of this feature (pre-existing security gap discovered during audit:
no auth at all, any caller could set an arbitrary `user_id`/`actor_id`). Auditing found no
legitimate client for it — `NotificationsService` is now only ever called in-process by
trusted server-side code (`InvitationsService`/`invitation_router`). `GET/PUT/DELETE` are
now authenticated and hard-scoped to the caller's own `user_id`.

Invitation notifications reference the invitation (`Notification.invitation_id`) rather than
duplicating its target/status. The frontend's "Pending Invitations" bell
(`GET /invitations/incoming`, scoped server-side to the caller's verified email) and the
notification's Accept/Decline actions always call the invitation redemption/decline
endpoints — never write membership directly.

## RLS

`invitations` gets RLS enabled from scratch: a single SELECT-own policy (creator, or the
caller's verified JWT email matching `recipient_email`) and no write policy for
`authenticated` — FastAPI (the `postgres` role, bypasses RLS entirely — see
`docs/db/migrations/004...`'s header) is the sole writer, matching the `messages`/`channels`
precedent already established in this repo.

`notifications` was **not** actually wide-open before this migration, despite my initial
audit assumption. `013_preflight.sql`, run live before applying the migration, found RLS
already enabled with three existing policies never captured in any migration file in this
repo before now: `notifications_select_own` (SELECT), `notifications_update_own` (UPDATE),
`notifications_delete_own` (DELETE) — the same "discovered live, never tracked" situation
010 hit for `study_rooms`. The UPDATE/DELETE policies let an authenticated user mutate their
own notifications directly via PostgREST/Supabase client, bypassing FastAPI entirely — a
second, undocumented authorization surface alongside the FastAPI owner-check this feature
already added to `notification_router.py`. Migration 013 keeps the SELECT-own policy as-is
and **explicitly drops** the UPDATE and DELETE policies, so `notifications` now matches
`invitations`/`messages`/`channels`: FastAPI-only writes, RLS is read-only defense-in-depth
for `authenticated`. Nothing in this repo's frontend or backend was found to depend on the
direct-write path being removed. See `013_preflight.sql`'s output for the exact bodies of
the two dropped policies (captured for the record before removal). `013_verify.sql`
confirmed live (2026-08-18): `notifications_select_own` present with unchanged semantics,
`notifications_update_own`/`notifications_delete_own` both absent, no authenticated write
policy remains on `invitations` or `notifications`.

New RLS helper functions in this migration take no caller-supplied `p_user_id` parameter
(they use `auth.uid()`/`auth.jwt()` directly), following this repo's stated convention of
avoiding arbitrary-user-parameterized RLS functions (see 004 §7's comment on the older,
now-deprecated pattern).

## Environment variables

```
INVITATION_CODE_TTL_SECONDS=300        # default 5 minutes
INVITATION_EMAIL_TTL_SECONDS=604800    # default 7 days
FRONTEND_BASE_URL=http://localhost:5173  # used to build the /invitations/<token> email link

SMTP_HOST=          # unset => ConsoleEmailService logs the email instead of sending it
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=true
EMAIL_FROM_ADDRESS=
```

No new Python dependency: `SmtpEmailService` uses the stdlib `smtplib`/`email.message` and
works with any provider exposing a plain SMTP endpoint (Gmail, SendGrid SMTP relay,
Mailgun, Postmark, ...). For production, set `SMTP_HOST` (and the rest) to a real provider;
until then, invitation emails are logged to the server console
(`app/core/email_service.py`), which keeps the feature fully usable/testable without one.

## Frontend

- `frontend/src/components/invitations/InviteModal.tsx` — reusable Email/Code tabbed modal,
  used from the Group page (replaces the old fake button), Study Room page, and Private
  Channel context menu (private channels only — public channels don't need an invite, access
  is automatic for active Group members).
- `frontend/src/pages/invitations/InvitationPreviewPage.tsx`, route `/invitations/:secret`
  (public, unauthenticated preview; Accept/Decline require login) — the email-link
  destination.
- Join-by-code entry point on the Groups list page (previously a disabled placeholder
  explicitly noting "no authenticated self-join endpoint yet" — now wired to the real
  resolve/redeem flow).
- `frontend/src/components/invitations/PendingInvitationsBell.tsx` — wires the previously
  decorative header Bell icon to `GET /invitations/incoming`, scoped strictly to
  invitations (not a general notification center — out of scope for this feature).

## Known limitations / follow-ups (not fixed as part of this feature)

- `GroupsService`/`group_router.add_member` still has no reactivation path for the *manual*
  join/add flow (only the new invitation-redemption path can reactivate a `left` member) —
  a left member still cannot rejoin a public group by any means other than an invitation.
- `study_room_members`/`channel_members` capacity limits (`max_participants`) are not
  enforced anywhere in this codebase, including invitation redemption — pre-existing gap,
  out of scope here.
