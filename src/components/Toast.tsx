import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

/** A confirmation that says what happened and offers the next step, or an undo. It goes away by itself. */
export type ToastAction = { label: string; to?: string; onClick?: () => void }
type ToastItem = { id: number; message: string; action?: ToastAction }

const ToastContext = createContext<(message: string, action?: ToastAction, ms?: number) => void>(() => undefined)

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(1)
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const show = useCallback(
    (message: string, action?: ToastAction, ms = 8000) => {
      const id = next.current++
      setItems((xs) => [...xs.slice(-2), { id, message, action }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )
  const value = useMemo(() => show, [show])
  const linkClass = 'rounded-xs font-medium text-iris-100 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-white'
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" data-testid="toast" className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-md bg-ink px-4 py-2.5 text-sm text-white shadow-overlay motion-safe:animate-[fade-in_150ms_ease-out]">
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action &&
              (t.action.to ? (
                <Link to={t.action.to} onClick={() => dismiss(t.id)} className={linkClass}>
                  {t.action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick?.()
                    dismiss(t.id)
                  }}
                  className={linkClass}
                >
                  {t.action.label}
                </button>
              ))}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-xs px-1 text-white/70 hover:text-white">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
