import React from 'react'
import { Book, Passage } from '../types'
import { BIBLE_BOOKS, BibleBook } from '../utils/bibleBooks'

interface BibleLibraryProps {
  books: Book[]
  passages: Passage[]
  onSelectBook: (bookName: string) => void
}

const OT = BIBLE_BOOKS.filter(b => b.testament === 'OT')
const NT = BIBLE_BOOKS.filter(b => b.testament === 'NT')

function TestamentSection({
  label,
  bibleBooks,
  dbBooks,
  passages,
  onSelectBook
}: {
  label: string
  bibleBooks: BibleBook[]
  dbBooks: Book[]
  passages: Passage[]
  onSelectBook: (name: string) => void
}): React.ReactElement {
  return (
    <div className="bible-testament-section">
      <div className="bible-testament-label">{label}</div>
      <div className="bible-books-grid">
        {bibleBooks.map(book => {
          const dbBook = dbBooks.find(b => b.name.toLowerCase() === book.name.toLowerCase())
          const bookPassages = dbBook ? passages.filter(p => p.book_id === dbBook.id) : []
          const passageCount = bookPassages.length
          const studied = passageCount > 0

          return (
            <div key={book.id} className="bible-book-item">
              <div
                className={`bible-book-row${studied ? ' studied' : ''}`}
                onClick={() => onSelectBook(book.name)}
              >
                <span className={`bible-book-dot${studied ? ' visible' : ''}`} />
                <span className="bible-book-name">{book.name}</span>
                {studied && (
                  <span className="bible-book-count">{passageCount}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BibleLibrary({ books, passages, onSelectBook }: BibleLibraryProps): React.ReactElement {
  const passageCount = passages.length
  const studiedBookCount = books.length

  return (
    <div className="bible-library">
      <div className="bible-library-header">
        <h2 className="bible-library-title">Bible Library</h2>
        <p className="bible-library-sub">
          {passageCount > 0
            ? `${studiedBookCount} ${studiedBookCount === 1 ? 'book' : 'books'} · ${passageCount} ${passageCount === 1 ? 'passage' : 'passages'} studied`
            : 'Click any book to begin reading'}
        </p>
      </div>

      <TestamentSection label="Old Testament" bibleBooks={OT} dbBooks={books} passages={passages} onSelectBook={onSelectBook} />
      <TestamentSection label="New Testament" bibleBooks={NT} dbBooks={books} passages={passages} onSelectBook={onSelectBook} />
    </div>
  )
}
