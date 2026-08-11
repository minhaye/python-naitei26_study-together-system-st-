import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { StudyGroupDetail } from './pages/StudyGroupDetail';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%'}}>
      <StudyGroupDetail />
    </div>
  </StrictMode>,
)
