import { useEffect, useRef, useState } from 'react'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { AlertIcon, PlayIcon } from '@/components/icons'
import { useToast } from '@/components/Toast'
import type { ReviewFlag, Turn } from '@/mock/review'
import { mmss, trackBar } from './reviewUi'

export type Player = ReturnType<typeof usePlayer>

/** A mock player: the clock, speed, captions and seeking work, and there's no real video behind it. */
export function usePlayer(durationSec: number, startFailed = false) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [captions, setCaptions] = useState(false)
  const [error, setError] = useState(startFailed)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!playing || error) return
    const id = setInterval(
      () =>
        setT((x) => {
          const n = x + 0.25 * speed
          if (n >= durationSec) {
            setPlaying(false)
            return durationSec
          }
          return n
        }),
      250,
    )
    return () => clearInterval(id)
  }, [playing, speed, error, durationSec])

  return {
    t,
    playing,
    speed,
    captions,
    error,
    loading,
    duration: durationSec,
    toggle: () => setPlaying((p) => (t >= durationSec ? (setT(0), true) : !p)),
    seek: (s: number) => setT(Math.min(durationSec, Math.max(0, s))),
    setSpeed,
    setCaptions,
    retry: () => {
      setLoading(true)
      setTimeout(() => {
        setError(false)
        setLoading(false)
      }, 800)
    },
  }
}

const SPEEDS = [0.5, 1, 1.5, 2]

/** The prototype has no real video, so the download is a small placeholder file. In the product it is the recording itself. */
function downloadPlaceholder(name: string, label: string) {
  const text = `Placeholder for the recording of ${label}.\nThe prototype has no real recording. In the product this downloads the session recording.\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function VideoPlayer({ player: p, id, sessionLabel, flags, turns, onJumpFlag }: { player: Player; id: string; sessionLabel: string; flags: ReviewFlag[]; turns: Turn[]; onJumpFlag: (f: ReviewFlag) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const toast = useToast()
  const [full, setFull] = useState(false)
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  // The line being spoken now, for captions.
  let caption: Turn | undefined
  let lo = 0
  let hi = turns.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (turns[mid].atSec <= p.t) {
      caption = turns[mid]
      lo = mid + 1
    } else hi = mid - 1
  }
  const bars = Array.from({ length: 48 }, (_, i) => 20 + ((i * 37 + id.charCodeAt(4) * 11) % 60))

  return (
    <section ref={box} aria-label="Session recording" className={cn('flex flex-col overflow-hidden rounded-md border border-mist bg-surface', full && 'rounded-none')}>
      <div className="relative flex aspect-video flex-col items-center justify-center bg-ink text-white">
        {p.error ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 text-center">
            <AlertIcon size={22} />
            <p className="font-medium">The recording didn’t load</p>
            <p className="max-w-xs text-sm text-white/70">The transcript and flags below still work. Try loading the recording again.</p>
            <Button variant="secondary" onClick={p.retry} loading={p.loading}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-end gap-[3px] px-6 pb-6 opacity-30" aria-hidden="true">
              {bars.map((h, i) => (
                <span key={i} className={cn('flex-1 rounded-full bg-white', p.playing && 'motion-safe:animate-[fade-in_600ms_ease-in-out_infinite_alternate]')} style={{ height: `${h}%`, opacity: (i / bars.length) * 100 < (p.t / p.duration) * 100 ? 1 : 0.4 }} />
              ))}
            </div>
            <button type="button" onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'} className="relative flex size-14 items-center justify-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
              {p.playing ? (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true">
                  <rect x="5" y="4" width="4" height="14" rx="1" />
                  <rect x="13" y="4" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <PlayIcon size={24} />
              )}
            </button>
            <p className="absolute top-3 left-4 text-xs text-white/70">
              {id} · mock recording
            </p>
            {p.captions && caption && (
              <p className="absolute right-6 bottom-6 left-6 rounded-sm bg-black/70 px-3 py-1.5 text-center text-sm" aria-live="off">
                <span className="text-white/60">{caption.speaker}: </span>
                {caption.text}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="relative pt-3">
          {flags.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onJumpFlag(f)}
              aria-label={`Flag at ${mmss(f.atSec)}: ${f.type}`}
              title={`${mmss(f.atSec)} ${f.type}`}
              className={cn('absolute top-0 z-10 h-3 w-1.5 -translate-x-1/2 rounded-xs hover:scale-125', trackBar[f.track])}
              style={{ left: `${(f.atSec / p.duration) * 100}%` }}
            />
          ))}
          <input
            type="range"
            min={0}
            max={p.duration}
            step={1}
            value={Math.floor(p.t)}
            onChange={(e) => p.seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${mmss(p.t)} of ${mmss(p.duration)}`}
            disabled={p.error}
            className="h-1.5 w-full cursor-pointer accent-[var(--color-iris-600)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <Button size="sm" variant="ghost" onClick={p.toggle} disabled={p.error} aria-label={p.playing ? 'Pause' : 'Play'}>
            {p.playing ? 'Pause' : 'Play'}
          </Button>
          <span className="tabular-nums" aria-live="off">
            {mmss(p.t)} <span className="text-graphite">/ {mmss(p.duration)}</span>
          </span>
          <span className="flex-1" />
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Playback speed</span>
            <select value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant={p.captions ? 'primary' : 'secondary'} aria-pressed={p.captions} onClick={() => p.setCaptions(!p.captions)}>
            Captions
          </Button>
          <Button
            size="sm"
            disabled={p.error}
            data-testid="download-recording"
            onClick={() => {
              downloadPlaceholder(`${sessionLabel.replace(/[^A-Za-z0-9]+/g, '-')}-recording-placeholder.txt`, sessionLabel)
              toast('Recording download started. The prototype saves a placeholder file.')
            }}
          >
            Download recording
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void box.current?.requestFullscreen?.()
            }}
          >
            {full ? 'Exit full screen' : 'Full screen'}
          </Button>
        </div>
        {p.loading && (
          <p className="flex items-center gap-2 text-sm text-graphite" role="status">
            <Spinner /> Loading the recording…
          </p>
        )}
      </div>
    </section>
  )
}
