import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { PlayIcon } from '@/components/icons'
import { petOf } from '@/mock/codebook'
import { screenById, studyPath } from '@/routes/screens'
import { signsOf, type Band, type Pattern, type Point, type Split } from '@/state/signals'
import { BANDS } from '@/state/signals'
import { mmss } from '../review/reviewUi'

/** One hue at three strengths, so a band is never read as good or bad by its colour. */
export const BAND_CHIP: Record<Band, string> = {
  Steady: 'border-mist-strong bg-haze text-graphite',
  'Some hesitation': 'border-iris-100 bg-iris-50 text-iris-700',
  'Marked hesitation': 'border-iris-600 bg-iris-600 text-white',
}
const BAND_FILL: Record<Band, string> = { Steady: 'bg-mist-strong', 'Some hesitation': 'bg-iris-300', 'Marked hesitation': 'bg-iris-600' }

export function BandChip({ band, className }: { band: Band; className?: string }) {
  return <span className={cn('inline-flex h-5 shrink-0 items-center rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap', BAND_CHIP[band], className)}>{band}</span>
}

export function PatternChip({ pattern }: { pattern: Pattern }) {
  const cls =
    pattern === 'Often hesitant'
      ? BAND_CHIP['Marked hesitation']
      : pattern === 'Mixed'
        ? BAND_CHIP['Some hesitation']
        : pattern === 'Mostly steady'
          ? BAND_CHIP.Steady
          : 'border-dashed border-mist-strong bg-surface text-muted'
  return <span className={cn('inline-flex h-5 shrink-0 items-center rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap', cls)}>{pattern}</span>
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

export function BandLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-graphite" aria-label="Legend">
      {BANDS.slice()
        .reverse()
        .map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-2.5 rounded-xs', BAND_FILL[b])} />
            {b}
          </li>
        ))}
    </ul>
  )
}

export const playHref = (studyId: string, sessionId: string, atSec: number) =>
  `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', sessionId) })}?from=signals&at=${atSec}`

/** One person at one moment: what was measured, the reason in words, the quote if there is one, and Play. */
export function PointCard({ point: p, studyId }: { point: Point; studyId: string }) {
  const signs = signsOf(p.facts, p.usual)
  const fact = (on: boolean, text: string) => <span className={cn(on ? 'font-medium text-ink' : 'text-graphite')}>{text}</span>
  return (
    <li className="py-3.5 first:pt-1 last:pb-0" data-testid="signal-point" data-band={p.band}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite">
        <span className="font-medium text-ink tabular-nums">{p.participantId}</span>
        <span>{petOf(p.participantId)} owner</span>
        <span className="tabular-nums">{mmss(p.atSec)}</span>
        <span className="flex-1" />
        <BandChip band={p.band} />
      </div>
      {p.excerpt && <p className="mt-1.5 font-serif text-quote leading-snug text-ink">“{p.excerpt.text}”</p>}
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
        {fact(signs.includes('delay'), `Answer delay ${p.facts.delaySec} s`)}
        {fact(signs.includes('pause'), `Longest pause ${p.facts.pauseSec} s`)}
        {fact(signs.includes('fillers'), `${p.facts.fillers} ${p.facts.fillers === 1 ? 'filler' : 'fillers'}`)}
      </p>
      <p className="mt-1 text-xs text-graphite">
        <span className="font-medium">Why: </span>
        {p.reason}
      </p>
      <Link to={playHref(studyId, p.sessionId, p.atSec)} className="mt-1.5 inline-flex items-center gap-1 rounded-xs text-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${p.participantId} at ${mmss(p.atSec)}`}>
        <PlayIcon size={11} /> Play at {mmss(p.atSec)}
      </Link>
    </li>
  )
}
