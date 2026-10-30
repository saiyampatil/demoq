import { CheckIcon, CloseIcon } from '@/components/icons'
import type { RunReport } from '@/state/launch'

/** What a test run found, read from the report built off the compiled plan. */
export function RunReportView({ report }: { report: RunReport }) {
  const loaded = report.stimuli.filter((s) => s.ok).length
  const diff = report.durationMin - report.targetMin
  return (
    <div className="flex flex-col gap-4" aria-label="Run report">
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-graphite">Mandatory questions covered</dt>
          <dd data-testid="rr-mandatory" className="font-medium tabular-nums">{report.mandatoryCovered} of {report.mandatoryTotal}</dd>
        </div>
        <div>
          <dt className="text-graphite">Duration against target</dt>
          <dd data-testid="rr-duration" className="font-medium tabular-nums">
            {report.durationMin} min, target {report.targetMin}
            {diff !== 0 && <span className="font-normal text-graphite"> ({diff > 0 ? '+' : ''}{diff})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-graphite">Surveys completed</dt>
          <dd data-testid="rr-surveys" className="font-medium tabular-nums">{report.surveysCompleted} of {report.surveysTotal}</dd>
        </div>
        <div>
          <dt className="text-graphite">Stimuli loaded</dt>
          <dd data-testid="rr-stimuli" className="font-medium tabular-nums">{loaded} of {report.stimuli.length}</dd>
        </div>
      </dl>
      {report.stimuli.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {report.stimuli.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              {s.ok ? <CheckIcon size={14} className="text-positive-fg" /> : <CloseIcon size={14} className="text-negative-fg" />}
              <span className="flex-1">{s.name}</span>
              <span className={s.ok ? 'text-graphite' : 'font-medium text-negative-fg'}>{s.ok ? 'Loaded' : 'Failed to load'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
