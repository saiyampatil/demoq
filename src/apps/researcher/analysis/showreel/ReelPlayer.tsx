import { useEffect, useRef, useState } from 'react'
import { cn } from '@/components/cn'
import { clipLength, type Clip } from '@/mock/showreel'
import { mmss } from '@/state/reportLogic'

/** One thing the player plays: a clip, or a plain title card at the start of a theme in the showreel. */
export type Item = { kind: 'clip'; clip: Clip } | { kind: 'title'; title: string }
export const TITLE_SEC = 2
const lengthOf = (i: Item) => (i.kind === 'clip' ? clipLength(i.clip) : TITLE_SEC)

/**
 * A grey placeholder player. There is no recording behind it: a real-time clock runs through the clips, the progress bar has one
 * segment for each, and the quote shows as a caption when captions are on. Audio-only clips show a plain waveform.
 */
export function ReelPlayer({ items, captions, label }: { items: Item[]; captions: boolean; label: string }) {
  const [index, setIndex] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  // A different video starts again from its beginning.
  const key = items.map((i) => (i.kind === 'clip' ? i.clip.id : i.title)).join('|')
  const last = useRef(key)
  useEffect(() => {
    if (last.current !== key) {
      last.current = key
      setIndex(0)
      setT(0)
      setPlaying(false)
    }
  }, [key])
  const at = Math.min(index, Math.max(0, items.length - 1))
  const item = items[at]
  const length = item ? lengthOf(item) : 0

  useEffect(() => {
    if (!playing || !item) return
    const id = setInterval(() => {
      setT((x) => {
        const n = x + 0.25
        if (n < length) return n
        if (at < items.length - 1) {
          setIndex(at + 1)
          return 0
        }
        setPlaying(false)
        return length
      })
    }, 250)
    return () => clearInterval(id)
  }, [playing, item, length, at, items.length])

  const jump = (i: number) => {
    setIndex(i)
    setT(0)
  }
  const next = () => {
    const from = items.findIndex((x, i) => i > at && x.kind === 'clip')
    if (from >= 0) jump(from)
  }
  const bars = Array.from({ length: 40 }, (_, i) => 20 + (((i * 37 + (item?.kind === 'clip' ? item.clip.participantId.length * 11 : 3)) % 60)))
  const total = items.reduce((n, i) => n + lengthOf(i), 0)
  const elapsed = items.slice(0, at).reduce((n, i) => n + lengthOf(i), 0) + t

  return (
    <section aria-label={label} data-testid="reel-player" className="flex flex-col gap-2">
      <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-sm bg-mist-strong text-ink" data-testid="player-frame">
        {!item ? (
          <p className="text-sm text-graphite">Nothing to play yet.</p>
        ) : item.kind === 'title' ? (
          <p className="text-lg font-semibold" data-testid="title-card">
            {item.title}
          </p>
        ) : (
          <>
            {item.clip.mode === 'audio-only' && (
              <div className="absolute inset-x-6 bottom-10 flex h-16 items-end gap-[3px]" aria-hidden="true" data-testid="waveform">
                {bars.map((h, i) => (
                  <span key={i} className="flex-1 rounded-full bg-graphite" style={{ height: `${h}%`, opacity: (i / bars.length) * length < t ? 1 : 0.4 }} />
                ))}
              </div>
            )}
            <p className="text-sm font-medium" data-testid="now-playing">
              {item.clip.participantId} · {mmss(item.clip.start)}–{mmss(item.clip.end)}
            </p>
            {item.clip.mode === 'audio-only' && <p className="mt-1 rounded-xs border border-graphite px-1.5 py-0.5 text-xs" data-testid="audio-only-tile">Audio only</p>}
            {captions && <p className="absolute right-3 bottom-3 left-3 rounded-sm bg-ink/80 px-3 py-1.5 text-center text-sm text-white" data-testid="caption">{item.clip.quote}</p>}
          </>
        )}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Clips" data-testid="segments">
        {items.map((it, i) => (
          <button key={i} type="button" aria-label={it.kind === 'clip' ? `Clip ${i + 1}: ${it.clip.participantId}` : `Title: ${it.title}`} aria-current={i === at} onClick={() => jump(i)} data-testid="segment" data-active={i === at} className="group h-2.5 overflow-hidden rounded-full bg-haze" style={{ flexGrow: lengthOf(it), flexBasis: 0 }}>
            <span className={cn('block h-full', i === at ? 'bg-ink' : i < at ? 'bg-graphite' : 'bg-transparent')} style={{ width: i === at ? `${(t / lengthOf(it)) * 100}%` : '100%' }} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => (t >= length && at === items.length - 1 ? (jump(0), setPlaying(true)) : setPlaying((p) => !p))} disabled={!items.length} data-testid="play" className="rounded-xs border border-mist-strong bg-surface px-3 py-1 text-sm font-medium hover:bg-haze disabled:opacity-50">
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={next} disabled={!items.some((x, i) => i > at && x.kind === 'clip')} data-testid="next-clip" className="rounded-xs border border-mist-strong bg-surface px-3 py-1 text-sm font-medium hover:bg-haze disabled:opacity-50">
          Skip to next clip
        </button>
        <span className="text-xs text-graphite tabular-nums" data-testid="clock">
          {mmss(elapsed)} / {mmss(total)}
        </span>
      </div>
    </section>
  )
}
