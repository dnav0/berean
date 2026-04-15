import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

export function registerHandlers(db: Database.Database): void {
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
    return db.prepare('SELECT * FROM Notes WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('notes:deleteAndCascade', (_e, noteId: number) => {
    const note = db.prepare('SELECT session_id FROM Notes WHERE id = ?').get(noteId) as { session_id: number } | undefined
    if (!note) return {}
    db.prepare('DELETE FROM Notes WHERE id = ?').run(noteId)

    const remaining = (db.prepare('SELECT COUNT(*) as c FROM Notes WHERE session_id = ?').get(note.session_id) as { c: number }).c
    if (remaining > 0) return { deletedNoteId: noteId }

    const sess = db.prepare('SELECT passage_id FROM Sessions WHERE id = ?').get(note.session_id) as { passage_id: number } | undefined
    db.prepare('DELETE FROM Sessions WHERE id = ?').run(note.session_id)
    if (!sess) return { deletedNoteId: noteId, deletedSessionId: note.session_id }

    const remSessions = (db.prepare('SELECT COUNT(*) as c FROM Sessions WHERE passage_id = ?').get(sess.passage_id) as { c: number }).c
    if (remSessions > 0) return { deletedNoteId: noteId, deletedSessionId: note.session_id }

    const passage = db.prepare('SELECT book_id FROM Passages WHERE id = ?').get(sess.passage_id) as { book_id: number } | undefined
    db.prepare('DELETE FROM Passages WHERE id = ?').run(sess.passage_id)
    if (!passage) return { deletedNoteId: noteId, deletedSessionId: note.session_id, deletedPassageId: sess.passage_id }

    const remPassages = (db.prepare('SELECT COUNT(*) as c FROM Passages WHERE book_id = ?').get(passage.book_id) as { c: number }).c
    if (remPassages > 0) return { deletedNoteId: noteId, deletedSessionId: note.session_id, deletedPassageId: sess.passage_id }

    db.prepare('DELETE FROM Books WHERE id = ?').run(passage.book_id)
    return { deletedNoteId: noteId, deletedSessionId: note.session_id, deletedPassageId: sess.passage_id, deletedBookId: passage.book_id }
  })

  ipcMain.handle('passages:deleteAll', (_e, passageId: number) => {
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

  ipcMain.handle('notes:update', (_e, id: number, data: {
    content?: string
    anchor_start_verse?: number | null
    anchor_end_verse?: number | null
    category?: string | null
  }) => {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE Notes SET ${fields} WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM Notes WHERE id = ?').get(id)
  })

  ipcMain.handle('notes:delete', (_e, id: number) => {
    db.prepare('DELETE FROM Notes WHERE id = ?').run(id)
  })

  // ─── Thematic Entries ───────────────────────────────────────────────────────
  ipcMain.handle('themes:getAll', () => {
    return db.prepare('SELECT * FROM ThematicEntries ORDER BY created_at DESC').all()
  })

  ipcMain.handle('themes:create', (_e, title: string, content: string) => {
    const result = db.prepare('INSERT INTO ThematicEntries (title, content) VALUES (?, ?)').run(title, content)
    return db.prepare('SELECT * FROM ThematicEntries WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('themes:update', (_e, id: number, title: string, content: string) => {
    db.prepare('UPDATE ThematicEntries SET title = ?, content = ? WHERE id = ?').run(title, content, id)
    return db.prepare('SELECT * FROM ThematicEntries WHERE id = ?').get(id)
  })

  // ─── Bible verse cache ──────────────────────────────────────────────────────
  ipcMain.handle('bible:getVerse', async (_e, reference: string) => {
    const key = reference.toLowerCase().trim()

    // Check cache first
    const cached = db.prepare('SELECT * FROM BibleVerseCache WHERE reference = ?').get(key) as
      | { reference: string; text: string; verses_json: string }
      | undefined
    if (cached) {
      return { reference, text: cached.text, verses: JSON.parse(cached.verses_json) }
    }

    // Fetch from bible-api.com
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
