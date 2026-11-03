import { studyLanguage } from '@/state/language'
import { compileStudyPlan } from '@/state/launch'
import { generateFieldwork, type FieldworkDoc } from '@/state/fieldwork'
import { seedAudienceWithPool } from './audience'
import { seedApprovedBrief } from './brief'
import { seedGuideDoc } from './guide'
import { seedLaunchDoc } from './launch'
import { MOISTURIZER_ID } from './moisturizerStudy'

let cached: FieldworkDoc | undefined

/**
 * Example fieldwork for a study that hasn't launched, so Fieldwork and Review can be opened and looked at.
 * It is built from the same seeds as the "Live in fieldwork" stage and is never saved.
 */
export function sampleFieldwork(): FieldworkDoc | undefined {
  if (cached) return cached
  const brief = seedApprovedBrief(MOISTURIZER_ID)
  const guide = seedGuideDoc(MOISTURIZER_ID, brief, 'approved')
  const plan = compileStudyPlan(guide, studyLanguage(brief))
  if (plan.state !== 'ok') return undefined
  cached = generateFieldwork({
    studyId: MOISTURIZER_ID,
    audience: seedAudienceWithPool(MOISTURIZER_ID),
    guide,
    plan: plan.plan,
    releaseNumber: 1,
    releaseVersion: 'Release v1.0',
    launch: seedLaunchDoc(MOISTURIZER_ID, 'live', 'Verdane Skincare'),
  })
  return cached
}
