import { useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO } from '@/config/audioSummary'
import { cn } from '@/components/cn'
import { Switch } from '@/components/Switch'
import { chapterTitle, clock, outsideBrief, type Ctx, type Timed } from '@/state/audioScript'

/** What plays: everything, only the findings (narration, notes and the frame lines), or only the people's own words. */
export type PlayMode = 'all' | 'findings' | 'quotes'
export const MODES: [PlayMode, string][] = [['all', 'Everything'], ['findings', 'Findings'], ['quotes', 'Quotes only']]
export const inMode = (type: string, mode: PlayMode) => mode === 'all' || (mode === 'quotes' ? type === 'quote' : type !== 'quote')

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
  const seek = (s: number) => setT(Math.min(Math.max(0, s), total))
  return {
    t,
    total,
    index,
    playing,
    speed,
    setSpeed,
    seek,
    jump,
    skip: (by: number) => seek(t + by),
    toggle: () => setPlaying((p) => (t >= total && total > 0 ? (setT(0), true) : !p)),
    pause: () => setPlaying(false),
    next: () => jump(index + 1),
    prev: () => jump(timeline.length && t - timeline[index].start > 1.5 ? index : index - 1),
  }
}
export type Playback = ReturnType<typeof usePlayback>

const BTN = 'rounded-xs border border-mist-strong bg-surface px-2.5 py-1 text-sm font-medium hover:bg-haze disabled:opacity-50'
const hash = (s: string) => [...s].reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 5)

/**
 * The scrubber drawn as a waveform: a bar for each half second, taller and a different colour where a person's own words are, so you can
 * see where the quotes sit. Played bars are dark. The bars are fixed by the script, never animated; the only thing that moves is the
 * played edge. A real range input sits over it for the mouse, the keyboard and screen readers.
 */
function Waveform({ p, timeline, chapters }: { p: Playback; timeline: Timed[]; chapters: { key: string; start: number }[] }) {
  const bars = useMemo(
    () =>
      timeline.flatMap((l) => {
        const n = Math.max(1, Math.round(l.seconds * 2))
        return Array.from({ length: n }, (_, i) => ({ at: l.start + (i + 0.5) * (l.seconds / n), type: l.type, h: 0.35 + ((hash(`${l.id}${i}`) % 60) / 100) * (l.type === 'quote' ? 1 : 0.7) }))
      }),
    [timeline],
  )
  const frac = p.total ? p.t / p.total : 0
  return (
    <div className="relative h-9 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-iris-600" data-testid="waveform">
      <svg viewBox="0 0 1000 36" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {bars.map((b, i) => {
          const x = p.total ? (b.at / p.total) * 1000 : 0
          const played = p.total ? b.at / p.total <= frac : false
          return <rect key={i} data-testid="wave-bar" data-type={b.type} data-played={played} x={x - 1.1} y={18 - (b.h * 36) / 2} width={2.2} height={b.h * 36} rx={1} fill={b.type === 'quote' ? (played ? '#4a43b3' : '#b9b5ec') : played ? '#1b1d22' : '#c4c8d0'} />
        })}
      </svg>
      {chapters.map((c) => (
        <span key={c.key} aria-hidden="true" data-testid="chapter-tick" className="pointer-events-none absolute inset-y-0 w-px bg-graphite/60" style={{ left: `${p.total ? (c.start / p.total) * 100 : 0}%` }} />
      ))}
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(p.total * 10))}
        value={Math.round(p.t * 10)}
        onChange={(e) => p.seek(Number(e.target.value) / 10)}
        aria-label="Position"
        aria-valuetext={`${clock(p.t)} of ${clock(p.total)}`}
        data-testid="scrubber"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  )
}

/** The sticky bar: play and pause, previous and next line, back and forward 15 seconds, a waveform scrubber, the clock, speed, chapters, follow along, length. */
export function PlayerBar({
  p,
  timeline,
  chapters,
  ctx,
  follow,
  onFollow,
  onChapter,
  fullLength,
  mode,
  onMode,
  resumeAt,
  onResume,
}: {
  p: Playback
  timeline: Timed[]
  chapters: string[]
  ctx: Ctx
  follow: boolean
  onFollow: (on: boolean) => void
  onChapter: (key: string) => void
  /** The whole script's length: the brief's range is about this, not about the part being played. */
  fullLength: number
  mode: PlayMode
  onMode: (m: PlayMode) => void
  resumeAt?: number
  onResume: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [pmenu, setPmenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const pbox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pmenu) return
    const off = (e: MouseEvent) => !pbox.current?.contains(e.target as Node) && setPmenu(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [pmenu])
  const starts = chapters.flatMap((c) => {
    const first = timeline.find((l) => l.chapter === c)
    return first ? [{ key: c, start: first.start }] : []
  })
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])
  const here = [...starts].reverse().find((c) => p.t >= c.start)
  const nextChapter = starts.find((c) => c.start > p.t)
  const warn = outsideBrief(fullLength)
  return (
    <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-2 border-b border-mist bg-surface px-1 py-2.5" data-testid="player" role="region" aria-label="Player">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={cn(BTN, 'min-w-16')} onClick={p.toggle} data-testid="play" aria-label={p.playing ? 'Pause' : 'Play'} aria-pressed={p.playing}>
          {p.playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={BTN} onClick={p.prev} data-testid="prev-line" aria-label="Previous line">‹ Line</button>
        <button type="button" className={BTN} onClick={p.next} data-testid="next-line" aria-label="Next line">Line ›</button>
        <button type="button" className={BTN} onClick={() => p.skip(-15)} data-testid="back-15" aria-label="Back 15 seconds">−15 s</button>
        <button type="button" className={BTN} onClick={() => p.skip(15)} data-testid="forward-15" aria-label="Forward 15 seconds">+15 s</button>
        <span className="text-sm tabular-nums text-graphite" data-testid="clock" aria-label={mode === 'all' ? `${clock(p.t)} of ${clock(p.total)}` : `${clock(p.t)} of ${clock(p.total)} played, ${clock(fullLength)} in all`}>
          {clock(p.t)} / {clock(p.total)}
          {mode !== 'all' && <> of {clock(fullLength)} total</>}
        </span>
        <div role="group" aria-label="What to play" className="inline-flex overflow-hidden rounded-xs border border-mist" data-testid="mode">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} data-testid={`mode-${m}`} onClick={() => onMode(m)} className={cn('px-2.5 py-1 text-sm font-medium', mode === m ? 'bg-ink text-white' : 'bg-surface text-graphite hover:bg-haze')}>
              {label}
            </button>
          ))}
        </div>
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
        <div className="relative" ref={pbox}>
          <button type="button" className={BTN} aria-haspopup="menu" aria-expanded={pmenu} onClick={() => setPmenu((m) => !m)} data-testid="playback-menu">Playback ▾</button>
          {pmenu && (
            <div role="menu" className="absolute left-0 z-30 mt-1 flex w-64 flex-col gap-3 rounded-sm border border-mist bg-surface p-3 shadow-md" data-testid="playback-panel">
              <label className="flex items-center justify-between gap-3 text-sm">
                Speed
                <select aria-label="Speed" data-testid="speed" value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} className="h-8 rounded-sm border border-mist-strong bg-surface px-1.5 text-sm text-ink">
                  {AUDIO.speeds.map((s) => (
                    <option key={s} value={s}>{s}×</option>
                  ))}
                </select>
              </label>
              <span className="flex items-center justify-between gap-3 text-sm">
                Follow along
                <Switch checked={follow} label="Follow along" onChange={onFollow} />
              </span>
            </div>
          )}
        </div>
        <span className="flex-1" />
      </div>
      <Waveform p={p} timeline={timeline} chapters={starts} />
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-graphite" data-testid="now-next">
        {here && <span data-testid="now-chapter">Now: {chapterTitle(here.key, ctx)}</span>}
        {nextChapter && <span data-testid="up-next">Up next: {chapterTitle(nextChapter.key, ctx)} at {clock(nextChapter.start)}</span>}
        {mode !== 'all' && <span data-testid="mode-note">Playing {mode === 'quotes' ? 'only what people said' : 'the findings, without the quotes'}.</span>}
        {resumeAt !== undefined && resumeAt > 5 && p.t < 1 && (
          <button type="button" className="underline-offset-2 hover:text-ink hover:underline" onClick={onResume} data-testid="resume">Resume from {clock(resumeAt)}</button>
        )}
      </p>
      <p className={cn('text-sm', warn ? 'text-pending-fg' : 'text-graphite')} data-testid="length-note" data-outside={warn}>
        Target {AUDIO.range.min} to {AUDIO.range.max} minutes. This runs {clock(fullLength)}.
      </p>
    </div>
  )
}
