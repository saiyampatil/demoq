import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { StatusGlyph } from '@/components/StatusChip'
import { statusFamily } from '@/components/status'
import { band, CODE_QUESTIONS, denominator, excerpt, peopleOf, type Code, type CodeStatus } from '@/state/codebook'
import { BulkAcceptDialog } from './CodeDialogs'
import { CodeDetail } from './CodeDetail'
import type { CodebookCtx } from './codebookCtx'

export type StatusFilter = CodeStatus | 'All'
type Kind = 'all' | 'guide' | 'new'

const FAMILY_TEXT: Record<string, string> = {
  pending: 'text-pending-fg',
  positive: 'text-positive-fg',
  negative: 'text-negative-fg',
  held: 'text-held-fg',
}
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'Suggested', label: 'To review' },
  { key: 'Accepted', label: 'Accepted' },
  { key: 'Rejected', label: 'Rejected' },
  { key: 'Merged', label: 'Merged' },
  { key: 'All', label: 'All' },
]

type Group = { id: string; label: string; text?: string; asked?: { n: number; of: number; skipped: string[] }; codes: Code[] }

export function CodesTab({ ctx, status, setStatus, picked, setPicked }: { ctx: CodebookCtx; status: StatusFilter; setStatus: (s: StatusFilter) => void; picked?: string; setPicked: (id?: string) => void }) {
  const { doc, basis } = ctx
  const [kind, setKind] = useState<Kind>('all')
  const [low, setLow] = useState(false)
  const [query, setQuery] = useState('')
  const [bulk, setBulk] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const people = useMemo(() => new Map(doc.codes.map((c) => [c.id, peopleOf(c, basis).size])), [doc.codes, basis])

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (c: Code) =>
      (status === 'All' || c.status === status) &&
      (kind === 'all' || (kind === 'new') === c.isNew) &&
      (!low || band(c.confidence) === 'Low') &&
      (!q || c.name.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q) || c.excerpts.some((x) => excerpt(x).text.toLowerCase().includes(q)))
    const byPeople = (a: Code, b: Code) => (people.get(b.id) ?? 0) - (people.get(a.id) ?? 0) || a.name.localeCompare(b.name)
    const out: Group[] = CODE_QUESTIONS.map((qn) => {
      const n = denominator({ questionId: qn.id, isNew: false }, basis)
      return {
        id: qn.id,
        label: qn.label,
        text: qn.text,
        asked: { n, of: basis.participants.size, skipped: qn.skipped.filter((s) => basis.participants.has(s.participantId)).map((s) => s.participantId) },
        codes: doc.codes.filter((c) => !c.isNew && c.questionId === qn.id && match(c)).sort(byPeople),
      }
    })
    out.push({ id: 'new', label: 'New codes, not asked about in the guide', codes: doc.codes.filter((c) => c.isNew && match(c)).sort(byPeople) })
    return out.filter((g) => g.codes.length)
  }, [doc.codes, status, kind, low, query, people, basis])

  const flat = groups.flatMap((g) => g.codes)
  const selected = doc.codes.find((c) => c.id === picked && flat.some((x) => x.id === c.id)) ?? flat[0]
  const highConfidence = doc.codes.filter((c) => c.status === 'Suggested' && band(c.confidence) === 'High')

  /** After a decision, move to the next code in the list as it was, so review is one click per code. */
  const advanceFrom = (id: string) => {
    const i = flat.findIndex((c) => c.id === id)
    const next = flat[i + 1] ?? flat[i - 1]
    setPicked(next?.id)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = flat.findIndex((c) => c.id === selected?.id)
    const next = flat[Math.min(flat.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (next) {
      setPicked(next.id)
      listRef.current?.querySelector<HTMLElement>(`[data-code="${next.id}"]`)?.focus()
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <section aria-label="Codes" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-col gap-3 border-b border-mist px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Status" className="flex rounded-sm border border-mist-strong p-0.5">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={status === t.key}
                  onClick={() => setStatus(t.key)}
                  className={cn('h-7 rounded-xs px-2.5 text-sm', status === t.key ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            {highConfidence.length > 0 && (
              <Button size="sm" onClick={() => setBulk(true)} data-testid="bulk-open">
                Accept high-confidence ({highConfidence.length})
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Search codes and quotes</span>
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted">
                <SearchIcon size={14} />
              </span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search codes and quotes" className={cn(controlBase, 'h-8 w-full pl-8 text-sm')} />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="sr-only">Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
                <option value="all">All types</option>
                <option value="guide">From the guide</option>
                <option value="new">New codes</option>
              </select>
            </label>
            <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2.5 text-sm text-graphite">
              <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} className="accent-[var(--color-iris-600)]" />
              Low confidence only
            </label>
          </div>
        </div>

        {flat.length === 0 ? (
          <EmptyState
            title={status === 'Suggested' && !query && !low && kind === 'all' ? 'Every code has a decision' : 'No codes match'}
            description={status === 'Suggested' && !query && !low && kind === 'all' ? 'Nothing is waiting for review. Group accepted codes into themes next.' : 'Try another status or clear the search.'}
            action={
              <Button
                onClick={() => {
                  setStatus('All')
                  setQuery('')
                  setLow(false)
                  setKind('all')
                }}
              >
                Show all codes
              </Button>
            }
          />
        ) : (
          <div ref={listRef} onKeyDown={onKey} className="flex flex-col">
            <div className="hidden items-center gap-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:flex">
              <span className="flex-1">Code</span>
              <span className="w-36">People who said it</span>
              <span className="w-16">Confidence</span>
            </div>
            {groups.map((g) => (
              <section key={g.id} aria-labelledby={`grp-${g.id}`} className="border-b border-mist last:border-0">
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 pt-3.5 pb-1.5">
                  <h3 id={`grp-${g.id}`} className="text-sm font-semibold">
                    {g.label}
                  </h3>
                  {g.asked && (
                    <span className={cn('text-xs tabular-nums', g.asked.n < g.asked.of ? 'text-pending-fg' : 'text-muted')} title={g.asked.skipped.length ? `Not asked: ${g.asked.skipped.join(', ')}` : undefined}>
                      {g.asked.n < g.asked.of ? `Asked ${g.asked.n} of ${g.asked.of}` : `Asked all ${g.asked.of}`}
                    </span>
                  )}
                  {g.text && <p className="w-full truncate text-xs text-graphite">“{g.text}”</p>}
                </header>
                <ul className="pb-2">
                  {g.codes.map((c) => (
                    <CodeRow key={c.id} code={c} n={people.get(c.id) ?? 0} of={denominator(c, basis)} on={c.id === selected?.id} onPick={() => setPicked(c.id)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">
        {selected ? (
          <CodeDetail key={selected.id} ctx={ctx} code={selected} onDecided={() => advanceFrom(selected.id)} onOpen={(id) => {
            // Stay in the current filter when the code is in it; otherwise show everything so it can be seen.
            if (!flat.some((x) => x.id === id) && !(status === 'Suggested' && doc.codes.find((x) => x.id === id)?.status === 'Suggested')) setStatus('All')
            setPicked(id)
          }} />
        ) : (
          <div className="rounded-md border border-dashed border-mist-strong bg-surface px-6 py-10 text-center text-sm text-graphite">Pick a code to see its quotes.</div>
        )}
      </div>

      <BulkAcceptDialog ctx={ctx} open={bulk} codes={highConfidence} onClose={() => setBulk(false)} />
    </div>
  )
}

function CodeRow({ code: c, n, of, on, onPick }: { code: Code; n: number; of: number; on: boolean; onPick: () => void }) {
  const fam = statusFamily[c.status]
  const conf = band(c.confidence)
  return (
    <li>
      <button
        type="button"
        data-code={c.id}
        data-testid="code-row"
        aria-current={on ? 'true' : undefined}
        onClick={onPick}
        className={cn(
          'group flex w-full items-center gap-3 border-l-2 px-4 py-2 text-left text-sm transition-colors',
          on ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze',
        )}
      >
        <span className={cn('shrink-0', FAMILY_TEXT[fam])} title={c.status}>
          <StatusGlyph family={fam} />
          <span className="sr-only">{c.status}: </span>
        </span>
        <span className={cn('min-w-0 flex-1 truncate', c.status === 'Rejected' || c.status === 'Merged' ? 'text-graphite line-through decoration-mist-strong' : 'font-medium text-ink')}>{c.name}</span>
        <span className="flex w-36 shrink-0 items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-haze" aria-hidden="true">
            <span className={cn('block h-full rounded-full', c.status === 'Accepted' ? 'bg-ink' : 'bg-graphite/50')} style={{ width: `${of ? (n / of) * 100 : 0}%` }} />
          </span>
          <span className="w-12 text-right text-xs text-graphite tabular-nums">
            {c.status === 'Merged' ? '—' : `${n} of ${of}`}
          </span>
        </span>
        <span className={cn('w-16 shrink-0 text-xs', conf === 'Low' ? 'font-medium text-pending-fg' : 'text-graphite')}>{c.status === 'Merged' ? '' : conf}</span>
      </button>
    </li>
  )
}
