import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { MOMENTS, SMALL_GROUP, codeSignals, momentSignals, plural, signalGroups, type CodeSignal, type MomentSignal } from '@/state/signals'
import { setSignalPick } from '@/state/codebook'
import { BandBar, BandLegend, PatternChip, PointCard } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'

type View = 'code' | 'moment'
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const r1 = (x: number) => Math.round(x * 10) / 10

/** How they said it: the same accepted codes, now with what was measured when they said them. */
export function SignalsTab({ ctx, onOpenTensions }: { ctx: CodebookCtx; onOpenTensions: () => void }) {
  const [view, setView] = useState<View>('code')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Read signals" className="flex rounded-sm border border-mist-strong p-0.5">
          {(
            [
              ['code', 'By code'],
              ['moment', 'By moment'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} data-testid={`view-${v}`} className={cn('h-7 rounded-xs px-3 text-sm', view === v ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-sm text-graphite">{view === 'code' ? 'The accepted codes, with how steady people were when they said them.' : 'Each key moment in the interview, with how steady everyone was.'}</p>
      </div>
      {view === 'code' ? <ByCode ctx={ctx} onOpenTensions={onOpenTensions} /> : <ByMoment ctx={ctx} />}
    </div>
  )
}

// ─── by code ────────────────────────────────────────────────────────────────

function ByCode({ ctx, onOpenTensions }: { ctx: CodebookCtx; onOpenTensions: () => void }) {
  const { doc, basis, me } = ctx
  const toast = useToast()
  const [notableOnly, setNotableOnly] = useState(false)
  const [picked, setPicked] = useState<string>()
  const signals = useMemo(() => codeSignals(doc, basis), [doc, basis])
  const groups = useMemo(() => signalGroups(doc, notableOnly ? signals.filter((s) => s.notable) : signals), [doc, signals, notableOnly])
  const flat = groups.flatMap((g) => g.rows)
  // Opens on the code with the strongest pattern, so the first thing seen is the thing worth seeing.
  const strongest = [...flat].filter((r) => r.notable).sort((a, b) => b.marked / b.people - a.marked / a.people)[0]
  const selected = flat.find((r) => r.code.id === picked) ?? strongest ?? flat[0]
  const notable = signals.filter((s) => s.notable).length

  if (!signals.length) return <div className="rounded-md border border-dashed border-mist-strong bg-surface"><EmptyState title="No accepted codes" description="Signals are measured on the codes you’ve accepted. Accept some in the codebook first." /></div>

  const setUse = (s: CodeSignal, on: boolean) => {
    ctx.act((d) => setSignalPick(d, s.code, on, { by: me }))
    toast(on ? `“${s.code.name}” signals will go in the report` : `“${s.code.name}” signals left out of the report`)
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <section aria-label="Signals by code" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{notable}</span> {notable === 1 ? 'code has' : 'codes have'} a pattern worth a look
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
          <div>
            <div className="hidden items-center gap-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:flex">
              <span className="flex-1">Code</span>
              <span className="w-28">Said by</span>
              <span className="w-40">Hesitation</span>
              <span className="w-16 text-center">In report</span>
            </div>
            {groups.map((g) => (
              <section key={g.id} aria-labelledby={`sg-${g.id}`} className="border-b border-mist last:border-0">
                <h3 id={`sg-${g.id}`} className="px-4 pt-3.5 pb-1.5 text-sm font-semibold">
                  {g.name}
                </h3>
                <ul className="pb-2">
                  {g.rows.map((r) => (
                    <li key={r.code.id} className={cn('flex items-center border-l-2 pr-4', r.code.id === selected?.code.id ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}>
                      <button type="button" onClick={() => setPicked(r.code.id)} aria-current={r.code.id === selected?.code.id ? 'true' : undefined} data-testid="signal-row" className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium">{r.code.name}</span>
                        <span className="flex w-28 shrink-0 items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-haze" aria-hidden="true">
                            <span className="block h-full rounded-full bg-graphite/50" style={{ width: `${r.of ? (r.people / r.of) * 100 : 0}%` }} />
                          </span>
                          <span className="w-12 text-right text-xs text-graphite tabular-nums">{r.people} of {r.of}</span>
                        </span>
                        <span className="flex w-40 shrink-0 items-center gap-2">
                          <span className="w-10 text-xs text-graphite tabular-nums">{r.people >= 3 ? `${r.marked} of ${r.people}` : '—'}</span>
                          <PatternChip pattern={r.pattern} />
                        </span>
                      </button>
                      <label className="flex w-16 shrink-0 justify-center py-2">
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

      <div className="lg:sticky lg:top-4">{selected ? <CodePanel key={selected.code.id} s={selected} ctx={ctx} onOpenTensions={onOpenTensions} onUse={(on) => setUse(selected, on)} /> : null}</div>
    </div>
  )
}

function CodePanel({ s, ctx, onUse, onOpenTensions }: { s: CodeSignal; ctx: CodebookCtx; onUse: (on: boolean) => void; onOpenTensions: () => void }) {
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
              <p>
                Marked hesitation in <span className="font-semibold tabular-nums">{s.marked} of {s.people}</span> people who said it, and some in {s.some} more.
              </p>
              <p className="mt-1 text-graphite tabular-nums">
                Their answers started a median {delay} s after the question. Their usual is {usual} s.
              </p>
            </>
          ) : (
            <p>
              Only {plural(s.people, 'person')} said this, which is too few to read a pattern. Their moments are below.
            </p>
          )}
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-sm border border-mist px-3 py-2.5">
            <input type="checkbox" checked={s.use} onChange={(e) => onUse(e.target.checked)} className="mt-0.5 accent-[var(--color-iris-600)]" />
            <span>
              <span className="block font-medium">Put these signals in the report</span>
              <span className="block text-xs text-graphite">On by default when the pattern is mixed or hesitant.</span>
            </span>
          </label>
        </div>

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
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">
        Measured, not judged. A signal never shows how someone felt, and never changes a Review decision.{' '}
        <button type="button" onClick={onOpenTensions} className="font-medium text-iris-700 hover:underline">
          See tensions
        </button>
      </footer>
    </section>
  )
}

// ─── by moment ──────────────────────────────────────────────────────────────

function ByMoment({ ctx }: { ctx: CodebookCtx }) {
  const [compare, setCompare] = useState(false)
  const [picked, setPicked] = useState<string>(() => MOMENTS.find((m) => m.id === 'm-concept-a')?.id ?? MOMENTS[0].id)
  const moments = useMemo(() => momentSignals(ctx.basis), [ctx.basis])
  const selected = moments.find((m) => m.moment.id === picked) ?? moments[0]

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
      <section aria-label="Signals by moment" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-mist px-4 py-3">
          <BandLegend />
          <span className="flex-1" />
          <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2.5 text-sm text-graphite">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="compare-pets" className="accent-[var(--color-iris-600)]" />
            Compare dog and cat owners
          </label>
        </div>
        <ul>
          {moments.map((m) => (
            <li key={m.moment.id} className={cn('border-b border-mist border-l-2 last:border-b-0', m.moment.id === selected.moment.id ? 'border-l-iris-600 bg-iris-50' : 'border-l-transparent hover:bg-haze')}>
              <button type="button" onClick={() => setPicked(m.moment.id)} aria-current={m.moment.id === selected.moment.id ? 'true' : undefined} data-testid="moment-row" className="block w-full px-4 py-3 text-left">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{m.moment.label}</span>
                  <span className="text-xs text-graphite">{m.moment.kind === 'stimulus' ? 'First reaction to a concept' : 'Guide question'}</span>
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
                        <span className="flex-1"><BandBar split={sp} /></span>
                        <Counts split={sp} />
                      </span>
                    ))}
                    {Math.min(m.dog.n, m.cat.n) < SMALL_GROUP && <span className="text-xs text-pending-fg">One group has fewer than {SMALL_GROUP} people. Too small to read.</span>}
                  </span>
                ) : (
                  <span className="mt-2 flex items-center gap-3">
                    <span className="flex-1"><BandBar split={m.all} tall /></span>
                    <Counts split={m.all} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="lg:sticky lg:top-4">
        <MomentPanel key={selected.moment.id} m={selected} ctx={ctx} />
      </div>
    </div>
  )
}

function Counts({ split }: { split: MomentSignal['all'] }) {
  return (
    <span className="w-52 shrink-0 text-right text-xs whitespace-nowrap text-graphite tabular-nums">
      <span className="font-semibold text-ink">{split.counts['Marked hesitation']}</span> marked · {split.counts['Some hesitation']} some · {split.counts.Steady} steady
      <span className="block text-[11px]">of {split.n}</span>
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
