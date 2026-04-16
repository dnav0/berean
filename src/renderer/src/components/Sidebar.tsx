import React, { useState, useEffect } from 'react'
import { Book, Passage, ThematicEntry } from '../types'
import AppLogo from './AppLogo'

const TRANSLATIONS = [
  { value: 'web', label: 'WEB', name: 'World English Bible' },
  { value: 'kjv', label: 'KJV', name: 'King James Version' },
  { value: 'bsb', label: 'BSB', name: 'Berean Standard Bible' },
  { value: 'asv', label: 'ASV', name: 'American Standard Version' },
  { value: 'esv', label: 'ESV', name: 'English Standard Version' },
]

interface SidebarProps {
  mode: 'capture' | 'reading'
  onModeChange: (mode: 'capture' | 'reading') => void
  books: Book[]
  passages: Passage[]
  themes: ThematicEntry[]
  selectedPassageId: number | null
  selectedThemeId: number | null
  onSelectPassage: (passageId: number) => void
  onSelectTheme: (themeId: number) => void
  onNewPassage: () => void
  onNewTheme: () => void
  onEditPassage?: (passageId: number) => void
  isDark?: boolean
  onToggleDark?: () => void
  hasNew?: boolean
  onOpenWhatsNew?: () => void
  translation?: string
  onTranslationChange?: (translation: string, esvApiKey?: string) => Promise<void>
}

export default function Sidebar({
  mode,
  onModeChange,
  books,
  passages,
  themes,
  selectedPassageId,
  selectedThemeId,
  onSelectPassage,
  onSelectTheme,
  onNewPassage,
  onNewTheme,
  onEditPassage,
  isDark = false,
  onToggleDark,
  hasNew = false,
  onOpenWhatsNew,
  translation = 'web',
  onTranslationChange
}: SidebarProps): React.ReactElement {
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set())
  const [vaultPath, setVaultPath] = useState<string>('')
  const [esvKey, setEsvKey] = useState('')
  const [esvKeyDraft, setEsvKeyDraft] = useState('')
  const [showEsvInput, setShowEsvInput] = useState(false)

  useEffect(() => {
    if (translation === 'esv') {
      window.api.getTranslation().then(({ esvApiKey }) => {
        setEsvKey(esvApiKey)
        setEsvKeyDraft(esvApiKey)
        setShowEsvInput(true)
      })
    } else {
      setShowEsvInput(false)
    }
  }, [translation])

  const handleTranslationSelect = (value: string): void => {
    if (value === 'esv') {
      setShowEsvInput(true)
      onTranslationChange?.(value, esvKey)
    } else {
      setShowEsvInput(false)
      onTranslationChange?.(value)
    }
  }

  const handleEsvKeySave = (): void => {
    setEsvKey(esvKeyDraft)
    onTranslationChange?.('esv', esvKeyDraft)
  }

  useEffect(() => {
    window.api.getVaultPath().then(setVaultPath)
  }, [])

  const handleChooseVault = async (): Promise<void> => {
    const chosen = await window.api.chooseVaultPath()
    if (chosen) setVaultPath(chosen)
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

        {themes.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Themes
              <span
                style={{ cursor: 'pointer', color: '#BBB', fontWeight: 400, letterSpacing: 0, textTransform: 'none', fontSize: 13 }}
                onClick={onNewTheme}
              >
                +
              </span>
            </div>
            {themes.map(t => (
              <div
                key={t.id}
                className={`sidebar-item${t.id === selectedThemeId ? ' active' : ''}`}
                onClick={() => onSelectTheme(t.id)}
              >
                {t.title || 'Untitled'}
              </div>
            ))}
          </div>
        )}

        {passages.length === 0 && themes.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#CCC', fontSize: 12, lineHeight: 1.6 }}>
            Start by adding a passage below.
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn-new-passage" onClick={onNewPassage}>
          + New Passage
        </button>

        {/* Translation picker */}
        <div className="translation-row">
          <span className="translation-label">Translation</span>
          <select
            className="translation-select"
            value={translation}
            onChange={e => handleTranslationSelect(e.target.value)}
          >
            {TRANSLATIONS.map(t => (
              <option key={t.value} value={t.value} title={t.name}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {showEsvInput && (
          <div className="esv-key-row">
            <input
              className="esv-key-input"
              type="password"
              placeholder="ESV API key…"
              value={esvKeyDraft}
              onChange={e => setEsvKeyDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEsvKeySave() }}
            />
            <button
              className="esv-key-save-btn"
              onClick={handleEsvKeySave}
              disabled={!esvKeyDraft.trim()}
            >
              Save
            </button>
          </div>
        )}

        {/* Vault location row */}
        <div className="vault-row">
          <button
            className="vault-path-btn"
            onClick={() => window.api.openVaultFolder()}
            title={vaultPath}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="vault-path-label">
              {vaultPath ? vaultPath.split(/[\\/]/).pop() : 'Berean'}
            </span>
          </button>
          <button
            className="vault-change-btn"
            onClick={handleChooseVault}
            title="Change vault location"
          >
            Change
          </button>
        </div>

        {onOpenWhatsNew && (
          <button className="wn-version-chip" onClick={onOpenWhatsNew} title="What's new">
            v{__APP_VERSION__}
            {hasNew && <span className="wn-dot" />}
          </button>
        )}
      </div>
    </div>
  )
}
