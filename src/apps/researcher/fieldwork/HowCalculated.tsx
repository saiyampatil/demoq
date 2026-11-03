import { AlertIcon, ChevronRightIcon } from '@/components/icons'
import type { FieldworkDoc, Outcomes } from '@/state/fieldwork'
import { funnel, type Ledger, type Verdict } from '@/state/selectors'
import { SlotsOpened } from './SlotLedger'

/**
 * The one place the Overview explains its numbers: the verdict and the slots, then the journey. Collapsed, at the bottom,
 * so the cards above can stay short.
 */
export function HowCalculated({ v, ledger, doc, outcomes }: { v: Verdict; ledger: Ledger; doc: FieldworkDoc; outcomes: Outcomes }) {
  const plan = v.plan
  const flow = funnel(doc, outcomes)
  const support = plan
    ? [plan.source > 0 ? (plan.inReserve > 0 ? `Invite the ${plan.inReserve} in reserve and source ${plan.source} to be safe.` : `Source ${plan.source} to be safe.`) : `The ${plan.inReserve} in reserve cover it.`, plan.rate > 0 ? `About ${plan.pct}% of invited people complete.` : 'No one has completed yet.'].join(' ')
    : undefined

  return (
    <details data-testid="how-calculated" className="group rounded-md border border-mist bg-surface px-5 py-3 text-sm">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-xs font-medium text-graphite hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon size={14} className="transition-transform group-open:rotate-90" />
        How these numbers are calculated
      </summary>
      <div className="mt-4 grid gap-x-10 gap-y-5 text-graphite lg:grid-cols-2">
        <section data-testid="verdict-how" aria-label="Verdict and slots" className="flex flex-col gap-3">
          <h3 className="font-semibold text-ink">Verdict and slots</h3>
          <p className="tabular-nums" data-testid="verdict-basis">
            {v.basis}
          </p>
          {support && (
            <p className="tabular-nums" data-testid="closing-plan">
              {support}
            </p>
          )}
          {plan && <p className="tabular-nums">{plan.line}. To source: the number still to find, divided by the share of invited people who complete, rounded up.</p>}
          {v.warning && (
            <p className="flex items-start gap-2 text-ink">
              <AlertIcon size={14} className="mt-0.5 shrink-0" />
              {v.warning}
            </p>
          )}
          <SlotsOpened ledger={ledger} />
        </section>
        <section aria-label="Participant journey" className="flex flex-col gap-3">
          <h3 className="font-semibold text-ink">Participant journey</h3>
          <p>Each person is counted once, at the furthest stage they reached. An arrow shows how many of the people at the stage before it went on, and how many stopped there. Completed includes interviews that were later excluded in review.</p>
          <p className="tabular-nums" data-testid="funnel-total">
            {flow.total} invited = {flow.completed.n} completed ({flow.completed.accepted} accepted + {flow.completed.pending} under review + {flow.completed.excluded} excluded) + {flow.withdrew} withdrew + {flow.noShow} no-show{flow.gaveUp ? ` + ${flow.gaveUp} given up` : ''} + {flow.inProgress} still in progress
            {flow.sum === flow.total ? '.' : `. ${flow.total - flow.sum} unaccounted for.`}
          </p>
        </section>
      </div>
    </details>
  )
}
