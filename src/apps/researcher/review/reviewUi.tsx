import { cn } from '@/components/cn'
import type { FlagSeverity, FlagTrack, ScoreBand } from '@/mock/review'
import { trackShort } from '@/mock/review'

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export const bandClass: Record<ScoreBand, { chip: string; bar: string }> = {
  High: { chip: 'bg-positive-bg text-positive-fg', bar: 'bg-positive-fg' },
  Mid: { chip: 'bg-pending-bg text-pending-fg', bar: 'bg-pending-fg' },
  Low: { chip: 'bg-negative-bg text-negative-fg', bar: 'bg-negative-fg' },
}

export const sevDot: Record<FlagSeverity, string> = { High: 'bg-negative-fg', Medium: 'bg-pending-fg', Low: 'bg-graphite' }

/** A severity dot and its word, so colour is never the only signal. */
export function Severity({ severity }: { severity: FlagSeverity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-graphite">
      <span className={cn('size-2 rounded-full', sevDot[severity])} aria-hidden="true" />
      {severity}
    </span>
  )
}

const trackStyle: Record<FlagTrack, string> = {
  Integrity: 'border-progress-line bg-progress-bg text-progress-fg',
  Quality: 'border-held-line bg-held-bg text-held-fg',
}
export const trackBar: Record<FlagTrack, string> = { Integrity: 'bg-progress-fg', Quality: 'bg-held-fg' }
export const trackMarker: Record<FlagTrack, string> = { Integrity: 'border-progress-fg', Quality: 'border-held-fg' }

/** The track a flag belongs to, with an icon. A flag is never shown without it. */
export function TrackTag({ track, className }: { track: FlagTrack; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap', trackStyle[track], className)}>
      {track === 'Integrity' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="6" cy="4" r="2" />
          <path d="M2.2 10.2c.5-1.9 1.9-2.8 3.8-2.8s3.3.9 3.8 2.8" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 3.2c0-.7.5-1.2 1.2-1.2h5.6c.7 0 1.2.5 1.2 1.2v3.4c0 .7-.5 1.2-1.2 1.2H5.5L3.2 9.8V7.8H3.2C2.5 7.8 2 7.3 2 6.6z" />
        </svg>
      )}
      {trackShort[track]}
    </span>
  )
}
