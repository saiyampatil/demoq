// One session list per study. Fieldwork reads every session; Review reads the ones that ended.
// A session is in Fieldwork until it ends, then in Review. Never both.

import { reviewSessions, type ReviewSession } from '@/mock/review'
import { applyReview } from './decisions'
import type { ReviewState } from './reviewState'
import { moderatorName, sessionCountOf, type FieldworkDoc, type Outcomes } from './fieldwork'

/** The review queue: the study's completed sessions, each with its review record. */
export function reviewList(doc: FieldworkDoc | undefined, state?: ReviewState): ReviewSession[] {
  if (!doc) return []
  return doc.sessions.flatMap((s) => {
    const r = s.status === 'Completed' ? reviewSessions.find((x) => x.id === s.id) : undefined
    if (!r) return []
    const sessionCount = sessionCountOf(doc, s)
    const base = s.mode === 'ai' ? { ...r, sessionCount } : { ...r, sessionCount, moderator: moderatorName(s.moderatorId), moderatorType: 'Human' as const }
    return [applyReview(base, state?.events[s.id])]
  })
}

export const awaitingReview = (doc: FieldworkDoc | undefined, state?: ReviewState) => reviewList(doc, state).filter((r) => r.status === 'Under review').length

/** Review outcome by session, for the numbers on Fieldwork that depend on it. */
export const outcomesOf = (review: ReviewSession[]): Outcomes => new Map(review.map((r) => [r.id, r.status]))
