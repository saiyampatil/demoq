// Small parts of the Concepts tab: the Match chip, the three measure cells, and the plain-words note for a concept that can't be compared yet.

import { cn } from '@/components/cn'
import { AlertIcon, CheckIcon } from '@/components/icons'
import type { ConceptRow, Match, Measure, MeasureKey } from '@/state/concepts'
import type { ConceptDef } from '@/mock/concepts'
import type { CodebookDoc } from '@/state/codebook'

const MATCH: Record<Match, { label: string; cls: string; tip: string }> = {
  Agrees: { label: 'Agrees', cls: 'border-positive-line bg-positive-bg text-positive-fg', tip: 'What people said, did and showed point the same way.' },
  Differs: { label: 'Differs', cls: 'border-pending-line bg-pending-bg text-pending-fg', tip: 'Its rank moves two places or more between what people said, did and showed, and the shares are clearly apart.' },
  'Not enough': { label: 'Not enough', cls: 'border-dashed border-mist-strong bg-transparent text-graphite', tip: 'Needs at least two of Said, Did and Showed to compare.' },
}

/** Agrees or Differs, with an icon and the word. A concept with too few measures says so. */
export function MatchChip({ match, className }: { match: Match; className?: string }) {
  const m = MATCH[match]
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs font-medium whitespace-nowrap', m.cls, className)} title={`${m.label}: ${m.tip}`} data-testid="match-chip" data-match={match}>
      {match === 'Agrees' ? <CheckIcon size={12} /> : match === 'Differs' ? <AlertIcon size={12} /> : <span aria-hidden="true" className="w-3 text-center">–</span>}
      {m.label}
    </span>
  )
}

/** What each measure counts, in a few words. Shown as the tooltip of a column and in the grey line under the table. */
export const MEASURE_WORDS: Record<MeasureKey, { label: string; short: string; tip: string }> = {
  said: { label: 'Said', short: 'picked it first', tip: 'People who said they would pick it first, of the people who saw it.' },
  did: { label: 'Did', short: 'chose it in the choice task', tip: 'People who chose it in the choice task, of the people who saw it and finished the task.' },
  showed: { label: 'Showed', short: 'warmest first reaction, people on video', tip: 'People whose warmest first reaction, in the first five seconds after the reveal, was to this concept. Only people on video who consented, and who saw it.' },
}

/**
 * One measure as “n of N people”, right-aligned and tabular. The highest in its column is bold. The base is each concept’s own, so it is always
 * written out. Greyed when it cannot be compared, and a dash when there is no number.
 */
export function MeasureCell({ m, lead, grey, kind, why }: { m?: Measure; lead: boolean; grey?: boolean; kind: MeasureKey; why?: string }) {
  if (!m) return <span className="text-right text-xs text-muted" data-testid={`cell-${kind}`} title={why}>—</span>
  return (
    <span className={cn('text-right text-[13px] leading-5 whitespace-nowrap tabular-nums', grey ? 'text-muted' : lead ? 'font-semibold text-ink' : 'text-graphite')} data-testid={`cell-${kind}`} data-lead={lead && !grey ? 'true' : undefined} data-n={m.n} data-of={m.of} title={`${MEASURE_WORDS[kind].tip}${grey ? ' Greyed: too few people on video to compare.' : ''}`}>
      {m.n} of {m.of}
      {lead && !grey && <span className="sr-only"> (highest)</span>}
    </span>
  )
}

/** Why a concept has no line yet, in plain words. */
export function conceptNote(row: ConceptRow, defs: ConceptDef[], doc: CodebookDoc): string {
  const own = defs.find((d) => d.id === row.id)!
  const name = (id: string) => doc.codes.find((c) => c.id === id)?.name ?? id
  if (!row.said) return `Accept “${name(own.codeId)}” in the codebook to read what people said.`
  const waiting = defs.filter((d) => d.id !== row.id && !doc.codes.find((c) => c.id === d.codeId && c.status === 'Accepted'))
  if (waiting.length) return `Waiting on the codebook: accept ${waiting.map((d) => `“${name(d.codeId)}”`).join(' and ')} to compare the concepts.`
  return 'Needs at least two of Said, Did and Showed.'
}
