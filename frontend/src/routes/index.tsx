import { Routes, Route } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HomePage } from '../pages/HomePage';
import { StudyRooms } from '../pages/StudyGroups';
import { StudyGroupDetail } from '../pages/StudyGroupDetail';
import { StudyRoom } from '../pages/StudyRoom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/room/:id" element={<StudyRoom />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="groups" element={<StudyRooms />} />
        <Route path="groups/:id" element={<StudyGroupDetail />} />
      </Route>
    </Routes>
  );
}
