import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { closeFieldwork, pauseFieldwork, resumeFieldwork } from '@/state/fieldwork'
import { closeBlockers, issueSummary, reviewCounts, sessionTotals, waitingFor } from '@/state/selectors'
import { PageHeader } from '../../shared/PageHeader'
import { FieldworkGate, type FWProps } from './FieldworkBits'
import { IssuesTab } from './IssuesTab'
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

const TABS = ['overview', 'sessions', 'reserve', 'issues'] as const
type Tab = (typeof TABS)[number]

export function CommandCenter() {
  const { studyId, study, editable, audience, doc, review, outcomes, reserve, me, update, preview, target: tgt } = useStudySessions()
  const [params, setParams] = useSearchParams()
  const [pausing, setPausing] = useState(false)
  const [reason, setReason] = useState('')
  const [closing, setClosing] = useState(false)

  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />

  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'
  const goTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t })
  const awaiting = reviewCounts(review).underReview
  const issues = issueSummary(doc)
  const target = tgt
  const pausedForVersion = study.status === 'Paused' && !doc.paused
  // Paused by the Researcher, or paused for a version change: either way, nothing that sends an invitation can run.
  const closed = !preview && (!!doc.closed || study.status === 'Complete')
  const paused = !preview && (study.status === 'Paused' || !!doc.paused || closed)
  const blockers = closeBlockers(doc)
  const props: FWProps = { doc, audience, target, studyId, me, update, goTab, readOnly: preview, outcomes, reserve, awaiting, paused, closed, waiting: waitingFor(review) }

  const labels: Record<Tab, { label: string; badge?: string; alert?: boolean }> = {
    overview: { label: 'Overview' },
    // People, like the journey. The table still lists each session.
    sessions: { label: 'Sessions', badge: String(sessionTotals(doc).participants) },
    reserve: { label: 'Reserve', badge: reserve.length ? String(reserve.length) : undefined },
    issues: { label: 'Issues', badge: issues.open ? String(issues.open) : undefined, alert: issues.blocking > 0 },
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
        description="Sessions for this study as they happen: progress, the reserve and technical problems."
        meta={
          <>
            <StatusChip status={preview ? 'Not Ready' : study.status} size="sm" />
            <span>{preview ? 'Sample data' : `${doc.releaseVersion}, guide v${doc.plan.guideVersion}`}</span>
          </>
        }
        actions={
          preview || closed ? undefined : (
            <>
              {study.status === 'Live' && !doc.paused ? (
                <Button onClick={() => setPausing(true)}>Pause fieldwork</Button>
              ) : doc.paused ? (
                <Button variant="primary" onClick={() => update((d) => resumeFieldwork(d, me))}>
                  Resume fieldwork
                </Button>
              ) : null}
              {blockers.blocked ? (
                <Tooltip content={blockers.reason!} focusable>
                  <Button disabled data-testid="close-fieldwork">
                    Close fieldwork
                  </Button>
                </Tooltip>
              ) : (
                <Button data-testid="close-fieldwork" onClick={() => setClosing(true)}>
                  Close fieldwork
                </Button>
              )}
            </>
          )
        }
      />

      {preview && <SampleDataBanner studyId={studyId} />}
      {closed && (
        <Banner tone="info" title="Fieldwork is closed">
          {doc.closed ? `${doc.closed.by} closed it, ${formatStamp(doc.closed.at)}. ` : ''}No more invitations or links can be sent. The study is Complete. Sessions already finished are still in Review.
        </Banner>
      )}
      {doc.paused && !closed && (
        <Banner tone="warning" title="Fieldwork is paused">
          {doc.paused.by} paused it, {formatStamp(doc.paused.at)}: “{doc.paused.reason}”. Nothing that sends an invitation or a link can run, and a participant who opens an existing link is told the study is temporarily unavailable. Sessions in progress carry on and finish.
        </Banner>
      )}
      {pausedForVersion && (
        <Banner tone="warning" title="Paused for a change to the guide, stimuli or moderator setup" actions={<Button size="sm" to={studyPath(studyId, screenById.R15)}>Go to launch</Button>}>
          Approve the new version, then relaunch it as the next release. Sessions already run stay tied to {doc.releaseVersion}.
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
              onClick={() => goTab(t)}
              className={cn('-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium', on ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
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
        {tab === 'issues' && <IssuesTab {...props} />}
      </div>

      {/* Fieldwork and Review run in parallel, so there is no "continue": just a way across. */}
      <WizardFooter sticky={false} previous={{ to: studyPath(studyId, screenById.R17), label: 'Launch' }}>
        <Link to={studyPath(studyId, screenById.R21)} className="text-sm font-medium text-iris-700 hover:underline tabular-nums">
          {awaiting} {awaiting === 1 ? 'session' : 'sessions'} awaiting review
        </Link>
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
