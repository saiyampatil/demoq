import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { CURRENCIES, PINNED_CURRENCIES } from '@/mock/currencies'
import { currencyName, symbolOf } from '@/state/reward'

const label = (code: string) => `${code} · ${symbolOf(code)} · ${currencyName(code)}`

/** A searchable list of ISO 4217 codes, common ones first. */
export function CurrencyPicker({ value, onChange, disabled, label: text }: { value: string; onChange: (code: string) => void; disabled?: boolean; label: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', out)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const { pinned, rest } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hit = (c: { code: string; name: string }) => !needle || `${c.code} ${c.name} ${symbolOf(c.code)}`.toLowerCase().includes(needle)
    return {
      pinned: PINNED_CURRENCIES.map((code) => CURRENCIES.find((c) => c.code === code)!).filter(hit),
      rest: CURRENCIES.filter((c) => !PINNED_CURRENCIES.includes(c.code)).filter(hit),
    }
  }, [q])

  const pick = (code: string) => {
    onChange(code)
    setOpen(false)
    setQ('')
  }
  const item = (c: { code: string }) => (
    <li key={c.code} role="option" aria-selected={c.code === value}>
      <button type="button" onClick={() => pick(c.code)} className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-haze', c.code === value && 'bg-iris-50 font-medium')}>
        <span className="w-10 font-medium tabular-nums">{c.code}</span>
        <span className="w-8 text-graphite">{symbolOf(c.code)}</span>
        <span className="min-w-0 flex-1 truncate">{currencyName(c.code)}</span>
      </button>
    </li>
  )

  return (
    <div ref={box} className="relative flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {text}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={() => setOpen((o) => !o)}
        className={cn(controlBase, 'flex h-9 w-full items-center justify-between gap-2 text-left')}
      >
        <span className="truncate">{label(value)}</span>
        <span aria-hidden="true" className="text-graphite">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-full min-w-72 overflow-hidden rounded-md border border-mist bg-surface shadow-overlay">
          <div className="border-b border-mist p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code, symbol or name" aria-label="Search currencies" className={cn(controlBase, 'h-8 w-full text-sm')} />
          </div>
          <ul role="listbox" aria-label="Currencies" className="max-h-64 overflow-y-auto py-1">
            {pinned.length > 0 && <li className="px-3 pt-1 pb-0.5 text-xs font-medium text-graphite">Common</li>}
            {pinned.map(item)}
            {rest.length > 0 && <li className="px-3 pt-2 pb-0.5 text-xs font-medium text-graphite">All currencies</li>}
            {rest.map(item)}
            {pinned.length + rest.length === 0 && <li className="px-3 py-3 text-sm text-graphite">No currency matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
