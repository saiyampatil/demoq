import { StatusGlyph } from '@/components/StatusChip'
import { AlertIcon, SparkIcon } from '@/components/icons'
import type { SectionState } from '@/state/brief'

export const stateLabel: Record<SectionState, string> = {
  ready: 'Ready',
  review: 'Review AI draft',
  missing: 'Missing',
  conflict: 'Conflict',
}

export function SectionStatusIcon({ state }: { state: SectionState }) {
  if (state === 'review') return <SparkIcon size={14} className="text-iris-600" />
  if (state === 'conflict') return <AlertIcon size={14} className="text-negative-fg" />
  return (
    <span className={state === 'ready' ? 'text-positive-fg' : 'text-pending-fg'}>
      <StatusGlyph family={state === 'ready' ? 'positive' : 'pending'} />
    </span>
  )
}
