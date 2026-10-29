import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { controlBase } from '@/components/Field'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Table, type Column } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDate } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { invitedCount } from '@/state/audience'
import { cohortFill, inPool, mockApplicants, type Applicant, type ScreeningOutcome } from '@/state/screening'
import { PageHeader } from '../../shared/PageHeader'
import { ApplicantDrawer } from './ApplicantDrawer'
import { AudienceGate } from './AudienceGate'
import { useAudience } from './useAudience'

const OUTCOMES: ScreeningOutcome[] = ['Eligible', 'Ineligible', 'Needs Review', 'Reserve']

export function ScreeningDashboard() {
  const { studyId, audience, editable, me, update } = useAudience()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<ScreeningOutcome | ''>('')
  const applicants = useMemo(() => (audience?.def ? mockApplicants(audience) : []), [audience])

  if (!editable || !audience?.def) return <AudienceGate studyId={studyId} editable={editable} />

  const invited = invitedCount(audience.sourcing)
  const header = <PageHeader id="R9" title="Screening dashboard" description="The system marks each applicant from their screener answers. You resolve Needs Review and fix anything it got wrong." />
  const back = { to: studyPath(studyId, screenById.R8), label: 'Sourcing' }

  if (invited === 0 || !audience.screener) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title="No invites have been sent yet"
            description="Applicants appear here once the people you sourced accept their invite and answer the screener."
            action={
              <Button variant="primary" to={studyPath(studyId, screenById.R8)}>
                Go to sourcing
              </Button>
            }
          />
        </div>
        <WizardFooter previous={back} />
      </div>
    )
  }

  const fill = cohortFill(applicants, audience)
  const fullCohorts = new Set(fill.filter((f) => f.target !== null && f.eligible >= f.target).map((f) => f.id))
  const count = (o: ScreeningOutcome) => applicants.filter((a) => a.outcome === o).length
  const needsReview = count('Needs Review')
  const ready = applicants.filter(inPool).length
  const rows = filter ? applicants.filter((a) => a.outcome === filter) : applicants
  const open = applicants.find((a) => a.id === params.get('applicant'))

  const columns: Column<Applicant>[] = [
    { key: 'id', header: 'Applicant', cell: (a) => <span className="font-medium tabular-nums">{a.id}</span> },
    { key: 'contact', header: 'Invited as', cell: (a) => <span className="whitespace-nowrap tabular-nums">{a.contact}</span> },
    { key: 'source', header: 'Source', cell: (a) => a.source },
    { key: 'cohort', header: 'Cohort', cell: (a) => a.cohort ?? <span className="text-muted">None</span> },
    {
      key: 'outcome',
      header: 'Screening',
      cell: (a) => (
        <span className="flex items-center gap-2">
          <StatusChip status={a.outcome} size="sm" />
          {a.outcomeEdited && <span className="text-xs text-graphite">edited</span>}
        </span>
      ),
    },
    {
      key: 'verification',
      header: 'Verification',
      cell: (a) => (
        <span className="flex items-center gap-2">
          <StatusChip status={a.verification} size="sm" />
          {a.verificationEdited && <span className="text-xs text-graphite">edited</span>}
        </span>
      ),
    },
    { key: 'at', header: 'Submitted', cell: (a) => <span className="whitespace-nowrap">{formatDate(a.submittedAt)}</span> },
  ]

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Banner tone="info" title={`${invited} invited, ${applicants.length} have answered the screener`}>
        In the prototype, invitees are simulated as having accepted and answered, and verification is simulated too. Outcomes come from the real rules, applied to mock answers.
      </Banner>

      {needsReview > 0 && (
        <Banner
          tone="warning"
          title={`${needsReview} ${needsReview === 1 ? 'applicant needs' : 'applicants need'} your action`}
          actions={
            <Button size="sm" onClick={() => setFilter('Needs Review')}>
              Show Needs Review
            </Button>
          }
        >
          An answer was missing, contradictory or couldn’t be read, so the system didn’t guess. Open each one and decide.
        </Banner>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setFilter(filter === o ? '' : o)}
            aria-pressed={filter === o}
            className={`rounded-md border bg-surface p-4 text-left ${filter === o ? 'border-ink ring-1 ring-ink' : 'border-mist hover:border-graphite'}`}
          >
            <StatusChip status={o} size="sm" />
            <p className="mt-2 text-xl font-semibold tabular-nums">{count(o)}</p>
          </button>
        ))}
      </div>

      <Card title="Cohort fill" description="Eligible applicants against each cohort’s quota. Once a cohort is full, further eligible applicants go to Reserve.">
        <ul className="grid gap-3 md:grid-cols-2">
          {fill.map((f) => (
            <li key={f.id} className="rounded-sm border border-mist px-4 py-3">
              <p className="font-medium">{f.name}</p>
              <p className="tabular-nums">
                <span className="text-lg font-semibold">{f.eligible}</span> of {f.target ?? 'not set'} eligible
                <span className="ml-2 text-sm text-graphite">{f.reserve} in reserve</span>
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Applicants"
        flush
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={filter === 'Needs Review' ? 'primary' : 'secondary'} onClick={() => setFilter(filter === 'Needs Review' ? '' : 'Needs Review')}>
              Needs Review ({needsReview})
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-graphite">Screening</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value as ScreeningOutcome | '')} className={`${controlBase} h-8 pr-7 text-sm`}>
                <option value="">All</option>
                {OUTCOMES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <Table
          caption="Applicants"
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => setParams({ applicant: a.id })}
          empty={<EmptyState title="No applicants match" description="Clear the filter to see everyone." />}
        />
      </Card>

      <WizardFooter
        previous={back}
        message={ready ? `${ready} ${ready === 1 ? 'applicant is' : 'applicants are'} Eligible and verified.` : 'Select an applicant to see their answers. You need at least one who is Eligible and has Passed verification.'}
      >
        {ready ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R11)}>
            Continue to pool
          </Button>
        ) : (
          <Tooltip focusable content="At least one applicant must be Eligible and have Passed verification.">
            <Button variant="primary" disabled>
              Continue to pool
            </Button>
          </Tooltip>
        )}
      </WizardFooter>

      <ApplicantDrawer applicant={open} fullCohorts={fullCohorts} me={me} update={update} onClose={() => setParams({})} />
    </div>
  )
}
