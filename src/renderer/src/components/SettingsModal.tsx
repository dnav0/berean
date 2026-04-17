import React, { useState, useEffect, useCallback } from 'react'

const TRANSLATIONS = [
  { value: 'web', label: 'WEB', name: 'World English Bible',     desc: 'Modern public-domain translation — the current default.' },
  { value: 'kjv', label: 'KJV', name: 'King James Version',      desc: 'The classic 1611 authorised translation. Public domain.' },
  { value: 'asv', label: 'ASV', name: 'American Standard Version', desc: 'Literal 1901 revision of the KJV. Public domain.' },
  { value: 'esv', label: 'ESV', name: 'English Standard Version', desc: 'Highly accurate modern translation. Requires a free API key.' },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  translation: string
  onTranslationChange: (translation: string, esvApiKey?: string) => Promise<void>
}

export default function SettingsModal({
  isOpen,
  onClose,
  translation,
  onTranslationChange,
}: SettingsModalProps): React.ReactElement | null {
  const [selectedTranslation, setSelectedTranslation] = useState(translation)
  const [esvKey, setEsvKey] = useState('')
  const [esvKeyDirty, setEsvKeyDirty] = useState(false)
  const [vaultPath, setVaultPath] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync from parent when modal opens
  useEffect(() => {
    if (!isOpen) return
    setSelectedTranslation(translation)
    window.api.getVaultPath().then(setVaultPath)
    window.api.getTranslation().then(({ esvApiKey }) => {
      setEsvKey(esvApiKey)
      setEsvKeyDirty(false)
    })
  }, [isOpen, translation])

  const handleSelect = (value: string): void => {
    setSelectedTranslation(value)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const key = selectedTranslation === 'esv' && esvKeyDirty ? esvKey : undefined
      await onTranslationChange(selectedTranslation, key)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleChooseVault = async (): Promise<void> => {
    const chosen = await window.api.chooseVaultPath()
    if (chosen) setVaultPath(chosen)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="smodal-backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="smodal-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="smodal-header">
          <span className="smodal-title">Settings</span>
          <button className="smodal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Translation */}
        <div className="smodal-section">
          <div className="smodal-section-label">Translation</div>
          <div className="smodal-translation-list">
            {TRANSLATIONS.map(t => (
              <button
                key={t.value}
                className={`smodal-translation-row${selectedTranslation === t.value ? ' active' : ''}`}
                onClick={() => handleSelect(t.value)}
              >
                <div className="smodal-translation-radio">
                  {selectedTranslation === t.value && <div className="smodal-radio-dot" />}
                </div>
                <div className="smodal-translation-info">
                  <span className="smodal-translation-abbr">{t.label}</span>
                  <span className="smodal-translation-name">{t.name}</span>
                  <span className="smodal-translation-desc">{t.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedTranslation === 'esv' && (
            <div className="smodal-esv-key">
              <label className="smodal-esv-label">
                ESV API key
                <a
                  className="smodal-esv-link"
                  href="https://api.esv.org/account/create-application/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get a free key at api.esv.org ↗
                </a>
              </label>
              <input
                className="smodal-esv-input"
                type="password"
                placeholder="Paste your API key here…"
                value={esvKey}
                onChange={e => { setEsvKey(e.target.value); setEsvKeyDirty(true) }}
              />
            </div>
          )}
        </div>

        <div className="smodal-divider" />

        {/* Vault */}
        <div className="smodal-section">
          <div className="smodal-section-label">Notes Vault</div>
          <p className="smodal-vault-desc">
            Every note is saved as a Markdown file here — portable and Obsidian-compatible.
          </p>
          <div className="smodal-vault-path" title={vaultPath}>
            {vaultPath || '…'}
          </div>
          <div className="smodal-vault-actions">
            <button className="smodal-vault-btn" onClick={() => window.api.openVaultFolder()}>
              Open folder
            </button>
            <button className="smodal-vault-btn" onClick={handleChooseVault}>
              Change location
            </button>
          </div>
        </div>

        <div className="smodal-divider" />

        {/* Footer */}
        <div className="smodal-footer">
          <button className="smodal-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  )
}
