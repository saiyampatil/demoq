import { useCallback } from 'react'
import { useParams } from 'react-router'
import { currentUser } from '@/mock/people'
import type { FieldworkDoc } from '@/state/fieldwork'
import { useStudies } from '@/state/StudyContext'

export function useFieldwork() {
  const { studyId = '' } = useParams()
  const { getStudy, getAudience, getFieldwork, updateFieldwork, isEditable } = useStudies()
  const update = useCallback((fn: (d: FieldworkDoc) => FieldworkDoc) => updateFieldwork(studyId, fn), [studyId, updateFieldwork])
  return { studyId, study: getStudy(studyId), editable: isEditable(studyId), audience: getAudience(studyId), doc: getFieldwork(studyId), me: currentUser.name, update }
}
