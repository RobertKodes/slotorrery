import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/chivo-mono/400.css'
import '@fontsource/chivo-mono/500.css'
import App from './App.tsx'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('root missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
