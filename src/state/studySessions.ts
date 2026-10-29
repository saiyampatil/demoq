// One session list per study. Fieldwork reads every session; Review reads the ones that ended.
// A session is in Fieldwork until it ends, then in Review. Never both.

import { reviewSessions, type ReviewSession } from '@/mock/review'
import { moderatorName, type FieldworkDoc } from './fieldwork'

/** The review queue: the study's completed sessions, each with its review record. */
export function reviewList(doc: FieldworkDoc | undefined): ReviewSession[] {
  if (!doc) return []
  return doc.sessions.flatMap((s) => {
    const r = s.status === 'Completed' ? reviewSessions.find((x) => x.id === s.id) : undefined
    if (!r) return []
    return [s.mode === 'ai' ? r : { ...r, moderator: moderatorName(s.moderatorId), moderatorType: 'Human' as const }]
  })
}

export const awaitingReview = (doc: FieldworkDoc | undefined) => reviewList(doc).filter((r) => r.status === 'Under review').length
