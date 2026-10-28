import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './cn'
import { CheckIcon, LockIcon } from './icons'
import { StatusChip } from './StatusChip'
import type { Status } from './status'
import { Tooltip } from './Tooltip'

export type StepState = 'done' | 'open' | 'locked'

export type StepperStep = {
  key: string
  label: string
  state: StepState
  to: string
  current: boolean
  status?: Status
  version?: number
  /** Shown on hover or focus of a locked step: what has to happen first. */
  lockedReason?: string
  /** Shown under an open step that has no status yet. */
  hint?: string
  /** Extra line under the status chip. */
  note?: string
}

// The study's spine, laid out across the top: a solid thread where work is done,
// dashed where the path is still ahead or locked.
export function Stepper({ steps, label = 'Study steps' }: { steps: StepperStep[]; label?: string }) {
  const current = steps.find((s) => s.current)
  const position = current ? steps.indexOf(current) + 1 : 0
  return (
    <nav aria-label={label}>
      <ol className="flex">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const nextLocked = steps[i + 1]?.state === 'locked'
          const node = (
            <Link
              to={step.to}
              aria-current={step.current ? 'step' : undefined}
              aria-label={`${step.label}${step.state === 'locked' ? ' (locked)' : step.state === 'done' ? ' (done)' : ''}`}
              className="relative z-10 rounded-full"
            >
              <StepNode state={step.state} current={step.current} />
            </Link>
          )
          return (
            <li key={step.key} className="min-w-0 flex-1">
              <div className="flex items-center">
                {step.state === 'locked' && step.lockedReason ? (
                  <Tooltip align={i >= steps.length - 2 ? 'right' : 'left'} content={step.lockedReason}>
                    {node}
                  </Tooltip>
                ) : (
                  node
                )}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mx-1.5 h-0 flex-1 border-t-2',
                      step.state === 'done' ? 'border-solid border-ink' : 'border-dashed',
                      step.state !== 'done' && (nextLocked ? 'border-mist-strong' : 'border-graphite'),
                    )}
                  />
                )}
              </div>
              <div className="mt-2 hidden pr-2 md:block">
                <Link
                  to={step.to}
                  tabIndex={-1}
                  aria-hidden="true"
                  title={step.state === 'locked' ? step.lockedReason : undefined}
                  className={cn(
                    'block rounded-xs text-base leading-5',
                    step.state === 'locked' ? 'text-muted' : 'text-ink hover:underline',
                    step.current && 'font-semibold',
                    !step.current && step.state !== 'locked' && 'font-medium',
                  )}
                >
                  {step.label}
                </Link>
                <StepMeta step={step} />
              </div>
            </li>
          )
        })}
      </ol>
      {current && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm md:hidden" aria-hidden="true">
          <span className="text-graphite tabular-nums">
            Step {position} of {steps.length}
          </span>
          <span className="font-semibold">{current.label}</span>
          {current.status && <StatusChip status={current.status} size="sm" />}
        </p>
      )}
    </nav>
  )
}

function StepMeta({ step }: { step: StepperStep }) {
  let meta: ReactNode = null
  if (step.state === 'locked') {
    meta = null
  } else if (step.status) {
    meta = (
      <>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusChip status={step.status} size="sm" />
          {step.version ? <span className="text-xs text-graphite tabular-nums">v{step.version}</span> : null}
        </div>
        {step.note && <p className="mt-1 hidden text-xs text-pending-fg lg:block">{step.note}</p>}
      </>
    )
  } else if (step.hint && step.current) {
    meta = <p className="hidden text-xs text-graphite lg:block">{step.hint}</p>
  }
  return meta ? <div className="mt-1">{meta}</div> : null
}

function StepNode({ state, current }: { state: StepState; current: boolean }) {
  if (state === 'done') {
    return (
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-white',
          current && 'ring-4 ring-mist',
        )}
      >
        <CheckIcon size={13} strokeWidth={2.2} />
      </span>
    )
  }
  if (state === 'locked') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-mist bg-haze text-muted">
        <LockIcon size={12} />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface',
        current ? 'border-ink ring-4 ring-mist' : 'border-graphite',
      )}
    >
      {current && <span className="size-2 rounded-full bg-ink" />}
    </span>
  )
}
