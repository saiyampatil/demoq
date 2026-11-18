// Parts the theme panel and the code panel share: the three tiles that filter, and the people behind them.

import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { PlayIcon } from '@/components/icons'
import { BUCKET_WORDS } from '@/config/labels'
import { faceOf } from '@/state/emotion'
import type { Bucket, PersonRead } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import { EmotionChip, ToneChip, playHref } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { DOT, TEXT, toneOfBucket } from './verdictStyle'

const TILES: { key: Bucket; test: string }[] = [
  { key: 'against', test: 'tile-against' },
  { key: 'unsure', test: 'tile-unsure' },
  { key: 'fit', test: 'tile-fit' },
]

/** Didn't fit, unsure, fits: three tiles that add up to the people who took a position. Clicking one filters the people below it. */
export function Tiles({ counts, backed, active, onPick }: { counts: Record<Bucket, number>; backed: number; active: Bucket | null; onPick: (b: Bucket | null) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filter the people" data-testid="tiles">
      {TILES.map(({ key, test }) => {
        const tone = toneOfBucket(key)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active === key}
            onClick={() => onPick(active === key ? null : key)}
            data-testid={test}
            data-n={counts[key]}
            className={cn('flex flex-col items-start rounded-sm border px-3 py-2 text-left whitespace-nowrap transition-colors', active === key ? 'border-ink bg-haze' : 'border-mist hover:bg-haze')}
          >
            <span className={cn('text-2xl leading-none font-semibold tabular-nums', TEXT[tone])}>{counts[key]}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-graphite">
              <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[tone])} />
              {BUCKET_WORDS[key]}
            </span>
          </button>
        )
      })}
      <p className="col-span-3 text-right text-[11px] text-muted" data-testid="tile-backed">
        {backed} with a positive signal
      </p>
    </div>
  )
}

/** The people behind the tiles, didn't fit first: who, which code, how they looked and sounded, and the one plain reason. */
export function PersonRows({ reads, ctx }: { reads: PersonRead[]; ctx: CodebookCtx }) {
  if (!reads.length) return <p className="py-2 text-sm text-graphite">Nobody here.</p>
  return (
    <ul className="divide-y divide-mist" data-testid="people-list">
      {reads.map((r) => {
        const face = faceOf(r.point, ctx.doc)
        const tone = toneOfBucket(r.bucket)
        return (
          <li key={r.participantId} className="flex flex-col gap-1 py-2" data-testid="person-row" data-bucket={r.bucket} data-person={r.participantId}>
            <div className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[tone])} title={BUCKET_WORDS[r.bucket]} />
              <span className="font-medium tabular-nums">{r.participantId}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-graphite" title={r.point.codeName}>
                {r.point.codeName}
              </span>
              <Link to={playHref(ctx.studyId, r.point.sessionId, r.point.atSec)} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${r.participantId} at ${mmss(r.point.atSec)}`}>
                <PlayIcon size={10} /> {mmss(r.point.atSec)}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pl-4">
              {face ? <EmotionChip emotion={face.emotion} intensity={face.reading.intensity} /> : <span className="text-xs text-muted">Audio-only</span>}
              <ToneChip tone={r.point.voice.tone} />
              <span className={cn('text-xs', TEXT[tone])} data-testid="person-reason">
                {r.reason}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export const countBuckets = (reads: PersonRead[]): Record<Bucket, number> => ({ against: reads.filter((r) => r.bucket === 'against').length, unsure: reads.filter((r) => r.bucket === 'unsure').length, fit: reads.filter((r) => r.bucket === 'fit').length })
