import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { AlertIcon, ChevronRightIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { InfoTip } from '@/components/InfoTip'
import { Tooltip } from '@/components/Tooltip'
import { formatDay, formatSlot, formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { assignEscalation, extendWindow, fieldworkNow, giveUp, lowerTarget, sendBookingLink, sendRescheduleLink, inviteFromReserve, resendLink, retrySession } from '@/state/fieldwork'
import { ago, moderatorRoster, timeCheck, topUpStatus, needsYou, supportReport, slotLedger, verdict, type NeedsRow, regionMatrix, regionSkew } from '@/state/selectors'
import { SessionTag } from '../SessionTag'
import { invitedIds, invitedMessage, type FWProps } from './FieldworkBits'
import { CoverageCard } from './CoverageCard'
import { PatternsCard } from './PatternsCard'
import { KpiStrip } from './KpiStrip'
import { ParticipantJourney } from './ParticipantJourney'
import { RepeatingProblemLine } from './RepeatingProblemLine'
import { VerdictCard } from './VerdictCard'

const r19 = (studyId: string, id: string) => `${studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })}?from=needs-you`


export function Overview(p: FWProps) {
  const { doc, audience, target, studyId, outcomes, reserve, awaiting, readOnly, paused, closed, update, me } = p
  const toast = useToast()
  const needs = needsYou(doc)
  const v = verdict(doc, target, outcomes, reserve, needs.length)
  const regions = regionMatrix(doc, outcomes)
  const skew = regionSkew(regions.totals, regions.total)
  const ledger = slotLedger(doc, target, outcomes)
  // Excluded sessions whose slot someone else now holds. One still open is not yet replaced.
  const replaced = Math.max(0, ledger.released.filter((r) => r.why === 'Excluded').length - ledger.open)
  const blockedWhy = readOnly ? 'This is sample data. Nothing can be changed.' : closed ? 'Fieldwork is closed' : paused ? 'Resume fieldwork to do this.' : undefined
  const inviteNow = (n: number) => {
    const next = inviteFromReserve(doc, me, reserve.slice(0, n))
    const ids = invitedIds(doc, next)
    update(() => next)
    if (ids.length) toast(invitedMessage(ids), { label: 'View in Sessions', to: `${studyPath(studyId, screenById.R18)}?tab=sessions` })
  }
  const topUp = topUpStatus(doc, audience)
  const time = timeCheck(doc, target, outcomes)
  const [adjust, setAdjust] = useState<'extend' | 'lower'>()

  return (
    <div className="flex flex-col gap-6">
      <KpiStrip doc={doc} target={target} outcomes={outcomes} awaiting={awaiting} reviewTotal={p.reviewTotal} studyId={studyId} clock={closed ? 'closed' : paused ? (p.versionPause ? 'stopped-relaunch' : 'stopped') : 'running'} />

      <VerdictCard
        v={v}
        ledger={ledger}
        reserve={reserve}
        studyId={studyId}
        blockedWhy={blockedWhy}
        newInReserve={topUp.newInReserve}
        closed={closed}
        notEnoughTime={time.short ? { left: time.left, needed: time.needed } : undefined}
        daysLeft={doc.window ? time.left : null}
        clockStopped={paused && !closed}
        paused={paused}
        resumable={!!doc.paused && !p.versionPause}
        replaced={replaced}
        terminated={p.terminated}
        goTab={p.goTab}
        onInvite={inviteNow}
        onAdjust={setAdjust}
      />

      <RepeatingProblemLine doc={doc} studyId={studyId} behind={v.level === 'Behind pace'} hidden={paused || closed} />

      {topUp.running && (
        <Card title="Top-up in progress" description="Applicants you sourced after launch go through screening into the reserve. They never go straight to an interview.">
          <dl className="flex flex-wrap items-end gap-x-3 gap-y-3 text-sm tabular-nums" data-testid="topup-card">
            {(
              [
                ['Sourced', topUp.sourced, 'topup-sourced'],
                ['In screening', topUp.inScreening, 'topup-screening'],
                ['Eligible', topUp.eligible, 'topup-eligible'],
                ['Ineligible', topUp.ineligible, 'topup-ineligible'],
                ['Not yet screened', topUp.notYetScreened, 'topup-notyet'],
              ] as const
            ).map(([label, n, id], i) => (
              <div key={label} className="flex items-end gap-3">
                {i > 0 && (
                  <span aria-hidden className="pb-0.5 text-lg text-muted">
                    {i === 1 ? '=' : '+'}
                  </span>
                )}
                <div>
                  <dt className="text-graphite">{label}</dt>
                  <dd className="text-lg font-semibold" data-testid={id}>
                    {n}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {topUp.newInReserve > 0 && (
              <span className="font-medium text-positive-fg tabular-nums" data-testid="topup-new">
                {topUp.newInReserve} new in reserve ·{' '}
                {blockedWhy ? (
                  <span className="text-graphite">Invite</span>
                ) : (
                  <button type="button" onClick={() => inviteNow(reserve.length)} className="underline">
                    Invite
                  </button>
                )}
              </span>
            )}
            <Link to={studyPath(studyId, screenById.R9)} className="text-iris-700 hover:underline">
              See screening
            </Link>
          </p>
        </Card>
      )}

      <AdjustModal kind={adjust} onClose={() => setAdjust(undefined)} p={p} counting={v.gap.counting} />

      <NeedsYou {...p} rows={needs} blockedWhy={blockedWhy} />

      {skew && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-mist bg-haze px-4 py-2 text-sm text-ink">
          <AlertIcon size={14} className="mt-0.5 shrink-0" />
          Regions are uneven. {skew}
        </p>
      )}

      <ParticipantJourney doc={doc} studyId={studyId} needsCount={needs.length} />

      <CoverageCard doc={doc} studyId={studyId} />

      <PatternsCard doc={doc} studyId={studyId} />

      {doc.log.length > 0 && (
        <details data-testid="activity" className="group rounded-md border border-mist bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-md font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon size={14} className="text-graphite transition-transform group-open:rotate-90" />
            Activity
            <span className="rounded-full bg-haze px-2 text-sm font-medium tabular-nums text-graphite">{doc.log.length}</span>
          </summary>
          <ul className="flex flex-col gap-2 border-t border-mist px-5 py-4 text-sm">
            {[...doc.log].reverse().map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.by}</span>: {l.text} <span className="text-xs text-graphite">{formatStamp(l.at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

const FIRST_SHOWN = 5

/** Whose side the failure was on. "Our side" is never penalised, and the tip says what that means. */
function FaultChip({ fault }: { fault: NeedsRow['fault'] }) {
  const ours = fault === 'Our side'
  return (
    <Tooltip
      focusable
      align="left"
      content={ours ? 'On us, not the participant. They are never marked No-show, keep their incentive and their slot, and a reschedule is free.' : 'The cause is on the participant’s end. Their slot is kept until you give up on them.'}
    >
      <span data-testid="fault-chip" data-fault={fault} className={cn('inline-block whitespace-nowrap rounded-xs border px-1.5 py-0.5 text-xs font-medium', ours ? 'border-mist-strong bg-surface text-ink' : 'border-mist bg-haze text-graphite')}>
        {fault}
      </span>
    </Tooltip>
  )
}

/** How long ago, with the exact time and its zone under it. */
function Since({ iso, now, className }: { iso: string; now: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatStamp(iso)} className={cn('flex flex-col leading-tight tabular-nums', className)}>
      <span className="text-sm text-graphite">{ago(iso, now)}</span>
      <span data-testid="needs-time" className="text-xs text-muted">{formatSlot(iso)}</span>
    </time>
  )
}

/** "4 h 12 min" or "38 min". */
const duration = (min: number) => {
  const m = Math.max(0, Math.round(min))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

const plusDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00-05:00`).getTime() + n * 86400000).toISOString().slice(0, 10)

/** Extend the window or lower the target. Either needs a reason; who and when go to the activity log (the audit trail). */
function AdjustModal({ kind, onClose, p, counting }: { kind?: 'extend' | 'lower'; onClose: () => void; p: FWProps; counting: number }) {
  const { doc, target, update, me } = p
  const toast = useToast()
  const [end, setEnd] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const current = doc.window?.end ?? ''
  const endValue = end || plusDays(current, 7)
  const toValue = to || String(Math.max(counting, target - 1))
  const toNum = Number(toValue)
  const min = Math.max(1, counting)
  const valid = kind === 'extend' ? endValue > current : Number.isInteger(toNum) && toNum >= min && toNum < target
  const close = () => {
    setEnd('')
    setTo('')
    setReason('')
    onClose()
  }
  const confirm = () => {
    if (kind === 'extend') {
      update((d) => extendWindow(d, endValue, reason, me))
      toast(`Window extended to ${formatDay(`${endValue}T12:00:00-05:00`)}. Logged with your name and the time.`)
    } else {
      update((d) => lowerTarget(d, target, toNum, reason, me))
      toast(`Target lowered from ${target} to ${toNum}. Logged with your name and the time.`)
    }
    close()
  }
  return (
    <Modal
      open={!!kind}
      onClose={close}
      title={kind === 'extend' ? 'Extend the fieldwork window' : 'Lower the target'}
      description={kind === 'extend' ? `The window now ends ${current ? formatDay(`${current}T12:00:00-05:00`) : ''}. More time lets new applicants be sourced, screened and interviewed.` : `The target is ${target} and ${counting} already count, so it can’t go below ${min}. Every count and the verdict use the new target.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || !reason.trim()} onClick={confirm} data-testid="confirm-adjust">
            {kind === 'extend' ? 'Extend window' : 'Lower target'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {kind === 'extend' ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            New end date
            <input type="date" min={plusDays(current, 1)} value={endValue} onChange={(e) => setEnd(e.target.value)} className={`${controlBase} h-9 w-44 px-2.5`} />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            New target
            <input type="number" min={min} max={target - 1} value={toValue} onChange={(e) => setTo(e.target.value)} className={`${controlBase} h-9 w-28 px-2.5 tabular-nums`} />
          </label>
        )}
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  )
}

/** One button from the verdict. Inviting and sourcing are blocked while the study is paused. */

function NeedsYou({ doc, rows, studyId, me, update, readOnly, blockedWhy }: FWProps & { rows: NeedsRow[]; blockedWhy?: string }) {
  const [all, setAll] = useState(false)
  const { hash } = useLocation()
  // Coming back from a session opened from a row lands on the list.
  useEffect(() => {
    if (hash === '#needs-you') document.getElementById('needs-you')?.scrollIntoView({ block: 'start' })
  }, [hash])
  const [notice, setNotice] = useState<string>()
  const [giving, setGiving] = useState<NeedsRow>()
  const [assigning, setAssigning] = useState<NeedsRow>()
  const [pick, setPick] = useState('')
  const toast = useToast()
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(undefined), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const shown = all ? rows : rows.slice(0, FIRST_SHOWN)
  const roster = moderatorRoster(doc)

  const run = (row: NeedsRow) => {
    const id = row.session.id
    const who = row.who
    if (row.action === 'Resend link') {
      update((d) => resendLink(d, id, me))
      setNotice(`Link resent to ${who}.`)
    } else if (row.action === 'Reissue link') {
      update((d) => resendLink(d, id, me))
      setNotice(`A new link was sent to ${who}.`)
    } else if (row.action === 'Resume') {
      update((d) => resendLink(d, id, me))
      setNotice(`Resume link sent to ${who}.`)
    } else if (row.action === 'Retry') {
      update((d) => retrySession(d, id, me))
      setNotice(`Retry link sent to ${who}. A new session was created.`)
    } else if (row.action === 'Send booking link') {
      update((d) => sendRescheduleLink(d, id, me))
      setNotice(`Booking link sent to ${who}. The reschedule is free.`)
    } else if (row.action === 'Copy report for support') {
      void navigator.clipboard?.writeText(supportReport(doc, row)).catch(() => undefined)
      setNotice(`Report for ${who} copied. Paste it to support.`)
    }
  }
  const why = (row: NeedsRow) => (readOnly ? 'This is sample data. Nothing can be changed.' : row.invites ? blockedWhy : undefined)
  const confirmGiveUp = () => {
    if (!giving || !reason.trim()) return
    update((d) => giveUp(d, giving.session.id, reason, me))
    setNotice(`Gave up on ${giving.who}. Their slot is open.`)
    setGiving(undefined)
    setReason('')
  }

  // Nothing to do: one quiet line, not a card. A note about what was just done still shows.
  if (rows.length === 0)
    return (
      <div id="needs-you" aria-label="Needs you" className="scroll-mt-4">
        {notice && (
          <p role="status" className="mb-2 rounded-md border border-positive-line bg-positive-bg px-4 py-2 text-sm text-positive-fg">
            {notice}
          </p>
        )}
        <p className="text-sm text-graphite">Nothing needs you right now.</p>
      </div>
    )

  return (
    <section id="needs-you" aria-label="Needs you" className="scroll-mt-4 rounded-md border border-mist bg-surface">
      <header className="flex items-start gap-4 border-b border-mist px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-md font-semibold">
            Needs you <span className="ml-0.5 rounded-full bg-haze px-2 text-sm font-medium tabular-nums text-graphite">{rows.length}</span>
            <InfoTip label="How Needs you is ordered">Waiting for a moderator first, then failures on our side, then the rest, oldest first. A row leaves when the next event happens, so nothing is marked resolved.</InfoTip>
          </h2>
          <p className="mt-0.5 text-sm text-graphite">Only what you can move forward. Oldest first.</p>
        </div>
      </header>
      {notice && (
        <p role="status" className="border-b border-positive-line bg-positive-bg px-5 py-2 text-sm text-positive-fg">
          {notice}
        </p>
      )}
      <>
        <ul className="divide-y divide-mist">
          {shown.map((row) => {
            const blocked = why(row)
            if (row.kind === 'escalation' && row.escalation) {
              const e = row.escalation
              const late = e.leftMin < 0
              return (
                <li key={row.key} data-testid="escalation-row" className="flex flex-col gap-2 border-l-4 border-graphite bg-haze px-5 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Link to={r19(studyId, row.session.id)} className="font-medium text-iris-700 hover:underline">
                      <SessionTag participantId={row.session.participantId} no={row.session.no} count={doc.sessions.filter((x) => x.participantId === row.session.participantId).length} />
                    </Link>
                    <span className="rounded-xs border border-mist-strong bg-surface px-1.5 py-0.5 text-xs font-medium text-ink">Waiting for moderator</span>
                    <FaultChip fault={row.fault} />
                    <span className="text-sm">{row.what}</span>
                  </div>
                  <p className="text-sm tabular-nums" data-testid="escalation-clock">
                    Asked {formatSlot(row.since)}. Waiting {duration(e.waitedMin)}.{' '}
                    <span className={late ? 'font-medium text-negative-fg' : 'font-medium'}>{late ? `Overdue by ${duration(-e.leftMin)} against` : `${duration(e.leftMin)} left on`} the promise: “We’ll contact you within 24 hours.”</span>
                  </p>
                  <span className="flex flex-wrap gap-2">
                    {blocked ? (
                      <Tooltip content={blocked} focusable>
                        <Button size="sm" variant="primary" disabled>
                          Assign moderator
                        </Button>
                      </Tooltip>
                    ) : (
                      <>
                        <Button size="sm" variant="primary" data-testid="assign-moderator" onClick={() => { setPick(''); setAssigning(row) }}>
                          Assign moderator
                        </Button>
                        <Button
                          size="sm"
                          data-testid="send-booking-link"
                          onClick={() => {
                            update((d) => sendBookingLink(d, row.session.id, me))
                            toast(`Booking link sent to ${row.who}. They’ll book a human follow-up.`)
                          }}
                        >
                          Send booking link
                        </Button>
                      </>
                    )}
                    {!readOnly && (
                      <Button size="sm" variant="ghost" onClick={() => setGiving(row)} aria-label={`Give up and replace: ${row.who}`}>
                        Give up and replace
                      </Button>
                    )}
                  </span>
                </li>
              )
            }
            return (
              <li key={row.key} data-testid="needs-row" data-kind={row.kind} data-who={row.who} className="grid items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_9.5rem_15.5rem]">
                <Link to={r19(studyId, row.session.id)} className="font-medium text-iris-700 hover:underline">
                  <SessionTag participantId={row.session.participantId} no={row.session.no} count={doc.sessions.filter((x) => x.participantId === row.session.participantId).length} />
                </Link>
                <span className="min-w-0 text-sm">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{row.what}</span>
                    <FaultChip fault={row.fault} />
                  </span>
                  {row.note && (
                    <span data-testid="self-service-note" className="mt-0.5 block text-xs text-graphite">
                      {row.note}
                    </span>
                  )}
                </span>
                <Since iso={row.since} now={fieldworkNow(doc)} className="sm:items-end sm:text-right" />
                <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {blocked ? (
                    <Tooltip content={blocked} focusable>
                      <Button size="sm" disabled>
                        {row.action}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button size="sm" onClick={() => run(row)} aria-label={`${row.action}: ${row.who}`}>
                      {row.action}
                    </Button>
                  )}
                  {row.giveUp && !readOnly && (
                    <Button size="sm" variant="ghost" onClick={() => setGiving(row)} aria-label={`Give up and replace: ${row.who}`}>
                      Give up and replace
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        {rows.length > FIRST_SHOWN && (
          <div className="border-t border-mist px-5 py-2.5">
            <Button size="sm" variant="ghost" onClick={() => setAll((x) => !x)}>
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </Button>
          </div>
        )}
      </>

      <Modal
        open={!!assigning}
        onClose={() => setAssigning(undefined)}
        title={`Assign a moderator to ${assigning?.who ?? ''}`}
        description="Pick who takes this participant. They are notified whatever their state, even if they aren’t on standby. Nobody is picked for you."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigning(undefined)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!pick}
              data-testid="confirm-assign"
              onClick={() => {
                if (assigning) {
                  update((d) => assignEscalation(d, assigning.session.id, pick, me))
                  toast(`${roster.find((m) => m.id === pick)?.name} was notified about ${assigning.who}.`)
                }
                setAssigning(undefined)
              }}
            >
              Assign and notify
            </Button>
          </>
        }
      >
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Moderators</legend>
          {roster.map((m) => (
            <label key={m.id} className="flex items-center gap-3 rounded-sm border border-mist px-3 py-2 text-sm has-[:checked]:border-iris-600 has-[:checked]:bg-iris-50">
              <input type="radio" name="assign-moderator" value={m.id} checked={pick === m.id} onChange={() => setPick(m.id)} className="accent-[var(--color-iris-600)]" />
              <span className="flex-1 font-medium">{m.name}</span>
              {m.standby && <span className="text-xs text-graphite">On standby</span>}
              <span className={cn('rounded-xs px-1.5 py-0.5 text-xs font-medium', m.state === 'Online' ? 'bg-positive-bg text-positive-fg' : m.state === 'In session' ? 'bg-progress-bg text-progress-fg' : 'bg-haze text-graphite')}>{m.state}</span>
            </label>
          ))}
        </fieldset>
      </Modal>

      <Modal
        open={!!giving}
        onClose={() => {
          setGiving(undefined)
          setReason('')
        }}
        title={`Give up on ${giving?.who ?? ''} and replace them?`}
        description="Their slot opens again, so the gap grows by one and the reserve or sourcing can fill it. Their data and session record are kept."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setGiving(undefined)
                setReason('')
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" disabled={!reason.trim()} onClick={confirmGiveUp}>
              Give up and open the slot
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-graphite">{giving?.what} The reason is logged with your name and the time.</p>
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </section>
  )
}
