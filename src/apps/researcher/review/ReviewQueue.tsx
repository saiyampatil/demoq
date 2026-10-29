import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { AlertIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@/components/icons'
import { EmptyState, LoadingState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { FLAG_TYPES, MODERATOR_TYPES, REVIEW_STUDY_ID, reviewSessions, reviewSummary, SEGMENTS, scoreBand, type ReviewSession, type ReviewStatus, type ScoreBand } from '@/mock/review'
import { screenById, studyPath } from '@/routes/screens'
import { useStudies } from '@/state/StudyContext'
import { PageHeader } from '../../shared/PageHeader'

type Filters = { status: string; flag: string; integrity: string; quality: string; moderator: string; segment: string }
const NONE: Filters = { status: '', flag: '', integrity: '', quality: '', moderator: '', segment: '' }
const BANDS: ScoreBand[] = ['High', 'Mid', 'Low']

const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
const clockText = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export function ReviewQueue() {
  const { studyId = '' } = useParams()
  const { isEditable } = useStudies()
  const [params] = useSearchParams()
  // ?demo=loading|empty|reviewed shows the other queue states.
  const demo = params.get('demo')
  const [loaded, setLoaded] = useState(false)
  const [filters, setFilters] = useState<Filters>(NONE)
  const [search, setSearch] = useState('')
  const [asc, setAsc] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 700)
    return () => clearTimeout(t)
  }, [])

  const all: ReviewSession[] = useMemo(() => {
    if (demo === 'empty' || !isEditable(studyId) || studyId !== REVIEW_STUDY_ID) return []
    return demo === 'reviewed' ? reviewSessions.map((s) => (s.status === 'Under review' ? { ...s, status: 'Accepted' as ReviewStatus } : s)) : reviewSessions
  }, [demo, studyId, isEditable])

  const header = <PageHeader id="R21" title="Review queue" description="Every completed interview arrives here as Under review. Flags and scores help you decide. Nothing is excluded automatically." />

  if (!loaded || demo === 'loading')
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5">
          <LoadingState label="Loading the review queue" rows={8} />
        </div>
      </div>
    )

  if (all.length === 0)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="No interviews to review yet" description="Completed interviews appear here as Under review. Check fieldwork to see what is in progress." action={<Button to={studyPath(studyId, screenById.R18)}>Go to fieldwork</Button>} />
        </div>
      </div>
    )

  const sum = reviewSummary(all)
  const bandOf = (v: number, f: string) => !f || scoreBand(v) === f
  const q = search.trim().toLowerCase()
  const filtered = all
    .filter(
      (s) =>
        (!filters.status || s.status === filters.status) &&
        (!filters.flag || s.flags.some((f) => f.type === filters.flag)) &&
        bandOf(s.integrity, filters.integrity) &&
        bandOf(s.quality, filters.quality) &&
        (!filters.moderator || s.moderatorType === filters.moderator) &&
        (!filters.segment || s.segment === filters.segment) &&
        (!q || [s.id, s.segment, s.moderator].some((x) => x.toLowerCase().includes(q))),
    )
    .sort((a, b) => (asc ? 1 : -1) * (new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageNo = Math.min(page, pages - 1)
  const rows = filtered.slice(pageNo * pageSize, pageNo * pageSize + pageSize)
  const anyFilter = Object.values(filters).some(Boolean) || !!q
  const setF = (k: keyof Filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setPage(0)
  }
  const pageIds = rows.map((r) => r.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPage = pageIds.some((id) => selected.has(id))
  const href = (id: string) => studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', id) })

  return (
    <div className="flex flex-col gap-6">
      {header}

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Completed interviews" value={sum.total} hint="All arrive as Under review" />
        <Card label="Awaiting review" value={sum.underReview} total={sum.total} tone="pending" />
        <Card label="Reviewed and accepted" value={sum.accepted} total={sum.total} tone="positive" />
        <Card label="Excluded" value={sum.excluded} total={sum.total} tone="negative" />
      </section>

      {sum.underReview === 0 && (
        <p className="flex items-center gap-2 rounded-md border border-positive-line bg-positive-bg px-4 py-3 text-sm">
          <span className="font-medium">Everything is reviewed.</span> {sum.accepted} accepted and {sum.excluded} excluded. Reopen any session from its row if you need to change a decision.
        </p>
      )}

      <section aria-label="Filters" className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setF('status', v)} options={['Under review', 'Accepted', 'Excluded']} />
        <FilterSelect label="Flag type" value={filters.flag} onChange={(v) => setF('flag', v)} options={FLAG_TYPES} />
        <FilterSelect label="Integrity score" value={filters.integrity} onChange={(v) => setF('integrity', v)} options={BANDS} />
        <FilterSelect label="Interview quality" value={filters.quality} onChange={(v) => setF('quality', v)} options={BANDS} />
        <FilterSelect label="Moderator type" value={filters.moderator} onChange={(v) => setF('moderator', v)} options={MODERATOR_TYPES} />
        <FilterSelect label="Segment" value={filters.segment} onChange={(v) => setF('segment', v)} options={SEGMENTS} />
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-graphite">Search</span>
          <span className="flex h-9 items-center gap-2 rounded-sm border border-mist-strong bg-surface px-2.5 focus-within:border-iris-600">
            <SearchIcon size={14} className="text-graphite" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Participant ID, segment or moderator"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </span>
        </label>
        {anyFilter && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(NONE)
              setSearch('')
              setPage(0)
            }}
          >
            Clear filters
          </Button>
        )}
      </section>

      {selected.size > 0 && (
        <p className="flex items-center gap-3 text-sm">
          <span className="font-medium tabular-nums">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </p>
      )}

      <div className="rounded-md border border-mist bg-surface">
        {filtered.length === 0 ? (
          <EmptyState
            title="No sessions match these filters"
            description="Try removing a filter or changing the search."
            action={
              <Button
                onClick={() => {
                  setFilters(NONE)
                  setSearch('')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Completed interviews to review</caption>
              <thead>
                <tr className="border-b border-mist bg-haze">
                  <th scope="col" className="h-9 w-10 px-3">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allOnPage}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOnPage && someOnPage
                      }}
                      onChange={(e) =>
                        setSelected((s) => {
                          const n = new Set(s)
                          pageIds.forEach((id) => (e.target.checked ? n.add(id) : n.delete(id)))
                          return n
                        })
                      }
                      className="accent-[var(--color-iris-600)]"
                    />
                  </th>
                  <Th>Participant ID</Th>
                  <Th>Segment</Th>
                  <Th>Moderator</Th>
                  <th scope="col" aria-sort={asc ? 'ascending' : 'descending'} className="h-9 px-3 text-sm font-medium whitespace-nowrap text-graphite">
                    <button type="button" onClick={() => setAsc((x) => !x)} className="flex items-center gap-1 rounded-xs hover:text-ink">
                      Completed
                      <ArrowUpIcon size={12} className={cn('transition-transform', !asc && 'rotate-180')} />
                    </button>
                  </th>
                  <Th>Duration</Th>
                  <Th wrap>
                    <span className="flex items-center gap-1">
                      Integrity score
                      <Info text="Is this a genuine, eligible, engaged participant? Based on eligibility checks, answer consistency and engagement. It says nothing about how well the interview was run." />
                    </span>
                  </Th>
                  <Th wrap>
                    <span className="flex items-center gap-1">
                      Interview quality
                      <Info text="How well was the interview run? Based on moderator thoroughness and objectivity, such as covering mandatory questions and avoiding leading questions. It says nothing about the participant." />
                    </span>
                  </Th>
                  <Th>Flags</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rows.map((s) => (
                  <tr key={s.id} className={cn('border-b border-mist last:border-0', selected.has(s.id) && 'bg-paper')}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.id}`}
                        checked={selected.has(s.id)}
                        onChange={(e) =>
                          setSelected((p) => {
                            const n = new Set(p)
                            if (e.target.checked) n.add(s.id)
                            else n.delete(s.id)
                            return n
                          })
                        }
                        className="accent-[var(--color-iris-600)]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={href(s.id)} className="font-medium tabular-nums text-iris-700 underline-offset-2 hover:underline">
                        {s.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{s.segment}</td>
                    <td className="px-3 py-2.5">
                      <span className="block whitespace-nowrap">{s.moderator}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="block">{dayText(s.completedAt)}</span>
                      <span className="block text-xs text-graphite">{clockText(s.completedAt)}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{s.durationMin} min</td>
                    <td className="px-3 py-2.5"><Score value={s.integrity} name="Integrity" /></td>
                    <td className="px-3 py-2.5"><Score value={s.quality} name="Interview quality" /></td>
                    <td className="px-3 py-2.5"><Flags flags={s.flags} /></td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <StatusChip status={s.status} size="sm" />
                        {s.decision?.auto && <span className="text-xs text-graphite">auto</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1">
                        <Button size="sm" to={href(s.id)}>
                          {s.status === 'Under review' ? 'Review' : 'View'}
                        </Button>
                        <RowMenu id={s.id} to={href(s.id)} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-mist px-4 py-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-graphite">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(0)
                }}
                className={cn(controlBase, 'h-8 pr-7 text-sm')}
              >
                {[10, 25, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <span className="flex-1 text-graphite tabular-nums">
              {pageNo * pageSize + 1}–{Math.min(filtered.length, (pageNo + 1) * pageSize)} of {filtered.length}
              {anyFilter && ` (filtered from ${all.length})`}
            </span>
            <span className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={pageNo === 0} onClick={() => setPage(pageNo - 1)} aria-label="Previous page">
                <ChevronLeftIcon size={14} />
              </Button>
              <span className="px-1 tabular-nums">Page {pageNo + 1} of {pages}</span>
              <Button size="sm" variant="ghost" disabled={pageNo >= pages - 1} onClick={() => setPage(pageNo + 1)} aria-label="Next page">
                <ChevronRightIcon size={14} />
              </Button>
            </span>
          </footer>
        )}
      </div>
    </div>
  )
}

const Th = ({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) => (
  <th scope="col" className={cn('h-9 px-3 text-sm font-medium text-graphite', !wrap && 'whitespace-nowrap')}>
    {children}
  </th>
)

function Info({ text }: { text: string }) {
  return (
    <Tooltip focusable content={text} align="left">
      <span aria-label={text} className="inline-flex size-4 items-center justify-center rounded-full border border-graphite text-[10px] font-semibold text-graphite">
        i
      </span>
    </Tooltip>
  )
}

const bandClass: Record<ScoreBand, string> = {
  High: 'bg-positive-bg text-positive-fg',
  Mid: 'bg-pending-bg text-pending-fg',
  Low: 'bg-negative-bg text-negative-fg',
}

function Score({ value, name }: { value: number; name: string }) {
  const band = scoreBand(value)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-sm font-medium tabular-nums', bandClass[band])} title={`${name}: ${value}, ${band.toLowerCase()}`}>
      {value}
      <span className="text-xs font-normal">{band}</span>
    </span>
  )
}

const sevRank = { High: 3, Medium: 2, Low: 1 }

function Flags({ flags }: { flags: ReviewSession['flags'] }) {
  if (flags.length === 0) return <span className="text-muted">None</span>
  const top = [...flags].sort((a, b) => sevRank[b.severity] - sevRank[a.severity])[0]
  return (
    <Tooltip focusable align="right" content={flags.map((f) => `${f.type} (${f.severity})`).join(', ')}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
        <AlertIcon size={14} className={top.severity === 'High' ? 'text-negative-fg' : top.severity === 'Medium' ? 'text-pending-fg' : 'text-graphite'} />
        <span className="font-medium tabular-nums">{flags.length}</span>
        <span className="max-w-24 truncate text-graphite">{top.type}{flags.length > 1 ? ` +${flags.length - 1}` : ''}</span>
      </span>
    </Tooltip>
  )
}

function Card({ label, value, total, tone, hint }: { label: string; value: number; total?: number; tone?: 'pending' | 'positive' | 'negative'; hint?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  const bar = tone === 'positive' ? 'bg-positive-fg' : tone === 'negative' ? 'bg-negative-fg' : 'bg-pending-fg'
  return (
    <div className="rounded-md border border-mist bg-surface p-4">
      <p className="text-sm text-graphite">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {total ? <span className="text-sm text-graphite tabular-nums">{pct}% of {total}</span> : hint && <span className="text-sm text-graphite">{hint}</span>}
      </p>
      {total ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-haze" role="img" aria-label={`${value} of ${total}`}>
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-graphite">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlBase, 'h-9 min-w-32 pr-7 text-sm')}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

function RowMenu({ id, to }: { id: string; to: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('click', close)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', close, true)
    }
  }, [pos])
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={`More actions for ${id}`}
        onClick={(e) => {
          e.stopPropagation()
          const r = btn.current!.getBoundingClientRect()
          setPos(pos ? null : { x: r.right, y: r.bottom + 4 })
        }}
        className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="13" cy="8" r="1.3" />
        </svg>
      </button>
      {pos && (
        <div role="menu" style={{ position: 'fixed', top: pos.y, left: pos.x, transform: 'translateX(-100%)' }} className="z-40 w-48 rounded-md border border-mist bg-surface p-1 shadow-overlay">
          <Link role="menuitem" to={to} className="block rounded-sm px-3 py-1.5 text-sm hover:bg-haze">
            Open session
          </Link>
          <button
            role="menuitem"
            type="button"
            className="block w-full rounded-sm px-3 py-1.5 text-left text-sm hover:bg-haze"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(id)
              } catch {
                // Clipboard can be blocked.
              }
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? 'Copied' : 'Copy participant ID'}
          </button>
        </div>
      )}
    </>
  )
}

