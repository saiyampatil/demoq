import { useEffect, useRef, useState } from 'react'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { formatDateTime } from '@/lib/format'
import { now } from '@/state/brief'
import {
  buildRunReport,
  ISSUE_CATEGORIES,
  makeRunIssue,
  recordRun,
  runKey,
  type Acknowledged,
  type Device,
  type Inputs,
  type IssueCategory,
  type LaunchDoc,
  type Run,
  type RunReport,
  type StudyPlan,
} from '@/state/launch'
import { startTestRun } from '@/state/testRunner'
import { RunReportView } from './RunReportView'

export type RunTarget = { language: string; device: Device; /** Open on the saved report instead of the start screen. */ view?: boolean }

type Step = 'start' | 'running' | 'report' | 'issue'

/**
 * One test run, in a modal. It reuses the same simulated walkthrough (`startTestRun`) and the same report
 * (`buildRunReport`) as R16. Nothing changes in the matrix until the Researcher decides: Mark complete, or Report an issue.
 */
export function TestRunModal({
  target,
  plan,
  inputs,
  saved,
  guideVersion,
  me,
  studyId,
  update,
  onClose,
}: {
  target: RunTarget | undefined
  plan: StudyPlan
  inputs: Inputs
  /** The run already stored for this cell, if any. */
  saved: Run | undefined
  guideVersion: number
  me: string
  studyId: string
  update: (fn: (d: LaunchDoc) => LaunchDoc) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('start')
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<string[]>([])
  const [report, setReport] = useState<RunReport>()
  const [fresh, setFresh] = useState(false)
  const [category, setCategory] = useState<IssueCategory>('Media rendering')
  const [note, setNote] = useState('')
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)
  const latest = useRef({ inputs, plan })
  latest.current = { inputs, plan }

  // Each time the modal opens it starts clean: on the saved report if asked, otherwise on the start screen.
  const key = target ? runKey(target.language, target.device) : ''
  useEffect(() => {
    clearInterval(timer.current)
    setNote('')
    setCategory('Media rendering')
    if (target?.view && saved?.report) {
      setReport(saved.report)
      setFresh(false)
      setStep('report')
    } else {
      setReport(undefined)
      setFresh(false)
      setStep('start')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, target?.view])
  useEffect(() => () => clearInterval(timer.current), [])

  if (!target) return null
  const { language, device } = target

  const close = () => {
    clearInterval(timer.current)
    onClose()
  }

  const start = () => {
    clearInterval(timer.current)
    const { steps: list, stepMs } = startTestRun({ studyId, language, device })
    setSteps(list)
    setProgress(0)
    setReport(undefined)
    setStep('running')
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      if (i < list.length) return setProgress(i)
      clearInterval(timer.current)
      const cur = latest.current
      setReport(buildRunReport({ ...cur.inputs, plan: cur.plan }, language, device))
      setFresh(true)
      setStep('report')
    }, stepMs)
  }

  const found = report?.issues ?? []
  const decide = (outcome: 'Completed' | 'Issues found', r: RunReport, acknowledged?: Acknowledged) => {
    update((d) => recordRun(d, key, guideVersion, r, outcome, acknowledged))
    close()
  }
  // Marking a run complete is always the Researcher's call. If the report shows problems, that is recorded with it.
  const markComplete = (r: RunReport) => decide('Completed', r, r.issues.length > 0 ? { by: me, at: now(), problems: r.issues.length } : undefined)

  const footer =
    step === 'report' && report ? (
      <>
        <Button variant="ghost" onClick={start}>
          Run again
        </Button>
        <Button onClick={() => setStep('issue')}>Report an issue</Button>
        {fresh && (
          <Button variant="primary" onClick={() => markComplete(report)}>
            Mark complete
          </Button>
        )}
        {!fresh && (
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        )}
      </>
    ) : step === 'issue' && report ? (
      <>
        <Button variant="ghost" onClick={() => setStep('report')}>
          Back
        </Button>
        <Button variant="primary" onClick={() => decide('Issues found', { ...report, issues: [...report.issues, makeRunIssue(category, note, me)] })}>
          Record issue
        </Button>
      </>
    ) : (
      <Button variant="ghost" onClick={close}>
        Cancel
      </Button>
    )

  return (
    <Modal open onClose={close} size="lg" title={`Test run: ${language}, ${device}`} description={saved?.at && step === 'start' ? `Last run ${formatDateTime(saved.at)}. The earlier result stays until you mark this run.` : undefined} footer={footer}>
      <div className="flex flex-col gap-4 pb-1">
        {step === 'start' && (
          <div className="flex flex-col items-start gap-3">
            <Button variant="primary" className="h-11 px-8 text-md" onClick={start}>
              Start test run
            </Button>
            <p className="text-sm text-graphite">Opens the interview in Test mode. No real data is recorded.</p>
          </div>
        )}

        {step === 'running' && (
          <div role="status" aria-live="polite" data-testid="running">
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-haze">
              <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${((progress + 1) / steps.length) * 100}%` }} />
            </div>
            <ol className="flex flex-col gap-1 text-sm">
              {steps.map((s, i) => (
                <li key={s} className={cn('flex items-center gap-2', i > progress && 'text-muted')}>
                  {i < progress ? <CheckIcon size={14} className="text-positive-fg" /> : i === progress ? <Spinner /> : <span className="size-3.5" />}
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}

        {step === 'report' && report && (
          <>
            {saved?.at && !fresh && (
              <p className="text-sm text-graphite tabular-nums">
                {`Saved result from ${formatDateTime(saved.at)}: ${saved.status}.`}
                {saved.acknowledged && ` Marked complete by ${saved.acknowledged.by} with ${saved.acknowledged.problems} ${saved.acknowledged.problems === 1 ? 'problem' : 'problems'} showing.`}
              </p>
            )}
            <RunReportView report={report} />
            {found.length > 0 && (
              <div data-testid="found-issues">
                <p className="mb-1 text-sm font-medium text-negative-fg">{fresh ? 'Found during this run' : 'Issues on this run'}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {found.map((x) => (
                    <li key={x.id}>
                      <span className="font-medium">{x.category}:</span> {x.text} <span className="text-graphite">({x.by})</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-graphite">
                  {fresh ? 'The report is information. You can still mark this run complete: it is recorded that you did, with these problems showing.' : 'Issues feed the pre-launch checks.'}
                </p>
              </div>
            )}
          </>
        )}

        {step === 'issue' && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">What kind of issue?</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as IssueCategory)} className={cn(controlBase, 'h-9 w-64 pr-7')}>
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <TextArea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any issues to report?" />
            <p className="text-xs text-graphite">Recording this marks the run Issues found. It feeds the {category.toLowerCase()} check before launch.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
