/** Mirrors UserSummary (app/profiles/dto/profile_dto.py) -- the canonical minimal identity
 * shape embedded in membership/message responses (GroupMember.user, StudyRoomMember.user,
 * ChannelMember.user, Message.sender). Never construct a display label from a raw id/UUID;
 * use getDisplayName() (src/utils/userDisplay.ts) against this shape instead. */
export type ProfileRole = 'user' | 'moderator' | 'admin';

export interface UserSummary {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: ProfileRole;
}

export interface Profile extends UserSummary {
  bio: string | null;
  organization: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  organization?: string | null;
}

export interface ProfileCreate {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  organization?: string | null;
}
