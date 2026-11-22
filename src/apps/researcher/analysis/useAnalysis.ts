import { useMemo } from 'react'
import { basisOf, ensureCodebook, hasAnalysis, useCodebook } from '@/state/codebook'
import { useStudySessions } from '../useStudySessions'

/** What every analysis screen starts from: the study, the sessions accepted in Review, and the codebook built on them. */
export function useAnalysis() {
  const s = useStudySessions()
  const accepted = useMemo(() => s.review.filter((r) => r.status === 'Accepted'), [s.review])
  if (hasAnalysis(s.studyId) && accepted.length) ensureCodebook(s.studyId, accepted.map((x) => x.id))
  const doc = useCodebook(s.studyId)
  const basis = useMemo(() => basisOf(accepted), [accepted])
  const stale = !!doc && (doc.builtOn.some((id) => !accepted.some((a) => a.id === id)) || accepted.some((a) => !doc.builtOn.includes(a.id)))
  return { ...s, accepted, doc, basis, stale, ready: hasAnalysis(s.studyId) && accepted.length > 0 }
}
