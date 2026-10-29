import { cn } from './cn'

/**
 * Progress toward a number, in two parts: confirmed (solid) and pending (hatched). The two always add to the
 * figure the screen reports; a bar is never filled by a number the text doesn't also say.
 */
export function SplitBar({ confirmed, pending, total, className, label }: { confirmed: number; pending: number; total: number; className?: string; label: string }) {
  const w = (n: number) => `${total ? Math.min(100, (n / total) * 100) : 0}%`
  return (
    <div role="img" aria-label={label} className={cn('flex h-1.5 overflow-hidden rounded-full bg-haze', className)}>
      <div className="h-full bg-ink" style={{ width: w(confirmed) }} />
      <div className="hatched h-full" style={{ width: w(Math.min(pending, Math.max(0, total - confirmed))) }} />
    </div>
  )
}
