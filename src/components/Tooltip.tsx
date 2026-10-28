import { useId, type ReactNode } from 'react'
import { cn } from './cn'

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  /** Make the wrapper focusable, so keyboard users can reach the tip of a disabled control. */
  focusable?: boolean
  align?: 'left' | 'right'
}

export function Tooltip({ content, children, focusable, align = 'right' }: TooltipProps) {
  const id = useId()
  return (
    <span className="group relative inline-flex" tabIndex={focusable ? 0 : undefined} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute top-full z-30 mt-2 w-max max-w-64 rounded-sm bg-ink px-2.5 py-1.5 text-xs font-normal text-white opacity-0 shadow-overlay transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
          align === 'right' ? 'right-0' : 'left-0',
        )}
      >
        {content}
      </span>
    </span>
  )
}
