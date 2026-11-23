import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { PlayIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import { band as confidenceBand, correctFace } from '@/state/codebook'
import { EMOTION_HINT, EMOTIONS, STANCE_LABEL, TONE_HINT, TONES, VALENCE, VALENCE_WORD, VALENCES, faceOf, fitOf, noReading, type Emotion, type EmotionSplit, type Face, type Fit, type FitPattern, type Tone, type ToneSplit } from '@/state/emotion'
import { DELIVERY_RULE_LINES, FIT_COLOUR, FIT_DEF, FIT_LABEL, FIT_ORDER, VERDICT_COLOUR, VERDICT_DEF, VERDICT_LABEL, VERDICT_ORDER, SIDE_DEF, SIDE_LABEL, describedLine, sideGroupHead, sideGroupLine, RAISED_TIP, verdictLabel, type Chip, type FitKey } from '@/config/delivery'
import { sideSummary, hesitantDelivery, segmentLabelOf, signsOf, type Band, type Pattern, type PersonRead, type Point, type Split } from '@/state/signals'
import { BANDS } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import type { CodebookCtx } from './codebookCtx'

// ─── hesitation ─────────────────────────────────────────────────────────────

/** One hue at three strengths, so a band is never read as good or bad by its colour. */
export const BAND_CHIP: Record<Band, string> = {
  Steady: 'border-mist-strong bg-haze text-graphite',
  'Some hesitation': 'border-iris-100 bg-iris-50 text-iris-700',
  'Marked hesitation': 'border-iris-600 bg-iris-600 text-white',
}
const BAND_FILL: Record<Band, string> = { Steady: 'bg-mist-strong', 'Some hesitation': 'bg-iris-300', 'Marked hesitation': 'bg-iris-600' }
/** A Face or Speech reading: a dot in its own colour and plain text, never a filled pill. Only a verdict or a match chip is a pill. */
const readingBase = 'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-ink'

export function BandChip({ band, className }: { band: Band; className?: string }) {
  return (
    <span className={cn(readingBase, className)} data-reading="certainty">
      <span aria-hidden="true" className={cn('size-2 rounded-full', BAND_FILL[band])} />
      {band}
    </span>
  )
}

/** The certainty of a code's speech, named "Certainty: mixed" so it is never read as a verdict. A dot, not a pill. */
export function PatternChip({ pattern }: { pattern: Pattern }) {
  const fill = pattern === 'Often hesitant' ? BAND_FILL['Marked hesitation'] : pattern === 'Mixed' ? BAND_FILL['Some hesitation'] : pattern === 'Mostly steady' ? BAND_FILL.Steady : 'border border-dashed border-mist-strong bg-surface'
  return (
    <span className={readingBase} data-reading="certainty" data-testid="certainty-tag">
      <span aria-hidden="true" className={cn('size-2 rounded-full', fill)} />
      Certainty: {pattern.toLowerCase()}
    </span>
  )
}

/** Marked, some and steady as one bar. Counts are written beside it, so the colour never carries the meaning alone. */
export function BandBar({ split, tall }: { split: Split; tall?: boolean }) {
  const label = BANDS.slice()
    .reverse()
    .map((b) => `${split.counts[b]} ${b.toLowerCase()}`)
    .join(', ')
  return (
    <div className={cn('flex overflow-hidden rounded-full bg-haze', tall ? 'h-3.5' : 'h-2')} role="img" aria-label={`${label}, of ${split.n}`}>
      {BANDS.slice()
        .reverse()
        .map((b) => (split.counts[b] ? <span key={b} className={cn('h-full', BAND_FILL[b])} style={{ width: `${(split.counts[b] / split.n) * 100}%` }} title={`${split.counts[b]} ${b.toLowerCase()}`} /> : null))}
    </div>
  )
}

function Legend({ items }: { items: { label: string; fill: string; hint?: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-graphite" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5" title={i.hint}>
          <span aria-hidden="true" className={cn('size-2.5 rounded-xs', i.fill)} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function BandLegend() {
  return <Legend items={BANDS.slice().reverse().map((b) => ({ label: b, fill: BAND_FILL[b] }))} />
}

// ─── emotion ────────────────────────────────────────────────────────────────

export const EMOTION_FILL: Record<Emotion, string> = {
  Delight: 'bg-emo-delight',
  Interest: 'bg-emo-interest',
  Surprise: 'bg-emo-surprise',
  Neutral: 'bg-emo-neutral',
  Confusion: 'bg-emo-confusion',
  Doubt: 'bg-emo-doubt',
  Frustration: 'bg-emo-frustration',
}

/**
 * An emotion with its strength. `reads` writes it as an interpretation ("reads as Doubt"), which is how every single
 * face reading is shown. Surprise reads as in between, so it takes the sand tone rather than positive or negative.
 */
export function EmotionChip({ emotion, intensity, corrected, reads, className }: { emotion: Emotion | null; intensity?: string; corrected?: boolean; reads?: boolean; className?: string }) {
  if (!emotion)
    return (
      <span className={cn(readingBase, 'font-normal text-muted', className)} data-reading="face">
        <span aria-hidden="true" className="size-2 rounded-full border border-dashed border-mist-strong" />
        No clear expression
      </span>
    )
  return (
    <span className={cn(readingBase, className)} title={EMOTION_HINT[emotion]} data-reading="face">
      <span aria-hidden="true" className={cn('size-2 rounded-full', EMOTION_FILL[emotion])} />
      {reads && <span className="font-normal">reads as</span>}
      {emotion}
      {intensity && emotion !== 'Neutral' && <span className="font-normal text-graphite">· {intensity.toLowerCase()}</span>}
      {corrected && <span className="font-normal text-graphite">· corrected</span>}
    </span>
  )
}

/** Every emotion among the faces read, warm to cold. Who had no video is written beside it, never drawn as neutral. */
export function EmotionBar({ split, tall }: { split: EmotionSplit; tall?: boolean }) {
  const label = EMOTIONS.filter((e) => split.counts[e]).map((e) => `${split.counts[e]} ${e.toLowerCase()}`).join(', ')
  if (!split.read) return <div className={cn('rounded-full border border-dashed border-mist-strong', tall ? 'h-3.5' : 'h-2')} role="img" aria-label="No faces read" />
  return (
    <div className={cn('flex overflow-hidden rounded-full bg-haze', tall ? 'h-3.5' : 'h-2')} role="img" aria-label={`${label}, of ${split.read} faces read`}>
      {EMOTIONS.map((e) => (split.counts[e] ? <span key={e} className={cn('h-full', EMOTION_FILL[e])} style={{ width: `${(split.counts[e] / split.read) * 100}%` }} title={`${split.counts[e]} ${e.toLowerCase()}`} /> : null))}
    </div>
  )
}

export function EmotionLegend() {
  return <Legend items={EMOTIONS.map((e) => ({ label: e, fill: EMOTION_FILL[e], hint: EMOTION_HINT[e] }))} />
}

/** How the seven labels are grouped, written out once so the counts everywhere ("3 positive, 2 negative") can be traced. */
export function ValenceKey() {
  return (
    <p className="text-xs text-graphite" data-testid="valence-key">
      <span className="font-medium text-ink">Grouped as</span>{' '}
      {VALENCES.map((v, i) => (
        <span key={v}>
          {i > 0 && ' · '}
          <span className="font-medium">{VALENCE_WORD[v]}</span>: {EMOTIONS.filter((e) => VALENCE[e] === v).join(', ')}
        </span>
      ))}
      . Confusion is shown on its own: it is never counted as negative, and never for or against the words.
    </p>
  )
}

/** The four groups as counts: positive, neutral, negative, then unclear set apart, so they add up to the faces read. */
export function ValenceCounts({ e, className }: { e: EmotionSplit; className?: string }) {
  return (
    <span className={cn('tabular-nums', className)} data-testid="valence-counts">
      <span className="font-semibold text-emo-warm-fg">{e.valence.Positive}</span> positive · {e.valence.Neutral} neutral · <span className="font-semibold text-emo-cold-fg">{e.valence.Negative}</span> negative <span className="text-muted">·</span> <span className="italic">{e.valence.Unclear} unclear</span>
    </span>
  )
}


// ─── voice ──────────────────────────────────────────────────────────────────

const TONE_FILL: Record<Tone, string> = { Animated: 'bg-tone-animated', Even: 'bg-tone-even', Flat: 'bg-tone-flat', Tense: 'bg-tone-tense' }

export function ToneChip({ tone }: { tone: Tone }) {
  return (
    <span className={readingBase} title={TONE_HINT[tone]} data-reading="tone">
      <span aria-hidden="true" className={cn('size-2 rounded-full', TONE_FILL[tone])} />
      {tone}
    </span>
  )
}

export function ToneBar({ split, tall }: { split: ToneSplit; tall?: boolean }) {
  return (
    <div className={cn('flex overflow-hidden rounded-full bg-haze', tall ? 'h-3.5' : 'h-2')} role="img" aria-label={`${TONES.map((t) => `${split.counts[t]} ${t.toLowerCase()}`).join(', ')}, of ${split.n}`}>
      {TONES.map((t) => (split.counts[t] ? <span key={t} className={cn('h-full', TONE_FILL[t])} style={{ width: `${(split.counts[t] / split.n) * 100}%` }} title={`${split.counts[t]} ${t.toLowerCase()}`} /> : null))}
    </div>
  )
}

export function ToneLegend() {
  return <Legend items={TONES.map((t) => ({ label: t, fill: TONE_FILL[t], hint: TONE_HINT[t] }))} />
}

/**
 * Every colour on the page, in three labelled rows so face and speech are never read as one set: Face (what showed on the face),
 * Speech · tone (how the voice sounded), Speech · certainty (hesitation). No colour is shared between rows.
 */
export function SignalLegend() {
  const rows: { group: string; label: string; node: React.ReactNode }[] = [
    { group: 'face', label: 'Face', node: <EmotionLegend /> },
    { group: 'tone', label: 'Speech · tone', node: <ToneLegend /> },
    { group: 'certainty', label: 'Speech · certainty', node: <BandLegend /> },
  ]
  return (
    <div className="flex flex-col gap-1.5 border-b border-mist bg-paper px-4 py-2.5" data-testid="legend" role="group" aria-label="What the colours mean">
      {rows.map((r) => (
        <div key={r.group} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-3" data-testid="legend-row" data-group={r.group}>
          <span className="text-xs font-semibold text-ink">{r.label}</span>
          {r.node}
        </div>
      ))}
    </div>
  )
}

// ─── words vs delivery ──────────────────────────────────────────────────────

/** The five icons: check, tilde, alert, dash, dotted circle. Colour is never the only carrier of a verdict. */
function VerdictIcon({ kind }: { kind: FitPattern | FitKey }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, 'data-icon': kind }
  switch (kind) {
    case 'Consistent':
    case 'Matches':
      return <svg {...common}><path d="m2.5 6.4 2.3 2.3 4.7-5" /></svg>
    case 'Mixed':
      return <svg {...common}><path d="M1.8 6.6c1.2-2 2.4-2 3.6-.6s2.4 1.4 3.6-.6" transform="translate(.4 0)" /></svg>
    case 'Conflicting':
      return <svg {...common}><path d="M6 1.8 11 10.2H1z" /><path d="M6 5v2.4M6 8.9v.1" /></svg>
    case 'No claim':
      return <svg {...common}><path d="M2.8 6h6.4" /></svg>
    case 'Too few to read':
      return <svg {...common} strokeDasharray="1.6 1.9"><circle cx="6" cy="6" r="4" /></svg>
    case 'Pulls against':
      return <svg {...common}><path d="m3 3 6 6M9 3 3 9" /></svg>
    case 'Uncertain':
      return <svg {...common}><path d="M2.4 6h.1M6 6h.1M9.5 6h.1" strokeWidth={2.2} /></svg>
  }
}

const pillStyle = (c: Chip) => ({ background: c.bg, color: c.fg, borderColor: c.line, borderStyle: c.dotted ? ('dotted' as const) : ('solid' as const) })
const pillBase = 'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs font-medium whitespace-nowrap'

/** The row verdict: a filled pill with an icon and its label, and its one-line definition as the tooltip. The only pill on the table. */
export function FitChip({ pattern, label }: { pattern: FitPattern; label?: string }) {
  return (
    <span className={pillBase} style={pillStyle(VERDICT_COLOUR[pattern])} title={`${VERDICT_LABEL[pattern]}: ${VERDICT_DEF[pattern]}`} data-verdict-chip={pattern} data-testid="verdict-pill">
      <VerdictIcon kind={pattern} />
      {label ? `${label} · ${verdictLabel(pattern)}` : verdictLabel(pattern)}
    </span>
  )
}

/** One person against their words: Matched, No match or Hesitant, in the same filled pill, icon and tooltip. */
export function OneFitChip({ fit, against }: { fit: Fit; against: string[] }) {
  return (
    <span className={pillBase} style={pillStyle(FIT_COLOUR[fit])} title={against.length ? `${FIT_LABEL[fit]} on: ${against.join(', ').toLowerCase()}. ${FIT_DEF[fit]}` : `${FIT_LABEL[fit]}: ${FIT_DEF[fit]}`} data-fit-chip={fit}>
      <VerdictIcon kind={fit} />
      {FIT_LABEL[fit]}
    </span>
  )
}

/** The rule in five lines, behind a small link, so the table itself stays clear. Closes on Escape or a click elsewhere. */
export function HowItsDecided() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} data-testid="how-decided" className="rounded-xs text-xs font-medium text-iris-700 hover:underline">
        How it’s decided
      </button>
      {open && (
        <div role="dialog" aria-label="How it’s decided" data-testid="how-decided-pop" className="absolute top-full right-0 z-30 mt-1.5 max-h-[70vh] w-96 overflow-y-auto rounded-sm border border-mist bg-surface p-3 text-left text-xs font-normal text-ink shadow-overlay">
          <ol className="flex flex-col gap-1.5">
            {DELIVERY_RULE_LINES.map((l, i) => (
              <li key={i} data-testid="how-decided-line" className="flex gap-2">
                <span aria-hidden="true" className="text-graphite tabular-nums">{i + 1}.</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 mb-1 font-semibold">The row verdict</p>
          <ul className="flex flex-col gap-1.5" data-testid="how-decided-verdicts">
            {VERDICT_ORDER.map((v) => (
              <li key={v} data-testid="how-decided-verdict" className="flex items-start gap-2">
                <span className="w-24 shrink-0"><FitChip pattern={v} /></span>
                <span>{VERDICT_DEF[v]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 mb-1 font-semibold">Did their delivery match their words?</p>
          <ul className="flex flex-col gap-1.5" data-testid="how-decided-fits">
            {FIT_ORDER.map((f) => (
              <li key={f} data-testid="how-decided-fit" className="flex items-start gap-2">
                <span className="w-24 shrink-0"><OneFitChip fit={f} against={[]} /></span>
                <span>{FIT_DEF[f]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 mb-1 font-semibold">What people said</p>
          <ul className="flex flex-col gap-1" data-testid="how-decided-words">
            {(Object.keys(SIDE_LABEL) as (keyof typeof SIDE_LABEL)[]).map((k) => (
              <li key={k} data-testid="how-decided-word"><span className="font-medium">{SIDE_LABEL[k]}</span>: {SIDE_DEF[k]}</li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
}

/** One word for why a person matched, did not match, or was hesitant: the tone, or "Hesitated". */
const reasonWord = (p: Point, fit: FitKey) => (fit === 'Uncertain' ? 'Hesitated' : p.voice.tone)

/**
 * What people said, in one sentence, then "Did their delivery match their words?" and the tiles Matched · No match · Hesitant. Two sides
 * stack two groups, each headed by its side and size; one side has one group. Each tile and each group heading opens the people in it.
 * People who just described it are one quiet grey line.
 */
export function DeliveryFigures({ reads, ctx, what }: { reads: PersonRead[]; ctx: CodebookCtx; what: 'theme' | 'code' }) {
  const sum = sideSummary(reads)
  const [open, setOpen] = useState<{ side: string; fit?: FitKey } | null>(null)
  const [who, setWho] = useState(false)
  const checked = sum.groups.reduce((n, g) => n + g.points.length, 0)
  const audioOnly = sum.groups.flatMap((g) => g.points).filter((p) => !p.face).length
  const [lead, ...after] = sum.sentence.split(new RegExp(`(?<= of |All )${sum.of}(?= people)`))
  return (
    <div className="mb-2 flex flex-col gap-2.5 rounded-sm border border-mist px-3 py-2.5" data-testid="delivery-breakdown">
      <div className="flex flex-col gap-1.5">
        <AIGeneratedTag className="self-start" />
        <p className="text-sm font-medium" data-testid="summary-sentence">
          {after.length ? (
            <>
              {lead}
              <span title={RAISED_TIP[what]} data-testid="raised-n" className="cursor-help underline decoration-dotted underline-offset-2">{sum.of}</span>
              {after.join(String(sum.of))}
            </>
          ) : (
            sum.sentence
          )}
        </p>
      </div>
      {sum.groups.length > 0 && (
        <p className="text-xs text-graphite" data-testid="match-question">
          Did their delivery match their words?
        </p>
      )}
      {sum.groups.map((g) => {
        const both = sum.groups.length > 1
        const key = g.side
        const listed = open?.side === key ? (open.fit ? g.tiles[open.fit] : g.points) : []
        return (
          <section key={key} aria-label={SIDE_LABEL[g.side]} data-testid="tile-group" data-side={g.side} data-n={g.points.length} className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setOpen(open?.side === key && !open.fit ? null : { side: key })} aria-expanded={open?.side === key && !open.fit} data-testid="group-head" className="cursor-pointer self-start rounded-xs text-left text-xs font-semibold hover:underline">
              {both ? sideGroupHead(g.side, g.points.length) : sideGroupLine(g.side, g.points.length)}
            </button>
            <dl className="grid grid-cols-3 gap-2" data-testid="match-tiles">
              {FIT_ORDER.map((k) => (
                <button key={k} type="button" onClick={() => setOpen(open?.side === key && open.fit === k ? null : { side: key, fit: k })} aria-pressed={open?.side === key && open.fit === k} data-testid={`fig-${{ Matches: 'matched', 'Pulls against': 'against', Uncertain: 'uncertain' }[k]}`} data-fit={k} data-n={g.tiles[k].length} title={FIT_DEF[k]} className={cn('cursor-pointer rounded-sm border px-2 py-1.5 text-left', open?.side === key && open.fit === k && 'ring-1 ring-ink')} style={{ background: FIT_COLOUR[k].bg, borderColor: FIT_COLOUR[k].line }}>
                  <dd className="text-lg leading-none font-semibold tabular-nums" style={{ color: FIT_COLOUR[k].fg }}>{g.tiles[k].length}</dd>
                  <dt className="mt-1 flex items-center gap-1 text-xs text-graphite">
                    <span style={{ color: FIT_COLOUR[k].accent }}><VerdictIcon kind={k} /></span>
                    {FIT_LABEL[k]}
                  </dt>
                </button>
              ))}
            </dl>
            {listed.length > 0 && open?.side === key && (
              <ul className="divide-y divide-mist rounded-sm border border-mist" data-testid="tile-people" data-for={open.fit ?? 'all'}>
                {listed.map((p) => {
                  const f = g.fits[p.participantId] as FitKey
                  return (
                    <li key={p.participantId} data-testid="tile-person" className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                      <span className="font-medium tabular-nums">{p.participantId}</span>
                      <span className="text-graphite">{segmentLabelOf(p.participantId)}</span>
                      <span className="text-graphite" data-testid="tile-reason">{reasonWord(p, f)}</span>
                      <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="ml-auto inline-flex items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${p.participantId} at ${mmss(p.atSec)}`}>
                        <PlayIcon size={11} /> Play
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
      {audioOnly > 0 && (
        <p className="text-xs text-graphite" data-testid="audio-only-note">
          {audioOnly} of {checked} audio-only, read on speech.
        </p>
      )}
      {sum.described.length > 0 && (
        <p className="text-xs text-graphite" data-testid="fact-only">
          {describedLine(sum.described.length)}.{' '}
          <button type="button" aria-expanded={who} onClick={() => setWho((w) => !w)} data-testid="see-who" className="font-medium text-iris-700 hover:underline">
            {who ? 'Hide' : 'See who'}
          </button>
          {who && (
            <span className="mt-0.5 block tabular-nums text-ink" data-testid="fact-only-ids">
              {sum.described.map((p) => p.participantId).sort().join(', ')}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

/** "Positive words, hesitant delivery": an observation, never a verdict, at the top of a code's panel. Only for a claim that is positive. */
export function HesitantNote({ points, doc, of }: { points: Point[]; doc: CodebookCtx['doc']; of: number }) {
  const h = hesitantDelivery(points, doc)
  if (!h) return null
  return (
    <p className="border-b border-mist bg-iris-50 px-5 py-2 text-xs text-iris-700" data-testid="hesitant-note">
      <span className="font-semibold">Spoke in favour, hesitant delivery:</span> said by {h.said} of {of}; {h.hesitated} of {h.speakers} hesitated.
    </p>
  )
}

// ─── one moment ─────────────────────────────────────────────────────────────

export { noReading }

export const playHref = (studyId: string, sessionId: string, atSec: number) =>
  `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', sessionId) })}?from=signals&at=${atSec}`

/** How long the answer took to start, against this person's own usual (the tick). Four seconds fills the bar. */
export function DelayBar({ delay, usual, hot }: { delay: number; usual: number; hot: boolean }) {
  const max = 4
  return (
    <span className="relative inline-block h-1.5 w-16 rounded-full bg-haze align-middle" role="img" aria-label={`${delay} seconds, this person usually takes ${usual}`}>
      <span className={cn('absolute inset-y-0 left-0 rounded-full', hot ? 'bg-iris-600' : 'bg-graphite/40')} style={{ width: `${Math.min(delay / max, 1) * 100}%` }} />
      <span className="absolute -top-0.5 h-2.5 w-px bg-ink" style={{ left: `${Math.min(usual / max, 1) * 100}%` }} title={`Usual: ${usual} s`} />
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-baseline gap-x-2 py-1">
      <dt className="text-xs font-medium text-graphite">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

/**
 * One person at one moment, on every channel: the quote, the face (with what was visible, and a way to correct it),
 * the voice against their usual, and the hesitation measurements. Play opens the recording there.
 */
export function PointCard({ point: p, ctx, context, reasons }: { point: Point; ctx: CodebookCtx; context: string; reasons?: boolean }) {
  const [fixing, setFixing] = useState(false)
  const signs = signsOf(p.facts, p.usual)
  const face = faceOf(p, ctx.doc)
  const fit = fitOf(p, face)
  const fact = (on: boolean, text: string) => <span className={cn(on ? 'font-medium text-ink' : 'text-graphite')}>{text}</span>
  return (
    <li className="py-3.5 first:pt-1 last:pb-0" data-testid="signal-point" data-band={p.band} data-key={p.key}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite">
        <span className="font-medium text-ink tabular-nums">{p.participantId}</span>
        <span>{segmentLabelOf(p.participantId)}</span>
        <span className="tabular-nums">{mmss(p.atSec)}</span>
        <span className="flex-1" />
        {fit.fit && <OneFitChip fit={fit.fit} against={fit.against} />}
      </div>
      {p.excerpt && <p className="mt-1.5 font-serif text-quote leading-snug text-ink">“{p.excerpt.text}”</p>}
      <dl className="mt-1.5">
        <Row label="Face">
          {face ? (
            <span data-testid="face-reading" data-emotion={face.emotion ?? 'none'}>
              <span className="block text-xs text-graphite" data-testid="face-seen">
                <span className="font-medium text-ink tabular-nums">Seen at {mmss(p.atSec)}</span> ({face.reading.onsetSec} s in): {face.reading.cue.toLowerCase()}.
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <EmotionChip emotion={face.emotion} intensity={face.reading.intensity} corrected={!!face.fix} reads />
                {!face.fix && <span className="text-xs text-graphite">{confidenceBand(face.reading.confidence)} confidence</span>}
                <button type="button" onClick={() => setFixing(true)} className="text-xs font-medium text-iris-700 hover:underline" data-testid="fix-face">
                  {face.fix ? 'Change' : 'Not right?'}
                </button>
              </span>
              {face.fix && (
                <span className="mt-0.5 block text-xs text-graphite">
                  PulseAI read {face.reading.emotion.toLowerCase()}. Corrected by {face.fix.by}: “{face.fix.why}”
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted" data-testid="no-face">
              No reading. This session is audio-only.
            </span>
          )}
        </Row>
        <Row label="Speech">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums" data-testid="speech-reading" data-tone={p.voice.tone} data-band={p.band}>
            <ToneChip tone={p.voice.tone} />
            <BandChip band={p.band} />
            <span className="text-graphite" data-testid="speech-cell">{p.voice.tone} · {p.band === 'Marked hesitation' ? 'hesitated' : p.band === 'Some hesitation' ? 'some hesitation' : 'steady'}</span>
            <Tooltip content={p.voice.reason} focusable align="left">
              <span className="text-graphite">
                {p.voice.pace} wpm <span className="text-muted">(usual {p.voice.usualPace})</span> · pitch {p.voice.pitch} st <span className="text-muted">(usual {p.voice.usualPitch})</span>
              </span>
            </Tooltip>
            <span className="inline-flex items-center gap-1.5">
              {fact(signs.includes('delay'), `Delay ${p.facts.delaySec} s`)}
              <DelayBar delay={p.facts.delaySec} usual={p.usual} hot={signs.includes('delay')} />
              <span className="text-muted">usual {p.usual} s</span>
            </span>
            {fact(signs.includes('pause'), `Pause ${p.facts.pauseSec} s`)}
            {fact(signs.includes('fillers'), `${p.facts.fillers} ${p.facts.fillers === 1 ? 'filler' : 'fillers'}`)}
          </span>
        </Row>
      </dl>
      {reasons && (
        <p className="mt-1 text-xs text-graphite" data-testid="point-reason">
          <span className="font-medium">Why these readings: </span>
          {p.reason} Tone: {p.voice.reason}
        </p>
      )}
      {p.stance && (
        <p className="mt-1 text-xs text-graphite">
          <span className="font-medium">Words: </span>
          {STANCE_LABEL[p.stance]}
          {fit.against.length > 0 && <>. No match on {fit.against.join(' and ').toLowerCase()}.</>}
        </p>
      )}
      <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="mt-1.5 inline-flex items-center gap-1 rounded-xs text-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${p.participantId} at ${mmss(p.atSec)}`}>
        <PlayIcon size={11} /> Play at {mmss(p.atSec)}
      </Link>
      {face && <CorrectFaceDialog open={fixing} onClose={() => setFixing(false)} point={p} face={face} ctx={ctx} context={context} />}
    </li>
  )
}

// ─── correcting a face reading ──────────────────────────────────────────────

const CHOICES: (Emotion | 'No clear expression')[] = [...EMOTIONS, 'No clear expression']

/** The Researcher can correct what PulseAI read. A reason is required, and the original stays beside the correction. */
function CorrectFaceDialog({ open, onClose, point: p, face, ctx, context }: { open: boolean; onClose: () => void; point: Point; face: Face; ctx: CodebookCtx; context: string }) {
  const toast = useToast()
  const current: Emotion | 'No clear expression' = face.fix ? face.fix.to : face.reading.emotion
  const [pick, setPick] = useState(current)
  const [why, setWhy] = useState('')
  useEffect(() => {
    if (open) {
      setPick(current)
      setWhy('')
    }
  }, [open, current])
  const original = face.reading.emotion
  const restoring = !!face.fix && pick === original
  const changed = pick !== current
  const save = () => {
    ctx.act((d) => correctFace(d, p.key, `${p.participantId} at ${mmss(p.atSec)}, ${context}`, original, pick, { by: ctx.me }, why))
    toast(restoring ? 'PulseAI’s reading restored' : 'Face reading corrected. Every count that uses it has updated.')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct this face reading"
      description={`${p.participantId} at ${mmss(p.atSec)}, ${context}. Your correction replaces PulseAI’s label in every count. The original stays visible.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!changed || !why.trim()} onClick={save} data-testid="fix-confirm">
            {restoring ? 'Restore PulseAI’s reading' : 'Save correction'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <div className="rounded-sm border border-mist bg-paper px-3 py-2.5 text-sm">
          <p className="text-xs text-graphite">
            <span className="font-medium text-ink tabular-nums">Seen at {mmss(p.atSec)}</span> ({face.reading.onsetSec} s in): {face.reading.cue.toLowerCase()}.
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-graphite">PulseAI’s interpretation</span>
            <EmotionChip emotion={original} intensity={face.reading.intensity} reads />
            <span className="text-xs text-graphite">{confidenceBand(face.reading.confidence)} confidence</span>
          </p>
          <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-iris-700 hover:underline">
            <PlayIcon size={11} /> Watch it at {mmss(p.atSec)}
          </Link>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">What did you see?</legend>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup">
            {CHOICES.map((c) => (
              <label key={c} className={cn('flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm', pick === c ? 'border-iris-600 bg-iris-50' : 'border-mist hover:bg-haze', c === 'No clear expression' && 'col-span-2')} title={c === 'No clear expression' ? 'Takes this moment out of the face counts' : EMOTION_HINT[c]}>
                <input type="radio" name="face-fix" value={c} checked={pick === c} onChange={() => setPick(c)} className="accent-[var(--color-iris-600)]" />
                {c !== 'No clear expression' && <span aria-hidden="true" className={cn('size-2 rounded-full', EMOTION_FILL[c])} />}
                {c}
                {c === original && <span className="ml-auto text-[11px] text-muted">PulseAI</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <TextArea label="Why" hint="Saved in the change log with your name and the time." rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="She’s squinting at the screen, not doubting it." />
      </div>
    </Modal>
  )
}
