import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

type StudioProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** A test hook, so a probe can tell which studio is open. */
  id?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A large pop-up over the page for one job (review sentences, compare drafts, release). It keeps the report visible behind
 * it. Escape closes it, focus stays inside while it is open and returns to where it was opened from.
 */
export function Studio({ open, onClose, title, description, children, footer, id }: StudioProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-ink/40 motion-safe:animate-[fade-in_150ms_ease-out]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-title"
        tabIndex={-1}
        data-testid="studio"
        data-studio={id}
        className="relative flex h-full max-h-[860px] w-full max-w-[1120px] flex-col overflow-hidden rounded-md border border-mist bg-surface shadow-overlay outline-none motion-safe:animate-[fade-in_150ms_ease-out]"
      >
        <header className="flex items-start gap-3 border-b border-mist px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="studio-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-graphite">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink" aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-mist bg-paper px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
