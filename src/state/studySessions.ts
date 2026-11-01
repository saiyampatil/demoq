// One list of sessions per study. Fieldwork reads every session; Review reads the counted ones (the latest Completed
// session of each participant). A session is in Review the moment it completes, whether or not it has been scored.

import { findReviewRecord, unscoredSession, type ReviewSession } from '@/mock/review'
import { applyReview } from './decisions'
import type { ReviewState } from './reviewState'
import { moderatorName, sessionCountOf, type FieldworkDoc } from './fieldwork'
import { countedSessions } from './selectors'

/** The review queue: every counted session, each with its review record. A session with no scores yet is Not scored yet. */
export function reviewList(doc: FieldworkDoc | undefined, state?: ReviewState): ReviewSession[] {
  if (!doc) return []
  return countedSessions(doc).map((s) => {
    const sessionCount = sessionCountOf(doc, s)
    const r = findReviewRecord(s.id)
    const base = r
      ? s.mode === 'ai'
        ? { ...r, sessionCount }
        : { ...r, sessionCount, moderator: moderatorName(s.moderatorId), moderatorType: 'Human' as const }
      : unscoredSession({
          id: s.id,
          participantId: s.participantId,
          no: s.no,
          count: sessionCount,
          moderator: moderatorName(s.moderatorId),
          human: s.mode === 'human',
          release: doc.releaseVersion,
          guide: `Guide v${doc.plan.guideVersion}`,
          completedAt: s.events[s.events.length - 1]?.at ?? s.startedAt ?? doc.window?.start ?? '',
          durationMin: s.durationMin ?? doc.plan.durationMin,
          turnCount: s.transcript.length,
          stimuli: [],
        })
    return applyReview(base, state?.events[s.id])
  })
}
