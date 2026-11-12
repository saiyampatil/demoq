import { useEffect, useState } from 'react'
import { cn } from './cn'
import { PlayIcon } from './icons'

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/**
 * The one mock player for clips, built to look like the placeholder in Review's session player. There is no real recording
 * behind it: the clock runs, the scrubber works, and the quote shows as a caption while it plays. Theme videos, the showreel and
 * the audio summary use this same player.
 */
export function ClipPlayer({ label, startSec, lengthSec = 20, caption, audioOnly, className }: { label: string; startSec: number; lengthSec?: number; caption?: string; audioOnly?: boolean; className?: string }) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(
      () =>
        setT((x) => {
          const n = x + 0.25
          if (n >= lengthSec) {
            setPlaying(false)
            return lengthSec
          }
          return n
        }),
      250,
    )
    return () => clearInterval(id)
  }, [playing, lengthSec])

  const toggle = () => {
    if (t >= lengthSec) setT(0)
    setPlaying((p) => (t >= lengthSec ? true : !p))
  }
  const bars = Array.from({ length: 36 }, (_, i) => 20 + ((i * 37 + label.length * 11) % 60))

  return (
    <section aria-label={`Clip from ${label}`} data-testid="clip-player" className={cn('overflow-hidden rounded-sm border border-mist bg-surface', className)}>
      <div className="relative flex aspect-video flex-col items-center justify-center bg-ink text-white">
        <div className="absolute inset-0 flex items-end gap-[3px] px-4 pb-4 opacity-30" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 rounded-full bg-white" style={{ height: `${h}%`, opacity: (i / bars.length) * 100 < (t / lengthSec) * 100 ? 1 : 0.4 }} />
          ))}
        </div>
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause clip' : 'Play clip'} className="relative flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true">
              <rect x="5" y="4" width="4" height="14" rx="1" />
              <rect x="13" y="4" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <PlayIcon size={20} />
          )}
        </button>
        <p className="absolute top-2 left-3 text-xs text-white/70">
          {label} · mock {audioOnly ? 'audio' : 'recording'}
        </p>
        {playing && caption && <p className="absolute right-3 bottom-3 left-3 line-clamp-2 rounded-sm bg-black/70 px-2 py-1 text-center text-xs">{caption}</p>}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <input type="range" min={0} max={lengthSec} step={1} value={Math.floor(t)} onChange={(e) => setT(Number(e.target.value))} aria-label="Seek" aria-valuetext={`${mmss(startSec + t)}`} className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--color-iris-600)]" />
        <span className="tabular-nums text-graphite">{mmss(startSec + t)}</span>
      </div>
    </section>
  )
}
