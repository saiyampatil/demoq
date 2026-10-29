import { useCallback } from 'react'
import { useParams } from 'react-router'
import { currentUser } from '@/mock/people'
import { approvedBriefSections } from '@/state/audience'
import { emptyGuideDoc, type GuideDoc } from '@/state/guide'
import { useStudies } from '@/state/StudyContext'

export function useGuide() {
  const { studyId = '' } = useParams()
  const { getStudy, getBrief, getAudience, getGuide, setGuide, updateGuide, isEditable } = useStudies()
  const study = getStudy(studyId)
  const update = useCallback((fn: (doc: GuideDoc) => GuideDoc) => updateGuide(studyId, fn), [studyId, updateGuide])
  const brief = getBrief(studyId)
  const audience = getAudience(studyId)
  const approved = approvedBriefSections(brief)
  return {
    studyId,
    study,
    editable: isEditable(studyId),
    doc: getGuide(studyId),
    me: currentUser.name,
    /** Creates the empty document the first time Module 3 is opened. */
    ensure: () => setGuide(studyId, emptyGuideDoc(studyId, study?.interviewLanguage)),
    update,
    brief,
    approved,
    audience,
    /** The approved brief has moved on since the audience was built, so Module 3 would be working from stale input. */
    stale: !!approved && !!audience && audience.briefVersion !== approved.version,
  }
}
