import { useCallback } from 'react'
import { useParams } from 'react-router'
import { currentUser } from '@/mock/people'
import type { AudienceDoc } from '@/state/audience'
import { useStudies } from '@/state/StudyContext'

export function useAudience() {
  const { studyId = '' } = useParams()
  const { getStudy, getBrief, getAudience, setAudience, updateAudience, isEditable } = useStudies()
  const update = useCallback((fn: (doc: AudienceDoc) => AudienceDoc) => updateAudience(studyId, fn), [studyId, updateAudience])
  return {
    studyId,
    study: getStudy(studyId),
    brief: getBrief(studyId),
    audience: getAudience(studyId),
    editable: isEditable(studyId),
    me: currentUser.name,
    set: (doc: AudienceDoc) => setAudience(studyId, doc),
    update,
  }
}
