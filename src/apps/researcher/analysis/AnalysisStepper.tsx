import { cn } from '@/components/cn'
import { LockIcon } from '@/components/icons'
import { Tooltip } from '@/components/Tooltip'

/** The steps of Results Analysis (docs/ANALYSIS_PLAN.md). Only Base is built; the rest stay locked until the base is approved. */
export const ANALYSIS_STEPS = ['Base', 'Codebook', 'Themes', 'Signals & tensions', 'Findings', 'Outputs', 'Lenses', 'Publish'] as const

export function AnalysisStepper({ current = 0, unlocked = 1 }: { current?: number; unlocked?: number }) {
  return (
    <nav aria-label="Analysis steps">
      <ol className="flex flex-wrap items-center gap-x-0.5 gap-y-2 xl:gap-x-1">
        {ANALYSIS_STEPS.map((label, i) => {
          const isCurrent = i === current
          const locked = i >= unlocked
          const body = (
            <>
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  isCurrent ? 'bg-ink text-white' : 'bg-haze text-graphite',
                )}
              >
                {locked ? <LockIcon size={10} /> : i + 1}
              </span>
              {label}
            </>
          )
          const cls = cn('flex items-center gap-1 rounded-sm px-1 py-1 text-sm whitespace-nowrap xl:gap-2 xl:px-2', isCurrent ? 'font-semibold text-ink' : 'text-muted')
          return (
            <li key={label} className="flex items-center gap-0.5 xl:gap-1">
              {i > 0 && <span aria-hidden="true" className="hidden h-px w-3 bg-mist-strong xl:block" />}
              {locked ? (
                <Tooltip content="Approve the base first" focusable align="left">
                  <span className={cls} aria-disabled="true">
                    {body}
                    <span className="sr-only"> (locked: approve the base first)</span>
                  </span>
                </Tooltip>
              ) : (
                <span className={cls} aria-current={isCurrent ? 'step' : undefined}>
                  {body}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
