import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { screenById, studyPath } from '@/routes/screens'
import type { FieldworkDoc, Outcomes } from '@/state/fieldwork'
import { funnel, journey, type JourneyKey } from '@/state/selectors'

const sessionsFor = (studyId: string, q: Record<string, string>) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', ...q })}`

/**
 * Where invited people are being lost, so the Researcher knows what to fix. Each person is counted once, at the furthest
 * stage reached. Every tile and every arrow opens Sessions filtered to those people.
 */
export function ParticipantJourney({ doc, outcomes, studyId }: { doc: FieldworkDoc; outcomes: Outcomes; studyId: string }) {
  const j = journey(doc)
  const flow = funnel(doc, outcomes)
  const cols = `repeat(${j.stages.length - 1}, minmax(0, 1fr) auto) minmax(0, 1fr)`

  return (
    <Card title="Participant journey" description="Where invited people drop out. Each person is counted once, at the furthest stage they reached.">
      <div className="flex flex-col gap-5">
        <ol aria-label="Journey stages" data-testid="journey" className="grid items-stretch gap-y-3 max-sm:grid-cols-1 sm:[grid-template-columns:var(--cols)]" style={{ ['--cols' as string]: cols }}>
          {j.stages.flatMap((st, i) => {
            const step = j.steps[i]
            const tile = (
              <li key={st.key} className="min-w-0">
                <Link
                  to={sessionsFor(studyId, { reached: st.key })}
                  data-testid={`journey-${st.key}`}
                  aria-label={`${st.label}: ${st.reached} people. Show them in Sessions.`}
                  className="flex h-full flex-col gap-0.5 rounded-md border border-mist bg-surface px-3 py-3 transition-colors hover:border-mist-strong hover:bg-haze"
                >
                  <span className="text-sm font-medium text-graphite">{st.label}</span>
                  <span className="text-xl font-semibold tabular-nums">{st.reached}</span>
                </Link>
              </li>
            )
            if (!step) return [tile]
            const loss = (
              <li key={`${st.key}-arrow`} className="flex items-center justify-center max-sm:py-0">
                <Link
                  to={sessionsFor(studyId, { stuck: step.from })}
                  data-testid={`journey-step-${step.from}`}
                  data-biggest={step.biggest && !j.tooEarly ? 'true' : undefined}
                  aria-label={j.tooEarly ? `${step.lost} lost between ${st.label} and ${j.stages[i + 1].label}. Show them in Sessions.` : `${step.pct}% went on, ${step.lost} lost between ${st.label} and ${j.stages[i + 1].label}. Show them in Sessions.`}
                  className={cn('flex w-full min-w-16 flex-col items-center gap-1 rounded-sm px-2 py-1.5 text-center text-xs tabular-nums transition-colors hover:bg-haze', step.biggest && !j.tooEarly ? 'bg-pending-bg text-pending-fg hover:bg-pending-bg' : 'text-graphite')}
                >
                  {!j.tooEarly && <span className="text-sm font-semibold">{step.pct}%</span>}
                  <span className="flex w-full items-center" aria-hidden>
                    <span className="h-px flex-1 bg-current opacity-50" />
                    <ChevronRightIcon size={12} className="-ml-1 shrink-0 opacity-70" />
                  </span>
                  <span className="whitespace-nowrap">{step.lost} lost</span>
                </Link>
              </li>
            )
            return [tile, loss]
          })}
        </ol>

        <p className="text-sm text-ink" data-testid="journey-reading">
          {j.reading.text}
          {j.reading.link && (
            <>
              {' '}
              <Link to={sessionsFor(studyId, { stuck: j.reading.link.stuck as JourneyKey })} className="font-medium text-iris-700 hover:underline">
                {j.reading.link.label}
              </Link>
              .
            </>
          )}
        </p>

        <details className="group border-t border-mist pt-3 text-sm">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-xs font-medium text-graphite hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon size={14} className="transition-transform group-open:rotate-90" />
            How this is counted
          </summary>
          <div className="mt-3 flex flex-col gap-2 text-graphite">
            <p>An arrow shows how many of the people at the stage before it went on, and how many stopped there. Completed includes interviews that were later excluded in review.</p>
            <p className="tabular-nums" data-testid="funnel-total">
              {flow.total} invited = {flow.completed.n} completed ({flow.completed.accepted} accepted + {flow.completed.pending} under review + {flow.completed.excluded} excluded) + {flow.withdrew} withdrew + {flow.noShow} no-show{flow.gaveUp ? ` + ${flow.gaveUp} given up` : ''} + {flow.inProgress} still in progress
              {flow.sum === flow.total ? '.' : `. ${flow.total - flow.sum} unaccounted for.`}
            </p>
          </div>
        </details>
      </div>
    </Card>
  )
}
