/**
 * userDisplay.ts — Nguồn quy tắc hiển thị danh tính người dùng duy nhất cho toàn frontend.
 *
 * Thứ tự fallback chuẩn: display_name -> username -> nhãn chung ("Người dùng").
 * KHÔNG BAO GIỜ hiển thị mảnh UUID (VD: "Người dùng #1000") hay email trong danh sách
 * thành viên/tin nhắn -- nếu bạn thấy mình đang cắt chuỗi từ user_id để làm tên hiển thị,
 * đó là dấu hiệu sai chỗ: hãy dùng UserSummary (profile.types.ts) từ API thay vì tự chế.
 */

import type { UserSummary } from '../lib/profile.types';

export const GENERIC_USER_LABEL = 'Người dùng';

/** Canonical display-name fallback: display_name -> username -> generic label. Never falls
 * back to an id/UUID fragment or an email address. */
export function getDisplayName(user: UserSummary | null | undefined): string {
  if (user?.display_name) return user.display_name;
  if (user?.username) return user.username;
  return GENERIC_USER_LABEL;
}

/** Convenience for the very common "(Bạn)" self-suffix pattern used across member/participant
 * lists and chat -- keeps that formatting in one place instead of duplicated per call site. */
export function getDisplayNameWithSelfSuffix(
  user: UserSummary | null | undefined,
  isSelf: boolean,
  selfName: string
): string {
  return isSelf ? `${selfName} (Bạn)` : getDisplayName(user);
}
