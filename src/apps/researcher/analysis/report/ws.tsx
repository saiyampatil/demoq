import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/components/cn'
import { ClipPlayer } from '@/components/ClipPlayer'
import { StatusGlyph } from '@/components/StatusChip'
import type { StatusFamily } from '@/components/status'
import type { Basis, CodebookDoc, Excerpt } from '@/state/codebook'
import type { Citation, DraftKind, ReportDoc, Strength, Target } from '@/state/report'
import { citationLabel, mmss, questionLabel, type Ctx, type Resolved, type ReportModel, type SentenceState } from '@/state/reportLogic'
import { petOf } from '@/mock/codebook'
import { findReviewRecord } from '@/mock/review'

export const MINI = 'rounded-xs border border-mist bg-surface px-2 py-0.5 text-xs font-medium text-graphite hover:bg-haze disabled:opacity-50 disabled:pointer-events-none'
export const MINI_ON = 'rounded-xs border border-ink bg-ink px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50'
export const LABEL = 'text-[11px] font-semibold tracking-wide text-graphite uppercase'

export type Selection = { kind: 'sentence'; id: string } | { kind: 'finding'; qId: string } | { kind: 'theme'; id: string } | { kind: 'exec' } | null

export type ToolKey =
  | 'theme-videos' | 'showreel' | 'word-cloud' | 'theme-map' | 'audio-summary'
  | 'ask' | 'numbers' | 'highlights'
  | 'lens-builder' | 'compare-lenses'
  | 'review' | 'compare'
  | 'exports' | 'release'

export type Act = {
  approve: (id: string, opts?: { reason?: string; keptNumbers?: { why: string; live: string } }) => void
  withdraw: (id: string) => void
  applyUpdate: (target: Target, id: string, live: string) => void
  setActive: (target: Target, kind: DraftKind) => void
  startFromAI: (target: Target) => void
  regenerate: (target: Target) => void
  save: (target: Target, id: string, value: { text: string; template?: string; cites: Citation[] }) => void
  remove: (target: Target, id: string) => void
  omit: (questionId: string, why: string) => void
  include: (questionId: string) => void
  dismissTension: (tension: { id: string; title: string }, why: string) => void
  regenerating: string | null
}

export type Ws = {
  studyId: string
  me: string
  doc: CodebookDoc
  basis: Basis
  ctx: Ctx
  report: ReportDoc
  model: ReportModel
  accepted: number
  excluded: number
  sel: Selection
  select: (s: Selection) => void
  openStudio: (k: ToolKey) => void
  /** Select something, open the section it is in, and scroll to it. */
  goTo: (s: Selection) => void
  act: Act
}

const WsContext = createContext<Ws | null>(null)
export const WsProvider = ({ value, children }: { value: Ws; children: ReactNode }) => <WsContext.Provider value={value}>{children}</WsContext.Provider>
export function useWs(): Ws {
  const v = useContext(WsContext)
  if (!v) throw new Error('useWs outside the report workspace')
  return v
}

export const targetOf = (qId: string | undefined): Target => (qId ? { questionId: qId } : 'exec')

// ─── chips ──────────────────────────────────────────────────────────────────

const STRENGTH_STYLE: Record<Strength, { family: StatusFamily; cls: string }> = {
  Strong: { family: 'positive', cls: 'bg-positive-bg text-positive-fg border-positive-line' },
  Weak: { family: 'pending', cls: 'bg-pending-bg text-pending-fg border-pending-line' },
  Unanswered: { family: 'negative', cls: 'bg-negative-bg text-negative-fg border-negative-line' },
}

export function StrengthChip({ strength }: { strength: Strength }) {
  const s = STRENGTH_STYLE[strength]
  return (
    <span data-testid="strength" className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-0.5 text-xs font-medium', s.cls)}>
      <StatusGlyph family={s.family} />
      {strength}
    </span>
  )
}

const STATE_STYLE: Record<SentenceState, { family: StatusFamily; cls: string }> = {
  Approved: { family: 'positive', cls: 'bg-positive-bg text-positive-fg border-positive-line' },
  'Approved without citation': { family: 'pending', cls: 'bg-pending-bg text-pending-fg border-pending-line' },
  'Needs update': { family: 'pending', cls: 'bg-pending-bg text-pending-fg border-pending-line' },
  'No citation': { family: 'negative', cls: 'bg-negative-bg text-negative-fg border-negative-line' },
  'To review': { family: 'neutral', cls: 'bg-neutral-bg text-neutral-fg border-neutral-line' },
}

export function StateChip({ state }: { state: SentenceState }) {
  const s = STATE_STYLE[state]
  return (
    <span data-testid="sentence-state" className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-0.5 text-xs font-medium', s.cls)}>
      <StatusGlyph family={s.family} />
      {state}
    </span>
  )
}

// ─── text with live numbers ─────────────────────────────────────────────────

/** "7 of 20" and "4 of the 14" are the live counts. They are set in a heavier weight so the numbers are easy to check. */
export function NumberText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\b\d+ of (?:the )?\d+\b)/g)
  return (
    <span className={className}>
      {parts.map((p, i) => (i % 2 ? <b key={i} className="font-semibold tabular-nums">{p}</b> : <span key={i}>{p}</span>))}
    </span>
  )
}

// ─── citations ──────────────────────────────────────────────────────────────

export function CitationChips({ cites, onOpen, onRemove }: { cites: { cit: Citation; resolved: Resolved }[]; onOpen?: (c: Citation) => void; onRemove?: (c: Citation) => void }) {
  return (
    <span className="flex flex-wrap gap-1">
      {cites.map(({ cit, resolved }) => (
        <span key={`${cit.kind}:${cit.id}`} data-testid="citation" data-broken={resolved.kind === 'broken'} className={cn('inline-flex max-w-full items-center rounded-xs border text-xs', resolved.kind === 'broken' ? 'border-negative-line bg-negative-bg text-negative-fg' : 'border-mist bg-surface text-graphite')}>
          <button type="button" disabled={!onOpen} onClick={() => onOpen?.(cit)} title={resolved.kind === 'broken' ? resolved.why : undefined} className="truncate px-2 py-0.5 hover:bg-haze disabled:hover:bg-transparent">
            {citationLabel(cit, resolved)}
          </button>
          {onRemove && (
            <button type="button" aria-label={`Remove citation ${citationLabel(cit, resolved)}`} onClick={() => onRemove(cit)} className="border-l border-mist px-1.5 py-0.5 hover:bg-haze">
              ×
            </button>
          )}
        </span>
      ))}
    </span>
  )
}

// ─── a quote, with an inline clip ───────────────────────────────────────────

/** A real quote with where it came from. Play opens the shared mock player right here, so the Researcher never leaves the report. */
export function QuoteCard({ ex, codeName, compact }: { ex: Excerpt; codeName?: string; compact?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const rec = findReviewRecord(ex.sessionId)
  return (
    <li data-testid="quote" data-session={ex.sessionId} data-participant={ex.participantId} data-at={ex.atSec} className="rounded-sm border border-mist bg-surface px-3 py-2.5">
      <p className={cn('font-serif leading-snug text-ink', compact && 'text-sm')}>“{ex.text}”</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-graphite">
        <span>{ex.participantId}</span>·<span>{petOf(ex.participantId)} owner</span>·<span>Session {ex.sessionId}</span>·<span className="tabular-nums">{mmss(ex.atSec)}</span>
        {codeName && <>·<span>{codeName}</span></>}
        {ex.corrected && <>·<span>corrected transcript</span></>}
        <button type="button" className={cn(MINI, 'ml-auto')} aria-expanded={playing} onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Hide clip' : 'Play clip'}
        </button>
      </p>
      {playing && <ClipPlayer className="mt-2" label={`${ex.participantId} · ${questionLabel(ex.questionId)}`} startSec={ex.atSec} caption={ex.text} audioOnly={rec?.media === 'Audio only'} />}
    </li>
  )
}
