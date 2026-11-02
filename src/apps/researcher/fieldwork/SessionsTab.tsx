import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Table, type Column } from '@/components/Table'
import { moderatorName, sessionCountOf, type Session } from '@/state/fieldwork'
import { journeyPeople, type JourneyKey } from '@/state/selectors'
import { MaskedEmail } from '../MaskedEmail'
import { SessionTag } from '../SessionTag'
import { slotText, type FWProps } from './FieldworkBits'
import { FILTERS, listParams, sessionHref, sessionRows, type Filter } from './sessionList'

const SCROLL_KEY = 'pulseai-qual:sessions-scroll'

export function SessionsTab({ doc, studyId }: FWProps) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // The filter and the search live in the address, so a session page can bring the Researcher back to the same list.
  const asked = params.get('filter')
  const filter: Filter = FILTERS.includes(asked as Filter) ? (asked as Filter) : 'All'
  const q = params.get('q') ?? ''
  const setParam = (key: string, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value && !(key === 'filter' && value === 'All')) next.set(key, value)
      else next.delete(key)
      next.delete('viewed')
      return next
    }, { replace: true })
  const reached = params.get('reached') as JourneyKey | null
  const stuck = params.get('stuck') as JourneyKey | null
  // A number on the journey opens Sessions for the people behind it.
  const people = reached || stuck ? journeyPeople(doc, reached ? { reached } : { stuck: stuck! }) : undefined
  const issueType = params.get('issue')
  const rows = sessionRows(doc, params)
  const list = listParams(params)
  const open = (s: Session) => {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    } catch {
      /* the scroll position is a convenience */
    }
    navigate(sessionHref(studyId, s.id, { from: 'sessions', ...list }))
  }

  // Coming back from a session: the same scroll position, and the row just viewed is marked for a few seconds.
  const viewed = params.get('viewed')
  const [mark, setMark] = useState(viewed)
  useEffect(() => {
    if (!viewed) return
    setMark(viewed)
    let saved: number | undefined
    try {
      saved = Number(sessionStorage.getItem(SCROLL_KEY))
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-row-key="${CSS.escape(viewed)}"]`)
      if (saved) window.scrollTo({ top: saved })
      // Out of view after the jump (the list changed): bring the row into view instead.
      if (row) {
        const r = row.getBoundingClientRect()
        if (r.top < 0 || r.bottom > innerHeight) row.scrollIntoView({ block: 'center' })
      }
    })
    const t = setTimeout(() => setMark(null), 6000)
    return () => clearTimeout(t)
  }, [viewed])

  const columns: Column<Session>[] = [
    { key: 'id', header: 'Participant', cell: (s) => <SessionTag className="font-medium" participantId={s.participantId} no={s.no} count={sessionCountOf(doc, s)} /> },
    { key: 'email', header: 'Email', cell: (s) => <MaskedEmail email={s.email} /> },
    { key: 'country', header: 'Country', cell: (s) => <span className="whitespace-nowrap">{s.country}</span> },
    { key: 'mode', header: 'Moderator', cell: (s) => <span className="whitespace-nowrap">{moderatorName(s.moderatorId)}</span> },
    { key: 'status', header: 'Session', cell: (s) => (<span className="flex items-center gap-2"><StatusChip status={s.status} size="sm" />{s.gaveUp && <span className="text-xs text-pending-fg">Given up, slot opened</span>}{s.escalation && <span className="text-xs text-graphite">Escalated: {s.escalation.status.toLowerCase()}</span>}</span>) },
    { key: 'dur', header: 'Length', cell: (s) => (s.durationMin !== null ? <span className="whitespace-nowrap tabular-nums">{s.durationMin} min</span> : <span className="text-muted">—</span>) },
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
            <input value={q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search participant, email, country" aria-label="Search sessions" className="w-52 bg-transparent text-sm outline-none" />
          </span>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-graphite">Show</span>
            <select value={filter} onChange={(e) => setParam('filter', e.target.value)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
              {FILTERS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      {issueType && (
        <div data-testid="issue-filter" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-mist bg-haze px-5 py-2 text-sm">
          <span className="tabular-nums">
            {rows.length} {rows.length === 1 ? 'session' : 'sessions'} with “{issueType}”.
          </span>
          <button type="button" onClick={() => setParams({ tab: 'sessions' })} className="font-medium text-iris-700 hover:underline">
            Show everyone
          </button>
        </div>
      )}
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
      <Table caption="Fieldwork sessions" columns={columns} rows={rows} rowKey={(s) => s.id} rowClassName={(s) => (s.id === mark ? 'bg-iris-50' : undefined)} onRowClick={open} empty={<EmptyState title="No sessions match" description="Choose another filter or clear the search." />} />
    </Card>
  )
}
