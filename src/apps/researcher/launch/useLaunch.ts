import { useMemo } from 'react'
import { useParams } from 'react-router'
import { currentUser } from '@/mock/people'
import { readiness, type Inputs, type LaunchDoc } from '@/state/launch'
import { useStudies } from '@/state/StudyContext'

export function useLaunch() {
  const { studyId = '' } = useParams()
  const { getStudy, getLanguage, getAudience, getGuide, getLaunch, updateLaunch, isEditable } = useStudies()
  const study = getStudy(studyId)
  const audience = getAudience(studyId)
  const guide = getGuide(studyId)
  const launch = getLaunch(studyId)
  const language = getLanguage(studyId)
  const r = useMemo(() => (study ? readiness({ study, audience, guide, launch, language } as Inputs) : undefined), [study, audience, guide, launch, language])
  return {
    studyId,
    study,
    editable: isEditable(studyId),
    audience,
    guide,
    launch,
    language,
    readiness: r,
    me: currentUser.name,
    update: (fn: (d: LaunchDoc) => LaunchDoc) => updateLaunch(studyId, fn),
  }
}
