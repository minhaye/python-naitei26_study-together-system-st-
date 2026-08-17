import React from 'react';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Tên đầy đủ người dùng. Nếu truyền `name`, Avatar tự tính initials & color chuẩn */
  name?: string;
  /** URL ảnh đại diện. Nếu không có sẽ hiển thị fallback initials */
  src?: string | null;
  /** Chữ viết tắt hiển thị khi không có ảnh */
  initials?: string;
  /** Màu nền khi hiển thị initials */
  color?: string;
  /** Kích thước avatar */
  size?: AvatarSize;
  alt?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 44,
  xl: 64,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 24,
};

/** Avatar — Hiển thị ảnh đại diện người dùng. Fallback về chữ tắt màu nền nhất quán nếu không có ảnh */
export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  initials,
  color,
  size = 'md',
  alt = 'avatar',
  style,
}) => {
  const computedInitials = initials ?? (name ? getAvatarInitials(name) : '?');
  const computedColor = color ?? (name ? getAvatarColor(name) : '#2563EB');

  const px = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];

  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ ...baseStyle, objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        background: computedColor,
        color: 'white',
        fontWeight: '700',
        fontSize,
        fontFamily: 'Inter, sans-serif',
        userSelect: 'none',
      }}
    >
      {computedInitials.substring(0, 2).toUpperCase()}
    </div>
  );
};

// ─── Avatar Group ─────────────────────────────────────────────────────────────

export interface AvatarGroupProps {
  avatars: Pick<AvatarProps, 'name' | 'src' | 'initials' | 'color'>[];
  /** Số lượng avatar tối đa trước khi hiện "+N" */
  max?: number;
  size?: AvatarSize;
}

/** AvatarGroup — Xếp chồng nhiều avatar. Vượt quá `max` sẽ hiện "+N" */
export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 4,
  size = 'sm',
}) => {
  const visible = avatars.slice(0, max);
  const extra = avatars.length - max;
  const px = SIZE_MAP[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((av, i) => (
        <div
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -(px * 0.3),
            zIndex: visible.length - i,
            border: '2px solid white',
            borderRadius: '50%',
          }}
        >
          <Avatar {...av} size={size} />
        </div>
      ))}

      {extra > 0 && (
        <div
          style={{
            marginLeft: -(px * 0.3),
            width: px,
            height: px,
            borderRadius: '50%',
            background: '#E5EEFF',
            border: '2px solid white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: px * 0.28,
            fontWeight: '700',
            color: '#00236F',
            zIndex: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};
