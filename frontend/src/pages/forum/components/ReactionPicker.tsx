import React from 'react';
import { QUICK_REACTIONS } from '../constants/reactions';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  align?: 'left' | 'right';
  emojiSize?: number;
}

/** Floating Facebook-style quick-react popup -- shared by PostCard and CommentItem's reaction
 * buttons. Positioning/visibility is owned by the caller (hover/click state); this component
 * only renders the row of emoji once told to. */
export const ReactionPicker: React.FC<ReactionPickerProps> = ({ onSelect, align = 'left', emojiSize = 20 }) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        [align]: 0,
        marginBottom: 6,
        display: 'flex',
        gap: 4,
        padding: '6px 8px',
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 20,
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
  );
};
