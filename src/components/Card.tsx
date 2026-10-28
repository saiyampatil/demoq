import type { ReactNode } from 'react'
import { cn } from './cn'

type CardProps = {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** Removes inner padding, for tables and lists that run edge to edge. */
  flush?: boolean
  className?: string
}

export function Card({ title, description, actions, children, flush, className }: CardProps) {
  return (
    <section className={cn('rounded-md border border-mist bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-start gap-4 border-b border-mist px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-md font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-graphite">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  )
}
