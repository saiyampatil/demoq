import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { ISSUE_META, issueSummary, resolveIssue, type IssueSeverity } from '@/state/fieldwork'
import type { FWProps } from './FieldworkBits'

const dot: Record<IssueSeverity, string> = { Blocking: 'bg-negative-fg', Degraded: 'bg-pending-fg', Minor: 'bg-graphite' }
const sessionHref = (studyId: string, id: string) => studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })

export function IssuesTab({ doc, studyId, me, update }: FWProps) {
  const [status, setStatus] = useState('Open')
  const [severity, setSeverity] = useState('')
  const [resolving, setResolving] = useState<{ sessionId: string; id: string; type: string }>()
  const [note, setNote] = useState('')
  const sum = issueSummary(doc)
  const list = sum.all.filter((x) => (!status || x.status === status) && (!severity || x.severity === severity)).sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Issue summary" className="grid grid-cols-2 gap-4 rounded-md border border-mist bg-surface p-5 sm:grid-cols-4">
        {(
          [
            ['Open', sum.open, sum.open > 0 ? 'text-pending-fg' : ''],
            ['Open and blocking', sum.blocking, sum.blocking > 0 ? 'text-negative-fg' : ''],
            ['Resolved', sum.resolved, ''],
            ['Sessions affected', sum.sessions, ''],
          ] as const
        ).map(([l, n, c]) => (
          <div key={l}>
            <p className="text-sm text-graphite">{l}</p>
            <p className={cn('text-xl font-semibold tabular-nums', c)}>{n}</p>
          </div>
        ))}
      </section>

      <Card title="Every kind of issue" description="All the technical problems a session can hit, with how many have happened and what to do about each." flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Technical issues by type</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                {['Issue', 'Area', 'When', 'Happened', 'Open', 'What to do'].map((h) => (
                  <th key={h} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sum.byType.map((t) => (
                <tr key={t.type} className="border-b border-mist last:border-0 align-top">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {t.type}
                    {t.only && <span className="ml-2 text-xs font-normal text-graphite">{t.only} only</span>}
                  </th>
                  <td className="px-4 py-3 whitespace-nowrap text-graphite">{t.area}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-graphite">{t.stage}</td>
                  <td className="px-4 py-3 tabular-nums">{t.count === 0 ? <span className="text-muted">0</span> : t.count}</td>
                  <td className={cn('px-4 py-3 tabular-nums', t.open > 0 ? 'font-medium text-negative-fg' : 'text-muted')}>{t.open}</td>
                  <td className="min-w-64 px-4 py-3 text-graphite">{t.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Issue log"
        flush
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-graphite">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
                <option value="">All</option>
                <option>Open</option>
                <option>Resolved</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-graphite">Severity</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
                <option value="">All</option>
                <option>Blocking</option>
                <option>Degraded</option>
                <option>Minor</option>
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
                    {x.type}{' '}
                    <Link to={sessionHref(studyId, x.sessionId)} className="font-normal text-iris-700 hover:underline">
                      {x.sessionId}
                    </Link>
                  </p>
                  <p className="text-sm text-graphite">
                    {formatDateTime(x.at)}. {ISSUE_META[x.type].action}
                  </p>
                  {x.status === 'Resolved' && (
                    <p className="text-sm text-positive-fg">
                      Resolved{x.resolvedBy ? ` by ${x.resolvedBy}` : ''}: {x.resolution}
                    </p>
                  )}
                </div>
                {x.status === 'Open' ? (
                  <Button size="sm" onClick={() => setResolving({ sessionId: x.sessionId, id: x.id, type: x.type })}>
                    Mark resolved
                  </Button>
                ) : (
                  <span className="text-xs text-graphite">Resolved</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!resolving}
        onClose={() => setResolving(undefined)}
        title={`Resolve “${resolving?.type ?? ''}”`}
        description="Say what was done. It’s saved with your name and the time, and added to the activity log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(undefined)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!note.trim()}
              onClick={() => {
                if (resolving) update((d) => resolveIssue(d, resolving.sessionId, resolving.id, me, note))
                setResolving(undefined)
                setNote('')
              }}
            >
              Mark resolved
            </Button>
          </>
        }
      >
        <TextArea label="What was done (required)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  )
}
