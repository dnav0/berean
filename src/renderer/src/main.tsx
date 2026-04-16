import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'
import './assets/dark.css'

// Tag the body with the current platform so CSS can target it precisely.
// navigator.platform is 'MacIntel' / 'MacM1' on macOS, 'Win32' on Windows, etc.
if (navigator.platform.toLowerCase().includes('mac')) {
  document.body.classList.add('platform-mac')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
