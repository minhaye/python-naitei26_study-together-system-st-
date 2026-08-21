import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AppRoutes } from './routes'
import { AuthProvider } from './contexts/AuthContext'
import { UnreadMessagesProvider } from './contexts/UnreadMessagesProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UnreadMessagesProvider>
          <AppRoutes />
        </UnreadMessagesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
