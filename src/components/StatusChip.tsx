import { cn } from './cn'
import { statusFamily, type Status, type StatusFamily } from './status'

const familyClass: Record<StatusFamily, string> = {
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-line',
  pending: 'bg-pending-bg text-pending-fg border-pending-line',
  progress: 'bg-progress-bg text-progress-fg border-progress-line',
  positive: 'bg-positive-bg text-positive-fg border-positive-line',
  negative: 'bg-negative-bg text-negative-fg border-negative-line',
  held: 'bg-held-bg text-held-fg border-held-line',
}

// Each family has its own glyph so a chip reads without colour.
export function StatusGlyph({ family }: { family: StatusFamily }) {
  const common = { width: 10, height: 10, viewBox: '0 0 10 10', 'aria-hidden': true } as const
  switch (family) {
    case 'neutral':
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )
    case 'pending':
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 1.4a3.6 3.6 0 0 1 0 7.2Z" fill="currentColor" />
        </svg>
      )
    case 'progress':
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="4" fill="currentColor" />
        </svg>
      )
    case 'positive':
      return (
        <svg {...common}>
          <path d="m1.5 5.3 2.3 2.3L8.6 2.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'negative':
      return (
        <svg {...common}>
          <path d="m2 2 6 6M8 2 2 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'held':
      return (
        <svg {...common}>
          <path d="M5 1.2 8.8 5 5 8.8 1.2 5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )
  }
}

type StatusChipProps = {
  status: Status
  size?: 'sm' | 'md'
  className?: string
}

export function StatusChip({ status, size = 'md', className }: StatusChipProps) {
  const family = statusFamily[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs border font-medium',
        size === 'md' ? 'h-6 px-2 text-sm' : 'h-5 px-1.5 text-xs',
        familyClass[family],
        className,
      )}
    >
      <StatusGlyph family={family} />
      {status}
    </span>
  )
}
