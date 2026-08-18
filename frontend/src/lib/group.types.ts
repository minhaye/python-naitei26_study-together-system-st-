import type { UserSummary } from './profile.types';

/** Mirrors app/db/enums.py */
export type GroupMemberRole = 'owner' | 'moderator' | 'member';
export type MemberStatus = 'active' | 'banned' | 'left';

/** Mirrors GroupResponse (app/groups/dto/group_dto.py) */
export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  invite_code: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors GroupMemberResponse. `user` is the canonical identity source for this member --
 * see src/utils/userDisplay.ts's getDisplayName(), never derive a label from `user_id`. */
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: MemberStatus;
  joined_at: string;
  user: UserSummary;
}

/** Mirrors GroupCreate (app/groups/dto/group_dto.py) — no owner_id: the backend always
 * derives the owner from the authenticated caller. */
export interface GroupCreate {
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  is_public?: boolean;
}

/** Mirrors GroupUpdate. All fields optional; only owner-authorized callers may use this. */
export interface GroupUpdate {
  name?: string;
  description?: string | null;
  avatar_url?: string | null;
  is_public?: boolean;
}

/** Mirrors GroupMemberCreate — omit user_id to self-join as the authenticated caller. */
export interface GroupMemberCreate {
  user_id?: string;
}
