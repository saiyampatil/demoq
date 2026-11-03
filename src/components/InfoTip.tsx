import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'

/** A small "i" that carries the longer explanation, so the line next to it can stay short. Reachable by keyboard. */
export function InfoTip({ label, children, align = 'left' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <Tooltip focusable align={align} content={children}>
      <span aria-label={label} role="img" className="inline-flex size-4 items-center justify-center rounded-full text-graphite hover:text-ink">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.25v3.5M8 5v.01" strokeLinecap="round" />
        </svg>
      </span>
    </Tooltip>
  )
}
