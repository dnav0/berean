import React, { useState, useEffect } from 'react'
import { Note, NoteCategory, Passage } from '../types'
import { parseNoteLine } from '../utils/noteParser'
import InlineTagInput from './InlineTagInput'
import ConfirmDialog from './ConfirmDialog'

interface NoteCardEditProps {
  note: Note
  onSave: (id: number, content: string) => Promise<void>
  onDelete: (note: Note) => void
  onHighlight: (note: Note | null) => void
  isHighlighted: boolean
}

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  observation: 'Observation',
  historical: 'Historical',
  application: 'Application',
  personal: 'Personal'
}

function NoteCardEdit({ note, onSave, onDelete, onHighlight, isHighlighted }: NoteCardEditProps): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(note.content)

  const handleSave = async (): Promise<void> => {
    if (!editText.trim()) return
    await onSave(note.id, editText)
    setEditing(false)
  }

  return (
    <div
      className={`se-note-card cat-${note.category || 'none'}${isHighlighted ? ' highlighted' : ''}`}
      onClick={() => !editing && onHighlight(note)}
    >
      {note.category && (
        <div className={`reading-note-meta cat-${note.category}`}>{CATEGORY_LABELS[note.category]}</div>
      )}

      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 2 }}>
          <InlineTagInput
            value={editText}
            onChange={setEditText}
            onEnter={handleSave}
            onEscape={() => { setEditing(false); setEditText(note.content) }}
            className="se-edit-input"
            autoFocus
          />
          <button className="se-save-btn" onClick={handleSave} title="Save">✓</button>
          <button className="se-cancel-btn" onClick={() => { setEditing(false); setEditText(note.content) }} title="Cancel">✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, fontSize: 13, color: '#333', lineHeight: 1.6 }}>
            <NoteText content={note.content} />
          </div>
          <div className="se-note-actions">
            <button className="se-icon-btn" title="Edit" onClick={e => { e.stopPropagation(); setEditing(true) }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button className="se-icon-btn se-icon-danger" title="Delete" onClick={e => { e.stopPropagation(); onDelete(note) }}>
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

function NoteText({ content }: { content: string }): React.ReactElement {
  const { segments } = parseNoteLine(content)
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'verse-anchor') return <span key={i} className="pill-verse">{s.display}</span>
        if (s.type === 'tag') return <span key={i} className={`pill-tag-${s.data?.category || 'observation'}`}>{s.display}</span>
        if (s.type === 'cross-ref') return <span key={i} className="pill-crossref">{s.display}</span>
        return <span key={i}>{s.raw}</span>
      })}
    </>
  )
}

interface SessionEditorProps {
  passage: Passage
  onBack: () => void
  onRefresh: () => void
  onPassageDeleted: () => void
}

export default function SessionEditor({ passage, onBack, onRefresh, onPassageDeleted }: SessionEditorProps): React.ReactElement {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null)
  const [confirmDeletePassage, setConfirmDeletePassage] = useState(false)
  const [addText, setAddText] = useState('')

  useEffect(() => {
    window.api.getNotesByPassage(passage.id).then(ns => { setNotes(ns); setLoading(false) })
  }, [passage.id])

  const handleSaveEdit = async (id: number, content: string): Promise<void> => {
    const parsed = parseNoteLine(content)
    const updated = await window.api.updateNote(id, {
      content,
      anchor_start_verse: parsed.anchorStart,
      anchor_end_verse: parsed.anchorEnd,
      category: parsed.category
    })
    setNotes(prev => prev.map(n => n.id === id ? updated : n))
    onRefresh()
  }

  const handleDeleteNote = async (note: Note): Promise<void> => {
    const result = await window.api.deleteNoteAndCascade(note.id)
    const remaining = notes.filter(n => n.id !== note.id)
    setNotes(remaining)
    setConfirmDelete(null)
    onRefresh()
    if (result.deletedPassageId) {
      onPassageDeleted()
    }
  }

  const handleDeletePassage = async (): Promise<void> => {
    await window.api.deletePassageAll(passage.id)
    setConfirmDeletePassage(false)
    onRefresh()
    onPassageDeleted()
  }

  const handleAddNote = async (): Promise<void> => {
    if (!addText.trim()) return
    const parsed = parseNoteLine(addText)
    const sessions = await window.api.getSessionsByPassage(passage.id)
    let sessionId: number
    if (sessions.length > 0) {
      sessionId = sessions[0].id
    } else {
      const s = await window.api.createSession(passage.id)
      sessionId = s.id
    }
    const note = await window.api.createNote({
      session_id: sessionId,
      content: addText,
      anchor_start_verse: parsed.anchorStart,
      anchor_end_verse: parsed.anchorEnd,
      anchor_book_override: null,
      anchor_chapter_override: null,
      category: parsed.category
    })
    setNotes(prev => [...prev, note])
    setAddText('')
    onRefresh()
  }

  return (
    <div className="session-editor">
      {/* Header */}
      <div className="session-editor-header">
        <button className="book-detail-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="session-editor-title">{passage.reference_label}</h2>
          <button
            className="se-delete-passage-btn"
            onClick={() => setConfirmDeletePassage(true)}
            title="Delete all notes for this passage"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
            Delete all
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="session-editor-body">
        {loading ? (
          <div className="loading-dots">Loading…</div>
        ) : notes.length === 0 ? (
          <div className="empty-state" style={{ height: 'auto', padding: '24px 0' }}>
            <div className="empty-state-sub">No notes yet</div>
          </div>
        ) : (
          notes.map(note => (
            <NoteCardEdit
              key={note.id}
              note={note}
              onSave={handleSaveEdit}
              onDelete={n => setConfirmDelete(n)}
              onHighlight={n => setHighlightedId(n ? n.id : null)}
              isHighlighted={note.id === highlightedId}
            />
          ))
        )}

        {/* Add new note */}
        <div className="se-add-row">
          <span style={{ color: '#CCC', fontSize: 15, flexShrink: 0 }}>•</span>
          <InlineTagInput
            value={addText}
            onChange={setAddText}
            onEnter={handleAddNote}
            className="se-add-input"
            placeholder="Add a note… (v4, @obs, Matt 5:9)"
          />
        </div>
      </div>

      {/* Delete note confirmation */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Delete note?"
        message={confirmDelete ? `"${confirmDelete.content.slice(0, 60)}${confirmDelete.content.length > 60 ? '…' : ''}"` : undefined}
        onClose={() => setConfirmDelete(null)}
        actions={[
          { label: 'Delete', variant: 'danger', onClick: () => confirmDelete && handleDeleteNote(confirmDelete), autoFocus: false },
          { label: 'Cancel', variant: 'ghost', onClick: () => setConfirmDelete(null), autoFocus: true }
        ]}
      />

      {/* Delete passage confirmation */}
      <ConfirmDialog
        isOpen={confirmDeletePassage}
        title={`Delete "${passage.reference_label}"?`}
        message="This will permanently delete all notes for this passage."
        onClose={() => setConfirmDeletePassage(false)}
        actions={[
          { label: 'Delete all', variant: 'danger', onClick: handleDeletePassage, autoFocus: false },
          { label: 'Cancel', variant: 'ghost', onClick: () => setConfirmDeletePassage(false), autoFocus: true }
        ]}
      />
    </div>
  )
}
