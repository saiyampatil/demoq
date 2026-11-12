import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { cn } from '@/components/cn'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { setSignalPick, setThemePick } from '@/state/codebook'
import { EMOTIONS, noReading, topEmotions } from '@/state/emotion'
import { THEME_RULE_TEXT, stanceSummary, tensionsFor, type Tension, type ThemeSignal } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import { BandBar, EmotionBar, EmotionChip, FitChip, PointCard, ToneBar, ValenceCounts, playHref } from './SignalBits'
import { ChannelRow, emotionSummary, emotionSummaryTitle, useArrows, type SignalFocus } from './SignalsTab'
import type { CodebookCtx } from './codebookCtx'

/** Face, voice and hesitation for one theme, each as "n of N" on the same people. Said out loud when someone is left out. */
function Facts({ t }: { t: ThemeSignal }) {
  const off = t.tones.counts.Flat + t.tones.counts.Tense
  const gap = noReading(t.emotions)
  const stance = stanceSummary(t)
  const item = (label: string, value: React.ReactNode, title?: string) => (
    <span className="whitespace-nowrap" title={title}>
      <span className="font-medium text-ink">{label}</span> {value}
    </span>
  )
  return (
    <span className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-graphite tabular-nums" data-testid="theme-facts">
      {item('Words', <>{stance.short}{t.fit.n < t.people && t.fit.n > 0 ? ` (${t.fit.n} of ${t.people} with a claim)` : ''}</>, stance.long)}
      {item('Face', <>{emotionSummary(t.emotions)}{gap ? ` (${gap})` : ''}</>, emotionSummaryTitle(t.emotions))}
      {item('Voice', <><span className="font-semibold text-ink">{off}</span> of {t.tones.n} flat or tense</>)}
      {item('Hesitation', <><span className="font-semibold text-ink">{t.marked}</span> of {t.people} marked</>)}
    </span>
  )
}

/** The accepted themes with their signals, one result each. A row opens to its codes and their own verdicts. */
export function ByTheme({ ctx, themes, tensions, focus, setFocus, onOpenTension }: { ctx: CodebookCtx; themes: ThemeSignal[]; tensions: Tension[]; focus: SignalFocus; setFocus: (f: SignalFocus) => void; onOpenTension: (id: string) => void }) {
  const toast = useToast()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const own = themes.filter((t) => t.kind !== 'tension')
  const fromTension = themes.filter((t) => t.kind === 'tension')
  const flat = [...own, ...fromTension]
  const strongest = [...flat].filter((t) => t.notable).sort((a, b) => (b.fit.doesnt + b.fit.partly) / (b.fit.n || 1) - (a.fit.doesnt + a.fit.partly) / (a.fit.n || 1) || b.marked / (b.people || 1) - a.marked / (a.people || 1))[0]
  const selected = flat.find((t) => t.id === focus.theme) ?? strongest ?? flat[0]
  const arrows = useArrows(flat.map((t) => t.id), selected?.id, (id) => setFocus({ ...focus, theme: id }), 'data-theme')
  const inReport = themes.filter((t) => t.use).length
  const tickable = themes.filter((t) => t.tickable).length

  if (!flat.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted themes" description="Signals are read on the themes you build in the codebook. Accept a code and group it into a theme first." />
      </div>
    )

  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  const tick = (t: ThemeSignal, on: boolean) => {
    if (!t.theme) return
    ctx.act((d) => setThemePick(d, t.theme!, on, { by: ctx.me }))
    toast(on ? `“${t.name}” profile will go in the report` : `“${t.name}” profile left out of the report`)
  }
  const tickCode = (name: string, id: string, on: boolean) => {
    ctx.act((d) => setSignalPick(d, { id, name }, on, { by: ctx.me }))
    toast(on ? `“${name}” signals will go in the report` : `“${name}” signals left out of the report`)
  }

  const row = (t: ThemeSignal) => {
    const isSel = t.id === selected?.id
    const isOpen = open.has(t.id)
    return (
      <li key={t.id} className={cn('border-l-2', isSel ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')} data-testid="theme-signal-item">
        <div className="flex items-start gap-1 pr-3">
          <button type="button" onClick={() => toggle(t.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} the codes in ${t.name}`} data-testid="theme-expand" className="mt-3 ml-2 shrink-0 rounded-xs p-1 text-graphite hover:bg-mist hover:text-ink">
            <span className={cn('block transition-transform', isOpen && 'rotate-90')}>
              <ChevronRightIcon size={12} />
            </span>
          </button>
          <button type="button" data-theme={t.id} data-verdict={t.verdict} onClick={() => setFocus({ ...focus, theme: t.id })} aria-current={isSel ? 'true' : undefined} data-testid="theme-signal-row" className="min-w-0 flex-1 py-2.5 pl-1 text-left">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={cn('min-w-0 flex-1 text-sm', t.notable ? 'font-semibold' : 'font-medium')}>
                {t.name}
                {t.kind === 'tension' && <span className="ml-2 inline-flex h-5 items-center rounded-xs border border-iris-100 bg-iris-50 px-1.5 align-middle text-xs font-medium text-iris-700">From a tension</span>}
              </span>
              <span className="shrink-0 text-xs text-graphite tabular-nums" data-testid="theme-said-by">
                Said by {t.people} of {t.of}
              </span>
              <span className="w-[6.5rem] shrink-0" data-testid="theme-verdict">
                <FitChip pattern={t.verdict} />
              </span>
            </span>
            <Facts t={t} />
            <span className="mt-1 block text-xs text-graphite" data-testid="theme-headline">
              {t.headline}
            </span>
          </button>
          <label className="flex w-14 shrink-0 justify-center py-3" title={t.tickable ? (t.readable ? undefined : 'Too few people to put in the report') : t.kind === 'tension' ? 'A tension theme goes in the report as a tension' : 'Tick the codes below, one at a time'}>
            {t.tickable ? (
              <input type="checkbox" checked={t.use} disabled={!t.readable} onChange={(e) => tick(t, e.target.checked)} aria-label={`Put the ${t.name} profile in the report`} className="accent-[var(--color-iris-600)] disabled:opacity-40" data-testid="use-theme" />
            ) : (
              <span className="text-xs text-muted" aria-hidden="true">
                —
              </span>
            )}
          </label>
        </div>
        {isOpen && (
          <ul className="mb-2 ml-9 mr-3 divide-y divide-mist rounded-sm border border-mist bg-surface" aria-label={`Codes in ${t.name}`} data-testid="theme-codes">
            {t.codes.map((c) => (
              <li key={c.code.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.code.name}</span>
                <span className="text-xs text-graphite tabular-nums">
                  {c.people} of {c.of}
                </span>
                <span className="w-[5.75rem] shrink-0">
                  <FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />
                </span>
                {t.kind === 'none' && (
                  <input type="checkbox" checked={c.use} disabled={!c.readable} onChange={(e) => tickCode(c.code.name, c.code.id, e.target.checked)} aria-label={`Put ${c.code.name} signals in the report`} className="accent-[var(--color-iris-600)] disabled:opacity-40" />
                )}
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <section aria-label="Signals by theme" className="min-w-0 rounded-md border border-mist bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-mist px-4 py-2.5">
          <p className="text-sm text-graphite">
            <span className="font-semibold text-ink tabular-nums">{inReport}</span> of {tickable} themes in the report
          </p>
          <span className="flex-1" />
          <span className="text-xs text-graphite">Face, voice and hesitation together, on the same people</span>
        </div>
        <p className="border-b border-mist bg-haze px-4 py-1.5 text-xs text-graphite" data-testid="theme-rule">
          <span className="font-medium text-ink">Verdict, by theme.</span> {THEME_RULE_TEXT}
        </p>
        <div ref={arrows.ref} onKeyDown={arrows.onKeyDown}>
          <ul className="divide-y divide-mist" data-testid="theme-list">
            {own.map(row)}
          </ul>
          {fromTension.length > 0 && (
            <section aria-labelledby="tension-themes" className="border-t border-mist">
              <header className="px-4 pt-3 pb-1">
                <h3 id="tension-themes" className="text-sm font-semibold">
                  Tension themes
                </h3>
                <p className="text-xs text-graphite">Made from a tension in the Tensions tab. They are read on the codes they draw on, which stay in their own themes.</p>
              </header>
              <ul className="divide-y divide-mist" data-testid="tension-theme-list">
                {fromTension.map(row)}
              </ul>
            </section>
          )}
        </div>
      </section>
      <div className="lg:sticky lg:top-4">{selected ? <ThemePanel key={selected.id} t={selected} ctx={ctx} tensions={tensions} onOpenTension={onOpenTension} onTick={(on) => tick(selected, on)} /> : null}</div>
    </div>
  )
}

/** One theme's profile: the headline, the evidence on every channel, its codes with their verdicts, and the quotes. */
function ThemePanel({ t, ctx, tensions, onTick, onOpenTension }: { t: ThemeSignal; ctx: CodebookCtx; tensions: Tension[]; onTick: (on: boolean) => void; onOpenTension: (id: string) => void }) {
  const e = t.emotions
  const tops = topEmotions(e)
  const off = t.tones.counts.Flat + t.tones.counts.Tense
  const against = t.fit.doesnt + t.fit.partly
  const stance = stanceSummary(t)
  const related = useMemo(() => {
    const seen = new Map<string, Tension>()
    t.codes.forEach((c) => tensionsFor(tensions, c.code.id).forEach((x) => seen.set(x.id, x)))
    return [...seen.values()]
  }, [t.codes, tensions])
  const shown = t.verdict === 'Conflicting' ? related : related
  return (
    <section aria-label={`Profile of ${t.name}`} data-testid="theme-panel" data-theme={t.id} className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <FitChip pattern={t.verdict} />
            {t.kind === 'tension' && <span className="inline-flex h-5 items-center rounded-xs border border-iris-100 bg-iris-50 px-1.5 text-xs font-medium text-iris-700">From a tension</span>}
            <span className="ml-auto text-xs text-graphite">{t.kind === 'tension' ? 'Tension theme' : t.kind === 'none' ? 'No theme yet' : 'Theme'}</span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold">{t.name}</h2>
          {t.definition && <p className="mt-1 text-sm text-graphite">{t.definition}</p>}
          <p className="mt-2 text-xs text-graphite tabular-nums">
            Said by {t.people} of {t.of}
          </p>
        </header>

        <div className="border-b border-mist px-5 py-3.5" data-testid="theme-headline-block">
          <p className="flex items-center gap-2">
            <AIGeneratedTag />
            <span className="text-xs text-graphite">Built from the numbers below</span>
          </p>
          <p className="mt-1.5 text-sm font-medium text-ink" data-testid="theme-headline-text">
            {t.headline}
          </p>
          {t.play && (
            <Link to={playHref(ctx.studyId, t.play.sessionId, t.play.atSec)} className="mt-1.5 inline-flex items-center gap-1 rounded-xs text-xs font-medium text-iris-700 hover:underline" data-testid="theme-play" aria-label={`Play ${t.play.participantId} at ${mmss(t.play.atSec)}`}>
              <PlayIcon size={11} /> Play the clearest moment · {t.play.participantId} at {mmss(t.play.atSec)}
            </Link>
          )}
          <p className="mt-2 text-xs text-graphite" data-testid="theme-trace">
            {t.trace}
          </p>
        </div>

        {t.readable ? (
          <div className="border-b border-mist px-5 py-3" data-testid="theme-channels">
            {t.fit.n > 0 && (
              <p className={cn('mb-2 rounded-sm px-3 py-2 text-sm', against ? 'bg-pending-bg text-pending-fg' : 'bg-haze text-graphite')} data-testid="theme-fit-verdict">
                {against ? (
                  <>
                    <span className="font-semibold">
                      For {against} of {t.fit.n},
                    </span>{' '}
                    the face, voice or hesitation pulled against the words{t.fit.doesnt > 0 && <> ({t.fit.doesnt} clearly)</>}.
                  </>
                ) : (
                  <>How they said it fits the words for all {t.fit.n}.</>
                )}
              </p>
            )}
            <dl className="divide-y divide-mist">
              <ChannelRow label="Words">{stance.long}</ChannelRow>
              <ChannelRow label="Face" bar={<EmotionBar split={e} tall />} testid="theme-face">
                {tops.length ? (
                  <span className="font-semibold tabular-nums">{tops.length === 1 ? `${e.counts[tops[0]]} of ${e.read} faces read as ${tops[0].toLowerCase()}.` : `${tops.map((x) => x.toLowerCase()).join(' and ')} tie: ${e.counts[tops[0]]} of ${e.read} faces each.`}</span>
                ) : (
                  'No faces read.'
                )}
                {noReading(e) && (
                  <span className="text-graphite">
                    {' '}
                    {e.read} of {t.people} people had a face read ({noReading(e)}).
                  </span>
                )}
                {e.read > 0 && (
                  <span className="mt-1 block text-xs text-graphite">
                    <ValenceCounts e={e} /> <span className="tabular-nums">of {e.read} read</span>
                  </span>
                )}
                {e.read > 0 && (
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-xs text-graphite">Reads as</span>
                    {EMOTIONS.filter((x) => e.counts[x]).map((x) => (
                      <span key={x} className="inline-flex items-center gap-1 text-xs text-graphite tabular-nums">
                        <EmotionChip emotion={x} /> {e.counts[x]}
                      </span>
                    ))}
                  </span>
                )}
              </ChannelRow>
              <ChannelRow label="Voice" bar={<ToneBar split={t.tones} tall />}>
                <span className="font-semibold tabular-nums">
                  Flat or tense for {off} of {t.tones.n}.
                </span>{' '}
                <span className="text-graphite">Animated {t.tones.counts.Animated}, even {t.tones.counts.Even}.</span>
              </ChannelRow>
              <ChannelRow label="Hesitation" bar={<BandBar split={{ counts: { Steady: t.steady, 'Some hesitation': t.some, 'Marked hesitation': t.marked }, n: t.people }} tall />}>
                <span className="font-semibold tabular-nums">Marked in {t.marked} of {t.people},</span> some in {t.some}.
              </ChannelRow>
            </dl>
          </div>
        ) : (
          <p className="border-b border-mist px-5 py-3 text-sm">Only {t.people} {t.people === 1 ? 'person' : 'people'} said this, which is too few to read a pattern or put in the report. Their moments are below.</p>
        )}

        {t.tickable && (
          <label className={cn('mx-5 my-3 flex items-start gap-2.5 rounded-sm border border-mist px-3 py-2.5', t.readable ? 'cursor-pointer' : 'opacity-60')}>
            <input type="checkbox" checked={t.use} disabled={!t.readable} onChange={(ev) => onTick(ev.target.checked)} className="mt-0.5 accent-[var(--color-iris-600)]" data-testid="use-theme-panel" />
            <span>
              <span className="block text-sm font-medium">Put this theme’s profile in the report</span>
              <span className="block text-xs text-graphite">{t.readable ? 'On by default when hesitation shows, or words and delivery don’t fit.' : 'Needs at least three people.'}</span>
            </span>
          </label>
        )}

        <section aria-label="Codes in this theme" className="border-b border-mist px-5 py-3.5">
          <h3 className="text-sm font-semibold">Codes</h3>
          <ul className="mt-1.5 divide-y divide-mist" data-testid="theme-panel-codes">
            {t.codes.map((c) => (
              <li key={c.code.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1">{c.code.name}</span>
                <span className="text-xs text-graphite tabular-nums">
                  {c.people} of {c.of}
                </span>
                <FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />
              </li>
            ))}
          </ul>
        </section>

        {shown.length > 0 && (
          <section aria-label="Related tension" className="border-b border-mist px-5 py-3.5">
            <h3 className="text-sm font-semibold">{t.verdict === 'Conflicting' ? 'The related tension' : 'Related tension'}</h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {shown.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => onOpenTension(x.id)} data-testid="theme-tension" className="group flex w-full items-start gap-1.5 rounded-xs text-left text-sm text-iris-700 hover:underline">
                    <span className="min-w-0 flex-1">{x.title}</span>
                    <span className="mt-0.5 shrink-0 text-xs text-graphite">{x.status === 'Suggested' ? 'To review' : x.status}</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="People" className="px-5 py-4">
          <h3 className="text-sm font-semibold">
            Moments <span className="font-normal text-graphite tabular-nums">{t.points.length}</span>
            <span className="ml-2 text-xs font-normal text-graphite">Each person once, at the quote where their delivery fit the words least</span>
          </h3>
          <ul className="mt-2 divide-y divide-mist">
            {t.points.map((p) => (
              <PointCard key={p.participantId} point={p} ctx={ctx} context={t.name} reasons />
            ))}
          </ul>
        </section>
      </div>
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite">Computed from the codebook and Review each time. Only your ticks are saved. Nothing here changes a Review decision.</footer>
    </section>
  )
}
