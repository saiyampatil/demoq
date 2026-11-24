// The small state dot Audio summary uses beside a line. (This file held the old A3 workspace context too; the report page was rebuilt
// and that went with it. Only what another page still imports is kept here.)
import { cn } from '@/components/cn'

/** The three looks of a sentence's dot. A shape for each, so it never depends on colour. */
export type Dot = 'not-approved' | 'approved' | 'edited'
export const DOT_LABEL: Record<Dot, string> = { 'not-approved': 'Not approved', approved: 'Approved', edited: 'Edited' }
const DOT_STYLE: Record<Dot, string> = { 'not-approved': 'text-pending-fg', approved: 'text-positive-fg', edited: 'text-iris-700' }

/** The state of one sentence, in the margin of the prose: a half circle when it still needs approving, a tick when approved, a filled circle when it was edited and not yet approved. */
export function StateDot({ dot, why }: { dot: Dot; why?: string }) {
  const glyph =
    dot === 'approved' ? (
      <path d="m2 6.3 2.6 2.6L10 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ) : dot === 'edited' ? (
      <>
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6" cy="6" r="2" fill="currentColor" />
      </>
    ) : (
      <>
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 1.8a4.2 4.2 0 0 1 0 8.4Z" fill="currentColor" />
      </>
    )
  const label = `${DOT_LABEL[dot]}${why ? `: ${why}` : ''}`
  return (
    <span data-testid="state-dot" data-dot={dot} role="img" aria-label={label} title={label} className={cn('mr-1 inline-block size-3 shrink-0 translate-y-[1px]', DOT_STYLE[dot])}>
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        {glyph}
      </svg>
    </span>
  )
}
