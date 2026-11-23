// What the A2 pages share: the verdict and match chips, the "How it’s decided" popover, the Play link, and the one face chip the
// Tensions tab still uses. The Themes tab's own parts are in ./themes.

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/components/cn'
import { screenById, studyPath } from '@/routes/screens'
import { EMOTION_HINT, type Emotion, type Fit, type FitPattern } from '@/state/emotion'
import { DELIVERY_RULE_LINES, FIT_COLOUR, FIT_DEF, FIT_LABEL, FIT_ORDER, VERDICT_COLOUR, VERDICT_DEF, VERDICT_LABEL, VERDICT_ORDER, SIDE_DEF, SIDE_LABEL, verdictLabel, type Chip, type FitKey } from '@/config/delivery'

/** A Face or Speech reading: a dot in its own colour and plain text, never a filled pill. Only a verdict or a match chip is a pill. */
const readingBase = 'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-ink'

export const EMOTION_FILL: Record<Emotion, string> = {
  Delight: 'bg-emo-delight',
  Interest: 'bg-emo-interest',
  Surprise: 'bg-emo-surprise',
  Neutral: 'bg-emo-neutral',
  Confusion: 'bg-emo-confusion',
  Doubt: 'bg-emo-doubt',
  Frustration: 'bg-emo-frustration',
}

/**
 * An emotion with its strength. `reads` writes it as an interpretation ("reads as Doubt"), which is how every single
 * face reading is shown. Surprise reads as in between, so it takes the sand tone rather than positive or negative.
 */
export function EmotionChip({ emotion, intensity, corrected, reads, className }: { emotion: Emotion | null; intensity?: string; corrected?: boolean; reads?: boolean; className?: string }) {
  if (!emotion)
    return (
      <span className={cn(readingBase, 'font-normal text-muted', className)} data-reading="face">
        <span aria-hidden="true" className="size-2 rounded-full border border-dashed border-mist-strong" />
        No clear expression
      </span>
    )
  return (
    <span className={cn(readingBase, className)} title={EMOTION_HINT[emotion]} data-reading="face">
      <span aria-hidden="true" className={cn('size-2 rounded-full', EMOTION_FILL[emotion])} />
      {reads && <span className="font-normal">reads as</span>}
      {emotion}
      {intensity && emotion !== 'Neutral' && <span className="font-normal text-graphite">· {intensity.toLowerCase()}</span>}
      {corrected && <span className="font-normal text-graphite">· corrected</span>}
    </span>
  )
}

/** The five icons: check, tilde, alert, dash, dotted circle. Colour is never the only carrier of a verdict. */
function VerdictIcon({ kind }: { kind: FitPattern | FitKey }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, 'data-icon': kind }
  switch (kind) {
    case 'Consistent':
    case 'Matches':
      return <svg {...common}><path d="m2.5 6.4 2.3 2.3 4.7-5" /></svg>
    case 'Mixed':
      return <svg {...common}><path d="M1.8 6.6c1.2-2 2.4-2 3.6-.6s2.4 1.4 3.6-.6" transform="translate(.4 0)" /></svg>
    case 'Conflicting':
      return <svg {...common}><path d="M6 1.8 11 10.2H1z" /><path d="M6 5v2.4M6 8.9v.1" /></svg>
    case 'No claim':
      return <svg {...common}><path d="M2.8 6h6.4" /></svg>
    case 'Too few to read':
      return <svg {...common} strokeDasharray="1.6 1.9"><circle cx="6" cy="6" r="4" /></svg>
    case 'Pulls against':
      return <svg {...common}><path d="m3 3 6 6M9 3 3 9" /></svg>
    case 'Uncertain':
      return <svg {...common}><path d="M2.4 6h.1M6 6h.1M9.5 6h.1" strokeWidth={2.2} /></svg>
  }
}

const pillStyle = (c: Chip) => ({ background: c.bg, color: c.fg, borderColor: c.line, borderStyle: c.dotted ? ('dotted' as const) : ('solid' as const) })
const pillBase = 'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs font-medium whitespace-nowrap'

/** The row verdict: a filled pill with an icon and its label, and its one-line definition as the tooltip. The only pill on the table. */
export function FitChip({ pattern, label }: { pattern: FitPattern; label?: string }) {
  return (
    <span className={pillBase} style={pillStyle(VERDICT_COLOUR[pattern])} title={`${VERDICT_LABEL[pattern]}: ${VERDICT_DEF[pattern]}`} data-verdict-chip={pattern} data-testid="verdict-pill">
      <VerdictIcon kind={pattern} />
      {label ? `${label} · ${verdictLabel(pattern)}` : verdictLabel(pattern)}
    </span>
  )
}

/** One person against their words: Matched, No match or Hesitant, in the same filled pill, icon and tooltip. */
export function OneFitChip({ fit, against }: { fit: Fit; against: string[] }) {
  return (
    <span className={pillBase} style={pillStyle(FIT_COLOUR[fit])} title={against.length ? `${FIT_LABEL[fit]} on: ${against.join(', ').toLowerCase()}. ${FIT_DEF[fit]}` : `${FIT_LABEL[fit]}: ${FIT_DEF[fit]}`} data-fit-chip={fit}>
      <VerdictIcon kind={fit} />
      {FIT_LABEL[fit]}
    </span>
  )
}

/** The rule in five lines, behind a small link, so the table itself stays clear. Closes on Escape or a click elsewhere. */
export function HowItsDecided() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} data-testid="how-decided" className="rounded-xs text-xs font-medium text-iris-700 hover:underline">
        How it’s decided
      </button>
      {open && (
        <div role="dialog" aria-label="How it’s decided" data-testid="how-decided-pop" className="absolute top-full right-0 z-30 mt-1.5 max-h-[70vh] w-96 overflow-y-auto rounded-sm border border-mist bg-surface p-3 text-left text-xs font-normal text-ink shadow-overlay">
          <ol className="flex flex-col gap-1.5">
            {DELIVERY_RULE_LINES.map((l, i) => (
              <li key={i} data-testid="how-decided-line" className="flex gap-2">
                <span aria-hidden="true" className="text-graphite tabular-nums">{i + 1}.</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 mb-1 font-semibold">The row verdict</p>
          <ul className="flex flex-col gap-1.5" data-testid="how-decided-verdicts">
            {VERDICT_ORDER.map((v) => (
              <li key={v} data-testid="how-decided-verdict" className="flex items-start gap-2">
                <span className="w-24 shrink-0"><FitChip pattern={v} /></span>
                <span>{VERDICT_DEF[v]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 mb-1 font-semibold">Did their delivery match their words?</p>
          <ul className="flex flex-col gap-1.5" data-testid="how-decided-fits">
            {FIT_ORDER.map((f) => (
              <li key={f} data-testid="how-decided-fit" className="flex items-start gap-2">
                <span className="w-24 shrink-0"><OneFitChip fit={f} against={[]} /></span>
                <span>{FIT_DEF[f]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 mb-1 font-semibold">What people said</p>
          <ul className="flex flex-col gap-1" data-testid="how-decided-words">
            {(Object.keys(SIDE_LABEL) as (keyof typeof SIDE_LABEL)[]).map((k) => (
              <li key={k} data-testid="how-decided-word"><span className="font-medium">{SIDE_LABEL[k]}</span>: {SIDE_DEF[k]}</li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
}


export const playHref = (studyId: string, sessionId: string, atSec: number) =>
  `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', sessionId) })}?from=signals&at=${atSec}`
