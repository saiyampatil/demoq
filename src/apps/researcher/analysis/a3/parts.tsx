import { useState } from 'react'
import { cn } from '@/components/cn'
import { ClipPlayer } from '@/components/ClipPlayer'
import { PlayIcon } from '@/components/icons'
import { hasVideo } from '@/mock/emotion'
import { segmentWord } from '@/mock/studyAnalysis'
import { mmss } from '@/state/reportLogic'
import type { BlockStatus } from '@/state/report'
import type { Line } from '@/state/reportLines'
import { RespondentQuote } from '../a2/ui'

const PILL: Record<BlockStatus, string> = {
  'To review': 'border-pending-line bg-pending-bg text-pending-fg',
  Approved: 'border-positive-line bg-positive-bg text-positive-fg',
  'Out of date': 'border-negative-line bg-negative-bg text-negative-fg',
  'Left out': 'border-neutral-line bg-neutral-bg text-neutral-fg',
}
export function StatusPill({ status, className }: { status: BlockStatus; className?: string }) {
  return (
    <span data-testid="block-status" data-status={status} className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', PILL[status], className)}>
      {status}
    </span>
  )
}

const DOT: Record<BlockStatus, string> = { 'To review': 'border-pending-fg bg-transparent', Approved: 'border-positive-fg bg-positive-fg', 'Out of date': 'border-negative-fg bg-negative-fg', 'Left out': 'border-graphite bg-graphite/40' }
export function Dot({ status }: { status: BlockStatus }) {
  return <span role="img" aria-label={status} title={status} data-dot={status} className={cn('inline-block size-2.5 shrink-0 rounded-full border-2', DOT[status])} />
}

/** The quiet note that an item rests on a small group. A firmness statement, not a metric. */
export const DirectionalTag = () => <span className="ml-1 rounded-xs border border-mist px-1 text-xs whitespace-nowrap text-graphite" data-testid="directional">Directional</span>

/** One shared bullet list for every block that lists findings. A bullet opens its sources. */
export function Bullets({ lines, selectedId, onOpen, quiet }: { lines: Line[]; selectedId?: string; onOpen?: (l: Line) => void; quiet?: boolean }) {
  return (
    <ul className="flex flex-col" data-testid="bullets">
      {lines.map((l, i) => (
        <li key={l.id} data-testid="bullet" data-line={l.id} className="flex gap-2">
          <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-graphite/60" />
          <button
            type="button"
            onClick={() => onOpen?.(l)}
            disabled={!onOpen}
            className={cn('min-h-9 flex-1 rounded-xs border-l-2 px-2 py-1.5 text-left text-sm leading-relaxed', selectedId === l.id ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze', !onOpen && 'cursor-default hover:bg-transparent')}
          >
            {l.lead && <span className="mr-1.5 text-xs font-medium text-graphite">{l.lead}</span>}
            <span className="text-ink">{l.text}</span>
            {l.directional && <DirectionalTag />}
            {!quiet && <sup className="ml-0.5 text-xs text-iris-700">{i + 1}</sup>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A respondent's words with who, which group and when, and Play in the existing player. Respondent words only look like this. */
export function QuoteRow({ participantId, text, atSec, sessionId }: { participantId: string; text?: string; atSec: number; sessionId?: string }) {
  const [play, setPlay] = useState(false)
  if (!text) return null
  return (
    <li className="flex flex-col gap-1.5 rounded-sm border border-mist bg-paper p-3" data-testid="quote-row" data-session={sessionId}>
      <RespondentQuote>{text}</RespondentQuote>
      <div className="flex items-center gap-2 text-xs text-graphite">
        <span className="font-medium whitespace-nowrap tabular-nums text-ink">{participantId}</span>
        <span>{segmentWord(participantId)}</span>
        <span className="tabular-nums">{mmss(atSec)}</span>
        <button type="button" onClick={() => setPlay((p) => !p)} aria-expanded={play} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-xs px-2 font-medium text-iris-700 hover:bg-haze">
          <PlayIcon size={11} /> {play ? 'Close' : 'Play'}
        </button>
      </div>
      {play && <ClipPlayer label={`${participantId} · ${mmss(atSec)}`} startSec={atSec} audioOnly={!hasVideo(participantId)} />}
    </li>
  )
}
