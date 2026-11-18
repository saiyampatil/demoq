import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { codeSignals, plural, signalGroups, tensionsFor, type CodeSignal, type Tension } from '@/state/signals'
import { labelShown, needsReview } from '@/state/themeReadings'
import { CodePanel } from './CodePanel'
import { FACES_NOTE, FitChip, HowItsDecided, KeyPopover } from './SignalBits'
import { ThemePanel, type Intent } from './ThemePanel'
import type { CodebookCtx } from './codebookCtx'
import { ReadingBar, ReadingChip, StatusChip, acceptRow, emotionSummary, emotionSummaryTitle, readingCounts, themeRows, toneLabel, toneTitle, useExpanded, type ThemeRow } from './signalsShared'

export { FACES_NOTE, readingCounts, themeRows }

/** What the Signals tab is showing: kept by the page, so a tension or the footer can open a theme or a code, or start a review. */
export type SignalFocus = { theme?: string; code?: string; show?: 'all' | 'review'; review?: boolean }

/** One grid for the header, the theme rows and the code rows, so every number sits at the same x. */
const GRID = 'grid grid-cols-[minmax(8rem,1fr)_3.75rem_6.5rem_7.5rem_7.5rem_5rem_5.5rem] items-center gap-x-2 px-3'

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

/** "1 tension" or "4 tensions", with an amber dot when any are waiting for review. */
function TensionsCell({ row }: { row: ThemeRow }) {
  const n = row.tensions.length
  const toReview = row.tensions.filter((x) => x.status === 'Suggested' && !x.unavailable).length
  if (!n) return <span />
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-graphite" data-testid="tension-chip">
      {plural(n, 'tension')}
      {toReview > 0 && <span aria-label={`${toReview} to review`} title={`${toReview} to review`} className="size-2 rounded-full bg-emo-surprise" data-testid="tension-dot" />}
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
      <li key={`${themeName ?? 'none'}-${c.code.id}`}>
        <button type="button" data-code={c.code.id} data-testid="signal-row" aria-current={on ? 'true' : undefined} onClick={() => setFocus({ ...focus, code: c.code.id })} className={cn(GRID, 'h-10 w-full border-l-2 py-0 text-left text-[13px] transition-colors', on ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}>
          <span className="flex min-w-0 items-center pl-6">
            <span className="truncate font-medium" title={c.code.name}>
              {c.code.name}
            </span>
            <AlsoIn names={others} />
          </span>
          <span className="text-right text-xs text-graphite tabular-nums">
            {c.people} of {c.of}
          </span>
          <span className="truncate text-xs text-graphite tabular-nums" title={c.readable ? emotionSummaryTitle(c.emotions) : undefined} data-testid="face-cell">
            {c.readable ? emotionSummary(c.emotions) : '—'}
          </span>
          <span className="truncate text-xs text-graphite tabular-nums" title={c.readable ? toneTitle(c) : undefined} data-testid="speech-label">
            {c.readable ? toneLabel(c) : '—'}
          </span>
          <span data-testid="fit-cell">
            <FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />
          </span>
          <span />
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
          <div ref={arrows.ref} onKeyDown={keys} className="flex flex-col">
            <div className={cn(GRID, 'sticky top-0 z-10 h-8 border-b border-mist bg-haze text-xs font-medium text-graphite')} data-testid="signal-head">
              <span className="pl-6">Name</span>
              <span className="text-right" title={partial ? 'N is the people who were asked this question.' : undefined} data-testid="said-by-head">
                Said by
              </span>
              <span>Face</span>
              <span>Speech</span>
              <span className="whitespace-nowrap">Words vs delivery</span>
              <span>Tensions</span>
              <span>Status</span>
            </div>
            <ul data-testid="theme-list">
              {shown.map((r) => {
                const isOpen = open.has(r.t.id)
                const label = labelShown(r.decision, r.reading)
                const on = selTheme?.t.id === r.t.id
                return (
                  <li key={r.t.id} className="group relative border-b border-mist last:border-0" data-testid="theme-item">
                    <button type="button" onClick={() => toggle(r.t.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} the codes in ${r.t.name}`} data-testid="theme-expand" className="absolute top-4 left-3 z-10 rounded-xs p-1 text-graphite hover:bg-mist hover:text-ink">
                      <span className={cn('block transition-transform', isOpen && 'rotate-90')}>
                        <ChevronRightIcon size={12} />
                      </span>
                    </button>
                    <button type="button" data-theme={r.t.id} data-status={r.status} data-label={label} data-testid="theme-row" aria-current={on ? 'true' : undefined} onClick={() => setFocus({ ...focus, theme: r.t.id, code: undefined, review: false })} className={cn(GRID, 'min-h-14 w-full border-l-2 py-2 text-left transition-colors', on ? 'border-iris-600 bg-iris-50' : 'border-transparent bg-haze/60 hover:bg-haze')}>
                      <span className="min-w-0 pl-6 leading-snug">
                        <span className="text-[15px] font-semibold">{r.t.name}</span>
                        <span className="ml-2 text-xs whitespace-nowrap text-muted">{plural(r.t.codes.length, 'code')}</span>
                      </span>
                      <span className="text-right text-xs text-graphite tabular-nums">
                        {r.t.people} of {r.t.of}
                      </span>
                      <span className="truncate text-xs text-graphite tabular-nums" title={emotionSummaryTitle(r.t.emotions)}>
                        {emotionSummary(r.t.emotions)}
                      </span>
                      <span className="truncate text-xs text-graphite tabular-nums" title={toneTitle(r.t)}>
                        {toneLabel(r.t)}
                      </span>
                      <span className="flex flex-col items-start gap-1">
                        <ReadingChip label={label} />
                        {r.reading.nums.R > 0 && <ReadingBar p={r.reading.nums.P} u={r.reading.nums.U} m={r.reading.nums.M} />}
                      </span>
                      <TensionsCell row={r} />
                      <span className={cn(r.status === 'Suggested' && 'group-hover:invisible')} data-testid="theme-status">
                        <StatusChip status={r.status} />
                      </span>
                    </button>
                    {r.status === 'Suggested' && (
                      <button type="button" onClick={() => acceptRow(ctx, r, toast)} className="absolute top-1/2 right-3 hidden h-6 -translate-y-1/2 items-center rounded-xs bg-iris-600 px-2 text-xs font-medium text-white group-hover:inline-flex hover:bg-iris-700 focus-visible:inline-flex" data-testid="row-accept" aria-label={`Accept the reading for ${r.t.name}`}>
                        Accept
                      </button>
                    )}
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
