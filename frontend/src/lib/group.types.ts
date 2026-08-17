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

/** Mirrors GroupMemberResponse */
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: MemberStatus;
  joined_at: string;
}
