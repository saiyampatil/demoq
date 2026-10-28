import { useId, useState } from 'react'
import { cn } from './cn'
import { CloseIcon } from './icons'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailListFieldProps = {
  label: string
  value: string[]
  onChange: (emails: string[]) => void
  hint?: string
  /** Shown by the parent, e.g. "Add at least one email address". */
  error?: string
  placeholder?: string
}

// Type or paste addresses; Enter, comma, semicolon, space or leaving the field turns them into chips.
export function EmailListField({ label, value, onChange, hint, error, placeholder }: EmailListFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string>()
  const shown = localError ?? error

  const commit = (text: string) => {
    const tokens = text.split(/[\s,;]+/).filter(Boolean)
    if (tokens.length === 0) {
      setDraft('')
      setLocalError(undefined)
      return
    }
    const next = [...value]
    const invalid: string[] = []
    for (const t of tokens) {
      if (!EMAIL.test(t)) invalid.push(t)
      else if (!next.some((e) => e.toLowerCase() === t.toLowerCase())) next.push(t)
    }
    if (next.length !== value.length) onChange(next)
    setDraft(invalid.join(' '))
    setLocalError(invalid.length ? `“${invalid[0]}” isn’t a valid email address.` : undefined)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-sm border bg-surface px-2 py-1.5 focus-within:border-iris-600',
          shown ? 'border-negative-fg' : 'border-mist-strong hover:border-graphite',
        )}
      >
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded-xs border border-mist-strong bg-haze py-0.5 pr-0.5 pl-2 text-sm">
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((e) => e !== email))}
              aria-label={`Remove ${email}`}
              className="rounded-xs p-0.5 text-graphite hover:bg-mist hover:text-ink"
            >
              <CloseIcon size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={draft}
          placeholder={value.length ? 'Add another' : placeholder}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const v = e.target.value
            // A trailing separator, or a paste with several addresses, commits straight away.
            if (/[\s,;]$/.test(v) || /[\s,;]/.test(v.trim())) commit(v)
            else {
              setDraft(v)
              if (localError) setLocalError(undefined)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(draft)
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => draft.trim() && commit(draft)}
          className="min-w-40 flex-1 bg-transparent px-1 py-0.5 text-base outline-none placeholder:text-muted"
        />
      </div>
      {shown ? (
        <p id={`${id}-error`} className="text-sm text-negative-fg">
          {shown}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-graphite">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
