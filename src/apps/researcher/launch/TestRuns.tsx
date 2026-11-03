import { useEffect, useRef, useState } from 'react'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { formatDateTime } from '@/lib/format'
import {
  addRunIssue,
  buildRunReport,
  DEVICES,
  finishRun,
  ISSUE_CATEGORIES,
  runFor,
  runKey,
  setRun,
  setRunNote,
  supportedLanguages,
  type Device,
  type IssueCategory,
} from '@/state/launch'
import { startTestRun } from '@/state/testRunner'
import { PageHeader } from '../../shared/PageHeader'
import { LaunchGate } from './LaunchBits'
import { useLaunch } from './useLaunch'

type Cell = { language: string; device: Device }

export function TestRuns() {
  const { studyId, study, editable, guide, audience, launch, language, readiness: r, me, update } = useLaunch()
  const [selected, setSelected] = useState<Cell>()
  const [running, setRunning] = useState<{ key: string; step: number; steps: string[] }>()
  const [reporting, setReporting] = useState(false)
  const [category, setCategory] = useState<IssueCategory>('Media rendering')
  const [issue, setIssue] = useState('')
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)
  const latest = useRef({ r, guide, audience, launch })
  latest.current = { r, guide, audience, launch }

  const version = guide?.version ?? 0
  const languages = supportedLanguages(language, launch)

  // A run that was left "In progress" by a refresh can't resume, so it goes back to Not run.
  useEffect(() => {
    if (!launch || running) return
    const stuck = Object.entries(launch.runs).filter(([, x]) => x.status === 'In progress')
    if (stuck.length) update((d) => stuck.reduce((acc, [k, x]) => setRun(acc, k, { ...x, status: 'Not run' }), d))
  }, [launch, running, update])
  useEffect(() => () => clearInterval(timer.current), [])

  if (!editable || !study || !r) return <LaunchGate />

  const progress = r.progress
  const plan = r.compile.state === 'ok' ? r.compile.plan : undefined
  const sel = selected ?? { language: languages[0], device: DEVICES[0] }
  const selKey = runKey(sel.language, sel.device)
  const selRun = runFor(launch, sel.language, sel.device, version)

  const run = (cell: Cell) => {
    if (!plan || running) return
    const key = runKey(cell.language, cell.device)
    setSelected(cell)
    const { steps, stepMs } = startTestRun({ studyId, language: cell.language, device: cell.device })
    setRunning({ key, step: 0, steps })
    update((d) => setRun(d, key, { status: 'In progress', guideVersion: version }))
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      if (i < steps.length) return setRunning({ key, step: i, steps })
      clearInterval(timer.current)
      const cur = latest.current
      if (cur.r?.compile.state === 'ok') {
        const report = buildRunReport({ study: study, audience: cur.audience, guide: cur.guide, launch: cur.launch, language, plan: cur.r.compile.plan }, cell.language, cell.device)
        update((d) => finishRun(d, key, version, report))
      }
      setRunning(undefined)
    }, stepMs)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="R16" title="Test runs" description="Run the compiled plan once in every language on each device before you launch." />

      <p className="text-sm text-graphite">Running a test opens the participant interview in Test mode (built in Phase 5). No real data is recorded. For now the walkthrough is simulated from the compiled plan.</p>

      <section aria-label="Test run matrix">
        <p className="mb-2 text-sm tabular-nums">
          <span className="font-semibold">{progress.finished} of {progress.total}</span> combinations completed
          {progress.issues > 0 && <span className="text-negative-fg">, {progress.issues} with issues</span>}
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
                  <th scope="row" className="px-4 py-3 text-base font-medium">{lang}</th>
                  {DEVICES.map((d) => {
                    const x = runFor(launch, lang, d, version)
                    const key = runKey(lang, d)
                    const active = selKey === key
                    return (
                      <td key={d} className={cn('px-4 py-3', active && 'bg-paper')}>
                        <div className="flex flex-wrap items-center gap-2">
                          {running?.key === key ? <span className="flex items-center gap-1.5 text-sm"><Spinner /> In progress</span> : <StatusChip status={x.status} size="sm" />}
                          <Button size="sm" variant="ghost" disabled={!plan || !!running} onClick={() => run({ language: lang, device: d })} aria-label={`${x.status === 'Not run' ? 'Run' : 'Re-run'} ${lang} on ${d}`}>
                            {x.status === 'Not run' ? 'Run' : 'Re-run'}
                          </Button>
                          {x.status !== 'Not run' && (
                            <Button size="sm" variant="ghost" aria-pressed={active} onClick={() => setSelected({ language: lang, device: d })}>
                              Report
                            </Button>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Run report" className="rounded-md border border-mist bg-surface p-5">
        <h2 className="mb-3 text-md font-semibold">
          Run report <span className="font-normal text-graphite">· {sel.language}, {sel.device}</span>
        </h2>
        {running?.key === selKey ? (
          <div role="status" aria-live="polite">
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-haze">
              <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${((running.step + 1) / running.steps.length) * 100}%` }} />
            </div>
            <ol className="flex flex-col gap-1 text-sm">
              {running.steps.map((s, i) => (
                <li key={s} className={cn('flex items-center gap-2', i > running.step && 'text-muted')}>
                  {i < running.step ? <CheckIcon size={14} className="text-positive-fg" /> : i === running.step ? <Spinner /> : <span className="size-3.5" />}
                  {s}
                </li>
              ))}
            </ol>
          </div>
        ) : !selRun.report ? (
          <p className="text-sm text-graphite">{plan ? 'Not run yet. Run this combination to see what the interview does.' : 'The study plan has to compile before you can run a test.'}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-graphite">Mandatory questions covered</dt>
                <dd className="font-medium tabular-nums">{selRun.report.mandatoryCovered} of {selRun.report.mandatoryTotal}</dd>
              </div>
              <div>
                <dt className="text-graphite">Duration against target</dt>
                <dd className="font-medium tabular-nums">
                  {selRun.report.durationMin} min, target {selRun.report.targetMin}
                  {selRun.report.durationMin !== selRun.report.targetMin && <span className="font-normal text-graphite"> ({selRun.report.durationMin > selRun.report.targetMin ? '+' : ''}{selRun.report.durationMin - selRun.report.targetMin})</span>}
                </dd>
              </div>
              <div>
                <dt className="text-graphite">Surveys completed</dt>
                <dd className="font-medium tabular-nums">{selRun.report.surveysCompleted} of {selRun.report.surveysTotal}</dd>
              </div>
              <div>
                <dt className="text-graphite">Run</dt>
                <dd className="font-medium">{selRun.at ? formatDateTime(selRun.at) : ''}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-1 text-sm text-graphite">Stimuli shown</p>
              {selRun.report.stimuli.length === 0 ? (
                <p className="text-sm">None in the plan.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {selRun.report.stimuli.map((s) => (
                    <li key={s.name} className="flex items-center gap-2">
                      {s.ok ? <CheckIcon size={14} className="text-positive-fg" /> : <CloseIcon size={14} className="text-negative-fg" />}
                      <span className="flex-1">{s.name}</span>
                      <span className={s.ok ? 'text-graphite' : 'font-medium text-negative-fg'}>{s.ok ? 'Loaded' : 'Failed to load'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selRun.report.issues.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-negative-fg">Issues found</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {selRun.report.issues.map((x) => (
                    <li key={x.id}>
                      <span className="font-medium">{x.category}:</span> {x.text} <span className="text-graphite">({x.by})</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-graphite">Issues feed the preflight checks on the next screen.</p>
              </div>
            )}
            <TextArea label="Note (optional)" rows={2} value={selRun.report.note} onChange={(e) => update((d) => setRunNote(d, selKey, e.target.value))} />
            {reporting ? (
              <form
                className="flex flex-col gap-2 rounded-sm border border-mist bg-paper p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!issue.trim()) return
                  update((d) => addRunIssue(d, selKey, me, category, issue))
                  setIssue('')
                  setReporting(false)
                }}
              >
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">What kind of issue?</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value as IssueCategory)} className={cn(controlBase, 'h-9 w-56 pr-7')}>
                    {ISSUE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <TextArea label="What happened?" rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" size="sm" disabled={!issue.trim()}>Report issue</Button>
                  <Button size="sm" variant="ghost" onClick={() => setReporting(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <Button size="sm" className="self-start" onClick={() => setReporting(true)}>
                Report issue
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
