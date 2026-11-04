import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath, type Screen } from '@/routes/screens'
import { now } from '@/state/brief'
import { authorizeBlockers, authorizeLaunch, overrideCheck, releaseLabel, supportedLanguages, type Check, type Row, type RowOwner } from '@/state/launch'
import { PageHeader } from '../../shared/PageHeader'
import { LaunchGate, ResultMark } from './LaunchBits'
import { SetupDrawer } from './SetupDrawer'
import { TestRunsRow } from './TestRunsRow'
import { useLaunch } from './useLaunch'

const ownerScreen: Record<Exclude<RowOwner, 'setup'>, Screen> = { R8: screenById.R8, R11: screenById.R11, R12: screenById.R12, R13: screenById.R13, R14: screenById.R14 }
const checkScreen = { R6: screenById.R6, R13: screenById.R13, R14: screenById.R14 }

/**
 * Launch, on one screen: what the interviews will run from, a test run, and the button that starts the study. The
 * preflight checks only show up when one fails, because that is the only time they have something to say.
 */
export function LaunchReadiness() {
  const { studyId, study, editable, audience, guide, launch, language, readiness: r, me, update } = useLaunch()
  const navigate = useNavigate()
  const [compiling, setCompiling] = useState(false)
  const [setup, setSetup] = useState(false)
  const [override, setOverride] = useState<Check>()
  const [reason, setReason] = useState('')

  // Opening Launch compiles the approved guide. It recompiles whenever the guide's content changes.
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

  const live = study.status === 'Live'
  const paused = study.status === 'Paused'
  const nextRelease = (launch?.releases.length ?? 0) + 1
  const langs = supportedLanguages(language, launch)
  const busy = compiling || (stale && r.compile.state === 'ok')
  const blockers = busy ? ['The study plan is compiling'] : authorizeBlockers(r)
  const failing = r.checks.filter((c) => c.status !== 'pass')

  const authorize = () => {
    if (!plan || !guide) return
    update((d) => authorizeLaunch(d, { study, audience, guide, launch: d, plan, language }, me))
    navigate(studyPath(studyId, screenById.R18))
  }

  // Every row has an Edit button. It opens the screen that owns the value (with ?from=launch, so that screen offers a
  // way back), or the setup drawer for values no earlier module owns. Coming back re-reads everything live.
  const edit = (row: Row) =>
    row.owner === 'setup' ? (
      <Button size="sm" onClick={() => setSetup(true)} aria-label={`Edit ${row.label}`}>
        Edit
      </Button>
    ) : (
      <Button size="sm" to={`${studyPath(studyId, ownerScreen[row.owner])}?from=launch`} aria-label={`Edit ${row.label}`}>
        Edit
      </Button>
    )

  const fix = (c: Check) =>
    c.owner === 'setup' ? (
      <Button size="sm" onClick={() => setSetup(true)}>
        {c.fixLabel}
      </Button>
    ) : c.owner === 'R15' ? (
      <Button size="sm" onClick={() => document.getElementById('test-runs')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
        {c.fixLabel}
      </Button>
    ) : (
      <Button size="sm" to={studyPath(studyId, checkScreen[c.owner])}>
        {c.fixLabel}
      </Button>
    )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader id="R15" title="Launch" description="Run a test interview and authorize the study to start." />

      {live && study.releaseVersion && (
        <Banner tone="success" title={`${study.releaseVersion} is live`}>
          The guide, moderator setup and active stimuli are locked. Editing any of them pauses the study and needs a new version approved.
        </Banner>
      )}

      <section aria-label="Entry contract">
        <h2 className="text-md font-semibold">Entry contract</h2>
        <p className="mb-3 text-sm text-graphite">What the interviews will run from.</p>
        <ul className="divide-y divide-mist rounded-md border border-mist bg-surface">
          {r.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <ResultMark state={!row.ok ? 'fail' : row.warn ? 'warn' : 'pass'} label={!row.ok ? 'Needs attention' : row.warn ? 'Ready, with a warning' : 'Ready'} />
              <span className="w-44 shrink-0 font-medium">{row.label}</span>
              <span className={cn('min-w-0 flex-1 basis-60 text-sm', row.ok && !row.warn ? 'text-graphite' : 'text-pending-fg')}>
                {row.value}
                {row.warn && (
                  <span className="mt-0.5 block font-medium" data-testid="row-warn">
                    {row.warn}
                  </span>
                )}
              </span>
              {edit(row)}
            </li>
          ))}
        </ul>
      </section>

      <section id="test-runs" aria-label="Interview test runs" className="scroll-mt-24">
        <h2 className="text-md font-semibold">Interview test runs</h2>
        <p className="mb-3 text-sm text-graphite">Run the compiled study plan to rehearse the actual interview.</p>
        {r.compile.state === 'failed' && (
          <div role="alert" className="mb-3 rounded-md border border-negative-line bg-negative-bg p-3">
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
        {busy && (
          <p className="mb-3 flex items-center gap-2 text-sm text-graphite" role="status">
            <Spinner /> Compiling the approved guide into a study plan…
          </p>
        )}
        <TestRunsRow languages={langs} launch={launch} guideVersion={guide?.version ?? 0} compile={r.compile} compiling={busy} inputs={{ study, audience, guide, launch, language }} me={me} studyId={studyId} update={update} />
      </section>

      {!live && failing.length > 0 && (
        <section aria-label="Preflight checks">
          <h2 className="text-md font-semibold">Fix before launch</h2>
          <p className="mb-3 text-sm text-graphite">
            <span className="font-medium text-ink">Critical</span> checks can’t be overridden. The rest can be fixed, or overridden with a reason that is logged.
          </p>
          <ul className="divide-y divide-mist rounded-md border border-mist bg-surface">
            {failing.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                <ResultMark state={c.status === 'overridden' ? 'overridden' : c.critical ? 'critical' : 'fail'} label={c.status === 'overridden' ? 'Overridden' : 'Failed'} />
                <span className="flex w-56 shrink-0 items-center gap-2 font-medium">
                  {c.label}
                  {c.critical && <span className="rounded-xs border border-mist-strong px-1 text-xs font-normal text-graphite">Critical</span>}
                </span>
                <span className={cn('min-w-0 flex-1 basis-60 text-sm', c.status === 'fail' ? (c.critical ? 'text-negative-fg' : 'text-pending-fg') : 'text-graphite')}>{c.detail}</span>
                {c.status === 'overridden' && c.override && (
                  <Tooltip focusable content={`“${c.override.reason}” Overridden by ${c.override.by}, ${formatDateTime(c.override.at)}`}>
                    <span className="inline-flex h-6 items-center rounded-xs border border-mist-strong bg-haze px-2 text-xs font-medium text-graphite">Overridden</span>
                  </Tooltip>
                )}
                {c.status === 'fail' && (
                  <span className="flex items-center gap-2">
                    {fix(c)}
                    {!c.critical && (
                      <Button size="sm" variant="ghost" onClick={() => setOverride(c)}>
                        Override
                      </Button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Authorize launch" className="border-t border-mist pt-6">
        <h2 className="mb-4 text-md font-semibold">{live ? `${study.releaseVersion} is live` : paused ? `Relaunch as ${releaseLabel(nextRelease)}` : 'Authorize launch'}</h2>
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
          <dl className="grid flex-1 grid-cols-2 gap-x-10 gap-y-3 text-sm sm:max-w-xl" data-testid="launch-summary">
            <div>
              <dt className="text-graphite">Study</dt>
              <dd className="font-semibold">{study.name}</dd>
            </div>
            <div className="border-l border-mist pl-10">
              <dt className="text-graphite">Language</dt>
              <dd className="font-semibold">{langs.join(', ') || 'Not set'}</dd>
            </div>
            {paused && (
              <div>
                <dt className="text-graphite">Release</dt>
                <dd className="font-semibold">
                  {releaseLabel(nextRelease)}, guide v{guide?.version ?? '—'}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex min-w-60 flex-col items-center gap-2">
            {live ? (
              <>
                <Button variant="primary" className="h-11 w-full px-6 text-md" to={studyPath(studyId, screenById.R18)}>
                  Go to fieldwork
                </Button>
                <p className="text-center text-sm text-graphite">
                  Authorized by {launch?.release?.by}, {launch?.release ? formatDateTime(launch.release.at) : ''}.
                </p>
              </>
            ) : (
              <>
                <Button variant="primary" className="h-11 w-full px-6 text-md" disabled={blockers.length > 0} onClick={authorize} data-testid="authorize">
                  {paused ? `Authorize ${releaseLabel(nextRelease)}` : 'Authorize launch'}
                </Button>
                <p className="text-center text-sm text-graphite" data-testid="authorize-note">
                  {blockers.length > 0 ? (
                    <Tooltip focusable content={`${blockers.join('. ')}.`}>
                      <span>
                        {blockers[0]}.{blockers.length > 1 ? ` +${blockers.length - 1} more` : ''}
                      </span>
                    </Tooltip>
                  ) : (
                    'Locks the guide and stimuli, and sets the study to Live.'
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <WizardFooter sticky={false} previous={{ to: studyPath(studyId, screenById.R14), label: 'Discussion guide' }} />

      <Modal
        open={!!override}
        onClose={() => setOverride(undefined)}
        title={`Override “${override?.label ?? ''}”`}
        description="The failure stays on record as Overridden, with your reason, name and the time. It applies only to this failure."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverride(undefined)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!reason.trim()}
              onClick={() => {
                if (override) update((d) => overrideCheck(d, override, me, reason))
                setOverride(undefined)
                setReason('')
              }}
            >
              Override
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-graphite">{override?.detail}</p>
          <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>

      <SetupDrawer open={setup} onClose={() => setSetup(false)} client={study.client} language={language} launch={launch} me={me} update={update} />
    </div>
  )
}
