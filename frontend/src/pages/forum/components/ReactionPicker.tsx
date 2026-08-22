import React from 'react';
import { QUICK_REACTIONS } from '../constants/reactions';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  /** 'center' anchors the popup under the trigger's horizontal midpoint -- use this whenever
   * the trigger's own visible content is centered within a wider box (e.g. PostCard's `flex: 1`
   * like button), otherwise the popup ends up flush against one edge while the cursor is over
   * the middle, creating a dead zone the mouse has to cross. 'left'/'right' pin to that edge
   * instead, for triggers that are already tight-fitting around their content (e.g. a comment's
   * inline "Thích" button). */
  align?: 'left' | 'right' | 'center';
  emojiSize?: number;
}

/** Floating Facebook-style quick-react popup -- shared by PostCard and CommentItem's reaction
 * buttons. Positioning/visibility is owned by the caller (hover/click state); this component
 * only renders the row of emoji once told to.
 *
 * The outer box's bottom edge sits flush against the trigger's top edge (`bottom: 100%`, no
 * margin) -- the visual gap above the trigger comes from `paddingBottom` on this same box, not
 * a margin, so the box that actually receives hover events has zero dead space between it and
 * the trigger. A `marginBottom` gap here would create empty, unhoverable space the cursor has
 * to cross to reach the popup, causing the caller's onMouseLeave to fire (and this popup to
 * unmount) before the user can even click an emoji. */
export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelect, align = 'left', emojiSize = 20 }) => {
  const horizontal: React.CSSProperties =
    align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { [align]: 0 };
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        paddingBottom: 8,
        zIndex: 20,
        ...horizontal,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {QUICK_REACTIONS.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            title={label}
            onClick={() => onSelect(emoji)}
            style={{
              fontSize: emojiSize,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              lineHeight: 1,
              transition: 'transform 0.1s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.25) translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'none')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
