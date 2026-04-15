import { NoteSegment, NoteSegmentType, NoteCategory, ParsedNote } from '../types'
import { buildCrossRefRegex } from './bibleBooks'

const TAG_PATTERN = /@(obs(?:ervation)?|hist(?:orical)?|app(?:lication)?|per(?:sonal)?)\b/gi

const VERSE_ANCHOR_PATTERN = /\bv(\d+)(?:-(\d+))?\b/g

function normalizeCategory(raw: string): NoteCategory {
  const lower = raw.toLowerCase()
  if (lower.startsWith('obs')) return 'observation'
  if (lower.startsWith('hist')) return 'historical'
  if (lower.startsWith('app')) return 'application'
  if (lower.startsWith('per')) return 'personal'
  return 'observation'
}

interface TokenMatch {
  type: NoteSegmentType
  index: number
  length: number
  raw: string
  display: string
  data?: NoteSegment['data']
}

export function parseNoteLine(text: string): ParsedNote {
  const tokens: TokenMatch[] = []

  // Find all verse anchors
  const verseRe = new RegExp(VERSE_ANCHOR_PATTERN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = verseRe.exec(text)) !== null) {
    const startVerse = parseInt(m[1], 10)
    const endVerse = m[2] ? parseInt(m[2], 10) : undefined
    tokens.push({
      type: 'verse-anchor',
      index: m.index,
      length: m[0].length,
      raw: m[0],
      display: m[0],
      data: { startVerse, endVerse }
    })
  }

  // Find all tags
  const tagRe = new RegExp(TAG_PATTERN.source, 'gi')
  while ((m = tagRe.exec(text)) !== null) {
    const category = normalizeCategory(m[1])
    tokens.push({
      type: 'tag',
      index: m.index,
      length: m[0].length,
      raw: m[0],
      display: `@${category}`,
      data: { category }
    })
  }

  // Find all cross-references
  const crossRefRe = buildCrossRefRegex()
  while ((m = crossRefRe.exec(text)) !== null) {
    tokens.push({
      type: 'cross-ref',
      index: m.index,
      length: m[0].length,
      raw: m[0],
      display: m[0],
      data: { reference: m[0] }
    })
  }

  // Sort by position, remove overlapping tokens (keep first match)
  tokens.sort((a, b) => a.index - b.index)
  const deduped: TokenMatch[] = []
  let cursor = 0
  for (const tok of tokens) {
    if (tok.index >= cursor) {
      deduped.push(tok)
      cursor = tok.index + tok.length
    }
  }

  // Build segments
  const segments: NoteSegment[] = []
  let pos = 0
  for (const tok of deduped) {
    if (tok.index > pos) {
      segments.push({
        type: 'text',
        raw: text.slice(pos, tok.index),
        display: text.slice(pos, tok.index)
      })
    }
    segments.push({
      type: tok.type,
      raw: tok.raw,
      display: tok.display,
      data: tok.data
    })
    pos = tok.index + tok.length
  }
  if (pos < text.length) {
    segments.push({ type: 'text', raw: text.slice(pos), display: text.slice(pos) })
  }

  // Extract metadata from the parsed line
  let anchorStart: number | null = null
  let anchorEnd: number | null = null
  let category: NoteCategory | null = null
  const crossRefs: string[] = []

  for (const seg of segments) {
    if (seg.type === 'verse-anchor' && seg.data?.startVerse != null) {
      if (anchorStart === null) {
        anchorStart = seg.data.startVerse
        anchorEnd = seg.data.endVerse ?? seg.data.startVerse
      }
    } else if (seg.type === 'tag' && seg.data?.category) {
      if (!category) category = seg.data.category
    } else if (seg.type === 'cross-ref' && seg.data?.reference) {
      crossRefs.push(seg.data.reference)
    }
  }

  return { segments, anchorStart, anchorEnd, category, crossRefs }
}

export function parseReferenceLabel(label: string): {
  chapter_start: number
  verse_start: number
  chapter_end: number
  verse_end: number
} | null {
  // Handle "Book ch:v-v" or "Book ch:v - ch:v"
  const simple = /(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?/.exec(label)
  if (!simple) return null
  const chapter_start = parseInt(simple[1], 10)
  const verse_start = parseInt(simple[2], 10)
  const chapter_end = simple[3] ? parseInt(simple[3], 10) : chapter_start
  const verse_end = simple[4] ? parseInt(simple[4], 10) : verse_start
  return { chapter_start, verse_start, chapter_end, verse_end }
}
