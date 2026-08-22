import React from 'react';
import { topReactionEmojis, totalReactionCount } from '../constants/reactions';
import type { ReactionSummary } from '../types/forum.types';

interface ReactionClusterProps {
  reactions: ReactionSummary[];
}

/** Small "which emotions, and how many" summary -- e.g. 👍❤️😆 12 -- shown above a post's
 * action bar so multiple reaction types are visible at a glance, not just a single count.
 * Renders nothing when the post has no reactions yet. */
export const ReactionCluster: React.FC<ReactionClusterProps> = ({ reactions }) => {
  const total = totalReactionCount(reactions);
  if (total === 0) return null;
  const top = topReactionEmojis(reactions, 3);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748B' }}>
      <span style={{ display: 'flex' }}>
        {top.map((emoji, i) => (
          <span
            key={emoji}
            style={{
              fontSize: 15,
              marginLeft: i === 0 ? 0 : -5,
              filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.9))',
            }}
          >
            {emoji}
          </span>
        ))}
      </span>
      <span>{total}</span>
    </div>
  );
};
