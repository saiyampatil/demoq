import type { ReactNode } from 'react'
import { cn } from './cn'
import { SparkIcon } from './icons'

export function AIGeneratedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-xs border border-dashed border-iris-300 bg-iris-50 px-1.5 text-xs font-medium text-iris-700',
        className,
      )}
    >
      <SparkIcon size={12} />
      AI-generated
    </span>
  )
}

type AIContentProps = {
  children: ReactNode
  /** What the AI produced, e.g. "Web scan synthesis". */
  label?: string
  /** Accept / Edit controls. AI content is not final until someone accepts it. */
  actions?: ReactNode
  className?: string
}

export function AIContent({ children, label, actions, className }: AIContentProps) {
  return (
    <section className={cn('ai-surface p-4', className)}>
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <AIGeneratedTag />
        {label && <span className="text-sm text-graphite">{label}</span>}
        {actions && <div className="ml-auto flex gap-2">{actions}</div>}
      </header>
      <div className="text-ink">{children}</div>
    </section>
  )
}
