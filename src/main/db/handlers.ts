import { ipcMain, dialog, shell } from 'electron'
import Database from 'better-sqlite3'
import { initVault } from './vault'
import {
  syncPassageToVault,
  deletePassageFile,
  syncThemeToVault,
  renameThemeFile,
  getVaultPath,
  setVaultPath
} from './vault'

export function registerHandlers(db: Database.Database): void {

  // ─── Vault ──────────────────────────────────────────────────────────────────

  ipcMain.handle('vault:getPath', () => getVaultPath())

  ipcMain.handle('vault:choosePath', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Berean vault location',
      buttonLabel: 'Choose folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getVaultPath()
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const chosen = result.filePaths[0]
    setVaultPath(chosen)
    initVault()          // create notes/ and themes/ subdirs in the new location
    return chosen
  })

  ipcMain.handle('vault:openFolder', () => {
    shell.openPath(getVaultPath())
  })

  // ─── Books ──────────────────────────────────────────────────────────────────

  ipcMain.handle('books:getAll', () => {
    return db.prepare('SELECT * FROM Books ORDER BY name').all()
  })

  ipcMain.handle('books:upsert', (_e, name: string, abbreviation: string) => {
    const existing = db.prepare('SELECT * FROM Books WHERE name = ?').get(name)
    if (existing) return existing
    const result = db.prepare('INSERT INTO Books (name, abbreviation) VALUES (?, ?)').run(name, abbreviation)
    return db.prepare('SELECT * FROM Books WHERE id = ?').get(result.lastInsertRowid)
  })

  // ─── Passages ───────────────────────────────────────────────────────────────

  ipcMain.handle('passages:getAll', () => {
    return db.prepare(`
      SELECT p.*,
             COUNT(s.id) AS session_count,
             MAX(s.created_at) AS last_studied
      FROM Passages p
      LEFT JOIN Sessions s ON s.passage_id = p.id
      GROUP BY p.id
      ORDER BY p.reference_label
    `).all()
  })

  ipcMain.handle('passages:getByBook', (_e, bookId: number) => {
    return db.prepare(`
      SELECT p.*,
             COUNT(s.id) AS session_count,
             MAX(s.created_at) AS last_studied
      FROM Passages p
      LEFT JOIN Sessions s ON s.passage_id = p.id
      WHERE p.book_id = ?
      GROUP BY p.id
      ORDER BY p.chapter_start, p.verse_start
    `).all(bookId)
  })

  ipcMain.handle('passages:getById', (_e, id: number) => {
    return db.prepare('SELECT * FROM Passages WHERE id = ?').get(id)
  })

  ipcMain.handle('passages:create', (_e, data: {
    book_id: number
    chapter_start: number
    verse_start: number
    chapter_end: number
    verse_end: number
    reference_label: string
  }) => {
    const result = db.prepare(`
      INSERT INTO Passages (book_id, chapter_start, verse_start, chapter_end, verse_end, reference_label)
      VALUES (@book_id, @chapter_start, @verse_start, @chapter_end, @verse_end, @reference_label)
    `).run(data)
    return db.prepare('SELECT * FROM Passages WHERE id = ?').get(result.lastInsertRowid)
  })

  // ─── Sessions ───────────────────────────────────────────────────────────────

  ipcMain.handle('sessions:getByPassage', (_e, passageId: number) => {
    return db.prepare('SELECT * FROM Sessions WHERE passage_id = ? ORDER BY created_at DESC').all(passageId)
  })

  ipcMain.handle('sessions:create', (_e, passageId: number) => {
    const result = db.prepare('INSERT INTO Sessions (passage_id) VALUES (?)').run(passageId)
    return db.prepare('SELECT * FROM Sessions WHERE id = ?').get(result.lastInsertRowid)
  })

  // ─── Notes ──────────────────────────────────────────────────────────────────

  ipcMain.handle('notes:getBySession', (_e, sessionId: number) => {
    return db.prepare('SELECT * FROM Notes WHERE session_id = ? ORDER BY created_at').all(sessionId)
  })

  ipcMain.handle('notes:getByBook', (_e, bookId: number) => {
    return db.prepare(`
      SELECT n.*,
             p.chapter_start, p.chapter_end, p.verse_start, p.verse_end, p.reference_label
      FROM Notes n
      JOIN Sessions s ON s.id = n.session_id
      JOIN Passages p ON p.id = s.passage_id
      WHERE p.book_id = ?
      ORDER BY p.chapter_start, n.anchor_start_verse
    `).all(bookId)
  })

  ipcMain.handle('notes:getByPassage', (_e, passageId: number) => {
    return db.prepare(`
      SELECT n.* FROM Notes n
      JOIN Sessions s ON s.id = n.session_id
      WHERE s.passage_id = ?
      ORDER BY n.anchor_start_verse NULLS LAST, n.created_at
    `).all(passageId)
  })

  ipcMain.handle('notes:create', (_e, data: {
    session_id: number
    content: string
    anchor_start_verse: number | null
    anchor_end_verse: number | null
    anchor_book_override: string | null
    anchor_chapter_override: number | null
    category: string | null
  }) => {
    const result = db.prepare(`
      INSERT INTO Notes
        (session_id, content, anchor_start_verse, anchor_end_verse,
         anchor_book_override, anchor_chapter_override, category)
      VALUES
        (@session_id, @content, @anchor_start_verse, @anchor_end_verse,
         @anchor_book_override, @anchor_chapter_override, @category)
    `).run(data)
    const note = db.prepare('SELECT * FROM Notes WHERE id = ?').get(result.lastInsertRowid) as { session_id: number } | undefined

    // Vault: rewrite the passage file with the new note
    if (note) {
      const sess = db.prepare('SELECT passage_id FROM Sessions WHERE id = ?').get(data.session_id) as { passage_id: number } | undefined
      if (sess) syncPassageToVault(db, sess.passage_id)
    }

    return note
  })

  ipcMain.handle('notes:update', (_e, id: number, data: {
    content?: string
    anchor_start_verse?: number | null
    anchor_end_verse?: number | null
    category?: string | null
  }) => {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE Notes SET ${fields} WHERE id = @id`).run({ ...data, id })
    const updated = db.prepare('SELECT * FROM Notes WHERE id = ?').get(id) as { session_id: number } | undefined

    // Vault: rewrite the passage file with the updated note
    if (updated) {
      const sess = db.prepare('SELECT passage_id FROM Sessions WHERE id = ?').get(updated.session_id) as { passage_id: number } | undefined
      if (sess) syncPassageToVault(db, sess.passage_id)
    }

    return updated
  })

  ipcMain.handle('notes:delete', (_e, id: number) => {
    // Get passage context before deletion
    const ctx = db.prepare(`
      SELECT s.passage_id FROM Notes n
      JOIN Sessions s ON s.id = n.session_id
      WHERE n.id = ?
    `).get(id) as { passage_id: number } | undefined

    db.prepare('DELETE FROM Notes WHERE id = ?').run(id)

    // Vault: rewrite the passage file (minus the deleted note)
    if (ctx) syncPassageToVault(db, ctx.passage_id)
  })

  ipcMain.handle('notes:deleteAndCascade', (_e, noteId: number) => {
    // Fetch everything we need BEFORE deleting (cascade may remove the passage from DB)
    const ctx = db.prepare(`
      SELECT n.session_id, s.passage_id,
             p.reference_label, b.name AS book_name
      FROM Notes n
      JOIN Sessions s ON s.id = n.session_id
      JOIN Passages p ON p.id = s.passage_id
      JOIN Books b ON b.id = p.book_id
      WHERE n.id = ?
    `).get(noteId) as {
      session_id: number
      passage_id: number
      reference_label: string
      book_name: string
    } | undefined

    if (!ctx) return {}

    db.prepare('DELETE FROM Notes WHERE id = ?').run(noteId)

    const remaining = (db.prepare('SELECT COUNT(*) as c FROM Notes WHERE session_id = ?').get(ctx.session_id) as { c: number }).c
    if (remaining > 0) {
      syncPassageToVault(db, ctx.passage_id) // passage still has notes
      return { deletedNoteId: noteId }
    }

    db.prepare('DELETE FROM Sessions WHERE id = ?').run(ctx.session_id)

    const remSessions = (db.prepare('SELECT COUNT(*) as c FROM Sessions WHERE passage_id = ?').get(ctx.passage_id) as { c: number }).c
    if (remSessions > 0) {
      syncPassageToVault(db, ctx.passage_id) // passage still has other sessions
      return { deletedNoteId: noteId, deletedSessionId: ctx.session_id }
    }

    // Passage is now empty — delete the vault file BEFORE removing from DB
    deletePassageFile(ctx.book_name, ctx.reference_label)

    const passage = db.prepare('SELECT book_id FROM Passages WHERE id = ?').get(ctx.passage_id) as { book_id: number } | undefined
    db.prepare('DELETE FROM Passages WHERE id = ?').run(ctx.passage_id)
    if (!passage) return { deletedNoteId: noteId, deletedSessionId: ctx.session_id, deletedPassageId: ctx.passage_id }

    const remPassages = (db.prepare('SELECT COUNT(*) as c FROM Passages WHERE book_id = ?').get(passage.book_id) as { c: number }).c
    if (remPassages > 0) return { deletedNoteId: noteId, deletedSessionId: ctx.session_id, deletedPassageId: ctx.passage_id }

    db.prepare('DELETE FROM Books WHERE id = ?').run(passage.book_id)
    return { deletedNoteId: noteId, deletedSessionId: ctx.session_id, deletedPassageId: ctx.passage_id, deletedBookId: passage.book_id }
  })

  ipcMain.handle('passages:deleteAll', (_e, passageId: number) => {
    // Fetch passage info BEFORE deleting (we need it to delete the vault file)
    const passageCtx = db.prepare(`
      SELECT p.reference_label, b.name AS book_name
      FROM Passages p JOIN Books b ON b.id = p.book_id
      WHERE p.id = ?
    `).get(passageId) as { reference_label: string; book_name: string } | undefined

    // Vault: delete the passage file
    if (passageCtx) deletePassageFile(passageCtx.book_name, passageCtx.reference_label)

    const passage = db.prepare('SELECT book_id FROM Passages WHERE id = ?').get(passageId) as { book_id: number } | undefined
    db.prepare('DELETE FROM Notes WHERE session_id IN (SELECT id FROM Sessions WHERE passage_id = ?)').run(passageId)
    db.prepare('DELETE FROM Sessions WHERE passage_id = ?').run(passageId)
    db.prepare('DELETE FROM Passages WHERE id = ?').run(passageId)
    if (!passage) return { deletedPassageId: passageId }
    const remPassages = (db.prepare('SELECT COUNT(*) as c FROM Passages WHERE book_id = ?').get(passage.book_id) as { c: number }).c
    if (remPassages > 0) return { deletedPassageId: passageId }
    db.prepare('DELETE FROM Books WHERE id = ?').run(passage.book_id)
    return { deletedPassageId: passageId, deletedBookId: passage.book_id }
  })

  // ─── Thematic Entries ───────────────────────────────────────────────────────

  ipcMain.handle('themes:getAll', () => {
    return db.prepare('SELECT * FROM ThematicEntries ORDER BY created_at DESC').all()
  })

  ipcMain.handle('themes:create', (_e, title: string, content: string) => {
    const result = db.prepare('INSERT INTO ThematicEntries (title, content) VALUES (?, ?)').run(title, content)
    const theme = db.prepare('SELECT * FROM ThematicEntries WHERE id = ?').get(result.lastInsertRowid) as { title: string; content: string } | undefined
    if (theme) syncThemeToVault(theme.title, theme.content)
    return theme
  })

  ipcMain.handle('themes:update', (_e, id: number, title: string, content: string) => {
    // Get old title so we can rename the vault file if it changed
    const old = db.prepare('SELECT title FROM ThematicEntries WHERE id = ?').get(id) as { title: string } | undefined
    db.prepare('UPDATE ThematicEntries SET title = ?, content = ? WHERE id = ?').run(title, content, id)
    const updated = db.prepare('SELECT * FROM ThematicEntries WHERE id = ?').get(id) as { title: string; content: string } | undefined

    // Vault: rename if title changed, otherwise just overwrite
    if (updated) {
      if (old && old.title !== title) {
        renameThemeFile(old.title, title, content)
      } else {
        syncThemeToVault(title, content)
      }
    }

    return updated
  })

  // ─── Bible verse cache ──────────────────────────────────────────────────────

  ipcMain.handle('bible:getVerse', async (_e, reference: string) => {
    const key = reference.toLowerCase().trim()

    const cached = db.prepare('SELECT * FROM BibleVerseCache WHERE reference = ?').get(key) as
      | { reference: string; text: string; verses_json: string }
      | undefined
    if (cached) {
      return { reference, text: cached.text, verses: JSON.parse(cached.verses_json) }
    }

    try {
      const encoded = encodeURIComponent(reference)
      const res = await fetch(`https://bible-api.com/${encoded}?translation=web`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        reference: string
        text: string
        verses: Array<{ verse: number; text: string; book_name: string; chapter: number }>
      }

      const verses = (data.verses || []).map(v => ({ verse: v.verse, text: v.text.trim() }))
      const text = data.text?.trim() || verses.map(v => v.text).join(' ')

      db.prepare(`
        INSERT OR REPLACE INTO BibleVerseCache (reference, text, verses_json)
        VALUES (?, ?, ?)
      `).run(key, text, JSON.stringify(verses))

      return { reference: data.reference, text, verses }
    } catch (err) {
      console.error('Bible API error:', err)
      return null
    }
  })

  // ─── Passage with all notes ──────────────────────────────────────────────────

  ipcMain.handle('passages:withNotes', (_e, passageId: number) => {
    const passage = db.prepare('SELECT * FROM Passages WHERE id = ?').get(passageId)
    if (!passage) return null

    const sessions = db.prepare('SELECT * FROM Sessions WHERE passage_id = ? ORDER BY created_at').all(passageId) as Array<{ id: number; passage_id: number; created_at: string }>

    const result = sessions.map(s => ({
      ...s,
      notes: db.prepare('SELECT * FROM Notes WHERE session_id = ? ORDER BY created_at').all(s.id)
    }))

    return { passage, sessions: result }
  })
}
