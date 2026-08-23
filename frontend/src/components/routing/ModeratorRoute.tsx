import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageLoadingSkeleton } from '../ui/Skeleton';

/** Gate cho các route chỉ dành cho Kiểm duyệt viên/Admin. Chỉ ẩn/hiện UI -- backend độc lập
 * kiểm tra lại quyền này trên từng endpoint /moderation/*, đây không phải ranh giới bảo mật
 * duy nhất. */
export const ModeratorRoute = ({ children }: { children?: React.ReactNode }) => {
  const { loading, isModerator } = useAuth();

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!isModerator) {
    return <Navigate to="/" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
};
