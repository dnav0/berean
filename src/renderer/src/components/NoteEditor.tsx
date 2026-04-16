import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import { NoteCategory } from '../types'
import { parseNoteLine } from '../utils/noteParser'

// ─── types ───────────────────────────────────────────────────────────────────

export interface NoteLineData {
  id: string
  text: string
}

interface TagOption {
  name: NoteCategory
  label: string
  colorClass: string
}

const TAG_OPTIONS: TagOption[] = [
  { name: 'observation', label: 'observation', colorClass: 'observation' },
  { name: 'historical',  label: 'historical',  colorClass: 'historical'  },
  { name: 'application', label: 'application', colorClass: 'application' },
  { name: 'personal',    label: 'personal',    colorClass: 'personal'    },
]

interface TagDropdown {
  lineId: string
  query: string
  anchorIndex: number
  cursorPos: number
  activeIdx: number
}

let lineIdCounter = 0
export function makeLineId(): string { return `ln-${++lineIdCounter}` }

function filterTags(q: string): TagOption[] {
  return TAG_OPTIONS.filter(t => t.name.startsWith(q.toLowerCase()))
}

// ─── contenteditable DOM helpers ─────────────────────────────────────────────

/** Extract the raw text from a rich contenteditable div.
 *  Pill spans (contenteditable=false) expose their original token via data-raw. */
function getRawText(el: HTMLElement): string {
  let s = ''
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      s += n.textContent ?? ''
    } else if ((n as HTMLElement).tagName === 'BR') {
      // ignore browser-inserted <br> in empty divs
    } else {
      s += (n as HTMLElement).dataset.raw ?? n.textContent ?? ''
    }
  }
  return s
}

/** Get cursor position as an offset into the raw text string. */
function getRawCursorPos(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return 0
  const range = sel.getRangeAt(0)
  let pos = 0

  for (const child of Array.from(el.childNodes)) {
    // Cursor is inside this child (only possible for text nodes)
    if (child === range.startContainer || child.contains(range.startContainer)) {
      pos += child.nodeType === Node.TEXT_NODE ? range.startOffset : 0
      return pos
    }
    // Accumulate this child's raw length
    if (child.nodeType === Node.TEXT_NODE) {
      pos += child.textContent?.length ?? 0
    } else if ((child as HTMLElement).tagName !== 'BR') {
      pos += (child as HTMLElement).dataset.raw?.length ?? child.textContent?.length ?? 0
    }
  }

  // Cursor is positioned at el itself (between children), e.g. before/after a pill
  if (range.startContainer === el) {
    let count = 0
    for (let i = 0; i < range.startOffset; i++) {
      const c = el.childNodes[i]
      if (!c) break
      if (c.nodeType === Node.TEXT_NODE) {
        count += c.textContent?.length ?? 0
      } else if ((c as HTMLElement).tagName !== 'BR') {
        count += (c as HTMLElement).dataset.raw?.length ?? c.textContent?.length ?? 0
      }
    }
    return count
  }

  return pos
}

/** Restore cursor to a given raw-text offset after re-rendering. */
function setRawCursorPos(el: HTMLElement, target: number): void {
  const sel = window.getSelection()
  if (!sel) return
  let rem = target
  const range = document.createRange()

  for (const child of Array.from(el.childNodes)) {
    if ((child as HTMLElement).tagName === 'BR') continue
    const len = child.nodeType === Node.TEXT_NODE
      ? (child.textContent?.length ?? 0)
      : ((child as HTMLElement).dataset.raw?.length ?? child.textContent?.length ?? 0)

    if (rem <= len) {
      if (child.nodeType === Node.TEXT_NODE) {
        range.setStart(child, Math.min(rem, child.textContent?.length ?? 0))
      } else {
        // pill span — cursor goes before (rem=0) or after (rem>0)
        rem <= 0 ? range.setStartBefore(child) : range.setStartAfter(child)
      }
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    rem -= len
  }

  // Past end of all content
  range.setStart(el, el.childNodes.length)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Re-render a contenteditable div with inline pill spans.
 *  Skips the DOM write if content hasn't changed, to preserve cursor. */
function renderRich(el: HTMLElement, text: string): void {
  const { segments } = parseNoteLine(text)

  const frag = document.createDocumentFragment()
  for (const seg of segments) {
    if (seg.type === 'plain') {
      if (seg.raw) frag.appendChild(document.createTextNode(seg.raw))
    } else {
      const span = document.createElement('span')
      span.contentEditable = 'false'
      span.dataset.raw = seg.raw
      if (seg.type === 'verse-anchor') span.className = 'pill-verse'
      else if (seg.type === 'tag') span.className = `pill-tag-${seg.data?.category ?? 'observation'}`
      else if (seg.type === 'cross-ref') span.className = 'pill-crossref'
      span.textContent = seg.display
      frag.appendChild(span)
    }
  }

  // Bail out if the serialised representation is identical (avoids cursor jump)
  const serialise = (node: HTMLElement | DocumentFragment): string =>
    Array.from(node.childNodes)
      .map(n => n.nodeType === Node.TEXT_NODE ? n.textContent : (n as HTMLElement).outerHTML)
      .join('')

  if (serialise(el) === serialise(frag as unknown as HTMLElement)) return

  while (el.firstChild) el.removeChild(el.firstChild)
  el.appendChild(frag)
}

// ─── RenderedLine (unfocused view with cross-ref hover) ───────────────────────

function RenderedLine({ text }: { text: string }): React.ReactElement {
  const [hoverRef, setHoverRef] = useState<string | null>(null)
  const [hoverText, setHoverText] = useState<string | null>(null)

  if (!text) return <span style={{ color: '#DDD' }}>&nbsp;</span>

  const { segments } = parseNoteLine(text)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'verse-anchor') {
          return <span key={i} className="pill-verse">{seg.display}</span>
        }
        if (seg.type === 'tag') {
          return <span key={i} className={`pill-tag-${seg.data?.category ?? 'observation'}`}>{seg.display}</span>
        }
        if (seg.type === 'cross-ref') {
          const ref = seg.data?.reference ?? seg.raw
          return (
            <span
              key={i}
              className="pill-crossref"
              style={{ position: 'relative' }}
              onMouseEnter={async () => {
                setHoverRef(ref)
                const result = await window.api.getBibleVerse(ref)
                if (result) setHoverText(result.text)
              }}
              onMouseLeave={() => { setHoverRef(null); setHoverText(null) }}
            >
              {seg.display}
              {hoverRef === ref && (
                <div className="crossref-hover-card">
                  <div className="ref-label">{ref}</div>
                  {hoverText ?? 'Loading…'}
                </div>
              )}
            </span>
          )
        }
        return <span key={i}>{seg.raw}</span>
      })}
    </>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface NoteEditorProps {
  lines: NoteLineData[]
  focusedLineId: string | null
  onChange: (lines: NoteLineData[]) => void
  onFocusChange: (id: string | null) => void
  onCursorLine: (parsed: ReturnType<typeof parseNoteLine> | null) => void
  onVerseHover: (reference: string | null) => void
}

export default function NoteEditor({
  lines,
  focusedLineId,
  onChange,
  onFocusChange,
  onCursorLine,
  onVerseHover
}: NoteEditorProps): React.ReactElement {
  const elRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [tagDropdown, setTagDropdown] = useState<TagDropdown | null>(null)

  const filteredTags = tagDropdown ? filterTags(tagDropdown.query) : []
  const hasDropdown = filteredTags.length > 0 && tagDropdown !== null

  // When the parent updates text for the focused line (e.g. after tag insertion),
  // sync it to the DOM without resetting the cursor.
  useLayoutEffect(() => {
    if (!focusedLineId) return
    const el = elRefs.current.get(focusedLineId)
    if (!el || document.activeElement !== el) return
    const line = lines.find(l => l.id === focusedLineId)
    if (!line) return
    const cur = getRawCursorPos(el)
    renderRich(el, line.text)
    setRawCursorPos(el, cur)
  }, [lines, focusedLineId])

  // ── tag selection ──────────────────────────────────────────────────────────
  const selectTag = useCallback((tag: TagOption) => {
    if (!tagDropdown) return
    const { lineId, anchorIndex, cursorPos } = tagDropdown
    const line = lines.find(l => l.id === lineId)
    if (!line) return

    const before = line.text.slice(0, anchorIndex)
    const insertion = `@${tag.name} `
    const after = line.text.slice(cursorPos)
    const newText = before + insertion + after

    onChange(lines.map(l => l.id === lineId ? { ...l, text: newText } : l))
    setTagDropdown(null)
    onCursorLine(parseNoteLine(newText))

    // Imperatively update the focused contenteditable and reposition cursor
    setTimeout(() => {
      const el = elRefs.current.get(lineId)
      if (el) {
        renderRich(el, newText)
        el.focus()
        setRawCursorPos(el, before.length + insertion.length)
      }
    }, 0)
  }, [tagDropdown, lines, onChange, onCursorLine])

  // ── input handler ──────────────────────────────────────────────────────────
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>, id: string) => {
    const el = e.currentTarget
    const cur = getRawCursorPos(el)
    const text = getRawText(el)

    // Re-render with inline formatting
    renderRich(el, text)
    // Restore cursor to same raw position
    setRawCursorPos(el, cur)

    onChange(lines.map(l => l.id === id ? { ...l, text } : l))
    onCursorLine(parseNoteLine(text))

    // Detect @ pattern before cursor for the dropdown
    const before = text.slice(0, cur)
    const m = /@(\w*)$/.exec(before)
    if (m) {
      setTagDropdown({ lineId: id, query: m[1], anchorIndex: m.index, cursorPos: cur, activeIdx: 0 })
    } else {
      setTagDropdown(null)
    }
  }, [lines, onChange, onCursorLine])

  // ── keydown ────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    const idx = lines.findIndex(l => l.id === id)
    const el = e.currentTarget

    if (hasDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setTagDropdown(d => d ? { ...d, activeIdx: Math.min(d.activeIdx + 1, filteredTags.length - 1) } : d)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setTagDropdown(d => d ? { ...d, activeIdx: Math.max(d.activeIdx - 1, 0) } : d)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const tag = filteredTags[tagDropdown!.activeIdx] ?? filteredTags[0]
        if (tag) selectTag(tag)
        return
      }
      if (e.key === 'Escape') {
        setTagDropdown(null)
        return
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const newId = makeLineId()
      onChange([...lines.slice(0, idx + 1), { id: newId, text: '' }, ...lines.slice(idx + 1)])
      onFocusChange(newId)
      return
    }

    if (e.key === 'Backspace') {
      const text = getRawText(el)
      if (text === '' && lines.length > 1) {
        e.preventDefault()
        const prevId = lines[idx - 1]?.id ?? lines[idx + 1]?.id
        onChange(lines.filter(l => l.id !== id))
        if (prevId) {
          onFocusChange(prevId)
          setTimeout(() => {
            const prevEl = elRefs.current.get(prevId)
            if (prevEl) {
              prevEl.focus()
              setRawCursorPos(prevEl, getRawText(prevEl).length)
            }
          }, 0)
        }
        return
      }
    }

    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault()
      const prevId = lines[idx - 1].id
      onFocusChange(prevId)
      setTimeout(() => elRefs.current.get(prevId)?.focus(), 0)
      return
    }
    if (e.key === 'ArrowDown' && idx < lines.length - 1) {
      e.preventDefault()
      const nextId = lines[idx + 1].id
      onFocusChange(nextId)
      setTimeout(() => elRefs.current.get(nextId)?.focus(), 0)
    }
  }, [lines, hasDropdown, filteredTags, tagDropdown, selectTag, onChange, onFocusChange])

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (![...elRefs.current.values()].includes(document.activeElement as HTMLDivElement)) {
        setTagDropdown(null)
        onCursorLine(null)
      }
    }, 80)
  }, [onCursorLine])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>, id: string) => {
    e.preventDefault()
    const pasteText = e.clipboardData.getData('text/plain')
    const el = e.currentTarget
    const cur = getRawCursorPos(el)
    const raw = getRawText(el)
    const newText = raw.slice(0, cur) + pasteText + raw.slice(cur)
    renderRich(el, newText)
    setRawCursorPos(el, cur + pasteText.length)
    onChange(lines.map(l => l.id === id ? { ...l, text: newText } : l))
    onCursorLine(parseNoteLine(newText))
  }, [lines, onChange, onCursorLine])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (!(e.target as Element)?.closest?.('.tag-dropdown')) {
        setTagDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="notes-list">
      {lines.map((line) => {
        const isFocused = focusedLineId === line.id
        const showDropdown = hasDropdown && tagDropdown?.lineId === line.id

        return (
          <div key={line.id} className="note-line" style={{ position: 'relative' }}>
            <span className="note-bullet">•</span>

            {isFocused ? (
              <div
                key="editor"
                ref={el => {
                  if (el) {
                    elRefs.current.set(line.id, el)
                    // On first mount: render content and move focus to this line
                    if (!el.dataset.init) {
                      el.dataset.init = '1'
                      renderRich(el, line.text)
                      requestAnimationFrame(() => {
                        if (document.activeElement !== el) {
                          el.focus()
                          setRawCursorPos(el, getRawText(el).length)
                        }
                      })
                    }
                  } else {
                    elRefs.current.delete(line.id)
                  }
                }}
                className="note-input note-richtext"
                contentEditable
                suppressContentEditableWarning
                onInput={e => handleInput(e, line.id)}
                onKeyDown={e => handleKeyDown(e, line.id)}
                onFocus={() => onCursorLine(parseNoteLine(line.text))}
                onBlur={handleBlur}
                onPaste={e => handlePaste(e, line.id)}
                data-placeholder={line.id === lines[0]?.id ? 'Type a note… (v4, @obs, Matt 5:9)' : ''}
              />
            ) : (
              <div
                key="rendered"
                className="note-rendered"
                onClick={() => onFocusChange(line.id)}
              >
                <RenderedLine text={line.text} />
              </div>
            )}

            {showDropdown && (
              <div className="tag-dropdown">
                {filteredTags.map((tag, i) => (
                  <div
                    key={tag.name}
                    className={`tag-dropdown-item${i === tagDropdown!.activeIdx ? ' active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); selectTag(tag) }}
                    onMouseEnter={() => setTagDropdown(d => d ? { ...d, activeIdx: i } : d)}
                  >
                    <span className={`tag-dropdown-swatch swatch-${tag.colorClass}`} />
                    <span className="tag-dropdown-label">@{tag.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
