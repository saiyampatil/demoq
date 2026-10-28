import type { ReactNode } from 'react'
import { cn } from './cn'

type QuoteProps = {
  children: ReactNode
  /** Who said it and when, e.g. "P-07, 12:41 into the session". */
  source?: string
  className?: string
}

// The participant's own words. Serif is reserved for verbatims only.
export function Quote({ children, source, className }: QuoteProps) {
  return (
    <figure className={cn('border-l-2 border-mist-strong pl-4', className)}>
      <blockquote className="max-w-prose font-serif text-quote text-ink">“{children}”</blockquote>
      {source && <figcaption className="mt-1.5 text-sm text-graphite">{source}</figcaption>}
    </figure>
  )
}
