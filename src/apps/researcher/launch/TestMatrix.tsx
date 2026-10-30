import { useState } from 'react'
import { Button, Spinner } from '@/components/Button'
import { Tooltip } from '@/components/Tooltip'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/format'
import { cellState, DEVICES, runKey, type CellState, type CompileResult, type Device, type Inputs, type LaunchDoc } from '@/state/launch'
import { TestRunModal, type RunTarget } from './TestRunModal'

/** One cell of the matrix: what the run's state is, drawn so it doesn't rely on colour alone. */
function Cell({ language, device, state, blocked, onRun, onReport }: { language: string; device: Device; state: CellState; blocked?: string; onRun: () => void; onReport: () => void }) {
  const stamp = state.run?.at ? formatDateTime(state.run.at) : undefined
  const button = (label: string, aria: string, on: () => void) =>
    blocked ? (
      <Tooltip content={blocked} focusable>
        <Button size="sm" disabled aria-label={aria}>
          {label}
        </Button>
      </Tooltip>
    ) : (
      <Button size="sm" onClick={on} aria-label={aria}>
        {label}
      </Button>
    )
  const run = button('Run', `Run ${language} on ${device}`, onRun)
  const report = button('Report', `Report for ${language} on ${device}`, onReport)

  if (state.kind === 'completed')
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-positive-fg">
            <CheckIcon size={14} strokeWidth={2.4} /> Completed
          </span>
          {stamp && <span className="text-xs text-graphite tabular-nums">{stamp}</span>}
          {state.run?.acknowledged && (
            <span className="text-xs text-pending-fg">{`Marked complete with ${state.run.acknowledged.problems} ${state.run.acknowledged.problems === 1 ? 'problem' : 'problems'} showing`}</span>
          )}
        </span>
        <span className="flex flex-wrap gap-2">
          {run}
          {report}
        </span>
      </div>
    )
  if (state.kind === 'issues')
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-negative-fg">
            <AlertIcon size={14} /> Issues found
          </span>
          {stamp && <span className="text-xs text-graphite tabular-nums">{stamp}</span>}
        </span>
        <span className="flex flex-wrap gap-2">
          {run}
          {report}
        </span>
      </div>
    )
  if (state.kind === 'out-of-date')
    return (
      <div className="flex flex-col gap-1.5">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-pending-fg">
            <AlertIcon size={14} /> Out of date
          </span>
          <span className="text-xs text-graphite tabular-nums">{`Ran on guide v${state.ranOn}. Run it again.`}</span>
        </span>
        <span className="flex flex-wrap gap-2">{run}</span>
      </div>
    )
  if (state.kind === 'in-progress')
    return (
      <span className="flex items-center gap-1.5 text-sm">
        <Spinner /> In progress
      </span>
    )
  // Not run: the cell is blank apart from the Run button.
  return (
    <div className="flex items-center">
      <span className="sr-only">Not run</span>
      {run}
    </div>
  )
}

/**
 * The test runs, one row per language and one column per device. It reads and writes `LaunchDoc.runs`, the one
 * store R17 reads too. It shows whenever the study plan compiles; if the plan doesn't, it shows with every run disabled
 * and says why.
 */
export function TestMatrix({
  languages,
  launch,
  guideVersion,
  compile,
  inputs,
  me,
  studyId,
  update,
}: {
  languages: string[]
  launch: LaunchDoc | undefined
  guideVersion: number
  compile: CompileResult
  inputs: Inputs
  me: string
  studyId: string
  update: (fn: (d: LaunchDoc) => LaunchDoc) => void
}) {
  const [target, setTarget] = useState<RunTarget>()
  const states = languages.flatMap((l) => DEVICES.map((d) => cellState(launch, l, d, guideVersion)))
  const finished = states.filter((s) => s.kind === 'completed' || s.kind === 'issues').length
  const issues = states.filter((s) => s.kind === 'issues').length
  const stale = states.filter((s) => s.kind === 'out-of-date').length
  const blocked =
    compile.state === 'ok' ? undefined : compile.state === 'failed' ? 'The study plan has errors. Fix them in the guide first.' : `The study plan isn’t compiled. ${compile.reason}`

  return (
    <section aria-label="Test runs">
      <h2 className="mb-1 text-md font-semibold">Test runs</h2>
      <p className="mb-2 text-sm text-graphite">
        Run the compiled plan once in every language on each device. Every combination has to be completed, or have its issues reported, before you can launch.
      </p>
      {blocked && (
        <p role="status" data-testid="matrix-blocked" className="mb-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg">
          Test runs are off. {blocked}
        </p>
      )}
      <p className="mb-2 text-sm tabular-nums" data-testid="matrix-progress">
        <span className="font-semibold">{finished} of {states.length}</span> combinations finished
        {issues > 0 && <span className="text-negative-fg">, {issues} with issues</span>}
        {stale > 0 && <span className="text-pending-fg">, {stale} out of date</span>}
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
                    <Cell
                      language={lang}
                      device={d}
                      state={cellState(launch, lang, d, guideVersion)}
                      blocked={blocked}
                      onRun={() => setTarget({ language: lang, device: d })}
                      onReport={() => setTarget({ language: lang, device: d, view: true })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compile.state === 'ok' && target && (
        <TestRunModal
          target={target}
          plan={compile.plan}
          inputs={inputs}
          saved={launch?.runs[runKey(target.language, target.device)]}
          guideVersion={guideVersion}
          me={me}
          studyId={studyId}
          update={update}
          onClose={() => setTarget(undefined)}
        />
      )}
    </section>
  )
}
