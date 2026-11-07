import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { setSignalPick } from '@/state/codebook'
import { SMALL_GROUP, codeSignals, momentSignals, plural, signalGroups, standouts, tensionsFor, type CodeSignal, type MomentSignal, type Tension } from '@/state/signals'
import { BandBar, BandLegend, PatternChip, PointCard } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'

export type View = 'code' | 'moment'
/** What the Signals tab is showing: kept by the page, so other places (a tension, a "what stands out" line) can open a code or a moment. */
export type SignalFocus = { view: View; code?: string; moment?: string }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10

/** How they said it: what stands out first, then the same accepted codes and key moments with what was measured. */
export function SignalsTab({ ctx, focus, setFocus, tensions, onOpenTensions, onOpenTension }: { ctx: CodebookCtx; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTensions: () => void; onOpenTension: (id: string) => void }) {
  const { doc, basis } = ctx
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  const moments = useMemo(() => momentSignals(basis), [basis])
  const toReview = tensions.filter((t) => t.status === 'Suggested' && !t.unavailable).length
  const items = useMemo(() => standouts(signals, moments, toReview), [signals, moments, toReview])
  const view = focus.view

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
                  onClick={() => (it.kind === 'tensions' ? onOpenTensions() : setFocus(it.kind === 'code' ? { view: 'code', code: it.target } : { view: 'moment', moment: it.target }))}
                  className="group flex w-full items-center gap-3 px-5 py-2 text-left text-sm hover:bg-haze"
                >
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', it.kind === 'tensions' ? 'bg-pending-fg' : 'bg-iris-600')} />
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
        <div role="group" aria-label="Read signals" className="flex rounded-sm border border-mist-strong p-0.5">
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
        <p className="min-w-0 flex-1 text-sm text-graphite">{view === 'code' ? 'The accepted codes, and how steady people were when they said them.' : 'Each key moment in the interview, and how steady everyone was.'}</p>
        <BandLegend />
      </div>

      {view === 'code' ? <ByCode ctx={ctx} signals={signals} focus={focus} setFocus={setFocus} tensions={tensions} onOpenTension={onOpenTension} /> : <ByMoment ctx={ctx} moments={moments} focus={focus} setFocus={setFocus} />}
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

function ByCode({ ctx, signals, focus, setFocus, tensions, onOpenTension }: { ctx: CodebookCtx; signals: CodeSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void; tensions: Tension[]; onOpenTension: (id: string) => void }) {
  const { doc, me } = ctx
  const toast = useToast()
  const [notableOnly, setNotableOnly] = useState(false)
  const groups = useMemo(() => signalGroups(doc, notableOnly ? signals.filter((s) => s.notable) : signals), [doc, signals, notableOnly])
  const flat = groups.flatMap((g) => g.rows)
  // Opens on the code with the strongest pattern, so the first thing seen is the thing worth seeing.
  const strongest = [...flat].filter((r) => r.notable).sort((a, b) => b.marked / b.people - a.marked / a.people)[0]
  const selected = flat.find((r) => r.code.id === focus.code) ?? strongest ?? flat[0]
  const arrows = useArrows(flat.map((r) => r.code.id), selected?.code.id, (id) => setFocus({ ...focus, code: id }), 'data-code')

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="Signals are measured on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const setUse = (s: CodeSignal, on: boolean) => {
    ctx.act((d) => setSignalPick(d, s.code, on, { by: me }))
    toast(on ? `“${s.code.name}” signals will go in the report` : `“${s.code.name}” signals left out of the report`)
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
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
          <EmptyState title="Nothing stands out" description="No accepted code shows a mixed or hesitant pattern." action={<Button onClick={() => setNotableOnly(false)}>Show all codes</Button>} />
        ) : (
          <div ref={arrows.ref} onKeyDown={arrows.onKeyDown}>
            <div className="hidden items-center gap-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:flex">
              <span className="flex-1">Code</span>
              <span className="w-24">Said by</span>
              <span className="w-52">How steady</span>
              <span className="w-14 text-center">In report</span>
            </div>
            {groups.map((g) => (
              <section key={g.id} aria-labelledby={`sg-${g.id}`} className="border-b border-mist last:border-0">
                <h3 id={`sg-${g.id}`} className="px-4 pt-3 pb-1 text-sm font-semibold">
                  {g.name}
                </h3>
                <ul className="pb-2">
                  {g.rows.map((r) => (
                    <li key={r.code.id} className={cn('flex items-center border-l-2 pr-3', r.code.id === selected?.code.id ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}>
                      <button type="button" data-code={r.code.id} onClick={() => setFocus({ ...focus, code: r.code.id })} aria-current={r.code.id === selected?.code.id ? 'true' : undefined} data-testid="signal-row" className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left text-sm">
                        <span className={cn('min-w-0 flex-1 truncate', r.notable ? 'font-semibold' : 'font-medium')}>{r.code.name}</span>
                        <span className="w-24 shrink-0 text-xs text-graphite tabular-nums">
                          {r.people} of {r.of}
                        </span>
                        <span className="flex w-52 shrink-0 items-center gap-2.5">
                          {r.people >= 3 ? (
                            <>
                              <span className="w-16 shrink-0">
                                <BandBar split={{ counts: { Steady: r.steady, 'Some hesitation': r.some, 'Marked hesitation': r.marked }, n: r.people }} />
                              </span>
                              <span className="w-9 shrink-0 text-xs text-graphite tabular-nums">
                                <span className="font-semibold text-ink">{r.marked}</span> of {r.people}
                              </span>
                            </>
                          ) : (
                            <span className="w-[6.5rem] shrink-0" />
                          )}
                          <PatternChip pattern={r.pattern} />
                        </span>
                      </button>
                      <label className="flex w-14 shrink-0 justify-center py-2">
                        <input type="checkbox" checked={r.use} onChange={(e) => setUse(r, e.target.checked)} aria-label={`Put ${r.code.name} signals in the report`} className="accent-[var(--color-iris-600)]" />
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="lg:sticky lg:top-4">{selected ? <CodePanel key={selected.code.id} s={selected} ctx={ctx} tensions={tensionsFor(tensions, selected.code.id)} onOpenTension={onOpenTension} onUse={(on) => setUse(selected, on)} /> : null}</div>
    </div>
  )
}

function CodePanel({ s, ctx, tensions, onUse, onOpenTension }: { s: CodeSignal; ctx: CodebookCtx; tensions: Tension[]; onUse: (on: boolean) => void; onOpenTension: (id: string) => void }) {
  const delay = r1(median(s.points.map((p) => p.facts.delaySec)))
  const usual = r1(median(s.points.map((p) => p.usual)))
  const readable = s.people >= 3
  return (
    <section aria-label={`Signals for ${s.code.name}`} data-testid="signal-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <div className="flex items-center gap-2">
            <PatternChip pattern={s.pattern} />
            <span className="ml-auto text-xs text-graphite">{s.code.isNew ? 'New code' : 'From the guide'}</span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold">{s.code.name}</h2>
          <p className="mt-1 text-sm text-graphite">{s.code.definition}</p>
        </header>

        <div className="border-b border-mist px-5 py-4 text-sm">
          {readable ? (
            <>
              <div className="mb-2.5">
                <BandBar split={{ counts: { Steady: s.steady, 'Some hesitation': s.some, 'Marked hesitation': s.marked }, n: s.people }} tall />
              </div>
              <p>
                Marked hesitation in <span className="font-semibold tabular-nums">{s.marked} of {s.people}</span> people who said it, and some in {s.some} more.
              </p>
              <p className="mt-1 text-graphite tabular-nums">Their answers started a median {delay} s after the question. Their usual is {usual} s.</p>
            </>
          ) : (
            <p>Only {plural(s.people, 'person')} said this, which is too few to read a pattern. Their moments are below.</p>
          )}
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-sm border border-mist px-3 py-2.5">
            <input type="checkbox" checked={s.use} onChange={(e) => onUse(e.target.checked)} className="mt-0.5 accent-[var(--color-iris-600)]" />
            <span>
              <span className="block font-medium">Put these signals in the report</span>
              <span className="block text-xs text-graphite">On by default when the pattern is mixed or hesitant.</span>
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
          </h3>
          <ul className="mt-2 divide-y divide-mist">
            {s.points.map((p) => (
              <PointCard key={p.participantId} point={p} studyId={ctx.studyId} />
            ))}
          </ul>
        </section>
      </div>
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">Measured, not judged. A signal never shows how someone felt, and never changes a Review decision.</footer>
    </section>
  )
}

// ─── by moment ──────────────────────────────────────────────────────────────

function ByMoment({ ctx, moments, focus, setFocus }: { ctx: CodebookCtx; moments: MomentSignal[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void }) {
  const [compare, setCompare] = useState(false)
  const selected = moments.find((m) => m.moment.id === focus.moment) ?? moments.find((m) => m.moment.id === 'm-concept-a') ?? moments[0]
  const most = Math.max(...moments.map((m) => m.all.counts['Marked hesitation'] / (m.all.n || 1)))
  const arrows = useArrows(moments.map((m) => m.moment.id), selected.moment.id, (id) => setFocus({ ...focus, moment: id }), 'data-moment')

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <section aria-label="Signals by moment" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-mist px-4 py-2.5">
          <p className="text-sm text-graphite">Pick a moment to see who hesitated.</p>
          <span className="flex-1" />
          <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2.5 text-sm text-graphite">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="compare-pets" className="accent-[var(--color-iris-600)]" />
            Compare dog and cat owners
          </label>
        </div>
        <div ref={arrows.ref} onKeyDown={arrows.onKeyDown}>
          <ul>
            {moments.map((m) => {
              const isMost = m.all.counts['Marked hesitation'] / (m.all.n || 1) === most && m.all.counts['Marked hesitation'] >= 3
              return (
                <li key={m.moment.id} className={cn('border-b border-mist border-l-2 last:border-b-0', m.moment.id === selected.moment.id ? 'border-l-iris-600 bg-iris-50' : 'border-l-transparent hover:bg-haze')}>
                  <button type="button" data-moment={m.moment.id} onClick={() => setFocus({ ...focus, moment: m.moment.id })} aria-current={m.moment.id === selected.moment.id ? 'true' : undefined} data-testid="moment-row" className="block w-full px-4 py-3 text-left">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{m.moment.label}</span>
                      <span className="text-xs text-graphite">{m.moment.kind === 'stimulus' ? 'First reaction to a concept' : 'Guide question'}</span>
                      {isMost && <span className="rounded-xs border border-iris-600 px-1 text-[11px] font-medium text-iris-700">Most hesitation</span>}
                    </span>
                    {compare ? (
                      <span className="mt-2 flex flex-col gap-1.5">
                        {(
                          [
                            ['Dog owners', m.dog],
                            ['Cat owners', m.cat],
                          ] as const
                        ).map(([label, sp]) => (
                          <span key={label} className="flex items-center gap-3">
                            <span className="w-24 shrink-0 text-xs text-graphite">{label}</span>
                            <span className="flex-1">
                              <BandBar split={sp} />
                            </span>
                            <Counts split={sp} />
                          </span>
                        ))}
                        {Math.min(m.dog.n, m.cat.n) < SMALL_GROUP && <span className="text-xs text-pending-fg">One group has fewer than {SMALL_GROUP} people. Too small to read.</span>}
                      </span>
                    ) : (
                      <span className="mt-2 flex items-center gap-3">
                        <span className="flex-1">
                          <BandBar split={m.all} tall />
                        </span>
                        <Counts split={m.all} />
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
        <MomentPanel key={selected.moment.id} m={selected} ctx={ctx} />
      </div>
    </div>
  )
}

function Counts({ split }: { split: MomentSignal['all'] }) {
  return (
    <span className="w-56 shrink-0 text-right text-xs whitespace-nowrap text-graphite tabular-nums">
      <span className="font-semibold text-ink">{split.counts['Marked hesitation']}</span> marked · {split.counts['Some hesitation']} some · {split.counts.Steady} steady <span className="text-muted">of {split.n}</span>
    </span>
  )
}

function MomentPanel({ m, ctx }: { m: MomentSignal; ctx: CodebookCtx }) {
  const [steady, setSteady] = useState(false)
  const hesitant = m.points.filter((p) => p.band !== 'Steady')
  const calm = m.points.filter((p) => p.band === 'Steady')
  return (
    <section aria-label={m.moment.label} data-testid="moment-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <p className="text-xs text-graphite">{m.moment.kind === 'stimulus' ? 'First reaction to a concept' : 'Guide question'}</p>
          <h2 className="mt-1 text-lg leading-snug font-semibold">{m.moment.label}</h2>
          <p className="mt-1 text-sm text-graphite">“{m.moment.text}”</p>
          <div className="mt-3">
            <BandBar split={m.all} tall />
            <p className="mt-1.5 text-sm tabular-nums">
              <span className="font-semibold">{m.all.counts['Marked hesitation']}</span> marked, {m.all.counts['Some hesitation']} some, {m.all.counts.Steady} steady, of {m.all.n} people asked
            </p>
          </div>
        </header>
        <section aria-label="People" className="px-5 py-4">
          <h3 className="text-sm font-semibold">
            Showed hesitation <span className="font-normal text-graphite tabular-nums">{hesitant.length}</span>
          </h3>
          {hesitant.length ? (
            <ul className="mt-2 divide-y divide-mist">
              {hesitant.map((p) => (
                <PointCard key={p.participantId} point={p} studyId={ctx.studyId} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-graphite">Nobody showed a sign of hesitation here.</p>
          )}
          {calm.length > 0 && (
            <div className="mt-4 border-t border-mist pt-3">
              <button type="button" aria-expanded={steady} onClick={() => setSteady((x) => !x)} className="text-sm font-medium text-iris-700 hover:underline">
                {steady ? 'Hide steady answers' : `Show ${calm.length} steady ${calm.length === 1 ? 'answer' : 'answers'}`}
              </button>
              {steady && (
                <ul className="mt-2 divide-y divide-mist">
                  {calm.map((p) => (
                    <PointCard key={p.participantId} point={p} studyId={ctx.studyId} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">Measured, not judged. A signal never shows how someone felt, and never changes a Review decision.</footer>
    </section>
  )
}
