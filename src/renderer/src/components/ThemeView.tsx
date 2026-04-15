import React, { useState, useEffect, useRef } from 'react'
import { ThematicEntry } from '../types'

interface ThemeViewProps {
  theme: ThematicEntry
  onUpdate: (id: number, title: string, content: string) => void
}

export default function ThemeView({ theme, onUpdate }: ThemeViewProps): React.ReactElement {
  const [title, setTitle] = useState(theme.title)
  const [content, setContent] = useState(theme.content)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(theme.title)
    setContent(theme.content)
  }, [theme.id])

  const scheduleSave = (newTitle: string, newContent: string): void => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      onUpdate(theme.id, newTitle, newContent)
    }, 800)
  }

  return (
    <div className="theme-layout">
      <input
        className="theme-title-input"
        value={title}
        placeholder="Theme title…"
        onChange={e => { setTitle(e.target.value); scheduleSave(e.target.value, content) }}
      />
      <textarea
        className="theme-content-input"
        value={content}
        placeholder="Write your thematic notes here…"
        onChange={e => { setContent(e.target.value); scheduleSave(title, e.target.value) }}
      />
    </div>
  )
}
