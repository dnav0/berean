# Logos — Claude Code knowledge base

## Project overview

Personal Bible study notes desktop app. Electron 33 + React 18 + TypeScript 5 + better-sqlite3 11. The renderer is a React SPA; the main process owns the database. All DB access goes through IPC (`ipcMain.handle` / `ipcRenderer.invoke`) with a typed context bridge.

---

## File map

```
src/
  main/
    index.ts              Electron entry — creates BrowserWindow, initialises DB, registers IPC
    db/
      schema.ts           CREATE TABLE statements, WAL mode, foreign keys
      handlers.ts         All ipcMain.handle registrations (CRUD + cascade delete + Bible cache)
  preload/
    index.ts              contextBridge.exposeInMainWorld — wraps ipcRenderer.invoke calls
    index.d.ts            window.api type declaration (keep in sync with index.ts)
  renderer/src/
    App.tsx               Top-level router/state (viewMode, selectedPassageId, selectedBookName, etc.)
    types/index.ts        Shared TypeScript interfaces
    assets/main.css       All styles — no CSS framework
    utils/
      bibleBooks.ts       BIBLE_BOOKS array (all 66 books, chapter counts, aliases), findBookByAlias()
      noteParser.ts       parseNoteLine() — tokenises v5, @tag, cross-refs; parseReferenceLabel()
    components/
      Sidebar.tsx         Mode toggle, books tree with passage edit icon, themes list
      CaptureMode.tsx     60/40 split — note editor left, verse pane right; exposes forwardRef handle
      NoteEditor.tsx      Contenteditable multi-line editor with inline pill rendering
      PassagePane.tsx     Right-hand verse display with highlight support
      ReferenceInput.tsx  Passage autocomplete (scores book aliases, shows dropdown)
      ReadingMode.tsx     Verse-by-verse reading with embedded notes + inline edit/delete
      BookDetailPage.tsx  Full book view — chapter selector, ChapterView, inline note edit/delete
      BibleLibrary.tsx    All-66-books grid with studied indicators
      SessionEditor.tsx   Edit all notes for a passage from the sidebar pencil icon
      ThemeView.tsx       Free-form thematic entry editor
      InlineTagInput.tsx  Single-line input with @ picker — used in inline note rows
      ConfirmDialog.tsx   Reusable modal with backdrop, keyboard close, variant buttons
```

---

## IPC contract

`window.api` is the only way the renderer talks to the main process. Every method is:
- declared in `src/preload/index.d.ts` (TypeScript interface)
- implemented in `src/preload/index.ts` (calls `ipcRenderer.invoke`)
- handled in `src/main/db/handlers.ts` (calls `better-sqlite3`)

**Always update all three files together** when adding a new API method.

Key handlers:
- `notes:deleteAndCascade` — deletes note, then session if empty, passage if empty, book if empty; returns `{ deletedNoteId?, deletedSessionId?, deletedPassageId?, deletedBookId? }`
- `passages:deleteAll` — deletes all notes + sessions for a passage, then passage, then book if empty
- `bible:getVerse` — checks `BibleVerseCache` first; fetches `bible-api.com/?translation=web` if not cached; stores result
- `passages:withNotes` — returns `{ passage, sessions: [{ ...session, notes: [] }] }`

---

## State routing in App.tsx

Priority order in `renderMain()`:
1. `selectedTheme` → `ThemeView`
2. `sessionEditorPassageId` → `SessionEditor`
3. `viewMode === 'reading' && selectedBibleBook` → `BookDetailPage`
4. `viewMode === 'reading' && selectedPassage` → `ReadingMode`
5. `viewMode === 'reading'` → `BibleLibrary`
6. default → `CaptureMode`

`CaptureMode` is rendered with `ref={captureModeRef}` so App can call `isDirty()` / `save()` for the navigation guard.

---

## NoteEditor — contenteditable approach

Each focused line is a `<div contenteditable>` managed **imperatively via DOM refs**, not React state. React state holds the raw text string; the DOM is synced manually.

Key DOM helpers (all in `NoteEditor.tsx`):
- `getRawText(el)` — walks childNodes; text nodes → textContent; pill spans → `span.dataset.raw`; `<br>` ignored
- `getRawCursorPos(el)` — translates Selection/Range into a character offset in the raw string
- `setRawCursorPos(el, pos)` — restores cursor after re-render by walking children and placing a Range
- `renderRich(el, text)` — parses text → builds DOM (text nodes + `contenteditable="false"` pill spans); bails early if serialised content is identical

**On every `onInput` event**: save cursor pos → extract raw text → `renderRich` → restore cursor → push text to React state.

Pill spans carry `data-raw` (the original token text, e.g. `"v5"` or `"@observation"`) so `getRawText` can reconstruct the raw string faithfully.

Unfocused lines use the existing `RenderedLine` React component (cross-ref hover cards still work).

---

## Note token syntax (noteParser.ts)

| Token | Example | Type |
|---|---|---|
| Verse anchor | `v5`, `v4-6` | `verse-anchor` |
| Category tag | `@observation`, `@obs` (fuzzy) | `tag` |
| Cross-reference | `Matt 5:9`, `1 Cor 13:4` | `cross-ref` |

`parseNoteLine(text)` returns `{ segments, anchorStart, anchorEnd, category, crossRefs }`.

Tags are fuzzy-matched: `@obs` → `observation`, `@hist` → `historical`.

---

## Cascade deletion rules

- Delete note → if session now empty, delete session → if passage now empty, delete passage → if book now empty, delete book
- `deleteNoteAndCascade` returns the IDs of everything deleted so the UI can react (e.g. navigate away if `deletedPassageId` is set)
- `deletePassageAll` deletes everything under a passage and returns `{ deletedPassageId, deletedBookId? }`

---

## Bible verse fetching

- API: `https://bible-api.com/${encodeURIComponent(ref)}?translation=web`
- Cache table: `BibleVerseCache(reference TEXT PRIMARY KEY, text TEXT, verses_json TEXT)`
- Cache key is `reference.toLowerCase().trim()`
- Verses stored as JSON array `[{ verse, text }]`

---

## Native module setup (Windows)

`better-sqlite3` requires a prebuilt binary matching the Electron ABI. The correct setup on Windows without VS Build Tools:

```bash
npm install --ignore-scripts          # skip native compile scripts
node node_modules/electron/install.js # download Electron binary
npx electron-builder install-app-deps # download prebuilt better-sqlite3 for correct ABI
```

`electron-builder.yml` has `asarUnpack: ["node_modules/better-sqlite3/**"]` so the `.node` file is accessible at runtime.

Current pairing: **Electron 33 + better-sqlite3 11.4.0** (ABI v130/v131 — has prebuilt binaries).

---

## CSS conventions

Single file: `src/renderer/src/assets/main.css`. No framework, no CSS modules.

Naming conventions:
- Layout wrappers: `capture-layout`, `reading-layout`, `book-detail-layout`
- Component prefixes: `se-` (SessionEditor), `rn-` (reading note actions), `dialog-` (ConfirmDialog)
- Pill classes: `pill-verse`, `pill-crossref`, `pill-tag-{category}`
- Category colours: observation=#7F77DD, historical=#1D9E75, application=#BA7517, personal=#D4537E

---

## Adding a new API method — checklist

1. Add handler in `src/main/db/handlers.ts` (`ipcMain.handle('namespace:method', ...)`)
2. Add wrapper in `src/preload/index.ts` (`ipcRenderer.invoke('namespace:method', ...)`)
3. Add type signature in `src/preload/index.d.ts` (`window.api` interface)
4. Use `window.api.methodName()` in the renderer
