import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@avalon/ui-layout/room-shell.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
