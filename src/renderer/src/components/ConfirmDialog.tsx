import React, { useEffect, useRef } from 'react'

export interface DialogAction {
  label: string
  variant: 'primary' | 'danger' | 'ghost'
  onClick: () => void
  autoFocus?: boolean
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message?: string
  actions: DialogAction[]
  onClose: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  actions,
  onClose
}: ConfirmDialogProps): React.ReactElement | null {
  const firstFocusRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Focus the autoFocus button (or first) after mount
    requestAnimationFrame(() => firstFocusRef.current?.focus())
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  let focusSet = false

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        {message && <div className="dialog-message">{message}</div>}
        <div className="dialog-actions">
          {actions.map((action, i) => {
            const shouldFocus = !focusSet && (action.autoFocus || i === 0)
            if (shouldFocus) focusSet = true
            return (
              <button
                key={i}
                ref={shouldFocus ? firstFocusRef : undefined}
                className={`dialog-btn dialog-btn-${action.variant}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
