import type { ReactNode } from 'react'
import { Button } from './Button'
import { ChevronLeftIcon } from './icons'

/**
 * Previous on the left, what this screen needs in the middle, the way forward on the right.
 * `sticky={false}` keeps it at the end of the page, for long dashboards where a floating bar would cover content.
 */
export function WizardFooter({ previous, children, message, sticky = true }: { previous?: { to: string; label: string }; message?: ReactNode; children?: ReactNode; sticky?: boolean }) {
  return (
    <div
      className={
        sticky
          ? 'sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-mist bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8'
          : 'mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-mist pt-4'
      }
    >
      {previous && (
        <Button variant="ghost" to={previous.to} icon={<ChevronLeftIcon />}>
          Previous<span className="sr-only">: {previous.label}</span>
        </Button>
      )}
      <div className="min-w-0 flex-1 basis-48 text-sm text-graphite">{message}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}
