import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { Tooltip } from '@/components/Tooltip'
import { assignEscalation, assignModerator, giveUp, resendLink, retrySession, sendBookingLink, sendRescheduleLink, type FieldworkDoc } from '@/state/fieldwork'
import { moderatorRoster, supportReport, type NeedsRow } from '@/state/selectors'

/**
 * The recovery actions for one session, in one row under the header. They are the ones Needs you offers for the same
 * session, so the two places agree, and the row is empty (nothing is drawn) when none apply.
 */
export function SessionActions({ doc, row, me, update, blockedWhy }: { doc: FieldworkDoc; row: NeedsRow; me: string; update: (fn: (d: FieldworkDoc) => FieldworkDoc) => void; blockedWhy?: string }) {
  const toast = useToast()
  const [giving, setGiving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [pick, setPick] = useState('')
  const [reason, setReason] = useState('')
  const id = row.session.id
  const who = row.who
  const roster = moderatorRoster(doc)
  // Sending a link or giving up changes who is invited, so a paused study blocks both. Copying a report doesn't.
  const gate = (node: React.ReactNode, blocked: string | undefined) =>
    blocked ? (
      <Tooltip content={blocked} focusable>
        <span>{node}</span>
      </Tooltip>
    ) : (
      node
    )

  const run = () => {
    if (row.kind === 'reassign') {
      setPick('')
      setAssigning(true)
    } else if (row.action === 'Resend link' || row.action === 'Resume') {
      update((d) => resendLink(d, id, me))
      toast(row.action === 'Resume' ? `Resume link sent to ${who}.` : `Link resent to ${who}.`)
    } else if (row.action === 'Reissue link') {
      update((d) => resendLink(d, id, me))
      toast(`A new link was sent to ${who}.`)
    } else if (row.action === 'Retry') {
      update((d) => retrySession(d, id, me))
      toast(`Retry link sent to ${who}. A new session was created.`)
    } else if (row.action === 'Send booking link') {
      update((d) => sendRescheduleLink(d, id, me))
      toast(`Booking link sent to ${who}. The reschedule is free.`)
    } else if (row.action === 'Copy report for support') {
      void navigator.clipboard?.writeText(supportReport(doc, row)).catch(() => undefined)
      toast(`Report for ${who} copied. Paste it to support.`)
    }
  }
  const confirmGiveUp = () => {
    if (!reason.trim()) return
    update((d) => giveUp(d, id, reason, me))
    toast(`Gave up on ${who}. Their slot is open.`)
    setGiving(false)
    setReason('')
  }
  const blocked = row.invites || row.kind === 'escalation' ? blockedWhy : undefined
  const escalation = row.kind === 'escalation'

  return (
    <div role="group" aria-label="Recovery actions" data-testid="session-actions" className="flex flex-wrap items-center gap-2">
      {escalation ? (
        <>
          {gate(<Button variant="primary" disabled={!!blocked} data-testid="assign-moderator" onClick={() => { setPick(''); setAssigning(true) }}>Assign moderator</Button>, blocked)}
          {gate(
            <Button
              disabled={!!blocked}
              data-testid="send-booking-link"
              onClick={() => {
                update((d) => sendBookingLink(d, id, me))
                toast(`Booking link sent to ${who}. They’ll book a human follow-up.`)
              }}
            >
              Send booking link
            </Button>,
            blocked,
          )}
        </>
      ) : (
        gate(
          <Button variant="primary" disabled={!!blocked} onClick={run}>
            {row.action}
          </Button>,
          blocked,
        )
      )}
      {row.giveUp &&
        gate(
          <Button variant="ghost" disabled={!!blockedWhy} onClick={() => setGiving(true)}>
            Give up and replace
          </Button>,
          blockedWhy,
        )}

      <Modal
        open={giving}
        onClose={() => {
          setGiving(false)
          setReason('')
        }}
        title={`Give up on ${who} and replace them?`}
        description="Their slot opens again, so the gap grows by one and the reserve can fill it. Their data and session record are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setGiving(false); setReason('') }}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!reason.trim()} onClick={confirmGiveUp}>
              Give up and open the slot
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-graphite">{row.what} The reason is logged with your name and the time.</p>
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <Modal
        open={assigning}
        onClose={() => setAssigning(false)}
        title={`Assign a moderator to ${who}`}
        description="Pick who takes this participant. They are notified whatever their state, even if they aren’t on standby. Nobody is picked for you."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!pick}
              data-testid="confirm-assign"
              onClick={() => {
                update((d) => (row.kind === 'reassign' ? assignModerator(d, id, pick, me) : assignEscalation(d, id, pick, me)))
                toast(`${roster.find((m) => m.id === pick)?.name} was notified about ${who}.`)
                setAssigning(false)
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
    </div>
  )
}
