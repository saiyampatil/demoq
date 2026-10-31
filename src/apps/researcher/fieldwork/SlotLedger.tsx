import { cn } from '@/components/cn'
import { formatDate } from '@/lib/format'
import type { Ledger, SlotState } from '@/state/selectors'

const SLOT: Record<SlotState, { cls: string; word: string }> = {
  accepted: { cls: 'bg-positive-fg', word: 'Accepted' },
  review: { cls: 'bg-pending-fg', word: 'Under review' },
  running: { cls: 'border-2 border-graphite bg-surface', word: 'Held by someone who can still finish' },
  noShow: { cls: 'border-2 border-graphite bg-surface', word: 'Held by a no-show until the window closes' },
  open: { cls: 'border-2 border-dashed border-negative-fg bg-surface', word: 'Open' },
}

/**
 * The target as slots, each held or open, with what opened them. It lives in the verdict banner on Overview and nowhere
 * else: the Reserve tab is only the people. A slot opens only when someone is excluded, withdraws, is a no-show after the
 * window closes, or the Researcher gives up on them.
 */
export function SlotLedger({ ledger }: { ledger: Ledger }) {
  // Slots that opened but are not open now: the invitations beyond the target (the over-recruitment buffer) cover them.
  const absorbed = Math.max(0, ledger.released.length - ledger.open)
  return (
    <div className="mt-3 flex flex-col gap-2" aria-label="Slot ledger">
      <ol aria-label="Slots" data-testid="slots" className="flex flex-wrap gap-1.5">
        {ledger.slots.map((st, i) => (
          <li key={i} title={`Slot ${i + 1}: ${SLOT[st].word}`} aria-label={`Slot ${i + 1}: ${SLOT[st].word}`} className={cn('size-4 rounded-xs', SLOT[st].cls)} />
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-graphite tabular-nums" data-testid="slot-legend">
        <li>{ledger.counting} counting ({ledger.confirmed} accepted, {ledger.pending} under review)</li>
        <li>{ledger.running} held by people who can still finish</li>
        {ledger.noShowHeld > 0 && <li>{ledger.noShowHeld} held by no-shows until {ledger.windowEnd ? formatDate(`${ledger.windowEnd}T12:00:00-05:00`) : 'the window closes'}</li>}
        <li className={cn(ledger.open > 0 && 'font-medium text-negative-fg')}>{ledger.open} open</li>
      </ul>
      {ledger.released.length > 0 && (
        <div data-testid="slots-opened">
          <p className="text-xs font-medium text-ink tabular-nums" data-testid="slots-summary">
            {ledger.released.length} {ledger.released.length === 1 ? 'slot' : 'slots'} opened
            {absorbed > 0 && `, ${absorbed} absorbed by the over-recruitment buffer`}, {ledger.open} open.
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5 text-xs text-graphite">
            {ledger.released.map((r) => (
              <li key={r.participantId + r.why}>
                <span className="font-medium text-ink tabular-nums">{r.participantId}</span>: {r.why}
                {r.detail ? `. ${r.detail}` : ''}
              </li>
            ))}
          </ul>
          {absorbed > 0 && <p className="mt-1 text-xs text-graphite">The study invited more people than it has slots, so some of the slots that opened were already covered.</p>}
        </div>
      )}
    </div>
  )
}
