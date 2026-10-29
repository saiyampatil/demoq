import { useCallback } from 'react'
import { useParams } from 'react-router'
import { sampleFieldwork } from '@/mock/fieldwork'
import { currentUser } from '@/mock/people'
import { seedAudienceWithPool } from '@/mock/audience'
import type { FieldworkDoc } from '@/state/fieldwork'
import { useStudies } from '@/state/StudyContext'

export function useFieldwork() {
  const { studyId = '' } = useParams()
  const { getStudy, getAudience, getFieldwork, updateFieldwork, isEditable } = useStudies()
  const real = getFieldwork(studyId)
  const editable = isEditable(studyId)
  // A study that hasn't launched shows example sessions, read-only, so Fieldwork and Review can still be looked at.
  const preview = !real && editable
  const update = useCallback((fn: (d: FieldworkDoc) => FieldworkDoc) => (real ? updateFieldwork(studyId, fn) : undefined), [studyId, updateFieldwork, real])
  return {
    studyId,
    study: getStudy(studyId),
    editable,
    audience: getAudience(studyId) ?? (preview ? seedAudienceWithPool(studyId) : undefined),
    doc: real ?? (preview ? sampleFieldwork() : undefined),
    preview,
    me: currentUser.name,
    update,
  }
}
