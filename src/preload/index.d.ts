import { Book, Passage, Session, Note, NoteWithPassageInfo, ThematicEntry, BiblePassage, PassageWithNotes } from '../renderer/src/types'

declare global {
  interface Window {
    api: {
      getBooks: () => Promise<Book[]>
      upsertBook: (name: string, abbreviation: string) => Promise<Book>

      getPassages: () => Promise<Passage[]>
      getPassagesByBook: (bookId: number) => Promise<Passage[]>
      getPassageById: (id: number) => Promise<Passage | null>
      createPassage: (data: {
        book_id: number
        chapter_start: number
        verse_start: number
        chapter_end: number
        verse_end: number
        reference_label: string
      }) => Promise<Passage>
      getPassageWithNotes: (passageId: number) => Promise<PassageWithNotes | null>

      getSessionsByPassage: (passageId: number) => Promise<Session[]>
      createSession: (passageId: number) => Promise<Session>

      getNotesByBook: (bookId: number) => Promise<NoteWithPassageInfo[]>
      getNotesBySession: (sessionId: number) => Promise<Note[]>
      getNotesByPassage: (passageId: number) => Promise<Note[]>
      createNote: (data: {
        session_id: number
        content: string
        anchor_start_verse: number | null
        anchor_end_verse: number | null
        anchor_book_override: string | null
        anchor_chapter_override: number | null
        category: string | null
      }) => Promise<Note>
      updateNote: (id: number, data: {
        content?: string
        anchor_start_verse?: number | null
        anchor_end_verse?: number | null
        category?: string | null
      }) => Promise<Note>
      deleteNote: (id: number) => Promise<void>
      deleteNoteAndCascade: (id: number) => Promise<{ deletedNoteId?: number; deletedSessionId?: number; deletedPassageId?: number; deletedBookId?: number }>
      deletePassageAll: (passageId: number) => Promise<{ deletedPassageId: number; deletedBookId?: number }>

      getThemes: () => Promise<ThematicEntry[]>
      createTheme: (title: string, content: string) => Promise<ThematicEntry>
      updateTheme: (id: number, title: string, content: string) => Promise<ThematicEntry>

      getBibleVerse: (reference: string) => Promise<BiblePassage | null>

      getTranslation: () => Promise<{ translation: string; esvApiKey: string }>
      setTranslation: (translation: string, esvApiKey?: string) => Promise<void>

      isVaultConfigured: () => Promise<boolean>
      confirmDefaultVault: () => Promise<string>
      getVaultPath: () => Promise<string>
      chooseVaultPath: () => Promise<string | null>
      openVaultFolder: () => Promise<void>
    }
  }
}
