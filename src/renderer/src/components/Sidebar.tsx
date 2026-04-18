import React, { useState, useEffect, useRef } from 'react'
import { Book, Passage } from '../types'
import AppLogo from './AppLogo'

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error'

interface SidebarProps {
  mode: 'capture' | 'reading'
  onModeChange: (mode: 'capture' | 'reading') => void
  books: Book[]
  passages: Passage[]
  selectedPassageId: number | null
  onSelectPassage: (passageId: number) => void
  onNewPassage: () => void
  onEditPassage?: (passageId: number) => void
  isDark?: boolean
  onToggleDark?: () => void
  hasNew?: boolean
  onOpenWhatsNew?: () => void
  onOpenSettings?: () => void
  updateStatus?: UpdateStatus
  updateVersion?: string
  onCheckForUpdates?: () => void
  onQuitAndInstall?: () => void
}

export default function Sidebar({
  mode,
  onModeChange,
  books,
  passages,
  selectedPassageId,
  onSelectPassage,
  onNewPassage,
  onEditPassage,
  isDark = false,
  onToggleDark,
  hasNew = false,
  onOpenWhatsNew,
  onOpenSettings,
  updateStatus = 'idle',
  updateVersion,
  onCheckForUpdates,
  onQuitAndInstall
}: SidebarProps): React.ReactElement {
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set())
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ bottom: number; left: number } | null>(null)
  const updBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (updateStatus === 'ready') {
      openPopover()
    }
  }, [updateStatus])

  const openPopover = (): void => {
    if (updBtnRef.current) {
      const rect = updBtnRef.current.getBoundingClientRect()
      const popoverWidth = 210
      const centeredLeft = rect.left + rect.width / 2 - popoverWidth / 2
      const left = Math.max(8, Math.min(window.innerWidth - popoverWidth - 8, centeredLeft))
      setPopoverPos({ bottom: window.innerHeight - rect.top + 10, left })
    }
    setPopoverOpen(true)
  }

  const toggleBook = (bookId: number): void => {
    setExpandedBooks(prev => {
      const next = new Set(prev)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }

  const passagesByBook = new Map<number, Passage[]>()
  for (const p of passages) {
    if (!passagesByBook.has(p.book_id)) passagesByBook.set(p.book_id, [])
    passagesByBook.get(p.book_id)!.push(p)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="app-title-row">
          <AppLogo size={22} style={{ borderRadius: 5 }} />
          <div className="app-title" style={{ flex: 1 }}>Berean</div>
          {onToggleDark && (
            <button
              className="dark-mode-toggle"
              onClick={onToggleDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                /* Sun icon */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* Moon icon */
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          )}
        </div>
        <div className="app-subtitle">personal study notes</div>
      </div>

      <div className="mode-toggle">
        <button
          className={`mode-toggle-btn${mode === 'capture' ? ' active' : ''}`}
          onClick={() => onModeChange('capture')}
        >
          Capture
        </button>
        <button
          className={`mode-toggle-btn${mode === 'reading' ? ' active' : ''}`}
          onClick={() => onModeChange('reading')}
        >
          Read
        </button>
      </div>

      <div className="sidebar-scroll">
        {passages.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Books</div>
            {books.filter(b => passagesByBook.has(b.id)).map(book => {
              const bookPassages = passagesByBook.get(book.id) || []
              const isExpanded = expandedBooks.has(book.id)
              const hasSelected = bookPassages.some(p => p.id === selectedPassageId)

              return (
                <div key={book.id}>
                  <div
                    className={`sidebar-item${hasSelected ? ' active' : ''}`}
                    onClick={() => toggleBook(book.id)}
                    style={{ justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div className="sidebar-item-dot" />
                      {book.name}
                    </div>
                    <span style={{ color: '#CCC', fontSize: 10, transform: isExpanded ? 'rotate(90deg)' : undefined, display: 'inline-block', transition: 'transform 0.15s' }}>
                      ▶
                    </span>
                  </div>
                  {isExpanded && bookPassages.map(p => (
                    <div
                      key={p.id}
                      className={`sidebar-item sidebar-passage-item${p.id === selectedPassageId ? ' active' : ''}`}
                      style={{ paddingLeft: 24, fontSize: 12 }}
                      onClick={() => onSelectPassage(p.id)}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.reference_label}
                      </span>
                      {onEditPassage && (
                        <button
                          className="sidebar-passage-edit-btn"
                          title="Edit notes"
                          onClick={e => { e.stopPropagation(); onEditPassage(p.id) }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {passages.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#CCC', fontSize: 12, lineHeight: 1.6 }}>
            Start by adding a passage below.
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn-new-passage" onClick={onNewPassage}>
          + New Passage
        </button>

        <div className="sidebar-footer-row">
          <button
            className="sidebar-settings-btn"
            onClick={onOpenSettings}
            title="Settings"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>

          {onOpenWhatsNew && (
            <div className="upd-area">
              <button className="wn-version-chip" onClick={onOpenWhatsNew} title="What's new">
                v{__APP_VERSION__}
                {hasNew && <span className="wn-dot" />}
              </button>

              {/* Idle: manual check button */}
              {updateStatus === 'idle' && (
                <button className="upd-btn upd-btn-refresh" title="Check for updates" onClick={onCheckForUpdates}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                  </svg>
                </button>
              )}

              {/* Checking or downloading: spinner */}
              {(updateStatus === 'checking' || updateStatus === 'downloading') && (
                <span className="upd-spinner" title={updateStatus === 'checking' ? 'Checking for updates…' : 'Downloading update…'} />
              )}

              {/* Up-to-date: checkmark */}
              {updateStatus === 'up-to-date' && (
                <span className="upd-check" title="Up to date">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
              )}

              {/* Error: retry button */}
              {updateStatus === 'error' && (
                <button className="upd-btn upd-btn-error" title="Update check failed — click to retry" onClick={onCheckForUpdates}>
                  !
                </button>
              )}

              {/* Ready: install button */}
              {updateStatus === 'ready' && (
                <button
                  ref={updBtnRef}
                  className="upd-btn upd-btn-ready"
                  title="Update ready — click to install"
                  onClick={() => popoverOpen ? setPopoverOpen(false) : openPopover()}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 11 12 6 7 11"/>
                    <line x1="12" y1="6" x2="12" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Popover — fixed position to escape sidebar overflow:hidden */}
          {popoverOpen && updateStatus === 'ready' && popoverPos && (
              <div
                className="upd-popover"
                style={{ position: 'fixed', bottom: popoverPos.bottom, left: popoverPos.left }}
              >
                <div className="upd-popover-title">
                  {updateVersion ? `v${updateVersion} ready` : 'Update ready'}
                </div>
                <div className="upd-popover-sub">Restart to install the new version.</div>
                <div className="upd-popover-actions">
                  <button
                    className="upd-popover-btn upd-popover-btn-primary"
                    onClick={() => { setPopoverOpen(false); onQuitAndInstall?.() }}
                  >
                    Restart now
                  </button>
                  <button
                    className="upd-popover-btn upd-popover-btn-ghost"
                    onClick={() => setPopoverOpen(false)}
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
