import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/auth-context';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
}

const GUEST_NAME = 'Người dùng';
const GUEST_USER: AuthUser = {
  id: 'user-current',
  name: GUEST_NAME,
  initials: getAvatarInitials(GUEST_NAME),
  color: getAvatarColor(GUEST_NAME),
  avatarUrl: null,
};

/**
 * useAuth — Hook toàn cục kiểm tra trạng thái đăng nhập và thông tin người dùng hiện tại,
 * dựa trên phiên đăng nhập Supabase thực (qua AuthContext).
 */
export function useAuth() {
  const navigate = useNavigate();
  const { session, user, profile, loading } = useAuthContext();
  const isLoggedIn = !!session;

  const displayName =
    profile?.displayName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    GUEST_NAME;

  // Luôn trả về một currentUser hợp lệ (kể cả khi chưa đăng nhập) để các nơi
  // dùng currentUser.id / currentUser.name (VD: Forum mock) không bị lỗi.
  const currentUser: AuthUser = user
    ? {
        id: user.id,
        name: displayName,
        initials: getAvatarInitials(displayName),
        color: getAvatarColor(displayName),
        avatarUrl: profile?.avatarUrl ?? null,
      }
    : GUEST_USER;

  /**
   * Bọc một action cần đăng nhập.
   * Nếu chưa đăng nhập → chuyển sang trang /login.
   * Nếu đã đăng nhập → thực thi action bình thường.
   */
  const requireAuth = <T>(action: () => T): T | void => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    return action();
  };

  return { isLoggedIn, loading, currentUser, user, session, requireAuth };
}
