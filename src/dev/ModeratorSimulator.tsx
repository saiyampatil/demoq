import { Button } from '@/components/Button'
import { StatusChip } from '@/components/StatusChip'
import { setMemberStatus, standbyOf, teamOf, type GuideDoc } from '@/state/guide'
import { activateTeamPerson, resetTeamModerators, useTeamModerators } from '@/state/teamModerators'

/**
 * Dev-only. Stands in for the people who accept an emailed invitation, until the Moderator dashboard exists.
 * Accepting a person from the team list makes them Active, so every study they are on counts them. It never makes a guide version.
 * Nothing here simulates PulseAI: its moderators are added at once, so there is nothing to confirm.
 */
export function ModeratorSimulator({ doc, update }: { doc: GuideDoc; update: (fn: (d: GuideDoc) => GuideDoc) => void }) {
  // Re-renders when someone accepts.
  useTeamModerators()
  if (!doc.moderator.mode) return null
  // In an AI-led study the people listed are the standby moderators.
  const team = doc.moderator.mode === 'ai' ? standbyOf(doc.moderator) : teamOf(doc.moderator)
  const waiting = team.filter((t) => t.status === 'Invited')
  return (
    <section className="border-b border-mist px-4 py-3" aria-label="Moderators">
      <h3 className="text-sm font-semibold">{doc.moderator.mode === 'ai' ? 'Standby moderator invitations' : 'Moderator invitations'}</h3>
      <p className="text-xs text-graphite">Stands in for the people who answer an invitation, until the Moderator dashboard is built.</p>
      {waiting.length === 0 && <p className="mt-2 text-xs text-graphite">Nobody is waiting to accept.</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {waiting.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            <StatusChip status="Invited" size="sm" />
            <Button
              size="sm"
              data-testid="sim-accept"
              onClick={() => (t.teamId ? activateTeamPerson(t.teamId) : update((d) => setMemberStatus(d, t.id, 'Accepted')))}
            >
              Accept
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" className="mt-2" data-testid="sim-reset-team" onClick={resetTeamModerators}>
        Reset the team list
      </Button>
    </section>
  )
}
