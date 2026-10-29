import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { StatusChip } from '@/components/StatusChip'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { consentSummary, fieldworkSummary, issueSummary, pauseFieldwork, resumeFieldwork } from '@/state/fieldwork'
import { PageHeader } from '../../shared/PageHeader'
import { ConsentTab } from './ConsentTab'
import { FieldworkGate, type FWProps } from './FieldworkBits'
import { IssuesTab } from './IssuesTab'
import { Overview } from './Overview'
import { QuotasTab } from './QuotasTab'
import { SessionsTab } from './SessionsTab'
import { useFieldwork } from './useFieldwork'

const TABS = ['overview', 'sessions', 'quotas', 'issues', 'consent'] as const
type Tab = (typeof TABS)[number]

export function CommandCenter() {
  const { studyId, study, editable, audience, doc, me, update } = useFieldwork()
  const [params, setParams] = useSearchParams()
  const [pausing, setPausing] = useState(false)
  const [reason, setReason] = useState('')

  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />

  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'
  const goTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t })
  const sum = fieldworkSummary(doc)
  const issues = issueSummary(doc)
  const consent = consentSummary(doc)
  const target = audience?.def?.total ?? study.targetCompletes
  const pausedForVersion = study.status === 'Paused' && !doc.paused
  const props: FWProps = { doc, audience, target, studyId, me, update, goTab }

  const labels: Record<Tab, { label: string; badge?: string; alert?: boolean }> = {
    overview: { label: 'Overview' },
    sessions: { label: 'Sessions', badge: String(doc.sessions.length) },
    quotas: { label: 'Quotas' },
    issues: { label: 'Technical issues', badge: issues.open ? String(issues.open) : undefined, alert: issues.blocking > 0 },
    consent: { label: 'Consent log', badge: consent.withdrawn ? `${consent.withdrawn} withdrawn` : undefined },
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R18"
        title="Fieldwork command center"
        description="Sessions for this study as they happen: progress, quotas, technical problems and consent."
        meta={
          <>
            <StatusChip status={study.status} size="sm" />
            <span>{doc.releaseVersion}, guide v{doc.plan.guideVersion}</span>
            <span className="tabular-nums">{sum.completed} of {target} interviews completed</span>
          </>
        }
        actions={
          study.status === 'Live' && !doc.paused ? (
            <Button onClick={() => setPausing(true)}>Pause fieldwork</Button>
          ) : doc.paused ? (
            <Button variant="primary" onClick={() => update((d) => resumeFieldwork(d, me))}>
              Resume fieldwork
            </Button>
          ) : undefined
        }
      />

      {doc.paused && (
        <Banner tone="warning" title="Fieldwork is paused">
          {doc.paused.by} paused it, {formatDateTime(doc.paused.at)}: “{doc.paused.reason}”. No new sessions start while it’s paused. Pausing doesn’t change the guide.
        </Banner>
      )}
      {pausedForVersion && (
        <Banner tone="warning" title="Paused for a change to the guide, stimuli or moderator setup" actions={<Button size="sm" to={studyPath(studyId, screenById.R15)}>Go to launch</Button>}>
          Approve the new version, then relaunch it as the next release. Sessions already run stay tied to {doc.releaseVersion}.
        </Banner>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-mist bg-surface p-5 sm:grid-cols-4 xl:grid-cols-8">
        {(
          [
            ['Invited', sum.invited],
            ['Consented', sum.consented],
            ['In progress', sum.inProgress],
            ['Completed', sum.completed],
            ['Withdrawn', doc.sessions.filter((s) => s.status === 'Withdrawn').length],
            ['No-show', sum.noShow],
            ['Rescheduled', sum.rescheduled],
            ['Needs attention', sum.attention],
          ] as const
        ).map(([label, n]) => (
          <div key={label}>
            <p className="text-sm text-graphite">{label}</p>
            <p className={cn('text-xl font-semibold tabular-nums', label === 'Needs attention' && n > 0 && 'text-pending-fg')}>{n}</p>
          </div>
        ))}
      </section>

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
        {tab === 'quotas' && <QuotasTab {...props} />}
        {tab === 'issues' && <IssuesTab {...props} />}
        {tab === 'consent' && <ConsentTab {...props} />}
      </div>

      <Modal
        open={pausing}
        onClose={() => setPausing(false)}
        title="Pause fieldwork?"
        description="No new sessions start while it’s paused. Sessions in progress aren’t cut off. The reason is logged with your name and the time."
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
