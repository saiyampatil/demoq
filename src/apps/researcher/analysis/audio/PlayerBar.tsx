import { useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO } from '@/config/audioSummary'
import { cn } from '@/components/cn'
import { Switch } from '@/components/Switch'
import { chapterTitle, clock, outsideBrief, type Ctx, type Timed } from '@/state/audioScript'

/**
 * The playback clock. There is no audio file: playing runs a clock through the lines using their computed lengths. The current line is
 * the one the clock is in. Nothing here starts by itself.
 */
export function usePlayback(timeline: Timed[]) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const total = timeline.length ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].seconds : 0
  const index = useMemo(() => {
    const i = timeline.findIndex((l) => t >= l.start && t < l.start + l.seconds)
    return i < 0 ? Math.max(0, timeline.length - 1) : i
  }, [timeline, t])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setT((x) => {
        const n = x + 0.2 * speed
        if (n >= total) {
          setPlaying(false)
          return total
        }
        return n
      })
    }, 200)
    return () => clearInterval(id)
  }, [playing, speed, total])
  const jump = (i: number) => {
    const line = timeline[Math.min(Math.max(0, i), timeline.length - 1)]
    if (line) setT(line.start)
  }
  return {
    t,
    total,
    index,
    playing,
    speed,
    setSpeed,
    seek: (s: number) => setT(Math.min(Math.max(0, s), total)),
    jump,
    toggle: () => setPlaying((p) => (t >= total && total > 0 ? (setT(0), true) : !p)),
    pause: () => setPlaying(false),
    next: () => jump(index + 1),
    prev: () => jump(t - timeline[index].start > 1.5 ? index : index - 1),
  }
}
export type Playback = ReturnType<typeof usePlayback>

const BTN = 'rounded-xs border border-mist-strong bg-surface px-2.5 py-1 text-sm font-medium hover:bg-haze disabled:opacity-50'

/** The sticky bar: play and pause, previous and next line, a scrubber with a tick at each chapter, the clock, speed, chapters, follow along, length. */
export function PlayerBar({ p, timeline, chapters, ctx, follow, onFollow, onChapter }: { p: Playback; timeline: Timed[]; chapters: string[]; ctx: Ctx; follow: boolean; onFollow: (on: boolean) => void; onChapter: (key: string) => void }) {
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const starts = chapters.map((c) => ({ key: c, start: timeline.find((l) => l.chapter === c)?.start ?? 0 }))
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])
  const warn = outsideBrief(p.total)
  return (
    <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-2 border-b border-mist bg-surface px-1 py-2.5" data-testid="player" role="region" aria-label="Player">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={cn(BTN, 'min-w-16')} onClick={p.toggle} data-testid="play" aria-label={p.playing ? 'Pause' : 'Play'} aria-pressed={p.playing}>
          {p.playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={BTN} onClick={p.prev} data-testid="prev-line" aria-label="Previous line">‹ Line</button>
        <button type="button" className={BTN} onClick={p.next} data-testid="next-line" aria-label="Next line">Line ›</button>
        <span className="text-sm tabular-nums text-graphite" data-testid="clock" aria-label={`${clock(p.t)} of ${clock(p.total)}`}>
          {clock(p.t)} / {clock(p.total)}
        </span>
        <label className="flex items-center gap-1.5 text-sm text-graphite">
          Speed
          <select aria-label="Speed" data-testid="speed" value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} className="h-8 rounded-sm border border-mist-strong bg-surface px-1.5 text-sm text-ink">
            {AUDIO.speeds.map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>
        </label>
        <div className="relative" ref={box}>
          <button type="button" className={BTN} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} data-testid="chapters-menu">Chapters ▾</button>
          {menu && (
            <ul role="menu" className="absolute left-0 z-30 mt-1 w-64 rounded-sm border border-mist bg-surface py-1 shadow-md">
              {starts.map((c) => (
                <li key={c.key} role="none">
                  <button role="menuitem" type="button" data-testid="chapter-jump" data-chapter={c.key} onClick={() => { p.seek(c.start); onChapter(c.key); setMenu(false) }} className="flex w-full justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-haze">
                    <span>{chapterTitle(c.key, ctx)}</span>
                    <span className="tabular-nums text-graphite">{clock(c.start)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="flex items-center gap-2 text-sm">
          <Switch checked={follow} label="Follow along" onChange={onFollow} />
          Follow along
        </span>
        <span className="flex-1" />
        <span className="text-sm tabular-nums" data-testid="length">Length {clock(p.total)}</span>
      </div>
      <div className="relative h-5" data-testid="scrubber-wrap">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(p.total * 10))}
          value={Math.round(p.t * 10)}
          onChange={(e) => p.seek(Number(e.target.value) / 10)}
          aria-label="Position"
          aria-valuetext={`${clock(p.t)} of ${clock(p.total)}`}
          data-testid="scrubber"
          className="absolute inset-x-0 top-0 h-3 w-full cursor-pointer accent-ink"
        />
        {starts.map((c) => (
          <span key={c.key} aria-hidden="true" data-testid="chapter-tick" className="pointer-events-none absolute top-3 h-2 w-px bg-graphite" style={{ left: `${p.total ? (c.start / p.total) * 100 : 0}%` }} />
        ))}
      </div>
      {warn && (
        <p className="text-sm text-pending-fg" data-testid="length-warning">
          The brief asks for {AUDIO.range.min} to {AUDIO.range.max} minutes.
        </p>
      )}
    </div>
  )
}
