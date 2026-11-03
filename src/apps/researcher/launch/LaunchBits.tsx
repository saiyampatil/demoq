import { AlertIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/components/cn'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'

/** A pass or fail mark that doesn't rely on colour alone. */
export function ResultMark({ state, label }: { state: 'pass' | 'warn' | 'fail' | 'overridden' | 'critical'; label: string }) {
  const cls = {
    pass: 'bg-positive-bg text-positive-fg',
    fail: 'bg-pending-bg text-pending-fg',
    warn: 'bg-pending-bg text-pending-fg',
    critical: 'bg-negative-bg text-negative-fg',
    overridden: 'bg-haze text-graphite ring-1 ring-mist-strong',
  }[state]
  return (
    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', cls)} role="img" aria-label={label}>
      {state === 'pass' ? <CheckIcon size={12} strokeWidth={2.4} /> : state === 'overridden' ? (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : <AlertIcon size={12} />}
    </span>
  )
}

export function LaunchGate() {
  return (
    <div className="rounded-md border border-dashed border-mist-strong bg-surface">
      <EmptyState
        title="This study’s launch isn’t in the prototype"
        description="Only the Moisturizer Concept Study and studies you create can be launched."
        action={<Button to="/researcher">Back to studies</Button>}
      />
    </div>
  )
}
