import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { Switch } from '@/components/Switch'
import { formatStamp } from '@/lib/format'
import type { ReviewFlag, ReviewSession, Turn } from '@/mock/review'
import { transcriptFor } from '@/mock/review'
import { mmss, trackMarker, TrackTag } from './reviewUi'

const ROW = 84
const BUFFER = 6

export type Focus = { index: number; nonce: number }

/**
 * Timestamped turns, labelled AI or Participant. Only the turns on screen are rendered, so a 2,400-turn
 * transcript scrolls smoothly. The raw file is read-only; a reviewed copy is a separate version.
 */
export function TranscriptView({
  session,
  currentSec,
  focus,
  height = 420,
  empty,
  onSeek,
}: {
  session: ReviewSession
  currentSec: number
  focus?: Focus
  height?: number
  /** Demo: show the empty state. */
  empty?: boolean
  onSeek: (sec: number) => void
}) {
  const [version, setVersion] = useState<'raw' | 'reviewed'>('raw')
  const [query, setQuery] = useState('')
  const [flagsOnly, setFlagsOnly] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [marked, setMarked] = useState<number>()
  const box = useRef<HTMLDivElement>(null)

  const turns = useMemo<Turn[]>(() => (empty ? [] : transcriptFor(session.id, version)), [session.id, version, empty])
  const flagAt = useMemo(() => new Map<number, ReviewFlag>(session.flags.map((f) => [f.turn - 1, f])), [session.flags])
  const editedAt = useMemo(() => new Set(version === 'reviewed' ? (session.reviewed?.edits.map((e) => e.index) ?? []) : []), [version, session.reviewed])
  const q = query.trim().toLowerCase()
  const list = useMemo(() => turns.filter((t) => (!flagsOnly || flagAt.has(t.index)) && (!q || t.text.toLowerCase().includes(q))), [turns, flagsOnly, q, flagAt])

  // Near turns glide; far ones land at once, so a jump across 2,400 turns is immediate.
  const scrollToRow = (i: number) => {
    const el = box.current
    if (!el) return
    const top = Math.max(0, i * ROW - ROW * 2)
    el.scrollTo({ top, behavior: Math.abs(top - el.scrollTop) > ROW * 20 ? 'auto' : 'smooth' })
  }

  // A jump from a flag clears any filter that would hide its turn, then scrolls there and marks it.
  useEffect(() => {
    if (!focus) return
    setMarked(focus.index)
    const inList = list.findIndex((t) => t.index === focus.index)
    if (inList < 0) {
      setQuery('')
      setFlagsOnly(false)
      return
    }
    scrollToRow(inList)
    const timer = setTimeout(() => setMarked(undefined), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce])
  useEffect(() => {
    // After a filter was cleared for a jump, finish the scroll.
    if (!focus || marked !== focus.index) return
    const i = list.findIndex((t) => t.index === focus.index)
    if (i >= 0) scrollToRow(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length])

  const first = Math.max(0, Math.floor(scrollTop / ROW) - BUFFER)
  const last = Math.min(list.length, Math.ceil((scrollTop + height) / ROW) + BUFFER)
  // The turn being played now.
  const nowIndex = useMemo(() => {
    let lo = 0
    let hi = turns.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (turns[mid].atSec <= currentSec) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return found
  }, [turns, currentSec])

  const download = () => {
    const text = turns.map((t) => `[${mmss(t.atSec)}] ${t.speaker}: ${t.text}`).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.id}-transcript-${version}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section aria-label="Transcript" className="flex flex-col rounded-md border border-mist bg-surface">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-mist px-4 py-3">
        <h2 className="text-md font-semibold">Transcript</h2>
        <span className="inline-flex h-6 items-center rounded-xs border border-mist-strong bg-haze px-2 text-xs font-medium text-graphite">
          {version === 'raw' ? 'Raw, original · read-only' : `Reviewed v${session.reviewed?.version} · corrected copy`}
        </span>
        {session.reviewed && (
          <div role="group" aria-label="Which transcript" className="inline-flex rounded-sm border border-mist-strong bg-haze p-0.5 text-sm">
            {(['raw', 'reviewed'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={version === v} onClick={() => setVersion(v)} className={cn('rounded-xs px-2.5 py-1', version === v ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}>
                {v === 'raw' ? 'Raw' : `Reviewed v${session.reviewed!.version}`}
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        <span className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong bg-surface px-2 focus-within:border-iris-600">
          <SearchIcon size={14} className="text-graphite" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the transcript" aria-label="Search the transcript" className="w-44 bg-transparent text-sm outline-none" />
        </span>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={flagsOnly} onChange={setFlagsOnly} label="Show flags only" />
          Show flags only
        </label>
        <Button size="sm" onClick={download} disabled={turns.length === 0}>
          Download
        </Button>
      </header>

      {version === 'reviewed' && session.reviewed && (
        <p className="border-b border-mist bg-paper px-4 py-2 text-xs text-graphite">
          Edited by {session.reviewed.editedBy}, {formatStamp(session.reviewed.editedAt)}. {session.reviewed.summary}
        </p>
      )}

      {turns.length === 0 ? (
        <EmptyState title="No transcript for this session" description="The transcript is made while the interview runs. The recording and flags are still available." />
      ) : list.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-graphite">No turns match{q ? ` “${query}”` : ''}{flagsOnly ? ' among the flagged turns' : ''}.</p>
      ) : (
        <div ref={box} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} style={{ height }} className="relative overflow-y-auto" role="list" aria-label={`${list.length} turns`} tabIndex={0}>
          <div style={{ height: list.length * ROW }} className="relative">
            {list.slice(first, last).map((t, k) => {
              const flag = flagAt.get(t.index)
              const isMarked = marked === t.index
              const isNow = nowIndex === t.index
              return (
                <div
                  key={t.index}
                  role="listitem"
                  id={`turn-${t.turn}`}
                  data-turn={t.turn}
                  style={{ top: (first + k) * ROW, height: ROW }}
                  className={cn('absolute right-0 left-0 flex gap-3 border-b border-mist px-4 py-2.5', flag && 'border-l-[3px] bg-paper', flag && trackMarker[flag.track], isNow && 'bg-iris-50/60', isMarked && 'bg-iris-50 ring-2 ring-iris-600 ring-inset')}
                >
                  <button type="button" onClick={() => onSeek(t.atSec)} aria-label={`Seek to ${mmss(t.atSec)}`} className="w-12 shrink-0 self-start rounded-xs text-left text-sm text-graphite tabular-nums hover:text-ink">
                    {mmss(t.atSec)}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className={cn('font-semibold', t.speaker === 'AI' ? 'text-iris-700' : 'text-ink')}>{t.speaker}</span>
                      <span className="text-graphite tabular-nums">Turn {t.turn}</span>
                      {editedAt.has(t.index) && <span className="rounded-xs bg-haze px-1 text-graphite">corrected</span>}
                      {flag && (
                        <>
                          <TrackTag track={flag.track} />
                          <span className="font-medium">{flag.type}</span>
                        </>
                      )}
                    </p>
                    <p className={cn('mt-0.5 line-clamp-2 text-sm', t.speaker === 'Participant' && 'font-serif text-quote leading-snug')} title={t.text}>
                      {t.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {list.length > 0 && (
        <footer className="border-t border-mist px-4 py-2 text-xs text-graphite tabular-nums">
          {list.length === turns.length ? `${turns.length.toLocaleString('en-US')} turns` : `${list.length.toLocaleString('en-US')} of ${turns.length.toLocaleString('en-US')} turns`}
        </footer>
      )}
    </section>
  )
}
