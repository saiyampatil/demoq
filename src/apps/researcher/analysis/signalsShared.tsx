// What the A2 table, the theme panel and the code panel share: the short cell labels, a theme's reading and status, and accepting a reading.

import { useEffect, useState } from 'react'
import { cn } from '@/components/cn'
import { readingWord } from '@/config/labels'
import type { ReadingLabel } from '@/config/readings'
import { setReading, type ReadingDecision } from '@/state/codebook'
import { EMOTIONS, type EmotionSplit } from '@/state/emotion'
import { codeSignals, themeSignals, type CodeSignal, type Tension, type ThemeSignal } from '@/state/signals'
import { decisionFor, isAccepted, needsReview, readingOf, statusOf, tensionsOfTheme, type Reading, type ReadingStatus } from '@/state/themeReadings'
import { noReading } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { DOT, FILLED, toneOfReading } from './verdictStyle'

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
export const r1 = (x: number) => Math.round(x * 10) / 10

/** One short label for faces, by polarity and with its base: "2 of 3 positive", "3 of 5 negative", "All neutral". Never leads with Neutral. */
export function emotionSummary(e: EmotionSplit) {
  if (!e.read) return 'No faces read'
  const { Positive: pos, Negative: neg, Neutral: neu, Unclear: unc } = e.valence
  if (neu === e.read) return 'All neutral'
  if (pos > neg) return `${pos} of ${e.read} positive`
  if (neg > pos) return `${neg} of ${e.read} negative`
  if (pos > 0) return 'Even split'
  return `${unc} of ${e.read} confused`
}
/** The detail behind the label, for a tooltip: how many faces were read, and how many of each expression. */
export const emotionSummaryTitle = (e: EmotionSplit) => {
  const gap = noReading(e)
  const each = EMOTIONS.filter((x) => e.counts[x]).map((x) => `${x} ${e.counts[x]}`)
  return `${e.read} faces read${gap ? `, ${gap}` : ''}${each.length ? `: ${each.join(', ')}` : ''}`
}
/** The tone label, always with its base: "6 of 14 flat or tense", or "None flat or tense". */
export function toneLabel(r: { tones: { counts: { Flat: number; Tense: number }; n: number } }) {
  const off = r.tones.counts.Flat + r.tones.counts.Tense
  return off > 0 ? `${off} of ${r.tones.n} flat or tense` : 'None flat or tense'
}
export const toneTitle = (r: { tones: { counts: Record<string, number>; n: number }; marked: number; some: number }) =>
  `Tone: ${r.tones.counts.Tense} tense, ${r.tones.counts.Flat} flat, ${r.tones.counts.Animated} animated, ${r.tones.counts.Even} even, of ${r.tones.n}. Certainty: marked hesitation in ${r.marked}, some in ${r.some}.`

/** A theme's reading: a filled chip, never the same style as a code's verdict. */
export function ReadingChip({ label }: { label: ReadingLabel }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap', FILLED[toneOfReading(label)])} data-testid="reading-chip" data-key={label}>
      {readingWord(label)}
    </span>
  )
}
/** Didn't fit, unsure, fit as one thin bar with its three counts. */
export function ReadingBar({ p, u, m }: { p: number; u: number; m: number }) {
  const total = p + u + m
  return (
    <span className="flex flex-col gap-0.5" data-testid="reading-bar" title={`${p} didn’t fit, ${u} unsure, ${m} fit`}>
      <span className="flex h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
        {[
          [p, DOT.doesnt],
          [u, DOT.unsure],
          [m, DOT.fits],
        ].map(([n, c], i) => (
          <span key={i} className={cn('h-full', c as string)} style={{ width: `${total ? ((n as number) / total) * 100 : 0}%` }} />
        ))}
      </span>
      <span className="text-[11px] leading-none text-muted tabular-nums">
        {p} · {u} · {m}
      </span>
    </span>
  )
}

export const STATUS_TEXT: Record<ReadingStatus, string> = { Suggested: 'text-graphite', 'Out of date': 'text-pending-fg', Accepted: 'text-positive-fg', Edited: 'text-positive-fg', 'Label changed': 'text-positive-fg', 'Left out': 'text-muted' }
/** The status as a chip: Suggested outlined, Accepted with a green check, Out of date amber. */
export function StatusChip({ status }: { status: ReadingStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap',
        status === 'Suggested' ? 'border-mist-strong bg-surface text-graphite' : status === 'Out of date' ? 'border-pending-line bg-pending-bg text-pending-fg' : status === 'Left out' ? 'border-dashed border-mist-strong bg-surface text-muted' : 'border-positive-line bg-positive-bg text-positive-fg',
      )}
      data-testid="status-chip"
    >
      {(status === 'Accepted' || status === 'Edited' || status === 'Label changed') && (
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {status === 'Label changed' ? 'Edited' : status}
    </span>
  )
}

/** A theme with its reading and where the Researcher stands on it. */
export type ThemeRow = { t: ThemeSignal; reading: Reading; decision?: ReadingDecision; status: ReadingStatus; tensions: Tension[] }

/** Every theme's reading and status, computed from the codebook. Used by the table and the footer. */
export function themeRows(doc: CodebookCtx['doc'], basis: CodebookCtx['basis'], tensions: Tension[], signals: CodeSignal[] = codeSignals(doc, basis)): ThemeRow[] {
  return themeSignals(doc, basis, signals)
    .filter((t) => t.kind === 'theme')
    .map((t) => {
      const reading = readingOf(t, doc, tensions)
      const decision = doc.readings?.[t.id]
      return { t, reading, decision, status: statusOf(decision, reading), tensions: tensionsOfTheme(t, tensions) }
    })
}
export const readingCounts = (rows: ThemeRow[]) => ({
  accepted: rows.filter((r) => isAccepted(r.status)).length,
  review: rows.filter((r) => needsReview(r.status)).length,
  suggested: rows.filter((r) => r.status === 'Suggested').length,
})

/** Accepts a reading as PulseAI wrote it: who, when and the data version. */
export function acceptRow(ctx: CodebookCtx, row: ThemeRow, toast: (m: string) => void) {
  const theme = { id: row.t.id, name: row.t.name }
  ctx.act((d) => setReading(d, theme, decisionFor(row.reading, row.decision, ctx.me, ctx.basis.sessions.size, { status: 'Accepted' }), row.status === 'Out of date' ? 'Reading re-accepted' : 'Reading accepted', ctx.me, row.reading.label))
  toast(`“${row.t.name}” reading accepted. It goes to the report.`)
}

/** "18 Nov, 16:20". */
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const EXPANDED = (studyId: string) => `pulseai-qual:a2-expanded:${studyId}`
export function useExpanded(studyId: string) {
  const [open, setOpen] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED(studyId)) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED(studyId), JSON.stringify([...open]))
    } catch {
      // A convenience only.
    }
  }, [open, studyId])
  return [open, setOpen] as const
}
