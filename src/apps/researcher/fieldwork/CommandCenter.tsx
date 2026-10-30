import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { StatusChip } from '@/components/StatusChip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { consentSummary, issueSummary, pauseFieldwork, progress, resumeFieldwork } from '@/state/fieldwork'
import { PageHeader } from '../../shared/PageHeader'
import { ConsentTab } from './ConsentTab'
import { FieldworkGate, type FWProps } from './FieldworkBits'
import { IssuesTab } from './IssuesTab'
import { Overview } from './Overview'
import { ReserveTab } from './ReserveTab'
import { SessionsTab } from './SessionsTab'
import { SampleDataBanner } from '../SampleDataBanner'
import { useStudySessions } from '../useStudySessions'

const TABS = ['overview', 'sessions', 'reserve', 'issues', 'consent'] as const
type Tab = (typeof TABS)[number]

export function CommandCenter() {
  const { studyId, study, editable, audience, doc, review, outcomes, reserve, me, update, preview } = useStudySessions()
  const [params, setParams] = useSearchParams()
  const [pausing, setPausing] = useState(false)
  const [reason, setReason] = useState('')

  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />

  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'
  const goTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t })
  const prog = progress(doc, outcomes)
  const awaiting = review.filter((r) => r.status === 'Under review').length
  const issues = issueSummary(doc)
  const consent = consentSummary(doc)
  const target = audience?.def?.total ?? study.targetCompletes
  const pausedForVersion = study.status === 'Paused' && !doc.paused
  // Paused by the Researcher, or paused for a version change: either way, nothing that sends an invitation can run.
  const paused = !preview && (study.status === 'Paused' || !!doc.paused)
  const props: FWProps = { doc, audience, target, studyId, me, update, goTab, readOnly: preview, outcomes, reserve, awaiting, paused }

  const labels: Record<Tab, { label: string; badge?: string; alert?: boolean }> = {
    overview: { label: 'Overview' },
    sessions: { label: 'Sessions', badge: String(doc.sessions.length) },
    reserve: { label: 'Reserve', badge: reserve.length ? String(reserve.length) : undefined },
    issues: { label: 'Issues', badge: issues.open ? String(issues.open) : undefined, alert: issues.blocking > 0 },
    consent: { label: 'Consent log', badge: consent.withdrawn ? `${consent.withdrawn} withdrawn` : undefined },
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R18"
        title="Fieldwork command center"
        description="Sessions for this study as they happen: progress, the reserve, technical problems and consent."
        meta={
          <>
            <StatusChip status={preview ? 'Not Ready' : study.status} size="sm" />
            <span>{preview ? 'Sample data' : `${doc.releaseVersion}, guide v${doc.plan.guideVersion}`}</span>
            <span className="tabular-nums" data-testid="progress-line">
              {prog.confirmed} confirmed, {prog.pending} pending review, {prog.toward} of {target} toward target
            </span>
          </>
        }
        actions={
          preview ? undefined : study.status === 'Live' && !doc.paused ? (
            <Button onClick={() => setPausing(true)}>Pause fieldwork</Button>
          ) : doc.paused ? (
            <Button variant="primary" onClick={() => update((d) => resumeFieldwork(d, me))}>
              Resume fieldwork
            </Button>
          ) : undefined
        }
      />

      {preview && <SampleDataBanner studyId={studyId} />}
      {doc.paused && (
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
        {tab === 'consent' && <ConsentTab {...props} />}
      </div>

      {/* Fieldwork and Review run in parallel, so there is no "continue": just a way across. */}
      <WizardFooter sticky={false} previous={{ to: studyPath(studyId, screenById.R17), label: 'Launch' }}>
        <Link to={studyPath(studyId, screenById.R21)} className="text-sm font-medium text-iris-700 hover:underline tabular-nums">
          {awaiting} {awaiting === 1 ? 'session' : 'sessions'} awaiting review
        </Link>
      </WizardFooter>

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
