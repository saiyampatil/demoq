import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronLeftIcon, GearIcon, LockIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { Stepper, type StepperStep } from '@/components/Stepper'
import { ErrorState } from '@/components/States'
import type { StudyRecord } from '@/mock/types'
import { screenById, screens, screensForStep, studyPath, type Screen } from '@/routes/screens'
import { useStudies } from '@/state/StudyContext'
import { landingStep, stepInfo, type StepInfo } from '@/state/workflow'

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
  const { pathname } = useLocation()
  const { getStudy } = useStudies()
  const study = getStudy(studyId)

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

  const info = stepInfo(study)
  const screen = matchScreen(study.id, pathname)
  const currentStep = screen?.step
  const stepperSteps: StepperStep[] = info.map((s) => {
    const items = screensForStep(s.key)
    return {
      ...s,
      to: items[0] ? studyPath(study.id, items[0]) : pathname,
      current: s.key === currentStep,
      items: items.map((i) => ({ id: i.id, name: i.name, to: studyPath(study.id, i), active: i.id === screen?.id })),
    }
  })
  const lockedStep = currentStep ? info.find((s) => s.key === currentStep && s.state === 'locked') : undefined

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-mist bg-paper md:sticky md:top-topbar md:h-[calc(100vh-var(--spacing-topbar))] md:w-stepper md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
        <div className="flex h-full flex-col px-5 py-5">
          <Link to="/researcher" className="mb-4 inline-flex items-center gap-1 self-start rounded-xs text-sm text-graphite hover:text-ink">
            <ChevronLeftIcon size={14} />
            Studies
          </Link>
          <StudySummary study={study} />
          <div className="mt-6">
            <Stepper steps={stepperSteps} />
          </div>
          <div className="mt-auto pt-6">
            <Link
              to={studyPath(study.id, screenById.R23)}
              aria-current={screen?.id === 'R23' ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                screen?.id === 'R23' ? 'bg-surface font-medium text-ink ring-1 ring-mist' : 'text-graphite hover:bg-haze hover:text-ink',
              )}
            >
              <GearIcon />
              Study settings
            </Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-content">
          {lockedStep ? <LockedStep step={lockedStep} studyId={study.id} info={info} /> : <Outlet />}
        </div>
      </main>
    </div>
  )
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
