import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDate, formatDateTime } from '@/lib/format'
import { countryOfRegion, maskEmail, participantEmail } from '@/mock/participants'
import { screenById, studyPath } from '@/routes/screens'
import { finalizePool, mockApplicants, movePerson, poolView, regionOf, reopenPool, setReserveSize, type Applicant } from '@/state/screening'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { useAudience } from './useAudience'

const stateOf = (a: Applicant) => a.answers.find((x) => /state/i.test(x.question))?.answer ?? ''

export function PoolFinalize() {
  const { studyId, audience, editable, me, update } = useAudience()
  const applicants = useMemo(() => (audience?.def ? mockApplicants(audience) : []), [audience])
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')

  if (!editable || !audience?.def) return <AudienceGate studyId={studyId} editable={editable} />

  const header = <PageHeader id="R11" title="Finalize pool" description="The first people screened fill the pool, up to the target. The next ones wait in the reserve as replacements. Required before launch." />
  const back = { to: studyPath(studyId, screenById.R9), label: 'Screening' }
  const view = poolView(applicants, audience)
  const finalized = audience.pool
  const locked = !!finalized
  const r9 = studyPath(studyId, screenById.R9)

  if (applicants.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="Nobody has been screened yet" description="Applicants appear once they have answered the screener." action={<Button variant="primary" to={r9}>Go to screening</Button>} />
        </div>
        <WizardFooter previous={back} />
      </div>
    )
  }

  const pending = view.pending.length
  const blockedWhy = pending ? `${pending} ${pending === 1 ? 'applicant is' : 'applicants are'} still pending review in screening.` : undefined
  const topUpN = view.sourceAbout || view.short
  const sourceMore = `${studyPath(studyId, screenById.R8)}?topup=${topUpN}&from=pool`

  const doFinalize = () => {
    update((d) => finalizePool(d, view, me, reason))
    setConfirming(false)
    setReason('')
  }
  const moveLabel = (to: 'pool' | 'reserve') => (to === 'reserve' ? 'Move to reserve' : 'Move to pool')

  const figure = (label: string, have: number, of: number) => {
    const short = have < of
    return (
      <div className={cn('rounded-md border px-5 py-3', short ? 'border-pending-line bg-pending-bg' : 'border-positive-line bg-positive-bg')} data-testid={`pool-figure-${label.toLowerCase()}`}>
        <p className="text-sm font-medium text-graphite">{label}</p>
        <p className={cn('text-[32px] leading-10 font-semibold tracking-tight whitespace-nowrap tabular-nums', short ? 'text-pending-fg' : 'text-positive-fg')}>
          {have} <span className="text-md font-medium">of {of}</span>
        </p>
      </div>
    )
  }

  const list = (title: string, people: Applicant[], to: 'pool' | 'reserve') => (
    <Card title={title} description={to === 'pool' ? 'The first people screened.' : 'Replacements, first screened first.'} flush>
      {people.length === 0 ? (
        <p className="px-5 py-4 text-sm text-graphite">Nobody yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid={`list-${to}`}>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                {['Applicant', 'Email', 'Country', 'Screened', ''].map((h, i) => (
                  <th key={i} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">
                    {h || <span className="sr-only">Action</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((a) => (
                <tr key={a.id} className="border-b border-mist last:border-0">
                  <th scope="row" className="px-4 py-2.5 font-medium whitespace-nowrap tabular-nums">{a.id}</th>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" title={participantEmail(a.id)}>{maskEmail(participantEmail(a.id))}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{countryOfRegion(regionOf(stateOf(a)) ?? null)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(a.submittedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" disabled={locked} onClick={() => update((d) => movePerson(d, a.id, to === 'pool' ? 'reserve' : 'pool', me))} aria-label={`${moveLabel(to === 'pool' ? 'reserve' : 'pool')}: ${a.id}`}>
                      {moveLabel(to === 'pool' ? 'reserve' : 'pool')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )

  return (
    <div className="flex flex-col gap-6">
      {header}

      {finalized && (
        <Banner
          tone="success"
          title={`Pool finalized by ${finalized.by}, ${formatDateTime(finalized.at)}`}
          actions={
            <Button size="sm" onClick={() => update((d) => reopenPool(d, me))}>
              Reopen pool
            </Button>
          }
        >
          {finalized.members.length} in the pool, {finalized.reserve?.length ?? 0} in the reserve. Locked for launch.
          {finalized.shortfall && ` Launching with ${finalized.shortfall.have} of ${finalized.shortfall.need}: “${finalized.reason}”`}
        </Banner>
      )}

      <section aria-label="Pool and reserve" className="flex flex-wrap items-stretch gap-4">
        {figure('Pool', view.pool.length, view.target)}
        {figure('Reserve', view.reserve.length, view.reserveSize)}
        <label className="flex flex-col justify-center gap-1 rounded-md border border-mist bg-surface px-5 py-3">
          <span className="text-sm font-medium text-graphite">Reserve size</span>
          <input
            type="number"
            min={0}
            value={view.reserveSize}
            disabled={locked}
            onChange={(e) => update((d) => setReserveSize(d, Number(e.target.value)))}
            className={cn(controlBase, 'h-9 w-24 tabular-nums')}
            aria-label="Reserve size"
          />
          <span className="text-xs text-graphite">Half the target to start.</span>
        </label>
      </section>

      {view.short > 0 && !locked && (
        <section aria-label="More people needed" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-pending-line bg-pending-bg px-5 py-4" data-testid="short-panel">
          <p className="min-w-0 flex-1 basis-96 text-pending-fg">
            <span className="font-medium">
              You need {view.short} more eligible {view.short === 1 ? 'person' : 'people'} ({view.poolShort} for the pool, {view.reserveShort} for the reserve).
            </span>{' '}
            {view.sourceAbout > 0 ? `${view.eligible} of ${view.screened} screened passed, so source about ${view.sourceAbout}.` : 'Nobody has passed yet, so there is nothing to estimate from.'}
          </p>
          <Button variant="primary" to={sourceMore} data-testid="source-more">
            Source more
          </Button>
        </section>
      )}

      {pending > 0 && (
        <p className="text-sm" data-testid="pending-note">
          <span className="font-medium">{pending} {pending === 1 ? 'applicant is' : 'applicants are'} still being screened.</span>{' '}
          <Link to={r9} className="font-medium text-iris-700 hover:underline">
            Open screening
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-6">
        {list('Pool', view.pool, 'pool')}
        {list('Reserve', view.reserve, 'reserve')}
      </div>

      {view.waiting.length > 0 && (
        <p className="text-sm text-graphite">
          {view.waiting.length} more {view.waiting.length === 1 ? 'is' : 'are'} eligible but {view.waiting.length === 1 ? 'hasn’t' : 'haven’t'} passed verification, so {view.waiting.length === 1 ? 'isn’t' : 'aren’t'} counted: {view.waiting.map((w) => w.id).join(', ')}.
        </p>
      )}

      {(audience.poolPlan?.history?.length ?? 0) > 0 && (
        <details className="rounded-md border border-mist bg-surface">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium">History</summary>
          <ol className="divide-y divide-mist border-t border-mist text-sm">
            {[...audience.poolPlan!.history!].reverse().map((e, i) => (
              <li key={i} className="px-5 py-2">
                <p>
                  <span className="font-medium">{e.by}</span> {e.kind === 'finalized' ? 'finalized the pool' : 'reopened the pool'}. {e.note}
                </p>
                <p className="text-xs text-graphite tabular-nums">{formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <WizardFooter
        previous={back}
        message={
          locked ? (
            <span className="flex items-center gap-1.5 text-positive-fg">
              <CheckIcon /> Pool and reserve are locked for launch.
            </span>
          ) : blockedWhy ? (
            blockedWhy
          ) : view.poolShort ? (
            `The pool is short: ${view.pool.length} of ${view.target}. You can still finalize, with a reason.`
          ) : (
            `The pool is full: ${view.pool.length} of ${view.target}.`
          )
        }
      >
        {locked ? (
          <Button disabled>Pool finalized</Button>
        ) : blockedWhy ? (
          <Tooltip focusable content={blockedWhy}>
            <Button variant="primary" disabled>
              Finalize pool
            </Button>
          </Tooltip>
        ) : (
          <Button variant="primary" onClick={() => (view.poolShort ? setConfirming(true) : doFinalize())} data-testid="finalize-pool">
            Finalize pool
          </Button>
        )}
      </WizardFooter>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Launch with ${view.pool.length} of ${view.target}?`}
        description="The pool is below the target. You can finalize anyway and source more people later from Fieldwork. The reason is logged with your name and the time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Go back
            </Button>
            <Button variant="primary" disabled={!reason.trim()} onClick={doFinalize} data-testid="confirm-finalize">
              Finalize pool
            </Button>
          </>
        }
      >
        <TextArea label="Reason (required)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Launch with ${view.pool.length} of ${view.target}`} />
      </Modal>
    </div>
  )
}
