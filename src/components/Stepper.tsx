import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './cn'
import { CheckIcon, LockIcon } from './icons'
import { StatusChip } from './StatusChip'
import type { Status } from './status'

export type StepState = 'done' | 'open' | 'locked'

export type StepperSubItem = { id: string; name: string; to: string; active: boolean }

export type StepperStep = {
  key: string
  label: string
  state: StepState
  to: string
  current: boolean
  status?: Status
  version?: number
  /** Shown under a locked step: what has to happen first. */
  lockedReason?: string
  /** Shown under an open step that has no status yet. */
  hint?: string
  /** Extra line under the status chip. */
  note?: string
  /** Screens inside the step, listed when the step is current. */
  items?: StepperSubItem[]
}

// The study's spine: one thread through every step, solid where work is done,
// dashed where the path is still locked.
export function Stepper({ steps, label = 'Study steps' }: { steps: StepperStep[]; label?: string }) {
  return (
    <nav aria-label={label}>
      <ol>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const nextLocked = steps[i + 1]?.state === 'locked'
          return (
            <li key={step.key} className="relative pb-5 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-7 bottom-1 left-[11px] border-l-2',
                    step.state === 'done' ? 'border-solid border-ink' : 'border-dashed',
                    step.state !== 'done' && (nextLocked ? 'border-mist-strong' : 'border-graphite'),
                  )}
                />
              )}
              <div className="flex gap-3">
                <StepNode state={step.state} current={step.current} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <Link
                    to={step.to}
                    aria-current={step.current ? 'step' : undefined}
                    className={cn(
                      'block rounded-xs text-base leading-5',
                      step.state === 'locked' ? 'text-muted hover:text-graphite' : 'text-ink hover:underline',
                      step.current && 'font-semibold',
                      !step.current && step.state !== 'locked' && 'font-medium',
                    )}
                  >
                    {step.label}
                    {step.state === 'locked' && <span className="sr-only"> (locked)</span>}
                  </Link>
                  <StepMeta step={step} />
                  {step.current && step.items && step.items.length > 0 && step.state !== 'locked' && (
                    <ul className="mt-2.5 -ml-1 flex flex-col gap-0.5">
                      {step.items.map((item) => (
                        <li key={item.id}>
                          <Link
                            to={item.to}
                            aria-current={item.active ? 'page' : undefined}
                            className={cn(
                              'flex items-baseline gap-2 rounded-sm px-2 py-1.5 text-sm',
                              item.active
                                ? 'bg-surface font-medium text-ink shadow-raised ring-1 ring-mist'
                                : 'text-graphite hover:bg-haze hover:text-ink',
                            )}
                          >
                            <span className="w-7 shrink-0 text-xs font-semibold text-muted tabular-nums">{item.id}</span>
                            <span className="min-w-0">{item.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StepMeta({ step }: { step: StepperStep }) {
  let meta: ReactNode = null
  if (step.state === 'locked') {
    meta = <p className="text-xs text-muted">{step.lockedReason}</p>
  } else if (step.status) {
    meta = (
      <>
        <div className="flex items-center gap-2">
          <StatusChip status={step.status} size="sm" />
          {step.version ? <span className="text-xs text-graphite tabular-nums">v{step.version}</span> : null}
        </div>
        {step.note && <p className="mt-1 text-xs text-pending-fg">{step.note}</p>}
      </>
    )
  } else if (step.hint) {
    meta = <p className="text-xs text-graphite">{step.hint}</p>
  }
  return meta ? <div className="mt-1">{meta}</div> : null
}

function StepNode({ state, current }: { state: StepState; current: boolean }) {
  if (state === 'done') {
    return (
      <span
        className={cn(
          'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-white',
          current && 'ring-4 ring-mist',
        )}
      >
        <CheckIcon size={13} strokeWidth={2.2} />
      </span>
    )
  }
  if (state === 'locked') {
    return (
      <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-mist bg-haze text-muted">
        <LockIcon size={12} />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface',
        current ? 'border-ink' : 'border-graphite',
      )}
    >
      {current && <span className="size-2 rounded-full bg-ink" />}
    </span>
  )
}
