import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/format'
import { cellState, DEVICES, runKey, type CompileResult, type Inputs, type LaunchDoc } from '@/state/launch'
import { TestMatrix } from './TestMatrix'
import { TestRunModal, type RunTarget } from './TestRunModal'

/**
 * The interview test runs as one row: how it stands, and one button that runs what is next. A study in more than one
 * language, or with several devices, has a run for every combination; they are behind "Show every combination" and the
 * button always picks the next one that still needs running.
 */
export function TestRunsRow({
  languages,
  launch,
  guideVersion,
  compile,
  compiling,
  inputs,
  me,
  studyId,
  update,
}: {
  languages: string[]
  launch: LaunchDoc | undefined
  guideVersion: number
  compile: CompileResult
  compiling: boolean
  inputs: Inputs
  me: string
  studyId: string
  update: (fn: (d: LaunchDoc) => LaunchDoc) => void
}) {
  const [target, setTarget] = useState<RunTarget>()
  const [all, setAll] = useState(false)
  const cells = languages.flatMap((language) => DEVICES.map((device) => ({ language, device, state: cellState(launch, language, device, guideVersion) })))
  const total = cells.length
  const kinds = (k: string[]) => cells.filter((c) => k.includes(c.state.kind))
  const finished = kinds(['completed', 'issues']).length
  const withIssues = kinds(['issues'])
  const stale = kinds(['out-of-date'])
  const next = cells.find((c) => ['not-run', 'in-progress', 'out-of-date'].includes(c.state.kind))
  const ok = compile.state === 'ok' && !compiling

  let word = 'Not run'
  let tone: 'none' | 'pass' | 'warn' | 'fail' = 'none'
  let text = total > 1 ? `Run the plan in each of the ${total} combinations before you launch.` : 'Run the plan once before you launch.'
  if (!ok) {
    word = 'Not available'
    text = compiling ? 'Compiling the study plan…' : compile.state === 'failed' ? 'The study plan has errors. Fix them in the guide first.' : `The study plan isn’t compiled. ${compile.state === 'waiting' ? compile.reason : ''}`
  } else if (stale.length > 0) {
    word = 'Out of date'
    tone = 'warn'
    text = `Ran on guide v${stale[0].state.ranOn}. Run it again.`
  } else if (finished === total) {
    if (withIssues.length > 0) {
      word = 'Issues found'
      tone = 'fail'
      text = `${withIssues.length} of ${total} ${total === 1 ? 'run' : 'runs'} reported issues. Open the report to read them.`
    } else {
      word = 'Completed'
      tone = 'pass'
      const last = cells.map((c) => c.state.run?.at).filter(Boolean).sort().at(-1)
      text = `${total === 1 ? 'Ran' : `All ${total} combinations ran`} on guide v${guideVersion}${last ? `, ${formatDateTime(last)}` : ''}.`
    }
  } else if (finished > 0) {
    word = 'In progress'
    text = `${finished} of ${total} combinations finished.`
  }

  const runTarget: RunTarget | undefined = next ? { language: next.language, device: next.device } : cells[0] ? { language: cells[0].language, device: cells[0].device } : undefined
  const reportCell = withIssues[0]
  const label = next ? 'Run' : 'Run again'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-mist bg-surface px-4 py-3" data-testid="test-run-row" data-tone={tone}>
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', tone === 'pass' && 'bg-positive-bg text-positive-fg', (tone === 'warn' || tone === 'fail') && 'bg-pending-bg text-pending-fg', tone === 'none' && 'bg-haze text-graphite ring-1 ring-mist-strong')} role="img" aria-label={word}>
          {tone === 'pass' ? <CheckIcon size={12} strokeWidth={2.4} /> : tone === 'none' ? <span className="size-1.5 rounded-full bg-graphite" /> : <AlertIcon size={12} />}
        </span>
        <span className={cn('font-medium', tone === 'warn' && 'text-pending-fg', tone === 'fail' && 'text-negative-fg')}>{word}</span>
        <span className="min-w-0 flex-1 basis-60 text-sm text-graphite tabular-nums">{text}</span>
        <span className="flex gap-2">
          {tone === 'fail' && reportCell && (
            <Button size="sm" onClick={() => setTarget({ language: reportCell.language, device: reportCell.device, view: true })}>
              View report
            </Button>
          )}
          <Button size="sm" disabled={!ok || !runTarget} onClick={() => runTarget && setTarget(runTarget)} data-testid="run-next">
            {label}
          </Button>
        </span>
      </div>
      {total > 1 && ok && (
        <div className="mt-2">
          <button type="button" aria-expanded={all} onClick={() => setAll((x) => !x)} className="text-sm font-medium text-iris-700 hover:underline">
            {all ? 'Hide the combinations' : `Show every combination (${finished} of ${total} finished)`}
          </button>
          {all && (
            <div className="mt-2">
              <TestMatrix bare languages={languages} launch={launch} guideVersion={guideVersion} compile={compile} inputs={inputs} me={me} studyId={studyId} update={update} />
            </div>
          )}
        </div>
      )}
      {ok && compile.state === 'ok' && target && (
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
    </div>
  )
}
