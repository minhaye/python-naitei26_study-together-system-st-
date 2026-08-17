import { useNavigate } from 'react-router-dom';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  color: string;
}

/**
 * useAuth — Hook toàn cục kiểm tra trạng thái đăng nhập và thông tin người dùng hiện tại.
 */
export function useAuth() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('auth') === 'true';

  // Lấy thông tin user từ localStorage hoặc mặc định khi đăng nhập
  const storedName = localStorage.getItem('user_name') || 'Người dùng';
  const storedId = localStorage.getItem('user_id') || 'user-current';

  const currentUser: AuthUser = {
    id: storedId,
    name: storedName,
    initials: getAvatarInitials(storedName),
    color: getAvatarColor(storedName),
  };

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

  return { isLoggedIn, currentUser, requireAuth };
}
