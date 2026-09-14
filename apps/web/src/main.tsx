import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@avalon/ui-layout/room-layout.css'
import '@fontsource/noto-serif-sc/600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
