/**
 * avatarUtils.ts — Tiện ích tạo Chữ viết tắt (Initials) và Phối màu (Color) cho Avatar.
 *
 * Quy tắc Initials:
 *   - Tên có nhiều từ (VD: "Hải Minh", "Nguyễn Văn A"): Chữ cái đầu từ đầu + chữ cái đầu từ cuối → "HM", "NA".
 *   - Tên 1 từ (VD: "Admin", "Tuấn"): 2 chữ cái đầu → "AD", "TU".
 *
 * Quy tắc Phối màu HSL:
 *   - Mã băm (hash) từ chuỗi tên → sinh ra độ màu Hue (0 - 360), Saturation 65%, Lightness 45%.
 *   - Đảm bảo 1 tên người dùng luôn nhận 1 màu sắc nhất quán duy nhất, tương phản cao với chữ trắng.
 */

export function getAvatarInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'U';
  const trimmed = name.trim();
  if (!trimmed) return 'U';

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const firstInitial = parts[0][0] || '';
    const lastInitial = parts[parts.length - 1][0] || '';
    return (firstInitial + lastInitial).toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string): string {
  if (!name || typeof name !== 'string') return '#2563EB';

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Tạo độ màu HSL dịu mắt (Hue: 0-360, Saturation: 65%, Lightness: 42%)
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 42%)`;
}
