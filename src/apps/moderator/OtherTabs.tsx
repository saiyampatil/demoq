import { EmptyState } from '@/components/States'
import { availabilityText, availabilityFor } from '@/mock/moderation'
import { participantName } from '@/mock/participants'
import { fieldworkNow, participantZone, planItems } from '@/state/fieldwork'
import { availabilityFor7, completedFor, submittedFor, upcomingFor, type SessionRow } from '@/state/requests'
import { formatIn } from '@/state/standby'
import { formatStamp } from '@/lib/format'
import { cn } from '@/components/cn'
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

/** Booked sessions, soonest first. A session continued from the AI after a request carries a tag and where it resumes. */
export function UpcomingTab({ data }: { data: Data }) {
  const { me, all, studyName } = data
  const rows = upcomingFor(all, me.id)
  const myZone = availabilityFor(me.id).availability.timeZone
  if (rows.length === 0)
    return (
      <Box>
        <EmptyState title="No upcoming sessions" description="Sessions you book, including ones you schedule from a request, are listed here." />
      </Box>
    )
  return (
    <Box>
      <ul className="divide-y divide-mist" data-testid="upcoming-list">
        {rows.map((r) => (
          <li key={r.key} data-testid="upcoming-row" data-session={r.session.id} className="flex flex-wrap items-start gap-x-6 gap-y-1 px-5 py-3.5">
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
              </p>
              <p className="text-xs text-graphite">{studyName(r.studyId)}</p>
              {r.session.escalation && <p className="mt-1 text-xs text-graphite">{resumeLine(r)}</p>}
            </div>
          </li>
        ))}
      </ul>
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

/** The next week of the moderator's own hours: each free time, and each one booked or held for a participant. */
export function AvailabilityTab({ data }: { data: Data }) {
  const { me, all } = data
  // The prototype's clock for this moderator: the latest of the studies they can be booked in.
  const now = Object.values(all).map((d) => fieldworkNow(d)).sort().pop() ?? new Date().toISOString()
  const { availability: a } = availabilityFor(me.id)
  const items = availabilityFor7(all, me.id, now)
  const day = new Intl.DateTimeFormat('en-US', { timeZone: a.timeZone, weekday: 'long', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-US', { timeZone: a.timeZone, hour: 'numeric', minute: '2-digit' })
  const groups = new Map<string, typeof items>()
  items.forEach((i) => groups.set(day.format(new Date(i.start)), [...(groups.get(day.format(new Date(i.start))) ?? []), i]))
  return (
    <div className="flex flex-col gap-4" data-testid="availability-tab">
      <p className="text-sm text-graphite">
        Your hours: <span className="font-medium text-ink">{availabilityText(me.id).text}</span>. Participants who ask for a person can be booked into the free times. A time you schedule or propose is held here.
      </p>
      {items.length === 0 ? (
        <Box>
          <EmptyState title="No free times this week" description="Nothing in your hours is open in the next seven days." />
        </Box>
      ) : (
        <Box>
          <div className="divide-y divide-mist">
            {[...groups.entries()].map(([d, list]) => (
              <section key={d} className="px-5 py-3">
                <h3 className="text-sm font-semibold">{d}</h3>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {list.map((i) => (
                    <li key={`${i.start}${i.kind}`} data-testid="avail-slot" data-kind={i.kind} className={cn('rounded-sm border px-2.5 py-1 text-xs tabular-nums', i.kind === 'free' ? 'border-mist text-graphite' : i.kind === 'booked' ? 'border-iris-600 bg-iris-50 font-medium text-iris-700' : 'border-pending-line bg-pending-bg font-medium text-pending-fg')}>
                      {time.format(new Date(i.start))} · {i.label}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Box>
      )}
    </div>
  )
}
