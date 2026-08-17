/** Mirrors app/db/enums.py */
export type ChannelType = 'text';

/** Mirrors ChannelResponse (app/channels/dto/channel_dto.py) */
export interface Channel {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  type: ChannelType;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  conversation_id: string | null;
}

/** Mirrors ChannelCreate. No `created_by` field: attribution always comes from the
 * authenticated caller, never client-supplied. `type` is omitted here -- ChannelType
 * has exactly one valid value ('text'), so there is nothing for the UI to select; the
 * backend default applies. */
export interface ChannelCreate {
  group_id: string;
  name: string;
  description?: string | null;
  is_private?: boolean;
}
