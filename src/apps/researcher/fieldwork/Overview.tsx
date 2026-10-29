import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { fmtDay } from '@/state/launch'
import { attentionReason, consentSummary, durationStats, issueSummary, needsAttention, pacing, quotaFill } from '@/state/fieldwork'
import { slotText, type FWProps } from './FieldworkBits'

const sessionHref = (studyId: string, id: string) => studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })

export function Overview({ doc, audience, target, studyId, goTab, excluded }: FWProps) {
  const pace = pacing(doc, target, excluded)
  const dur = durationStats(doc)
  const fill = quotaFill(doc, audience, excluded)
  const issues = issueSummary(doc)
  const consent = consentSummary(doc)
  const attention = doc.sessions.filter(needsAttention)
  const behind = pace.expected - pace.completed
  const topOpen = issues.all.filter((x) => x.status === 'Open').sort((a, b) => (a.severity === 'Blocking' ? -1 : 1) - (b.severity === 'Blocking' ? -1 : 1)).slice(0, 4)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pace" description={doc.window ? `Fieldwork runs ${fmtDay(doc.window.start)} to ${fmtDay(doc.window.end)}.` : 'No fieldwork window is set.'}>
          <div className="flex flex-col gap-3">
            <p className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums">{pace.completed}</span>
              <span className="text-graphite tabular-nums">of {pace.target} count toward the target, day {pace.day} of {pace.days}</span>
            </p>
            <div className="relative h-2 rounded-full bg-haze" role="img" aria-label={`${pace.completed} completed, ${pace.expected} expected by now`}>
              <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (pace.completed / pace.target) * 100)}%` }} />
              <div className="absolute top-[-3px] h-[14px] w-0.5 bg-graphite" style={{ left: `${Math.min(100, (pace.expected / pace.target) * 100)}%` }} title={`Expected by now: ${pace.expected}`} />
            </div>
            <p className={cn('text-sm', behind > 0 ? 'text-pending-fg' : 'text-positive-fg')}>
              {behind > 0 ? `${behind} behind pace.` : 'On pace.'} About {pace.expected} would be done by now. At this rate the study ends with about {pace.projected} of {pace.target}.
            </p>
            <p className="text-xs text-graphite">{behind > 0 ? `${pace.left} days left. ` : ''}Booked and in-progress sessions count once they complete. Sessions excluded in Review don’t count.</p>
          </div>
        </Card>

        <Card title="Interview length" description={`Completed interviews against the ${dur.target} minute target.`}>
          {dur.n === 0 ? (
            <p className="text-sm text-graphite">No completed interviews yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p>
                  <span className="text-xl font-semibold tabular-nums">{dur.avg}</span> <span className="text-graphite">min average</span>
                </p>
                <p className="text-sm text-graphite tabular-nums">Median {dur.median}, shortest {dur.min}, longest {dur.max}</p>
              </div>
              <p className={cn('text-sm', (dur.avg ?? 0) > dur.target ? 'text-pending-fg' : 'text-graphite')}>
                {(dur.avg ?? 0) > dur.target ? `Averaging ${Math.round(((dur.avg ?? 0) - dur.target) * 10) / 10} min over target.` : `Averaging ${Math.round((dur.target - (dur.avg ?? 0)) * 10) / 10} min under target.`} {dur.over} of {dur.n} ran over.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {dur.byCohort.map((c) => (
                  <li key={c.name} className="flex gap-2">
                    <span className="flex-1">{c.name}</span>
                    <span className="tabular-nums">{c.avg} min <span className="text-graphite">({c.n})</span></span>
                  </li>
                ))}
              </ul>
              {dur.partial > 0 && <p className="text-xs text-graphite">{dur.partial} partial or ended-early sessions aren’t counted.</p>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Quota by segment" actions={<Button size="sm" variant="ghost" onClick={() => goTab('quotas')}>Segments and regions</Button>}>
          <ul className="flex flex-col gap-3">
            {fill.map((f) => (
              <li key={f.id}>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="flex-1 font-medium">{f.name}</span>
                  <span className="tabular-nums"><span className="font-semibold">{f.completed}</span> of {f.target}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
                  <div className="h-full bg-ink" style={{ width: `${f.target ? Math.min(100, (f.completed / f.target) * 100) : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Technical issues" actions={<Button size="sm" variant="ghost" onClick={() => goTab('issues')}>All issues</Button>}>
          <p className="text-sm">
            <span className={cn('text-xl font-semibold tabular-nums', issues.blocking > 0 && 'text-negative-fg')}>{issues.open}</span> <span className="text-graphite">open, {issues.blocking} blocking. {issues.resolved} resolved.</span>
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {topOpen.map((x) => (
              <li key={x.id} className="flex gap-2">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', x.severity === 'Blocking' ? 'bg-negative-fg' : x.severity === 'Degraded' ? 'bg-pending-fg' : 'bg-graphite')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {x.type} <Link to={sessionHref(studyId, x.sessionId)} className="text-iris-700 hover:underline">{x.sessionId}</Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Consent" actions={<Button size="sm" variant="ghost" onClick={() => goTab('consent')}>Consent log</Button>}>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-graphite">On record</dt><dd className="text-xl font-semibold tabular-nums">{consent.given}</dd></div>
            <div><dt className="text-graphite">Withdrawn</dt><dd className={cn('text-xl font-semibold tabular-nums', consent.withdrawn > 0 && 'text-pending-fg')}>{consent.withdrawn}</dd></div>
            <div><dt className="text-graphite">Not yet</dt><dd className="text-xl font-semibold tabular-nums">{consent.pending}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-graphite">{consent.recontactPct}% of consenting participants agreed to be contacted again.</p>
        </Card>
      </div>

      <Card title="Needs attention" description="Sessions that need a decision or a retry.">
        {attention.length === 0 ? (
          <p className="text-sm text-graphite">Nothing needs attention.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-mist">
            {attention.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                <Link to={sessionHref(studyId, s.id)} className="font-medium tabular-nums text-iris-700 hover:underline">{s.id}</Link>
                <span className="min-w-0 flex-1 basis-56 text-sm text-graphite">{attentionReason(s)}</span>
                <span className="text-xs text-graphite">{slotText(s.slot ?? s.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {doc.log.length > 0 && (
        <Card title="Activity">
          <ul className="flex flex-col gap-2 text-sm">
            {[...doc.log].reverse().map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.by}</span>: {l.text} <span className="text-xs text-graphite">{formatStamp(l.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
