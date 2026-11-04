import { cn } from '@/components/cn'
import type { Ledger, SlotState } from '@/state/selectors'

type Shown = Exclude<SlotState, 'noShow'>

/** One look per state. A no-show who may still come is shown with everyone else who can still finish. */
const SLOT: Record<Shown, { cls: string }> = {
  accepted: { cls: 'bg-positive-fg' },
  review: { cls: 'bg-pending-fg' },
  running: { cls: 'border-2 border-graphite bg-surface' },
  open: { cls: 'border-2 border-dashed border-negative-fg bg-surface' },
}

/** What a named person's slot says on hover. */
const PERSON: Record<Exclude<Shown, 'open'>, string> = {
  accepted: 'Accepted',
  review: 'Under review',
  running: 'can still finish',
}

const shownAs = (st: SlotState): Shown => (st === 'noShow' ? 'running' : st)

/**
 * The target as slots in one row, each held or open. It lives in the verdict card on Overview and nowhere else: the
 * Reserve tab is only the people. A slot opens only when someone is excluded, withdraws, is a no-show after the window
 * closes, or the Researcher gives up on them. The boxes share the row, so any target fits on one line.
 */
export function SlotLedger({ ledger }: { ledger: Ledger }) {
  // Colour keys only: the counts are in the verdict and the KPI strip.
  const legend: { state: Shown; label: string; n: number }[] = [
    { state: 'accepted', label: 'Accepted', n: ledger.confirmed },
    { state: 'review', label: 'Under review', n: ledger.pending },
    { state: 'running', label: 'Held by someone who can still finish', n: ledger.running + ledger.noShowHeld },
    { state: 'open', label: 'Need to add', n: ledger.open },
  ]
  // A key only helps when there is something to tell apart from something else: never a one-item legend.
  const shown = legend.filter((x) => x.n > 0)
  const hover = (st: Shown, who: string | null) => (st === 'open' || !who ? 'Slot to add' : `${who}: ${PERSON[st]}`)
  return (
    <div className="flex flex-col gap-3" aria-label="Slot ledger">
      <ol aria-label="Slots" data-testid="slots" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, ledger.slots.length)}, minmax(0, 1fr))` }}>
        {ledger.slots.map(shownAs).map((st, i) => (
          <li key={i} title={hover(st, ledger.slotWho[i])} aria-label={`Slot ${i + 1}: ${hover(st, ledger.slotWho[i])}`} className={cn('aspect-square max-h-6 rounded-xs', SLOT[st].cls)} />
        ))}
      </ol>
      {shown.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-graphite" data-testid="slot-legend">
          {shown.map((x) => (
            <li key={x.state} className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className={cn('size-3 shrink-0 rounded-xs', SLOT[x.state].cls)} />
              {x.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
