import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HomePage } from '../pages/HomePage';
import { ForumPostDetail } from '../pages/forum/ForumPostDetail';
import { StudyRooms } from '../pages/StudyGroup/StudyGroups';
import { StudyGroupDetail } from '../pages/StudyGroup/StudyGroupDetail';
import { StudyRoom } from '../pages/StudyGroup/StudyRoom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AimPage } from '../pages/Aim';
import { AccountSettingsPage } from '../pages/AccountSettingsPage';

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const isAuth = localStorage.getItem('auth') === 'true';
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
};

import { ForumStateProvider } from '../pages/forum/context/ForumStateContext';

export function AppRoutes() {
  return (
    <ForumStateProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/room/:id" element={<StudyRoom />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="forum/post/:id" element={<ForumPostDetail />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="groups" element={<StudyRooms />} />
            <Route path="groups/:id" element={<StudyGroupDetail />} />
            <Route path="aim" element={<AimPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </ForumStateProvider>
  );
}
