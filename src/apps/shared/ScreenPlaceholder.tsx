import type { ReactNode } from 'react'
import { EmptyState } from '@/components/States'
import { LayersIcon } from '@/components/icons'
import { screenById } from '@/routes/screens'
import { ScreenTag } from './ScreenTag'

type ScreenPlaceholderProps = {
  id: string
  /** Extra content under the header, e.g. a button that opens a drawer screen. */
  children?: ReactNode
  compact?: boolean
}

export function ScreenHeader({ id, aside }: { id: string; aside?: ReactNode }) {
  const screen = screenById[id]
  return (
    <header className="flex flex-wrap items-start gap-3">
      <ScreenTag id={screen.id} className="mt-1" />
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold">{screen.name}</h1>
        <p className="mt-0.5 text-sm text-graphite">
          {screen.module === '—' ? 'No module' : `Module ${screen.module}`}, built in Phase {screen.phase}
        </p>
      </div>
      {aside}
    </header>
  )
}

export function ScreenPlaceholder({ id, children, compact }: ScreenPlaceholderProps) {
  const screen = screenById[id]
  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader id={id} />
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState
          className={compact ? 'py-8' : undefined}
          icon={<LayersIcon size={20} />}
          title="This screen is a placeholder"
          description={`${screen.id} ${screen.name} gets built in Phase ${screen.phase}. Until then this page only reserves its route.`}
          action={children}
        />
      </div>
    </div>
  )
}
