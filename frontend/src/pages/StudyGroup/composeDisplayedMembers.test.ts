import { describe, it, expect } from 'vitest';
import { composeDisplayedMembers } from './StudyGroupDetail';
import type { GroupMember } from '../../lib/group.types';
import type { ChannelMember } from '../../lib/channel.types';

function groupMember(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    id: overrides.id ?? 'gm-1',
    group_id: 'group-1',
    user_id: overrides.user_id ?? 'user-1',
    role: overrides.role ?? 'member',
    status: overrides.status ?? 'active',
    joined_at: new Date().toISOString(),
    user: { id: overrides.user_id ?? 'user-1', username: 'user', display_name: 'User', avatar_url: null, role: 'user' },
    ...overrides,
  };
}

function channelMember(overrides: Partial<ChannelMember> = {}): ChannelMember {
  return {
    id: overrides.id ?? 'cm-1',
    channel_id: 'channel-1',
    user_id: overrides.user_id ?? 'user-1',
    joined_at: new Date().toISOString(),
    user: { id: overrides.user_id ?? 'user-1', username: 'user', display_name: 'User', avatar_url: null, role: 'user' },
    ...overrides,
  };
}

describe('composeDisplayedMembers', () => {
  const owner = groupMember({ id: 'gm-owner', user_id: 'owner-1', role: 'owner' });
  const moderator = groupMember({ id: 'gm-mod', user_id: 'mod-1', role: 'moderator' });
  const plainMember = groupMember({ id: 'gm-member', user_id: 'member-1', role: 'member' });
  const notInChannel = groupMember({ id: 'gm-outsider', user_id: 'outsider-1', role: 'member' });
  const activeMembers = [owner, moderator, plainMember, notInChannel];

  it('returns Group members unchanged for a public channel', () => {
    const result = composeDisplayedMembers(false, activeMembers, [], 'group-1');
    expect(result).toBe(activeMembers);
  });

  it('for a private channel, includes only explicit channel_members plus Group owner/moderators', () => {
    const channelMembers = [channelMember({ id: 'cm-member', user_id: 'member-1' })];
    const result = composeDisplayedMembers(true, activeMembers, channelMembers, 'group-1');
    const userIds = result.map((m) => m.user_id).sort();
    expect(userIds).toEqual(['member-1', 'mod-1', 'owner-1']);
  });

  it('excludes a Group member who has neither manager authority nor a channel_members row', () => {
    const channelMembers = [channelMember({ id: 'cm-member', user_id: 'member-1' })];
    const result = composeDisplayedMembers(true, activeMembers, channelMembers, 'group-1');
    expect(result.some((m) => m.user_id === 'outsider-1')).toBe(false);
  });

  it('includes the Group owner/moderators even without a channel_members row', () => {
    const result = composeDisplayedMembers(true, activeMembers, [], 'group-1');
    const userIds = result.map((m) => m.user_id).sort();
    expect(userIds).toEqual(['mod-1', 'owner-1']);
  });

  it('reuses the existing GroupMember object (preserving role) for a channel member who is also tracked as an active Group member', () => {
    const channelMembers = [channelMember({ id: 'cm-member', user_id: 'member-1' })];
    const result = composeDisplayedMembers(true, activeMembers, channelMembers, 'group-1');
    const entry = result.find((m) => m.user_id === 'member-1');
    expect(entry).toBe(plainMember);
  });

  it('deduplicates by user_id when a manager also has an explicit channel_members row', () => {
    const channelMembers = [channelMember({ id: 'cm-owner-row', user_id: 'owner-1' })];
    const result = composeDisplayedMembers(true, activeMembers, channelMembers, 'group-1');
    expect(result.filter((m) => m.user_id === 'owner-1')).toHaveLength(1);
  });

  it('synthesizes a fallback member entry for a channel_members row with no matching active Group member', () => {
    const channelMembers = [channelMember({ id: 'cm-untracked', user_id: 'untracked-1' })];
    const result = composeDisplayedMembers(true, activeMembers, channelMembers, 'group-1');
    const entry = result.find((m) => m.user_id === 'untracked-1');
    expect(entry).toMatchObject({ user_id: 'untracked-1', role: 'member', status: 'active', group_id: 'group-1' });
  });

  it('the resulting count matches the rendered list length used for "Thành viên (N)"', () => {
    const channelMembers = [channelMember({ id: 'cm-member', user_id: 'member-1' })];
    const result = composeDisplayedMembers(true, activeMembers, channelMembers, 'group-1');
    expect(result).toHaveLength(3);
  });
});
