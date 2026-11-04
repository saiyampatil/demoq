import { useEffect, useRef, useState } from 'react'
import { cn } from '@/components/cn'

export type MoreItem = {
  key: string
  label: string
  /** One line under the label. */
  hint?: string
  onSelect: () => void
  /** Why it can't be used right now. The item stays visible but greyed. */
  off?: string
  danger?: boolean
}

/** The rare, serious controls, kept out of the main buttons: a button that opens a short list. */
export function MoreMenu({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="more-menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-sm border border-mist-strong bg-surface px-3.5 text-base text-ink hover:bg-haze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-600"
      >
        More
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn('transition-transform', open && 'rotate-180')}>
          <path d="m2.5 4.5 3.5 3.5 3.5-3.5" />
        </svg>
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-md border border-mist bg-surface py-1 shadow-overlay">
          {items.map((it) => (
            <li key={it.key} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={!!it.off}
                data-testid={`more-${it.key}`}
                onClick={() => {
                  setOpen(false)
                  it.onSelect()
                }}
                className={cn('flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-haze disabled:cursor-not-allowed disabled:hover:bg-transparent', it.danger ? 'text-negative-fg' : 'text-ink')}
              >
                <span className={cn('text-base font-medium', it.off && 'text-muted')}>{it.label}</span>
                <span className="text-sm font-normal text-graphite">{it.off ?? it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
