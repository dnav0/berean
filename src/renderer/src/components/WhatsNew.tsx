import React, { useEffect, useRef } from 'react'
import changelog from '../assets/changelog.json'

const STORAGE_KEY = 'berean-seen-version'

interface WhatsNewProps {
  isOpen: boolean
  onClose: () => void
}

export function WhatsNew({ isOpen, onClose }: WhatsNewProps): React.ReactElement | null {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const latest = changelog[0]

  return (
    <div
      className="wn-backdrop"
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="wn-modal">
        <div className="wn-header">
          <div>
            <div className="wn-title">What's new</div>
            <div className="wn-subtitle">{latest.title}</div>
          </div>
          <button className="wn-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="wn-body">
          {changelog.map(entry => (
            <div key={entry.version} className="wn-entry">
              <div className="wn-entry-header">
                <span className="wn-version">v{entry.version}</span>
                <span className="wn-date">{entry.date}</span>
              </div>
              <ul className="wn-notes">
                {entry.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Returns true if the current app version has not been seen by the user yet. */
export function hasUnseen(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== __APP_VERSION__
}

/** Mark the current version as seen. */
export function markSeen(): void {
  localStorage.setItem(STORAGE_KEY, __APP_VERSION__)
}
