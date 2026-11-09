import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { useToast } from '@/components/Toast'
import { availabilityText } from '@/mock/moderation'
import { acceptedStandby, resendStandby, setMemberStatus, standbyOf, type GuideDoc, type ModSource } from '@/state/guide'
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
}

/**
 * R12, AI-led. Optional moderators on standby: a participant who asks to talk to a person books a time with one of them.
 * The same three options and rules as a human-led study. Standby people never run the study's interviews.
 */
export function StandbyModerators({ doc, me, language, update }: Props) {
  const toast = useToast()
  // Re-renders when someone accepts, so the table and the line below follow the team list.
  useTeamModerators()
  const list = standbyOf(doc.moderator)
  const counted = acceptedStandby(doc.moderator).length
  const invited = list.filter((t) => t.status === 'Invited').length

  return (
    <div className="flex flex-col gap-4" data-testid="standby-moderators">
      <ModeratorOptions
        where="standby"
        doc={doc}
        me={me}
        language={language}
        update={update}
        heading="Standby human moderators"
        intro="Optional. If a participant asks to talk to a person during an AI interview, they book a time with one of these moderators. Leave it empty and participants aren’t offered a human."
        myself={{ title: 'I’ll be on standby', text: 'Take the participants who ask for a person yourself.' }}
        pulse={{ title: 'PulseAI moderators', text: 'Trained moderators from the PulseAI team, ready for participants who ask.', panelTitle: 'PulseAI moderators on standby' }}
        team={{ text: 'Pick colleagues from your company’s list, or add someone new. They see only the sessions booked with them.' }}
      />

      {list.length > 0 && (
        <Card title="On standby" description="Everyone on standby for this study, and whether they count yet." flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" data-testid="standby-table">
              <caption className="sr-only">Standby moderators</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Name', 'Source', 'Availability', 'Status', ''].map((h, i) => (
                    <th key={i} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-mist last:border-0" data-testid="standby-row" data-status={t.status}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {t.name}
                      {t.email && <span className="block text-xs font-normal text-graphite">{t.email}</span>}
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap">{SOURCE_LABEL[t.source]}</td>
                    <td className="px-4 py-3 text-graphite">{t.assign ? '—' : (availabilityText(t.rosterId) ?? 'Set in the Moderator app')}</td>
                    <td className="px-4 py-3">
                      <MemberStatus t={t} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status === 'Invited' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (t.teamId) resendTeamInvite(t.teamId)
                              else update((d) => resendStandby(d, t.id))
                              toast(`Invitation sent again to ${t.email ?? t.name}.`)
                            }}
                          >
                            Resend invitation
                          </Button>
                          <DevAcceptInvite teamId={t.teamId} onAccept={() => update((d) => setMemberStatus(d, t.id, 'Accepted'))} />
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => update((d) => removeFrom(d, me, 'standby', t.id))} aria-label={`Remove ${t.name}`}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-mist px-5 py-3 text-sm text-graphite" data-testid="standby-line">
            {counted > 0 ? `${counted} added. Only people who count are offered to participants.` : 'No one counts yet, so participants aren’t offered a human until someone does.'}
            {invited > 0 && ` ${invited} invited ${invited === 1 ? 'person has' : 'people have'} not accepted yet and ${invited === 1 ? 'isn’t' : 'aren’t'} counted.`}
          </p>
        </Card>
      )}
    </div>
  )
}
