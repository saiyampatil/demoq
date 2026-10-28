import { cn } from '@/components/cn'
import { AlertIcon, SparkIcon } from '@/components/icons'
import type { Origin } from '@/state/audience'

const base = 'inline-flex h-6 shrink-0 items-center gap-1 rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap'

/** Where a value came from. AI values stay marked until the audience is confirmed. */
export function OriginTag({ origin, className }: { origin: Origin | 'missing'; className?: string }) {
  if (origin === 'ai')
    return (
      <span className={cn(base, 'border-dashed border-iris-300 bg-iris-50 text-iris-700', className)}>
        <SparkIcon size={12} />
        AI-suggested from brief
      </span>
    )
  if (origin === 'missing')
    return (
      <span className={cn(base, 'border-pending-line bg-pending-bg text-pending-fg', className)}>
        <AlertIcon size={12} />
        Missing: not in brief
      </span>
    )
  return (
    <span className={cn(base, 'border-mist-strong bg-surface text-graphite', className)}>{origin === 'edited' ? 'Edited by you' : 'Added by you'}</span>
  )
}
