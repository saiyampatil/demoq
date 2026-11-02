import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Table, type Column } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import { moderatorName, sessionCountOf, type Session } from '@/state/fieldwork'
import { journeyPeople, needsYou, type JourneyKey } from '@/state/selectors'
import { MaskedEmail } from '../MaskedEmail'
import { SessionTag } from '../SessionTag'
import { slotText, type FWProps } from './FieldworkBits'

type Filter = 'All' | 'In progress' | 'Completed' | 'Needs you' | 'Not started' | 'Has open issues' | 'Escalated'
const FILTERS: Filter[] = ['All', 'In progress', 'Completed', 'Needs you', 'Not started', 'Has open issues', 'Escalated']
const match: Record<Exclude<Filter, 'Needs you'>, (s: Session) => boolean> = {
  All: () => true,
  'In progress': (s) => s.status === 'Active' || s.status === 'Paused',
  Completed: (s) => s.status === 'Completed',
  'Not started': (s) => s.status === 'Not started' || s.status === 'Booked',
  'Has open issues': (s) => s.issues.some((i) => i.status === 'Open'),
  Escalated: (s) => !!s.escalation,
}

export function SessionsTab({ doc, studyId, withdrawn, onOpenConsent }: FWProps & { withdrawn: number; onOpenConsent: () => void }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const asked = params.get('filter')
  const [filter, setFilter] = useState<Filter>(FILTERS.includes(asked as Filter) ? (asked as Filter) : 'All')
  const [q, setQ] = useState('')
  const needing = new Set(needsYou(doc).flatMap((r) => (r.session ? [r.session.id] : [])))
  const test = (s: Session) => (filter === 'Needs you' ? needing.has(s.id) : match[filter](s))
  // A number on the journey opens Sessions for the people behind it.
  const reached = params.get('reached') as JourneyKey | null
  const stuck = params.get('stuck') as JourneyKey | null
  const people = reached || stuck ? journeyPeople(doc, reached ? { reached } : { stuck: stuck! }) : undefined
  const rows = doc.sessions.filter((s) => test(s) && (!people || people.has(s.participantId)) && (!q.trim() || [s.id, s.participantId, s.email, s.country].some((x) => x.toLowerCase().includes(q.trim().toLowerCase()))))
  const open = (s: Session) => navigate(studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', s.id) }))

  const columns: Column<Session>[] = [
    { key: 'id', header: 'Participant', cell: (s) => <SessionTag className="font-medium" participantId={s.participantId} no={s.no} count={sessionCountOf(doc, s)} /> },
    { key: 'email', header: 'Email', cell: (s) => <MaskedEmail email={s.email} /> },
    { key: 'country', header: 'Country', cell: (s) => <span className="whitespace-nowrap">{s.country}</span> },
    { key: 'mode', header: 'Moderator', cell: (s) => <span className="whitespace-nowrap">{moderatorName(s.moderatorId)}</span> },
    { key: 'status', header: 'Session', cell: (s) => (<span className="flex items-center gap-2"><StatusChip status={s.status} size="sm" />{s.gaveUp && <span className="text-xs text-pending-fg">Given up, slot opened</span>}{s.escalation && <span className="text-xs text-graphite">Escalated: {s.escalation.status.toLowerCase()}</span>}</span>) },
    { key: 'dur', header: 'Length', cell: (s) => (s.durationMin !== null ? <span className="whitespace-nowrap tabular-nums">{s.durationMin} min</span> : <span className="text-muted">—</span>) },
    {
      key: 'issues',
      header: 'Issues',
      cell: (s) => {
        const open = s.issues.filter((i) => i.status === 'Open').length
        const total = s.issues.length
        const tip = total === 0 ? 'No issues on this session.' : `${total} ${total === 1 ? 'issue' : 'issues'} in total, ${open} open.`
        return (
          <Tooltip content={tip} focusable align="left">
            <span className={cn('whitespace-nowrap tabular-nums', open > 0 ? 'font-medium text-negative-fg' : 'text-muted')}>{open > 0 ? open : 'None'}</span>
          </Tooltip>
        )
      },
    },
    { key: 'when', header: 'Slot or start', cell: (s) => <span className="whitespace-nowrap">{slotText(s.slot ?? s.startedAt)}</span> },
  ]

  return (
    <Card
      title="Sessions"
      flush
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onOpenConsent}>
            Consent log{withdrawn > 0 ? ` (${withdrawn} withdrawn)` : ''}
          </Button>
          <span className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong bg-surface px-2 focus-within:border-iris-600">
            <SearchIcon size={14} className="text-graphite" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search participant, email, country" aria-label="Search sessions" className="w-52 bg-transparent text-sm outline-none" />
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
      {people && (
        <div data-testid="journey-filter" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-mist bg-haze px-5 py-2 text-sm">
          <span className="tabular-nums">
            {people.size} {people.size === 1 ? 'person' : 'people'} {reached ? `reached “${reached}”` : `stopped at “${stuck}”, going no further`}.
          </span>
          <button type="button" onClick={() => setParams({ tab: 'sessions' })} className="font-medium text-iris-700 hover:underline">
            Show everyone
          </button>
        </div>
      )}
      <Table caption="Fieldwork sessions" columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={open} empty={<EmptyState title="No sessions match" description="Choose another filter or clear the search." />} />
    </Card>
  )
}
