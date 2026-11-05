import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { CheckIcon, LockIcon } from '@/components/icons'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import { useAnalysisSteps, type AnalysisStepKey, type StepProgress } from '@/state/analysisProgress'

const PROGRESS_TEXT: Record<StepProgress, string> = { 'Not started': 'Not started', 'In progress': 'In progress', Done: 'Done' }

/**
 * The three steps of Results Analysis (docs/ANALYSIS_PLAN.md), on every analysis screen. Each step says where it stands
 * and what is left, so the Researcher never has to look for the next thing to do.
 */
export function AnalysisStepper({ studyId, current }: { studyId: string; current: AnalysisStepKey }) {
  const steps = useAnalysisSteps(studyId)
  return (
    <nav aria-label="Analysis steps" data-testid="analysis-stepper">
      <ol className="grid gap-2 md:grid-cols-3">
        {steps.map((s, i) => {
          const isCurrent = s.key === current
          const body = (
            <>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  s.status === 'Done' ? 'bg-positive-bg text-positive-fg' : isCurrent ? 'bg-ink text-white' : 'bg-haze text-graphite',
                )}
              >
                {s.locked ? <LockIcon size={11} /> : s.status === 'Done' ? <CheckIcon size={12} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', isCurrent ? 'font-semibold text-ink' : 'font-medium text-graphite')}>{s.label}</span>
                <span className="block truncate text-xs text-graphite" title={s.hint}>
                  {s.locked ? s.hint : s.status === 'Not started' && s.key !== 'codebook' ? s.hint : `${PROGRESS_TEXT[s.status]} · ${s.hint}`}
                </span>
              </span>
            </>
          )
          const cls = cn(
            'flex items-start gap-2.5 rounded-md border px-3 py-2.5',
            isCurrent ? 'border-ink bg-surface' : 'border-mist bg-surface',
            s.locked ? 'opacity-70' : !isCurrent && 'hover:border-mist-strong hover:bg-paper',
          )
          return (
            <li key={s.key} data-step={s.key} data-status={s.status} data-locked={s.locked}>
              {s.locked ? (
                <Tooltip content={s.lockedReason ?? 'Not available yet'} focusable align="left" className="flex w-full">
                  <span className={cn(cls, 'w-full')} aria-disabled="true">
                    {body}
                    <span className="sr-only"> (locked: {s.lockedReason})</span>
                  </span>
                </Tooltip>
              ) : (
                <Link to={studyPath(studyId, screenById[s.screenId])} aria-current={isCurrent ? 'step' : undefined} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
