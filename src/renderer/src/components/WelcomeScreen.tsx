import React, { useEffect, useState } from 'react'
import AppLogo from './AppLogo'

interface WelcomeScreenProps {
  onReady: () => void
}

export default function WelcomeScreen({ onReady }: WelcomeScreenProps): React.ReactElement {
  const [defaultPath, setDefaultPath] = useState('')
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    window.api.getVaultPath().then(setDefaultPath)
  }, [])

  const handleUseDefault = async (): Promise<void> => {
    await window.api.confirmDefaultVault()
    onReady()
  }

  const handleChooseFolder = async (): Promise<void> => {
    setChoosing(true)
    try {
      const chosen = await window.api.chooseVaultPath()
      if (chosen) onReady()
    } finally {
      setChoosing(false)
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <AppLogo size={56} style={{ borderRadius: 13 }} />

        <h1 className="welcome-title">Welcome to Berean</h1>
        <p className="welcome-subtitle">Personal Bible study notes</p>

        <p className="welcome-body">
          Every note is saved as a plain Markdown file so you always own your data.
          Choose where Berean keeps your vault — an existing Obsidian folder works great.
        </p>

        <div className="welcome-path-section">
          <div className="welcome-path-label">Default location</div>
          <div className="welcome-path-box" title={defaultPath}>
            {defaultPath || '…'}
          </div>
        </div>

        <div className="welcome-actions">
          <button className="welcome-btn-primary" onClick={handleUseDefault}>
            Get Started
          </button>
          <button
            className="welcome-btn-secondary"
            onClick={handleChooseFolder}
            disabled={choosing}
          >
            {choosing ? 'Choosing…' : 'Choose a different folder'}
          </button>
        </div>
      </div>
    </div>
  )
}
