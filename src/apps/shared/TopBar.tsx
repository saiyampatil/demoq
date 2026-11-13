import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { cn } from '@/components/cn'
import { PulseMark } from '@/components/icons'

type TopBarProps = {
  home: string
  /** Which app this is, shown after the wordmark (not shown for the Researcher app). */
  context?: ReactNode
  nav?: { to: string; label: string; end?: boolean }[]
  right?: ReactNode
}

export function TopBar({ home, context, nav, right }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex print:hidden h-topbar items-center gap-6 border-b border-mist bg-surface px-4 sm:px-5">
      <div className="flex items-center gap-2.5">
        <Link to={home} className="flex items-center gap-2 rounded-xs font-semibold text-ink">
          <PulseMark />
          <span>PulseAI Qual</span>
        </Link>
        {context && (
          <>
            <span className="h-4 w-px bg-mist-strong" aria-hidden="true" />
            <span className="text-sm text-graphite">{context}</span>
          </>
        )}
      </div>
      {nav && (
        <nav aria-label="Main" className="flex h-full items-stretch gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center border-b-2 px-2 text-sm font-medium',
                  isActive ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3">{right}</div>
    </header>
  )
}

export function UserBadge({ name, title }: { name: string; title?: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-4">{name}</div>
        {title && <div className="text-xs text-graphite">{title}</div>}
      </div>
      <span className="flex size-8 items-center justify-center rounded-full bg-haze text-xs font-semibold text-graphite ring-1 ring-mist">
        {initials}
      </span>
    </div>
  )
}
