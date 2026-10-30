import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { FLAG_TRACKS, trackShort, type FlagTrack, type ReviewFlag, type ReviewSession } from '@/mock/review'
import { formatStamp } from '@/lib/format'
import { mmss, Severity, TrackTag } from './reviewUi'

/** All the flags on the session, each with its track, timestamp and turn. Decision support only. */
export function FlagsPanel({ flags, onJump, highlighted, dismissed = {}, onDismiss }: { flags: ReviewFlag[]; onJump: (f: ReviewFlag) => void; highlighted?: string; dismissed?: NonNullable<ReviewSession['dismissed']>; /** Set while the session is under review: offers Dismiss on each active flag. */ onDismiss?: (f: ReviewFlag) => void }) {
  const [track, setTrack] = useState<FlagTrack | 'All'>('All')
  const shown = flags.filter((f) => track === 'All' || f.track === track)
  const count = (t: FlagTrack) => flags.filter((f) => f.track === t).length

  return (
    <section aria-label="Flags" className="flex flex-col rounded-md border border-mist bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-mist px-4 py-3">
        <h2 className="text-md font-semibold">
          Flags <span className="font-normal text-graphite tabular-nums">({flags.length - Object.keys(dismissed).filter((id) => flags.some((f) => f.id === id)).length}{Object.keys(dismissed).length ? `, ${Object.keys(dismissed).filter((id) => flags.some((f) => f.id === id)).length} dismissed` : ''})</span>
        </h2>
        <div role="group" aria-label="Filter flags by track" className="ml-auto inline-flex rounded-sm border border-mist-strong bg-haze p-0.5 text-sm">
          {(['All', ...FLAG_TRACKS] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={track === t}
              onClick={() => setTrack(t)}
              className={cn('rounded-xs px-2.5 py-1', track === t ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}
            >
              {t === 'All' ? `All ${flags.length}` : `${trackShort[t]} ${count(t)}`}
            </button>
          ))}
        </div>
      </header>

      <p className="border-b border-mist bg-paper px-4 py-2 text-xs text-graphite">Flags never exclude a session on their own. They point at a moment so you can decide.</p>

      {flags.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="font-medium">No flags were raised</p>
          <p className="mt-1 text-sm text-graphite">Neither the integrity checks nor the interview quality checks found anything to point at.</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-graphite">No flags on this track.</p>
      ) : (
        <ol className="divide-y divide-mist">
          {shown.map((f) => (
            <li key={f.id} className={cn('flex flex-col gap-1.5 px-4 py-3', highlighted === f.id && 'bg-iris-50')}>
              <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', dismissed[f.id] && 'text-muted line-through')}>
                <span className="text-sm font-semibold tabular-nums">{mmss(f.atSec)}</span>
                <span className="text-xs text-graphite tabular-nums">Turn {f.turn}</span>
                <TrackTag track={f.track} />
                <Severity severity={f.severity} />
              </div>
              <p className={cn('font-medium', dismissed[f.id] && 'text-muted line-through')}>{f.type}</p>
              <p className={cn('text-sm text-graphite', dismissed[f.id] && 'text-muted line-through')}>{f.rationale}</p>
              {dismissed[f.id] && (
                <p data-testid="dismissed-note" className="text-sm text-graphite tabular-nums">
                  Dismissed by {dismissed[f.id].by}, {formatStamp(dismissed[f.id].at)}: {dismissed[f.id].reason}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onJump(f)}>
                  Jump to {mmss(f.atSec)}
                </Button>
                {onDismiss && !dismissed[f.id] && (
                  <Button size="sm" variant="ghost" onClick={() => onDismiss(f)} aria-label={`Dismiss flag: ${f.type}`}>
                    Dismiss
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
