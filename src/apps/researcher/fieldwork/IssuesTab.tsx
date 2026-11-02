import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { EmptyState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { formatSlot, formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { handledBySystem, ISSUE_FIX, sessionCountOf, type IssueSeverity } from '@/state/fieldwork'
import { issueSummary, needsYou } from '@/state/selectors'
import { SessionTag } from '../SessionTag'
import type { FWProps } from './FieldworkBits'

const dot: Record<IssueSeverity, string> = { Blocking: 'bg-negative-fg', Degraded: 'bg-pending-fg', Minor: 'bg-graphite' }
const sessionHref = (studyId: string, id: string) => studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })

const WHO: Record<'Participant' | 'Researcher' | 'PulseAI', string> = { Participant: 'Participant', Researcher: 'You', PulseAI: 'PulseAI' }
const sessionsFor = (studyId: string, q: Record<string, string>) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', ...q })}`

/**
 * "Is anything wrong that I should act on or watch?" Three figures, then only the kinds of issue that have happened.
 * A record, not a work list: recovery actions are in Needs you and on the session page, and an issue ends from the next
 * event (the participant starts or resumes, the link is opened, PulseAI recovers), or by giving up with a reason.
 */
export function IssuesTab({ doc, studyId }: FWProps) {
  const [status, setStatus] = useState('Open')
  const sum = issueSummary(doc)
  const needing = needsYou(doc).length
  const list = sum.all.filter((x) => !status || x.status === status).sort((a, b) => b.at.localeCompare(a.at))
  // Only what has happened. Open ones first, then the most frequent.
  const happened = sum.byType.filter((t) => t.count > 0).sort((a, b) => b.open - a.open || b.count - a.count)

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Issue summary" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-mist bg-surface p-5">
          <p className="text-sm font-medium text-graphite">Open now</p>
          <p className={cn('mt-1 text-[32px] leading-10 font-semibold tracking-tight tabular-nums', sum.open > 0 ? 'text-negative-fg' : 'text-ink')}>{sum.open}</p>
          <p className="mt-1 text-sm text-graphite">{sum.blocking > 0 ? `${sum.blocking} blocking a participant.` : 'Nothing is blocking a participant.'}</p>
        </div>
        <Link to={`${studyPath(studyId, screenById.R18)}#needs-you`} data-testid="issues-need-action" className={cn('rounded-md border p-5 transition-colors hover:border-mist-strong', needing > 0 ? 'border-pending-line bg-pending-bg' : 'border-mist bg-surface')}>
          <p className="text-sm font-medium text-graphite">Need your action</p>
          <p className={cn('mt-1 text-[32px] leading-10 font-semibold tracking-tight tabular-nums', needing > 0 ? 'text-pending-fg' : 'text-ink')}>{needing}</p>
          <p className="mt-1 text-sm text-graphite">{needing > 0 ? 'Open Needs you to act on them.' : 'Nothing is waiting on you.'}</p>
        </Link>
        <div className="rounded-md border border-mist bg-surface p-5">
          <p className="text-sm font-medium text-graphite">Resolved</p>
          <p className="mt-1 text-[32px] leading-10 font-semibold tracking-tight tabular-nums">{sum.resolved}</p>
          <p className="mt-1 text-sm text-graphite">{sum.selfFixed > 0 ? `${sum.selfFixed} fixed by participants themselves.` : 'Issues that have ended.'}</p>
        </div>
      </section>

      <Card title="What has happened" description="Only the kinds of issue that have happened at least once." flush>
        {happened.length === 0 ? (
          <EmptyState title="No issues yet" description="When a session hits a technical problem it appears here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" data-testid="issue-types">
              <caption className="sr-only">Issues that have happened, by type</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Issue', 'Open now', 'Total', 'Who acts', 'Sessions'].map((h) => (
                    <th key={h} scope="col" className="h-9 px-5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {happened.map((t) => (
                  <tr key={t.type} className="border-b border-mist last:border-0">
                    <th scope="row" className="px-5 py-3 font-medium">
                      {t.type}
                      {t.only && <span className="ml-2 text-xs font-normal text-graphite">{t.only} only</span>}
                    </th>
                    <td className={cn('px-5 py-3 tabular-nums', t.open > 0 ? 'font-semibold text-negative-fg' : 'text-muted')}>{t.open}</td>
                    <td className="px-5 py-3 tabular-nums">{t.count}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Tooltip content={`Resolves when: ${t.resolvesWhen.replace(/^The /, 'the ').replace(/^PulseAI/, 'PulseAI')}.`} focusable align="left">
                        <span className="underline decoration-mist-strong decoration-dotted underline-offset-4">{WHO[t.fixer]}</span>
                      </Tooltip>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Link to={sessionsFor(studyId, { issue: t.type })} className="font-medium text-iris-700 hover:underline tabular-nums">
                        View {t.sessions.length}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Issue log"
        description="A read-only record. Open a session to act on it."
        flush
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-graphite">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
                <option>Open</option>
                <option>Resolved</option>
              </select>
            </label>
          </div>
        }
      >
        {list.length === 0 ? (
          <EmptyState title="No issues match" description="Change the filters to see more." />
        ) : (
          <ul className="divide-y divide-mist">
            {list.map((x) => (
              <li key={x.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3">
                <span className="mt-1.5 flex items-center gap-1.5 text-xs text-graphite">
                  <span className={cn('size-2 rounded-full', dot[x.severity])} aria-hidden="true" />
                  {x.severity}
                </span>
                <div className="min-w-0 flex-1 basis-72">
                  <p className="font-medium">
                    {x.type}
                    {x.selfService && <span className="ml-2 rounded-xs border border-positive-line bg-positive-bg px-1.5 py-0.5 text-xs font-medium text-positive-fg">Fixed by the participant</span>}{' '}
                    <Link to={sessionHref(studyId, x.sessionId)} className="font-normal text-iris-700 hover:underline">
                      <SessionTag participantId={x.participantId} no={x.no} count={sessionCountOf(doc, x)} />
                    </Link>
                  </p>
                  <p className="text-sm text-graphite">
                    {formatStamp(x.at)}.{' '}
                    {x.status === 'Open' ? (handledBySystem(x.type) ? <span className="font-medium text-ink">PulseAI is handling this.</span> : <>Who fixes it: {ISSUE_FIX[x.type].fixer}. {ISSUE_FIX[x.type].resolvesWhen}.</>) : null}
                  </p>
                  {x.status === 'Resolved' && (
                    <p className="text-sm text-positive-fg">
                      Resolved: {x.resolution}
                      {x.resolvedAt ? ` · ${formatSlot(x.resolvedAt)}` : ''}
                      {x.detail ? <span className="text-graphite">. {x.detail}</span> : null}
                    </p>
                  )}
                </div>
                <span className={cn('text-xs', x.status === 'Open' ? 'font-medium text-pending-fg' : 'text-graphite')}>{x.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  )
}
