import React from 'react'
import { BiblePassage } from '../types'

interface PassagePaneProps {
  passage: BiblePassage | null
  loading: boolean
  highlightedVerses: Set<number>  // verse numbers to highlight
  hasAnyHighlight: boolean
}

export default function PassagePane({
  passage,
  loading,
  highlightedVerses,
  hasAnyHighlight
}: PassagePaneProps): React.ReactElement {
  if (loading) {
    return (
      <div className="passage-pane">
        <div className="loading-dots">Loading verse text…</div>
      </div>
    )
  }

  if (!passage) {
    return (
      <div className="passage-pane-empty">
        <div>Type a reference above<br />and press Enter to load verse text.</div>
      </div>
    )
  }

  return (
    <div className="passage-pane fade-in">
      <div className="passage-pane-reference">{passage.reference}</div>
      {passage.verses.map(v => {
        const isHighlighted = highlightedVerses.has(v.verse)
        const isDimmed = hasAnyHighlight && !isHighlighted
        return (
          <div
            key={v.verse}
            className={`passage-verse${isHighlighted ? ' highlighted' : ''}${isDimmed ? ' dimmed' : ''}`}
          >
            <span className="verse-number">{v.verse}</span>
            <span className="verse-text">{v.text}</span>
          </div>
        )
      })}
    </div>
  )
}
