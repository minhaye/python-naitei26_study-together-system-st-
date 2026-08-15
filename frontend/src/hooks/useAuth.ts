import { useNavigate } from 'react-router-dom';

/**
 * useAuth — Hook toàn cục kiểm tra trạng thái đăng nhập ở cấp độ action.
 *
 * Khác với `ProtectedRoute` (chặn toàn bộ trang khi chưa đăng nhập),
 * hook này dùng để bảo vệ các hành động cụ thể BÊN TRONG trang
 * (like bài viết, đăng bình luận, đặt câu hỏi...).
 *
 * Cách dùng:
 * ```tsx
 * const { isLoggedIn, requireAuth } = useAuth();
 *
 * const handleLike = () => {
 *   requireAuth(() => {
 *     // Chỉ chạy nếu đã đăng nhập
 *     likePost(postId);
 *   });
 * };
 * ```
 */
export function useAuth() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('auth') === 'true';

  /**
   * Bọc một action cần đăng nhập.
   * Nếu chưa đăng nhập → chuyển sang trang /login.
   * Nếu đã đăng nhập → thực thi action bình thường.
   */
  const requireAuth = (action: () => void) => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    action();
  };

  return { isLoggedIn, requireAuth };
}
