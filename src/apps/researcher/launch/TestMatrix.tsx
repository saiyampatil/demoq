import { Button, Spinner } from '@/components/Button'
import { Tooltip } from '@/components/Tooltip'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/format'
import { DEVICES, runFor, type Device, type LaunchDoc, type Run } from '@/state/launch'

/** One cell of the matrix: what the run's state is, drawn so it doesn't rely on colour alone. */
function Cell({ language, device, run, onRun, onReport, readOnly }: { language: string; device: Device; run: Run; onRun: () => void; onReport: () => void; readOnly?: string }) {
  const stamp = run.at ? formatDateTime(run.at) : undefined
  const button = (label: string, aria: string, on: () => void) =>
    readOnly ? (
      <Tooltip content={readOnly} focusable>
        <Button size="sm" disabled aria-label={aria}>
          {label}
        </Button>
      </Tooltip>
    ) : (
      <Button size="sm" onClick={on} aria-label={aria}>
        {label}
      </Button>
    )

  if (run.status === 'Completed')
    return (
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-positive-fg">
          <CheckIcon size={14} strokeWidth={2.4} /> Completed
        </span>
        {stamp && <span className="text-xs text-graphite tabular-nums">{stamp}</span>}
      </div>
    )
  if (run.status === 'Issues found')
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-negative-fg">
            <AlertIcon size={14} /> Issues found
          </span>
          {stamp && <span className="text-xs text-graphite tabular-nums">{stamp}</span>}
        </span>
        <span className="flex flex-wrap gap-2">
          {button('Run', `Run ${language} on ${device}`, onRun)}
          {button('Report', `Report for ${language} on ${device}`, onReport)}
        </span>
      </div>
    )
  if (run.status === 'In progress')
    return (
      <span className="flex items-center gap-1.5 text-sm">
        <Spinner /> In progress
      </span>
    )
  // Not run: the cell is blank apart from the Run button.
  return (
    <div className="flex items-center">
      <span className="sr-only">Not run</span>
      {button('Run', `Run ${language} on ${device}`, onRun)}
    </div>
  )
}

/**
 * The test runs, one row per language and one column per device. It reads the same runs R16 writes
 * (`LaunchDoc.runs`, keyed by language and device), so a run done on either screen shows on both.
 */
export function TestMatrix({ languages, launch, guideVersion, readOnly }: { languages: string[]; launch: LaunchDoc | undefined; guideVersion: number; readOnly?: string }) {
  const runs = languages.flatMap((l) => DEVICES.map((d) => runFor(launch, l, d, guideVersion)))
  const finished = runs.filter((r) => r.status === 'Completed' || r.status === 'Issues found').length
  const issues = runs.filter((r) => r.status === 'Issues found').length
  return (
    <section aria-label="Test runs">
      <h2 className="mb-1 text-md font-semibold">Test runs</h2>
      <p className="mb-2 text-sm text-graphite">
        Run the compiled plan once in every language on each device. Every combination has to be completed, or have its issues reported, before you can launch.
      </p>
      <p className="mb-2 text-sm tabular-nums" data-testid="matrix-progress">
        <span className="font-semibold">{finished} of {runs.length}</span> combinations finished
        {issues > 0 && <span className="text-negative-fg">, {issues} with issues</span>}
      </p>
      <div className="overflow-x-auto rounded-md border border-mist bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Test runs by language and device</caption>
          <thead>
            <tr className="border-b border-mist bg-haze">
              <th scope="col" className="h-9 px-4 text-sm font-medium text-graphite">Language</th>
              {DEVICES.map((d) => (
                <th key={d} scope="col" className="h-9 px-4 text-sm font-medium text-graphite">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {languages.map((lang) => (
              <tr key={lang} className="border-b border-mist last:border-0">
                <th scope="row" className="px-4 py-3 align-top text-base font-medium">{lang}</th>
                {DEVICES.map((d) => (
                  <td key={d} className="px-4 py-3 align-top" data-cell={`${lang}|${d}`}>
                    {/* The modal that opens from Run and Report comes next; until then the buttons say so. */}
                    <Cell language={lang} device={d} run={runFor(launch, lang, d, guideVersion)} readOnly={readOnly ?? 'The test run opens in the next step.'} onRun={() => {}} onReport={() => {}} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
