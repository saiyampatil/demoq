import { cn } from '@/components/cn'
import { formatDate } from '@/lib/format'
import type { Ledger, SlotState } from '@/state/selectors'

/** One look per state. A no-show gets its own: teal "set aside but kept", never the same as someone who can still finish. */
const SLOT: Record<SlotState, { cls: string; word: string }> = {
  accepted: { cls: 'bg-positive-fg', word: 'Accepted' },
  review: { cls: 'bg-pending-fg', word: 'Under review' },
  running: { cls: 'border-2 border-graphite bg-surface', word: 'Held by someone who can still finish' },
  noShow: { cls: 'border-2 border-held-fg bg-held-bg', word: 'Held by a no-show until the window closes' },
  open: { cls: 'border-2 border-dashed border-negative-fg bg-surface', word: 'Open' },
}

/** What a named person's slot says on hover. */
const PERSON: Record<Exclude<SlotState, 'open'>, string> = {
  accepted: 'Accepted',
  review: 'Under review',
  running: 'can still finish',
  noShow: 'No-show, holds the slot until the window closes',
}

/**
 * The target as slots in one row, each held or open. It lives in the verdict card on Overview and nowhere else: the
 * Reserve tab is only the people. A slot opens only when someone is excluded, withdraws, is a no-show after the window
 * closes, or the Researcher gives up on them. The boxes share the row, so any target fits on one line.
 */
export function SlotLedger({ ledger }: { ledger: Ledger }) {
  const until = ledger.windowEnd ? formatDate(`${ledger.windowEnd}T12:00:00-05:00`) : 'the window closes'
  // Colour keys only: the counts are in the verdict and the KPI strip.
  const legend: { state: SlotState; label: string; n: number }[] = [
    { state: 'accepted', label: 'Accepted', n: ledger.confirmed },
    { state: 'review', label: 'Under review', n: ledger.pending },
    { state: 'running', label: 'Held by someone who can still finish', n: ledger.running },
    { state: 'noShow', label: `Held by a no-show until ${until}`, n: ledger.noShowHeld },
    { state: 'open', label: 'Open', n: ledger.open },
  ]
  const hover = (st: SlotState, who: string | null) => (st === 'open' || !who ? 'Open slot' : `${who}: ${PERSON[st]}`)
  return (
    <div className="flex flex-col gap-3" aria-label="Slot ledger">
      <ol aria-label="Slots" data-testid="slots" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, ledger.slots.length)}, minmax(0, 1fr))` }}>
        {ledger.slots.map((st, i) => (
          <li key={i} title={hover(st, ledger.slotWho[i])} aria-label={`Slot ${i + 1}: ${hover(st, ledger.slotWho[i])}`} className={cn('aspect-square max-h-6 rounded-xs', SLOT[st].cls)} />
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-graphite" data-testid="slot-legend">
        {legend
          .filter((x) => x.n > 0)
          .map((x) => (
            <li key={x.state} className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className={cn('size-3 shrink-0 rounded-xs', SLOT[x.state].cls)} />
              {x.label}
            </li>
          ))}
      </ul>
    </div>
  )
}

/** Which slots opened and why, for the "How this is calculated" section. */
export function SlotsOpened({ ledger }: { ledger: Ledger }) {
  // Slots that opened but are not open now: the invitations beyond the target (the over-recruitment buffer) cover them.
  const absorbed = Math.max(0, ledger.released.length - ledger.open)
  if (ledger.released.length === 0) return null
  return (
    <div data-testid="slots-opened">
      <p className="font-medium text-ink tabular-nums" data-testid="slots-summary">
        {ledger.released.length} {ledger.released.length === 1 ? 'slot' : 'slots'} opened
        {absorbed > 0 && `, ${absorbed} covered by the over-recruitment buffer`}, {ledger.open} open now.
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-graphite">
        {ledger.released.map((r) => (
          <li key={r.participantId + r.why}>
            <span className="font-medium text-ink tabular-nums">{r.participantId}</span>: {r.why}
            {r.detail ? `. ${r.detail}` : ''}
          </li>
        ))}
      </ul>
      {absorbed > 0 && <p className="mt-1 text-graphite">The study invited more people than it has slots, so some of the slots that opened were already covered.</p>}
    </div>
  )
}
