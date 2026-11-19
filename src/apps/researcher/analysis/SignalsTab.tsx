import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { cn } from '@/components/cn'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { Button } from '@/components/Button'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { setSignalPick, setSignalPicks } from '@/state/codebook'
import { EMOTIONS, STANCE_LABEL, faceOf, faceWeight, fitOf, topEmotions, type EmotionSplit } from '@/state/emotion'
import { breakdownOf, codeSignals, plural, signalGroups, tensionsFor, themeInsight, themeSignals, type CodeSignal, type Point, type Tension, type ThemeSignal } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import { BandBar, DeliveryFigures, EmotionBar, EmotionChip, FitChip, HesitantNote, HowItsDecided, PatternChip, PointCard, SignalLegend, ToneBar, ValenceCounts, ValenceKey, noReading, playHref } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { TableHead, rowButtonClass } from './codeTable'
import { verdictLabel } from '@/config/delivery'

/** What the Signals tab is showing: kept by the page, so a tension can open a code. */
export type SignalFocus = {
  /** The code open in the panel. */
  code?: string
  /** The theme open in the panel (instead of a code). */
  theme?: string
  /** The theme a code panel was opened from, for its "← theme" link. */
  from?: string
}

/** How faces are read, in one place: described first, then an interpretation PulseAI offers and the Researcher can correct. */
export const FACES_NOTE = 'Each face is described first, by what was visible. The label (“reads as Doubt”) is PulseAI’s interpretation, made against that person’s resting face. It is a lead, not a verdict: correct it with “Not right?” and every count follows.'
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10


/** What a Face or Speech cell says when no one value leads. Never "Mixed", which is a verdict word. */
export const NO_CLEAR_LEAD = 'No clear lead'
/** One short label for a code's faces: "Mostly interest" when one expression is over half, "No clear lead" when not, "Not read" when no face was. */
export function emotionSummary(e: EmotionSplit) {
  const tops = topEmotions(e)
  if (!tops.length) return 'Not read'
  return tops.length === 1 && e.counts[tops[0]] * 2 > e.read ? `Mostly ${tops[0].toLowerCase()}` : NO_CLEAR_LEAD
}
/** The detail behind the label, for a tooltip: how many faces were read, and how many of each expression. */
export const emotionSummaryTitle = (e: EmotionSplit) => {
  const gap = noReading(e)
  const each = EMOTIONS.filter((x) => e.counts[x]).map((x) => `${x} ${e.counts[x]}`)
  return `${e.read} faces read${gap ? `, ${gap}` : ''}${each.length ? `: ${each.join(', ')}` : ''}`
}

/** How delivery was read for a set of codes: the table, grouped under their themes, and the code open in the panel. */
export function SignalsTab({ ctx, focus, setFocus, tensions, onOpenTension, onOpenTensions }: { ctx: CodebookCtx; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTensions?: () => void; onOpenTension: (id: string) => void }) {
  const { doc, basis } = ctx
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  return <ByCode ctx={ctx} signals={signals} focus={focus} setFocus={setFocus} tensions={tensions} onOpenTension={onOpenTension} onOpenTensions={onOpenTensions} />
}

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

// ─── the table ──────────────────────────────────────────────────────────────

/** Face: a small bar and one short label, with the detail in the tooltip. */
function FaceCell({ r }: { r: CodeSignal }) {
  if (!r.readable) return <span className="text-xs whitespace-nowrap text-muted" data-testid="face-cell">Not read</span>
  return (
    <>
      <span className="w-8 shrink-0">
        <EmotionBar split={r.emotions} />
      </span>
      <span className="text-xs whitespace-nowrap text-graphite tabular-nums" title={emotionSummaryTitle(r.emotions)} data-testid="face-cell">
        {emotionSummary(r.emotions)}
      </span>
    </>
  )
}

/** The tone label: how many sounded flat or tense, or the tone most had. */
export function toneLabel(r: Pick<CodeSignal, 'tones'>) {
  const c = r.tones.counts
  const off = c.Flat + c.Tense
  if (off > 0) return `Flat or tense: ${off}`
  return c.Even * 2 > r.tones.n ? 'Mostly even' : c.Animated * 2 > r.tones.n ? 'Mostly animated' : NO_CLEAR_LEAD
}

/** Speech: a small tone bar and one short label. Certainty (hesitation) is in the tooltip and the panel. */
function SpeechCell({ r }: { r: CodeSignal }) {
  if (!r.readable) return <span className="text-xs whitespace-nowrap text-muted" data-testid="speech-label">Not read</span>
  const c = r.tones.counts
  return (
    <>
      <span className="w-8 shrink-0" data-testid="speech-bars">
        <ToneBar split={r.tones} />
      </span>
      <span className="text-xs whitespace-nowrap text-graphite tabular-nums" title={`Tone: ${c.Tense} tense, ${c.Flat} flat, ${c.Animated} animated, ${c.Even} even, of ${r.tones.n}. Certainty: marked hesitation in ${r.marked}, some in ${r.some}.`} data-testid="speech-label">
        {toneLabel(r)}
      </span>
    </>
  )
}

function ByCode({ ctx, signals, focus, setFocus, tensions, onOpenTension, onOpenTensions }: { ctx: CodebookCtx; signals: CodeSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTension: (id: string) => void; onOpenTensions?: () => void }) {
  const { doc } = ctx
  const toast = useToast()
  const [notableOnly, setNotableOnly] = useState(false)
  const allGroups = useMemo(() => signalGroups(doc, signals), [doc, signals])
  const groups = useMemo(() => signalGroups(doc, notableOnly ? signals.filter((s) => s.notable) : signals), [doc, signals, notableOnly])
  /** The theme-level profiles: the one computation the Theme map and the report read. */
  const profiles = useMemo(() => themeSignals(doc, ctx.basis, signals), [doc, ctx.basis, signals])
  /** Themes whose codes are folded away. Everything starts open. */
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const flat = groups.flatMap((g) => g.rows)
  const visible = groups.filter((g) => !folded.has(g.id)).flatMap((g) => g.rows)
  // Opens on the code where words and delivery disagree most, then the most hesitant, so the first thing seen is worth seeing.
  const strongest = [...flat].filter((r) => r.notable).sort((a, b) => b.fit.against / (b.fit.n || 1) - a.fit.against / (a.fit.n || 1) || b.marked / b.people - a.marked / a.people)[0]
  const openTheme = allGroups.find((g) => g.id === focus.theme)
  const selected = flat.find((r) => r.code.id === focus.code) ?? strongest ?? flat[0]
  /** The theme a code was opened from, kept only while it still exists and the code is in it. */
  const cameFrom = !openTheme ? allGroups.find((g) => g.id === focus.from && g.rows.some((r) => r.code.id === selected?.code.id)) : undefined
  /** A code row click: from inside the open theme (or the one the panel came from), the "← theme" link stays. */
  const openCode = (id: string) => {
    const home = allGroups.find((g) => g.rows.some((r) => r.code.id === id))
    const keep = home && (home.id === focus.theme || home.id === focus.from) ? home.id : undefined
    setFocus({ code: id, from: keep })
  }
  const arrows = useArrows(visible.map((r) => r.code.id), openTheme ? undefined : selected?.code.id, openCode, 'data-code')
  const toggleFold = (id: string) => setFolded((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n })
  /** A chip in the theme panel: open that code, unfold its theme and bring its row into view. */
  const jumpToCode = (themeId: string, codeId: string) => {
    setFolded((f) => { const n = new Set(f); n.delete(themeId); return n })
    setFocus({ code: codeId, from: themeId })
    setTimeout(() => document.querySelector(`[data-code="${codeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60)
  }

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="Signals are read on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const setUse = (s: CodeSignal, on: boolean) => {
    ctx.act((d) => setSignalPick(d, s.code, on, { by: ctx.me }))
    toast(on ? `“${s.code.name}” signals will go in the report` : `“${s.code.name}” signals left out of the report`)
  }

  /** A theme's switch sets all the codes it has that can be shown. Half-on (some in, some out) turns them all on. */
  const setGroup = (gid: string, name: string, on: boolean) => {
    const codes = (allGroups.find((g) => g.id === gid)?.rows ?? []).filter((r) => r.showable).map((r) => r.code)
    ctx.act((d) => setSignalPicks(d, codes, on, name, { by: ctx.me }))
    toast(on ? `“${name}” signals will go in the report` : `“${name}” signals left out of the report`)
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-label="Signals by code" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist px-4 py-2.5">
          <span className="flex-1" />
          <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2.5 text-sm text-graphite">
            <input type="checkbox" checked={notableOnly} onChange={(e) => setNotableOnly(e.target.checked)} className="accent-[var(--color-iris-600)]" />
            Worth a look only
          </label>
        </div>
        <SignalLegend />
        <div className="border-b border-mist px-4 py-2">
          <ValenceKey />
        </div>
        {flat.length === 0 ? (
          <EmptyState title="Nothing stands out" description="No accepted code shows hesitation, or words and delivery that don’t fit." action={<Button onClick={() => setNotableOnly(false)}>Show all codes</Button>} />
        ) : (
          <div ref={arrows.ref} onKeyDown={arrows.onKeyDown} className="flex flex-col">
            <TableHead testid="signal-head">
              <span className="flex-1">Code</span>
              <span className="w-14">Said by</span>
              <span className="w-[10rem]">Face</span>
              <span className="w-[9rem]">Speech</span>
              <span className="flex w-[7.5rem] flex-col gap-0.5" title="Do speech and face match what the words claim?">
                <span>Words vs delivery</span>
                <HowItsDecided />
              </span>
            </TableHead>
            {groups.map((g) => {
              // The switch counts every code the theme has that can be shown, even those the filter hides.
              const shown = (allGroups.find((x) => x.id === g.id)?.rows ?? g.rows).filter((r) => r.showable)
              const inReport = shown.filter((r) => r.use).length
              const mixed = inReport > 0 && inReport < shown.length
              const prof = profiles.find((x) => x.id === g.id)
              const open = !folded.has(g.id)
              const on = openTheme?.id === g.id
              return (
                <section key={g.id} aria-labelledby={`grp-${g.id}`} data-testid="theme-group" data-group-id={g.id} className="border-b border-mist last:border-0">
                  <header data-testid="theme-row" data-selected={on ? 'true' : undefined} className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 pt-3.5 pb-1.5 transition-colors', on && 'bg-iris-50 shadow-[inset_2px_0_0_var(--color-iris-600)]')}>
                    <button type="button" onClick={() => toggleFold(g.id)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${g.name}`} data-testid="theme-chevron" className="-ml-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center self-center rounded-xs text-graphite hover:bg-haze hover:text-ink">
                      <ChevronRightIcon size={14} className={cn('transition-transform', open && 'rotate-90')} />
                    </button>
                    <h3 id={`grp-${g.id}`} className="text-sm font-semibold">
                      <button type="button" onClick={() => setFocus({ theme: g.id })} aria-current={on ? 'true' : undefined} data-testid="theme-name" className="cursor-pointer rounded-xs text-left underline-offset-2 hover:underline">
                        {g.name}
                      </button>
                    </h3>
                    <span className="text-xs text-muted tabular-nums" data-testid="group-count">
                      {plural(g.rows.length, 'code')}
                    </span>
                    {prof && (
                      <>
                        <button type="button" onClick={() => setFocus({ theme: g.id })} data-testid="theme-verdict" aria-label={`Open ${g.name}: ${verdictLabel(prof.verdict)}`} className="cursor-pointer self-center rounded-xs">
                          <FitChip pattern={prof.verdict} />
                        </button>
                        <span className="text-xs text-graphite tabular-nums" data-testid="theme-said-by">
                          Said by {prof.people} of {prof.of}
                        </span>
                      </>
                    )}
                    <span className="ml-auto flex items-center gap-2 self-center" data-testid="group-switch-box" onClick={(e) => e.stopPropagation()}>
                      <span className={cn('text-xs tabular-nums', shown.length ? 'text-graphite' : 'text-muted')} data-testid="group-switch-label">
                        {!shown.length ? 'Nothing to show' : mixed ? `${inReport} of ${shown.length} in report` : 'In report'}
                      </span>
                      <Switch checked={shown.length > 0 && inReport === shown.length} mixed={mixed} disabled={!shown.length} onChange={(on) => setGroup(g.id, g.name, on)} label={`Put ${g.name} signals in the report`} testid="use-group" />
                    </span>
                  </header>
                  {open && (
                    <ul className="pb-2">
                      {g.rows.map((r) => (
                        <li key={r.code.id} className="relative">
                          <button type="button" data-code={r.code.id} data-testid="signal-row" aria-current={!openTheme && r.code.id === selected?.code.id ? 'true' : undefined} onClick={() => openCode(r.code.id)} className={rowButtonClass(!openTheme && r.code.id === selected?.code.id)}>
                            <span className="min-w-0 flex-1">
                              <span className={r.notable ? 'font-semibold' : 'font-medium'}>{r.code.name}</span>
                              <span className={cn('ml-2 text-xs whitespace-nowrap', r.showable ? 'font-medium text-iris-700' : 'text-muted')} data-testid="row-state">
                                {!r.showable ? 'Nothing to show' : r.use ? 'In report' : ''}
                              </span>
                            </span>
                            <span className="w-14 shrink-0 text-xs text-graphite tabular-nums">
                              {r.people} of {r.of}
                            </span>
                            <span className="flex w-[10rem] shrink-0 items-center gap-2">
                              <FaceCell r={r} />
                            </span>
                            <span className="flex w-[9rem] shrink-0 items-center gap-2">
                              <SpeechCell r={r} />
                            </span>
                            <span className="w-[7.5rem] shrink-0" data-testid="fit-cell">
                              <FitChip pattern={r.readable ? r.fit.pattern : 'Too few to read'} />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">
        {openTheme ? (
          <ThemePanel key={openTheme.id} g={openTheme} prof={profiles.find((x) => x.id === openTheme.id)} ctx={ctx} tensions={tensions} onCode={(id) => jumpToCode(openTheme.id, id)} onOpenTension={onOpenTension} onOpenTensions={onOpenTensions} />
        ) : selected ? (
          <CodePanel key={selected.code.id} s={selected} ctx={ctx} tensions={tensionsFor(tensions, selected.code.id)} onOpenTension={onOpenTension} onUse={(on) => setUse(selected, on)} back={cameFrom ? { name: cameFrom.name, onClick: () => setFocus({ theme: cameFrom.id }) } : undefined} />
        ) : null}
      </div>
    </div>
  )
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

function CodePanel({ s, ctx, tensions, onUse, onOpenTension, back }: { s: CodeSignal; ctx: CodebookCtx; tensions: Tension[]; onUse: (on: boolean) => void; onOpenTension: (id: string) => void; back?: { name: string; onClick: () => void } }) {
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
        {back && (
          <div className="border-b border-mist px-5 py-2">
            <button type="button" onClick={back.onClick} data-testid="back-to-theme" className="inline-flex cursor-pointer items-center gap-1 rounded-xs text-xs font-medium text-iris-700 hover:underline">
              <span aria-hidden="true">←</span> {back.name}
            </button>
          </div>
        )}
        <HesitantNote points={s.points} doc={ctx.doc} of={s.of} />
        <header className="border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {s.readable && <FitChip pattern={s.fit.pattern} />}
            <PatternChip pattern={s.pattern} />
            <span className="ml-auto text-xs text-graphite">{s.code.isNew ? 'New code' : 'From the guide'}</span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold">{s.code.name}</h2>
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
              <DeliveryFigures b={breakdown} />
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
          <div className="mt-3 flex items-start gap-3 rounded-sm border border-mist px-3 py-2.5" data-testid="code-tick-box">
            <Switch checked={s.use} disabled={!s.showable} onChange={onUse} label="Put these signals in the report" testid="use-signal-panel" />
            <span>
              <span className="block text-sm font-medium">Put these signals in the report</span>
              <span className="block text-xs text-graphite" data-testid="tick-hint">
                {!s.readable ? 'Needs at least three people.' : !s.showable ? 'Nothing to show: no one made a claim for the delivery to disagree with.' : s.fit.pattern === 'Mixed' || s.fit.pattern === 'Conflicting' ? 'Suggested on: words and delivery don’t fit.' : s.notable ? 'Suggested on: hesitation shows.' : 'Suggested off: nothing stands out.'}
              </span>
            </span>
          </div>
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

/** The theme in the right panel: what its words claimed, how delivery stood against them, and which codes to look at. Numbers only, no chart. */
function ThemePanel({ g, prof, ctx, tensions, onCode, onOpenTension, onOpenTensions }: { g: { id: string; name: string; rows: CodeSignal[] }; prof?: ThemeSignal; ctx: CodebookCtx; tensions: Tension[]; onCode: (id: string) => void; onOpenTension: (id: string) => void; onOpenTensions?: () => void }) {
  if (!prof) return null
  const ins = themeInsight(prof, ctx.doc)
  const ids = new Set(g.rows.map((r) => r.code.id))
  const mine = tensions.filter((t) => !t.unavailable && t.codeIds.some((id) => ids.has(id)))
  const added = mine.filter((t) => t.status === 'Added as a tension theme')
  const review = mine.filter((t) => t.status === 'Suggested')
  return (
    <section aria-label={`Signals for the theme ${g.name}`} data-testid="theme-panel" data-theme={g.id} className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <FitChip pattern={prof.verdict} />
            <span className="ml-auto text-xs text-graphite">Theme</span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold" data-testid="theme-panel-name">{g.name}</h2>
          <p className="mt-1 text-xs text-graphite tabular-nums" data-testid="theme-panel-said-by">Said by {prof.people} of {prof.of}</p>
        </header>

        <section aria-label="Insight" className="flex flex-col gap-2 border-b border-mist px-5 py-4" data-testid="theme-insight">
          <AIGeneratedTag className="self-start" />
          <p className="text-sm" data-testid="insight-stance">{ins.stance}</p>
          {ins.delivery && <p className="text-sm" data-testid="insight-delivery">{ins.delivery}</p>}
        </section>

        <section aria-label="Codes to check" className="border-b border-mist px-5 py-4" data-testid="codes-to-check">
          <h3 className="text-sm font-semibold">Codes to check</h3>
          {ins.check.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {ins.check.map((c) => (
                <li key={c.code.id}>
                  <button type="button" onClick={() => onCode(c.code.id)} data-testid="check-chip" data-code-id={c.code.id} data-verdict={c.fit.pattern} title={`${verdictLabel(c.fit.pattern)}: delivery didn’t fit for ${c.fit.against} of ${c.fit.n}`} className="cursor-pointer rounded-xs focus-visible:outline-2">
                    <FitChip pattern={c.fit.pattern} label={c.code.name} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm" data-testid="check-none">None. Every code fits.</p>
          )}
        </section>

        <p className="px-5 py-3 text-xs text-graphite tabular-nums" data-testid="theme-coverage">{ins.coverage}</p>

        {(added.length > 0 || review.length > 0) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-mist px-5 py-3 text-sm" data-testid="theme-tension">
            {added.length > 0 && (
              <span>
                Related {added.length === 1 ? 'tension' : 'tensions'}:{' '}
                {added.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ' · '}
                    <button type="button" onClick={() => onOpenTension(t.id)} className="cursor-pointer rounded-xs text-iris-700 hover:underline">{t.title}</button>
                  </span>
                ))}
              </span>
            )}
            {review.length > 0 && (
              <button type="button" onClick={() => (review.length === 1 ? onOpenTension(review[0].id) : onOpenTensions?.())} data-testid="theme-tension-review" className="cursor-pointer rounded-xs font-medium text-iris-700 hover:underline">
                {plural(review.length, 'tension')} to review
              </button>
            )}
          </p>
        )}
      </div>
      <PanelFooter />
    </section>
  )
}

function PanelFooter() {
  return <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">{FACES_NOTE} Nothing here changes a Review decision.</footer>
}

