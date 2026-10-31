// Dev-only consistency check. The numbers the screens show must agree because they come from one place
// (state/selectors.ts); this proves it, and logs every disagreement it finds.

import type { ReviewSession } from '@/mock/review'
import type { FieldworkDoc } from './fieldwork'
import { countedSessions, funnel, outcomesOf, progress, reviewCounts, slotLedger, towardSessions, validationOf } from './selectors'

export function checkInvariants(doc: FieldworkDoc, review: ReviewSession[], target: number, stepperBadge: number | null): string[] {
  const out: string[] = []
  const outcomes = outcomesOf(review)
  const counts = reviewCounts(review)
  const counted = countedSessions(doc)
  const prog = progress(doc, outcomes)
  const ledger = slotLedger(doc, target, outcomes)
  const flow = funnel(doc, outcomes)

  // 1. Completed (counted) = Under review + Accepted + Excluded.
  if (counted.length !== counts.underReview + counts.accepted + counts.excluded) out.push(`1: ${counted.length} counted, but ${counts.underReview} under review + ${counts.accepted} accepted + ${counts.excluded} excluded`)
  if (review.length !== counted.length) out.push(`1: the review queue has ${review.length} sessions, ${counted.length} are counted`)
  // 2. Counting toward the target = Accepted + Under review. Excluded never counts.
  if (prog.toward !== counts.accepted + counts.underReview) out.push(`2: ${prog.toward} toward the target, but ${counts.accepted} accepted + ${counts.underReview} under review`)
  if (towardSessions(doc, outcomes).some((s) => outcomes.get(s.id) === 'Excluded')) out.push('2: an Excluded session counts toward the target')
  // 3. The slot ledger has one box per target slot: counting boxes are Accepted or Under review.
  if (ledger.slots.length !== target) out.push(`3: ${ledger.slots.length} slot boxes for a target of ${target}`)
  if (ledger.confirmed !== counts.accepted || ledger.pending !== counts.underReview) out.push(`3: the ledger shows ${ledger.confirmed} accepted and ${ledger.pending} under review, review has ${counts.accepted} and ${counts.underReview}`)
  const green = ledger.slots.filter((x) => x === 'accepted').length
  const amber = ledger.slots.filter((x) => x === 'review').length
  if (green !== Math.min(counts.accepted, target) || green + amber !== Math.min(prog.toward, target)) out.push(`3: ${green} green and ${amber} amber boxes, ${counts.accepted} accepted and ${counts.underReview} under review`)
  // 4. Funnel "Completed" = Review queue "Completed interviews".
  if (flow.completed.n !== counts.total) out.push(`4: the funnel has ${flow.completed.n} completed, the review queue ${counts.total}`)
  // 5. Stepper Review badge = Under review count.
  if (stepperBadge !== null && stepperBadge !== counts.underReview) out.push(`5: the stepper badge says ${stepperBadge}, ${counts.underReview} are under review`)
  // 6. Funnel stages sum to Invited.
  if (flow.sum !== flow.total) out.push(`6: the funnel places ${flow.sum} people, ${flow.total} were invited`)
  // 7. No session has a validation status unless it is Completed.
  doc.sessions.forEach((s) => {
    if (s.status !== 'Completed' && (s.validationStatus !== null || validationOf(outcomes, s) !== null)) out.push(`7: ${s.id} is ${s.status} but has a validation status`)
    if (s.status === 'Completed' && s.validationStatus === null) out.push(`7: ${s.id} is Completed with no validation status`)
  })
  return out
}
