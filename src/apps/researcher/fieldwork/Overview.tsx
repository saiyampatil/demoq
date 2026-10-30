import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { AlertIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { SplitBar } from '@/components/ProgressBar'
import { Tooltip } from '@/components/Tooltip'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { assignModerator, durationStats, giveUp, HUMAN_MODERATOR_IDS, inviteFromReserve, regionMatrix, regionSkew, rescheduleSession, resendLink, retrySession, targetFill } from '@/state/fieldwork'
import { ago, funnel, needsYou, slotLedger, verdict, type NeedsRow, type VerdictAction, type VerdictLevel } from '@/state/monitor'
import { SessionTag } from '../SessionTag'
import type { FWProps } from './FieldworkBits'
import { SlotLedger } from './SlotLedger'

const r19 = (studyId: string, id: string) => studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })

const TONE: Record<VerdictLevel, { box: string; word: string }> = {
  'At risk': { box: 'border-negative-line bg-negative-bg', word: 'text-negative-fg' },
  'Behind pace': { box: 'border-pending-line bg-pending-bg', word: 'text-pending-fg' },
  'On track': { box: 'border-positive-line bg-positive-bg', word: 'text-positive-fg' },
}

export function Overview(p: FWProps) {
  const { doc, audience, target, studyId, outcomes, reserve, awaiting, readOnly, paused, update, me } = p
  const needs = needsYou(doc)
  const v = verdict(doc, target, outcomes, reserve, needs.length)
  const fill = targetFill(doc, audience, outcomes)
  const regions = regionMatrix(doc, outcomes)
  const skew = regionSkew(regions.totals, regions.total)
  const dur = durationStats(doc)
  const flow = funnel(doc, outcomes)
  const ledger = slotLedger(doc, target, outcomes)
  const blockedWhy = readOnly ? 'This is sample data. Nothing can be changed.' : paused ? 'Study is paused' : undefined

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
          <p className="mt-2 text-xs text-graphite">{v.basis}</p>
          <SlotLedger ledger={ledger} />
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2" aria-label="Verdict actions">
          {v.level === 'At risk' ? (
            <>
              {/* The reserve first: those people are already screened. Sourcing is for when it isn't enough. */}
              <Button variant="primary" onClick={() => p.goTab('reserve')}>
                Open the reserve
              </Button>
              {blockedWhy ? (
                <Tooltip content={blockedWhy} focusable>
                  <Button variant="secondary" disabled>
                    Source more
                  </Button>
                </Tooltip>
              ) : (
                <Button variant="secondary" to={studyPath(studyId, screenById.R8)}>
                  Source more
                </Button>
              )}
            </>
          ) : (
            v.actions.map((a) => <VerdictButton key={a.label} action={a} blockedWhy={blockedWhy} studyId={studyId} goTab={p.goTab} onInvite={(n) => update((d) => inviteFromReserve(d, me, reserve.slice(0, n)))} />)
          )}
        </div>
      </section>

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
                            {flow.completed.excluded} excluded in review (replacements needed)
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

/** One button from the verdict. Inviting and sourcing are blocked while the study is paused. */
function VerdictButton({ action, blockedWhy, studyId, goTab, onInvite }: { action: VerdictAction; blockedWhy?: string; studyId: string; goTab: (t: string) => void; onInvite: (n: number) => void }) {
  const fills = action.kind === 'invite' || action.kind === 'source'
  const variant = action.kind === 'source' && action.label === 'Source more' ? 'secondary' : 'primary'
  if (fills && blockedWhy)
    return (
      <Tooltip content={blockedWhy} focusable>
        <Button variant={variant} disabled>
          {action.label}
        </Button>
      </Tooltip>
    )
  if (action.kind === 'invite') return <Button variant={variant} onClick={() => onInvite(action.n ?? 0)}>{action.label}</Button>
  if (action.kind === 'source') return <Button variant={variant} to={studyPath(studyId, screenById.R8)}>{action.label}</Button>
  if (action.kind === 'sessions') return <Button variant="primary" onClick={() => goTab('sessions')}>{action.label}</Button>
  if (action.kind === 'needs') return <Button variant="primary" onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{action.label}</Button>
  return <Button variant="primary" to={studyPath(studyId, screenById.R21)}>{action.label}</Button>
}

function NeedsYou({ doc, rows, studyId, me, update, readOnly, blockedWhy }: FWProps & { rows: NeedsRow[]; blockedWhy?: string }) {
  const [all, setAll] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [giving, setGiving] = useState<NeedsRow>()
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(undefined), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const shown = all ? rows : rows.slice(0, FIRST_SHOWN)

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
    } else if (row.action === 'Reschedule') {
      update((d) => rescheduleSession(d, id, me))
      setNotice(`${who} rescheduled.`)
    } else {
      update((d) => assignModerator(d, id, HUMAN_MODERATOR_IDS[0], me))
      setNotice(`Moderator assigned to ${who}.`)
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
          <p className="mt-0.5 text-sm text-graphite">Unfinished sessions only, most urgent first. A stuck participant keeps their slot until you give up on them. Finished interviews are in Review.</p>
        </div>
      </header>
      {notice && (
        <p role="status" className="border-b border-positive-line bg-positive-bg px-5 py-2 text-sm text-positive-fg">
          {notice}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-graphite">Nothing needs you. Everyone unfinished is in progress or waiting on the participant.</p>
      ) : (
        <>
          <ul className="divide-y divide-mist">
            {shown.map((row) => {
              const blocked = why(row)
              return (
                <li key={row.key} className="grid items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5.5rem_auto]">
                  <Link to={r19(studyId, row.session.id)} className="font-medium text-iris-700 hover:underline">
                    <SessionTag participantId={row.session.participantId} no={row.session.no} count={doc.sessions.filter((x) => x.participantId === row.session.participantId).length} />
                  </Link>
                  <span className="min-w-0 text-sm">
                    {row.what}
                    {row.note && (
                      <span data-testid="self-service-note" className="mt-0.5 block text-xs text-graphite">
                        {row.note}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-graphite tabular-nums sm:text-right">{ago(row.since)}</span>
                  <span className="flex flex-wrap gap-2 sm:justify-self-end">
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
                    {row.stuck && !readOnly && (
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
