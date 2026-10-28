import { AIGeneratedTag } from '@/components/AIGenerated'
import { AlertIcon } from '@/components/icons'
import type { SourceTag as Source } from '@/state/brief'

export function SourceTag({ source }: { source: Source }) {
  if (source === 'AI-generated') return <AIGeneratedTag />
  if (source === 'Missing')
    return (
      <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-xs border border-pending-line bg-pending-bg px-1.5 text-xs font-medium text-pending-fg">
        <AlertIcon size={12} />
        Missing
      </span>
    )
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-xs border border-mist-strong bg-surface px-1.5 text-xs font-medium text-graphite">
      Client-provided
    </span>
  )
}
