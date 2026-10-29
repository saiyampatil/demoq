import { Link } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/** Back to the parent screen, then where you are. Used inside a step instead of a sub-stepper. */
export function Breadcrumb({ parent, current, className = 'mb-4' }: { parent: { to: string; label: string }; current: string; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-sm text-graphite ${className}`}>
      <Link to={parent.to} className="inline-flex items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline">
        <ChevronLeftIcon size={14} />
        {parent.label}
      </Link>
      <ChevronRightIcon size={12} />
      <span aria-current="page" className="font-medium text-ink">
        {current}
      </span>
    </nav>
  )
}
