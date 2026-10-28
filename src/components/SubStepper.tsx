import { Link } from 'react-router'
import { cn } from './cn'
import { CheckIcon } from './icons'

export type SubStep = { id: string; label: string; to?: string; current: boolean; done?: boolean }

/** The screens inside one step, shown as a row. Screens not built yet are dimmed and not linked. */
export function SubStepper({ items, label = 'Screens in this step' }: { items: SubStep[]; label?: string }) {
  const at = items.findIndex((i) => i.current)
  return (
    <nav aria-label={label} className="mb-6">
      <ol className="hidden flex-wrap items-center gap-x-1 gap-y-2 sm:flex">
        {items.map((item, i) => {
          const body = (
            <>
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  item.current ? 'bg-ink text-white' : item.done ? 'bg-positive-bg text-positive-fg' : 'bg-haze text-graphite',
                )}
              >
                {item.done && !item.current ? <CheckIcon size={11} strokeWidth={2.4} /> : i + 1}
              </span>
              {item.label}
            </>
          )
          const cls = cn(
            'flex items-center gap-2 rounded-sm px-2 py-1 text-sm',
            item.current ? 'font-semibold text-ink' : item.to ? 'text-graphite hover:bg-haze hover:text-ink' : 'text-muted',
          )
          return (
            <li key={item.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-mist-strong" />}
              {item.to ? (
                <Link to={item.to} aria-current={item.current ? 'step' : undefined} className={cls}>
                  {body}
                </Link>
              ) : (
                <span className={cls} title="Not built yet">
                  {body}
                  <span className="sr-only"> (not built yet)</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-sm sm:hidden" aria-hidden="true">
        <span className="text-graphite tabular-nums">
          Screen {at + 1} of {items.length}
        </span>{' '}
        <span className="font-semibold">{items[at]?.label}</span>
      </p>
    </nav>
  )
}
