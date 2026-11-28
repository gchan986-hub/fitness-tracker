import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Home Screen apps on iPhone are usually resumed rather than reopened, so also look for a new version whenever the
// app comes back on screen (and every half hour while open). A found update reloads the app; the workout in progress
// and any running timers are saved on the device, so nothing is lost.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void registration.update()
    }
    document.addEventListener('visibilitychange', check)
    setInterval(check, 30 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
