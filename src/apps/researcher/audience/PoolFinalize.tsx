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
  const total = view.members.length

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

  const shortfall = view.members.length < view.need ? { have: view.members.length, need: view.need } : null
  const confirmed = audience.pool
  const ids = new Set(view.members.map((m) => m.id))
  const changed = !!confirmed && (confirmed.members.length !== ids.size || confirmed.members.some((m) => !ids.has(m.applicantId)))

  const doConfirm = () => {
    update((d) =>
      confirmPool(
        d,
        me,
        view.members.map((m) => ({ applicantId: m.id })),
        shortfall,
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
          {confirmed.shortfall && ` Confirmed under target: ${confirmed.shortfall.have} of ${confirmed.shortfall.need}.`}
        </Banner>
      )}
      {changed && (
        <Banner tone="warning" title="The pool has changed since you confirmed it">
          Someone was added or removed after {formatDateTime(confirmed!.at)}. Confirm again to record the current pool.
        </Banner>
      )}

      {(() => {
        const short = view.members.length < view.need
        return (
          <Card
            title={audience.def.cohort.name}
            description={
              <span className={cn('tabular-nums', short && 'text-pending-fg')}>
                <span className="font-semibold">{view.members.length}</span> of {view.need} qualified{short && `, ${view.need - view.members.length} short`}
              </span>
            }
          >
            <div className="flex flex-col gap-4">
              <PersonList title="In the pool" people={view.members} empty="Nobody yet." />
              {view.reserve.length > 0 && (
                <PersonList
                  title="Reserve, available as replacements"
                  people={view.reserve}
                  action={(a) =>
                    short ? (
                      <Button size="sm" onClick={() => setPromote(a)}>
                        Promote to pool
                      </Button>
                    ) : (
                      <span className="text-xs text-graphite">Target is met</span>
                    )
                  }
                />
              )}
              {view.waiting.length > 0 && (
                <p className="text-sm text-graphite">
                  {view.waiting.length} more {view.waiting.length === 1 ? 'is' : 'are'} Eligible but haven’t Passed verification, so {view.waiting.length === 1 ? 'isn’t' : 'aren’t'} in the pool: {view.waiting.map((w) => w.id).join(', ')}.
                </p>
              )}
            </div>
          </Card>
        )
      })()}

      <WizardFooter
        previous={back}
        message={
          confirmed && !changed ? (
            <span className="flex items-center gap-1.5 text-positive-fg">
              <CheckIcon /> Pool confirmed.
            </span>
          ) : shortfall ? (
            `Under target: ${shortfall.have} of ${shortfall.need}.`
          ) : (
            `${total} qualified, the target is met.`
          )
        }
      >
        {confirmed && !changed ? (
          <Button disabled>Pool confirmed</Button>
        ) : (
          <Button variant="primary" onClick={() => (shortfall ? setWarn(true) : doConfirm())}>
            Confirm pool
          </Button>
        )}
      </WizardFooter>

      <Modal
        open={warn}
        onClose={() => setWarn(false)}
        title="Confirm a pool that’s under the target?"
        description={`Only ${shortfall?.have} of ${shortfall?.need} participants are qualified. You can confirm anyway, and promote Reserve applicants or source more people later.`}
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
        description="They’re eligible and verified, and the pool is short of the target. This is logged with your name and the time."
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
