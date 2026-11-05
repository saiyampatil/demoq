import { useMemo } from 'react'
import { basisOf, CODEBOOK_STUDY, ensureCodebook, useCodebook } from '@/state/codebook'
import { useStudySessions } from '../useStudySessions'

/** What every analysis screen starts from: the study, the sessions accepted in Review, and the codebook built on them. */
export function useAnalysis() {
  const s = useStudySessions()
  const accepted = useMemo(() => s.review.filter((r) => r.status === 'Accepted'), [s.review])
  if (s.studyId === CODEBOOK_STUDY && accepted.length) ensureCodebook(s.studyId, accepted.map((x) => x.id))
  const doc = useCodebook(s.studyId)
  const basis = useMemo(() => basisOf(accepted), [accepted])
  const stale = !!doc && (doc.builtOn.some((id) => !accepted.some((a) => a.id === id)) || accepted.some((a) => !doc.builtOn.includes(a.id)))
  return { ...s, accepted, doc, basis, stale, ready: s.studyId === CODEBOOK_STUDY && accepted.length > 0 }
}
