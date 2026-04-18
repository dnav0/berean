import React, { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import CaptureMode, { CaptureModeHandle } from './components/CaptureMode'
import ReadingMode from './components/ReadingMode'
import BibleLibrary from './components/BibleLibrary'
import BookDetailPage from './components/BookDetailPage'
import SessionEditor from './components/SessionEditor'
import ConfirmDialog from './components/ConfirmDialog'
import WelcomeScreen from './components/WelcomeScreen'
import SettingsModal from './components/SettingsModal'
import { WhatsNew, hasUnseen, markSeen } from './components/WhatsNew'
import { Book, Passage } from './types'
import { BIBLE_BOOKS } from './utils/bibleBooks'
import { useDarkMode } from './utils/useDarkMode'

type ViewMode = 'capture' | 'reading'
type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error'

interface AppState {
  books: Book[]
  passages: Passage[]
  selectedPassageId: number | null
  selectedBookName: string | null
  sessionEditorPassageId: number | null
  captureReference: string
  viewMode: ViewMode
}

export default function App(): React.ReactElement {
  const [isDark, toggleDark] = useDarkMode()
  const [vaultReady, setVaultReady] = useState<boolean | null>(null) // null = checking
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [hasNew, setHasNew] = useState(hasUnseen)
  const [translation, setTranslation] = useState('web')
  const [verseVersion, setVerseVersion] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | undefined>(undefined)

  const openWhatsNew = (): void => {
    setWhatsNewOpen(true)
    markSeen()
    setHasNew(false)
  }

  const [state, setState] = useState<AppState>({
    books: [], passages: [],
    selectedPassageId: null,
    selectedBookName: null,
    sessionEditorPassageId: null,
    captureReference: '',
    viewMode: 'capture'
  })
  const [pendingModeChange, setPendingModeChange] = useState(false)
  const captureModeRef = useRef<CaptureModeHandle>(null)

  const refresh = useCallback(async () => {
    const [books, passages] = await Promise.all([
      window.api.getBooks(),
      window.api.getPassages()
    ])
    setState(prev => ({ ...prev, books, passages }))
  }, [])

  useEffect(() => {
    window.api.isVaultConfigured().then(configured => {
      setVaultReady(configured)
      if (configured) refresh()
    })
  }, [])

  useEffect(() => {
    window.api.getTranslation().then(({ translation }) => setTranslation(translation))
  }, [])

  useEffect(() => {
    window.api.onUpdateStatus(({ status, version }) => {
      setUpdateStatus(status as UpdateStatus)
      if (version) setUpdateVersion(version)
    })
  }, [])

  useEffect(() => {
    if (updateStatus === 'up-to-date') {
      const t = setTimeout(() => setUpdateStatus('idle'), 3000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [updateStatus])

  const handleTranslationChange = async (newTranslation: string, esvApiKey?: string): Promise<void> => {
    await window.api.setTranslation(newTranslation, esvApiKey)
    setTranslation(newTranslation)
    setVerseVersion(v => v + 1)
  }

  const handleNewPassage = (bookName?: string): void => {
    setState(prev => ({
      ...prev,
      selectedPassageId: null,
      selectedBookName: null,
      sessionEditorPassageId: null,
      captureReference: bookName ? `${bookName} ` : '',
      viewMode: 'capture'
    }))
  }

  const handleSelectPassage = (passageId: number): void => {
    setState(prev => ({
      ...prev,
      selectedPassageId: passageId,
      selectedBookName: null,
      sessionEditorPassageId: null,
      viewMode: 'reading'
    }))
  }

  const handleSelectBook = (bookName: string): void => {
    setState(prev => ({
      ...prev,
      selectedBookName: bookName,
      selectedPassageId: null,
      sessionEditorPassageId: null,
      viewMode: 'reading'
    }))
  }

  const handleEditPassage = (passageId: number): void => {
    setState(prev => ({
      ...prev,
      sessionEditorPassageId: passageId,
      selectedPassageId: null,
      selectedBookName: null,
      viewMode: 'reading'
    }))
  }

  const handleSaveRead = async (passageId: number): Promise<void> => {
    await refresh()
    setState(prev => ({ ...prev, selectedPassageId: passageId, selectedBookName: null, sessionEditorPassageId: null, viewMode: 'reading' }))
  }

  const handleSaveNext = async (nextRef?: string): Promise<void> => {
    await refresh()
    setState(prev => ({
      ...prev,
      selectedPassageId: null,
      selectedBookName: null,
      sessionEditorPassageId: null,
      captureReference: nextRef || '',
      viewMode: 'capture'
    }))
  }

  const doModeChange = (mode: ViewMode): void => {
    setState(prev => ({
      ...prev,
      viewMode: mode,
      ...(mode === 'reading' ? { selectedPassageId: null, selectedBookName: null, sessionEditorPassageId: null } : {})
    }))
  }

  const handleModeChange = (mode: ViewMode): void => {
    if (mode === 'reading' && state.viewMode === 'capture' && captureModeRef.current?.isDirty()) {
      setPendingModeChange(true)
      return
    }
    doModeChange(mode)
  }

  const handleCaptureFromReading = (reference: string): void => {
    setState(prev => ({ ...prev, viewMode: 'capture', captureReference: reference, selectedBookName: null, sessionEditorPassageId: null }))
  }

  const { books, passages, selectedPassageId, selectedBookName, sessionEditorPassageId, captureReference, viewMode } = state

  const selectedPassage = passages.find(p => p.id === selectedPassageId) || null
  const selectedBibleBook = selectedBookName
    ? BIBLE_BOOKS.find(b => b.name === selectedBookName) || null
    : null
  const selectedDbBook = selectedBookName
    ? books.find(b => b.name.toLowerCase() === selectedBookName.toLowerCase()) || null
    : null
  const sessionEditorPassage = sessionEditorPassageId
    ? passages.find(p => p.id === sessionEditorPassageId) || null
    : null

  function renderMain(): React.ReactElement {
    if (sessionEditorPassage) {
      return (
        <SessionEditor
          key={sessionEditorPassage.id}
          passage={sessionEditorPassage}
          onBack={() => setState(prev => ({ ...prev, sessionEditorPassageId: null }))}
          onRefresh={refresh}
          onPassageDeleted={async () => {
            await refresh()
            setState(prev => ({ ...prev, sessionEditorPassageId: null }))
          }}
        />
      )
    }

    if (viewMode === 'reading' && selectedBibleBook) {
      return (
        <BookDetailPage
          key={`${selectedBibleBook.id}-${verseVersion}`}
          bibleBook={selectedBibleBook}
          dbBook={selectedDbBook}
          onBack={() => setState(prev => ({ ...prev, selectedBookName: null }))}
          onCapture={ref => { handleCaptureFromReading(ref); refresh() }}
          onRefresh={refresh}
        />
      )
    }

    if (viewMode === 'reading' && selectedPassage) {
      return (
        <ReadingMode
          key={`${selectedPassage.id}-${verseVersion}`}
          passage={selectedPassage}
          onCapture={passageId => {
            const p = passages.find(p => p.id === passageId)
            handleCaptureFromReading(p?.reference_label || '')
          }}
          onRefresh={refresh}
          onPassageDeleted={async () => {
            await refresh()
            setState(prev => ({ ...prev, selectedPassageId: null }))
          }}
        />
      )
    }

    if (viewMode === 'reading') {
      return (
        <BibleLibrary
          books={books}
          passages={passages}
          onSelectBook={handleSelectBook}
        />
      )
    }

    return (
      <CaptureMode
        ref={captureModeRef}
        key={captureReference}
        initialReference={captureReference}
        onSaveRead={handleSaveRead}
        onSaveNext={handleSaveNext}
      />
    )
  }

  if (vaultReady === null) return <div className="app-layout" />

  if (!vaultReady) {
    return (
      <WelcomeScreen
        onReady={() => {
          setVaultReady(true)
          refresh()
        }}
      />
    )
  }

  return (
    <div className="app-layout">
      <Sidebar
        mode={viewMode}
        onModeChange={handleModeChange}
        books={books}
        passages={passages}
        selectedPassageId={selectedPassageId}
        onSelectPassage={handleSelectPassage}
        onNewPassage={() => handleNewPassage()}
        onEditPassage={handleEditPassage}
        isDark={isDark}
        onToggleDark={toggleDark}
        hasNew={hasNew}
        onOpenWhatsNew={openWhatsNew}
        onOpenSettings={() => setSettingsOpen(true)}
        updateStatus={updateStatus}
        updateVersion={updateVersion}
        onCheckForUpdates={() => window.api.checkForUpdates()}
        onQuitAndInstall={() => window.api.quitAndInstall()}
      />
      <div className="main-area">
        {renderMain()}
      </div>

      <WhatsNew isOpen={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        translation={translation}
        onTranslationChange={handleTranslationChange}
      />

      {/* Navigation guard: unsaved notes in capture mode */}
      <ConfirmDialog
        isOpen={pendingModeChange}
        title="Unsaved notes"
        message="You have unsaved notes. Save them before switching tabs?"
        onClose={() => setPendingModeChange(false)}
        actions={[
          {
            label: 'Save & Read',
            variant: 'primary',
            autoFocus: false,
            onClick: () => {
              void (async () => {
                const passageId = await captureModeRef.current?.save()
                setPendingModeChange(false)
                await refresh()
                if (passageId) {
                  setState(prev => ({ ...prev, selectedPassageId: passageId, selectedBookName: null, sessionEditorPassageId: null, viewMode: 'reading' }))
                } else {
                  doModeChange('reading')
                }
              })()
            }
          },
          {
            label: 'Discard',
            variant: 'danger',
            autoFocus: false,
            onClick: () => {
              setPendingModeChange(false)
              setState(prev => ({
                ...prev,
                captureReference: '',
                viewMode: 'reading',
                selectedPassageId: null,
                selectedBookName: null,
                sessionEditorPassageId: null
              }))
            }
          },
          {
            label: 'Cancel',
            variant: 'ghost',
            autoFocus: true,
            onClick: () => setPendingModeChange(false)
          }
        ]}
      />
    </div>
  )
}
