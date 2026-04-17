/**
 * vault.ts — Write-through Markdown vault
 *
 * Every note write to SQLite is mirrored to a human-readable .md file at:
 *   <vaultPath>/
 *     notes/{BookName}/{reference_label}.md   ← one file per passage
 *
 * SQLite remains the primary store (all reads hit the DB).
 * The vault is a safety-net: plaintext, portable, Obsidian-compatible.
 *
 * Vault path is persisted in userData/berean-settings.json.
 * On first launch (no settings file) the caller should prompt the user
 * to choose a folder and call setVaultPath() before initVault().
 *
 * Markdown format for a passage file:
 * ---
 * reference: Romans 8:1-11
 * book: Romans
 * chapter_start: 8
 * verse_start: 1
 * chapter_end: 8
 * verse_end: 11
 * updated: 2025-04-16T10:30:00Z
 * ---
 *
 * - [v1-2] @observation Paul opens with a verdict — no condemnation...
 * - @historical Condemnation is a legal term...
 */

import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import Database from 'better-sqlite3'

// ─── Settings persistence ─────────────────────────────────────────────────────

interface BereanSettings {
  vaultPath?: string
  bibleTranslation?: string
  esvApiKey?: string
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'berean-settings.json')
}

function readSettings(): BereanSettings {
  try {
    if (existsSync(settingsPath())) {
      return JSON.parse(readFileSync(settingsPath(), 'utf8')) as BereanSettings
    }
  } catch {}
  return {}
}

function writeSettings(s: BereanSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2), 'utf8')
}

/** Default vault root when the user hasn't chosen one yet. */
function defaultVaultPath(): string {
  return join(app.getPath('documents'), 'Berean')
}

// ─── Vault root ──────────────────────────────────────────────────────────────

/** Returns the configured vault path, falling back to ~/Documents/Berean. */
export function getVaultPath(): string {
  return readSettings().vaultPath ?? defaultVaultPath()
}

/** Persist a new vault root. Does NOT move existing files. */
export function setVaultPath(newPath: string): void {
  writeSettings({ ...readSettings(), vaultPath: newPath })
}

/** True if the user has explicitly chosen a vault location. */
export function isVaultConfigured(): boolean {
  return readSettings().vaultPath !== undefined
}

/** Returns the active Bible translation slug (default: 'web'). */
export function getBibleTranslation(): string {
  return readSettings().bibleTranslation ?? 'web'
}

/** Returns the user-supplied ESV API key (empty string if unset). */
export function getEsvApiKey(): string {
  return readSettings().esvApiKey ?? ''
}

/** Persist a new translation choice and optional ESV API key. */
export function setBibleTranslation(translation: string, esvApiKey?: string): void {
  const current = readSettings()
  writeSettings({
    ...current,
    bibleTranslation: translation,
    ...(esvApiKey !== undefined ? { esvApiKey } : {})
  })
}

export function initVault(): void {
  try {
    const base = getVaultPath()
    mkdirSync(join(base, 'notes'), { recursive: true })
  } catch (err) {
    console.error('[vault] initVault error:', err)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Make a string safe for use as a filename on macOS, Windows, and Linux. */
function safeFilename(s: string): string {
  return s
    .replace(/:/g, '.')     // "Romans 8:1-11" → "Romans 8.1-11"
    .replace(/[\\/?*"|<>]/g, '')
    .trim()
}

function passageFilepath(bookName: string, referenceLabel: string): string {
  return join(getVaultPath(), 'notes', bookName, safeFilename(referenceLabel) + '.md')
}

// ─── Passage vault operations ─────────────────────────────────────────────────

interface PassageRow {
  id: number
  reference_label: string
  chapter_start: number
  verse_start: number
  chapter_end: number
  verse_end: number
  book_name: string
}

/**
 * Re-read all notes for `passageId` from the DB and rewrite the .md file.
 * Call this after any create / update / delete of a note under this passage.
 */
export function syncPassageToVault(db: Database.Database, passageId: number): void {
  try {
    const passage = db.prepare(`
      SELECT p.id, p.reference_label,
             p.chapter_start, p.verse_start, p.chapter_end, p.verse_end,
             b.name AS book_name
      FROM Passages p
      JOIN Books b ON b.id = p.book_id
      WHERE p.id = ?
    `).get(passageId) as PassageRow | undefined
    if (!passage) return

    const notes = db.prepare(`
      SELECT n.content FROM Notes n
      JOIN Sessions s ON s.id = n.session_id
      WHERE s.passage_id = ?
      ORDER BY n.anchor_start_verse NULLS LAST, n.created_at
    `).all(passageId) as { content: string }[]

    const bookDir = join(getVaultPath(), 'notes', passage.book_name)
    mkdirSync(bookDir, { recursive: true })

    const lines = [
      '---',
      `reference: ${passage.reference_label}`,
      `book: ${passage.book_name}`,
      `chapter_start: ${passage.chapter_start}`,
      `verse_start: ${passage.verse_start}`,
      `chapter_end: ${passage.chapter_end}`,
      `verse_end: ${passage.verse_end}`,
      `updated: ${new Date().toISOString()}`,
      '---',
      '',
      ...notes.map(n => `- ${n.content}`),
      '',
    ]

    writeFileSync(passageFilepath(passage.book_name, passage.reference_label), lines.join('\n'), 'utf8')
  } catch (err) {
    console.error('[vault] syncPassageToVault error:', err)
  }
}

/**
 * Delete the passage .md file.
 * Accepts pre-fetched strings because this is called *after* the passage
 * has already been removed from the DB (so we can't look it up).
 */
export function deletePassageFile(bookName: string, referenceLabel: string): void {
  try {
    const fp = passageFilepath(bookName, referenceLabel)
    if (existsSync(fp)) unlinkSync(fp)
  } catch (err) {
    console.error('[vault] deletePassageFile error:', err)
  }
}

