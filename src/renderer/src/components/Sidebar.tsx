import React, { useState } from 'react'
import { Book, Passage, ThematicEntry } from '../types'

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
  onEditPassage
}: SidebarProps): React.ReactElement {
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set())

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
        <div className="app-title">Logos</div>
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
      </div>
    </div>
  )
}
