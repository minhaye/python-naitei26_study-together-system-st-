import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { BanResponse } from '../../lib/moderation.types';

export interface RestrictionBannerProps {
  ban: BanResponse;
  /** Vietnamese verb phrase slotted into "Bạn đang bị cấm {actionLabel} ...", matching the
   * wording ModerationService.format_ban_message uses server-side for the same ban types
   * (e.g. "đăng bài và bình luận trong diễn đàn", "nhắn tin", "tạo nhóm học tập"). */
  actionLabel: string;
  /** 'dark' for the dark-themed Study Room / PreJoinLobby screens; 'light' (default) for
   * everywhere else. */
  variant?: 'light' | 'dark';
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<NonNullable<RestrictionBannerProps['variant']>, React.CSSProperties> = {
  light: { background: '#FEF3C7', border: '1px solid #FDE68A', color: '#B45309' },
  dark: { background: '#451A03', border: '1px solid #78350F', color: '#FCD34D' },
};

/** Pinned, non-dismissible notice shown wherever a restricted user would otherwise hit a
 * blocked action -- so they learn about the restriction up front instead of only after a
 * failed attempt (post/comment composer, message composer, group/room join buttons...). */
export const RestrictionBanner: React.FC<RestrictionBannerProps> = ({ ban, actionLabel, variant = 'light', style }) => {
  const until = ban.expires_at
    ? `đến ${new Date(ban.expires_at).toLocaleString('vi-VN')}`
    : 'vĩnh viễn';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        fontSize: 13,
        lineHeight: 1.5,
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    >
      <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        <strong>Bạn đang bị cấm {actionLabel}</strong> {until}.
        {ban.reason && <> Lý do: {ban.reason}.</>}
      </span>
    </div>
  );
};
