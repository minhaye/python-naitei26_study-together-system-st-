import type { ReactionSummary } from '../types/forum.types';

/** Fixed quick-react set -- mirrors ALLOWED_FORUM_REACTIONS in app/forum/dto/forum_dto.py and
 * the CHECK constraint in docs/db/migrations/028_add_forum_reactions.sql. Same set (and same
 * order) as chat's QUICK_REACTIONS (frontend/src/components/chat/MessageReactions.tsx) so
 * Forum reactions feel identical to message reactions. Keep all three in sync. */
export interface ReactionMeta {
  emoji: string;
  label: string;
  color: string;
}

export const QUICK_REACTIONS: ReactionMeta[] = [
  { emoji: '👍', label: 'Thích', color: '#1D4ED8' },
  { emoji: '❤️', label: 'Yêu thích', color: '#DC2626' },
  { emoji: '😆', label: 'Haha', color: '#D97706' },
  { emoji: '😮', label: 'Wow', color: '#D97706' },
  { emoji: '😢', label: 'Buồn', color: '#475569' },
  { emoji: '😡', label: 'Phẫn nộ', color: '#EA580C' },
];

export const REACTION_META_BY_EMOJI: Record<string, ReactionMeta> = Object.fromEntries(
  QUICK_REACTIONS.map((r) => [r.emoji, r])
);

export const DEFAULT_REACTION_EMOJI = QUICK_REACTIONS[0].emoji; // '👍' -- what a plain click (no picker) sends

export function totalReactionCount(reactions: ReactionSummary[]): number {
  return reactions.reduce((sum, r) => sum + r.count, 0);
}

export function myReactionEmoji(reactions: ReactionSummary[]): string | null {
  return reactions.find((r) => r.reactedByMe)?.emoji ?? null;
}

/** Most-used emojis first, for the small reaction cluster shown next to the count. */
export function topReactionEmojis(reactions: ReactionSummary[], limit = 3): string[] {
  return [...reactions]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((r) => r.emoji);
}

/** Optimistically applies "my reaction is now `emoji`" (or `null` to remove it) to a grouped
 * reactions array -- picking a new emoji moves my count off the old emoji and onto the new one
 * (never both), mirroring the backend's one-row-per-user upsert. Used by both PostCard and
 * CommentItem so their 0ms optimistic UI matches what the server will actually return. */
export function applyReactionOptimistic(reactions: ReactionSummary[], emoji: string | null): ReactionSummary[] {
  const prevMine = myReactionEmoji(reactions);
  if (prevMine === emoji) return reactions;

  let next = reactions
    .map((r) => (r.emoji === prevMine ? { ...r, count: r.count - 1, reactedByMe: false } : r))
    .filter((r) => r.count > 0);

  if (emoji) {
    const existing = next.find((r) => r.emoji === emoji);
    next = existing
      ? next.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r))
      : [...next, { emoji, count: 1, reactedByMe: true }];
  }

  return next;
}
