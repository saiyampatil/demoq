// The shared pieces of the A2 screen (Themes, Concepts, Tensions, Review mode), in one place, all reading the tokens in styles/tokens.css:
//   respondent quote · face chip · concept letter · tab badge · segmented person bar · panel skeleton · inline error · face "Not right?" · back link.
// Colour families stay apart: verdict and delivery (config/delivery), status (InsightStatusChip), tension flag (pending), primary actions (iris),
// faces (the one teal family), concept letters (A, B, C). Every chip carries an icon and words, never colour alone.

import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { correctFace, type FaceFix } from '@/state/codebook'
import { EMOTIONS, type Emotion } from '@/state/emotion'
import type { CodebookCtx } from '../codebookCtx'
import { usePopover } from '../themes/Bits'

/** What a respondent said: Newsreader italic, and nothing else on the page is set this way. */
export function RespondentQuote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('quote text-ink', className)} data-testid="respondent-quote">“{children}”</p>
}

const CONCEPT_TONE: Record<string, string> = {
  A: 'border-concept-a-line bg-concept-a-bg text-concept-a-fg',
  B: 'border-concept-b-line bg-concept-b-bg text-concept-b-fg',
  C: 'border-concept-c-line bg-concept-c-bg text-concept-c-fg',
}
/** The letter of a concept card, in its own tint. */
export function ConceptLetter({ letter, className }: { letter: string; className?: string }) {
  return (
    <span aria-hidden="true" data-testid="concept-letter" className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-xs border text-xs font-semibold', CONCEPT_TONE[letter] ?? CONCEPT_TONE.A, className)}>
      {letter}
    </span>
  )
}

const FaceIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
    <circle cx="6" cy="6" r="4.6" />
    <path d="M4.2 7.2c.5.7 1 1 1.8 1s1.3-.3 1.8-1" />
    <path d="M4.4 4.6v.1M7.6 4.6v.1" strokeWidth="1.6" />
  </svg>
)
export const confidenceWord = (c: number) => (c >= 0.8 ? 'High' : c >= 0.6 ? 'Medium' : 'Low')

/** A face reading, only ever worded "reads as {label} · {confidence}", in the face family. The visible cue is shown before it, by the caller. */
export function FaceChip({ label, confidence, corrected, at, className }: { label: Emotion | null; confidence?: number; corrected?: boolean; at?: string; className?: string }) {
  return (
    <span data-reading="face" data-testid="face-chip" className={cn('inline-flex min-h-6 items-center gap-1.5 rounded-full border border-face-line bg-face-bg px-2 text-xs font-medium whitespace-nowrap text-face-fg', className)}>
      <FaceIcon />
      {label ? (
        <>
          reads as {label}
          {at ? ` at ${at}` : ''}
          {confidence !== undefined && ` · ${confidenceWord(confidence)} confidence`}
        </>
      ) : (
        'No clear reading'
      )}
      {corrected && <span className="font-normal">· corrected</span>}
    </span>
  )
}

/** A count badge on a tab: the items still to review. Nothing when there are none. */
export function TabBadge({ n, label, testid }: { n: number; label: string; testid: string }) {
  if (n <= 0) return null
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pending-bg px-1.5 text-xs font-semibold text-pending-fg tabular-nums" aria-label={`${n} ${label}`} data-testid={testid}>
      {n}
    </span>
  )
}

export type BarPerson = { id: string; tone: 'good' | 'warn' | 'quiet' | 'none'; word?: string }
const BAR_TONE: Record<BarPerson['tone'], string> = { good: 'bg-positive-fg', warn: 'bg-pending-fg', quiet: 'bg-tone-flat', none: 'bg-mist-strong' }

/**
 * A segmented bar, one block per person, filling left to right in 300 ms with a 30 ms stagger. Hovering a block shows that person's ID.
 * Counts are always written beside it ("n of N people"): the bar is never the only carrier.
 */
export function PersonBar({ people, label, className }: { people: BarPerson[]; label: string; className?: string }) {
  return (
    <div role="img" aria-label={label} className={cn('flex gap-1', className)} data-testid="person-bar">
      {people.map((p, i) => (
        <span key={p.id} title={`${p.id}${p.word ? ` · ${p.word}` : ''}`} style={{ ['--i' as string]: i }} className={cn('a2-fill h-2 min-w-1.5 flex-1 rounded-full', BAR_TONE[p.tone])} />
      ))}
    </div>
  )
}

/** The panel while it loads: the same shape as the panel, so nothing jumps. */
export function PanelSkeleton() {
  const bar = (w: string, h = 'h-3') => <span className={cn('block animate-pulse rounded-xs bg-haze motion-reduce:animate-none', w, h)} />
  return (
    <div className="flex flex-col gap-5 rounded-md border border-mist bg-surface p-5" data-testid="panel-skeleton" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">{bar('w-24', 'h-5')}{bar('w-3/4', 'h-6')}{bar('w-1/3')}</div>
      <div className="flex flex-col gap-2 rounded-sm border border-mist p-4">{bar('w-full', 'h-5')}{bar('w-5/6', 'h-5')}</div>
      <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <span key={i} className="block h-14 animate-pulse rounded-sm bg-haze motion-reduce:animate-none" />)}</div>
      <div className="flex flex-col gap-2">{bar('w-full')}{bar('w-full')}{bar('w-2/3')}</div>
    </div>
  )
}

/** One inline error line with Retry. The only error treatment on the screen. */
export function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-negative-line bg-negative-bg px-3 py-2 text-sm text-negative-fg" data-testid="inline-error">
      {message}
      <Button size="sm" onClick={onRetry} data-testid="inline-retry">Retry</Button>
    </p>
  )
}

export function BackLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-testid="back-link" className="min-h-9 cursor-pointer self-start rounded-xs text-xs font-medium text-iris-700 hover:underline">
      ← {children}
    </button>
  )
}

/** "Show who" content: the people behind a count, replacing the panel content, each with ID, segment, one word and Play. */
export function PeopleList({ rows, play }: { rows: { id: string; segment: string; word: string; href?: string }[]; play?: boolean }) {
  return (
    <ul className="divide-y divide-mist rounded-sm border border-mist" data-testid="people-list">
      {rows.length === 0 && <li className="px-3 py-2 text-xs text-graphite">Nobody.</li>}
      {rows.map((r) => (
        <li key={r.id} data-testid="tile-person" className="flex flex-wrap items-center gap-x-2 px-3 py-2 text-xs">
          <span className="font-medium tabular-nums">{r.id}</span>
          <span className="text-graphite">{r.segment}</span>
          <span className="text-graphite" data-testid="tile-reason">{r.word}</span>
          {play && r.href && <a href={r.href} className="ml-auto min-h-6 font-medium text-iris-700 hover:underline">Play</a>}
        </li>
      ))}
    </ul>
  )
}

// ─── the one "Not right?" for a face reading ────────────────────────────────

const NO_CLEAR = 'No clear expression' as const
/** What a reading is called on screen. Stored as "No clear expression"; shown as "No clear reading". */
export const readingWord = (to: FaceFix['to']) => (to === NO_CLEAR ? 'No clear reading' : to)

/**
 * Wherever a face reading appears (Concepts first reactions, Said vs showed moments) it has this one correction: pick one of the seven
 * labels or "No clear reading", add a note if you like. It updates the counts, is logged with who and when, and gives a toast with Undo.
 * (On Themes, "Not right?" on a person row corrects their stance, a different thing, not a face.)
 */
export function FaceNotRight({ ctx, fixKey, name, from, who }: { ctx: CodebookCtx; fixKey: string; name: string; from: Emotion; who: string }) {
  const toast = useToast()
  const { open, setOpen, ref } = usePopover()
  const current: FaceFix['to'] = ctx.doc.faceFixes?.[fixKey]?.to ?? from
  const [pick, setPick] = useState<FaceFix['to']>(current)
  const [note, setNote] = useState('')
  const options: FaceFix['to'][] = [...EMOTIONS, NO_CLEAR]
  const confirm = () => {
    const prev = ctx.doc.faceFixes?.[fixKey]
    ctx.act((d) => correctFace(d, fixKey, name, from, pick, { by: ctx.me }, note.trim() || 'No note'))
    setOpen(false)
    toast(`${who}: now “${readingWord(pick)}”`, {
      label: 'Undo',
      onClick: () => ctx.act((d) => correctFace(d, fixKey, name, from, prev?.to ?? from, { by: ctx.me }, prev?.why ?? 'Undone')),
    })
    setNote('')
  }
  return (
    <span ref={ref} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setPick(current); setOpen((o) => !o) }} data-testid="not-right" className="min-h-9 cursor-pointer rounded-xs px-1.5 text-xs text-graphite underline-offset-2 hover:bg-haze hover:text-ink hover:underline">
        Not right?
      </button>
      {open && (
        <div role="dialog" aria-label={`Correct this reading for ${who}`} data-testid="face-fix" className="absolute top-full right-0 z-40 mt-1 flex w-64 flex-col gap-2 rounded-sm border border-mist bg-surface p-3 text-sm shadow-overlay">
          <p className="text-xs font-semibold">Correct this reading</p>
          <p className="text-xs text-graphite">{who} read as {from}. What does the face show?</p>
          <div role="radiogroup" aria-label="What the face shows" className="flex flex-col">
            {options.map((o) => (
              <label key={o} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-xs px-1 hover:bg-haze">
                <input type="radio" name={`fix-${fixKey}`} checked={pick === o} onChange={() => setPick(o)} data-face-option={o} className="accent-[var(--color-face-accent)]" />
                {readingWord(o)}
                {o === from && <span className="text-xs text-muted">PulseAI</span>}
              </label>
            ))}
          </div>
          <TextArea aria-label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} hint="A note is optional." />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={confirm} data-testid="face-fix-save">Save correction</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </span>
  )
}
