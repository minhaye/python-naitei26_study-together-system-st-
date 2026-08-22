import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HomePage } from '../pages/HomePage';
import { ForumPostDetail } from '../pages/forum/ForumPostDetail';
import { InvitationPreviewPage } from '../pages/invitations/InvitationPreviewPage';
import { StudyRooms } from '../pages/StudyGroup/StudyGroups';
import { StudyGroupDetail } from '../pages/StudyGroup/StudyGroupDetail';
import { StudyRoom } from '../pages/StudyGroup/StudyRoom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AimPage } from '../pages/Aim';
import { AccountSettingsPage } from '../pages/AccountSettingsPage';
import { DirectMessagesPage } from '../pages/messages/DirectMessagesPage';
import { useAuth } from '../hooks/useAuth';
import { ForumStateProvider } from '../pages/forum/context/ForumStateContext';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
};

export function AppRoutes() {
  return (
    <ForumStateProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/room/:id" element={<ProtectedRoute><StudyRoom /></ProtectedRoute>} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="forum/post/:id" element={<ForumPostDetail />} />
          <Route path="invitations/:secret" element={<InvitationPreviewPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="groups" element={<StudyRooms />} />
            <Route path="groups/:id" element={<StudyGroupDetail />} />
            <Route path="aim" element={<AimPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
            <Route path="messages" element={<DirectMessagesPage />} />
            <Route path="messages/:conversationId" element={<DirectMessagesPage />} />
          </Route>
        </Route>
      </Routes>
    </ForumStateProvider>
  );
}
