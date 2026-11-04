import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { useStudies } from '@/state/StudyContext'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { closeFieldwork, pauseFieldwork, resumeFieldwork, terminateFieldwork } from '@/state/fieldwork'
import { closeBlockers, reviewProgress, sessionTotals, waitingFor } from '@/state/selectors'
import { stepInfo } from '@/state/workflow'
import { PageHeader } from '../../shared/PageHeader'
import { FieldworkGate, type FWProps } from './FieldworkBits'
import { MoreMenu } from './MoreMenu'
import { Overview } from './Overview'
import { ReserveTab } from './ReserveTab'
import { SessionsTab } from './SessionsTab'
import { SampleDataBanner } from '../SampleDataBanner'
import { useStudySessions } from '../useStudySessions'

/** "15 min", "2 h", "1 day 2 h". */
const simulated = (min: number) => {
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  return [d && `${d} ${d === 1 ? 'day' : 'days'}`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ')
}

const TABS = ['overview', 'sessions', 'reserve'] as const
type Tab = (typeof TABS)[number]

export function CommandCenter() {
  const { studyId, study, editable, audience, doc, review, outcomes, reserve, me, update, preview, target: tgt } = useStudySessions()
  const [params, setParams] = useSearchParams()
  const [pausing, setPausing] = useState(false)
  const [reason, setReason] = useState('')
  const [closing, setClosing] = useState(false)
  const [changing, setChanging] = useState(false)
  const [changeReason, setChangeReason] = useState('')
  const [terminating, setTerminating] = useState(false)
  const [endReason, setEndReason] = useState('')
  const navigate = useNavigate()
  const { getGuide } = useStudies()

  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />

  // The Issues tab is gone. An old link lands on the Overview.
  if (params.get('tab') === 'issues') return <Navigate to={studyPath(studyId, screenById.R18)} replace />

  const asked = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'
  const goTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t })
  const { awaiting, total: reviewTotal } = reviewProgress(review)
  const target = tgt
  const pausedForVersion = study.status === 'Paused' && !doc.paused
  // A pause to change the guide or stimuli, whether it started here or from editing the guide: the way out is a new release.
  const versionPause = pausedForVersion || doc.paused?.kind === 'version'
  const guide = getGuide(studyId)
  // Nothing changed yet, so the Researcher can still resume the release that was running.
  const guideChanged = !!guide && (guide.version !== doc.plan.guideVersion || guide.status !== 'Approved')
  // Paused by the Researcher, or paused for a version change: either way, nothing that sends an invitation can run.
  const terminated = !preview && (!!doc.terminated || study.status === 'Terminated')
  const closed = !preview && (!!doc.closed || terminated || study.status === 'Complete')
  const paused = !preview && (study.status === 'Paused' || !!doc.paused || closed)
  // Nobody can be invited once fieldwork is closed, so the Reserve has nothing to offer.
  const tab: Tab = asked === 'reserve' && closed ? 'overview' : asked
  const blockers = closeBlockers(doc)
  // Where Analysis stands, from the same review count as the stepper.
  const analysis = stepInfo(study, { awaitingReview: awaiting, total: reviewTotal }).find((x) => x.key === 'analysis')
  const props: FWProps = { doc, audience, target, studyId, me, update, goTab, readOnly: preview, outcomes, reserve, awaiting, reviewTotal, paused, versionPause, closed, terminated, waiting: waitingFor(review) }

  const labels: Record<Tab, { label: string; badge?: string; alert?: boolean; off?: string }> = {
    overview: { label: 'Overview' },
    // People, like the journey. The table still lists each session.
    sessions: { label: 'Sessions', badge: String(sessionTotals(doc).participants) },
    reserve: { label: 'Reserve', badge: reserve.length && !closed ? String(reserve.length) : undefined, off: closed ? (terminated ? 'Fieldwork was terminated.' : 'Fieldwork is closed.') : undefined },
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R18"
        title="Fieldwork command center"
        titleAside={
          doc.clockSkewMin ? (
            <span data-testid="simulated-time" className="rounded-xs border border-dashed border-mist-strong bg-haze px-1.5 py-0.5 text-xs font-medium text-graphite">
              Simulated time +{simulated(doc.clockSkewMin)}
            </span>
          ) : undefined
        }
        description={closed ? 'Final numbers for this study.' : paused ? 'Fieldwork is paused.' : 'Progress, the reserve and what needs you.'}
        meta={
          <>
            <StatusChip status={preview ? 'Not Ready' : study.status} size="sm" />
            <span>{preview ? 'Sample data' : `${doc.releaseVersion}, guide v${doc.plan.guideVersion}`}</span>
            {closed && (
              <span data-testid="closed-line">
                {doc.terminated ? `Terminated by ${doc.terminated.by}, ${formatStamp(doc.terminated.at)}: “${doc.terminated.reason}”.` : doc.closed ? `Closed by ${doc.closed.by}, ${formatStamp(doc.closed.at)}.` : 'Closed.'}
              </span>
            )}
          </>
        }
        actions={
          preview || closed ? undefined : (
            <>
              {study.status === 'Live' && !doc.paused ? (
                <Button onClick={() => setPausing(true)}>Pause fieldwork</Button>
              ) : doc.paused && (!versionPause || !guideChanged) ? (
                <Button variant="primary" onClick={() => update((d) => resumeFieldwork(d, me))}>
                  Resume fieldwork
                </Button>
              ) : null}
              {blockers.blocked ? (
                // Hover gives the full reason; keyboard focus gives the short one under the button.
                <span className="group/close relative inline-flex" tabIndex={0} aria-describedby="close-why" data-testid="close-blocked">
                  <Button disabled data-testid="close-fieldwork">
                    Close fieldwork
                  </Button>
                  <span role="tooltip" className="pointer-events-none absolute top-full right-0 z-30 mt-2 hidden w-max max-w-64 rounded-sm bg-ink px-2.5 py-1.5 text-xs text-white shadow-overlay group-hover/close:block">
                    {blockers.reason}
                  </span>
                  <span id="close-why" className="pointer-events-none absolute top-full right-0 mt-1.5 hidden text-xs whitespace-nowrap text-graphite group-focus-within/close:block group-hover/close:hidden">
                    Sessions are still open.
                  </span>
                </span>
              ) : (
                <Button data-testid="close-fieldwork" onClick={() => setClosing(true)}>
                  Close fieldwork
                </Button>
              )}
              <MoreMenu
                items={[
                  {
                    key: 'change-guide',
                    label: 'Change guide or stimuli',
                    hint: 'Pauses invitations. The change becomes the next release.',
                    off: versionPause ? 'Already paused for a change.' : undefined,
                    onSelect: () => setChanging(true),
                  },
                  {
                    key: 'terminate',
                    label: 'Terminate study',
                    hint: 'Stops the study now. Finished sessions go to Review.',
                    danger: true,
                    onSelect: () => setTerminating(true),
                  },
                ]}
              />
            </>
          )
        }
      />

      {preview && <SampleDataBanner studyId={studyId} />}
      {doc.paused && !closed && !versionPause && (
        <Banner tone="warning" title="Fieldwork is paused">
          {doc.paused.by} paused it, {formatStamp(doc.paused.at)}: “{doc.paused.reason}”. Nothing that sends an invitation or a link can run, and a participant who opens an existing link is told the study is temporarily unavailable. Sessions in progress carry on and finish.
        </Banner>
      )}
      {versionPause && !closed && (
        <Banner
          tone="warning"
          title="Paused for a change to the guide, stimuli or moderator setup"
          actions={
            <>
              <Button size="sm" to={studyPath(studyId, screenById.R14)}>
                Edit the guide
              </Button>
              <Button size="sm" to={studyPath(studyId, screenById.R15)}>
                Go to launch
              </Button>
            </>
          }
        >
          {doc.paused ? `${doc.paused.by} paused it, ${formatStamp(doc.paused.at)}: “${doc.paused.reason}”. ` : ''}Approve the new version, then relaunch it as the next release. Sessions already run stay tied to {doc.releaseVersion}, and sessions in progress finish on it.
        </Banner>
      )}

      <div role="tablist" aria-label="Fieldwork views" className="flex flex-wrap gap-1 border-b border-mist">
        {TABS.map((t) => {
          const on = t === tab
          return (
            <button
              key={t}
              role="tab"
              type="button"
              id={`tab-${t}`}
              aria-selected={on}
              aria-controls="fw-panel"
              disabled={!!labels[t].off}
              title={labels[t].off}
              onClick={() => goTab(t)}
              className={cn('-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium', labels[t].off ? 'cursor-not-allowed border-transparent text-muted' : on ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
            >
              {labels[t].label}
              {labels[t].badge && <span className={cn('rounded-full px-1.5 text-xs tabular-nums', labels[t].alert ? 'bg-negative-bg text-negative-fg' : 'bg-haze text-graphite')}>{labels[t].badge}</span>}
            </button>
          )
        })}
      </div>

      <div id="fw-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && <Overview {...props} />}
        {tab === 'sessions' && <SessionsTab {...props} />}
        {tab === 'reserve' && <ReserveTab {...props} />}
      </div>

      {/* Fieldwork and Review run in parallel, so there is no "continue" while it runs. The footer points at the next piece of work. */}
      <WizardFooter sticky={false} previous={closed ? undefined : { to: studyPath(studyId, screenById.R15), label: 'Launch' }}>
        {awaiting > 0 ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R21)} data-testid="footer-review">
            Review {awaiting} {awaiting === 1 ? 'session' : 'sessions'}
          </Button>
        ) : closed ? (
          analysis?.state === 'open' ? (
            <Button variant="primary" to={studyPath(studyId, screenById.A1)} data-testid="footer-analysis">
              Next: Analysis
            </Button>
          ) : (
            <Tooltip focusable content={analysis?.lockedReason ?? 'Analysis is locked.'}>
              <Button variant="primary" disabled data-testid="footer-analysis">
                Next: Analysis
              </Button>
            </Tooltip>
          )
        ) : null}
      </WizardFooter>

      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        title="Close fieldwork?"
        description="No more invitations or links can be sent and the study becomes Complete. Nothing is in progress, so no one is cut off. Sessions awaiting review stay in Review, and excluding one after this can’t open a slot. Your name and the time are logged."
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-testid="confirm-close"
              onClick={() => {
                update((d) => closeFieldwork(d, me))
                setClosing(false)
              }}
            >
              Close fieldwork
            </Button>
          </>
        }
      />

      <Modal
        open={changing}
        onClose={() => {
          setChanging(false)
          setChangeReason('')
        }}
        title="Change the guide or stimuli?"
        description={`Invitations stop while you change it, and sessions in progress finish on ${doc.releaseVersion}. The new version needs approval and is launched as the next release. Finished sessions stay tied to ${doc.releaseVersion}. Your name and the time are logged.`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setChanging(false)
                setChangeReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!changeReason.trim()}
              data-testid="confirm-change-guide"
              onClick={() => {
                update((d) => pauseFieldwork(d, changeReason, me, 'version'))
                setChanging(false)
                setChangeReason('')
                navigate(studyPath(studyId, screenById.R14))
              }}
            >
              Pause and open the guide
            </Button>
          </>
        }
      >
        <TextArea label="Why is it changing? (required)" rows={3} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
      </Modal>

      <Modal
        open={terminating}
        onClose={() => {
          setTerminating(false)
          setEndReason('')
        }}
        title="Terminate this study?"
        description="The study stops now and becomes Terminated. No more invitations or links can be sent, and this can’t be undone. Sessions already finished stay in Review. Your name and the time are logged."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setTerminating(false)
                setEndReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!endReason.trim()}
              data-testid="confirm-terminate"
              onClick={() => {
                update((d) => terminateFieldwork(d, endReason, me))
                setTerminating(false)
                setEndReason('')
              }}
            >
              Terminate study
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {blockers.inProgress > 0 && (
            <p className="rounded-sm border border-mist bg-haze px-3 py-2 text-sm text-ink" data-testid="terminate-inprogress">
              {blockers.inProgress} {blockers.inProgress === 1 ? 'session is' : 'sessions are'} in progress and will end as incomplete.
            </p>
          )}
          <TextArea label="Why is it being terminated? (required)" rows={3} value={endReason} onChange={(e) => setEndReason(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={pausing}
        onClose={() => setPausing(false)}
        title="Pause fieldwork?"
        description="You can’t invite from the reserve, resend or reissue links, retry, reschedule or source more while it’s paused. New starts from existing links see “This study is temporarily unavailable.” Sessions in progress aren’t cut off. The reason is logged with your name and the time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPausing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!reason.trim()}
              onClick={() => {
                update((d) => pauseFieldwork(d, reason, me))
                setPausing(false)
                setReason('')
              }}
            >
              Pause fieldwork
            </Button>
          </>
        }
      >
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  )
}
