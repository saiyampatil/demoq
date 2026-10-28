import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Kept in a ref so a parent re-render doesn't re-run the focus effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>('input, textarea, select')
    ;(first ?? panelRef.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink/30 motion-safe:animate-[fade-in_150ms_ease-out]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-md border border-mist bg-surface shadow-overlay outline-none motion-safe:animate-[fade-in_150ms_ease-out]"
      >
        <header className="flex items-start gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-graphite">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>
        {children && <div className="px-5 pt-4">{children}</div>}
        {footer && <footer className="mt-5 flex justify-end gap-2 border-t border-mist px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
