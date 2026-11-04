import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { screenById, studyPath } from '@/routes/screens'
import type { FieldworkDoc } from '@/state/fieldwork'
import { journey, type JourneyKey } from '@/state/selectors'

/** The biggest drop is amber only when it loses at least this share of the people at the stage before. */
const BIG_DROP_PCT = 10

const sessionsFor = (studyId: string, q: Record<string, string>) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', ...q })}`

/**
 * Where invited people are being lost, so the Researcher knows what to fix. Each person is counted once, at the furthest
 * stage reached. Every tile and every arrow opens Sessions filtered to those people.
 */
export function ParticipantJourney({ doc, studyId, needsCount }: { doc: FieldworkDoc; studyId: string; /** Rows in Needs you. The note under the stages only shows while there are some. */ needsCount: number }) {
  const j = journey(doc)
  const cols = `repeat(${j.stages.length - 1}, minmax(0, 1fr) auto) minmax(0, 1fr)`

  return (
    <Card title="Participant journey (people)">
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
            // Amber only for the biggest drop, and only when it is a real share of the stage before it.
            const notable = step.biggest && !j.tooEarly && st.reached > 0 && (step.lost / st.reached) * 100 >= BIG_DROP_PCT
            const loss = (
              <li key={`${st.key}-arrow`} className="flex items-center justify-center max-sm:py-0">
                <Link
                  to={sessionsFor(studyId, { stuck: step.from })}
                  data-testid={`journey-step-${step.from}`}
                  data-biggest={notable ? 'true' : undefined}
                  aria-label={j.tooEarly ? `${step.lost} lost between ${st.label} and ${j.stages[i + 1].label}. Show them in Sessions.` : `${step.pct}% went on, ${step.lost} lost between ${st.label} and ${j.stages[i + 1].label}. Show them in Sessions.`}
                  className={cn('flex w-full min-w-16 flex-col items-center gap-1 rounded-sm px-2 py-1.5 text-center text-xs tabular-nums transition-colors hover:bg-haze', notable ? 'bg-pending-bg text-pending-fg hover:bg-pending-bg' : 'text-graphite')}
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

        {needsCount > 0 && (
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
        )}
      </div>
    </Card>
  )
}
