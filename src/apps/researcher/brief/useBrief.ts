import { useCallback } from 'react'
import { useParams } from 'react-router'
import { currentUser } from '@/mock/people'
import type { BriefDoc } from '@/state/brief'
import { useStudies } from '@/state/StudyContext'

export function useBrief() {
  const { studyId = '' } = useParams()
  const { getStudy, getBrief, setBrief, updateBrief, isEditable } = useStudies()
  const update = useCallback((fn: (doc: BriefDoc) => BriefDoc) => updateBrief(studyId, fn), [studyId, updateBrief])
  return {
    studyId,
    study: getStudy(studyId),
    doc: getBrief(studyId),
    editable: isEditable(studyId),
    me: currentUser.name,
    start: (doc: BriefDoc) => setBrief(studyId, doc),
    update,
  }
}
