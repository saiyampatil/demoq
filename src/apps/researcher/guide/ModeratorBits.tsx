import { Button } from '@/components/Button'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { isLegacyRequest, type TeamMember } from '@/state/guide'
import { activateTeamPerson } from '@/state/teamModerators'

/**
 * Dev only. Stands in for the person accepting their emailed invitation: they become Active in the team list, and every
 * study they are on counts them. It is not in the production build.
 */
export function DevAcceptInvite({ teamId, onAccept }: { teamId?: string; onAccept?: () => void }) {
  const toast = useToast()
  if (!import.meta.env.DEV) return null
  return (
    <Button
      size="sm"
      variant="ghost"
      data-testid="dev-accept-invite"
      onClick={() => {
        if (teamId) activateTeamPerson(teamId)
        else onAccept?.()
        toast('Dev: invitation accepted.')
      }}
    >
      Dev: accept invite
    </Button>
  )
}

/** The status cell of a moderator row. Anyone who counts reads "Added" (stored as Accepted). */
export function MemberStatus({ t }: { t: TeamMember }) {
  return (
    <div>
      <StatusChip status={t.status === 'Accepted' ? 'Added' : t.status} size="sm" />
      {t.status === 'Invited' && <span className="mt-0.5 block text-xs text-graphite">Counts once they accept</span>}
      {isLegacyRequest(t) && (
        <span className="mt-0.5 block max-w-56 text-xs font-medium text-pending-fg" data-testid="legacy-note">
          From before requests were removed. Remove and add them again.
        </span>
      )}
    </div>
  )
}
