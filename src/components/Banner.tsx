import type { ReactNode } from 'react'
import { cn } from './cn'
import { AlertIcon, CheckIcon } from './icons'

type Tone = 'info' | 'warning' | 'success' | 'danger'

const toneClass: Record<Tone, string> = {
  info: 'bg-progress-bg border-progress-line text-progress-fg',
  warning: 'bg-pending-bg border-pending-line text-pending-fg',
  success: 'bg-positive-bg border-positive-line text-positive-fg',
  danger: 'bg-negative-bg border-negative-line text-negative-fg',
}

type BannerProps = {
  tone?: Tone
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}

export function Banner({ tone = 'info', title, children, actions, className }: BannerProps) {
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex flex-wrap items-start gap-3 rounded-md border px-4 py-3', toneClass[tone], className)}>
      <span className="mt-0.5 shrink-0">{tone === 'success' ? <CheckIcon /> : <AlertIcon />}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-0.5 text-sm text-ink">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
