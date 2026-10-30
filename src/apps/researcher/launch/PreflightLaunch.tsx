import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { authorizeBlockers, authorizeLaunch, fmtDay, moderatorLabel, overrideCheck, releaseLabel, supportedLanguages, type Check } from '@/state/launch'
import { PageHeader } from '../../shared/PageHeader'
import { LaunchGate, ResultMark } from './LaunchBits'
import { SetupDrawer } from './SetupDrawer'
import { useLaunch } from './useLaunch'

const ownerScreen = { R6: screenById.R6, R13: screenById.R13, R14: screenById.R14, R15: screenById.R15 }

export function PreflightLaunch() {
  const { studyId, study, editable, audience, guide, launch, readiness: r, me, update } = useLaunch()
  const navigate = useNavigate()
  const [override, setOverride] = useState<Check>()
  const [reason, setReason] = useState('')
  const [setup, setSetup] = useState(false)

  if (!editable || !study || !r) return <LaunchGate />

  const blockers = authorizeBlockers(r)
  const live = study.status === 'Live'
  const plan = r.compile.state === 'ok' ? r.compile.plan : undefined
  const langs = supportedLanguages(guide, launch)
  const nextRelease = (launch?.releases.length ?? 0) + 1
  const fw = launch?.setup.fieldwork

  const authorize = () => {
    if (!plan || !guide) return
    update((d) => authorizeLaunch(d, { study, audience, guide, launch: d, plan }, me))
    navigate(studyPath(studyId, screenById.R18))
  }

  const fix = (c: Check) =>
    c.owner === 'setup' ? (
      <Button size="sm" onClick={() => setSetup(true)}>
        {c.fixLabel}
      </Button>
    ) : (
      <Button size="sm" to={studyPath(studyId, ownerScreen[c.owner])}>
        {c.fixLabel}
      </Button>
    )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader id="R17" title="Preflight checks and launch" description="Six checks run live against the compiled plan. A fix sends you to the screen that owns it, and everything recompiles when you return." />

      <section aria-label="Preflight checks">
        <p className="mb-2 text-sm text-graphite">
          <span className="font-medium text-ink">Critical</span> checks must pass, with no override: consent language and question coverage. The rest can be fixed, or overridden with a reason that is logged.
        </p>
        <ul className="divide-y divide-mist rounded-md border border-mist bg-surface">
          {r.checks.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
              <ResultMark state={c.status === 'pass' ? 'pass' : c.status === 'overridden' ? 'overridden' : c.critical ? 'critical' : 'fail'} label={c.status === 'pass' ? 'Passed' : c.status === 'overridden' ? 'Overridden' : 'Failed'} />
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
              {c.status === 'fail' && c.critical && <span className="basis-full pl-9 text-xs text-negative-fg">Must be fixed. This check can’t be overridden.</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Authorize launch" className="rounded-md border border-mist bg-surface p-5">
        <h2 className="mb-3 text-md font-semibold">{live ? `${study.releaseVersion} is live` : study.status === 'Paused' ? `Relaunch as ${releaseLabel(nextRelease)}` : 'Authorize launch'}</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Item label="Study" value={study.name} />
          <Item label="Client" value={study.client} />
          <Item label="Moderator" value={guide ? `${guide.moderator.mode === 'ai' ? 'AI' : 'Human'}: ${moderatorLabel(guide)}` : '—'} />
          <Item label="Release" value={live ? (study.releaseVersion ?? '') : `${releaseLabel(nextRelease)}, guide v${guide?.version ?? '—'}`} />
          <Item label="Participants" value={audience?.def?.total ? `${audience.def.total} interviews` : '—'} />
          <Item label="Languages" value={langs.join(', ')} />
          <Item label="Fieldwork window" value={fw ? `${fmtDay(fw.start)} to ${fmtDay(fw.end)}` : 'Not set'} />
        </dl>

        {live ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-graphite">
              Authorized by {launch?.release?.by}, {launch?.release ? formatDateTime(launch.release.at) : ''}. The guide, moderator setup and active stimuli are locked under this release.
            </p>
            <Button variant="primary" to={studyPath(studyId, screenById.R18)}>
              Go to fieldwork
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {blockers.length > 0 && (
              <Banner tone="warning" title="Not ready to authorize">
                {blockers.join('. ')}.
              </Banner>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-graphite">Launching locks the guide, moderator setup and active stimuli under one release, and sets the study to Live. It never happens automatically.</p>
              {blockers.length ? (
                <Tooltip focusable content={`${blockers.join('. ')}.`}>
                  <Button variant="primary" disabled>
                    Authorize launch
                  </Button>
                </Tooltip>
              ) : (
                <Button variant="primary" onClick={authorize}>
                  {study.status === 'Paused' ? `Authorize ${releaseLabel(nextRelease)}` : 'Authorize launch'}
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <WizardFooter previous={{ to: studyPath(studyId, screenById.R15), label: 'Launch' }} />

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

      <SetupDrawer open={setup} onClose={() => setSetup(false)} client={study.client} guide={guide} launch={launch} me={me} update={update} />
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-graphite">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
