import type { ReactNode } from 'react'
import { ScreenTag } from './ScreenTag'

type PageHeaderProps = {
  id: string
  title: string
  description?: ReactNode
  /** Version, status and save state, shown under the title. */
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ id, title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <ScreenTag id={id} className="mt-1" />
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-0.5 max-w-prose text-graphite">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-graphite">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
