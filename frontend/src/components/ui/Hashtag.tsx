import React, { useState } from 'react';

export interface HashtagProps {
  tag: string;
  onClick?: (tag: string) => void;
  style?: React.CSSProperties;
}

/**
 * Hashtag — Component thuần UI hiển thị thẻ #tag tương tác.
 * 100% Độc lập, nhận `tag` và `onClick`.
 */
export const Hashtag: React.FC<HashtagProps> = ({ tag, onClick, style }) => {
  const [isHovered, setIsHovered] = useState(false);

  const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;

  return (
    <span
      onClick={() => onClick?.(formattedTag)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        background: isHovered ? '#DBEAFE' : '#F1F5F9',
        color: isHovered ? '#1D4ED8' : '#3B82F6',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: '500',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        ...style,
      }}
    >
      {formattedTag}
    </span>
  );
};
