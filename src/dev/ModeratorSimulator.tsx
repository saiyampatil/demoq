import { Button } from '@/components/Button'
import { StatusChip } from '@/components/StatusChip'
import { confirmAssignments, setMemberStatus, teamOf, type GuideDoc } from '@/state/guide'

/**
 * Dev-only. Stands in for the people who answer an invitation, and for PulseAI, until the Moderator dashboard exists.
 * With the moderator setup (R12) open, these controls act on the people listed there. They never make a guide version.
 */
export function ModeratorSimulator({ doc, update }: { doc: GuideDoc; update: (fn: (d: GuideDoc) => GuideDoc) => void }) {
  if (doc.moderator.mode !== 'human') return null
  const team = teamOf(doc.moderator)
  const waiting = team.filter((t) => t.status === 'Invited' || t.status === 'Requested')
  const requests = team.filter((t) => t.assign && t.status === 'Requested')
  return (
    <section className="border-b border-mist px-4 py-3" aria-label="Moderators">
      <h3 className="text-sm font-semibold">Moderator invitations</h3>
      <p className="text-xs text-graphite">Stands in for the people who answer, and for PulseAI, until the Moderator dashboard is built.</p>
      {waiting.length === 0 && requests.length === 0 && <p className="mt-2 text-xs text-graphite">Nobody is waiting to answer.</p>}
      {requests.length > 0 && (
        <Button size="sm" className="mt-2" data-testid="sim-pulseai-confirms" onClick={() => update((d) => confirmAssignments(d))}>
          Simulate: PulseAI confirms assignment
        </Button>
      )}
      <ul className="mt-2 flex flex-col gap-1.5">
        {waiting
          .filter((t) => !t.assign)
          .map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <StatusChip status={t.status} size="sm" />
              <Button size="sm" data-testid="sim-accept" onClick={() => update((d) => setMemberStatus(d, t.id, 'Accepted'))}>
                Accept
              </Button>
              <Button size="sm" data-testid="sim-decline" onClick={() => update((d) => setMemberStatus(d, t.id, 'Declined'))}>
                Decline
              </Button>
            </li>
          ))}
      </ul>
    </section>
  )
}
