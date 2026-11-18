// The codebook's table, as parts: the header row, a group (a plain label and its rows), and the row button. The Codes tab (A1) and the
// Signals tab (A2) both use these, so the two tables have the same row height, spacing, group headers and selected row.

import type { ReactNode } from 'react'
import { cn } from '@/components/cn'

/** The header row of the table. Hidden on a phone, where the rows stack. */
export function TableHead({ children, testid }: { children: ReactNode; testid?: string }) {
  return (
    <div className="hidden items-center gap-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:flex" data-testid={testid}>
      {children}
    </div>
  )
}

/** A group of rows under a plain label. `aside` sits beside the label (a count, a note). */
export function GroupSection({ id, label, aside, children }: { id: string; label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`grp-${id}`} className="border-b border-mist last:border-0">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 pt-3.5 pb-1.5">
        <h3 id={`grp-${id}`} className="text-sm font-semibold">
          {label}
        </h3>
        {aside}
      </header>
      <ul className="pb-2">{children}</ul>
    </section>
  )
}

/** The class of a row's button: the indigo left border and wash when it is the one open in the panel. */
export const rowButtonClass = (on: boolean) => cn('group flex w-full items-center gap-3 border-l-2 px-4 py-2 text-left text-sm transition-colors', on ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')
