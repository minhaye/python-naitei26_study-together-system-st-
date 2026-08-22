import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppRoutes } from './routes'
import { AuthProvider } from './contexts/AuthContext'
import { UnreadMessagesProvider } from './contexts/UnreadMessagesProvider'
import { ColdStartOverlay } from './components/common/ColdStartOverlay'
import { useKeepAlive } from './hooks/useKeepAlive'

/** Thin wrapper to call hooks that need to live inside BrowserRouter/Providers */
function AppShell() {
  useKeepAlive();
  return (
    <>
      <AppRoutes />
      <ColdStartOverlay />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UnreadMessagesProvider>
          <AppShell />
        </UnreadMessagesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
