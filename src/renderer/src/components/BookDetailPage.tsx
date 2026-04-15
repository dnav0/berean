import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Book, BiblePassage, NoteWithPassageInfo, NoteCategory } from '../types'
import { BibleBook } from '../utils/bibleBooks'
import { parseNoteLine } from '../utils/noteParser'
import InlineTagInput from './InlineTagInput'
import ConfirmDialog from './ConfirmDialog'

// ─── tiny helpers ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  observation: 'Observation',
  historical: 'Historical',
  application: 'Application',
  personal: 'Personal'
}

function RenderedNoteContent({ content }: { content: string }): React.ReactElement {
  const { segments } = parseNoteLine(content)
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'verse-anchor':  return <span key={i} className="pill-verse">{seg.display}</span>
          case 'tag':           return <span key={i} className={`pill-tag-${seg.data?.category || 'observation'}`}>{seg.display}</span>
          case 'cross-ref':     return <span key={i} className="pill-crossref">{seg.display}</span>
          default:              return <span key={i}>{seg.raw}</span>
        }
      })}
    </>
  )
}

// ─── chapter view ────────────────────────────────────────────────────────────

interface ChapterViewProps {
  bookName: string
  chapter: number
  notes: NoteWithPassageInfo[]
  onCaptureChapter: (ref: string) => void
  onNotesChanged: () => void
}

function ChapterView({ bookName, chapter, notes, onCaptureChapter, onNotesChanged }: ChapterViewProps): React.ReactElement {
  const [bibleData, setBibleData] = useState<BiblePassage | null>(null)
  const [loading, setLoading] = useState(true)
  const [highlightedNoteIds, setHighlightedNoteIds] = useState<Set<number>>(new Set())
  const [highlightedVerses, setHighlightedVerses] = useState<Set<number>>(new Set())
  const [inlineVerse, setInlineVerse] = useState<number | null>(null)
  const [inlineText, setInlineText] = useState('')
  const [savingInline, setSavingInline] = useState(false)
  const [localNotes, setLocalNotes] = useState<NoteWithPassageInfo[]>(notes)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<NoteWithPassageInfo | null>(null)

  const chapterNotes = localNotes.filter(n =>
    n.chapter_start <= chapter && chapter <= n.chapter_end
  )

  const byVerse = new Map<number | null, NoteWithPassageInfo[]>()
  for (const n of chapterNotes) {
    const key = n.anchor_start_verse
    if (!byVerse.has(key)) byVerse.set(key, [])
    byVerse.get(key)!.push(n)
  }

  useEffect(() => {
    setLoading(true)
    setBibleData(null)
    window.api.getBibleVerse(`${bookName} ${chapter}`).then(data => {
      setBibleData(data)
    }).finally(() => setLoading(false))
  }, [bookName, chapter])

  useEffect(() => { setLocalNotes(notes) }, [notes])

  const handleVerseClick = (v: number): void => {
    if (editingNoteId !== null) return
    const anchored = chapterNotes.filter(n =>
      n.anchor_start_verse !== null &&
      v >= n.anchor_start_verse &&
      v <= (n.anchor_end_verse ?? n.anchor_start_verse)
    )
    if (anchored.length) {
      setHighlightedNoteIds(new Set(anchored.map(n => n.id)))
      setHighlightedVerses(new Set())
    }
  }

  const handleNoteClick = (n: NoteWithPassageInfo): void => {
    if (editingNoteId !== null) return
    if (n.anchor_start_verse !== null) {
      const s = n.anchor_start_verse
      const e = n.anchor_end_verse ?? s
      const vs = new Set<number>()
      for (let i = s; i <= e; i++) vs.add(i)
      setHighlightedVerses(vs)
      setHighlightedNoteIds(new Set())
    }
  }

  const handleInlineSave = async (): Promise<void> => {
    if (!inlineText.trim() || savingInline || inlineVerse === null) return
    setSavingInline(true)
    try {
      const parsed = parseNoteLine(inlineText)
      const passages = await window.api.getPassages()
      let sessionId: number
      const chapterPassages = passages.filter(p =>
        p.reference_label.toLowerCase().startsWith(bookName.toLowerCase())
      )

      if (chapterPassages.length > 0) {
        const sessions = await window.api.getSessionsByPassage(chapterPassages[0].id)
        if (sessions.length > 0) {
          sessionId = sessions[0].id
        } else {
          const s = await window.api.createSession(chapterPassages[0].id)
          sessionId = s.id
        }
      } else {
        const bookResult = await window.api.upsertBook(bookName, bookName.slice(0, 3))
        const newPassage = await window.api.createPassage({
          book_id: bookResult.id,
          chapter_start: chapter,
          verse_start: 1,
          chapter_end: chapter,
          verse_end: 99,
          reference_label: `${bookName} ${chapter}`
        })
        const s = await window.api.createSession(newPassage.id)
        sessionId = s.id
      }

      const saved = await window.api.createNote({
        session_id: sessionId,
        content: inlineText,
        anchor_start_verse: parsed.anchorStart,
        anchor_end_verse: parsed.anchorEnd,
        anchor_book_override: null,
        anchor_chapter_override: null,
        category: parsed.category
      })

      const enriched: NoteWithPassageInfo = {
        ...saved,
        chapter_start: chapter,
        chapter_end: chapter,
        verse_start: 1,
        verse_end: 99,
        reference_label: `${bookName} ${chapter}`
      }
      setLocalNotes(prev => [...prev, enriched])
      setInlineVerse(null)
      setInlineText('')
      onNotesChanged()
    } finally {
      setSavingInline(false)
    }
  }

  const handleStartEdit = (note: NoteWithPassageInfo): void => {
    setEditingNoteId(note.id)
    setEditText(note.content)
    setInlineVerse(null)
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (editingNoteId === null || !editText.trim()) return
    const parsed = parseNoteLine(editText)
    const updated = await window.api.updateNote(editingNoteId, {
      content: editText,
      anchor_start_verse: parsed.anchorStart,
      anchor_end_verse: parsed.anchorEnd,
      category: parsed.category
    })
    setLocalNotes(prev => prev.map(n => n.id === editingNoteId ? { ...n, ...updated } : n))
    setEditingNoteId(null)
    onNotesChanged()
  }

  const handleDeleteNote = async (note: NoteWithPassageInfo): Promise<void> => {
    await window.api.deleteNoteAndCascade(note.id)
    setLocalNotes(prev => prev.filter(n => n.id !== note.id))
    setConfirmDelete(null)
    onNotesChanged()
  }

  const renderNoteCard = (note: NoteWithPassageInfo): React.ReactElement => {
    const isHighlighted = highlightedNoteIds.has(note.id)
    const isEditing = editingNoteId === note.id
    return (
      <div
        key={note.id}
        className={`reading-note-card cat-${note.category || 'none'}${isHighlighted ? ' highlighted' : ''}`}
      >
        {note.category && (
          <div className={`reading-note-meta cat-${note.category}`}>
            {CATEGORY_LABELS[note.category]}
          </div>
        )}
        {isEditing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 2 }}>
            <InlineTagInput
              value={editText}
              onChange={setEditText}
              onEnter={handleSaveEdit}
              onEscape={() => setEditingNoteId(null)}
              className="se-edit-input"
              autoFocus
            />
            <button className="se-save-btn" onClick={handleSaveEdit} title="Save">✓</button>
            <button className="se-cancel-btn" onClick={() => setEditingNoteId(null)} title="Cancel">✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1 }} onClick={() => handleNoteClick(note)}>
              <RenderedNoteContent content={note.content} />
            </div>
            <div className="se-note-actions">
              <button
                className="se-icon-btn"
                title="Edit"
                onClick={e => { e.stopPropagation(); handleStartEdit(note) }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                className="se-icon-btn se-icon-danger"
                title="Delete"
                onClick={e => { e.stopPropagation(); setConfirmDelete(note) }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="loading-dots">Loading chapter {chapter}…</div>
  }

  if (!bibleData) {
    return (
      <div style={{ color: '#CCC', fontSize: 13, padding: '16px 0' }}>
        Could not load verse text.
      </div>
    )
  }

  const hasHighlightedVerse = highlightedVerses.size > 0

  return (
    <div className="book-chapter-content fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#BBB', letterSpacing: '0.04em' }}>
          CHAPTER {chapter}
        </div>
        <button
          className="btn-capture-chapter"
          onClick={() => onCaptureChapter(`${bookName} ${chapter}`)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add notes
        </button>
      </div>

      {bibleData.verses.map(v => {
        const isHighlighted = highlightedVerses.has(v.verse)
        const isDimmed = hasHighlightedVerse && !isHighlighted
        const verseNotes = byVerse.get(v.verse) || []
        const showInline = inlineVerse === v.verse

        return (
          <div key={v.verse} className="reading-verse-block">
            <div
              className={`reading-verse-row${isHighlighted ? ' highlighted' : ''}`}
              onClick={() => handleVerseClick(v.verse)}
              style={isDimmed ? { opacity: 0.35 } : undefined}
            >
              <span className="verse-number">{v.verse}</span>
              <span className="verse-text">{v.text}</span>
              <span
                className="verse-add-btn"
                onClick={e => { e.stopPropagation(); setInlineVerse(v.verse); setInlineText(`v${v.verse} `) }}
                title="Add note"
              >+</span>
            </div>

            {showInline && (
              <div className="inline-note-row">
                <span style={{ color: '#CCC', fontSize: 14 }}>•</span>
                <InlineTagInput
                  value={inlineText}
                  onChange={setInlineText}
                  onEnter={handleInlineSave}
                  onEscape={() => { setInlineVerse(null); setInlineText('') }}
                  className="inline-note-input"
                  placeholder={`v${v.verse} type a note…`}
                  autoFocus
                />
                <span className="inline-note-hint">↵ save · esc cancel</span>
              </div>
            )}

            {verseNotes.length > 0 && (
              <div className="reading-notes-group">
                {verseNotes.map(note => renderNoteCard(note))}
              </div>
            )}
          </div>
        )
      })}

      {(byVerse.get(null) || []).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="passage-pane-reference" style={{ marginBottom: 8 }}>General Notes</div>
          <div className="reading-notes-group">
            {(byVerse.get(null) || []).map(note => renderNoteCard(note))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Delete note?"
        message={confirmDelete ? `"${confirmDelete.content.slice(0, 60)}${confirmDelete.content.length > 60 ? '…' : ''}"` : undefined}
        onClose={() => setConfirmDelete(null)}
        actions={[
          { label: 'Delete', variant: 'danger', onClick: () => confirmDelete && void handleDeleteNote(confirmDelete), autoFocus: false },
          { label: 'Cancel', variant: 'ghost', onClick: () => setConfirmDelete(null), autoFocus: true }
        ]}
      />
    </div>
  )
}

// ─── main export ─────────────────────────────────────────────────────────────

interface BookDetailPageProps {
  bibleBook: BibleBook
  dbBook: Book | null
  onBack: () => void
  onCapture: (reference: string) => void
  onRefresh?: () => void
}

export default function BookDetailPage({
  bibleBook,
  dbBook,
  onBack,
  onCapture,
  onRefresh
}: BookDetailPageProps): React.ReactElement {
  const [selectedChapter, setSelectedChapter] = useState(1)
  const [allNotes, setAllNotes] = useState<NoteWithPassageInfo[]>([])
  const chapterSelectorRef = useRef<HTMLDivElement>(null)

  const reloadNotes = useCallback(async (): Promise<void> => {
    if (dbBook) {
      const notes = await window.api.getNotesByBook(dbBook.id)
      setAllNotes(notes)
    }
    // Always refresh app-level state so sidebar and dbBook stay in sync
    onRefresh?.()
  }, [dbBook?.id, onRefresh])

  useEffect(() => {
    if (dbBook) {
      window.api.getNotesByBook(dbBook.id).then(setAllNotes)
    } else {
      setAllNotes([])
    }
  }, [dbBook?.id])

  const chaptersWithNotes = new Set(allNotes.map(n => n.chapter_start))

  useEffect(() => {
    const sel = chapterSelectorRef.current?.querySelector('.chapter-pill.active') as HTMLElement | null
    sel?.scrollIntoView({ inline: 'nearest', behavior: 'smooth' })
  }, [selectedChapter])

  const studiedCount = chaptersWithNotes.size

  return (
    <div className="book-detail-layout">
      <div className="book-detail-header">
        <button className="book-detail-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Library
        </button>
        <div>
          <h1 className="book-detail-title">{bibleBook.name}</h1>
          <div className="book-detail-meta">
            {bibleBook.chapters} chapters
            {studiedCount > 0 && <> · <span style={{ color: '#7F77DD' }}>{studiedCount} with notes</span></>}
          </div>
        </div>
      </div>

      <div className="chapter-selector-wrap">
        <div className="chapter-selector" ref={chapterSelectorRef}>
          {Array.from({ length: bibleBook.chapters }, (_, i) => i + 1).map(ch => {
            const hasNotes = chaptersWithNotes.has(ch)
            const isActive = ch === selectedChapter
            return (
              <button
                key={ch}
                className={`chapter-pill${isActive ? ' active' : ''}${hasNotes ? ' has-notes' : ''}`}
                onClick={() => setSelectedChapter(ch)}
              >
                {ch}
                {hasNotes && !isActive && <span className="chapter-note-dot" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="book-detail-content">
        <ChapterView
          key={`${bibleBook.name}-${selectedChapter}`}
          bookName={bibleBook.name}
          chapter={selectedChapter}
          notes={allNotes}
          onCaptureChapter={onCapture}
          onNotesChanged={reloadNotes}
        />
      </div>
    </div>
  )
}
