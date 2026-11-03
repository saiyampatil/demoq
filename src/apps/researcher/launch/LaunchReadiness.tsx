import { useEffect, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { CheckIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath, type Screen } from '@/routes/screens'
import { now } from '@/state/brief'
import { releaseLabel, supportedLanguages, type Row, type RowOwner } from '@/state/launch'
import { PageHeader } from '../../shared/PageHeader'
import { LaunchGate, ResultMark } from './LaunchBits'
import { TestMatrix } from './TestMatrix'
import { SetupDrawer } from './SetupDrawer'
import { useLaunch } from './useLaunch'

const ownerScreen: Record<Exclude<RowOwner, 'setup'>, Screen> = { R8: screenById.R8, R11: screenById.R11, R12: screenById.R12, R13: screenById.R13, R14: screenById.R14 }

export function LaunchReadiness() {
  const { studyId, study, editable, audience, guide, launch, language, readiness: r, me, update } = useLaunch()
  const [compiling, setCompiling] = useState(false)
  const [setup, setSetup] = useState(false)

  // Opening R15 compiles the approved guide. It recompiles whenever the guide's content changes.
  const plan = r?.compile.state === 'ok' ? r.compile.plan : undefined
  const compiled = launch?.compiled
  const stale = !!plan && (!compiled || compiled.signature !== plan.signature)
  useEffect(() => {
    if (!editable || !study) return
    if (!launch) update((d) => d)
  }, [editable, study, launch, update])
  useEffect(() => {
    if (!stale || !plan) return
    setCompiling(true)
    const t = setTimeout(() => {
      update((d) => ({ ...d, compiled: { guideVersion: plan.guideVersion, signature: plan.signature, at: now() } }))
      setCompiling(false)
    }, 900)
    return () => {
      clearTimeout(t)
      setCompiling(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, plan?.signature])

  if (!editable || !study || !r) return <LaunchGate />

  const passing = r.rows.filter((x) => x.ok).length
  const paused = study.status === 'Paused'
  const compileOk = r.compile.state === 'ok' && !compiling && !stale
  const blockers = [...r.rows.filter((x) => !x.ok).map((x) => `${x.label}: ${x.value.toLowerCase()}`), ...(r.compile.state === 'failed' ? ['The study plan has errors'] : r.compile.state === 'waiting' ? ['The guide isn’t approved'] : [])]
  const canContinue = r.entryOk && compileOk

  // Every row has an Edit button. It opens the screen that owns the value (with ?from=launch, so that screen offers a
  // way back), or the setup drawer for values no earlier module owns. Coming back re-reads everything live.
  const view = (row: Row) =>
    row.owner === 'setup' ? (
      <Button size="sm" onClick={() => setSetup(true)} aria-label={`Edit ${row.label}`}>
        Edit
      </Button>
    ) : (
      <Button size="sm" to={`${studyPath(studyId, ownerScreen[row.owner])}?from=launch`} aria-label={`Edit ${row.label}`}>
        Edit
      </Button>
    )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        id="R15"
        title="Launch"
        description="Everything the interviews run from, read live from the earlier steps. Edit any row to change it at its source."
        meta={
          <>
            <StatusChip status={study.status} size="sm" />
            <span className="tabular-nums">{passing} of {r.rows.length} entry checks pass</span>
            {paused && <span>Paused. Relaunching as {releaseLabel((launch?.releases.length ?? 0) + 1)}.</span>}
          </>
        }
      />

      {study.status === 'Live' && study.releaseVersion && (
        <Banner tone="success" title={`${study.releaseVersion} is live`}>
          The guide, moderator setup and active stimuli are locked. Editing any of them pauses the study and needs a new version approved.
        </Banner>
      )}

      <section aria-label="Entry contract">
        <h2 className="mb-2 text-md font-semibold">Entry contract</h2>
        <ul className="divide-y divide-mist rounded-md border border-mist bg-surface">
          {r.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <ResultMark state={!row.ok ? 'fail' : row.warn ? 'warn' : 'pass'} label={!row.ok ? 'Needs attention' : row.warn ? 'Ready, with a warning' : 'Ready'} />
              <span className="w-44 shrink-0 font-medium">{row.label}</span>
              <span className={cn('min-w-0 flex-1 basis-60 text-sm', row.ok && !row.warn ? 'text-graphite' : 'text-pending-fg')}>
                {row.value}
                {row.warn && <span className="mt-0.5 block font-medium" data-testid="row-warn">{row.warn}</span>}
              </span>
              {view(row)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Study plan">
        <h2 className="mb-2 text-md font-semibold">Study plan</h2>
        <div className="rounded-md border border-mist bg-surface px-4 py-3">
          {r.compile.state === 'waiting' && <p className="text-sm text-graphite">Waiting for an approved guide. {r.compile.reason}</p>}
          {r.compile.state === 'failed' && (
            <div role="alert" className="rounded-sm border border-negative-line bg-negative-bg p-3">
              <p className="font-medium text-negative-fg">The study plan didn’t compile</p>
              <p className="text-sm">Fix these in the guide. The plan recompiles when you come back.</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {r.compile.errors.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1">{e.text}</span>
                    <Button size="sm" to={studyPath(studyId, screenById.R14)}>
                      Go to guide
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(compiling || (stale && r.compile.state === 'ok')) && (
            <p className="flex items-center gap-2 text-sm text-graphite" role="status">
              <Spinner /> Compiling the approved guide into a study plan…
            </p>
          )}
          {compileOk && plan && (
            <div className="flex flex-wrap items-center gap-3">
              <CheckIcon className="text-positive-fg" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Study plan compiled from guide v{plan.guideVersion}</p>
                <p className="text-sm text-graphite">
                  {plan.sections.length} sections, {plan.mandatoryCount} core questions, {plan.durationMin} min. Compiled {compiled ? formatDateTime(compiled.at) : 'just now'}.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <TestMatrix languages={supportedLanguages(language, launch)} launch={launch} guideVersion={guide?.version ?? 0} compile={r.compile} inputs={{ study, audience, guide, launch, language }} me={me} studyId={studyId} update={update} />

      <WizardFooter
        previous={{ to: studyPath(studyId, screenById.R14), label: 'Discussion guide' }}
        message={canContinue ? 'Entry contract passes and the plan compiled.' : `Not ready: ${blockers[0]?.charAt(0).toLowerCase()}${blockers[0]?.slice(1) ?? 'compiling'}.`}
      >
        {canContinue ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R17)}>
            Continue to authorize
          </Button>
        ) : (
          <Tooltip focusable content={blockers.length ? `${blockers.join('. ')}.` : 'The plan is still compiling.'}>
            <Button variant="primary" disabled>
              Continue to authorize
            </Button>
          </Tooltip>
        )}
      </WizardFooter>

      <SetupDrawer open={setup} onClose={() => setSetup(false)} client={study.client} language={language} launch={launch} me={me} update={update} />
    </div>
  )
}
