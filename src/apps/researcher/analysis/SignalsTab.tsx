import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { READING_LABELS, type ReadingLabel } from '@/config/readings'
import { setReading, setReadingNote, type ReadingDecision } from '@/state/codebook'
import { EMOTIONS, STANCE_LABEL, TONES, faceOf, faceWeight, fitOf, topEmotions, type EmotionSplit } from '@/state/emotion'
import { breakdownOf, codeSignals, plural, signalGroups, tensionsFor, themeSignals, type CodeSignal, type Pattern, type Point, type Tension, type ThemeSignal } from '@/state/signals'
import { decisionFor, editProblems, isAccepted, labelShown, linesOf, needsReview, readingOf, statusOf, tensionsOfTheme, type Reading, type ReadingStatus } from '@/state/themeReadings'
import { mmss } from '../review/reviewUi'
import { BandBar, DeliveryFigures, EmotionBar, EmotionChip, FitChip, HesitantNote, HowItsDecided, KeyPopover, PointCard, ToneBar, ValenceCounts, noReading, playHref } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { GroupSection, TableHead, rowButtonClass } from './codeTable'

/** What the Signals tab is showing: kept by the page, so a tension or the footer can open a theme or a code, or show what needs review. */
export type SignalFocus = { theme?: string; code?: string; show?: 'all' | 'review' }

/** How faces are read, in one place: described first, then an interpretation PulseAI offers and the Researcher can correct. */
export const FACES_NOTE = 'Each face is described first, by what was visible. The label (“reads as Doubt”) is PulseAI’s interpretation, made against that person’s resting face. It is a lead, not a verdict: correct it with “Not right?” and every count follows.'
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10



/** Certainty is a reading, never a verdict: say what it is. */
const CERTAINTY_WORDS: Record<Pattern, string> = { 'Mostly steady': 'Certainty: steady', Mixed: 'Certainty: some hesitation', 'Often hesitant': 'Certainty: often hesitant', 'Too few to read': 'Certainty: too few to read' }

/** One short label for a code's faces, with its base: "Doubt 2 of 3". "No clear lead" when two share the top; never "Mixed", which is a verdict. */
export function emotionSummary(e: EmotionSplit) {
  const tops = topEmotions(e)
  if (!e.read) return 'No faces read'
  if (tops.length !== 1) return 'No clear lead'
  return `${tops[0]} ${e.counts[tops[0]]} of ${e.read}`
}
/** The detail behind the label, for a tooltip: how many faces were read, and how many of each expression. */
export const emotionSummaryTitle = (e: EmotionSplit) => {
  const gap = noReading(e)
  const each = EMOTIONS.filter((x) => e.counts[x]).map((x) => `${x} ${e.counts[x]}`)
  return `${e.read} faces read${gap ? `, ${gap}` : ''}${each.length ? `: ${each.join(', ')}` : ''}`
}
/** The tone label, always with its base: "6 of 14 flat or tense", or the tone more than half had. */
export function toneLabel(r: Pick<CodeSignal, 'tones'>) {
  const c = r.tones.counts
  const off = c.Flat + c.Tense
  if (off > 0) return `${off} of ${r.tones.n} flat or tense`
  const top = TONES.find((t) => c[t] * 2 > r.tones.n)
  return top ? `Mostly ${top.toLowerCase()} (${c[top]} of ${r.tones.n})` : 'No clear lead'
}

const READING_CHIP: Record<ReadingLabel, string> = {
  'Said and meant': 'border-mist-strong bg-haze text-ink',
  'Said, not backed': 'border-pending-fg bg-pending-fg text-white',
  'Partly backed': 'border-pending-line bg-pending-bg text-pending-fg',
  'Said, but unsure': 'border-iris-100 bg-iris-50 text-iris-700',
  'Split inside the theme': 'border-pending-line bg-surface text-pending-fg',
  'Too few to read': 'border-dashed border-mist-strong bg-surface text-muted',
  'Stated, not argued': 'border-dashed border-mist-strong bg-surface text-muted',
}
export function ReadingChip({ label }: { label: ReadingLabel }) {
  return <span className={cn('inline-flex h-5 shrink-0 items-center rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap', READING_CHIP[label])} data-testid="reading-chip">{label}</span>
}
const STATUS_TONE: Record<ReadingStatus, string> = { Suggested: 'text-pending-fg', 'Out of date': 'text-negative-fg', Accepted: 'text-positive-fg', Edited: 'text-positive-fg', 'Label changed': 'text-positive-fg', 'Left out': 'text-muted' }

/** "18 Nov, 16:20". */
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** A theme with its reading and where the Researcher stands on it. */
export type ThemeRow = { t: ThemeSignal; reading: Reading; decision?: ReadingDecision; status: ReadingStatus; tensions: Tension[] }

/** Every theme's reading and status, computed from the codebook. Used by the table and the footer. */
export function themeRows(doc: CodebookCtx['doc'], basis: CodebookCtx['basis'], tensions: Tension[], signals: CodeSignal[] = codeSignals(doc, basis)): ThemeRow[] {
  return themeSignals(doc, basis, signals)
    .filter((t) => t.kind === 'theme')
    .map((t) => {
      const reading = readingOf(t, doc, tensions)
      const decision = doc.readings?.[t.id]
      return { t, reading, decision, status: statusOf(decision, reading), tensions: tensionsOfTheme(t, tensions) }
    })
}
export const readingCounts = (rows: ThemeRow[]) => ({
  accepted: rows.filter((r) => isAccepted(r.status)).length,
  review: rows.filter((r) => needsReview(r.status)).length,
  suggested: rows.filter((r) => r.status === 'Suggested').length,
})

const EXPANDED = (studyId: string) => `pulseai-qual:a2-expanded:${studyId}`
function useExpanded(studyId: string) {
  const [open, setOpen] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED(studyId)) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED(studyId), JSON.stringify([...open]))
    } catch {
      // A convenience only.
    }
  }, [open, studyId])
  return [open, setOpen] as const
}

/** A2's table: one row per theme with its reading, its codes underneath, and the theme or code open in the panel. */
export function SignalsTab({ ctx, focus, setFocus, tensions, onOpenTension, expandAll }: { ctx: CodebookCtx; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTensions?: () => void; onOpenTension: (id: string) => void; /** Opens every theme on arrival (a link to the codes, `?view=code`). */ expandAll?: boolean }) {
  const { doc, basis } = ctx
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  const rows = useMemo(() => themeRows(doc, basis, tensions, signals), [doc, basis, tensions, signals])
  const loose = useMemo(() => signalGroups(doc, signals).find((g) => g.id === 'none')?.rows ?? [], [doc, signals])
  const [open, setOpen] = useExpanded(ctx.studyId)
  const show = focus.show ?? 'all'
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
  const shown = show === 'review' ? rows.filter((r) => needsReview(r.status)) : rows
  const homes = useMemo(() => {
    const m = new Map<string, string[]>()
    rows.forEach((r) => r.t.codes.forEach((c) => m.set(c.code.id, [...(m.get(c.code.id) ?? []), r.t.name])))
    return m
  }, [rows])
  const fullSample = basis.participants.size
  const partial = signals.some((s) => s.of !== fullSample) || rows.some((r) => r.t.of !== fullSample)

  const selCode = focus.code ? signals.find((s) => s.code.id === focus.code) : undefined
  const selTheme = selCode ? undefined : rows.find((r) => r.t.id === focus.theme) ?? shown.find((r) => needsReview(r.status)) ?? shown[0]
  const arrowIds = shown.map((r) => r.t.id)
  const arrows = useArrows(arrowIds, selTheme?.t.id, (id) => setFocus({ ...focus, theme: id, code: undefined }), 'data-theme')

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="Signals are read on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const allOpen = rows.length > 0 && rows.every((r) => open.has(r.t.id)) && (!loose.length || open.has('none'))
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  const codeRow = (c: CodeSignal, themeName?: string) => {
    const others = (homes.get(c.code.id) ?? []).filter((n) => n !== themeName)
    return (
      <li key={`${themeName ?? 'none'}-${c.code.id}`}>
        <button type="button" data-code={c.code.id} data-testid="signal-row" aria-current={selCode?.code.id === c.code.id ? 'true' : undefined} onClick={() => setFocus({ ...focus, code: c.code.id })} className={cn(rowButtonClass(selCode?.code.id === c.code.id), 'pl-12')}>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{c.code.name}</span>
            {others.length > 0 && (
              <span className="ml-2 text-xs whitespace-nowrap text-muted" data-testid="also-in">
                Also in {others.join(', ')}
              </span>
            )}
          </span>
          <span className="w-16 shrink-0 text-xs text-graphite tabular-nums">
            {c.people} of {c.of}
          </span>
          <span className="flex w-[9.5rem] shrink-0 items-center gap-2">
            {c.readable ? (
              <>
                <span className="w-8 shrink-0">
                  <EmotionBar split={c.emotions} />
                </span>
                <span className="text-xs whitespace-nowrap text-graphite tabular-nums" title={emotionSummaryTitle(c.emotions)} data-testid="face-cell">
                  {emotionSummary(c.emotions)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted" data-testid="face-cell">—</span>
            )}
          </span>
          <span className="flex w-[11rem] shrink-0 items-center gap-2">
            {c.readable ? (
              <>
                <span className="w-8 shrink-0" data-testid="speech-bars">
                  <ToneBar split={c.tones} />
                </span>
                <span className="text-xs whitespace-nowrap text-graphite tabular-nums" title={`Tone: ${c.tones.counts.Tense} tense, ${c.tones.counts.Flat} flat, ${c.tones.counts.Animated} animated, ${c.tones.counts.Even} even, of ${c.tones.n}. Certainty: marked hesitation in ${c.marked}, some in ${c.some}.`} data-testid="speech-label">
                  {toneLabel(c)}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted" data-testid="speech-label">—</span>
            )}
          </span>
          <span className="w-[7.5rem] shrink-0" data-testid="fit-cell">
            <FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />
          </span>
        </button>
      </li>
    )
  }
  const codeHead = (
    <div className="hidden items-center gap-3 py-1 pr-4 pl-12 text-[11px] font-medium text-muted sm:flex" aria-hidden="true">
      <span className="flex-1">Code</span>
      <span className="w-16">Said by</span>
      <span className="w-[9.5rem]">Face</span>
      <span className="w-[11rem]">Speech</span>
      <span className="w-[7.5rem]">Words vs delivery</span>
    </div>
  )

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-label="Theme readings" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist px-4 py-2.5">
          <div role="group" aria-label="Show" className="flex items-center gap-1 rounded-sm border border-mist-strong p-0.5 text-sm">
            <span className="px-1.5 text-xs text-graphite">Show:</span>
            {(
              [
                ['all', 'All'],
                ['review', 'Needs review'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={show === k} onClick={() => setFocus({ ...focus, show: k })} data-testid={`show-${k}`} className={cn('h-7 rounded-xs px-2.5', show === k ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
                {label}
                {k === 'review' && <span className={cn('ml-1 tabular-nums', show === k ? 'text-white/80' : 'text-muted')}>{rows.filter((r) => needsReview(r.status)).length}</span>}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set([...rows.map((r) => r.t.id), 'none']))} className="text-xs font-medium text-iris-700 hover:underline" data-testid="expand-all">
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        {shown.length === 0 && show === 'review' ? (
          <EmptyState title="Every reading has a decision" description="Nothing is waiting for review. Continue to the report when you’re ready." action={<Button onClick={() => setFocus({ ...focus, show: 'all' })}>Show all</Button>} />
        ) : (
          <div ref={arrows.ref} onKeyDown={arrows.onKeyDown} className="flex flex-col">
            <TableHead testid="signal-head">
              <span className="flex-1 pl-5">Theme</span>
              <span className="w-16" title={partial ? 'N is the people who were asked this question.' : undefined} data-testid="said-by-head">
                Said by
              </span>
              <span className="w-[10.5rem]">Reading</span>
              <span className="w-[7.5rem]">Tensions</span>
              <span className="w-[6.5rem]">Status</span>
              <span className="flex flex-col items-end gap-0.5">
                <HowItsDecided />
                <KeyPopover />
              </span>
            </TableHead>
            <ul className="pb-2" data-testid="theme-list">
              {shown.map((r) => {
                const isOpen = open.has(r.t.id)
                const toReview = r.tensions.filter((x) => x.status === 'Suggested' && !x.unavailable).length
                const label = labelShown(r.decision, r.reading)
                return (
                  <li key={r.t.id} className="relative border-b border-mist last:border-0" data-testid="theme-item">
                    <button type="button" onClick={() => toggle(r.t.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} the codes in ${r.t.name}`} data-testid="theme-expand" className="absolute top-2.5 left-2 z-10 rounded-xs p-1 text-graphite hover:bg-mist hover:text-ink">
                      <span className={cn('block transition-transform', isOpen && 'rotate-90')}>
                        <ChevronRightIcon size={12} />
                      </span>
                    </button>
                    <button type="button" data-theme={r.t.id} data-status={r.status} data-label={label} data-testid="theme-row" aria-current={selTheme?.t.id === r.t.id ? 'true' : undefined} onClick={() => setFocus({ ...focus, theme: r.t.id, code: undefined })} className={cn(rowButtonClass(selTheme?.t.id === r.t.id), 'items-start pl-9')}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{r.t.name}</span>
                        <span className="mt-0.5 block text-xs text-graphite" data-testid="theme-line">
                          {linesOf(r.decision, r.reading)[0]}
                        </span>
                      </span>
                      <span className="w-16 shrink-0 pt-0.5 text-xs text-graphite tabular-nums">
                        {r.t.people} of {r.t.of}
                      </span>
                      <span className="w-[10.5rem] shrink-0">
                        <ReadingChip label={label} />
                      </span>
                      <span className="w-[7.5rem] shrink-0 pt-0.5 text-xs text-graphite tabular-nums" data-testid="tension-chip">
                        {r.tensions.length ? `${r.tensions.length}${toReview ? ` · ${toReview} to review` : ''}` : '—'}
                      </span>
                      <span className={cn('w-[6.5rem] shrink-0 pt-0.5 text-xs font-medium', STATUS_TONE[r.status])} data-testid="theme-status">
                        {r.status}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="pb-1.5" data-testid="theme-codes">
                        {codeHead}
                        <ul>{r.t.codes.map((c) => codeRow(c, r.t.name))}</ul>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {show === 'all' && loose.length > 0 && (
              <GroupSection
                id="none"
                label="Not in a theme"
                aside={
                  <>
                    <span className="text-xs text-muted tabular-nums">{plural(loose.length, 'code')} · no reading until they are in a theme</span>
                    <button type="button" onClick={() => toggle('none')} className="ml-auto text-xs font-medium text-iris-700 hover:underline" data-testid="none-toggle">
                      {open.has('none') ? 'Hide' : 'Show'}
                    </button>
                  </>
                }
              >
                {open.has('none') && (
                  <>
                    {codeHead}
                    {loose.map((c) => codeRow(c))}
                  </>
                )}
              </GroupSection>
            )}
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">
        {selCode ? (
          <CodePanel key={selCode.code.id} s={selCode} ctx={ctx} tensions={tensionsFor(tensions, selCode.code.id)} theme={rows.find((r) => r.t.codes.some((c) => c.code.id === selCode.code.id))?.t} onTheme={(id) => setFocus({ ...focus, theme: id, code: undefined })} onOpenTension={onOpenTension} />
        ) : selTheme ? (
          <ThemePanel key={selTheme.t.id} row={selTheme} ctx={ctx} onCode={(id) => setFocus({ ...focus, code: id })} onOpenTension={onOpenTension} />
        ) : null}
      </div>
    </div>
  )
}

// ─── the theme panel: the reading and the Researcher's decision ─────────────

function ThemePanel({ row, ctx, onCode, onOpenTension }: { row: ThemeRow; ctx: CodebookCtx; onCode: (id: string) => void; onOpenTension: (id: string) => void }) {
  const { t, reading, decision, status } = row
  const toast = useToast()
  const [mode, setMode] = useState<'view' | 'edit' | 'label' | 'leave'>('view')
  const lines = linesOf(decision, reading)
  const label = labelShown(decision, reading)
  const [draft, setDraft] = useState<string[]>(lines)
  const [newLabel, setNewLabel] = useState<ReadingLabel>(label)
  const [why, setWhy] = useState('')
  const note = ctx.doc.readingNotes?.[t.id]
  const [noteText, setNoteText] = useState(note?.text ?? '')
  const sessions = ctx.basis.sessions.size
  const theme = { id: t.id, name: t.name }
  const save = (next: ReadingDecision | undefined, action: string, msg: string, detail?: string, reason?: string) => {
    ctx.act((d) => setReading(d, theme, next, action, ctx.me, detail, reason))
    toast(msg)
    setMode('view')
    setWhy('')
  }
  const accept = () => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Accepted' }), status === 'Out of date' ? 'Reading re-accepted' : 'Reading accepted', `“${t.name}” reading accepted. It goes to the report.`, reading.label)
  const problems = editProblems(reading.lines, draft.map((l) => l.trim()).filter(Boolean))
  const outOfDate = status === 'Out of date'
  const x = reading.nums
  const tensionList = [...row.tensions].sort((a, b) => Number(b.status === 'Added as a tension theme') - Number(a.status === 'Added as a tension theme'))

  return (
    <section aria-label={`Reading for ${t.name}`} data-testid="theme-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <ReadingChip label={label} />
            <span className={cn('text-xs font-medium', STATUS_TONE[status])} data-testid="panel-status">
              {status}
            </span>
            <span className="ml-auto inline-flex h-5 items-center rounded-xs border border-dashed border-iris-300 bg-iris-50 px-1.5 text-xs font-medium text-iris-700" data-testid="reading-tag">
              {decision?.text && !outOfDate ? `Edited by ${decision.by}` : 'AI-suggested'}
            </span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold">{t.name}</h2>
          {decision?.label && !outOfDate && (
            <p className="mt-1 text-xs text-graphite" data-testid="label-why">
              Label changed from “{reading.label}” by {decision.by}: “{decision.labelWhy}”
            </p>
          )}
          {mode === 'edit' ? (
            <div className="mt-2 flex flex-col gap-2" data-testid="reading-editor">
              {draft.map((l, i) => (
                <TextArea key={i} rows={2} value={l} onChange={(e) => setDraft(draft.map((x2, j) => (j === i ? e.target.value : x2)))} aria-label={`Line ${i + 1}`} data-testid="reading-edit-line" />
              ))}
              {problems.length > 0 && (
                <ul className="text-xs text-negative-fg" data-testid="reading-edit-problems">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" disabled={problems.length > 0} onClick={() => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Accepted', text: draft.map((l) => l.trim()).filter(Boolean), label: decision?.label, labelWhy: decision?.labelWhy }), 'Reading edited and accepted', `“${t.name}” reading saved with your wording`)} data-testid="reading-edit-save">
                  Save and accept
                </Button>
                <Button size="sm" onClick={() => setMode('view')}>
                  Cancel
                </Button>
                <button type="button" className="text-xs font-medium text-iris-700 hover:underline" onClick={() => setDraft(reading.lines)}>
                  Back to PulseAI’s wording
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1 text-sm" data-testid="reading-statement">
              {lines.map((l, i) => (
                <p key={i} className={i === 0 ? 'text-ink' : 'text-graphite'}>
                  {l}
                </p>
              ))}
            </div>
          )}
          {reading.coverage && (
            <p className="mt-2 text-xs text-muted" data-testid="reading-coverage">
              {reading.coverage}
            </p>
          )}
          {outOfDate && decision && (
            <div className="mt-3 rounded-sm border border-negative-line bg-negative-bg px-3 py-2 text-xs text-negative-fg" data-testid="out-of-date">
              <p className="font-medium">The data changed since this was {decision.status === 'Left out' ? 'left out' : 'accepted'}.</p>
              <p className="mt-0.5 tabular-nums" data-testid="old-new">
                Was {decision.snap.label}: {decision.snap.M} matched, {decision.snap.P} pulled against, {decision.snap.U} unsure of {decision.snap.R}. Now {reading.label}: {x.M} matched, {x.P} pulled against, {x.U} unsure of {x.R}.
              </p>
            </div>
          )}
          {mode === 'label' && (
            <div className="mt-3 flex flex-col gap-2 rounded-sm border border-mist p-3" data-testid="label-editor">
              <label className="text-xs font-medium text-graphite">
                Label
                <select value={newLabel} onChange={(e) => setNewLabel(e.target.value as ReadingLabel)} className="mt-1 block h-8 w-full rounded-sm border border-mist-strong bg-surface px-2 text-sm" data-testid="label-select">
                  {READING_LABELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <TextArea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why does this label fit better? (required)" aria-label="Reason" data-testid="label-why-input" />
              <p className="text-xs text-graphite">The numbers stay as they are: {x.M} matched, {x.P} pulled against, {x.U} unsure of {x.R}.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={!why.trim() || newLabel === reading.label} onClick={() => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Accepted', label: newLabel, labelWhy: why.trim(), text: decision?.text }), 'Reading label changed', `“${t.name}” label changed`, `“${reading.label}” to “${newLabel}”`, why)} data-testid="label-save">
                  Change label
                </Button>
                <Button size="sm" onClick={() => setMode('view')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {mode === 'leave' && (
            <div className="mt-3 flex flex-col gap-2 rounded-sm border border-mist p-3" data-testid="leave-editor">
              <TextArea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why leave it out? (optional)" aria-label="Reason" data-testid="leave-why" />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Left out', why: why.trim() || undefined }), 'Reading left out', `“${t.name}” reading left out of the report`, undefined, why)} data-testid="leave-save">
                  Leave out
                </Button>
                <Button size="sm" onClick={() => setMode('view')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {mode === 'view' && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="reading-actions">
              <Button size="sm" variant="primary" disabled={!outOfDate && isAccepted(status)} onClick={accept} data-testid="reading-accept">
                {outOfDate ? 'Re-accept' : isAccepted(status) ? 'Accepted' : 'Accept'}
              </Button>
              <Button size="sm" disabled={outOfDate} onClick={() => (setDraft(lines), setMode('edit'))} data-testid="reading-edit">
                Edit
              </Button>
              <Button size="sm" disabled={outOfDate} onClick={() => (setNewLabel(label), setMode('label'))} data-testid="reading-label">
                Change label
              </Button>
              <Button size="sm" disabled={status === 'Left out'} onClick={() => setMode('leave')} data-testid="reading-leave">
                Leave out
              </Button>
              {decision && (
                <button type="button" className="text-xs font-medium text-iris-700 hover:underline" onClick={() => save(undefined, 'Reading decision undone', `“${t.name}” is back to Suggested`)} data-testid="reading-undo">
                  Undo decision
                </button>
              )}
            </div>
          )}
          {reading.problems.length > 0 && (
            <ul className="mt-2 text-xs text-negative-fg" data-testid="reading-problems">
              {reading.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </header>

        <section aria-label="The counts" className="border-b border-mist px-5 py-3.5">
          <dl className="grid grid-cols-4 gap-2 text-center" data-testid="reading-figures">
            {(
              [
                ['R', x.R, 'with a claim', 'text-ink'],
                ['P', x.P, 'pulled against', 'text-pending-fg'],
                ['U', x.U, 'unsure', 'text-iris-700'],
                ['M', x.M, 'matched', 'text-ink'],
              ] as const
            ).map(([k, n, l, tone]) => (
              <div key={k} data-testid={`rfig-${k}`} data-n={n}>
                <dt className="sr-only">{l}</dt>
                <dd className={cn('text-lg leading-none font-semibold tabular-nums', tone)}>{n}</dd>
                <dd className="mt-0.5 text-xs text-graphite">{l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-graphite">
            Of {t.people} who said it ({t.people} of {t.of} asked). Each person counts once.
          </p>
        </section>

        <section aria-label="Codes in this theme" className="border-b border-mist px-5 py-3.5">
          <h3 className="text-sm font-semibold">Codes</h3>
          <ul className="mt-1.5 divide-y divide-mist" data-testid="theme-panel-codes">
            {t.codes.map((c) => (
              <li key={c.code.id}>
                <button type="button" onClick={() => onCode(c.code.id)} className="flex w-full items-center gap-3 py-1.5 text-left text-sm hover:text-iris-700" data-testid="theme-panel-code">
                  <span className="min-w-0 flex-1">{c.code.name}</span>
                  <span className="text-xs text-graphite tabular-nums">
                    {c.people} of {c.of}
                  </span>
                  <FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {tensionList.length > 0 && (
          <section aria-label="Tensions on this theme" className="border-b border-mist px-5 py-3.5">
            <h3 className="text-sm font-semibold">Tensions on this theme</h3>
            <ul className="mt-1.5 flex flex-col gap-1" data-testid="theme-panel-tensions">
              {tensionList.map((x2) => (
                <li key={x2.id}>
                  <button type="button" onClick={() => onOpenTension(x2.id)} className="group flex w-full items-start gap-1.5 rounded-xs text-left text-sm text-iris-700 hover:underline" data-testid="theme-tension">
                    <span className="min-w-0 flex-1">{x2.title}</span>
                    <span className="mt-0.5 shrink-0 text-xs text-graphite">{x2.status === 'Added as a tension theme' ? 'Accepted' : x2.unavailable ? 'Waiting on codebook' : x2.status === 'Suggested' ? 'To review' : x2.status}</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {t.play && (
          <div className="border-b border-mist px-5 py-3">
            <Link to={playHref(ctx.studyId, t.play.sessionId, t.play.atSec)} className="inline-flex items-center gap-1 text-xs font-medium text-iris-700 hover:underline" data-testid="theme-play">
              <PlayIcon size={11} /> Play the clearest moment · {t.play.participantId} at {mmss(t.play.atSec)}
            </Link>
          </div>
        )}

        <section aria-label="Researcher’s note" className="border-b border-mist px-5 py-3.5">
          <h3 className="text-sm font-semibold">Researcher’s note</h3>
          <p className="mt-0.5 text-xs text-graphite">Your own words. Kept apart from PulseAI’s reading and shown as yours in the report.</p>
          <TextArea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} className="mt-1.5" aria-label="Researcher’s note" data-testid="reading-note" />
          <div className="mt-1.5 flex items-center gap-2">
            <Button size="sm" disabled={noteText.trim() === (note?.text ?? '')} onClick={() => (ctx.act((d) => setReadingNote(d, theme, noteText, ctx.me)), toast('Note saved'))} data-testid="reading-note-save">
              Save note
            </Button>
            {note && (
              <span className="text-xs text-muted" data-testid="reading-note-by">
                Researcher’s note · {note.by} · {when(note.at)}
              </span>
            )}
          </div>
        </section>
      </div>
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite" data-testid="approval-footer">
        {decision ? `${decision.status === 'Left out' ? 'Left out' : 'Accepted'} by ${decision.by} · ${when(decision.at)} · data v${decision.version}${decision.why ? ` · “${decision.why}”` : ''}` : 'Suggested by PulseAI. Not in the report until you accept it.'}
      </footer>
    </section>
  )
}

// ─── the code panel ─────────────────────────────────────────────────────────

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

/** One channel in the code panel: a label, a bar and what it says. */
export function ChannelRow({ label, bar, children, testid }: { label: string; bar?: React.ReactNode; children: React.ReactNode; testid?: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 py-2" data-testid={testid}>
      <span className="pt-0.5 text-xs font-medium text-graphite">{label}</span>
      <div className="min-w-0">
        {bar && <div className="mb-1.5">{bar}</div>}
        <p className="text-sm">{children}</p>
      </div>
    </div>
  )
}

/** People in the code panel: those whose delivery pulled against their words first, then the uncertain, then the rest, the strongest face first within each. */
function orderByFit(points: Point[], ctx: CodebookCtx) {
  const rank = { 'Pulls against': 0, Uncertain: 1, Matches: 2 } as const
  const of = (p: Point) => {
    const f = fitOf(p, faceOf(p, ctx.doc)).fit
    return f ? rank[f] : 3
  }
  return [...points].sort((a, b) => of(a) - of(b) || faceWeight(faceOf(b, ctx.doc)) - faceWeight(faceOf(a, ctx.doc)))
}

function CodePanel({ s, ctx, tensions, theme, onTheme, onOpenTension }: { s: CodeSignal; ctx: CodebookCtx; tensions: Tension[]; theme?: { id: string; name: string }; onTheme: (id: string) => void; onOpenTension: (id: string) => void }) {
  const delay = r1(median(s.points.map((p) => p.facts.delaySec)))
  const usual = r1(median(s.points.map((p) => p.usual)))
  const e = s.emotions
  const off = s.tones.counts.Flat + s.tones.counts.Tense
  const stance = s.points[0]?.stance
  const tops = topEmotions(e)
  const breakdown = breakdownOf(s.points, ctx.doc)
  const ordered = orderByFit(s.points, ctx)
  const clearest = ordered[0]
  return (
    <section aria-label={`Signals for ${s.code.name}`} data-testid="signal-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {s.readable && <FitChip pattern={s.fit.pattern} />}
            <span className="inline-flex h-5 items-center rounded-xs border border-mist-strong bg-surface px-1.5 text-xs text-graphite" data-testid="certainty-chip">
              {CERTAINTY_WORDS[s.pattern]}
            </span>
            <span className="ml-auto text-xs text-muted" data-testid="origin">Origin: {s.code.isNew ? 'new code' : 'guide question'}</span>
          </div>
          {theme && (
            <button type="button" onClick={() => onTheme(theme.id)} className="mt-2 text-xs font-medium text-iris-700 hover:underline" data-testid="code-theme-link">
              ← {theme.name}
            </button>
          )}
          <h2 className="mt-1.5 text-lg leading-snug font-semibold">{s.code.name}</h2>
          <p className="mt-1 text-sm text-graphite">{s.code.definition}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-graphite tabular-nums">
            <span>
              Said by {s.people} of {s.of}
            </span>
            {clearest && (
              <Link to={playHref(ctx.studyId, clearest.sessionId, clearest.atSec)} className="inline-flex items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" data-testid="code-play">
                <PlayIcon size={11} /> Play the clearest moment · {clearest.participantId} at {mmss(clearest.atSec)}
              </Link>
            )}
          </p>
        </header>

        <div className="border-b border-mist px-5 py-3" data-testid="channels">
          {s.readable ? (
            <>
              <DeliveryFigures b={breakdown}>
                <HesitantNote points={s.points} doc={ctx.doc} of={s.of} />
              </DeliveryFigures>
              <dl className="divide-y divide-mist">
                <ChannelRow label="Words">{stance ? STANCE_LABEL[stance] : '—'}</ChannelRow>
                <ChannelRow label="Face" bar={<EmotionBar split={e} tall />} testid="channel-face">
                  {tops.length ? (
                    <>
                      <span className="font-semibold tabular-nums">
                        {tops.length === 1 ? `${e.counts[tops[0]]} of ${e.read} faces read as ${tops[0].toLowerCase()}.` : `${tops.map((x) => x.toLowerCase()).join(' and ')} tie: ${e.counts[tops[0]]} of ${e.read} faces each.`}
                      </span>
                    </>
                  ) : (
                    'No faces read.'
                  )}
                  {noReading(e) && <span className="text-graphite"> {e.read} of {s.people} people had a face read ({noReading(e)}).</span>}
                  {e.read > 0 && (
                    <span className="mt-1 block text-xs text-graphite">
                      <ValenceCounts e={e} /> <span className="tabular-nums">of {e.read} read</span>
                    </span>
                  )}
                  {e.read > 0 && (
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-graphite">Reads as</span>
                      {EMOTIONS.filter((x) => e.counts[x]).map((x, _i, xs) => (
                        <span key={x} className="inline-flex items-center gap-1 text-xs text-graphite tabular-nums">
                          <EmotionChip emotion={x} />
                          {xs.length > 1 && <> {e.counts[x]}</>}
                        </span>
                      ))}
                    </span>
                  )}
                </ChannelRow>
                <ChannelRow
                  label="Speech"
                  testid="channel-speech"
                  bar={
                    <span className="flex flex-col gap-1.5">
                      <span>
                        <span className="mb-0.5 block text-[11px] font-medium text-graphite">Tone</span>
                        <ToneBar split={s.tones} tall />
                      </span>
                      <span>
                        <span className="mb-0.5 block text-[11px] font-medium text-graphite">Certainty</span>
                        <BandBar split={{ counts: { Steady: s.steady, 'Some hesitation': s.some, 'Marked hesitation': s.marked }, n: s.people }} tall />
                      </span>
                    </span>
                  }
                >
                  <span className="font-semibold tabular-nums">Tone: flat or tense for {off} of {s.tones.n}.</span> <span className="text-graphite">Animated {s.tones.counts.Animated}, even {s.tones.counts.Even}.</span>
                  <span className="mt-1 block">
                    <span className="font-semibold tabular-nums">Certainty: marked hesitation in {s.marked} of {s.people},</span> some in {s.some}. <span className="text-graphite tabular-nums">Median delay {delay} s, against a usual {usual} s.</span>
                  </span>
                </ChannelRow>
</dl>
            </>
          ) : (
            <p className="py-1 text-sm">Only {plural(s.people, 'person')} said this, which is too few to read a pattern or put in the report. Their moments are below.</p>
          )}
        </div>

        {tensions.length > 0 && (
          <section aria-label="Related tensions" className="border-b border-mist px-5 py-3.5">
            <h3 className="text-sm font-semibold">Where this shows up as a tension</h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {tensions.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTension(t.id)} data-testid="related-tension" className="group flex w-full items-start gap-1.5 rounded-xs text-left text-sm text-iris-700 hover:underline">
                    <span className="min-w-0 flex-1">{t.title}</span>
                    <span className="mt-0.5 shrink-0 text-xs text-graphite">{t.status === 'Suggested' ? 'To review' : t.status}</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="People" className="px-5 py-4">
          <h3 className="text-sm font-semibold">
            Moments <span className="font-normal text-graphite tabular-nums">{s.points.length}</span>
            <span className="ml-2 text-xs font-normal text-graphite">Pulled against first, then uncertain</span>
          </h3>
          <ul className="mt-2 divide-y divide-mist">
            {ordered.map((p) => (
              <PointCard key={p.participantId} point={p} ctx={ctx} context={s.code.name} />
            ))}
          </ul>
        </section>
      </div>
      <PanelFooter />
    </section>
  )
}

function PanelFooter() {
  return <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">{FACES_NOTE} Nothing here changes a Review decision.</footer>
}

