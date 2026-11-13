import { Banner } from '@/components/Banner'
import { Card } from '@/components/Card'
import { outcomeOf } from '@/state/selectors'
import { balanceOf } from '@/state/stimulusPlans'
import type { FWProps } from './FieldworkBits'

/**
 * How evenly the stimuli are being shared, when the study splits or rotates them. Counted from the sessions every time.
 * Shows nothing for a study where everyone sees all in the library's order.
 */
export function StimulusBalance({ doc, outcomes }: Pick<FWProps, 'doc' | 'outcomes'>) {
  const excluded = new Set(doc.sessions.filter((s) => outcomeOf(outcomes, s) === 'Excluded').map((s) => s.id))
  const segments = balanceOf(doc.plan.stimulusPlans, doc.sessions, excluded)
  if (!segments) return null
  return (
    <Card title="Stimulus balance" description="How many people hold each stimulus, and how many see it first. Booked, started, completed and accepted sessions count; no-shows, cancellations and exclusions don’t.">
      <div className="flex flex-col gap-5" data-testid="stimulus-balance">
        {segments.map((seg) => (
          <div key={seg.segment} className="flex flex-col gap-2" data-testid="balance-segment" data-segment={seg.segment}>
            <h3 className="text-sm font-semibold">
              {seg.segment} <span className="font-normal text-graphite tabular-nums">· {seg.people} {seg.people === 1 ? 'person' : 'people'}</span>
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist text-left text-xs font-medium text-graphite">
                  <th className="py-1.5 pr-3">Stimulus</th>
                  <th className="py-1.5 pr-3 text-right">People</th>
                  <th className="py-1.5 pr-3 text-right">Seen first</th>
                  <th className="py-1.5 text-right">Shown so far</th>
                </tr>
              </thead>
              <tbody>
                {seg.rows.map((r) => (
                  <tr key={r.id} className="border-b border-mist last:border-b-0" data-testid="balance-row" data-stimulus={r.name} data-saw={r.saw} data-first={r.first}>
                    <td className="py-1.5 pr-3">{r.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.saw}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.first}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.shown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {seg.uneven && (
              <div data-testid="balance-warning">
                <Banner tone="warning" title="Uneven">
                  {seg.uneven.most.name} has {seg.uneven.most.saw} people and {seg.uneven.least.name} has {seg.uneven.least.saw}. They differ by more than 1.
                </Banner>
              </div>
            )}
            {seg.unfilled && (
              <p className="text-sm text-graphite" data-testid="balance-unfilled">
                {seg.unfilled}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
