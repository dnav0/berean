import React, { useState, useRef, useEffect, useCallback } from 'react'
import { BIBLE_BOOKS, BibleBook } from '../utils/bibleBooks'

function getBookSuggestions(query: string): BibleBook[] {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return []

  const scored: { book: BibleBook; score: number }[] = []

  for (const book of BIBLE_BOOKS) {
    const name = book.name.toLowerCase()
    let score = 0

    // Exact alias match
    for (const alias of book.aliases) {
      if (alias === q) { score = 100; break }
    }

    if (!score) {
      // Name starts-with
      if (name.startsWith(q)) score = 85
      // Name contains
      else if (name.includes(q)) score = 60
    }

    if (!score) {
      // Alias starts-with / contains
      for (const alias of book.aliases) {
        if (alias.startsWith(q)) { score = Math.max(score, 50); break }
        if (alias.includes(q)) score = Math.max(score, 30)
      }
    }

    if (score > 0) scored.push({ book, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
    .map(s => s.book)
}

interface ReferenceInputProps {
  value: string
  onChange: (val: string) => void
  onSubmit: (val: string) => void
  className?: string
  placeholder?: string
}

export default function ReferenceInput({
  value,
  onChange,
  onSubmit,
  className,
  placeholder
}: ReferenceInputProps): React.ReactElement {
  const [suggestions, setSuggestions] = useState<BibleBook[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const open = suggestions.length > 0

  // Derive the "book query" portion — only when no chapter:verse present
  function getBookQuery(val: string): string | null {
    if (/\d+:\d+/.test(val)) return null          // already has ch:v
    if (/\s+\d/.test(val)) return null             // has "Book 7" — chapter typed
    return val
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    onChange(val)
    const q = getBookQuery(val)
    if (q && q.trim().length >= 2) {
      const matches = getBookSuggestions(q)
      setSuggestions(matches)
      setActiveIdx(-1)
    } else {
      setSuggestions([])
    }
  }

  const selectBook = useCallback((book: BibleBook): void => {
    onChange(`${book.name} `)
    setSuggestions([])
    setActiveIdx(-1)
    // Focus & place cursor at end
    setTimeout(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.setSelectionRange(book.name.length + 1, book.name.length + 1) }
    }, 0)
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        onSubmit(value)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (activeIdx >= 0) {
        selectBook(suggestions[activeIdx])
      } else if (suggestions.length === 1) {
        selectBook(suggestions[0])
      } else {
        setSuggestions([])
        onSubmit(value)
      }
    } else if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {open && (
        <div ref={dropdownRef} className="ref-autocomplete-dropdown">
          {suggestions.map((book, i) => (
            <div
              key={book.id}
              className={`ref-autocomplete-item${i === activeIdx ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); selectBook(book) }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="ref-ac-name">{book.name}</span>
              <span className="ref-ac-abbr">{book.abbreviation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
