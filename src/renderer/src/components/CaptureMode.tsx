import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import NoteEditor, { makeLineId } from './NoteEditor'
import PassagePane from './PassagePane'
import ReferenceInput from './ReferenceInput'
import { BiblePassage } from '../types'
import { parseNoteLine, parseReferenceLabel } from '../utils/noteParser'
import { findBookByAlias } from '../utils/bibleBooks'

interface LineData {
  id: string
  text: string
}

export interface CaptureModeHandle {
  isDirty: () => boolean
  save: () => Promise<number | null>
}

interface CaptureModeProps {
  initialReference?: string
  initialPassageId?: number | null
  onSaveRead: (passageId: number) => void
  onSaveNext: (nextReference?: string) => void
}

function guessNextReference(label: string): string {
  const m = /^(.*?)(\d+):(\d+)(?:-(\d+))?$/.exec(label.trim())
  if (!m) return ''
  const bookPart = m[1].trim()
  const ch = parseInt(m[2], 10)
  const vs = parseInt(m[3], 10)
  const ve = m[4] ? parseInt(m[4], 10) : vs
  const len = ve - vs
  return `${bookPart} ${ch}:${ve + 1}-${ve + 1 + len}`
}

const CaptureMode = forwardRef<CaptureModeHandle, CaptureModeProps>(function CaptureMode({
  initialReference = '',
  initialPassageId = null,
  onSaveRead,
  onSaveNext
}, ref) {
  const [reference, setReference] = useState(initialReference)
  const [passage, setPassage] = useState<BiblePassage | null>(null)
  const [loadingPassage, setLoadingPassage] = useState(false)
  const [lines, setLines] = useState<LineData[]>([{ id: makeLineId(), text: '' }])
  const [focusedLineId, setFocusedLineId] = useState<string | null>(lines[0].id)
  const [highlightedVerses, setHighlightedVerses] = useState<Set<number>>(new Set())
  const [hasHighlight, setHasHighlight] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialReference) {
      loadPassageByReference(initialReference)
    }
  }, [])

  async function loadPassageByReference(ref: string): Promise<void> {
    if (!ref.trim()) return
    setLoadingPassage(true)
    try {
      const result = await window.api.getBibleVerse(ref.trim())
      if (result) setPassage(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPassage(false)
    }
  }

  const handleCursorLine = useCallback((parsed: ReturnType<typeof parseNoteLine> | null) => {
    if (!parsed || !passage) {
      setHighlightedVerses(new Set())
      setHasHighlight(false)
      return
    }
    if (parsed.anchorStart !== null) {
      const start = parsed.anchorStart
      const end = parsed.anchorEnd ?? start
      const vSet = new Set<number>()
      for (let v = start; v <= end; v++) vSet.add(v)
      setHighlightedVerses(vSet)
      setHasHighlight(true)
    } else {
      setHighlightedVerses(new Set())
      setHasHighlight(false)
    }
  }, [passage])

  async function saveNotes(passageId: number, sessionId: number): Promise<void> {
    const nonEmpty = lines.filter(l => l.text.trim())
    for (const line of nonEmpty) {
      const parsed = parseNoteLine(line.text)
      await window.api.createNote({
        session_id: sessionId,
        content: line.text,
        anchor_start_verse: parsed.anchorStart,
        anchor_end_verse: parsed.anchorEnd,
        anchor_book_override: null,
        anchor_chapter_override: null,
        category: parsed.category
      })
    }
  }

  async function ensurePassageAndSession(): Promise<{ passageId: number; sessionId: number } | null> {
    if (!reference.trim()) return null
    const parsed = parseReferenceLabel(reference)
    if (!parsed) return null
    const bookNameMatch = reference.trim().match(/^([\d\s]?[a-zA-Z\s]+?)(?=\s+\d)/)
    const bookName = bookNameMatch ? bookNameMatch[1].trim() : ''
    const bookInfo = findBookByAlias(bookName)
    const book = await window.api.upsertBook(
      bookInfo?.name || bookName,
      bookInfo?.abbreviation || bookName.slice(0, 3)
    )
    const newPassage = await window.api.createPassage({
      book_id: book.id,
      chapter_start: parsed.chapter_start,
      verse_start: parsed.verse_start,
      chapter_end: parsed.chapter_end,
      verse_end: parsed.verse_end,
      reference_label: reference.trim()
    })
    const session = await window.api.createSession(newPassage.id)
    return { passageId: newPassage.id, sessionId: session.id }
  }

  useImperativeHandle(ref, () => ({
    isDirty: () => lines.some(l => l.text.trim() !== ''),
    save: async () => {
      const ids = await ensurePassageAndSession()
      if (!ids) return null
      await saveNotes(ids.passageId, ids.sessionId)
      return ids.passageId
    }
  }), [lines, reference])

  const handleSaveRead = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const ids = await ensurePassageAndSession()
      if (!ids) return
      await saveNotes(ids.passageId, ids.sessionId)
      onSaveRead(ids.passageId)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNext = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const ids = await ensurePassageAndSession()
      if (!ids) return
      await saveNotes(ids.passageId, ids.sessionId)
      const nextRef = guessNextReference(reference)
      onSaveNext(nextRef)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="capture-layout">
      <div className="capture-left">
        <div className="passage-heading-wrap">
          <ReferenceInput
            className="passage-heading-input"
            value={reference}
            onChange={setReference}
            onSubmit={loadPassageByReference}
            placeholder="e.g. 1 Corinthians 7:1-15"
          />
          <div className="passage-heading-hint">Press Enter or Tab to load verse text</div>
        </div>

        <NoteEditor
          lines={lines}
          focusedLineId={focusedLineId}
          onChange={setLines}
          onFocusChange={setFocusedLineId}
          onCursorLine={handleCursorLine}
          onVerseHover={() => {}}
        />

        <div className="capture-actions">
          <button
            className="btn-action btn-save-read"
            onClick={handleSaveRead}
            disabled={saving || !reference.trim()}
          >
            {saving ? (
              'Saving…'
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Save & Read
              </>
            )}
          </button>
          <button
            className="btn-action btn-save-next"
            onClick={handleSaveNext}
            disabled={saving || !reference.trim()}
          >
            Save & Next
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="capture-right">
        <PassagePane
          passage={passage}
          loading={loadingPassage}
          highlightedVerses={highlightedVerses}
          hasAnyHighlight={hasHighlight}
        />
      </div>
    </div>
  )
})

export default CaptureMode
