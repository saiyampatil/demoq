import { cn } from '@/components/cn'

// A screen's inventory ID, e.g. R4. Shown on placeholders and in the dev menu.
export function ScreenTag({ id, className }: { id: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-8 items-center justify-center rounded-xs border border-mist-strong bg-surface px-1.5 text-xs font-semibold text-graphite tabular-nums',
        className,
      )}
    >
      {id}
    </span>
  )
}
