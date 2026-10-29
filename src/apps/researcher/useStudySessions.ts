import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router'
import { seedAudienceWithPool } from '@/mock/audience'
import { sampleFieldwork } from '@/mock/fieldwork'
import { currentUser } from '@/mock/people'
import type { FieldworkDoc } from '@/state/fieldwork'
import { useStudies } from '@/state/StudyContext'
import { reviewList } from '@/state/studySessions'

/** The study's fieldwork doc: the real one once Live, or the read-only sample before launch. */
export function useSessionsDoc(studyId: string) {
  const { getFieldwork, isEditable } = useStudies()
  const real = getFieldwork(studyId)
  const editable = isEditable(studyId)
  const preview = !real && editable
  return { real, preview, editable, doc: real ?? (preview ? sampleFieldwork() : undefined) }
}

/**
 * Fieldwork (R18, R19) and Review (R21, R22) both read the study through this hook, so they show the same study,
 * the same sessions and the same counts. Before launch it serves the same sample to all of them.
 */
export function useStudySessions() {
  const { studyId = '' } = useParams()
  const { getStudy, getAudience, updateFieldwork } = useStudies()
  const { real, preview, editable, doc } = useSessionsDoc(studyId)
  const update = useCallback((fn: (d: FieldworkDoc) => FieldworkDoc) => (real ? updateFieldwork(studyId, fn) : undefined), [studyId, updateFieldwork, real])
  const review = useMemo(() => reviewList(doc), [doc])
  return {
    studyId,
    study: getStudy(studyId),
    editable,
    audience: getAudience(studyId) ?? (preview ? seedAudienceWithPool(studyId) : undefined),
    doc,
    /** Completed sessions with their review records. */
    review,
    preview,
    me: currentUser.name,
    update,
  }
}
