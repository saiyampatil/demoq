import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { setSignalPick } from '@/state/codebook'
import { EMOTIONS, STANCE_LABEL, faceOf, faceWeight, topEmotion, type EmotionSplit } from '@/state/emotion'
import { SMALL_GROUP, codeSignals, momentSignals, plural, signalGroups, standouts, tensionsFor, themeRollup, type CodeSignal, type MomentSignal, type Point, type Tension } from '@/state/signals'
import { BandBar, BandLegend, EmotionBar, EmotionChip, EmotionLegend, FitChip, PatternChip, PointCard, ToneBar, ToneLegend } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'

export type View = 'code' | 'moment'
/** Which channel the table reads. Words vs delivery is always shown, because it is the one that needs all three. */
export type Lens = 'hesitation' | 'emotion' | 'voice'
/** What the Signals tab is showing: kept by the page, so other places (a tension, a "what stands out" line) can open a code or a moment. */
export type SignalFocus = { view: View; lens?: Lens; code?: string; moment?: string }

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: 'emotion', label: 'Emotion', hint: 'What showed on the face, among people with video' },
  { key: 'voice', label: 'Voice', hint: 'Pace, pitch and loudness against each person’s usual' },
  { key: 'hesitation', label: 'Hesitation', hint: 'Answer delay, pauses and fillers' },
]

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10

/** "Doubt, 2 of 3 faces" for a split, or why there is nothing. */
function emotionSummary(e: EmotionSplit) {
  const top = topEmotion(e)
  if (!top) return e.noVideo ? 'No video' : 'No clear reading'
  return `${top}, ${e.counts[top]} of ${e.read}`
}

/** How they reacted: what stands out first, then the accepted codes and key moments, read through one channel at a time. */
export function SignalsTab({ ctx, focus, setFocus, tensions, onOpenTensions, onOpenTension }: { ctx: CodebookCtx; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTensions: () => void; onOpenTension: (id: string) => void }) {
  const { doc, basis } = ctx
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  const moments = useMemo(() => momentSignals(basis, doc), [basis, doc])
  const toReview = tensions.filter((t) => t.status === 'Suggested' && !t.unavailable).length
  const items = useMemo(() => standouts(signals, moments, toReview), [signals, moments, toReview])
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
                      : setFocus(it.kind === 'code' ? { view: 'code', lens: it.lens === 'hesitation' ? 'hesitation' : 'emotion', code: it.target } : { view: 'moment', lens: it.lens === 'hesitation' ? 'hesitation' : 'emotion', moment: it.target })
                  }
                  className="group flex w-full items-center gap-3 px-5 py-2 text-left text-sm hover:bg-haze"
                >
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', it.kind === 'tensions' ? 'bg-pending-fg' : it.lens === 'emotion' ? 'bg-emo-delight' : it.lens === 'fit' ? 'bg-emo-doubt' : 'bg-iris-600')} />
                  <span className="w-20 shrink-0 text-xs text-graphite">{it.kind === 'tensions' ? 'Tensions' : it.lens === 'emotion' ? 'Emotion' : it.lens === 'fit' ? 'Words vs delivery' : 'Hesitation'}</span>
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
              ['code', 'By code'],
              ['moment', 'By moment'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setFocus({ ...focus, view: v })} data-testid={`view-${v}`} className={cn('h-7 rounded-xs px-3 text-sm', view === v ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Channel" className="flex rounded-sm border border-mist-strong p-0.5">
          {LENSES.map((l) => (
            <button key={l.key} type="button" title={l.hint} aria-pressed={lens === l.key} onClick={() => setFocus({ ...focus, lens: l.key })} data-testid={`lens-${l.key}`} className={cn('h-7 rounded-xs px-3 text-sm', lens === l.key ? 'bg-iris-50 font-medium text-iris-700 shadow-[inset_0_0_0_1px_var(--color-iris-100)]' : 'text-graphite hover:bg-haze hover:text-ink')}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-sm text-graphite">{LENSES.find((l) => l.key === lens)!.hint}.</p>
        {lens === 'emotion' ? <EmotionLegend /> : lens === 'voice' ? <ToneLegend /> : <BandLegend />}
      </div>

      {view === 'code' ? <ByCode ctx={ctx} lens={lens} signals={signals} focus={focus} setFocus={setFocus} tensions={tensions} onOpenTension={onOpenTension} /> : <ByMoment ctx={ctx} lens={lens} moments={moments} focus={focus} setFocus={setFocus} />}
    </div>
  )
}

/** Arrow keys move through a list of rows, as in the codebook. */
function useArrows(ids: string[], current: string | undefined, pick: (id: string) => void, attr: string) {
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

/** The channel column of a code row. */
function LensCell({ r, lens }: { r: CodeSignal; lens: Lens }) {
  if (!r.readable) return <PatternChip pattern="Too few to read" />
  if (lens === 'hesitation')
    return (
      <>
        <span className="w-12 shrink-0">
          <BandBar split={{ counts: { Steady: r.steady, 'Some hesitation': r.some, 'Marked hesitation': r.marked }, n: r.people }} />
        </span>
        <span className="w-[8.5rem] shrink-0 text-xs text-graphite tabular-nums" title="Marked hesitation, of the people who said it">
          <span className="font-semibold text-ink">{r.marked}</span> of {r.people} marked
        </span>
      </>
    )
  if (lens === 'emotion')
    return (
      <>
        <span className="w-12 shrink-0">
          <EmotionBar split={r.emotions} />
        </span>
        <span className="w-[8.5rem] shrink-0 truncate text-xs text-graphite tabular-nums" title={`${r.emotions.read} faces read, ${r.emotions.noVideo} audio-only`}>
          {emotionSummary(r.emotions)}
        </span>
      </>
    )
  const off = r.tones.counts.Flat + r.tones.counts.Tense
  return (
    <>
      <span className="w-12 shrink-0">
        <ToneBar split={r.tones} />
      </span>
      <span className="w-[8.5rem] shrink-0 text-xs text-graphite tabular-nums" title="Flat or tense, of the people who said it">
        <span className="font-semibold text-ink">{off}</span> of {r.tones.n} flat or tense
      </span>
    </>
  )
}

function ByCode({ ctx, lens, signals, focus, setFocus, tensions, onOpenTension }: { ctx: CodebookCtx; lens: Lens; signals: CodeSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTension: (id: string) => void }) {
  const { doc, me } = ctx
  const toast = useToast()
  const [notableOnly, setNotableOnly] = useState(false)
  const allGroups = useMemo(() => signalGroups(doc, signals), [doc, signals])
  const groups = useMemo(() => signalGroups(doc, notableOnly ? signals.filter((s) => s.notable) : signals), [doc, signals, notableOnly])
  const flat = groups.flatMap((g) => g.rows)
  // Opens on the code where words and delivery disagree most, then the most hesitant, so the first thing seen is worth seeing.
  const strongest = [...flat].filter((r) => r.notable).sort((a, b) => (b.fit.doesnt + b.fit.partly) / (b.fit.n || 1) - (a.fit.doesnt + a.fit.partly) / (a.fit.n || 1) || b.marked / b.people - a.marked / a.people)[0]
  const selected = flat.find((r) => r.code.id === focus.code) ?? strongest ?? flat[0]
  const arrows = useArrows(flat.map((r) => r.code.id), selected?.code.id, (id) => setFocus({ ...focus, code: id }), 'data-code')

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="Signals are read on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const setUse = (s: CodeSignal, on: boolean) => {
    ctx.act((d) => setSignalPick(d, s.code, on, { by: me }))
    toast(on ? `“${s.code.name}” signals will go in the report` : `“${s.code.name}” signals left out of the report`)
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-label="Signals by code" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist px-4 py-2.5">
          <p className="text-sm text-graphite">
            <span className="font-semibold text-ink tabular-nums">{signals.filter((s) => s.use).length}</span> of {signals.length} in the report
          </p>
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
            <div className="hidden items-center gap-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:flex">
              <span className="flex-1">Code</span>
              <span className="w-12">Said by</span>
              <span className="w-[12.25rem]">{LENSES.find((l) => l.key === lens)!.label}</span>
              <span className="w-[5.75rem]" title="Do the face, voice and hesitation match what the words claim?">
                Words vs delivery
              </span>
              <span className="w-14 text-center">Report</span>
            </div>
            {groups.map((g) => {
              const roll = g.theme ? themeRollup(doc, allGroups.find((x) => x.id === g.id)?.rows ?? g.rows) : undefined
              return (
                <section key={g.id} aria-labelledby={`sg-${g.id}`} className="border-b border-mist last:border-0">
                  <header className="px-4 pt-3 pb-1">
                    <h3 id={`sg-${g.id}`} className="text-sm font-semibold">
                      {g.name}
                    </h3>
                    {roll && (
                      <p className="mt-0.5 text-xs text-graphite" data-testid="theme-rollup">
                        {roll.text}
                        {roll.highlight && (
                          <span className="mt-1 flex items-start gap-1.5 font-medium text-emo-cold-fg" data-testid="theme-highlight">
                            <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-emo-doubt" />
                            {roll.highlight}
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
                          <span className="flex w-[12.25rem] shrink-0 items-center gap-2">
                            <LensCell r={r} lens={lens} />
                          </span>
                          <span className="w-[5.75rem] shrink-0" data-testid="fit-cell">
                            <FitChip pattern={r.readable ? r.fit.pattern : 'Too few to read'} />
                          </span>
                        </button>
                        <label className="flex w-14 shrink-0 justify-center py-2" title={r.readable ? undefined : 'Too few people to put in the report'}>
                          <input type="checkbox" checked={r.use} disabled={!r.readable} onChange={(e) => setUse(r, e.target.checked)} aria-label={`Put ${r.code.name} signals in the report`} className="accent-[var(--color-iris-600)] disabled:opacity-40" data-testid="use-signal" />
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">{selected ? <CodePanel key={selected.code.id} s={selected} ctx={ctx} lens={lens} tensions={tensionsFor(tensions, selected.code.id)} onOpenTension={onOpenTension} onUse={(on) => setUse(selected, on)} /> : null}</div>
    </div>
  )
}

/** One channel in the code panel: a label, a bar and what it says. */
function ChannelRow({ label, bar, children, testid }: { label: string; bar?: React.ReactNode; children: React.ReactNode; testid?: string }) {
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

/** People in the panel, ordered for the channel being read: the strongest reading first. */
function orderFor(points: Point[], lens: Lens, ctx: CodebookCtx) {
  if (lens === 'hesitation') return points
  if (lens === 'voice') {
    const rank = { Tense: 0, Flat: 1, Animated: 2, Even: 3 } as const
    return [...points].sort((a, b) => rank[a.voice.tone] - rank[b.voice.tone])
  }
  return [...points].sort((a, b) => faceWeight(faceOf(b, ctx.doc)) - faceWeight(faceOf(a, ctx.doc)))
}

function CodePanel({ s, ctx, lens, tensions, onUse, onOpenTension }: { s: CodeSignal; ctx: CodebookCtx; lens: Lens; tensions: Tension[]; onUse: (on: boolean) => void; onOpenTension: (id: string) => void }) {
  const delay = r1(median(s.points.map((p) => p.facts.delaySec)))
  const usual = r1(median(s.points.map((p) => p.usual)))
  const e = s.emotions
  const off = s.tones.counts.Flat + s.tones.counts.Tense
  const stance = s.points[0]?.stance
  const against = s.fit.doesnt + s.fit.partly
  const top = topEmotion(e)
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
              {stance && stance !== 'Neutral' && s.fit.n > 0 && (
                <p className={cn('mb-2 rounded-sm px-3 py-2 text-sm', against ? 'bg-pending-bg text-pending-fg' : 'bg-haze text-graphite')} data-testid="fit-verdict">
                  {against ? (
                    <>
                      <span className="font-semibold">For {against} of {s.fit.n},</span> the face, voice or hesitation pulled against the words
                      {s.fit.doesnt > 0 && <> ({s.fit.doesnt} clearly)</>}.
                    </>
                  ) : (
                    <>How they said it fits the words for all {s.fit.n}.</>
                  )}
                </p>
              )}
              <dl className="divide-y divide-mist">
                <ChannelRow label="Words">{stance ? STANCE_LABEL[stance] : '—'}</ChannelRow>
                <ChannelRow label="Face" bar={<EmotionBar split={e} tall />} testid="channel-face">
                  {top ? (
                    <>
                      <span className="font-semibold tabular-nums">
                        {top} in {e.counts[top]} of {e.read}
                      </span>{' '}
                      faces read.
                    </>
                  ) : (
                    'No faces read.'
                  )}
                  {e.noVideo > 0 && <span className="text-graphite"> {e.noVideo} audio-only.</span>}
                  {e.unclear > 0 && <span className="text-graphite"> {e.unclear} marked no clear expression.</span>}
                  {e.read > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {EMOTIONS.filter((x) => e.counts[x]).map((x) => (
                        <span key={x} className="inline-flex items-center gap-1 text-xs text-graphite tabular-nums">
                          <EmotionChip emotion={x} /> {e.counts[x]}
                        </span>
                      ))}
                    </span>
                  )}
                </ChannelRow>
                <ChannelRow label="Voice" bar={<ToneBar split={s.tones} tall />}>
                  <span className="font-semibold tabular-nums">
                    Flat or tense for {off} of {s.tones.n}.
                  </span>{' '}
                  <span className="text-graphite">Animated {s.tones.counts.Animated}, even {s.tones.counts.Even}.</span>
                </ChannelRow>
                <ChannelRow label="Hesitation" bar={<BandBar split={{ counts: { Steady: s.steady, 'Some hesitation': s.some, 'Marked hesitation': s.marked }, n: s.people }} tall />}>
                  <span className="font-semibold tabular-nums">
                    Marked in {s.marked} of {s.people},
                  </span>{' '}
                  some in {s.some}. <span className="text-graphite tabular-nums">Median delay {delay} s, against a usual {usual} s.</span>
                </ChannelRow>
              </dl>
            </>
          ) : (
            <p className="py-1 text-sm">Only {plural(s.people, 'person')} said this, which is too few to read a pattern or put in the report. Their moments are below.</p>
          )}
          <label className={cn('mt-3 flex items-start gap-2.5 rounded-sm border border-mist px-3 py-2.5', s.readable ? 'cursor-pointer' : 'opacity-60')}>
            <input type="checkbox" checked={s.use} disabled={!s.readable} onChange={(ev) => onUse(ev.target.checked)} className="mt-0.5 accent-[var(--color-iris-600)]" />
            <span>
              <span className="block text-sm font-medium">Put these signals in the report</span>
              <span className="block text-xs text-graphite">{s.readable ? 'On by default when hesitation shows, or words and delivery don’t fit.' : 'Needs at least three people.'}</span>
            </span>
          </label>
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
            <span className="ml-2 text-xs font-normal text-graphite">{lens === 'emotion' ? 'Strongest face first' : lens === 'voice' ? 'Tense and flat first' : 'Most hesitant first'}</span>
          </h3>
          <ul className="mt-2 divide-y divide-mist">
            {orderFor(s.points, lens, ctx).map((p) => (
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
  return <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">Faces are read against each person’s resting face. A reading is a lead, not a verdict: correct it if it’s wrong. Nothing here changes a Review decision.</footer>
}

// ─── by moment ──────────────────────────────────────────────────────────────

function ByMoment({ ctx, lens, moments, focus, setFocus }: { ctx: CodebookCtx; lens: Lens; moments: MomentSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void }) {
  const [compare, setCompare] = useState(false)
  const selected = moments.find((m) => m.moment.id === focus.moment) ?? moments.find((m) => m.moment.id === 'm-concept-a') ?? moments[0]
  const most = Math.max(...moments.map((m) => m.all.counts['Marked hesitation'] / (m.all.n || 1)))
  const concepts = moments.filter((m) => m.moment.kind === 'stimulus' && m.emotions.all.read >= 10)
  const warmest = Math.max(...concepts.map((m) => m.emotions.all.valence.Positive / m.emotions.all.read))
  const arrows = useArrows(moments.map((m) => m.moment.id), selected.moment.id, (id) => setFocus({ ...focus, moment: id }), 'data-moment')

  const rowBar = (m: MomentSignal, which: 'all' | 'dog' | 'cat', tall?: boolean) =>
    lens === 'emotion' ? <EmotionBar split={m.emotions[which]} tall={tall} /> : lens === 'voice' ? <ToneBar split={which === 'all' ? m.tones : m.tones} tall={tall} /> : <BandBar split={m[which]} tall={tall} />

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-label="Signals by moment" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-mist px-4 py-2.5">
          <p className="text-sm text-graphite">{lens === 'emotion' ? 'Concepts are read in the first five seconds, before any explanation.' : 'Pick a moment to see each person.'}</p>
          <span className="flex-1" />
          {lens !== 'voice' && (
            <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2.5 text-sm text-graphite">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="compare-pets" className="accent-[var(--color-iris-600)]" />
              Compare dog and cat owners
            </label>
          )}
        </div>
        <div ref={arrows.ref} onKeyDown={arrows.onKeyDown}>
          <ul>
            {moments.map((m) => {
              const isMost = lens === 'hesitation' && m.all.counts['Marked hesitation'] / (m.all.n || 1) === most && m.all.counts['Marked hesitation'] >= 3
              const isWarmest = lens === 'emotion' && concepts.includes(m) && m.emotions.all.valence.Positive / m.emotions.all.read === warmest
              const showCompare = compare && lens !== 'voice'
              return (
                <li key={m.moment.id} className={cn('border-b border-mist border-l-2 last:border-b-0', m.moment.id === selected.moment.id ? 'border-l-iris-600 bg-iris-50' : 'border-l-transparent hover:bg-haze')}>
                  <button type="button" data-moment={m.moment.id} onClick={() => setFocus({ ...focus, moment: m.moment.id })} aria-current={m.moment.id === selected.moment.id ? 'true' : undefined} data-testid="moment-row" className="block w-full px-4 py-3 text-left">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{m.moment.label}</span>
                      <span className="text-xs text-graphite">{m.moment.kind === 'stimulus' ? 'First reaction to a concept' : 'Guide question'}</span>
                      {isMost && <span className="rounded-xs border border-iris-600 px-1 text-[11px] font-medium text-iris-700">Most hesitation</span>}
                      {isWarmest && <span className="rounded-xs border border-emo-warm-line bg-emo-warm-bg px-1 text-[11px] font-medium text-emo-warm-fg" data-testid="warmest">Warmest reaction</span>}
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
                        {(lens === 'emotion' ? Math.min(m.emotions.dog.read, m.emotions.cat.read) : Math.min(m.dog.n, m.cat.n)) < SMALL_GROUP && (
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
  const cls = 'w-52 shrink-0 text-right text-xs whitespace-nowrap text-graphite tabular-nums'
  if (lens === 'emotion') {
    const e = m.emotions[which]
    return (
      <span className={cls}>
        <span className="font-semibold text-emo-warm-fg">{e.valence.Positive}</span> warm · {e.valence.Neutral} neutral · <span className="font-semibold text-emo-cold-fg">{e.valence.Negative}</span> cold <span className="text-muted">of {e.read}</span>
      </span>
    )
  }
  if (lens === 'voice')
    return (
      <span className={cls}>
        <span className="font-semibold text-ink">{m.tones.counts.Tense + m.tones.counts.Flat}</span> flat or tense · {m.tones.counts.Animated} animated <span className="text-muted">of {m.tones.n}</span>
      </span>
    )
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
  } else if (lens === 'voice') {
    lead = m.points.filter((p) => p.voice.tone === 'Tense' || p.voice.tone === 'Flat')
    tail = m.points.filter((p) => !lead.includes(p))
    leadTitle = 'Flat or tense'
    tailLabel = `${tail.length} animated or even`
  } else {
    lead = m.points.filter((p) => p.band !== 'Steady')
    tail = m.points.filter((p) => p.band === 'Steady')
    leadTitle = 'Showed hesitation'
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
                      <span className="font-semibold">{e.valence.Positive}</span> warm, {e.valence.Neutral} neutral, <span className="font-semibold">{e.valence.Negative}</span> cold, of {e.read} faces read.
                    </>
                  ) : (
                    'No faces read.'
                  )}
                  {e.noVideo > 0 && <span className="text-graphite"> {e.noVideo} audio-only.</span>}
                </p>
                {e.read > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-1.5" data-testid="moment-emotions">
                    {EMOTIONS.filter((x) => e.counts[x]).map((x) => (
                      <span key={x} className="inline-flex items-center gap-1 text-xs text-graphite tabular-nums">
                        <EmotionChip emotion={x} /> {e.counts[x]}
                      </span>
                    ))}
                  </p>
                )}
              </>
            ) : lens === 'voice' ? (
              <>
                <ToneBar split={m.tones} tall />
                <p className="mt-1.5 text-sm tabular-nums">
                  <span className="font-semibold">{m.tones.counts.Tense}</span> tense, {m.tones.counts.Flat} flat, {m.tones.counts.Animated} animated, {m.tones.counts.Even} even, of {m.tones.n}
                </p>
              </>
            ) : (
              <>
                <BandBar split={m.all} tall />
                <p className="mt-1.5 text-sm tabular-nums">
                  <span className="font-semibold">{m.all.counts['Marked hesitation']}</span> marked, {m.all.counts['Some hesitation']} some, {m.all.counts.Steady} steady, of {m.all.n} people asked
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
