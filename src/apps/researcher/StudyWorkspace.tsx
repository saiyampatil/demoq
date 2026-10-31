import { useEffect, useRef } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronLeftIcon, GearIcon, LockIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { Stepper, type StepperStep } from '@/components/Stepper'
import { SubStepper, type SubStep } from '@/components/SubStepper'
import { ErrorState } from '@/components/States'
import type { StudyRecord } from '@/mock/types'
import { builtScreenIds, screenById, screenOrder, screens, screensForStep, studyPath, wizardLabel, type Screen } from '@/routes/screens'
import { approvedBriefSections, generateQuestions, invitedCount, setScreener, startScreener } from '@/state/audience'
import { applyDraft, configBlockers, draftGuide } from '@/state/guide'
import { readiness } from '@/state/launch'
import { useStudies } from '@/state/StudyContext'
import { setStudyTimeZone } from '@/lib/timeZone'
import { useReviewState } from '@/state/reviewState'
import { reviewList } from '@/state/studySessions'
import { reviewCounts, targetOf } from '@/state/selectors'
import { checkInvariants } from '@/state/invariants'
import { landingStep, stepInfo, type StepInfo } from '@/state/workflow'
import { useSessionsDoc } from './useStudySessions'

/** Which researcher screen the current URL is on, if any. */
function matchScreen(studyId: string, pathname: string): Screen | undefined {
  const rest = pathname.replace(`/researcher/studies/${studyId}/`, '')
  return screens.find((s) => {
    if (s.app !== 'researcher' || s.id === 'R0' || s.drawerOf) return false
    const pattern = new RegExp(`^${s.path.replace(':sessionId', '[^/]+')}/?$`)
    return pattern.test(rest)
  })
}

export function StudyWorkspace() {
  const { studyId = '' } = useParams()
  const { pathname, search } = useLocation()
  const { getStudy, getAudience, getGuide, getLaunch } = useStudies()
  const study = getStudy(studyId)
  // Every timestamp on every screen in this study is shown in its time zone.
  setStudyTimeZone(study?.timeZone)
  const { doc: sessionsDoc } = useSessionsDoc(studyId)
  const reviewState = useReviewState()
  const screenIdx = screenOrder(matchScreen(studyId, pathname)?.id ?? '')

  // Slide direction follows the screen order. The first screen shown doesn't animate.
  const seen = useRef({ idx: screenIdx, dir: 'forward' as 'forward' | 'back', moved: false })
  if (seen.current.idx !== screenIdx) seen.current = { idx: screenIdx, dir: screenIdx > seen.current.idx ? 'forward' : 'back', moved: true }

  // Dev only: check that every number on every screen agrees, and log each place they don't.
  const target = study ? targetOf(sessionsDoc, getAudience(study.id), study.targetCompletes) : 0
  useEffect(() => {
    if (!import.meta.env.DEV || !sessionsDoc) return
    const review = reviewList(sessionsDoc, reviewState)
    const bad = checkInvariants(sessionsDoc, review, target, reviewCounts(review).underReview)
    ;(window as unknown as { __invariants: string[] }).__invariants = bad
    bad.forEach((v) => console.error(`[invariant] ${v}`))
  }, [sessionsDoc, reviewState, target])

  if (!study) {
    return (
      <main className="mx-auto w-full max-w-content px-6 py-10">
        <ErrorState
          title="Study not found"
          description={`There’s no study with the ID “${studyId}”. It may have been removed, or the link is wrong.`}
        />
        <div className="px-6">
          <Button to="/researcher" icon={<ChevronLeftIcon />}>
            Back to studies
          </Button>
        </div>
      </main>
    )
  }

  const info = stepInfo(study, (() => { const c = sessionsDoc ? reviewCounts(reviewList(sessionsDoc, reviewState)) : undefined; return { awaitingReview: c ? c.underReview : null, total: c?.total } })())
  const screen = matchScreen(study.id, pathname)
  const currentStep = screen?.step
  const stepperSteps: StepperStep[] = info.map((s) => {
    const items = screensForStep(s.key)
    return { ...s, to: items[0] ? studyPath(study.id, items[0]) : pathname, current: s.key === currentStep }
  })
  const audience = getAudience(study.id)
  const guideDoc = getGuide(study.id)
  const launchState = currentStep === 'launch' ? readiness({ study, audience, guide: guideDoc, launch: getLaunch(study.id) }) : undefined
  const subItems: SubStep[] = currentStep
    ? screensForStep(currentStep).map((i) => ({
        id: i.id,
        label: wizardLabel[i.id] ?? i.name,
        to: builtScreenIds.has(i.id) ? studyPath(study.id, i) : undefined,
        current: i.id === screen?.id,
        done:
          currentStep === 'launch' && launchState
            ? i.id === 'R15'
              ? launchState.entryOk && launchState.compile.state === 'ok' && launchState.progress.all
              : study.status === 'Live'
            : currentStep === 'guide'
            ? i.id === 'R12'
              ? !!guideDoc && configBlockers(guideDoc.moderator).length === 0
              : i.id === 'R13'
                ? !!guideDoc && (guideDoc.stimuli.skipped || guideDoc.stimuli.items.some((s) => s.active))
                : guideDoc?.status === 'Approved'
            : currentStep !== 'audience'
              ? undefined
              : i.id === 'R6'
              ? audience?.status === 'Confirmed'
              : i.id === 'R7'
                ? audience?.screener?.status === 'Ready'
                : i.id === 'R8'
                  ? !!audience && invitedCount(audience.sourcing) > 0
                  : undefined,
      }))
    : []
  const lockedStep = currentStep ? info.find((s) => s.key === currentStep && s.state === 'locked') : undefined

  const { dir, moved } = seen.current
  // An Edit button on the launch screen sends you here with ?from=launch, so there is a way straight back.
  const fromLaunch = new URLSearchParams(search).get('from') === 'launch'
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <ScreenerAutomation studyId={study.id} />
      <GuideAutomation studyId={study.id} />
      <div className="border-b border-mist bg-paper px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-[1400px]">
          <Stepper steps={stepperSteps} />
        </div>
      </div>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="border-b border-mist bg-paper md:w-stepper md:shrink-0 md:border-r md:border-b-0">
          <div className="flex flex-col gap-4 px-5 py-4 md:py-5">
            <Link to="/researcher" className="inline-flex items-center gap-1 self-start rounded-xs text-sm text-graphite hover:text-ink">
              <ChevronLeftIcon size={14} />
              Studies
            </Link>
            <StudySummary study={study} />
            <Link
              to={studyPath(study.id, screenById.R23)}
              aria-current={screen?.id === 'R23' ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 self-start rounded-sm px-2 py-1.5 text-sm md:self-stretch',
                screen?.id === 'R23' ? 'bg-surface font-medium text-ink ring-1 ring-mist' : 'text-graphite hover:bg-haze hover:text-ink',
              )}
            >
              <GearIcon />
              Study settings
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-content">
            {/* Fieldwork and Review use a breadcrumb inside the screen instead of a sub-stepper. */}
            {fromLaunch && !lockedStep && screen?.step !== 'launch' && (
              <Link to={studyPath(study.id, screenById.R15)} className="mb-4 inline-flex items-center gap-1 rounded-xs text-sm font-medium text-iris-700 hover:underline">
                <ChevronLeftIcon size={14} />
                Back to launch
              </Link>
            )}
            {subItems.length > 1 && !lockedStep && currentStep !== 'review' && currentStep !== 'fieldwork' && <SubStepper items={subItems} />}
            <div key={screen?.id ?? pathname} className={moved ? (dir === 'forward' ? 'screen-in-forward' : 'screen-in-back') : undefined}>
              {lockedStep ? <LockedStep step={lockedStep} studyId={study.id} info={info} /> : <Outlet />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Writes the screener once the audience is confirmed. It runs here, not on R7, so it finishes whichever screen is open. */
function ScreenerAutomation({ studyId }: { studyId: string }) {
  const { getAudience, updateAudience } = useStudies()
  const audience = getAudience(studyId)
  const confirmedWithoutScreener = audience?.status === 'Confirmed' && !audience.screener && !audience.screenerPending
  const pending = !!audience?.screenerPending

  useEffect(() => {
    if (confirmedWithoutScreener) updateAudience(studyId, startScreener)
  }, [confirmedWithoutScreener, studyId, updateAudience])

  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => updateAudience(studyId, (d) => (d.def ? setScreener(d, generateQuestions(d.def)) : { ...d, screenerPending: false })), 1300)
    return () => clearTimeout(t)
  }, [pending, studyId, updateAudience])

  return null
}

/** Drafts the guide once the setup asks for it, so it finishes whichever screen is open. */
function GuideAutomation({ studyId }: { studyId: string }) {
  const { getGuide, getBrief, getAudience, getStudy, updateGuide } = useStudies()
  const doc = getGuide(studyId)
  const pending = !!doc?.guidePending
  const brief = getBrief(studyId)
  const audience = getAudience(studyId)
  const study = getStudy(studyId)

  useEffect(() => {
    if (!pending) return
    const t = setTimeout(
      () =>
        updateGuide(studyId, (d) => {
          if (!d.guidePending) return d
          if (configBlockers(d.moderator).length) return { ...d, guidePending: false }
          const approved = approvedBriefSections(brief)
          const guide = draftGuide({
            study: { client: study?.client ?? '', category: study?.category ?? '' },
            briefSections: approved?.sections,
            briefVersion: approved?.version ?? 0,
            audienceVersion: audience?.version ?? 0,
            moderator: d.moderator,
            stimuli: d.stimuli,
          })
          return applyDraft(d, guide)
        }),
      1600,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, studyId])

  return null
}

function StudySummary({ study }: { study: StudyRecord }) {
  return (
    <div>
      <h2 className="text-md leading-snug font-semibold">{study.name}</h2>
      <p className="text-sm text-graphite">{study.client}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusChip status={study.status} size="sm" />
        <span className="text-xs text-graphite">{study.moderatorType}</span>
        {study.releaseVersion && <span className="text-xs text-graphite">{study.releaseVersion}</span>}
      </div>
    </div>
  )
}

function LockedStep({ step, studyId, info }: { step: StepInfo; studyId: string; info: StepInfo[] }) {
  // Point the Researcher at the step that has to move first.
  const blocking = info.find((s) => s.state === 'open')
  const blockingScreen = blocking && screensForStep(blocking.key)[0]
  return (
    <div className="rounded-md border border-mist bg-surface px-6 py-10">
      <span className="flex size-9 items-center justify-center rounded-full bg-haze text-graphite">
        <LockIcon size={16} />
      </span>
      <h1 className="mt-4 text-lg font-semibold">{step.label} is locked</h1>
      <p className="mt-1 max-w-prose text-graphite">{step.lockedReason}.</p>
      {blocking && blockingScreen && step.key !== 'analysis' && (
        <div className="mt-5">
          <Button to={studyPath(studyId, blockingScreen)}>Go to {blocking.label}</Button>
        </div>
      )}
    </div>
  )
}

/** /researcher/studies/:id opens the first step that still needs work. */
export function WorkspaceIndex() {
  const { studyId = '' } = useParams()
  const { getStudy, getBrief } = useStudies()
  const study = getStudy(studyId)
  if (!study) return null
  const step = landingStep(study)
  // A drafted brief opens in the editor rather than the intake chat.
  const target = step === 'brief' && getBrief(study.id)?.intakeComplete ? screenById.R4 : screensForStep(step)[0]
  return <Navigate to={studyPath(study.id, target)} replace />
}
