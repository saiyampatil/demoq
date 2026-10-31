// Review decisions (PRD 4.8 Step 6). A session's status is not stored: it is worked out from the history of what
// happened to it, so a decision can be reopened without erasing anything, and every count that reads the status
// (R18 progress, the verdict, the funnel, R21's cards, the stepper) moves when a decision does.

import { scoreBreakdown, seedEvents, type OpenClarification, type ReviewEvent, type ReviewSession, type ReviewStatus, type Decision } from '@/mock/review'
import { inviteFromReserve, type FieldworkDoc, type Outcomes, type ReserveCandidate } from './fieldwork'
import { shortfall, progress } from './selectors'

/** The session as the Researcher sees it now: status, decision, open clarification, dismissed flags and scores from its history. */
export function applyReview(base: ReviewSession, stored: ReviewEvent[] = []): ReviewSession {
  const events = [...seedEvents(base), ...stored].map((e, i) => ({ e, i })).sort((a, b) => new Date(a.e.at).getTime() - new Date(b.e.at).getTime() || a.i - b.i).map((x) => x.e)
  let status: ReviewStatus = 'Under review'
  let decision: Decision | undefined
  let open: OpenClarification | undefined
  const dismissed: NonNullable<ReviewSession['dismissed']> = {}
  for (const e of events) {
    if (e.type === 'decision') {
      status = e.outcome
      decision = { by: e.by, at: e.at, note: e.note, reasons: e.reasons }
      open = undefined
    } else if (e.type === 'reopen') {
      status = 'Under review'
      decision = undefined
    } else if (e.type === 'clarify') open = { id: e.id, to: e.to, message: e.message, flagIds: e.flagIds, by: e.by, at: e.at }
    else if (e.type === 'answer') {
      if (open?.id === e.replyTo) open = undefined
    } else if (e.type === 'dismiss') dismissed[e.flagId] = { by: e.by, at: e.at, reason: e.reason }
  }
  const gone = new Set(Object.keys(dismissed))
  return {
    ...base,
    status,
    decision,
    awaiting: status === 'Under review' ? open : undefined,
    dismissed,
    events,
    baseScores: { integrity: base.integrity, quality: base.quality },
    integrity: base.scored ? scoreBreakdown(base, 'Integrity', gone).score : 0,
    quality: base.scored ? scoreBreakdown(base, 'Quality', gone).score : 0,
  }
}

/** Earlier decisions and reopens, oldest first, for the decision record. The current decision is the last of the decisions. */
export function decisionHistory(s: ReviewSession) {
  const list = (s.events ?? []).filter((e): e is Extract<ReviewEvent, { type: 'decision' | 'reopen' }> => e.type === 'decision' || e.type === 'reopen')
  return s.status === 'Under review' ? list : list.slice(0, -1)
}

// ─── the effect of a decision, computed before it is confirmed (4.8 Q3) ─────

export type Effect = { confirmed: [number, number]; pending: [number, number]; counting: [number, number]; gap: [number, number]; target: number }

/**
 * What the study's numbers would be before and after, worked out with the same functions the screens use: the
 * outcome of one session changes, and optionally a reserve person is invited. Nothing is written.
 */
export function effectOf(doc: FieldworkDoc, target: number, outcomes: Outcomes, reserve: ReserveCandidate[], change: { sessionId: string; to: ReviewStatus }, invite?: ReserveCandidate): Effect {
  const next = new Map(outcomes)
  next.set(change.sessionId, change.to)
  const doc2 = invite ? inviteFromReserve(doc, 'preview', [invite]) : doc
  const reserve2 = invite ? reserve.filter((c) => c.id !== invite.id) : reserve
  const a = progress(doc, outcomes)
  const b = progress(doc2, next)
  return {
    confirmed: [a.confirmed, b.confirmed],
    pending: [a.pending, b.pending],
    counting: [a.toward, b.toward],
    gap: [shortfall(doc, target, outcomes, reserve).gap, shortfall(doc2, target, next, reserve2).gap],
    target,
  }
}

/** The computed effect as short lines: only what changes, plus what stays. */
export function effectLines(e: Effect): string[] {
  const out: string[] = []
  if (e.confirmed[0] !== e.confirmed[1]) out.push(`Confirmed (accepted) ${e.confirmed[0]} → ${e.confirmed[1]}`)
  if (e.pending[0] !== e.pending[1]) out.push(`Pending (under review) ${e.pending[0]} → ${e.pending[1]}`)
  out.push(e.counting[0] !== e.counting[1] ? `Counting toward the target ${e.counting[0]} → ${e.counting[1]} of ${e.target}` : `Counting toward the target stays ${e.counting[0]} of ${e.target}`)
  out.push(e.gap[0] !== e.gap[1] ? `Open slots (the gap) ${e.gap[0]} → ${e.gap[1]}` : `Open slots (the gap) stay ${e.gap[0]}`)
  return out
}
