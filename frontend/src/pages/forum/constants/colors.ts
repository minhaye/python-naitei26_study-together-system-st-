/**
 * colors.ts — Bộ màu chủ đạo của trang Forum
 *
 * Muốn thay đổi màu sắc toàn bộ Forum, chỉ cần sửa tại đây.
 * Các màu này dựa trên thiết kế hiện tại của HomePage.tsx.
 */
export const FORUM_COLORS = {
  // ── Brand (Màu chủ đạo xanh navy) ──────────────────────────────────
  primary: '#00236F',        // Nút chính, active nav, tiêu đề quan trọng
  primaryHover: '#003399',   // Màu khi hover vào nút primary
  primaryLight: '#EFF6FF',   // Nền item được chọn trong sidebar
  primaryLighter: '#DBEAFE', // Badge / label nhạt (tên môn học)
  primaryText: '#1D4ED8',    // Chữ trên nền primaryLight

  // ── Text (Chữ) ──────────────────────────────────────────────────────
  textPrimary: '#0F172A',    // Tiêu đề bài viết, tên người dùng
  textSecondary: '#334155',  // Nội dung bài viết
  textMuted: '#64748B',      // Số like, thời gian, icon phụ
  textDisabled: '#94A3B8',   // Placeholder input, icon mờ

  // ── Surface (Nền) ────────────────────────────────────────────────────
  bg: '#F8FAFC',             // Nền toàn trang
  card: '#FFFFFF',           // Nền card bài viết, sidebar
  subtle: '#F1F5F9',         // Nền input, tag, hover item

  // ── Border (Viền) ────────────────────────────────────────────────────
  border: '#E2E8F0',         // Viền card, divider, input

  // ── State (Trạng thái) ───────────────────────────────────────────────
  danger: '#DC2626',         // Icon / chữ lỗi
  dangerBg: '#FEF2F2',       // Nền banner cảnh báo chưa đăng nhập
  dangerBorder: '#FECACA',   // Viền banner cảnh báo
} as const;
