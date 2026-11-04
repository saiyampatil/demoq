import { useMemo } from 'react'
import { targetOf, funnel, needsYou, outcomesOf, reserveCandidates, verdict } from '@/state/selectors'
import type { AudienceDoc } from '@/state/audience'
import type { FieldworkDoc } from '@/state/fieldwork'
import { useReviewState } from '@/state/reviewState'
import { reviewList } from '@/state/studySessions'

/**
 * Dev only. The two reconciliations the Overview used to explain to the Researcher: the verdict's basis (counting plus
 * still open, against the target) and the journey's total (invited = completed + withdrew + no-show + in progress).
 * The Researcher doesn't need the arithmetic, but a developer checking the counts still does.
 */
export function NumbersCheck({ doc, audience, fallbackTarget }: { doc: FieldworkDoc; audience: AudienceDoc | undefined; fallbackTarget?: number }) {
  const reviewState = useReviewState()
  const outcomes = useMemo(() => outcomesOf(reviewList(doc, reviewState)), [doc, reviewState])
  const target = targetOf(doc, audience, fallbackTarget)
  const reserve = useMemo(() => reserveCandidates(doc, audience), [doc, audience])
  const v = verdict(doc, target, outcomes, reserve, needsYou(doc).length)
  const flow = funnel(doc, outcomes)
  const sums = flow.sum === flow.total

  return (
    <section className="border-b border-mist px-4 py-3" data-testid="numbers-check">
      <h3 className="text-sm font-semibold">Check the numbers</h3>
      <p className="text-xs text-graphite">The two reconciliations behind the Overview, from the same selectors.</p>
      <dl className="mt-2 flex flex-col gap-2 text-xs tabular-nums">
        <div>
          <dt className="font-medium">Verdict ({v.level})</dt>
          <dd className="text-graphite" data-testid="verdict-basis">
            {v.basis}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Journey {sums ? '(adds up)' : '(does not add up)'}</dt>
          <dd className="text-graphite" data-testid="funnel-total">
            {flow.total} invited = {flow.completed.n} completed ({flow.completed.accepted} accepted + {flow.completed.pending} under review + {flow.completed.excluded} excluded) + {flow.withdrew} withdrew + {flow.noShow} no-show{flow.gaveUp ? ` + ${flow.gaveUp} given up` : ''} + {flow.inProgress} still in progress
            {sums ? '.' : `. ${flow.total - flow.sum} unaccounted for.`}
          </dd>
        </div>
      </dl>
    </section>
  )
}
