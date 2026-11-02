import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { AlertIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { SplitBar } from '@/components/ProgressBar'
import { Tooltip } from '@/components/Tooltip'
import { formatDay, formatSlot, formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { SIMULATE_TIME_STEPS } from '@/mock/needsYou'
import { advanceClock, assignEscalation, extendWindow, fieldworkNow, simulateModeratorNoShow, giveUp, lowerTarget, sendBookingLink, sendRescheduleLink, inviteFromReserve, resendLink, retrySession } from '@/state/fieldwork'
import { ago, funnel, moderatorRoster, timeCheck, topUpStatus, needsYou, supportReport, slotLedger, verdict, type NeedsRow, type VerdictAction, type VerdictLevel, durationStats, regionMatrix, regionSkew, targetFill } from '@/state/selectors'
import { SessionTag } from '../SessionTag'
import { invitedIds, invitedMessage, type FWProps } from './FieldworkBits'
import { SlotLedger } from './SlotLedger'

const r19 = (studyId: string, id: string) => `${studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })}?from=needs-you`

const TONE: Record<VerdictLevel, { box: string; word: string }> = {
  'At risk': { box: 'border-negative-line bg-negative-bg', word: 'text-negative-fg' },
  'Behind pace': { box: 'border-pending-line bg-pending-bg', word: 'text-pending-fg' },
  'On track': { box: 'border-positive-line bg-positive-bg', word: 'text-positive-fg' },
}

export function Overview(p: FWProps) {
  const { doc, audience, target, studyId, outcomes, reserve, awaiting, waiting, readOnly, paused, closed, update, me } = p
  const toast = useToast()
  const needs = needsYou(doc)
  const v = verdict(doc, target, outcomes, reserve, needs.length)
  const fill = targetFill(doc, audience, outcomes)
  const regions = regionMatrix(doc, outcomes)
  const skew = regionSkew(regions.totals, regions.total)
  const dur = durationStats(doc)
  const flow = funnel(doc, outcomes)
  const ledger = slotLedger(doc, target, outcomes)
  const blockedWhy = readOnly ? 'This is sample data. Nothing can be changed.' : closed ? 'Fieldwork is closed' : paused ? 'Study is paused' : undefined
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
      <section aria-label="Verdict" className={cn('flex flex-wrap items-start gap-x-6 gap-y-3 rounded-md border px-5 py-4', TONE[v.level].box)}>
        <div className="min-w-0 flex-1 basis-80">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn('text-xl font-semibold', TONE[v.level].word)}>{v.level}</span>
            <span className="text-base text-ink tabular-nums">{v.sentence}</span>
          </p>
          {v.warning && (
            <p className="mt-2 flex items-start gap-2 text-sm text-pending-fg">
              <AlertIcon size={14} className="mt-0.5 shrink-0" />
              {v.warning}
            </p>
          )}
          {v.plan && (
            <p className="mt-2 text-sm font-medium tabular-nums" data-testid="closing-plan">
              {v.plan.line}
            </p>
          )}
          {v.plan && topUp.newInReserve > 0 && (
            <p className="mt-1 text-sm text-positive-fg tabular-nums" data-testid="new-in-reserve">
              {topUp.newInReserve} new in reserve ·{' '}
              {blockedWhy ? (
                <span className="text-graphite">Invite</span>
              ) : (
                <button type="button" onClick={() => inviteNow(reserve.length)} className="font-medium underline">
                  Invite
                </button>
              )}
            </p>
          )}
          {v.plan && v.plan.source > 0 && time.short && !closed && (
            <div className="mt-2 rounded-sm border border-negative-line bg-surface px-3 py-2 text-sm" data-testid="not-enough-time">
              <p className="flex items-start gap-2 font-medium text-negative-fg">
                <AlertIcon size={14} className="mt-0.5 shrink-0" />
                Not enough time left in the window
              </p>
              <p className="mt-0.5 text-graphite tabular-nums">
                {time.left} {time.left === 1 ? 'day' : 'days'} left, and a new person needs about {time.needed} days to be sourced, screened and interviewed.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" disabled={!!blockedWhy} onClick={() => setAdjust('extend')}>
                  Extend window
                </Button>
                <Button size="sm" disabled={!!blockedWhy} onClick={() => setAdjust('lower')}>
                  Lower target
                </Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-graphite">{v.basis}</p>
          <SlotLedger ledger={ledger} />
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2" aria-label="Verdict actions">
          {v.actions.map((a, i) => (
            <VerdictButton key={a.label} action={a} primary={i === 0} blockedWhy={blockedWhy} studyId={studyId} goTab={p.goTab} onInvite={inviteNow} />
          ))}
        </div>
      </section>

      {topUp.running && (
        <Card title="Top-up in progress" description="Applicants you sourced after launch go through screening into the reserve. They never go straight to an interview.">
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm tabular-nums" data-testid="topup-card">
            <div>
              <dt className="text-graphite">Sourced</dt>
              <dd className="text-lg font-semibold">{topUp.sourced}</dd>
            </div>
            <div>
              <dt className="text-graphite">In screening</dt>
              <dd className="text-lg font-semibold">{topUp.inScreening}</dd>
            </div>
            <div>
              <dt className="text-graphite">Eligible</dt>
              <dd className="text-lg font-semibold">{topUp.eligible}</dd>
            </div>
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
        <p role="status" className="flex items-start gap-2 rounded-md border border-pending-line bg-pending-bg px-4 py-2 text-sm text-pending-fg">
          <AlertIcon size={14} className="mt-0.5 shrink-0" />
          Regions are uneven. {skew}
        </p>
      )}

      <Card title="Participant funnel" description="Every invited participant is counted once, at the furthest stage they reached.">
        <div className="flex flex-col gap-5">
          <p data-testid="funnel-summary" className="text-sm text-graphite tabular-nums">
            Target {target}: {v.gap.counting} counting, {v.gap.running} still open{v.gap.noShowHeld ? `, ${v.gap.noShowHeld} no-${v.gap.noShowHeld === 1 ? 'show' : 'shows'} holding a slot` : ''}, {v.gap.reserve} in reserve
          </p>
          <ol className="flex flex-col gap-3" aria-label="Funnel stages">
            {flow.stages.map((st) => (
              <li key={st.key} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[7rem_minmax(0,1fr)_3rem]">
                <span className="text-sm font-medium">{st.label}</span>
                <div className="h-3 overflow-hidden rounded-xs bg-haze" aria-hidden="true">
                  <div className="h-full rounded-xs bg-ink" style={{ width: `${flow.total ? (st.reached / flow.total) * 100 : 0}%` }} />
                </div>
                <span className="text-right font-semibold tabular-nums max-sm:text-left">{st.reached}</span>
                {(st.left.length > 0 || st.waiting.length > 0 || st.key === 'completed') && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite sm:col-start-2 sm:col-span-2">
                    {st.left.map((x) => (
                      <li key={x.label} className="text-pending-fg tabular-nums">
                        {x.n} {x.label.toLowerCase()}, {x.note ?? 'left the study'}
                      </li>
                    ))}
                    {st.waiting.map((x) => (
                      <li key={x.label} className="tabular-nums">
                        {x.n} {x.label.toLowerCase()}
                      </li>
                    ))}
                    {st.key === 'completed' && (
                      <>
                        <li className="tabular-nums">
                          Inside the {flow.completed.n}: {flow.completed.accepted} accepted, {flow.completed.pending} under review, {flow.completed.excluded} excluded
                        </li>
                        {flow.completed.excluded > 0 && (
                          <li className="font-medium text-pending-fg tabular-nums">
                            {flow.completed.excluded} excluded in review{ledger.open > 0 ? ' (replacements needed)' : ''}
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <p className="border-t border-mist pt-3 text-sm text-graphite tabular-nums" data-testid="funnel-total">
            {flow.total} invited = {flow.completed.n} completed ({flow.completed.accepted} accepted + {flow.completed.pending} under review + {flow.completed.excluded} excluded) + {flow.withdrew} withdrew + {flow.noShow} no-show{flow.gaveUp ? ` + ${flow.gaveUp} given up` : ''} + {flow.inProgress} still in progress
            {flow.sum === flow.total ? '.' : `. ${flow.total - flow.sum} unaccounted for.`}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Progress toward the target">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="flex-1 font-medium">{fill.name}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{fill.completed}</span> of {fill.target}
              </span>
            </div>
            <SplitBar className="mt-1.5" confirmed={fill.accepted} pending={fill.pending} total={fill.target} label={`${fill.accepted} accepted, ${fill.pending} under review, of ${fill.target}`} />
            <p className="mt-1 text-xs text-graphite tabular-nums">
              {fill.accepted} confirmed, {fill.pending} pending review{fill.excluded ? `. ${fill.excluded} excluded, not counted` : ''}
            </p>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-mist pt-3 text-xs text-graphite">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-xs bg-ink" /> Accepted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="hatched inline-block h-2 w-4 rounded-xs bg-haze" /> Under review
            </span>
          </p>
        </Card>

        <Card title="At a glance">
          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="font-medium">Interview length</dt>
              <dd className="mt-0.5 text-graphite tabular-nums">
                {dur.n === 0
                  ? 'No completed interviews yet.'
                  : `Averaging ${dur.avg} min against the ${dur.target} min target. ${dur.over} of ${dur.n} ran over.`}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Review</dt>
              <dd className="mt-0.5">
                <Link to={studyPath(studyId, screenById.R21)} className="text-iris-700 hover:underline tabular-nums">
                  {awaiting} {awaiting === 1 ? 'session' : 'sessions'} awaiting review
                </Link>
                {(waiting.participant > 0 || waiting.moderator > 0) && (
                  <span className="mt-0.5 block text-graphite tabular-nums" data-testid="waiting-line">
                    {[waiting.participant > 0 && `${waiting.participant} waiting for participant`, waiting.moderator > 0 && `${waiting.moderator} waiting for moderator`].filter(Boolean).join(', ')}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {doc.log.length > 0 && (
        <Card title="Activity">
          <ul className="flex flex-col gap-2 text-sm">
            {[...doc.log].reverse().map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.by}</span>: {l.text} <span className="text-xs text-graphite">{formatStamp(l.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
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
      <span data-testid="fault-chip" data-fault={fault} className={cn('inline-block whitespace-nowrap rounded-xs border px-1.5 py-0.5 text-xs font-medium', ours ? 'border-pending-line bg-pending-bg text-pending-fg' : 'border-mist bg-haze text-graphite')}>
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
function VerdictButton({ action, primary, blockedWhy, studyId, goTab, onInvite }: { action: VerdictAction; primary: boolean; blockedWhy?: string; studyId: string; goTab: (t: string) => void; onInvite: (n: number) => void }) {
  const fills = action.kind === 'invite' || action.kind === 'source'
  const variant = primary ? 'primary' : 'secondary'
  if (fills && blockedWhy)
    return (
      <Tooltip content={blockedWhy} focusable>
        <Button variant={variant} disabled>
          {action.label}
        </Button>
      </Tooltip>
    )
  if (action.kind === 'invite') return <Button variant={variant} onClick={() => onInvite(action.n ?? 0)}>{action.label}</Button>
  // Source more opens R8 as a top-up with the number to source filled in.
  if (action.kind === 'source') return <Button variant={variant} data-testid="source-more" to={`${studyPath(studyId, screenById.R8)}?topup=${action.n}`}>{action.label}</Button>
  if (action.kind === 'sessions') return <Button variant="primary" onClick={() => goTab('sessions')}>{action.label}</Button>
  if (action.kind === 'needs') return <Button variant="primary" onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{action.label}</Button>
  return <Button variant="primary" to={studyPath(studyId, screenById.R21)}>{action.label}</Button>
}

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

  return (
    <section id="needs-you" aria-label="Needs you" className="scroll-mt-4 rounded-md border border-mist bg-surface">
      <header className="flex items-start gap-4 border-b border-mist px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-semibold">
            Needs you <span className="ml-1 rounded-full bg-haze px-2 text-sm font-medium tabular-nums text-graphite">{rows.length}</span>
          </h2>
          <p className="mt-0.5 text-sm text-graphite">Only what you can move forward. Waiting for a moderator first, then failures on our side, then the rest, oldest first. A row leaves when the next event happens, so nothing is marked resolved.</p>
        </div>
      </header>
      {notice && (
        <p role="status" className="border-b border-positive-line bg-positive-bg px-5 py-2 text-sm text-positive-fg">
          {notice}
        </p>
      )}
      {import.meta.env.DEV && !readOnly && (
        <div data-testid="needs-dev" className="flex flex-wrap items-center gap-2 border-b border-dashed border-mist-strong bg-haze px-5 py-2 text-sm">
          <span className="font-medium">Dev</span>
          <span className="text-graphite">Simulate time passing{doc.clockSkewMin ? ` (clock is +${duration(doc.clockSkewMin)})` : ''}:</span>
          {SIMULATE_TIME_STEPS.map((x) => (
            <Button key={x.label} size="sm" onClick={() => update((d) => advanceClock(d, x.minutes))}>
              {x.label}
            </Button>
          ))}
          {!!doc.clockSkewMin && (
            <Button size="sm" variant="ghost" onClick={() => update((d) => advanceClock(d, 0))}>
              Reset clock
            </Button>
          )}
          <span className="mx-1 h-4 w-px bg-mist-strong" aria-hidden />
          <Button
            size="sm"
            data-testid="mock-moderator-no-show"
            onClick={() => {
              const next = simulateModeratorNoShow(doc)
              if (next === doc) setNotice('Nobody is waiting to start, so there is no slot for a moderator to miss.')
              else update(() => next)
            }}
          >
            Mock a moderator no-show
          </Button>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-graphite">Nothing needs you. Everyone unfinished is in progress or waiting on the participant.</p>
      ) : (
        <>
          <ul className="divide-y divide-mist">
            {shown.map((row) => {
              const blocked = why(row)
              if (row.kind === 'escalation' && row.escalation) {
                const e = row.escalation
                const late = e.leftMin < 0
                return (
                  <li key={row.key} data-testid="escalation-row" className="flex flex-col gap-2 border-l-4 border-pending-fg bg-pending-bg px-5 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link to={r19(studyId, row.session.id)} className="font-medium text-iris-700 hover:underline">
                        <SessionTag participantId={row.session.participantId} no={row.session.no} count={doc.sessions.filter((x) => x.participantId === row.session.participantId).length} />
                      </Link>
                      <span className="rounded-xs border border-pending-line bg-surface px-1.5 py-0.5 text-xs font-medium text-pending-fg">Waiting for moderator</span>
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
      )}

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
