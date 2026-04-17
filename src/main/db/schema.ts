import Database from 'better-sqlite3'

export function initSchema(db: Database.Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS Books (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      abbreviation TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Passages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id         INTEGER NOT NULL REFERENCES Books(id),
      chapter_start   INTEGER NOT NULL,
      verse_start     INTEGER NOT NULL,
      chapter_end     INTEGER NOT NULL,
      verse_end       INTEGER NOT NULL,
      reference_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      passage_id  INTEGER NOT NULL REFERENCES Passages(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Notes (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id            INTEGER NOT NULL REFERENCES Sessions(id),
      content               TEXT NOT NULL,
      anchor_start_verse    INTEGER,
      anchor_end_verse      INTEGER,
      anchor_book_override  TEXT,
      anchor_chapter_override INTEGER,
      category              TEXT CHECK(category IN ('observation','historical','application','personal')),
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS BibleVerseCache (
      reference   TEXT NOT NULL,
      translation TEXT NOT NULL DEFAULT 'web',
      text        TEXT NOT NULL,
      verses_json TEXT NOT NULL,
      cached_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (reference, translation)
    );
  `)

  migrateBibleVerseCacheIfNeeded(db)
}

/**
 * One-time migration: if BibleVerseCache was created with the old single-column
 * primary key (no translation column), rename it, recreate with the composite
 * PK, copy existing rows as 'web', then drop the old table.
 */
function migrateBibleVerseCacheIfNeeded(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(BibleVerseCache)').all() as Array<{ name: string }>
  if (cols.some(c => c.name === 'translation')) return

  db.exec(`
    ALTER TABLE BibleVerseCache RENAME TO BibleVerseCache_old;
    CREATE TABLE BibleVerseCache (
      reference   TEXT NOT NULL,
      translation TEXT NOT NULL DEFAULT 'web',
      text        TEXT NOT NULL,
      verses_json TEXT NOT NULL,
      cached_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (reference, translation)
    );
    INSERT INTO BibleVerseCache (reference, translation, text, verses_json, cached_at)
      SELECT reference, 'web', text, verses_json, cached_at FROM BibleVerseCache_old;
    DROP TABLE BibleVerseCache_old;
  `)
}
