import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// Keep --footer-h equal to the static footer's height (it may wrap on narrow screens).
const footer = document.getElementById('site-footer')
if (footer && 'ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--footer-h', `${footer.offsetHeight}px`)
  }).observe(footer)
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
