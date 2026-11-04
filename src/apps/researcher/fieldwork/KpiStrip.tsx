import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { formatDate } from '@/lib/format'
import { zoneLabel } from '@/lib/timeZone'
import { screenById, studyPath } from '@/routes/screens'
import type { FieldworkDoc, Outcomes } from '@/state/fieldwork'
import { durationStats, pacing, progress } from '@/state/selectors'

type Tone = 'plain' | 'amber' | 'green'

/** One figure: a big number, a short label and one line. The whole card goes to what the number is made of. */
function Kpi({ to, label, tone = 'plain', children, line, testId }: { to: string; label: string; tone?: Tone; children: ReactNode; line: ReactNode; testId: string }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        'group flex min-w-0 flex-col gap-0.5 rounded-md border bg-surface p-4 transition-colors hover:border-mist-strong',
        tone === 'amber' ? 'border-pending-line bg-pending-bg hover:border-pending-fg/40' : 'border-mist',
      )}
    >
      <span className="text-sm font-medium text-graphite">{label}</span>
      <span className={cn('flex items-baseline gap-1.5 whitespace-nowrap text-xl font-semibold tabular-nums', tone === 'amber' ? 'text-pending-fg' : tone === 'green' ? 'text-positive-fg' : 'text-ink')}>{children}</span>
      <span className="text-sm text-graphite">{line}</span>
    </Link>
  )
}

const unit = (text: string) => <span className="text-md font-medium text-graphite">{text}</span>

/**
 * The four numbers a Researcher checks first. Every figure comes from the same selectors as the verdict, the funnel and
 * the review queue, and every card opens the screen that shows what it is made of.
 */
export function KpiStrip({ doc, target, outcomes, awaiting, studyId, clock }: { doc: FieldworkDoc; target: number; outcomes: Outcomes; awaiting: number; studyId: string; clock: 'running' | 'stopped' | 'stopped-relaunch' | 'closed' }) {
  const prog = progress(doc, outcomes)
  const pace = pacing(doc, target, outcomes)
  const dur = durationStats(doc)
  const sessions = `${studyPath(studyId, screenById.R18)}?tab=sessions&filter=Completed`
  // Amber only when the average is well past the target: more than 20% over.
  const over = dur.avg !== null && dur.avg > dur.target * 1.2

  return (
    <section aria-label="Key figures" data-testid="kpi-strip" className="flex flex-col gap-3">
      <div className={cn('grid grid-cols-2 gap-4', awaiting > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        <Kpi testId="kpi-counting" to={studyPath(studyId, screenById.R21)} label="Toward target" line={`${prog.confirmed} accepted, ${prog.pending} under review.`}>
          {prog.toward}
          {unit(`of ${target}`)}
        </Kpi>
        {awaiting > 0 && (
          <Kpi testId="kpi-awaiting" to={studyPath(studyId, screenById.R21)} label="Awaiting review" line="Finished interviews you haven’t decided on.">
            {awaiting}
          </Kpi>
        )}
        <Kpi
          testId="kpi-days"
          to={studyPath(studyId, screenById.R15)}
          label="Days left"
          line={
            clock === 'closed'
              ? doc.closed
                ? `${formatDate(doc.closed.at)}, ${zoneLabel()}.`
                : 'Fieldwork is closed.'
              : clock !== 'running'
              ? clock === 'stopped-relaunch'
                ? 'Clock stopped. Resumes when you relaunch.'
                : 'Clock stopped. Resumes when you resume fieldwork.'
              : doc.window
                ? `Fieldwork closes ${formatDate(`${doc.window.end}T12:00:00-05:00`)}, ${zoneLabel()}.`
                : 'No fieldwork window is set.'
          }
        >
          {clock === 'closed' ? 'Closed' : clock !== 'running' ? 'Paused' : doc.window ? pace.left : '–'}
        </Kpi>
        <Kpi
          testId="kpi-length"
          to={sessions}
          label="Interview length"
          tone={over ? 'amber' : 'plain'}
          line={dur.n === 0 ? 'No finished interviews yet.' : `Target ${dur.target} min. ${dur.over} of ${dur.n} ran over.`}
        >
          {dur.avg === null ? '–' : dur.avg}
          {dur.avg !== null && unit('min')}
        </Kpi>
      </div>
    </section>
  )
}
