// A2, the Tensions tab: places where two things disagree. The same shape as the other two tabs: a list on the left, one panel on the right.
// Four kinds, always in this order: Between segments, Said vs locked answer, Said vs did, Said vs showed. PulseAI suggests each one; you add
// it as a tension theme or dismiss it with a reason. Every card accounts for everyone in its base, and says so.
// A card that waits on a code you have not accepted sits in its own segment, locked, and is in no count.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { PlayIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { formatStamp } from '@/lib/format'
import { conceptStudyOf } from '@/mock/concepts'
import { screenById, studyPath } from '@/routes/screens'
import { codeThemes, dismissTension, restoreTension, setInsightNote, turnTensionIntoTheme } from '@/state/codebook'
import { TENSION_KINDS, TENSION_KIND_HINT, TENSION_KIND_LABEL, plural, segmentLabelOf, tensionsOf, type Tension, type TensionKind, type TensionStatus } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import { BackLink, FaceChip, FaceNotRight, InlineError, PanelSkeleton, PeopleList, PersonBar, RespondentQuote, type BarPerson } from './a2/ui'
import type { CodebookCtx } from './codebookCtx'
import { playHref } from './SignalBits'

/** 'Waiting' is the cards that need a code the Researcher has not accepted yet: not actionable, so never part of "To review". */
export type TensionFilter = TensionStatus | 'All' | 'Waiting'
const SEGMENTS: { key: TensionFilter; label: string }[] = [
  { key: 'Suggested', label: 'To review' },
  { key: 'Added as a tension theme', label: 'Added' },
  { key: 'Dismissed', label: 'Dismissed' },
  { key: 'Waiting', label: 'Waiting on codebook' },
  { key: 'All', label: 'All' },
]

const KIND_ICON: Record<TensionKind, React.ReactNode> = {
  'Between segments': <path d="M4 10c0-1.7 1.3-3 3-3m6 3c0-1.7-1.3-3-3-3M7 5.5a1.7 1.7 0 1 0 0-.01M13 5.5a1.7 1.7 0 1 0 0-.01" />,
  'Said vs locked answer': <path d="M6 9V7a3 3 0 0 1 6 0v2M5 9h8v5H5z" />,
  'Said vs did': <path d="M4 7h9m-3-3 3 3-3 3M14 13H5m3-3-3 3 3 3" />,
  'Said vs showed': <path d="M2.5 9S5 4.5 9 4.5 15.5 9 15.5 9 13 13.5 9 13.5 2.5 9 2.5 9ZM9 7.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z" />,
}
const KindChip = ({ kind, className }: { kind: TensionKind; className?: string }) => (
  <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-xs border border-mist-strong bg-surface px-2 text-xs font-medium whitespace-nowrap text-ink', className)} title={TENSION_KIND_HINT[kind]} data-testid="kind-chip">
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{KIND_ICON[kind]}</svg>
    {TENSION_KIND_LABEL[kind]}
  </span>
)
const DirectionalTag = ({ t }: { t: Tension }) =>
  t.directional ? (
    <span className="inline-flex h-6 items-center rounded-xs border border-pending-line bg-pending-bg px-2 text-xs font-medium text-pending-fg" title="The base, or a group it compares, is under 10 people. Read it as a direction, not a result." data-testid="directional-tag">Directional</span>
  ) : null

const TONES: BarPerson['tone'][] = ['warn', 'good', 'face', 'quiet']
const DOT: Record<BarPerson['tone'], string> = { good: 'bg-positive-fg', warn: 'bg-pending-fg', quiet: 'bg-tone-flat', face: 'bg-face-accent', none: 'bg-mist-strong' }

const waiting = (t: Tension) => !!t.unavailable && !t.decision
const reviewable = (t: Tension) => t.status === 'Suggested' && !waiting(t)
const inSegment = (t: Tension, f: TensionFilter) => (f === 'All' ? true : f === 'Waiting' ? waiting(t) : f === 'Suggested' ? reviewable(t) : t.status === f)

/** Where what people said doesn't add up. PulseAI suggests each one; you add it as a tension theme or dismiss it, and say why. */
export function TensionsTab({
  ctx,
  filter,
  setFilter,
  affects,
  setAffects,
  focusId,
  onJump,
  onContinue,
}: {
  ctx: CodebookCtx
  filter: TensionFilter
  setFilter: (f: TensionFilter) => void
  /** "all", "theme:{id}" or "concept:{id}": the theme or concept the list is narrowed to. */
  affects: string
  setAffects: (a: string) => void
  focusId?: string
  /** Jump to a theme (in the Themes tab) or a concept (in the Concepts tab), selected. */
  onJump: (a: { kind: 'theme' | 'concept' | 'themes'; id?: string }) => void
  onContinue: () => void
}) {
  const [kind, setKind] = useState<TensionKind | 'all'>('all')
  const [selected, setSelected] = useState<string | undefined>(focusId)
  const [adding, setAdding] = useState<Tension>()
  const [dismissing, setDismissing] = useState<Tension>()
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const all = useMemo(() => tensionsOf(ctx.doc, ctx.basis), [ctx.doc, ctx.basis])
  const study = conceptStudyOf(ctx.studyId)
  const themes = codeThemes(ctx.doc)

  // The theme or concept a card is linked to, by its codes (the same rule the Themes and Concepts panels use).
  const linkedTo = (t: Tension, a: string) => {
    if (a === 'all') return true
    const [k, id] = a.split(':')
    const codeIds = k === 'theme' ? themes.find((x) => x.id === id)?.codeIds ?? [] : [study?.concepts.find((x) => x.id === id)?.codeId ?? '']
    return t.codeIds.some((c) => codeIds.includes(c))
  }
  const affectsOptions = [
    ...themes.map((x) => ({ value: `theme:${x.id}`, label: x.name, group: 'Themes', n: all.filter((t) => !waiting(t) && linkedTo(t, `theme:${x.id}`)).length })),
    ...(study?.concepts.map((x) => ({ value: `concept:${x.id}`, label: `Concept ${x.letter}: ${x.name}`, group: 'Concepts', n: all.filter((t) => !waiting(t) && linkedTo(t, `concept:${x.id}`)).length })) ?? []),
  ]
  const inList = (t: Tension) => (kind === 'all' || t.kind === kind) && linkedTo(t, affects)
  const count = (f: TensionFilter) => all.filter((t) => inSegment(t, f) && inList(t)).length
  // Sorted by the people involved, the most first.
  const shown = all.filter((t) => inSegment(t, filter) && inList(t)).sort((a, b) => b.base - a.base || TENSION_KINDS.indexOf(a.kind) - TENSION_KINDS.indexOf(b.kind))
  const cur = shown.find((t) => t.id === selected) ?? shown[0]

  useEffect(() => { if (focusId) setSelected(focusId) }, [focusId])

  const jump = (t: Tension) => t.affects && onJump({ kind: t.affects.kind, id: t.affects.id })
  const restore = (t: Tension) => {
    ctx.act((d) => restoreTension(d, t, { by: ctx.me }))
    toast(t.status === 'Added as a tension theme' ? 'Back in To review. The tension theme was taken out.' : 'Back in To review')
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const row = el.closest<HTMLElement>('[data-row]')
    if (!row) return
    e.preventDefault()
    const i = shown.findIndex((t) => t.id === row.dataset.row)
    const next = shown[Math.min(shown.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    root.current?.querySelector<HTMLElement>(`[data-row="${next.id}"] [data-row-main]`)?.focus()
  }

  return (
    <div ref={root} onKeyDown={onKeyDown} className="flex flex-col gap-3">
      <p className="text-sm text-graphite" data-testid="tensions-intro">Places where two things disagree. Nothing reaches the report until you add it.</p>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-label="Tensions" data-testid="tension-list-pane" className="flex min-w-0 flex-col gap-3">
          <div role="group" aria-label="Tension status" className="flex flex-wrap rounded-sm border border-mist-strong bg-haze p-0.5">
            {SEGMENTS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} data-testid={`tf-${f.key}`} className={cn('min-h-9 flex-1 cursor-pointer rounded-xs px-2 text-xs whitespace-nowrap', filter === f.key ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}>
                {f.label} <span className="tabular-nums text-muted" data-testid={`tf-n-${f.key}`}>{count(f.key)}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-graphite">
              Type
              <select value={kind} onChange={(e) => setKind(e.target.value as TensionKind | 'all')} data-testid="type-filter" className={cn(controlBase, 'h-9 pr-7 text-sm')}>
                <option value="all">All types</option>
                {TENSION_KINDS.map((k) => <option key={k} value={k}>{TENSION_KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-graphite">
              Affects
              <select value={affects} onChange={(e) => setAffects(e.target.value)} data-testid="affects-filter" className={cn(controlBase, 'h-9 max-w-52 pr-7 text-sm')}>
                <option value="all">All</option>
                <optgroup label="Themes">{affectsOptions.filter((o) => o.group === 'Themes').map((o) => <option key={o.value} value={o.value}>{o.label} ({o.n})</option>)}</optgroup>
                {study && <optgroup label="Concepts">{affectsOptions.filter((o) => o.group === 'Concepts').map((o) => <option key={o.value} value={o.value}>{o.label} ({o.n})</option>)}</optgroup>}
              </select>
            </label>
            <span className="ml-auto text-xs text-graphite">Sorted by people involved</span>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-md border border-dashed border-mist-strong bg-surface">
              <EmptyState
                title={filter === 'Suggested' && kind === 'all' && affects === 'all' ? 'Every tension has a decision' : 'No tensions match'}
                description={filter === 'Suggested' && kind === 'all' && affects === 'all' ? 'Nothing is waiting for you here. Continue to the report when you’re ready.' : 'Try another segment, type or theme.'}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {filter === 'Suggested' && kind === 'all' && affects === 'all' && <Button variant="primary" onClick={onContinue} data-testid="empty-continue">Continue to Report</Button>}
                    <Button onClick={() => { setFilter('All'); setKind('all'); setAffects('all') }}>Show all tensions</Button>
                  </div>
                }
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5" data-testid="tension-list">
              {shown.map((t) => (
                <TensionRow key={t.id} t={t} ctx={ctx} on={cur?.id === t.id} onSelect={() => setSelected(t.id)} onJump={() => jump(t)} />
              ))}
            </ul>
          )}
        </section>

        <div className="lg:sticky lg:top-20">
          {cur ? (
            <TensionPanel key={cur.id} t={cur} ctx={ctx} onJump={onJump} onAdd={() => setAdding(cur)} onDismiss={() => setDismissing(cur)} onRestore={() => restore(cur)} />
          ) : (
            <div className="rounded-md border border-dashed border-mist-strong bg-surface" data-testid="panel-empty">
              <EmptyState title="Pick a tension" description="Open one to see who is in it, the moments behind it, and what adding it would do." />
            </div>
          )}
        </div>
      </div>

      <AddDialog t={adding} onClose={() => setAdding(undefined)} onConfirm={(t) => {
        ctx.act((d) => turnTensionIntoTheme(d, t, t.codeIds, t.themeName, t.summary, { by: ctx.me }))
        toast(`Added “${t.themeName}” as a tension theme`, { label: 'Undo', onClick: () => ctx.act((d) => restoreTension(d, t, { by: ctx.me })) })
        setAdding(undefined)
      }} ctx={ctx} />
      <DismissDialog t={dismissing} onClose={() => setDismissing(undefined)} onConfirm={(t, why) => {
        ctx.act((d) => dismissTension(d, t, { by: ctx.me }, why))
        toast('Tension dismissed', { label: 'Undo', onClick: () => ctx.act((d) => restoreTension(d, t, { by: ctx.me })) })
        setDismissing(undefined)
      }} />
    </div>
  )
}

/** One card in the list: its kind, whether it is directional, its status, its title, what it affects and how many people it is about. */
function TensionRow({ t, ctx, on, onSelect, onJump }: { t: Tension; ctx: CodebookCtx; on: boolean; onSelect: () => void; onJump: () => void }) {
  const locked = waiting(t)
  return (
    <li data-row={t.id} data-testid="tension-card" data-status={t.status} data-kind={t.kind} data-waiting={locked ? 'true' : undefined} data-selected={on ? 'true' : undefined} className={cn('group relative rounded-md border p-3.5 transition-colors', locked ? 'border-dashed border-mist-strong bg-paper' : on ? 'border-iris-600 border-l-4 bg-iris-50/40' : 'border-mist bg-surface hover:bg-haze')}>
      <div className="flex flex-wrap items-center gap-2">
        {locked ? <span className="inline-flex h-6 items-center gap-1.5 rounded-xs border border-mist-strong bg-surface px-2 text-xs font-medium text-graphite"><LockIcon /> Waiting on codebook</span> : <><KindChip kind={t.kind} /><DirectionalTag t={t} /></>}
        <span className="flex-1" />
        {!locked && <StatusChip status={t.status} size="sm" />}
      </div>
      <h3 className={cn('mt-2 text-[15px] leading-snug font-semibold', locked && 'text-graphite')}>
        <button type="button" data-row-main onClick={onSelect} aria-current={on ? 'true' : undefined} className="cursor-pointer rounded-xs text-left after:absolute after:inset-0 after:content-['']">{t.title}</button>
      </h3>
      {locked ? (
        <>
          <p className="mt-1 text-xs text-graphite" data-testid="waiting-line">{t.unavailable}</p>
          <p className="relative z-10 mt-2 flex items-center justify-between border-t border-mist pt-2 text-xs text-graphite">
            Waiting on codebook
            <Link to={studyPath(ctx.studyId, screenById.A1)} data-testid="open-codebook" className="min-h-9 content-center font-medium text-iris-700 hover:underline">Open in codebook →</Link>
          </p>
        </>
      ) : (
        <p className="relative z-10 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mist pt-2 text-xs text-graphite">
          {t.affects ? <button type="button" onClick={onJump} data-testid="affects-link" className="min-h-9 cursor-pointer rounded-xs text-left font-medium text-iris-700 hover:underline">Affects: {t.affects.name} ›</button> : <span>Affects no theme or concept yet</span>}
          <span className="ml-auto rounded-xs bg-haze px-1.5 py-0.5 tabular-nums" data-testid="people-involved">{t.kind === 'Between segments' ? plural(t.base, 'person', 'people') : `${t.base} of ${ctx.basis.participants.size} people`}</span>
        </p>
      )}
    </li>
  )
}

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8V6a4 4 0 0 1 8 0v2M4 8h10v7H4z" /></svg>
)

type Who = { title: string; rows: { id: string; segment: string; word: string }[] }

function TensionPanel({ t, ctx, onJump, onAdd, onDismiss, onRestore }: { t: Tension; ctx: CodebookCtx; onJump: (a: { kind: 'theme' | 'concept' | 'themes'; id?: string }) => void; onAdd: () => void; onDismiss: () => void; onRestore: () => void }) {
  const [params, setParams] = useSearchParams()
  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>(params.get('demo') === 'panel-error' ? 'error' : 'loading')
  const [who, setWho] = useState<Who | null>(null)
  const [moreMoments, setMoreMoments] = useState(false)
  const key = `tension:${t.id}`
  const [note, setNote] = useState(ctx.doc.insightNotes?.[key] ?? '')
  useEffect(() => {
    if (phase !== 'loading') return
    const id = setTimeout(() => setPhase('ok'), 350)
    return () => clearTimeout(id)
  }, [phase])
  if (phase === 'loading') return <PanelSkeleton />
  if (phase === 'error')
    return (
      <div className="rounded-md border border-mist bg-surface p-5">
        <InlineError message="This tension didn’t load. Your decisions are safe." onRetry={() => { params.delete('demo'); setParams(params, { replace: true }); setPhase('loading') }} />
      </div>
    )

  const locked = waiting(t)
  const N = ctx.basis.participants.size
  const tone = (i: number) => TONES[i % TONES.length]
  const people: BarPerson[] = [
    ...t.rows.flatMap((r, i) => r.who.map((id) => ({ id, tone: tone(i), word: r.label }))),
    ...(t.unaccounted?.who ?? []).map((id) => ({ id, tone: 'none' as const, word: t.unaccounted!.label })),
  ]
  const showWho = (title: string, ids: string[], word: string) => setWho({ title, rows: ids.map((id) => ({ id, segment: segmentLabelOf(id), word })) })
  const moments = moreMoments ? t.clips : t.clips.slice(0, 3)
  const theme = t.decision?.themeId ? ctx.doc.themes.find((x) => x.id === t.decision?.themeId) : undefined

  return (
    <section aria-label={`Tension ${t.title}`} data-testid="tension-panel" data-tension={t.id} data-status={t.status} className="flex max-h-[calc(100vh-9rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto pb-6">
        {who ? (
          <div className="a2-slide flex flex-col gap-3 px-5 py-4" data-testid="who-panel">
            <BackLink onClick={() => setWho(null)}>{t.title}</BackLink>
            <h3 className="text-sm font-semibold" data-testid="who-title">{who.title}</h3>
            <PeopleList rows={who.rows} />
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-2 border-b border-mist px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {locked ? <span className="inline-flex h-6 items-center gap-1.5 rounded-xs border border-mist-strong px-2 text-xs font-medium text-graphite"><LockIcon /> Waiting on codebook</span> : <><KindChip kind={t.kind} /><DirectionalTag t={t} /><StatusChip status={t.status} size="sm" /></>}
                {!locked && <span className="text-xs text-graphite tabular-nums" data-testid="based-on">Based on {t.base} of {N} people</span>}
                <span className="flex-1" />
                {!locked && t.status === 'Suggested' && <AIGeneratedTag />}
              </div>
              <h2 className="text-lg leading-snug font-semibold" data-testid="tension-title">{t.title}</h2>
            </header>

            {locked ? (
              <section className="flex flex-col gap-2 px-5 py-4">
                <p className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg" data-testid="waiting-line">{t.unavailable}</p>
                <Link to={studyPath(ctx.studyId, screenById.A1)} data-testid="open-codebook" className="min-h-9 self-start content-center text-sm font-medium text-iris-700 hover:underline">Open in codebook →</Link>
              </section>
            ) : (
              <>
                <section className="flex flex-col gap-2 border-b border-mist px-5 py-4" data-testid="tension-line">
                  <div className="ai-surface p-3">
                    <p className="text-[18px] leading-snug font-medium text-ink" data-testid="summary-sentence">{t.summary}</p>
                  </div>
                  {t.affects && <button type="button" onClick={() => onJump({ kind: t.affects!.kind, id: t.affects!.id })} data-testid="affects-link" className="min-h-9 cursor-pointer self-start rounded-xs text-sm font-medium text-iris-700 hover:underline">Affects: {t.affects.name} ›</button>}
                </section>

                <section aria-label="Who is in it" data-testid="tension-rows" className="flex flex-col gap-2.5 border-b border-mist px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold">{t.sides[0]?.label ?? 'The people'} · {t.base} {t.base === 1 ? 'person' : 'people'}</h3>
                    <button type="button" onClick={() => showWho(`Everyone in this card · ${t.base} people`, people.map((p) => p.id), 'In the base')} data-testid="show-who" className="min-h-9 cursor-pointer rounded-xs text-xs font-medium text-iris-700 hover:underline">Show who ›</button>
                  </div>
                  <PersonBar people={people} label={`${t.base} people split into ${t.rows.length} rows`} />
                  <ul className="flex flex-col gap-1.5">
                    {t.rows.map((r, i) => (
                      <li key={r.label} data-testid="tension-row" data-n={r.n} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', DOT[tone(i)])} />
                        <span className="min-w-0 flex-1">{r.label}</span>
                        <span className="font-medium tabular-nums">{r.n} of {t.base} people</span>
                        {r.n > 0 && <button type="button" onClick={() => showWho(r.label, r.who, r.label)} className="min-h-9 cursor-pointer rounded-xs px-1 text-xs font-medium text-iris-700 hover:underline">Show who</button>}
                      </li>
                    ))}
                    {t.unaccounted && t.unaccounted.n > 0 && (
                      <li data-testid="tension-unaccounted" data-n={t.unaccounted.n} className="flex items-center gap-2 text-sm text-graphite">
                        <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', DOT.none)} />
                        <span className="min-w-0 flex-1">{t.unaccounted.label} ({t.unaccounted.who.join(', ')})</span>
                        <span className="tabular-nums">{t.unaccounted.n} of {t.base} people</span>
                      </li>
                    )}
                  </ul>
                  <p className="text-xs text-graphite" data-testid="accounting-line">{t.accounting}</p>
                  {t.directional && <p className="text-xs text-pending-fg" data-testid="directional-note">Directional: {t.kind === 'Between segments' ? 'a group is' : 'the base is'} under 10 people. Read it as a direction, not a result.</p>}
                  {t.coverage?.map((c) => <p key={c} className="text-xs text-pending-fg" data-testid="tension-coverage">{c}</p>)}
                </section>

                <section aria-label="Supporting moments" data-testid="moments-section" className="flex flex-col gap-2.5 border-b border-mist px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold">Supporting moments ({moments.length} of {t.clips.length})</h3>
                    <span className="text-xs text-graphite">Sorted by people involved</span>
                  </div>
                  {t.clips.length === 0 && <p className="text-sm text-graphite">No moments to show.</p>}
                  <ul className="flex flex-col gap-2.5">
                    {moments.map((c) => (
                      <li key={c.participantId} data-testid="moment" className="flex flex-col gap-1.5 rounded-sm border border-mist bg-paper p-3">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-graphite tabular-nums">
                          <span className="font-medium text-ink">{c.participantId}</span>
                          <span>{segmentLabelOf(c.participantId)}</span>
                          <span>{mmss(c.atSec)}</span>
                          <Link to={playHref(ctx.studyId, c.sessionId, c.atSec)} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-xs px-1.5 font-medium text-iris-700 hover:underline" aria-label={`Play ${c.participantId} at ${mmss(c.atSec)}`}><PlayIcon size={11} /> Play</Link>
                        </div>
                        {c.faces?.map((f) => (
                          <div key={f.where} className="flex flex-col gap-1" data-testid="clip-face">
                            <p className="text-sm">Seen: {f.cue.charAt(0).toLowerCase() + f.cue.slice(1)}</p>
                            <p className="flex flex-wrap items-center gap-1.5">
                              <FaceChip label={f.emotion} confidence={f.confidence} corrected={f.corrected} at={f.where.replace(/^at /, '')} />
                              {f.fixKey && f.from && <FaceNotRight ctx={ctx} fixKey={f.fixKey} name={`${c.participantId}, ${f.where}`} from={f.from} who={c.participantId} />}
                            </p>
                          </div>
                        ))}
                        {c.quote && <RespondentQuote>{c.quote}</RespondentQuote>}
                        <p className="text-xs text-graphite">{c.note}</p>
                      </li>
                    ))}
                  </ul>
                  {t.clips.length > 3 && <button type="button" onClick={() => setMoreMoments((m) => !m)} data-testid="show-all-moments" className="min-h-9 cursor-pointer self-start rounded-xs text-xs font-medium text-iris-700 hover:underline">{moreMoments ? 'Show fewer' : `Show all ${t.clips.length}`}</button>}
                </section>

                <section aria-label="Your note" data-testid="note-section" className="flex flex-col gap-1.5 px-5 py-4">
                  <h3 className="text-xs font-semibold">Your note (private)</h3>
                  <TextArea aria-label="Your note on this tension" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => ctx.act((d) => setInsightNote(d, { id: key, name: t.title }, note, { by: ctx.me }))} rows={2} data-testid="note" hint="Kept apart from the tension. It is never part of the report." />
                </section>
              </>
            )}
          </>
        )}
      </div>

      {!locked && (
        <div role="group" aria-label="Decision" data-testid="decision" className="flex flex-wrap items-center gap-2 border-t border-mist bg-surface px-5 py-3">
          {t.status === 'Suggested' && (
            <>
              <Button onClick={onDismiss} data-testid="dismiss-tension">Dismiss</Button>
              <Button variant="primary" onClick={onAdd} data-testid="turn-theme">Add as a tension theme</Button>
            </>
          )}
          {t.status === 'Added as a tension theme' && t.decision && (
            <>
              <p className="min-w-0 flex-1 text-sm text-graphite" data-testid="added-line">
                <span className="font-medium text-positive-fg">Added as a tension theme</span> “{theme?.name ?? 'removed'}” · {t.decision.by}, {formatStamp(t.decision.at)}
              </p>
              {theme && <button type="button" onClick={() => onJump({ kind: 'themes' })} data-testid="view-theme" className="min-h-9 cursor-pointer rounded-xs text-sm font-medium text-iris-700 hover:underline">View theme</button>}
              <Button size="sm" onClick={onRestore} data-testid="restore-tension">Undo</Button>
            </>
          )}
          {t.status === 'Dismissed' && t.decision && (
            <>
              <p className="min-w-0 flex-1 text-sm text-graphite" data-testid="dismissed-line">Dismissed by {t.decision.by}, {formatStamp(t.decision.at)}. <span className="text-ink">“{t.decision.why}”</span></p>
              <Button size="sm" onClick={onRestore} data-testid="restore-tension">Restore</Button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** Adding a tension as a theme: no fields, only what it will do. */
function AddDialog({ t, ctx, onClose, onConfirm }: { t?: Tension; ctx: CodebookCtx; onClose: () => void; onConfirm: (t: Tension) => void }) {
  const clash = !!t && ctx.doc.themes.some((x) => x.name.trim().toLowerCase() === t.themeName.trim().toLowerCase())
  return (
    <Modal
      open={!!t}
      onClose={onClose}
      size="md"
      title="Add as a tension theme"
      description={t ? `“${t.title}”` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={clash} data-testid="turn-confirm" onClick={() => t && onConfirm(t)}>Add as a tension theme</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-1 text-sm" data-testid="add-consequences">
        <p className="font-medium">Adding it will:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>make it a theme tagged “From a tension”, called “{t?.themeName}”;</li>
          <li>send it to the report;</li>
          <li>mark the insights it affects as Out of date, with a “Related tension” line, so you look at them again.</li>
        </ul>
        {clash && <p className="text-xs text-negative-fg">A theme with this name already exists.</p>}
      </div>
    </Modal>
  )
}

const QUICK_REASONS = ['Too few people to read', 'Already covered by a theme', 'Not relevant to the brief', 'A first reaction was read wrongly']

/** Dismissing a tension needs a reason: a few quick ones, or your own words. It stays in the log and can be restored. */
function DismissDialog({ t, onClose, onConfirm }: { t?: Tension; onClose: () => void; onConfirm: (t: Tension, why: string) => void }) {
  const [why, setWhy] = useState('')
  useEffect(() => setWhy(''), [t])
  return (
    <Modal
      open={!!t}
      onClose={onClose}
      size="md"
      title="Dismiss this tension?"
      description={t ? `“${t.title}”. It stays in the log with your reason, and never reaches the client. You can restore it.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!why.trim()} data-testid="dismiss-confirm" onClick={() => t && onConfirm(t, why)}>Dismiss</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick reasons">
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button" aria-pressed={why === r} onClick={() => setWhy(r)} data-testid="quick-reason" className="min-h-9 cursor-pointer rounded-xs border border-mist-strong px-2.5 text-xs hover:bg-haze aria-pressed:border-iris-600 aria-pressed:bg-iris-50">{r}</button>
          ))}
        </div>
        <TextArea label="Reason (required)" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} data-testid="dismiss-why" />
      </div>
    </Modal>
  )
}
