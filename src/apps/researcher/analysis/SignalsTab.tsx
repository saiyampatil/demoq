import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { EMOTIONS, STANCE_LABEL, faceOf, faceWeight, fitOf, topEmotions, type EmotionSplit } from '@/state/emotion'
import { SMALL_GROUP, breakdownOf, codeSignals, momentSignals, mostHesitation, mostPositive, plural, signalGroups, standouts, tensionsFor, themeRollup, themeSignals, type CodeSignal, type MomentSignal, type Point, type Tension, type ThemeSignal } from '@/state/signals'
import { BandBar, BandLegend, DeliveryFigures, EmotionBar, EmotionChip, EmotionLegend, FitChip, HesitantNote, HowItsDecided, PatternChip, PointCard, ToneBar, ToneLegend, ValenceCounts, ValenceKey, noReading } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { ByTheme } from './ThemeSignals'

export type View = 'theme' | 'code' | 'moment'
/** Which group the table reads: Face (expression, video only) or Speech (tone and certainty, everyone). Words vs delivery is always shown. */
export type Lens = 'emotion' | 'speech'
/** What the Signals tab is showing: kept by the page, so other places (a tension, a "what stands out" line) can open a code or a moment. */
export type SignalFocus = { view: View; lens?: Lens; code?: string; moment?: string; theme?: string }

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: 'emotion', label: 'Face', hint: 'What showed on the face, among people with video' },
  { key: 'speech', label: 'Speech', hint: 'Tone, and how sure they sounded: pace, pitch, delay, pauses and fillers, for everyone' },
]

/** How faces are read, in one place: described first, then an interpretation PulseAI offers and the Researcher can correct. */
export const FACES_NOTE = 'Each face is described first, by what was visible. The label (“reads as Doubt”) is PulseAI’s interpretation, made against that person’s resting face. It is a lead, not a verdict: correct it with “Not right?” and every count follows.'

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10

/** "4 of 10 interest" for a split, "Mixed reactions" when two or more share the top count (the detail is in the tooltip), or why there is nothing. */
export function emotionSummary(e: EmotionSplit) {
  const tops = topEmotions(e)
  if (!tops.length) return e.noVideo ? 'No video' : 'No clear reading'
  const n = e.counts[tops[0]]
  return tops.length === 1 ? `${n} of ${e.read} ${tops[0].toLowerCase()}` : 'Mixed reactions'
}
export const emotionSummaryTitle = (e: EmotionSplit) => {
  const tops = topEmotions(e)
  const gap = noReading(e)
  return `${e.read} faces read${gap ? `, ${gap}` : ''}${tops.length > 1 ? `. Tied at ${e.counts[tops[0]]} each: ${tops.join(', ')}` : ''}`
}

/** How they reacted: what stands out first, then the accepted codes and key moments, read through one channel at a time. */
export function SignalsTab({ ctx, focus, setFocus, tensions, onOpenTensions, onOpenTension }: { ctx: CodebookCtx; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTensions: () => void; onOpenTension: (id: string) => void }) {
  const { doc, basis } = ctx
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  const moments = useMemo(() => momentSignals(basis, doc), [basis, doc])
  const themes = useMemo(() => themeSignals(doc, basis, signals), [doc, basis, signals])
  const toReview = tensions.filter((t) => t.status === 'Suggested' && !t.unavailable).length
  const items = useMemo(() => standouts(signals, moments, toReview, doc), [signals, moments, toReview, doc])
  const view = focus.view
  const lens = focus.lens ?? 'emotion'

  return (
    <div className="flex flex-col gap-5">
      {items.length > 0 && (
        <section aria-label="What stands out" className="rounded-md border border-mist bg-surface" data-testid="standouts">
          <h2 className="px-5 pt-3.5 text-sm font-semibold">What stands out</h2>
          <ul className="mt-1 pb-1.5">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  data-testid="standout"
                  data-lens={it.lens}
                  onClick={() =>
                    it.kind === 'tensions'
                      ? onOpenTensions()
                      : setFocus(it.kind === 'code' ? { view: 'code', lens: it.lens === 'speech' ? 'speech' : 'emotion', code: it.target } : { view: 'moment', lens: it.lens === 'speech' ? 'speech' : 'emotion', moment: it.target })
                  }
                  className="group flex w-full items-center gap-3 px-5 py-2 text-left text-sm hover:bg-haze"
                >
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', it.kind === 'tensions' ? 'bg-pending-fg' : it.lens === 'emotion' ? 'bg-emo-delight' : it.lens === 'fit' ? 'bg-emo-doubt' : 'bg-iris-600')} />
                  <span className="w-36 shrink-0 text-xs text-graphite">{it.kind === 'tensions' ? 'Tensions' : it.lens === 'emotion' ? 'Face' : it.lens === 'fit' ? 'Words vs delivery' : it.lens === 'hesitant' ? 'Positive words, hesitant delivery' : it.kind === 'moment' ? 'Speech · certainty' : 'Speech'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{it.lead}.</span> <span className="text-graphite">{it.detail}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-iris-700 group-hover:underline">
                    {it.kind === 'tensions' ? 'Review' : it.kind === 'code' ? 'See the moments' : 'See who'} <ChevronRightIcon size={12} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Read signals by" className="flex rounded-sm border border-mist-strong p-0.5">
          {(
            [
              ['theme', 'By theme'],
              ['code', 'By code'],
              ['moment', 'By moment'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setFocus({ ...focus, view: v })} data-testid={`view-${v}`} className={cn('h-7 rounded-xs px-3 text-sm', view === v ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>
        {view === 'moment' ? (
          <>
            <div role="group" aria-label="Channel" className="flex rounded-sm border border-mist-strong p-0.5">
              {LENSES.map((l) => (
                <button key={l.key} type="button" title={l.hint} aria-pressed={lens === l.key} onClick={() => setFocus({ ...focus, lens: l.key })} data-testid={`lens-${l.key}`} className={cn('h-7 rounded-xs px-3 text-sm', lens === l.key ? 'bg-iris-50 font-medium text-iris-700 shadow-raised' : 'text-graphite hover:bg-haze hover:text-ink')}>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="min-w-0 flex-1 text-sm text-graphite">{LENSES.find((l) => l.key === lens)!.hint}.</p>
            {lens === 'emotion' ? <EmotionLegend /> : <><ToneLegend /><BandLegend /></>}
          </>
        ) : view === 'code' ? (
          <>
            <p className="min-w-0 flex-1 text-sm text-graphite">Each code with how people looked and sounded, and whether delivery fit the words.</p>
            <EmotionLegend />
            <ToneLegend />
          </>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-graphite">Each theme with its speech and face together, and whether delivery fit the words.</p>
        )}
      </div>
      {(view === 'code' || (view === 'moment' && lens === 'emotion')) && <ValenceKey />}

      {view === 'theme' ? <ByTheme ctx={ctx} themes={themes} tensions={tensions} focus={focus} setFocus={setFocus} onOpenTension={onOpenTension} /> : view === 'code' ? <ByCode ctx={ctx} themes={themes} signals={signals} focus={focus} setFocus={setFocus} tensions={tensions} onOpenTension={onOpenTension} /> : <ByMoment ctx={ctx} lens={lens} moments={moments} focus={focus} setFocus={setFocus} />}
    </div>
  )
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

// ─── by code ────────────────────────────────────────────────────────────────

/** Face: a small bar and one short label. The detail, if any, is in the tooltip. */
function FaceCell({ r }: { r: CodeSignal }) {
  if (!r.readable) return <span className="text-xs text-muted">Too few to read</span>
  return (
    <>
      <span className="w-10 shrink-0">
        <EmotionBar split={r.emotions} />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-graphite tabular-nums" title={emotionSummaryTitle(r.emotions)} data-testid="face-cell">
        {emotionSummary(r.emotions)}
      </span>
    </>
  )
}

/** The tone label: how many sounded flat or tense, or the tone most had. */
export function toneLabel(r: Pick<CodeSignal, 'tones'>) {
  const c = r.tones.counts
  const off = c.Flat + c.Tense
  if (off > 0) return `${off} flat or tense`
  return c.Even * 2 >= r.tones.n ? 'Mostly even' : c.Animated * 2 >= r.tones.n ? 'Mostly animated' : 'Mixed tone'
}

/** Speech: a small tone bar and one short label. Certainty (hesitation) is in the tooltip and the panel. */
function SpeechCell({ r }: { r: CodeSignal }) {
  if (!r.readable) return <span className="text-xs text-muted">—</span>
  const c = r.tones.counts
  return (
    <>
      <span className="w-10 shrink-0" data-testid="speech-bars">
        <ToneBar split={r.tones} />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-graphite tabular-nums" title={`Tone: ${c.Tense} tense, ${c.Flat} flat, ${c.Animated} animated, ${c.Even} even, of ${r.tones.n}. Certainty: marked hesitation in ${r.marked}, some in ${r.some}.`} data-testid="speech-label">
        {toneLabel(r)}
      </span>
    </>
  )
}

function ByCode({ ctx, themes, signals, focus, setFocus, tensions, onOpenTension }: { ctx: CodebookCtx; themes: ThemeSignal[]; signals: CodeSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTension: (id: string) => void }) {
  const { doc } = ctx
  const [notableOnly, setNotableOnly] = useState(false)
  const allGroups = useMemo(() => signalGroups(doc, signals), [doc, signals])
  const groups = useMemo(() => signalGroups(doc, notableOnly ? signals.filter((s) => s.notable) : signals), [doc, signals, notableOnly])
  const flat = groups.flatMap((g) => g.rows)
  // Opens on the code where words and delivery disagree most, then the most hesitant, so the first thing seen is worth seeing.
  const strongest = [...flat].filter((r) => r.notable).sort((a, b) => (b.fit.against) / (b.fit.n || 1) - (a.fit.against) / (a.fit.n || 1) || b.marked / b.people - a.marked / a.people)[0]
  const selected = flat.find((r) => r.code.id === focus.code) ?? strongest ?? flat[0]
  const arrows = useArrows(flat.map((r) => r.code.id), selected?.code.id, (id) => setFocus({ ...focus, code: id }), 'data-code')

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="Signals are read on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const inReport = new Map(themes.map((t) => [t.id, t.use]))

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
        {flat.length === 0 ? (
          <EmptyState title="Nothing stands out" description="No accepted code shows hesitation, or words and delivery that don’t fit." action={<Button onClick={() => setNotableOnly(false)}>Show all codes</Button>} />
        ) : (
          <div ref={arrows.ref} onKeyDown={arrows.onKeyDown}>
            <div className="hidden items-center gap-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:flex" data-testid="signal-head">
              <span className="flex-1">Code</span>
              <span className="w-12">Said by</span>
              <span className="w-[8.5rem]">Face</span>
              <span className="w-[8.5rem]">Speech</span>
              <span className="flex w-[7rem] flex-col gap-0.5" title="Do speech and face match what the words claim?">
                <span>Words vs delivery</span>
                <HowItsDecided />
              </span>
            </div>
            {groups.map((g) => {
              const roll = g.theme ? themeRollup(doc, allGroups.find((x) => x.id === g.id)?.rows ?? g.rows) : undefined
              return (
                <section key={g.id} aria-labelledby={`sg-${g.id}`} className="border-b border-mist last:border-0">
                  <header className="px-4 pt-3 pb-1">
                    <div className="flex items-baseline gap-2">
                      <h3 id={`sg-${g.id}`} className="text-sm font-semibold">
                        {g.name}
                      </h3>
                      {g.theme && (
                        <span className="ml-auto text-xs text-graphite" data-testid="group-in-report">
                          {inReport.get(g.id) ? 'In report' : 'Not in report'}
                        </span>
                      )}
                    </div>
                    {roll && (
                      <p className="mt-0.5 text-xs text-graphite" data-testid="theme-rollup">
                        {roll.text}
                        {roll.summary && (
                          <span className="mt-0.5 block text-ink" data-testid="theme-summary">
                            {roll.summary}
                          </span>
                        )}
                      </p>
                    )}
                  </header>
                  <ul className="pb-2">
                    {g.rows.map((r) => (
                      <li key={r.code.id} className={cn('flex items-center border-l-2 pr-3', r.code.id === selected?.code.id ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}>
                        <button type="button" data-code={r.code.id} onClick={() => setFocus({ ...focus, code: r.code.id })} aria-current={r.code.id === selected?.code.id ? 'true' : undefined} data-testid="signal-row" className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left text-sm">
                          <span className={cn('min-w-0 flex-1 truncate', r.notable ? 'font-semibold' : 'font-medium')}>{r.code.name}</span>
                          <span className="w-12 shrink-0 text-xs text-graphite tabular-nums">
                            {r.people} of {r.of}
                          </span>
                          <span className="flex w-[8.5rem] shrink-0 items-center gap-2">
                            <FaceCell r={r} />
                          </span>
                          <span className="flex w-[8.5rem] shrink-0 items-center gap-2">
                            <SpeechCell r={r} />
                          </span>
                          <span className="w-[7rem] shrink-0" data-testid="fit-cell">
                            <FitChip pattern={r.readable ? r.fit.pattern : 'Too few to read'} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">{selected ? <CodePanel key={selected.code.id} s={selected} ctx={ctx} tensions={tensionsFor(tensions, selected.code.id)} onOpenTension={onOpenTension} /> : null}</div>
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

function CodePanel({ s, ctx, tensions, onOpenTension }: { s: CodeSignal; ctx: CodebookCtx; tensions: Tension[]; onOpenTension: (id: string) => void }) {
  const delay = r1(median(s.points.map((p) => p.facts.delaySec)))
  const usual = r1(median(s.points.map((p) => p.usual)))
  const e = s.emotions
  const off = s.tones.counts.Flat + s.tones.counts.Tense
  const stance = s.points[0]?.stance
  const tops = topEmotions(e)
  const breakdown = breakdownOf(s.points, ctx.doc)
  return (
    <section aria-label={`Signals for ${s.code.name}`} data-testid="signal-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {s.readable && <FitChip pattern={s.fit.pattern} />}
            <PatternChip pattern={s.pattern} />
            <span className="ml-auto text-xs text-graphite">{s.code.isNew ? 'New code' : 'From the guide'}</span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold">{s.code.name}</h2>
          <p className="mt-1 text-sm text-graphite">{s.code.definition}</p>
          <p className="mt-2 text-xs text-graphite tabular-nums">
            Said by {s.people} of {s.of}
          </p>
        </header>

        <div className="border-b border-mist px-5 py-3" data-testid="channels">
          {s.readable ? (
            <>
              <DeliveryFigures b={breakdown} />
              <HesitantNote points={s.points} doc={ctx.doc} />
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
            {orderByFit(s.points, ctx).map((p) => (
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

// ─── by moment ──────────────────────────────────────────────────────────────

function ByMoment({ ctx, lens, moments, focus, setFocus }: { ctx: CodebookCtx; lens: Lens; moments: MomentSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void }) {
  const [compare, setCompare] = useState(false)
  const selected = moments.find((m) => m.moment.id === focus.moment) ?? moments.find((m) => m.moment.id === 'm-concept-a') ?? moments[0]
  // Ties are computed once and shared with "What stands out": a moment is never called the most when others share its count.
  const mostIds = new Set(mostHesitation(moments).map((m) => m.moment.id))
  const positiveIds = new Set(mostPositive(moments).map((m) => m.moment.id))
  const mostCount = moments.find((m) => mostIds.has(m.moment.id))?.all.counts['Marked hesitation'] ?? 0
  // When every row has a group under the minimum, say so once at the top instead of on every row.
  const smallest = (m: MomentSignal) => (lens === 'emotion' ? Math.min(m.emotions.dog.read, m.emotions.cat.read) : Math.min(m.dog.n, m.cat.n))
  const allSmall = moments.every((m) => smallest(m) < SMALL_GROUP)
  const arrows = useArrows(moments.map((m) => m.moment.id), selected.moment.id, (id) => setFocus({ ...focus, moment: id }), 'data-moment')

  const rowBar = (m: MomentSignal, which: 'all' | 'dog' | 'cat', tall?: boolean) =>
    lens === 'emotion' ? <EmotionBar split={m.emotions[which]} tall={tall} /> : <BandBar split={m[which]} tall={tall} />

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-label="Signals by moment" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-mist px-4 py-2.5">
          <p className="text-sm text-graphite">{lens === 'emotion' ? 'Concepts are read in the first five seconds, before any explanation.' : 'Speech · certainty: how sure each person sounded at each moment. Pick a moment to see each person.'}</p>
          <span className="flex-1" />
          <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2.5 text-sm text-graphite">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="compare-pets" className="accent-[var(--color-iris-600)]" />
            Compare dog and cat owners
          </label>
        </div>
        {lens === 'speech' && mostIds.size > 1 && (
          <p className="border-b border-mist px-4 py-2 text-sm" data-testid="tie-note">
            <span className="font-medium">Tied for the most hesitation:</span> <span className="text-graphite tabular-nums">{mostIds.size} moments, marked hesitation in {mostCount} people at each.</span>
          </p>
        )}
        {lens === 'emotion' && positiveIds.size > 1 && (
          <p className="border-b border-mist px-4 py-2 text-sm" data-testid="tie-note">
            <span className="font-medium">Tied for the most positive first reaction:</span> <span className="text-graphite">{positiveIds.size} concepts, the same share of faces read as delight or interest.</span>
          </p>
        )}
        {compare && allSmall && (
          <p className="border-b border-mist bg-pending-bg px-4 py-2 text-sm text-pending-fg" data-testid="compare-small">
            Too small to read: at every moment, one group has fewer than {SMALL_GROUP} people{lens === 'emotion' ? ' on video' : ''}. The counts are shown for reference only.
          </p>
        )}
        <div ref={arrows.ref} onKeyDown={arrows.onKeyDown}>
          <ul>
            {moments.map((m) => {
              const isMost = lens === 'speech' && mostIds.has(m.moment.id)
              const isWarmest = lens === 'emotion' && positiveIds.has(m.moment.id)
              const showCompare = compare
              return (
                <li key={m.moment.id} className={cn('border-b border-mist border-l-2 last:border-b-0', m.moment.id === selected.moment.id ? 'border-l-iris-600 bg-iris-50' : 'border-l-transparent hover:bg-haze')}>
                  <button type="button" data-moment={m.moment.id} onClick={() => setFocus({ ...focus, moment: m.moment.id })} aria-current={m.moment.id === selected.moment.id ? 'true' : undefined} data-testid="moment-row" className="block w-full px-4 py-3 text-left">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{m.moment.label}</span>
                      <span className="text-xs text-graphite">{m.moment.kind === 'stimulus' ? 'First reaction to a concept' : 'Guide question'}</span>
                      {isMost && <span className="rounded-xs border border-iris-600 px-1 text-[11px] font-medium text-iris-700" data-testid="most-hesitation" title={mostIds.size > 1 ? `Tied with ${mostIds.size - 1} other ${mostIds.size === 2 ? 'moment' : 'moments'}` : undefined}>Most hesitation</span>}
                      {isWarmest && <span className="rounded-xs border border-emo-warm-line bg-emo-warm-bg px-1 text-[11px] font-medium text-emo-warm-fg" data-testid="warmest" title={positiveIds.size > 1 ? `Tied with ${positiveIds.size - 1} other ${positiveIds.size === 2 ? 'concept' : 'concepts'}` : undefined}>Most positive</span>}
                    </span>
                    {showCompare ? (
                      <span className="mt-2 flex flex-col gap-1.5">
                        {(
                          [
                            ['Dog owners', 'dog'],
                            ['Cat owners', 'cat'],
                          ] as const
                        ).map(([label, which]) => (
                          <span key={label} className="flex items-center gap-3">
                            <span className="w-24 shrink-0 text-xs text-graphite">{label}</span>
                            <span className="flex-1">{rowBar(m, which)}</span>
                            <MomentCounts m={m} lens={lens} which={which} />
                          </span>
                        ))}
                        {!allSmall && smallest(m) < SMALL_GROUP && (
                          <span className="text-xs text-pending-fg">One group has fewer than {SMALL_GROUP} people{lens === 'emotion' ? ' on video' : ''}. Too small to read.</span>
                        )}
                      </span>
                    ) : (
                      <span className="mt-2 flex items-center gap-3">
                        <span className="flex-1">{rowBar(m, 'all', true)}</span>
                        <MomentCounts m={m} lens={lens} which="all" />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
      <div className="lg:sticky lg:top-4">
        <MomentPanel key={`${selected.moment.id}-${lens}`} m={selected} ctx={ctx} lens={lens} />
      </div>
    </div>
  )
}

function MomentCounts({ m, lens, which }: { m: MomentSignal; lens: Lens; which: 'all' | 'dog' | 'cat' }) {
  const cls = 'w-64 shrink-0 text-right text-xs text-graphite tabular-nums'
  if (lens === 'emotion') {
    const e = m.emotions[which]
    return (
      <span className={cls} title={noReading(e) ? `${noReading(e)}` : undefined}>
        <ValenceCounts e={e} /> <span className="text-muted">of {e.read}</span>
      </span>
    )
  }
  const s = m[which]
  return (
    <span className={cls}>
      <span className="font-semibold text-ink">{s.counts['Marked hesitation']}</span> marked · {s.counts['Some hesitation']} some · {s.counts.Steady} steady <span className="text-muted">of {s.n}</span>
    </span>
  )
}

function MomentPanel({ m, ctx, lens }: { m: MomentSignal; ctx: CodebookCtx; lens: Lens }) {
  const [rest, setRest] = useState(false)
  const label = m.moment.label
  // The people worth seeing first for this channel, and the rest behind a toggle.
  let lead: Point[]
  let tail: Point[]
  let leadTitle: string
  let tailLabel: string
  if (lens === 'emotion') {
    const read = m.points.filter((p) => faceOf(p, ctx.doc)?.emotion)
    lead = [...read].sort((a, b) => faceWeight(faceOf(b, ctx.doc)) - faceWeight(faceOf(a, ctx.doc)))
    tail = m.points.filter((p) => !read.includes(p))
    leadTitle = 'Faces read'
    tailLabel = `${tail.length} with no face reading`
  } else {
    lead = m.points.filter((p) => p.band !== 'Steady')
    tail = m.points.filter((p) => p.band === 'Steady')
    leadTitle = 'Speech · showed hesitation'
    tailLabel = `${tail.length} steady`
  }
  const e = m.emotions.all
  return (
    <section aria-label={label} data-testid="moment-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <p className="text-xs text-graphite">{m.moment.kind === 'stimulus' ? 'First reaction to a concept' : 'Guide question'}</p>
          <h2 className="mt-1 text-lg leading-snug font-semibold">{label}</h2>
          <p className="mt-1 text-sm text-graphite">“{m.moment.text}”</p>
          <div className="mt-3">
            {lens === 'emotion' ? (
              <>
                <EmotionBar split={e} tall />
                <p className="mt-1.5 text-sm tabular-nums">
                  {e.read ? (
                    <>
                      <ValenceCounts e={e} /> of {e.read} faces read.
                    </>
                  ) : (
                    'No faces read.'
                  )}
                  {noReading(e) && <span className="text-graphite"> {e.read} of {m.all.n} people had a face read ({noReading(e)}).</span>}
                </p>
                {e.read > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="moment-emotions">
                    <span className="text-xs text-graphite">Reads as</span>
                    {EMOTIONS.filter((x) => e.counts[x]).map((x, _i, xs) => (
                      <span key={x} className="inline-flex items-center gap-1 text-xs text-graphite tabular-nums">
                        <EmotionChip emotion={x} />
                        {xs.length > 1 && <> {e.counts[x]}</>}
                      </span>
                    ))}
                  </p>
                )}
              </>
            ) : (
              <>
                <BandBar split={m.all} tall />
                <p className="mt-1.5 text-sm tabular-nums">
                  <span className="font-semibold">{m.all.counts['Marked hesitation']}</span> marked, {m.all.counts['Some hesitation']} some, {m.all.counts.Steady} steady, of {m.all.n} people asked
                </p>
                <p className="mt-1 text-xs text-graphite tabular-nums" data-testid="moment-tone">
                  Tone: {m.tones.counts.Tense} tense, {m.tones.counts.Flat} flat, {m.tones.counts.Animated} animated, {m.tones.counts.Even} even.
                </p>
              </>
            )}
          </div>
        </header>
        <section aria-label="People" className="px-5 py-4">
          <h3 className="text-sm font-semibold">
            {leadTitle} <span className="font-normal text-graphite tabular-nums">{lead.length}</span>
          </h3>
          {lead.length ? (
            <ul className="mt-2 divide-y divide-mist">
              {lead.map((p) => (
                <PointCard key={p.participantId} point={p} ctx={ctx} context={label} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-graphite">Nobody here.</p>
          )}
          {tail.length > 0 && (
            <div className="mt-4 border-t border-mist pt-3">
              <button type="button" aria-expanded={rest} onClick={() => setRest((x) => !x)} className="text-sm font-medium text-iris-700 hover:underline">
                {rest ? 'Hide the others' : `Show ${tailLabel}`}
              </button>
              {rest && (
                <ul className="mt-2 divide-y divide-mist">
                  {tail.map((p) => (
                    <PointCard key={p.participantId} point={p} ctx={ctx} context={label} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
      <PanelFooter />
    </section>
  )
}
