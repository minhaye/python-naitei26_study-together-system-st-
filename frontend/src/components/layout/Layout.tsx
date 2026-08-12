import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', background: '#F8FAFC'}}>
      <Header />
      <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        <Outlet />
      </div>
    </div>
  );
}
