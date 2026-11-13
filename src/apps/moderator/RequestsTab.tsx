import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { availabilityFor } from '@/mock/moderation'
import { cantTakeRequest, devRaiseRequest, fieldworkNow, participantAnswersProposal, participantCancelsRequest, proposeRequestTime, REQUEST_REASON, scheduleRequest } from '@/state/fieldwork'
import { busyAcross, filterOf, REQUEST_FILTERS, whoHolds, type RequestFilter, type RequestRow, type RequestStatus, canOpenBrief } from '@/state/requests'
import { formatIn, freeSlots } from '@/state/standby'
import { formatStamp } from '@/lib/format'
import { HandoffDrawer } from './Handoff'
import type { useModeratorData } from './Sessions'

type Data = ReturnType<typeof useModeratorData>

const CHIP: Record<RequestStatus, string> = {
  Open: 'border-pending-line bg-pending-bg text-pending-fg',
  'Waiting for participant': 'border-progress-line bg-progress-bg text-progress-fg',
  Scheduled: 'border-positive-line bg-positive-bg text-positive-fg',
  'Taken by someone else': 'border-held-line bg-held-bg text-held-fg',
  'Cancelled by participant': 'border-negative-line bg-negative-bg text-negative-fg',
}
function StatusPill({ r }: { r: RequestRow }) {
  return (
    <span data-testid="rq-status" className={cn('inline-flex items-center rounded-xs border px-2 py-0.5 text-xs font-medium whitespace-nowrap', CHIP[r.status])}>
      {r.status === 'Taken by someone else' ? `Taken by ${whoHolds(r)}` : r.status}
    </span>
  )
}

/** The moderator's time in their own zone, with the participant's local time beside it. */
function Time({ iso, zone, myZone, name }: { iso: string; zone: string; myZone: string; name: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-medium text-ink tabular-nums">{formatIn(iso, myZone)}</span>
      <span className="text-xs text-graphite tabular-nums">
        {name}: {formatIn(iso, zone)}
      </span>
    </span>
  )
}

/**
 * Escalations nobody took live, each with the time the participant suggested. Schedule at it, edit it, or say you can't.
 * A request is an escalation on a session, so the Researcher sees the same record in Fieldwork.
 */
export function RequestsTab({ data, rows }: { data: Data; rows: RequestRow[] }) {
  const { me, all, act } = data
  const toast = useToast()
  const [filter, setFilter] = useState<RequestFilter>('Open')
  const [editing, setEditing] = useState<RequestRow>()
  const [details, setDetails] = useState<RequestRow>()
  const myZone = availabilityFor(me.id).availability.timeZone
  const busy = busyAcross(all, me.id)
  const count = (f: RequestFilter) => rows.filter((r) => filterOf(r.status) === f).length
  const shown = rows.filter((r) => filterOf(r.status) === filter)

  const schedule = (r: RequestRow) => {
    act(r.studyId, (d) => scheduleRequest(d, r.sessionId, me.id, busy))
    toast(`Scheduled with ${r.name} at ${formatIn(r.suggested, myZone)}. It is in Upcoming.`)
  }
  const cant = (r: RequestRow) => {
    act(r.studyId, (d) => cantTakeRequest(d, r.sessionId, me.id))
    toast('Hidden for you. The other standby moderators still see it.')
  }

  return (
    <div className="flex flex-col gap-4" data-testid="requests-tab">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Request status" className="flex rounded-sm border border-mist-strong p-0.5">
          {REQUEST_FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} data-testid={`rq-filter-${f}`} onClick={() => setFilter(f)} className={cn('h-7 rounded-xs px-3 text-sm', filter === f ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
              {f} <span className={cn('tabular-nums', filter === f ? 'text-white/80' : 'text-muted')}>{count(f)}</span>
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-sm text-graphite">Participants who asked to speak with a person and weren’t picked up live. Soonest suggested time first.</p>
      </div>

      {import.meta.env.DEV && <DevStrip data={data} rows={rows} />}

      {shown.length === 0 ? (
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title={filter === 'Open' ? 'No open requests' : filter === 'Scheduled' ? 'Nothing scheduled from a request yet' : 'Nothing closed'} description={filter === 'Open' ? 'When a participant asks for a person and no moderator takes it live, the request appears here with the time they suggested.' : 'Requests you schedule, or that someone else took or the participant cancelled, are listed here.'} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-mist bg-surface">
          <table className="w-full min-w-[60rem] border-collapse text-left text-sm" data-testid="requests-table">
            <thead>
              <tr className="border-b border-mist bg-haze text-xs font-medium text-graphite">
                <th className="px-4 py-2">Participant</th>
                <th className="px-3 py-2">Study</th>
                <th className="px-3 py-2">Language</th>
                <th className="px-3 py-2">AI covered</th>
                <th className="px-3 py-2">Suggested time</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} data-testid="request-row" data-key={r.key} data-participant={r.participantId} data-status={r.status} data-suggested={r.suggested} className="border-b border-mist align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-xs text-graphite tabular-nums">{r.participantId}</span>
                    <span className="mt-0.5 block text-xs text-graphite">Raised {formatStamp(r.raisedAt)}</span>
                  </td>
                  <td className="px-3 py-3">{r.studyName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.language}</td>
                  <td className="max-w-56 px-3 py-3 text-graphite">
                    {r.covered.length ? r.covered.map((c) => `${c.title} (${c.done} of ${c.of})`).join(', ') : 'Nothing yet'}
                    <span className="mt-0.5 block text-xs text-muted">{REQUEST_REASON}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Time iso={r.suggested} zone={r.zone} myZone={myZone} name={r.name} />
                    {r.passed && r.status === 'Open' && <span className="mt-1 block text-xs font-medium text-pending-fg">This time has passed. Edit it to schedule.</span>}
                    {r.proposed && (
                      <span className="mt-1 block text-xs text-graphite tabular-nums" data-testid="rq-proposed">
                        {whoHolds({ ...r, heldBy: r.proposed.by })} proposed {formatIn(r.proposed.slot, myZone)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill r={r} />
                  </td>
                  <td className="px-4 py-3">
                    <Actions r={r} onSchedule={() => schedule(r)} onEdit={() => setEditing(r)} onCant={() => cant(r)} onDetails={() => setDetails(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditTime r={editing} data={data} busy={busy} myZone={myZone} onClose={() => setEditing(undefined)} onSent={(r) => toast(`Email sent to participant: ${r.name} can accept or decline the new time.`)} />
      <Details r={details} myZone={myZone} onClose={() => setDetails(undefined)} />
    </div>
  )
}

function Actions({ r, onSchedule, onEdit, onCant, onDetails }: { r: RequestRow; onSchedule: () => void; onEdit: () => void; onCant: () => void; onDetails: () => void }) {
  // Someone else has it, or the participant cancelled it: nothing to do.
  if (r.status === 'Taken by someone else') return <span className="text-xs text-graphite">No actions</span>
  if (r.status === 'Open')
    return (
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="primary" disabled={!!r.problem} onClick={onSchedule} data-testid="rq-schedule" title={r.problem ?? undefined}>
            Schedule at this time
          </Button>
          <Button size="sm" onClick={onEdit} data-testid="rq-edit">
            Edit time
          </Button>
        </div>
        {r.problem && (
          <p className="max-w-52 text-xs text-pending-fg" data-testid="rq-blocked">
            {r.problem}
          </p>
        )}
        <div className="flex gap-3 text-xs">
          <button type="button" className="font-medium text-graphite hover:underline" onClick={onCant} data-testid="rq-cant">
            Can’t take this
          </button>
          <button type="button" className="font-medium text-iris-700 hover:underline" onClick={onDetails} data-testid="rq-details">
            Details
          </button>
        </div>
      </div>
    )
  return (
    <button type="button" className="text-xs font-medium text-iris-700 hover:underline" onClick={onDetails} data-testid="rq-details">
      Details
    </button>
  )
}

/** A picker of the moderator's own free times, each with the participant's local time beside it. */
function EditTime({ r, data, busy, myZone, onClose, onSent }: { r?: RequestRow; data: Data; busy: ReturnType<typeof busyAcross>; myZone: string; onClose: () => void; onSent: (r: RequestRow) => void }) {
  const { me, act } = data
  const [pick, setPick] = useState<string>()
  const slots = r ? freeSlots({ id: me.id, name: me.name }, fieldworkNow(r.doc), busy).slice(0, 14) : []
  const close = () => {
    setPick(undefined)
    onClose()
  }
  return (
    <Modal
      open={!!r}
      onClose={close}
      title="Edit time"
      size="lg"
      description={r ? `Pick a time you are free. ${r.name} gets an email with the new time and can accept or decline.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!pick}
            data-testid="edit-confirm"
            onClick={() => {
              if (!r || !pick) return
              act(r.studyId, (d) => proposeRequestTime(d, r.sessionId, me.id, pick, busy))
              onSent(r)
              close()
            }}
          >
            Send new time
          </Button>
        </>
      }
    >
      {slots.length === 0 ? (
        <p className="text-sm text-graphite" data-testid="edit-none">
          You have no free time in the next week.
        </p>
      ) : (
        <fieldset>
          <legend className="sr-only">Your free times</legend>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1" role="radiogroup" data-testid="edit-slots">
            {slots.map((s) => (
              <label key={s.start} className={cn('flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-1.5 text-sm', pick === s.start ? 'border-iris-600 bg-iris-50' : 'border-mist hover:bg-haze')}>
                <input type="radio" name="slot" value={s.start} checked={pick === s.start} onChange={() => setPick(s.start)} data-testid="edit-slot" className="accent-[var(--color-iris-600)]" />
                <span className="flex-1 whitespace-nowrap tabular-nums">{formatIn(s.start, myZone)}</span>
                <span className="text-xs whitespace-nowrap text-graphite tabular-nums">
                  {r?.name}: {formatIn(s.start, r!.zone)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </Modal>
  )
}

/** What a moderator needs before saying yes, with the suggested time first. */
function Details({ r, myZone, onClose }: { r?: RequestRow; myZone: string; onClose: () => void }) {
  if (!r) return null
  return (
    <HandoffDrawer open onClose={onClose} title={`${r.name} · ${r.participantId}`} subtitle={`${r.studyName} · ${r.language}`} doc={r.doc} session={r.session}>
      {canOpenBrief(r) && (
        <section>
          <Button size="sm" to={`/moderator/sessions/${r.sessionId}/brief`} data-testid="view-brief">
            View brief
          </Button>
        </section>
      )}
      <section>
        <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Suggested time</h3>
        <p className="mt-1">
          <Time iso={r.suggested} zone={r.zone} myZone={myZone} name={r.name} />
        </p>
      </section>
    </HandoffDrawer>
  )
}

/** Dev only: stands in for the participant and the live escalation until the participant app exists. */
function DevStrip({ data, rows }: { data: Data; rows: RequestRow[] }) {
  const { all, act } = data
  const toast = useToast()
  const waiting = rows.find((r) => r.status === 'Waiting for participant')
  const cancellable = rows.find((r) => r.status === 'Open' || r.status === 'Waiting for participant')
  const create = () => {
    for (const [studyId, doc] of Object.entries(all)) {
      const next = devRaiseRequest(doc)
      if (next) {
        act(studyId, () => next)
        toast('Dev: a live escalation went unanswered and became a request.')
        return
      }
    }
    toast('Dev: no study with standby moderators has a session to use.')
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-mist-strong px-3 py-2" data-testid="dev-strip">
      <Button size="sm" onClick={create} data-testid="dev-create-request">
        Dev: create request
      </Button>
      <Button size="sm" disabled={!waiting} onClick={() => waiting && act(waiting.studyId, (d) => participantAnswersProposal(d, waiting.sessionId, 'Accepted'))} data-testid="dev-accept-time">
        Dev: participant accepts new time
      </Button>
      <Button size="sm" disabled={!waiting} onClick={() => waiting && act(waiting.studyId, (d) => participantAnswersProposal(d, waiting.sessionId, 'Declined'))} data-testid="dev-decline-time">
        Dev: participant declines new time
      </Button>
      <Button size="sm" disabled={!cancellable} onClick={() => cancellable && act(cancellable.studyId, (d) => participantCancelsRequest(d, cancellable.sessionId))} data-testid="dev-cancel-request">
        Dev: participant cancels
      </Button>
    </div>
  )
}
