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
