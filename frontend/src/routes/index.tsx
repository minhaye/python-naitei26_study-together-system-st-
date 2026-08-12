import { Routes, Route } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HomePage } from '../pages/HomePage';
import { StudyRooms } from '../pages/StudyGroup/StudyGroups';
import { StudyGroupDetail } from '../pages/StudyGroup/StudyGroupDetail';
import { StudyRoom } from '../pages/StudyGroup/StudyRoom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AimPage } from '../pages/Aim';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const isAuth = localStorage.getItem('auth') === 'true';
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
};

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/room/:id" element={<StudyRoom />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="groups" element={<StudyRooms />} />
          <Route path="groups/:id" element={<StudyGroupDetail />} />
          <Route path="aim" element={<AimPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
