import type { StepState } from '@/components/Stepper'
import type { Status } from '@/components/status'
import type { StudyRecord } from '@/mock/types'
import { steps, type StepKey } from '@/routes/screens'

export type StepInfo = {
  key: StepKey
  label: string
  state: StepState
  status?: Status
  version?: number
  lockedReason?: string
  hint?: string
}

const launched = (s: StudyRecord) => ['Live', 'Paused', 'Terminated', 'Complete'].includes(s.status)

// Steps unlock in order, driven by status. See CLAUDE.md "Researcher study workspace".
export function stepInfo(study: StudyRecord): StepInfo[] {
  const briefApproved = study.brief.status === 'Approved'
  const audienceConfirmed = briefApproved && study.audience.status === 'Confirmed'
  const guideApproved = audienceConfirmed && study.guide.status === 'Approved'
  const isLaunched = guideApproved && launched(study)
  const fieldworkClosed = isLaunched && (study.status === 'Complete' || study.status === 'Terminated')

  const label = (key: StepKey) => steps.find((s) => s.key === key)!.label

  return [
    {
      key: 'brief',
      label: label('brief'),
      state: briefApproved ? 'done' : 'open',
      status: study.brief.status ?? undefined,
      version: study.brief.version || undefined,
      hint: 'Start here: add the client’s brief',
    },
    {
      key: 'audience',
      label: label('audience'),
      state: !briefApproved ? 'locked' : audienceConfirmed ? 'done' : 'open',
      status: study.audience.status ?? undefined,
      version: study.audience.version || undefined,
      lockedReason: 'Unlocks when the brief is Approved',
      hint: 'Define who to recruit',
    },
    {
      key: 'guide',
      label: label('guide'),
      state: !audienceConfirmed ? 'locked' : guideApproved ? 'done' : 'open',
      status: study.guide.status ?? undefined,
      version: study.guide.version || undefined,
      lockedReason: 'Unlocks when the audience is Confirmed',
      hint: 'Set up the moderator and guide',
    },
    {
      key: 'launch',
      label: label('launch'),
      state: !guideApproved ? 'locked' : isLaunched ? 'done' : 'open',
      status: isLaunched ? undefined : guideApproved ? study.status : undefined,
      lockedReason: 'Unlocks when the guide is Approved',
    },
    {
      key: 'fieldwork',
      label: label('fieldwork'),
      state: !isLaunched ? 'locked' : fieldworkClosed ? 'done' : 'open',
      status: isLaunched ? study.status : undefined,
      lockedReason: 'Unlocks when the study is launched',
    },
    {
      key: 'review',
      label: label('review'),
      state: isLaunched ? 'open' : 'locked',
      lockedReason: 'Unlocks when the study is launched',
      hint: 'Sessions arrive here after they finish',
    },
    {
      key: 'analysis',
      label: label('analysis'),
      state: 'locked',
      lockedReason: 'Out of scope for this prototype',
    },
  ]
}

/** Where to land when opening a study: the first step that still needs work. */
export function landingStep(study: StudyRecord): StepKey {
  const info = stepInfo(study)
  const open = info.find((s) => s.state === 'open')
  return open?.key ?? info.filter((s) => s.state !== 'locked').at(-1)?.key ?? 'brief'
}
