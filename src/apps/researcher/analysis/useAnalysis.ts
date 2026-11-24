import { useEffect, useMemo } from 'react'
import { basisOf, ensureCodebook, hasAnalysis, useCodebook } from '@/state/codebook'
import { ensureSeedDecisions } from '@/state/seedDecisions'
import { useStudySessions } from '../useStudySessions'

/** What every analysis screen starts from: the study, the sessions accepted in Review, and the codebook built on them. */
export function useAnalysis() {
  const s = useStudySessions()
  const accepted = useMemo(() => s.review.filter((r) => r.status === 'Accepted'), [s.review])
  if (hasAnalysis(s.studyId) && accepted.length) ensureCodebook(s.studyId, accepted.map((x) => x.id))
  const doc = useCodebook(s.studyId)
  const basis = useMemo(() => basisOf(accepted), [accepted])
  // The seed's own decisions go in once, after the first render (they change the store, so not during one).
  useEffect(() => {
    if (doc && !doc.decisionsSeeded && basis.participants.size) ensureSeedDecisions(s.studyId, basis)
  }, [doc, basis, s.studyId])
  const stale = !!doc && (doc.builtOn.some((id) => !accepted.some((a) => a.id === id)) || accepted.some((a) => !doc.builtOn.includes(a.id)))
  return { ...s, accepted, doc, basis, stale, ready: hasAnalysis(s.studyId) && accepted.length > 0 }
}
