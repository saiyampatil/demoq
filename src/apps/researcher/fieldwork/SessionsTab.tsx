import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Table, type Column } from '@/components/Table'
import { screenById, studyPath } from '@/routes/screens'
import { moderatorName, needsAttention, type Session } from '@/state/fieldwork'
import { slotText, type FWProps } from './FieldworkBits'

type Filter = 'All' | 'In progress' | 'Completed' | 'Needs attention' | 'Not started' | 'Has open issues'
const FILTERS: Filter[] = ['All', 'In progress', 'Completed', 'Needs attention', 'Not started', 'Has open issues']
const match: Record<Filter, (s: Session) => boolean> = {
  All: () => true,
  'In progress': (s) => s.status === 'Active' || s.status === 'Paused',
  Completed: (s) => s.status === 'Completed',
  'Needs attention': needsAttention,
  'Not started': (s) => s.status === 'Not started' || s.status === 'Booked',
  'Has open issues': (s) => s.issues.some((i) => i.status === 'Open'),
}

export function SessionsTab({ doc, studyId }: FWProps) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('All')
  const [q, setQ] = useState('')
  const rows = doc.sessions.filter((s) => match[filter](s) && (!q.trim() || [s.id, s.ref, s.cohort ?? '', s.region ?? ''].some((x) => x.toLowerCase().includes(q.trim().toLowerCase()))))
  const open = (s: Session) => navigate(studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', s.id) }))

  const columns: Column<Session>[] = [
    { key: 'id', header: 'Session', cell: (s) => <span className="font-medium whitespace-nowrap tabular-nums">{s.id}</span> },
    { key: 'ref', header: 'Participant', cell: (s) => <span className="whitespace-nowrap tabular-nums">{s.ref}</span> },
    { key: 'cohort', header: 'Segment', cell: (s) => (<span className="whitespace-nowrap">{s.cohort ?? <span className="text-muted">None</span>}{s.reserve && <span className="ml-2 text-xs text-graphite">Reserve</span>}</span>) },
    { key: 'region', header: 'Region', cell: (s) => s.region ?? <span className="text-muted">Unknown</span> },
    { key: 'mode', header: 'Moderator', cell: (s) => <span className="whitespace-nowrap">{moderatorName(s.moderatorId)}</span> },
    { key: 'access', header: 'Access', cell: (s) => <StatusChip status={s.access} size="sm" /> },
    { key: 'status', header: 'Session', cell: (s) => <StatusChip status={s.status} size="sm" /> },
    { key: 'dur', header: 'Length', cell: (s) => (s.durationMin !== null ? <span className="tabular-nums">{s.durationMin} min</span> : <span className="text-muted">—</span>) },
    { key: 'issues', header: 'Issues', cell: (s) => { const o = s.issues.filter((i) => i.status === 'Open').length; return s.issues.length === 0 ? <span className="text-muted">None</span> : <span className={cn('tabular-nums', o > 0 && 'font-medium text-negative-fg')}>{o} open / {s.issues.length}</span> } },
    { key: 'when', header: 'Slot or start', cell: (s) => <span className="whitespace-nowrap">{slotText(s.slot ?? s.startedAt)}</span> },
  ]

  return (
    <Card
      title="Sessions"
      flush
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong bg-surface px-2 focus-within:border-iris-600">
            <SearchIcon size={14} className="text-graphite" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search session, participant, region" aria-label="Search sessions" className="w-52 bg-transparent text-sm outline-none" />
          </span>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-graphite">Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
              {FILTERS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <Table caption="Fieldwork sessions" columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={open} empty={<EmptyState title="No sessions match" description="Choose another filter or clear the search." />} />
    </Card>
  )
}
