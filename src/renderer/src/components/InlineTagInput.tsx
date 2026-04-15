/**
 * A single-line input that shows the @tag picker dropdown.
 * Drop-in replacement for <input> in inline note contexts.
 */
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

interface TagOption {
  name: string
  colorClass: string
}

const TAG_OPTIONS: TagOption[] = [
  { name: 'observation',  colorClass: 'observation' },
  { name: 'historical',   colorClass: 'historical'  },
  { name: 'application',  colorClass: 'application' },
  { name: 'personal',     colorClass: 'personal'    },
]

function filterTags(q: string): TagOption[] {
  return TAG_OPTIONS.filter(t => t.name.startsWith(q.toLowerCase()))
}

export interface InlineTagInputHandle {
  focus: () => void
}

interface InlineTagInputProps {
  value: string
  onChange: (val: string) => void
  onEnter?: () => void
  onEscape?: () => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
}

const InlineTagInput = forwardRef<InlineTagInputHandle, InlineTagInputProps>(
  function InlineTagInput({ value, onChange, onEnter, onEscape, className, placeholder, autoFocus }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dropdown, setDropdown] = useState<{
      query: string
      anchorIndex: number
      cursorPos: number
      activeIdx: number
    } | null>(null)

    const filteredTags = dropdown ? filterTags(dropdown.query) : []
    const isOpen = filteredTags.length > 0

    useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

    const selectTag = useCallback((tag: TagOption): void => {
      if (!dropdown) return
      const before = value.slice(0, dropdown.anchorIndex)
      const after = value.slice(dropdown.cursorPos)
      const insertion = `@${tag.name} `
      onChange(before + insertion + after)
      setDropdown(null)
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          const pos = before.length + insertion.length
          el.focus()
          el.setSelectionRange(pos, pos)
        }
      }, 0)
    }, [dropdown, value, onChange])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const text = e.target.value
      const cursor = e.target.selectionStart ?? text.length
      onChange(text)
      const before = text.slice(0, cursor)
      const m = /@(\w*)$/.exec(before)
      if (m) {
        setDropdown({ query: m[1], anchorIndex: m.index, cursorPos: cursor, activeIdx: 0 })
      } else {
        setDropdown(null)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (isOpen && dropdown) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setDropdown(d => d ? { ...d, activeIdx: Math.min(d.activeIdx + 1, filteredTags.length - 1) } : d)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setDropdown(d => d ? { ...d, activeIdx: Math.max(d.activeIdx - 1, 0) } : d)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          const tag = filteredTags[dropdown.activeIdx] ?? filteredTags[0]
          if (tag) selectTag(tag)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setDropdown(null)
          return
        }
      }

      if (e.key === 'Enter') { e.preventDefault(); onEnter?.() }
      if (e.key === 'Escape') { e.preventDefault(); setDropdown(null); onEscape?.() }
    }

    // Close on outside click
    useEffect(() => {
      const h = (e: MouseEvent): void => {
        if (!inputRef.current?.contains(e.target as Node)) setDropdown(null)
      }
      document.addEventListener('mousedown', h)
      return () => document.removeEventListener('mousedown', h)
    }, [])

    return (
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          ref={inputRef}
          className={className}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
        />
        {isOpen && (
          <div className="tag-dropdown" style={{ left: 0 }}>
            {filteredTags.map((tag, i) => (
              <div
                key={tag.name}
                className={`tag-dropdown-item${i === dropdown?.activeIdx ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectTag(tag) }}
                onMouseEnter={() => setDropdown(d => d ? { ...d, activeIdx: i } : d)}
              >
                <span className={`tag-dropdown-swatch swatch-${tag.colorClass}`} />
                <span className="tag-dropdown-label">@{tag.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

export default InlineTagInput
