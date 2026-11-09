import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { formatDateTime } from '@/lib/format'
import { coverage, hoursIn, resendMember, setMemberStatus, teamOf, type GuideDoc, type ModSource } from '@/state/guide'
import { removeFrom } from '@/state/moderatorAssign'
import { resendTeamInvite, useTeamModerators } from '@/state/teamModerators'
import { DevAcceptInvite, MemberStatus } from './ModeratorBits'
import { ModeratorOptions } from './ModeratorOptions'

const SOURCE_LABEL: Record<ModSource, string> = { Myself: 'Myself', PulseAI: 'PulseAI', 'My team': 'My team' }

type Props = {
  doc: GuideDoc
  me: string
  /** The study language, from the brief. Null until the brief gives one. */
  language: string | null
  /** Edits the setup, so on an approved guide it makes a new version like any other edit. */
  update: (fn: (d: GuideDoc) => GuideDoc) => void
  /** Interviews the study needs, and weeks in its fieldwork window, for the coverage line. */
  interviews: number | null
  weeks: number
}

/**
 * R12, human moderator. Three plain options that can be combined, one list of who is on the study and where they stand,
 * and one line on whether the people who count cover it. Nothing is requested: people are added at once, and only a new
 * person from the team list waits (as Invited) for their own acceptance.
 */
export function HumanModerators({ doc, me, language, update, interviews, weeks }: Props) {
  const m = doc.moderator
  // Re-renders when someone accepts, so the table and the coverage line follow the team list.
  useTeamModerators()
  const team = teamOf(m)
  const toast = useToast()
  const cover = coverage(m, interviews, weeks)
  const invited = team.filter((t) => t.status === 'Invited').length

  return (
    <div className="flex flex-col gap-6" data-testid="human-moderators">
      <ModeratorOptions
        where="team"
        doc={doc}
        me={me}
        language={language}
        update={update}
        heading="Who will moderate?"
        intro="Pick one or combine them. People are added at once. Someone you invite counts toward booking and coverage once they accept."
        myself={{ title: 'I’ll moderate', text: 'Best if you’ve run interviews before.' }}
        pulse={{ title: 'PulseAI moderators', text: 'Trained moderators from the PulseAI team. Recommended if you’re new to interviews.', panelTitle: 'PulseAI moderators' }}
        team={{ text: 'Pick colleagues from your company’s list, or add someone new. They use the Moderator dashboard and see only their own sessions.' }}
      />

      <Card title="Selected moderators" description="Everyone on this study, and whether they count yet." flush>
        {team.length === 0 ? (
          <EmptyState title="No moderators yet" description="Choose an option above. You need at least one to continue, and one who counts before launch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" data-testid="moderator-table">
              <caption className="sr-only">Selected moderators</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Name', 'Source', 'Status', 'Hours available', ''].map((h, i) => (
                    <th key={i} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((t) => (
                  <tr key={t.id} className="border-b border-mist last:border-0" data-testid="moderator-row" data-status={t.status}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {t.name}
                      {t.email && <span className="block text-xs font-normal text-graphite">{t.email}</span>}
                      {t.status === 'Invited' && t.sentAt && <span className="block text-xs font-normal text-graphite">Invited {formatDateTime(t.sentAt)}</span>}
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap">{SOURCE_LABEL[t.source]}</td>
                    <td className="px-4 py-3">
                      <MemberStatus t={t} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{t.status === 'Accepted' ? `${hoursIn(t, weeks)} h` : <span className="text-graphite">Not counted yet</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status === 'Invited' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (t.teamId) resendTeamInvite(t.teamId)
                              else update((d) => resendMember(d, t.id))
                              toast(`Invitation sent again to ${t.email ?? t.name}.`)
                            }}
                          >
                            Resend invitation
                          </Button>
                          <DevAcceptInvite teamId={t.teamId} onAccept={() => update((d) => setMemberStatus(d, t.id, 'Accepted'))} />
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => update((d) => removeFrom(d, me, 'team', t.id))} aria-label={`Remove ${t.name}`}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={cn('border-t border-mist px-5 py-3 text-sm tabular-nums', cover.short || cover.accepted === 0 ? 'bg-pending-bg text-pending-fg' : 'text-graphite')} data-testid="coverage-line">
          {cover.accepted === 0 ? 'No one counts yet. ' : `Added moderators have ${cover.available} hours available. `}
          {cover.needed > 0 ? `You need about ${cover.needed} (${cover.interviews} interviews × ${m.durationMin} min).` : 'Set the number of interviews in the audience to see how many hours you need.'}
          {cover.short && cover.accepted > 0 && ' Add more moderators, or wait for the people you invited.'}
          {invited > 0 && ` ${invited} invited ${invited === 1 ? 'person has' : 'people have'} not accepted yet and ${invited === 1 ? 'isn’t' : 'aren’t'} counted.`}
        </p>
      </Card>
    </div>
  )
}
