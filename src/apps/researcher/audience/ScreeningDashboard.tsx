import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { controlBase } from '@/components/Field'
import { EmptyState } from '@/components/States'
import { SideDrawer } from '@/components/SideDrawer'
import { StatusChip } from '@/components/StatusChip'
import { Table, type Column } from '@/components/Table'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDate, formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { invitedCount } from '@/state/audience'
import { cohortFill, mockApplicants, type Applicant, type ScreeningOutcome } from '@/state/screening'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { useAudience } from './useAudience'

const OUTCOMES: ScreeningOutcome[] = ['Eligible', 'Ineligible', 'Needs Review', 'Reserve']

export function ScreeningDashboard() {
  const { studyId, audience, editable } = useAudience()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<ScreeningOutcome | ''>('')
  const applicants = useMemo(() => (audience?.def ? mockApplicants(audience) : []), [audience])

  if (!editable || !audience?.def) return <AudienceGate studyId={studyId} editable={editable} />

  const invited = invitedCount(audience.sourcing)
  const header = <PageHeader id="R9" title="Screening dashboard" description="Who has applied, how they screened, and whether they passed verification." />
  const back = { to: studyPath(studyId, screenById.R8), label: 'Sourcing' }

  if (invited === 0) {
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
  const count = (o: ScreeningOutcome) => applicants.filter((a) => a.outcome === o).length
  const rows = filter ? applicants.filter((a) => a.outcome === filter) : applicants
  const open = applicants.find((a) => a.id === params.get('applicant'))

  const columns: Column<Applicant>[] = [
    { key: 'id', header: 'Applicant', cell: (a) => <span className="font-medium tabular-nums">{a.id}</span> },
    { key: 'contact', header: 'Invited as', cell: (a) => <span className="tabular-nums">{a.contact}</span> },
    { key: 'source', header: 'Source', cell: (a) => a.source },
    { key: 'cohort', header: 'Cohort', cell: (a) => a.cohort ?? <span className="text-muted">None</span> },
    { key: 'outcome', header: 'Screening', cell: (a) => <StatusChip status={a.outcome} size="sm" /> },
    { key: 'verification', header: 'Verification', cell: (a) => <StatusChip status={a.verification} size="sm" /> },
    { key: 'at', header: 'Submitted', cell: (a) => <span className="whitespace-nowrap">{formatDate(a.submittedAt)}</span> },
  ]

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Banner tone="info" title={`${invited} invited, ${applicants.length} have answered the screener`}>
        In the prototype, invitees are simulated as having accepted and answered. The results below are mock data.
      </Banner>

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

      <Card title="Cohort fill" description="Eligible applicants against each cohort’s quota. Extra eligible people become Reserve.">
        <ul className="grid gap-3 md:grid-cols-2">
          {fill.map((f) => (
            <li key={f.id} className="rounded-sm border border-mist px-4 py-3">
              <p className="font-medium">{f.name}</p>
              <p className="tabular-nums">
                <span className="text-lg font-semibold">{f.eligible}</span> / {f.target ?? 'not set'} eligible
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
          <label className="flex items-center gap-2 text-sm">
            <span className="text-graphite">Screening</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as ScreeningOutcome | '')} className={`${controlBase} h-8 pr-7 text-sm`}>
              <option value="">All</option>
              {OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
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

      <WizardFooter previous={back} message="Select an applicant to see their answers.">
        <Button variant="primary" disabled title="Finalize pool is built in Phase 2b">
          Continue to pool
        </Button>
      </WizardFooter>

      <SideDrawer
        open={!!open}
        onClose={() => setParams({})}
        title={open?.id ?? ''}
        description={open ? `Invited as ${open.contact}, ${open.source}` : undefined}
      >
        {open && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <StatusChip status={open.outcome} />
              <StatusChip status={open.verification} />
            </div>
            <p className="text-sm">
              <span className="font-medium">Why: </span>
              {open.reason}
            </p>
            {open.cohort && (
              <p className="text-sm">
                <span className="font-medium">Cohort: </span>
                {open.cohort}
              </p>
            )}
            {open.lastResearch && (
              <p className="text-sm">
                <span className="font-medium">Last took part in research: </span>
                {open.lastResearch} (panel history, mock)
              </p>
            )}
            <p className="text-sm text-graphite">Submitted {formatDateTime(open.submittedAt)}</p>
            <div>
              <h3 className="mb-2 text-md font-semibold">Screener answers</h3>
              <dl className="flex flex-col divide-y divide-mist rounded-sm border border-mist">
                {open.answers.map((a, i) => (
                  <div key={i} className="px-3 py-2">
                    <dt className="text-sm text-graphite">{a.question}</dt>
                    <dd className="font-medium">{a.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  )
}
