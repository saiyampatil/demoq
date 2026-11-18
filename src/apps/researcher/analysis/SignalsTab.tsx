import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { codeSignals, plural, signalGroups, tensionsFor, type CodeSignal, type Tension } from '@/state/signals'
import { labelShown, needsReview } from '@/state/themeReadings'
import { CodePanel } from './CodePanel'
import { EmotionBar, FACES_NOTE, FitChip, HowItsDecided, KeyPopover, ToneBar } from './SignalBits'
import { ThemePanel, type Intent } from './ThemePanel'
import type { CodebookCtx } from './codebookCtx'
import { ReadingBar, ReadingChip, StatusChip, acceptRow, claimCue, emotionSummary, emotionSummaryTitle, readingCounts, themeRows, toneLabel, toneTitle, useExpanded, type ThemeRow } from './signalsShared'

export { FACES_NOTE, readingCounts, themeRows }

/** What the Signals tab is showing: kept by the page, so a tension or the footer can open a theme or a code, or start a review. */
export type SignalFocus = { theme?: string; code?: string; show?: 'all' | 'review'; review?: boolean }

/** One grid for the header, the theme rows and the code rows, so every number sits at the same x. */
const GRID = 'grid grid-cols-[minmax(160px,1fr)_84px_200px_210px_170px_100px] items-center gap-x-3 px-3'
/** The grid never gets narrower than this: when the panel leaves less room, the Name column shrinks first and then the table scrolls sideways. */
const TABLE_MIN = 'min-w-[1010px]'

/** Arrow keys move through a list of rows, as in the codebook. */
export function useArrows(ids: string[], current: string | undefined, pick: (id: string) => void, attr: string) {
  const ref = useRef<HTMLDivElement>(null)
  return {
    ref,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const i = ids.indexOf(current ?? '')
      const next = ids[Math.min(ids.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) {
        pick(next)
        ref.current?.querySelector<HTMLElement>(`[${attr}="${next}"]`)?.focus()
      }
    },
  }
}

/** "⚑ 4 tensions", with an amber dot when any are waiting for review. Sits beside the theme name. */
function TensionsChip({ row }: { row: ThemeRow }) {
  const n = row.tensions.length
  const toReview = row.tensions.filter((x) => x.status === 'Suggested' && !x.unavailable).length
  if (!n) return null
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap" data-testid="tension-chip">
      <span aria-hidden="true">⚑</span>
      {plural(n, 'tension')}
      {toReview > 0 && <span aria-label={`${toReview} to review`} title={`${toReview} to review`} className="size-2 rounded-full bg-emo-surprise" data-testid="tension-dot" />}
    </span>
  )
}

/** The Face or Speech cell: the mini bar, then the label with its base. The same at theme and code level. */
function BarCell({ bar, label, title, testid }: { bar: React.ReactNode; label: string; title?: string; testid: string }) {
  return (
    <span className="flex items-center gap-2" title={title}>
      {bar}
      <span className="text-[13px] whitespace-nowrap text-graphite tabular-nums" data-testid={testid}>
        {label}
      </span>
    </span>
  )
}

/** The Words vs delivery cell: the verdict, then the same three-part bar at both levels. */
function WordsCell({ verdict, p, u, m, chip }: { verdict: React.ReactNode; p: number; u: number; m: number; chip?: boolean }) {
  return (
    <span className="flex items-center gap-2" data-testid="fit-cell" data-chip={chip ? 'true' : undefined}>
      {verdict}
      {p + u + m > 0 && <ReadingBar p={p} u={u} m={m} />}
    </span>
  )
}

/** A code that also sits in another theme: a small link icon, with the theme named in the tooltip. */
function AlsoIn({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <span className="ml-1.5 inline-flex align-middle text-muted" title={`Also in ${names.join(', ')}`} aria-label={`Also in ${names.join(', ')}`} data-testid="also-in">
      <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M5 7l2-2M4.5 5.5l-1 1a1.8 1.8 0 002.5 2.5l1-1M7.5 6.5l1-1A1.8 1.8 0 006 3l-1 1" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** A2's table: one row per theme with its reading, its codes underneath, and the theme or code open in the panel. */
export function SignalsTab({ ctx, focus, setFocus, tensions, onOpenTension, expandAll }: { ctx: CodebookCtx; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTensions?: () => void; onOpenTension: (id: string) => void; /** Opens every theme on arrival (a link to the codes, `?view=code`). */ expandAll?: boolean }) {
  const { doc, basis } = ctx
  const toast = useToast()
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  const rows = useMemo(() => themeRows(doc, basis, tensions, signals), [doc, basis, tensions, signals])
  const loose = useMemo(() => signalGroups(doc, signals).find((g) => g.id === 'none')?.rows ?? [], [doc, signals])
  const [open, setOpen] = useExpanded(ctx.studyId)
  const [intent, setIntent] = useState<Intent>()
  const show = focus.show ?? 'all'
  const shown = show === 'review' ? rows.filter((r) => needsReview(r.status)) : rows
  const suggested = rows.filter((r) => r.status === 'Suggested')
  const homes = useMemo(() => {
    const m = new Map<string, string[]>()
    rows.forEach((r) => r.t.codes.forEach((c) => m.set(c.code.id, [...(m.get(c.code.id) ?? []), r.t.name])))
    return m
  }, [rows])
  const fullSample = basis.participants.size
  const partial = signals.some((s) => s.of !== fullSample) || rows.some((r) => r.t.of !== fullSample)

  // A link to the codes (or opening a code from elsewhere) shows them: every theme opens, or the one the code is in.
  useEffect(() => {
    if (expandAll) setOpen(new Set([...rows.map((r) => r.t.id), 'none']))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAll])
  useEffect(() => {
    if (!focus.code) return
    const home = rows.find((r) => r.t.codes.some((c) => c.code.id === focus.code))?.t.id ?? 'none'
    setOpen((s) => (s.has(home) ? s : new Set([...s, home])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.code])

  const selCode = focus.code ? signals.find((s) => s.code.id === focus.code) : undefined
  const selTheme = selCode ? undefined : rows.find((r) => r.t.id === focus.theme) ?? shown.find((r) => needsReview(r.status)) ?? shown[0]
  const arrows = useArrows(shown.map((r) => r.t.id), selTheme?.t.id, (id) => setFocus({ ...focus, theme: id, code: undefined }), 'data-theme')

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="Signals are read on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const allOpen = rows.length > 0 && rows.every((r) => open.has(r.t.id)) && (!loose.length || open.has('none'))
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  /** Accept the one open, then step to the next Suggested theme; leave review mode when there is none. */
  const acceptAndNext = (row: ThemeRow) => {
    const rest = suggested.filter((r) => r.t.id !== row.t.id)
    acceptRow(ctx, row, toast)
    setFocus(rest.length ? { ...focus, theme: rest[0].t.id, code: undefined, review: true, show: 'all' } : { ...focus, review: false })
  }
  const review = focus.review && selTheme && selTheme.status === 'Suggested' ? { index: Math.max(1, suggested.findIndex((r) => r.t.id === selTheme.t.id) + 1), total: suggested.length } : undefined

  /** A, E and L act on the open theme, like the buttons in its panel. */
  const keys = (e: React.KeyboardEvent) => {
    arrows.onKeyDown(e)
    const target = e.target as HTMLElement
    if (target.closest('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey || !selTheme) return
    const k = e.key.toLowerCase()
    if (k === 'a' && (selTheme.status === 'Suggested' || selTheme.status === 'Out of date')) acceptRow(ctx, selTheme, toast)
    if (k === 'e') setIntent({ mode: 'edit', n: (intent?.n ?? 0) + 1 })
    if (k === 'l') setIntent({ mode: 'leave', n: (intent?.n ?? 0) + 1 })
  }

  const codeRow = (c: CodeSignal, themeName?: string) => {
    const others = (homes.get(c.code.id) ?? []).filter((n) => n !== themeName)
    const on = selCode?.code.id === c.code.id
    return (
      <li key={`${themeName ?? 'none'}-${c.code.id}`} className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[22px] z-10 w-0.5 bg-mist" />
        <button type="button" data-code={c.code.id} data-testid="signal-row" aria-current={on ? 'true' : undefined} onClick={() => setFocus({ ...focus, code: c.code.id })} className={cn(GRID, 'h-11 w-full border-l-2 text-left text-[13px] transition-colors', on ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}>
          <span className="flex min-w-0 items-center overflow-hidden pl-7">
            <span className="truncate font-medium" title={c.code.name}>
              {c.code.name}
            </span>
            <AlsoIn names={others} />
            <span className="ml-1.5 text-xs whitespace-nowrap text-muted" data-testid="claim-cue">
              · {claimCue(c.points.map((p) => p.stance))}
            </span>
          </span>
          <span className="pr-6 text-right text-xs text-graphite tabular-nums">
            {c.people} of {c.of}
          </span>
          {c.readable ? <BarCell bar={<EmotionBar mini split={c.emotions} />} label={emotionSummary(c.emotions)} title={emotionSummaryTitle(c.emotions)} testid="face-cell" /> : <span className="text-[13px] text-muted" data-testid="face-cell">—</span>}
          {c.readable ? <BarCell bar={<ToneBar mini split={c.tones} />} label={toneLabel(c)} title={toneTitle(c)} testid="speech-label" /> : <span className="text-[13px] text-muted" data-testid="speech-label">—</span>}
          <WordsCell verdict={<FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />} p={c.showable ? c.fit.against : 0} u={c.showable ? c.fit.uncertain : 0} m={c.showable ? c.fit.fits : 0} />
          <span />
        </button>
      </li>
    )
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section aria-label="Theme readings" className="min-w-0 overflow-hidden rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist px-3 py-2">
          <div role="group" aria-label="Show" className="flex items-center gap-1 rounded-sm border border-mist-strong p-0.5 text-sm">
            <span className="px-1.5 text-xs text-graphite">Show:</span>
            {(
              [
                ['all', 'All'],
                ['review', 'Needs review'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={show === k} onClick={() => setFocus({ ...focus, show: k, review: false })} data-testid={`show-${k}`} className={cn('h-7 rounded-xs px-2.5', show === k ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
                {label}
                {k === 'review' && <span className={cn('ml-1 tabular-nums', show === k ? 'text-white/80' : 'text-muted')}>{rows.filter((r) => needsReview(r.status)).length}</span>}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <HowItsDecided />
          <KeyPopover />
          <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set([...rows.map((r) => r.t.id), 'none']))} className="text-xs font-medium text-iris-700 hover:underline" data-testid="expand-all">
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        {shown.length === 0 && show === 'review' ? (
          <EmptyState title="Every reading has a decision" description="Nothing is waiting for review. Continue to the report when you’re ready." action={<Button onClick={() => setFocus({ ...focus, show: 'all' })}>Show all</Button>} />
        ) : (
          <div ref={arrows.ref} onKeyDown={keys} className="overflow-x-auto">
            <div className={cn('flex flex-col', TABLE_MIN)}>
              <div className={cn(GRID, 'h-9 border-b border-mist bg-haze text-xs font-medium text-graphite')} data-testid="signal-head">
                <span className="pl-6">Name</span>
                <span className="pr-6 text-right" title={partial ? 'N is the people who were asked this question.' : undefined} data-testid="said-by-head">
                  Said by
                </span>
                <span title="A negative face fits a complaint." data-testid="face-head">
                  Face
                </span>
                <span>Speech</span>
                <span className="whitespace-nowrap">Words vs delivery</span>
                <span>Status</span>
              </div>
              <ul data-testid="theme-list">
                {shown.map((r) => {
                  const isOpen = open.has(r.t.id)
                  const label = labelShown(r.decision, r.reading)
                  const on = selTheme?.t.id === r.t.id
                  const n = r.reading.nums
                  return (
                    <li key={r.t.id} className="border-b border-mist last:border-0" data-testid="theme-item">
                      <div className="group relative">
                        <button type="button" onClick={() => toggle(r.t.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} the codes in ${r.t.name}`} data-testid="theme-expand" className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-xs p-1 text-graphite hover:bg-mist hover:text-ink">
                          <span className={cn('block transition-transform', isOpen && 'rotate-90')}>
                            <ChevronRightIcon size={12} />
                          </span>
                        </button>
                        <button type="button" data-theme={r.t.id} data-status={r.status} data-label={label} data-testid="theme-row" aria-current={on ? 'true' : undefined} onClick={() => setFocus({ ...focus, theme: r.t.id, code: undefined, review: false })} className={cn(GRID, 'h-14 w-full border-l-2 text-left transition-colors', on ? 'border-iris-600 bg-iris-50' : 'border-transparent bg-haze/60 group-hover:bg-haze')}>
                          <span className="min-w-0 overflow-hidden pl-6">
                            <span className="block truncate text-[15px] leading-5 font-semibold" title={r.t.name}>
                              {r.t.name}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs leading-4 whitespace-nowrap text-muted" data-testid="theme-meta">
                              <span className="shrink-0">{plural(r.t.codes.length, 'code')}</span>
                              <TensionsChip row={r} />
                              <span className="truncate" data-testid="claim-cue">· {claimCue(r.t.points.map((p) => p.stance), true)}</span>
                            </span>
                          </span>
                          <span className="pr-6 text-right text-xs text-graphite tabular-nums">
                            {r.t.people} of {r.t.of}
                          </span>
                          <BarCell bar={<EmotionBar mini split={r.t.emotions} />} label={emotionSummary(r.t.emotions)} title={emotionSummaryTitle(r.t.emotions)} testid="face-cell" />
                          <BarCell bar={<ToneBar mini split={r.t.tones} />} label={toneLabel(r.t)} title={toneTitle(r.t)} testid="speech-label" />
                          <WordsCell chip verdict={<ReadingChip label={label} />} p={n.P} u={n.U} m={n.M} />
                          <span className={cn(r.status === 'Suggested' && 'group-hover:invisible group-focus-within:invisible')} data-testid="theme-status">
                            <StatusChip status={r.status} />
                          </span>
                        </button>
                        {r.status === 'Suggested' && (
                          <button type="button" onClick={() => acceptRow(ctx, r, toast)} className="absolute top-1/2 right-3 hidden h-6 -translate-y-1/2 items-center rounded-xs bg-iris-600 px-2 text-xs font-medium text-white group-focus-within:inline-flex group-hover:inline-flex hover:bg-iris-700" data-testid="row-accept" aria-label={`Accept the reading for ${r.t.name}`}>
                            Accept
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <ul data-testid="theme-codes" className="border-t border-mist/70">
                          {r.t.codes.map((c) => codeRow(c, r.t.name))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
              {show === 'all' && loose.length > 0 && (
                <div className="border-t border-mist">
                  <div className="flex items-baseline gap-2 px-3 pt-3.5 pb-1.5">
                    <h3 className="pl-6 text-[15px] font-semibold">Not in a theme</h3>
                    <span className="text-xs text-muted">{plural(loose.length, 'code')} · no reading until they are in a theme</span>
                    <button type="button" onClick={() => toggle('none')} className="ml-auto text-xs font-medium text-iris-700 hover:underline" data-testid="none-toggle">
                      {open.has('none') ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {open.has('none') && <ul data-testid="none-codes">{loose.map((c) => codeRow(c))}</ul>}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">
        {selCode ? (
          <CodePanel key={selCode.code.id} s={selCode} ctx={ctx} tensions={tensionsFor(tensions, selCode.code.id)} theme={rows.find((r) => r.t.codes.some((c) => c.code.id === selCode.code.id))?.t} onTheme={(id) => setFocus({ ...focus, theme: id, code: undefined })} onOpenTension={onOpenTension} />
        ) : selTheme ? (
          <ThemePanel key={selTheme.t.id} row={selTheme} ctx={ctx} onCode={(id) => setFocus({ ...focus, code: id })} onOpenTension={onOpenTension} intent={intent} review={review} onAcceptNext={() => acceptAndNext(selTheme)} />
        ) : null}
      </div>
    </div>
  )
}
