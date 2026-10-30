import { useEffect, useRef, useState } from 'react'
import { cn } from '@/components/cn'
import { FLAG_TRACKS, scoreBand, scoreBreakdown, trackLabel, type FlagTrack, type ReviewSession, type ScoreBand } from '@/mock/review'
import { bandClass, Severity } from './reviewUi'

const subtitle: Record<FlagTrack, string> = { Integrity: 'Eligibility and engagement', Quality: 'Moderator thoroughness and objectivity' }
const other: Record<FlagTrack, string> = { Integrity: 'interview quality', Quality: 'participant integrity' }
const verdict: Record<FlagTrack, Record<ScoreBand, string>> = {
  Integrity: {
    High: 'A genuine, eligible and engaged participant.',
    Mid: 'Mostly consistent, with some doubt about eligibility or engagement.',
    Low: 'Serious doubts about whether this is the right person, or whether they engaged honestly.',
  },
  Quality: {
    High: 'A thorough, objective interview.',
    Mid: 'Some gaps in coverage, probing or neutrality.',
    Low: 'Significant problems in how the interview was run.',
  },
}

/** One score, on its own. The two panels are never merged, averaged or ranked against each other. */
export function ScorePanel({ session, track, dismissed }: { session: ReviewSession; track: FlagTrack; dismissed?: ReadonlySet<string> }) {
  // The scores on the session already have dismissed flags given back; the breakdown starts from the base.
  const base = session.baseScores ? { ...session, integrity: session.baseScores.integrity, quality: session.baseScores.quality } : session
  const b = scoreBreakdown(base, track, dismissed ?? new Set(Object.keys(session.dismissed ?? {})))
  const band = scoreBand(b.score)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', out)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const sev = (['High', 'Medium', 'Low'] as const).map((s) => [s, b.active.filter((f) => f.severity === s).length] as const).filter(([, n]) => n > 0)

  return (
    <section aria-label={trackLabel[track]} className="relative rounded-md border border-mist bg-surface p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-semibold">{trackLabel[track]}</h2>
          <p className="text-sm text-graphite">{subtitle[track]}</p>
        </div>
        <p className="flex items-baseline gap-2" aria-label={`${trackLabel[track]} score ${b.score}, ${band}`}>
          <span className="text-xl font-semibold tabular-nums">{b.score}</span>
          <span className="text-sm text-graphite">/ 100</span>
          <span className={cn('rounded-xs px-2 py-0.5 text-sm font-medium', bandClass[band].chip)}>{band}</span>
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-haze" role="img" aria-label={`${b.score}% of the bar is filled`}>
        <div className={cn('h-full rounded-full', bandClass[band].bar)} style={{ width: `${b.score}%` }} />
      </div>

      <p className="mt-3 text-base">{verdict[track][band]}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite">
        <span className="tabular-nums">
          {b.active.length} {b.active.length === 1 ? 'flag' : 'flags'}
        </span>
        {sev.map(([s, n]) => (
          <span key={s} className="inline-flex items-center gap-1.5 tabular-nums">
            {n}
            <Severity severity={s} />
          </span>
        ))}
      </p>

      <div ref={ref} className="mt-3">
        <button type="button" aria-expanded={open} onClick={() => setOpen((x) => !x)} className="rounded-xs text-sm font-medium text-iris-700 underline-offset-2 hover:underline">
          How this is calculated
        </button>
        {open && (
          <div role="dialog" aria-label={`How the ${trackLabel[track]} score is calculated`} className="absolute top-full right-0 left-0 z-20 mt-1 rounded-md border border-mist bg-surface p-4 shadow-overlay">
            <p className="text-sm">It starts at 100. Each flag below took points off. Dismissed flags give their points back.</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {b.items.length === 0 && <li className="text-graphite">No flags on this track.</li>}
              {b.items.map((i) => (
                <li key={i.flag.id} className={cn('flex gap-2', i.dismissed && 'text-muted line-through')}>
                  <span className="w-14 shrink-0 tabular-nums">−{i.points} pts</span>
                  <span className="min-w-0 flex-1">
                    {i.flag.type} <span className="text-graphite">({i.flag.severity})</span>
                  </span>
                </li>
              ))}
              {b.other > 0 && (
                <li className="flex gap-2 text-graphite">
                  <span className="w-14 shrink-0 tabular-nums">−{b.other} pts</span>
                  <span>Other factors in the {track === 'Integrity' ? 'eligibility and engagement' : 'thoroughness and objectivity'} checks</span>
                </li>
              )}
            </ul>
            <p className="mt-2 border-t border-mist pt-2 text-sm font-medium tabular-nums">Score {b.score}</p>
          </div>
        )}
      </div>
      <p className="mt-3 border-t border-mist pt-3 text-xs text-graphite">This score says nothing about {other[track]}. They are never combined.</p>
    </section>
  )
}

export function ScorePair({ session, dismissed }: { session: ReviewSession; dismissed?: ReadonlySet<string> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FLAG_TRACKS.map((t) => (
        <ScorePanel key={t} session={session} track={t} dismissed={dismissed} />
      ))}
    </div>
  )
}
