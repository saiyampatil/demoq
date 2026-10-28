import type { ReactNode } from 'react'
import { cn } from './cn'
import { AlertIcon } from './icons'
import { Button } from './Button'

type EmptyStateProps = {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

// An empty screen is an invitation to act: say what goes here and how to add it.
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-3 px-6 py-10', className)}>
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <h3 className="text-md font-semibold">{title}</h3>
        {description && <p className="mt-1 max-w-prose text-graphite">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading', rows = 4, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div className={cn('px-6 py-6', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-4 rounded-xs bg-[linear-gradient(90deg,var(--color-haze)_0%,var(--color-mist)_50%,var(--color-haze)_100%)] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.4s_linear_infinite]"
            style={{ width: `${92 - ((i * 17) % 40)}%` }}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-graphite">{label}…</p>
    </div>
  )
}

type ErrorStateProps = {
  title: string
  /** What went wrong and how to fix it. */
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({ title, description, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex items-start gap-3 px-6 py-8', className)}>
      <span className="mt-0.5 text-negative-fg">
        <AlertIcon size={18} />
      </span>
      <div className="flex flex-col items-start gap-3">
        <div>
          <h3 className="text-md font-semibold">{title}</h3>
          {description && <p className="mt-1 max-w-prose text-graphite">{description}</p>}
        </div>
        {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
      </div>
    </div>
  )
}
