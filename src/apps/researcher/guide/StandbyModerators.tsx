import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { availabilityText } from '@/mock/moderation'
import { acceptedStandby, removeStandby, requestStandbyPulse, requestStandbyRoster, resendStandby, standbyOf, type GuideDoc } from '@/state/guide'
import { PulseModeratorPicker } from './PulseModeratorPicker'

type Props = {
  doc: GuideDoc
  me: string
  /** The study language, from the brief. Null until the brief gives one. */
  language: string | null
  /** Edits the setup, so on an approved guide it makes a new version like any other edit. */
  update: (fn: (d: GuideDoc) => GuideDoc) => void
}

/**
 * R12, AI-led. Optional PulseAI moderators on standby: a participant who asks to talk to a person books a time with one
 * of them. The Researcher only asks for them; PulseAI confirms. They never run the study's interviews.
 */
export function StandbyModerators({ doc, me, language, update }: Props) {
  const toast = useToast()
  const list = standbyOf(doc.moderator)
  const accepted = acceptedStandby(doc.moderator).length

  return (
    <div className="flex flex-col gap-4" data-testid="standby-moderators">
      <PulseModeratorPicker
        title="Standby human moderators"
        description="Optional. If a participant asks to talk to a person during an AI interview, they book a time with one of these moderators. Leave it empty and participants aren’t offered a human."
        language={language}
        asked={list}
        onAssign={(count) => update((d) => requestStandbyPulse(d, me, count, language ?? ''))}
        onRequest={(id) => update((d) => requestStandbyRoster(d, me, id, language ?? ''))}
      />

      {list.length > 0 && (
        <Card title="On standby" description="Everyone you asked, and where they stand." flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" data-testid="standby-table">
              <caption className="sr-only">Standby moderators</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Name', 'Language', 'Availability', 'Status', ''].map((h, i) => (
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
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap">{t.language}</td>
                    <td className="px-4 py-3 text-graphite">{t.assign ? 'Set when PulseAI confirms' : (availabilityText(t.rosterId) ?? '—')}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={t.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status !== 'Accepted' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            update((d) => resendStandby(d, t.id))
                            toast(`Request sent again to ${t.name}.`)
                          }}
                        >
                          Resend
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => update((d) => removeStandby(d, me, t.id))} aria-label={`Remove ${t.name}`}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-mist px-5 py-3 text-sm text-graphite" data-testid="standby-line">
            {accepted > 0 ? `${accepted} accepted. Only accepted moderators are offered to participants.` : 'None has accepted yet, so participants aren’t offered a human until one does.'}
          </p>
        </Card>
      )}
    </div>
  )
}
