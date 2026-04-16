import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Books
  getBooks: () => ipcRenderer.invoke('books:getAll'),
  upsertBook: (name: string, abbreviation: string) => ipcRenderer.invoke('books:upsert', name, abbreviation),

  // Passages
  getPassages: () => ipcRenderer.invoke('passages:getAll'),
  getPassagesByBook: (bookId: number) => ipcRenderer.invoke('passages:getByBook', bookId),
  getPassageById: (id: number) => ipcRenderer.invoke('passages:getById', id),
  createPassage: (data: {
    book_id: number
    chapter_start: number
    verse_start: number
    chapter_end: number
    verse_end: number
    reference_label: string
  }) => ipcRenderer.invoke('passages:create', data),
  getPassageWithNotes: (passageId: number) => ipcRenderer.invoke('passages:withNotes', passageId),

  // Sessions
  getSessionsByPassage: (passageId: number) => ipcRenderer.invoke('sessions:getByPassage', passageId),
  createSession: (passageId: number) => ipcRenderer.invoke('sessions:create', passageId),

  // Notes
  getNotesBySession: (sessionId: number) => ipcRenderer.invoke('notes:getBySession', sessionId),
  getNotesByBook: (bookId: number) => ipcRenderer.invoke('notes:getByBook', bookId),
  getNotesByPassage: (passageId: number) => ipcRenderer.invoke('notes:getByPassage', passageId),
  createNote: (data: {
    session_id: number
    content: string
    anchor_start_verse: number | null
    anchor_end_verse: number | null
    anchor_book_override: string | null
    anchor_chapter_override: number | null
    category: string | null
  }) => ipcRenderer.invoke('notes:create', data),
  updateNote: (id: number, data: {
    content?: string
    anchor_start_verse?: number | null
    anchor_end_verse?: number | null
    category?: string | null
  }) => ipcRenderer.invoke('notes:update', id, data),
  deleteNote: (id: number) => ipcRenderer.invoke('notes:delete', id),
  deleteNoteAndCascade: (id: number) => ipcRenderer.invoke('notes:deleteAndCascade', id),
  deletePassageAll: (passageId: number) => ipcRenderer.invoke('passages:deleteAll', passageId),

  // Themes
  getThemes: () => ipcRenderer.invoke('themes:getAll'),
  createTheme: (title: string, content: string) => ipcRenderer.invoke('themes:create', title, content),
  updateTheme: (id: number, title: string, content: string) => ipcRenderer.invoke('themes:update', id, title, content),

  // Bible
  getBibleVerse: (reference: string) => ipcRenderer.invoke('bible:getVerse', reference),

  // Translation settings
  getTranslation: () => ipcRenderer.invoke('settings:getTranslation'),
  setTranslation: (translation: string, esvApiKey?: string) =>
    ipcRenderer.invoke('settings:setTranslation', translation, esvApiKey),

  // Vault
  getVaultPath: () => ipcRenderer.invoke('vault:getPath'),
  chooseVaultPath: () => ipcRenderer.invoke('vault:choosePath'),
  openVaultFolder: () => ipcRenderer.invoke('vault:openFolder')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore
  window.api = api
}
