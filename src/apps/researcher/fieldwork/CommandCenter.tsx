import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Table, type Column } from '@/components/Table'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { attentionReason, fieldworkSummary, moderatorName, needsAttention, pauseFieldwork, quotaFill, resumeFieldwork, type Session } from '@/state/fieldwork'
import { PageHeader } from '../../shared/PageHeader'
import { FieldworkGate, slotText } from './FieldworkBits'
import { useFieldwork } from './useFieldwork'

type Filter = 'All' | 'In progress' | 'Completed' | 'Needs attention' | 'Not started'
const FILTERS: Filter[] = ['All', 'In progress', 'Completed', 'Needs attention', 'Not started']
const match: Record<Filter, (s: Session) => boolean> = {
  All: () => true,
  'In progress': (s) => s.status === 'Active' || s.status === 'Paused',
  Completed: (s) => s.status === 'Completed',
  'Needs attention': needsAttention,
  'Not started': (s) => s.status === 'Not started' || s.status === 'Booked',
}

export function CommandCenter() {
  const { studyId, study, editable, audience, doc, me, update } = useFieldwork()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('All')
  const [pausing, setPausing] = useState(false)
  const [reason, setReason] = useState('')

  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />

  const sum = fieldworkSummary(doc)
  const fill = quotaFill(doc, audience)
  const attention = doc.sessions.filter(needsAttention)
  const rows = doc.sessions.filter(match[filter])
  const open = (s: Session) => navigate(studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', s.id) }))
  const pausedForVersion = study.status === 'Paused' && !doc.paused

  const columns: Column<Session>[] = [
    { key: 'id', header: 'Session', cell: (s) => <span className="font-medium tabular-nums">{s.id}</span> },
    { key: 'ref', header: 'Participant', cell: (s) => <span className="whitespace-nowrap tabular-nums">{s.ref}</span> },
    { key: 'cohort', header: 'Cohort', cell: (s) => (<span>{s.cohort ?? <span className="text-muted">None</span>}{s.reserve && <span className="ml-2 text-xs text-graphite">Reserve</span>}</span>) },
    { key: 'mode', header: 'Moderator', cell: (s) => moderatorName(s.moderatorId) },
    { key: 'access', header: 'Access', cell: (s) => <StatusChip status={s.access} size="sm" /> },
    { key: 'status', header: 'Session', cell: (s) => <StatusChip status={s.status} size="sm" /> },
    { key: 'when', header: 'Slot or start', cell: (s) => <span className="whitespace-nowrap">{slotText(s.slot ?? s.startedAt)}</span> },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R18"
        title="Fieldwork command center"
        description="Sessions for this study as they happen. Open one to see its full record."
        meta={
          <>
            <StatusChip status={study.status} size="sm" />
            <span>{doc.releaseVersion}, guide v{doc.plan.guideVersion}</span>
            <span className="tabular-nums">{sum.completed} of {study.targetCompletes} interviews completed</span>
          </>
        }
        actions={
          study.status === 'Live' && !doc.paused ? (
            <Button onClick={() => setPausing(true)}>Pause fieldwork</Button>
          ) : doc.paused ? (
            <Button variant="primary" onClick={() => update((d) => resumeFieldwork(d, me))}>
              Resume fieldwork
            </Button>
          ) : undefined
        }
      />

      {doc.paused && (
        <Banner tone="warning" title="Fieldwork is paused">
          {doc.paused.by} paused it, {formatDateTime(doc.paused.at)}: “{doc.paused.reason}”. No new sessions start while it’s paused. Pausing doesn’t change the guide.
        </Banner>
      )}
      {pausedForVersion && (
        <Banner tone="warning" title="Paused for a change to the guide, stimuli or moderator setup" actions={<Button size="sm" to={studyPath(studyId, screenById.R15)}>Go to launch</Button>}>
          Approve the new version, then relaunch it as the next release. Sessions already run stay tied to {doc.releaseVersion}.
        </Banner>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-mist bg-surface p-5 sm:grid-cols-4 xl:grid-cols-7">
        {(
          [
            ['Invited', sum.invited],
            ['Consented', sum.consented],
            ['In progress', sum.inProgress],
            ['Completed', sum.completed],
            ['No-show', sum.noShow],
            ['Rescheduled', sum.rescheduled],
            ['Needs attention', sum.attention],
          ] as const
        ).map(([label, n]) => (
          <div key={label}>
            <p className="text-sm text-graphite">{label}</p>
            <p className={cn('text-xl font-semibold tabular-nums', label === 'Needs attention' && n > 0 && 'text-pending-fg')}>{n}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Quota fill" description="Completed interviews against each cohort’s quota. Reserve people are replacements.">
          <ul className="flex flex-col gap-3">
            {fill.length === 0 && <li className="text-sm text-graphite">No cohorts.</li>}
            {fill.map((f) => (
              <li key={f.id}>
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 font-medium">{f.name}</span>
                  <span className="tabular-nums"><span className="font-semibold">{f.completed}</span> of {f.target}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
                  <div className="h-full bg-ink" style={{ width: `${f.target ? Math.min(100, (f.completed / f.target) * 100) : 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-graphite tabular-nums">{f.inProgress} in progress, {f.reserve} in reserve</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Needs attention" description="Sessions that need a decision or a retry.">
          {attention.length === 0 ? (
            <p className="text-sm text-graphite">Nothing needs attention.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-mist">
              {attention.slice(0, 6).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="font-medium tabular-nums">{s.id}</span>
                  <span className="min-w-0 flex-1 basis-40 text-sm text-graphite">{attentionReason(s)}</span>
                  <Button size="sm" variant="ghost" onClick={() => open(s)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Sessions"
        flush
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-graphite">Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
              {FILTERS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        }
      >
        <Table caption="Fieldwork sessions" columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={open} empty={<EmptyState title="No sessions match" description="Choose another filter." />} />
      </Card>

      <Modal
        open={pausing}
        onClose={() => setPausing(false)}
        title="Pause fieldwork?"
        description="No new sessions start while it’s paused. Sessions in progress aren’t cut off. The reason is logged with your name and the time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPausing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!reason.trim()}
              onClick={() => {
                update((d) => pauseFieldwork(d, reason, me))
                setPausing(false)
                setReason('')
              }}
            >
              Pause fieldwork
            </Button>
          </>
        }
      >
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  )
}
