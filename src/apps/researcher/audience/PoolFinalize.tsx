import { useMemo, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { addEntry, confirmPool, mockApplicants, poolView, type Applicant } from '@/state/screening'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { useAudience } from './useAudience'

export function PoolFinalize() {
  const { studyId, audience, editable, me, update } = useAudience()
  const applicants = useMemo(() => (audience?.def ? mockApplicants(audience) : []), [audience])
  const [promote, setPromote] = useState<Applicant>()
  const [reason, setReason] = useState('')
  const [warn, setWarn] = useState(false)

  if (!editable || !audience?.def) return <AudienceGate studyId={studyId} editable={editable} />

  const header = (
    <PageHeader
      id="R11"
      title="Finalize pool"
      description="The qualified participants for this study: Eligible, and verification Passed. Required before launch."
    />
  )
  const back = { to: studyPath(studyId, screenById.R9), label: 'Screening' }
  const view = poolView(applicants, audience)
  const total = view.reduce((n, v) => n + v.members.length, 0)

  if (applicants.length === 0 || total === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title="Nobody is qualified yet"
            description="An applicant joins the pool once they’re Eligible and have Passed verification."
            action={
              <Button variant="primary" to={studyPath(studyId, screenById.R9)}>
                Go to screening
              </Button>
            }
          />
        </div>
        <WizardFooter previous={back} />
      </div>
    )
  }

  const shortfalls = view.filter((v) => v.members.length < v.need).map((v) => ({ cohort: v.cohort.name, have: v.members.length, need: v.need }))
  const confirmed = audience.pool
  const ids = new Set(view.flatMap((v) => v.members.map((m) => m.id)))
  const changed = !!confirmed && (confirmed.members.length !== ids.size || confirmed.members.some((m) => !ids.has(m.applicantId)))

  const doConfirm = () => {
    update((d) =>
      confirmPool(
        d,
        me,
        view.flatMap((v) => v.members.map((m) => ({ applicantId: m.id, cohort: v.cohort.name }))),
        shortfalls,
      ),
    )
    setWarn(false)
  }

  const doPromote = () => {
    if (!promote || !reason.trim()) return
    update((d) => addEntry(d, { applicantId: promote.id, by: me, kind: 'outcome', from: promote.outcome, to: 'Eligible', reason: reason.trim(), replacement: true }))
    setPromote(undefined)
    setReason('')
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {confirmed && !changed && (
        <Banner tone="success" title={`Pool confirmed by ${confirmed.by}, ${formatDateTime(confirmed.at)}`}>
          {confirmed.members.length} participants.
          {confirmed.shortfalls.length > 0 && ` Confirmed under quota: ${confirmed.shortfalls.map((s) => `${s.cohort} ${s.have} of ${s.need}`).join(', ')}.`}
        </Banner>
      )}
      {changed && (
        <Banner tone="warning" title="The pool has changed since you confirmed it">
          Someone was added or removed after {formatDateTime(confirmed!.at)}. Confirm again to record the current pool.
        </Banner>
      )}

      {view.map((v) => {
        const short = v.members.length < v.need
        return (
          <Card
            key={v.cohort.id}
            title={v.cohort.name}
            description={
              <span className={cn('tabular-nums', short && 'text-pending-fg')}>
                <span className="font-semibold">{v.members.length}</span> of {v.need} qualified{short && `, ${v.need - v.members.length} short`}
              </span>
            }
          >
            <div className="flex flex-col gap-4">
              <PersonList title="In the pool" people={v.members} empty="Nobody yet." />
              {v.reserve.length > 0 && (
                <PersonList
                  title="Reserve, available as replacements"
                  people={v.reserve}
                  action={(a) =>
                    short ? (
                      <Button size="sm" onClick={() => setPromote(a)}>
                        Promote to pool
                      </Button>
                    ) : (
                      <span className="text-xs text-graphite">Cohort is full</span>
                    )
                  }
                />
              )}
              {v.waiting.length > 0 && (
                <p className="text-sm text-graphite">
                  {v.waiting.length} more {v.waiting.length === 1 ? 'is' : 'are'} Eligible but haven’t Passed verification, so {v.waiting.length === 1 ? 'isn’t' : 'aren’t'} in the pool: {v.waiting.map((w) => w.id).join(', ')}.
                </p>
              )}
            </div>
          </Card>
        )
      })}

      <WizardFooter
        previous={back}
        message={
          confirmed && !changed ? (
            <span className="flex items-center gap-1.5 text-positive-fg">
              <CheckIcon /> Pool confirmed.
            </span>
          ) : shortfalls.length ? (
            `Under quota: ${shortfalls.map((s) => `${s.cohort} ${s.have} of ${s.need}`).join(', ')}.`
          ) : (
            `${total} qualified, every cohort is full.`
          )
        }
      >
        {confirmed && !changed ? (
          <Button disabled>Pool confirmed</Button>
        ) : (
          <Button variant="primary" onClick={() => (shortfalls.length ? setWarn(true) : doConfirm())}>
            Confirm pool
          </Button>
        )}
      </WizardFooter>

      <Modal
        open={warn}
        onClose={() => setWarn(false)}
        title="Confirm a pool that’s under quota?"
        description={`These cohorts have fewer qualified participants than their quota: ${shortfalls.map((s) => `${s.cohort} (${s.have} of ${s.need})`).join(', ')}. You can confirm anyway, and promote Reserve applicants or source more people later.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setWarn(false)}>
              Go back
            </Button>
            <Button variant="primary" onClick={doConfirm}>
              Confirm anyway
            </Button>
          </>
        }
      />

      <Modal
        open={!!promote}
        onClose={() => setPromote(undefined)}
        title={`Promote ${promote?.id ?? ''} to the pool`}
        description="They’re eligible and verified, and the cohort is short. This is logged with your name and the time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPromote(undefined)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!reason.trim()} onClick={doPromote}>
              Promote
            </Button>
          </>
        }
      >
        <TextArea label="Reason (required)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  )
}

function PersonList({ title, people, empty, action }: { title: string; people: Applicant[]; empty?: string; action?: (a: Applicant) => React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{title}</p>
      {people.length === 0 ? (
        <p className="text-sm text-graphite">{empty}</p>
      ) : (
        <ul className="divide-y divide-mist rounded-sm border border-mist">
          {people.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
              <span className="w-16 font-medium tabular-nums">{a.id}</span>
              <span className="min-w-0 flex-1 tabular-nums">{a.contact}</span>
              <span className="text-graphite">{a.source}</span>
              <StatusChip status={a.outcome} size="sm" />
              <StatusChip status={a.verification} size="sm" />
              {action?.(a)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
