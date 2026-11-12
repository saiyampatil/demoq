import { useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextArea } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { EmptyState } from '@/components/States'
import { availabilityFor } from '@/mock/moderation'
import { participantName } from '@/mock/participants'
import { fieldworkNow, participantZone, planItems, requestReassign } from '@/state/fieldwork'
import { completedFor, submittedFor, upcomingFor, type SessionRow } from '@/state/requests'
import { formatIn } from '@/state/standby'
import { formatStamp } from '@/lib/format'
import type { useModeratorData } from './Sessions'

type Data = ReturnType<typeof useModeratorData>

const Box = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-md border border-mist bg-surface">{children}</div>

/** Where the AI stopped, and what a moderator resuming it will not ask again. */
function resumeLine(row: SessionRow) {
  const { session: s, doc } = row
  const items = planItems(doc.plan)
  const last = [...items].reverse().find((i) => s.asked.includes(i.id))
  return `${s.asked.length} ${s.asked.length === 1 ? 'question' : 'questions'} already asked${last ? `, the last being “${last.text}”` : ''} Resumes with an opening that picks up there, with no repeats.`
}

/** How early a moderator can join before the booked time. */
const JOIN_BEFORE_MIN = 10

/**
 * Booked sessions, soonest first. Join interview opens ten minutes before the slot (the console arrives later, so it opens a
 * placeholder). Can't make it, in the row menu, asks the study's Researcher to reassign and says why.
 */
export function UpcomingTab({ data }: { data: Data }) {
  const { me, all, studyName, act } = data
  const toast = useToast()
  const rows = upcomingFor(all, me.id)
  const myZone = availabilityFor(me.id).availability.timeZone
  const [menu, setMenu] = useState<string>()
  const [cant, setCant] = useState<SessionRow>()
  const [why, setWhy] = useState('')
  if (rows.length === 0)
    return (
      <Box>
        <EmptyState title="No upcoming sessions" description="Sessions you book, including ones you schedule from a request, are listed here." />
      </Box>
    )
  return (
    <Box>
      <ul className="divide-y divide-mist" data-testid="upcoming-list">
        {rows.map((r) => {
          const slotMs = new Date(r.session.slot!).getTime()
          const nowMs = new Date(fieldworkNow(r.doc)).getTime()
          const minutes = Math.ceil((slotMs - nowMs) / 60000)
          const canJoin = minutes <= JOIN_BEFORE_MIN
          const asked = r.session.reassign
          return (
            <li key={r.key} data-testid="upcoming-row" data-session={r.session.id} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-5 py-3.5">
              <div className="min-w-44">
                <p className="font-medium tabular-nums">{formatIn(r.session.slot!, myZone)}</p>
                <p className="text-xs text-graphite tabular-nums">
                  {participantName(r.session.participantId)}: {formatIn(r.session.slot!, participantZone(r.session))}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{participantName(r.session.participantId)}</span>
                  <span className="text-xs text-graphite tabular-nums">{r.session.participantId}</span>
                  {r.session.escalation && (
                    <span data-testid="continued-tag" className="rounded-xs border border-iris-100 bg-iris-50 px-1.5 py-0.5 text-xs font-medium text-iris-700">
                      Continued from AI
                    </span>
                  )}
                  {asked && (
                    <span data-testid="reassign-tag" className="rounded-xs border border-pending-line bg-pending-bg px-1.5 py-0.5 text-xs font-medium text-pending-fg">
                      You asked for someone else
                    </span>
                  )}
                </p>
                <p className="text-xs text-graphite">{studyName(r.studyId)}</p>
                {r.session.escalation && <p className="mt-1 text-xs text-graphite">{resumeLine(r)}</p>}
                {asked && <p className="mt-1 text-xs text-graphite">Sent to the Researcher: “{asked.reason}”. Until they reassign it, the session is still yours.</p>}
              </div>
              <div className="flex items-start gap-1.5">
                {canJoin ? (
                  <Button size="sm" variant="primary" to={`/moderator/sessions/${r.session.id}/console`} data-testid="join-interview">
                    Join interview
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" disabled title={`Opens ${JOIN_BEFORE_MIN} minutes before the slot`} data-testid="join-interview">
                    Join interview
                  </Button>
                )}
                <div className="relative">
                  <Button size="sm" aria-haspopup="menu" aria-expanded={menu === r.key} aria-label={`More for ${r.session.participantId}`} data-testid="row-menu" onClick={() => setMenu(menu === r.key ? undefined : r.key)}>
                    ⋯
                  </Button>
                  {menu === r.key && (
                    <ul role="menu" className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-sm border border-mist bg-surface py-1 shadow-md">
                      <li role="none">
                        <button
                          role="menuitem"
                          type="button"
                          data-testid="cant-make-it"
                          disabled={!!asked}
                          title={asked ? 'Already sent to the Researcher' : undefined}
                          onClick={() => {
                            setMenu(undefined)
                            setWhy('')
                            setCant(r)
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-haze disabled:opacity-50"
                        >
                          Can’t make it
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <Modal
        open={!!cant}
        onClose={() => setCant(undefined)}
        title="Can’t make it?"
        description={cant ? `This asks the Researcher on ${studyName(cant.studyId)} to find someone else for ${participantName(cant.session.participantId)}. Say why, so they can decide.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCant(undefined)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!why.trim()}
              data-testid="reassign-send"
              onClick={() => {
                if (!cant) return
                act(cant.studyId, (d) => requestReassign(d, cant.session.id, me.id, why))
                toast('Sent to the Researcher. They will assign someone else.')
                setCant(undefined)
              }}
            >
              Send to the Researcher
            </Button>
          </>
        }
      >
        <TextArea label="Why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="A clash I can’t move." />
      </Modal>
    </Box>
  )
}

function Ended({ rows, empty, note }: { rows: SessionRow[]; empty: { title: string; description: string }; note: (r: SessionRow) => string }) {
  if (rows.length === 0)
    return (
      <Box>
        <EmptyState title={empty.title} description={empty.description} />
      </Box>
    )
  return (
    <Box>
      <ul className="divide-y divide-mist">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-baseline gap-x-6 px-5 py-3">
            <span className="min-w-44 font-medium">
              {participantName(r.session.participantId)} <span className="text-xs font-normal text-graphite tabular-nums">{r.session.participantId}</span>
            </span>
            <span className="text-sm text-graphite">{r.doc.studyId}</span>
            <span className="ml-auto text-xs text-graphite">{note(r)}</span>
          </li>
        ))}
      </ul>
    </Box>
  )
}

export function CompletedTab({ data }: { data: Data }) {
  return <Ended rows={completedFor(data.all, data.me.id)} empty={{ title: 'No interviews waiting for notes', description: 'Interviews you finish appear here until you submit your notes.' }} note={(r) => `Ended ${formatStamp(r.session.events[r.session.events.length - 1]?.at ?? '')}. Notes not submitted yet.`} />
}

export function SubmittedTab({ data }: { data: Data }) {
  return <Ended rows={submittedFor(data.all, data.me.id)} empty={{ title: 'No notes submitted yet', description: 'Interviews whose notes you submitted are listed here.' }} note={(r) => `Notes submitted ${formatStamp(r.session.notes!.at)}`} />
}
