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
  /** A count shown as a neutral chip, e.g. sessions awaiting review. */
  badge?: string
  /** Review only, when there is no count to show: a tick once every session is decided, a dot before that. */
  mark?: 'tick' | 'dot'
  /** Extra line under the status chip, e.g. who the step is waiting on. */
  note?: string
  /** In progress right now: Fieldwork and Review run in parallel while a study is Live. */
  active?: boolean
}

const launched = (s: StudyRecord) => ['Live', 'Paused', 'Terminated', 'Complete'].includes(s.status)

function clientNote(study: StudyRecord) {
  const r = study.brief.clientReview
  if (!r) return undefined
  if (r.state === 'Waiting') return 'Awaiting client approval'
  if (r.state === 'Commented') return `Client commented (${r.comments}), awaiting decision`
  if (r.state === 'Declined') return 'Client declined. Edit and send again'
  return undefined
}

// Steps unlock in order, driven by status. See CLAUDE.md "Researcher study workspace".
/** `awaitingReview` is the Under review count from state/selectors.ts; null for a study that has no session data in the prototype. */
export function stepInfo(study: StudyRecord, sessions?: { awaitingReview: number | null; total?: number }): StepInfo[] {
  const briefApproved = study.brief.status === 'Approved'
  const audienceConfirmed = briefApproved && study.audience.status === 'Confirmed'
  const guideApproved = audienceConfirmed && study.guide.status === 'Approved'
  // A Paused study has still launched: Fieldwork stays open while a new version is approved.
  const isLaunched = launched(study)
  const fieldworkClosed = isLaunched && (study.status === 'Complete' || study.status === 'Terminated')

  const label = (key: StepKey) => steps.find((s) => s.key === key)!.label

  return [
    {
      key: 'brief',
      label: label('brief'),
      state: briefApproved ? 'done' : 'open',
      status: study.brief.status ?? undefined,
      version: study.brief.version || undefined,
      note: clientNote(study),
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
      state: !guideApproved ? 'locked' : isLaunched && study.status !== 'Paused' ? 'done' : 'open',
      status: isLaunched && study.status !== 'Paused' ? undefined : guideApproved ? study.status : undefined,
      lockedReason: 'Unlocks when the guide is Approved',
    },
    {
      key: 'fieldwork',
      label: label('fieldwork'),
      // Fieldwork and Review can always be opened in the prototype; before launch they show sample data.
      state: isLaunched && fieldworkClosed ? 'done' : 'open',
      active: isLaunched && !fieldworkClosed,
      status: isLaunched ? study.status : undefined,
      hint: 'Sample data until the study launches',
    },
    {
      key: 'review',
      label: label('review'),
      state: 'open',
      active: isLaunched && !fieldworkClosed,
      // A count only while something awaits a decision. Never "0 awaiting".
      badge: sessions ? (sessions.awaitingReview === null ? 'Sample study' : sessions.awaitingReview > 0 ? `${sessions.awaitingReview} awaiting` : undefined) : undefined,
      mark: sessions && sessions.awaitingReview === 0 ? ((sessions.total ?? 0) > 0 ? 'tick' : 'dot') : undefined,
      hint: sessions?.awaitingReview === null ? 'Sample study: no live session data' : isLaunched ? 'Sessions arrive here after they finish' : 'Sample data until the study launches',
    },
    {
      key: 'analysis',
      label: label('analysis'),
      ...analysis(isLaunched, sessions),
    },
  ]
}

/**
 * Analysis unlocks only when every counted session has a Review decision, so it opens on a complete set
 * of decisions. Until then the step says why it is locked.
 */
function analysis(isLaunched: boolean, sessions?: { awaitingReview: number | null; total?: number }): Pick<StepInfo, 'state' | 'lockedReason' | 'hint'> {
  const locked = (lockedReason: string) => ({ state: 'locked' as const, lockedReason })
  if (!isLaunched) return locked('Unlocks after launch, once every interview has a Review decision')
  if (!sessions || sessions.awaitingReview === null || sessions.total === undefined) return locked('This study has no interview data in the prototype')
  if (sessions.total === 0) return locked('Unlocks once interviews have been completed and every one has a Review decision')
  if (sessions.awaitingReview > 0) return locked(`${sessions.awaitingReview} of ${sessions.total} ${sessions.total === 1 ? 'session still needs' : 'sessions still need'} a Review decision`)
  return { state: 'open', hint: 'Every session has a decision. Start with the analysis base' }
}

/** Where to land when opening a study: the first step that still needs work. */
export function landingStep(study: StudyRecord): StepKey {
  const info = stepInfo(study)
  const open = info.find((s) => s.state === 'open')
  return open?.key ?? info.filter((s) => s.state !== 'locked').at(-1)?.key ?? 'brief'
}
