import { useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import type { MessageReactionSummary } from '../../lib/message.types';

/** Fixed Messenger-style quick-react set -- mirrors ALLOWED_MESSAGE_REACTIONS in
 * app/messages/dto/message_dto.py and the CHECK constraint in
 * docs/db/migrations/025_add_message_reactions.sql. Keep all three in sync if this set
 * ever changes. */
const QUICK_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '😡'];

interface MessageReactionsProps {
  reactions: MessageReactionSummary[];
  isSelf: boolean;
  onSelect: (emoji: string) => void;
  /** Study Room's chat is dark-themed; Channel chat and Direct Messages are light. No CSS
   * framework in this codebase (inline `style={}` everywhere), so the two palettes are
   * switched here rather than via a stylesheet class. */
  dark?: boolean;
}

export function MessageReactions({ reactions, isSelf, onSelect, dark = false }: MessageReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const pillBorder = dark ? '#334155' : '#E2E8F0';
  const pillBackground = dark ? '#1E293B' : '#F8FAFC';
  const pillActiveBorder = '#2563EB';
  const pillActiveBackground = dark ? '#1E3A5F' : '#EFF6FF';
  const countColor = dark ? '#94A3B8' : '#64748B';
  const triggerColor = dark ? '#64748B' : '#94A3B8';
  const pickerBackground = dark ? '#1E293B' : 'white';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        flexWrap: 'wrap',
        flexDirection: isSelf ? 'row-reverse' : 'row',
        marginTop: 4,
      }}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onSelect(r.emoji)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 999,
            border: `1px solid ${r.reacted_by_me ? pillActiveBorder : pillBorder}`,
            background: r.reacted_by_me ? pillActiveBackground : pillBackground,
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: '16px',
          }}
        >
          <span>{r.emoji}</span>
          <span style={{ color: countColor, fontWeight: 600 }}>{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Thêm cảm xúc"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: `1px solid ${pillBorder}`,
          background: pillBackground,
          cursor: 'pointer',
          color: triggerColor,
        }}
      >
        <SmilePlus size={13} />
      </button>
      {pickerOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            ...(isSelf ? { right: 0 } : { left: 0 }),
            marginBottom: 4,
            display: 'flex',
            gap: 4,
            padding: '6px 8px',
            background: pickerBackground,
            border: `1px solid ${pillBorder}`,
            borderRadius: 999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10,
          }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setPickerOpen(false);
              }}
              style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
