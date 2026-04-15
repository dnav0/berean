export type NoteCategory = 'observation' | 'historical' | 'application' | 'personal'

export interface Book {
  id: number
  name: string
  abbreviation: string
}

export interface Passage {
  id: number
  book_id: number
  chapter_start: number
  verse_start: number
  chapter_end: number
  verse_end: number
  reference_label: string
  session_count?: number
  last_studied?: string
}

export interface Session {
  id: number
  passage_id: number
  created_at: string
}

export interface Note {
  id: number
  session_id: number
  content: string
  anchor_start_verse: number | null
  anchor_end_verse: number | null
  anchor_book_override: string | null
  anchor_chapter_override: number | null
  category: NoteCategory | null
  created_at: string
}

export interface ThematicEntry {
  id: number
  title: string
  content: string
  created_at: string
}

export interface BibleVerse {
  verse: number
  text: string
}

export interface BiblePassage {
  reference: string
  text: string
  verses: BibleVerse[]
}

export type NoteSegmentType = 'text' | 'verse-anchor' | 'cross-ref' | 'tag'

export interface NoteSegment {
  type: NoteSegmentType
  raw: string
  display: string
  data?: {
    startVerse?: number
    endVerse?: number
    reference?: string
    category?: NoteCategory
  }
}

export interface ParsedNote {
  segments: NoteSegment[]
  anchorStart: number | null
  anchorEnd: number | null
  category: NoteCategory | null
  crossRefs: string[]
}

// Note enriched with its passage's chapter/verse span (returned by notes:getByBook)
export interface NoteWithPassageInfo extends Note {
  chapter_start: number
  chapter_end: number
  verse_start: number
  verse_end: number
  reference_label: string
}

// IPC input shapes
export interface CreatePassageInput {
  book_id: number
  chapter_start: number
  verse_start: number
  chapter_end: number
  verse_end: number
  reference_label: string
}

export interface CreateNoteInput {
  session_id: number
  content: string
  anchor_start_verse: number | null
  anchor_end_verse: number | null
  anchor_book_override: string | null
  anchor_chapter_override: number | null
  category: NoteCategory | null
}

export interface PassageWithNotes {
  passage: Passage
  sessions: Array<Session & { notes: Note[] }>
}
