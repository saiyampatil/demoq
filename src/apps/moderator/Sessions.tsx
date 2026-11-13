import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { cn } from '@/components/cn'
import { useStudies } from '@/state/StudyContext'
import { completedFor, openCount, requestsFor, scopeDocs, submittedFor, upcomingFor } from '@/state/requests'
import { activateTeamPerson } from '@/state/teamModerators'
import { Button } from '@/components/Button'
import { devTriggerEscalation, type FieldworkDoc } from '@/state/fieldwork'
import { useToast } from '@/components/Toast'
import { PageHeader } from '../shared/PageHeader'
import { AvailabilityEditor } from './AvailabilityEditor'
import { LiveCards } from './LiveCards'
import { CompletedTab, SubmittedTab, UpcomingTab } from './OtherTabs'
import { RequestsTab } from './RequestsTab'
import { useModerator } from './useModerator'

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'requests', label: 'Requests' },
  { key: 'completed', label: 'Completed' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'availability', label: 'Availability' },
] as const
type Tab = (typeof TABS)[number]['key']

/**
 * What every tab reads: the moderator, and the fieldwork records they may see. A PulseAI moderator sees every client's, a
 * team moderator only their own company's studies, and someone who hasn't accepted their invitation none.
 */
export function useModeratorData() {
  const { fieldworks, updateFieldwork, studies, getLanguage } = useStudies()
  const { me } = useModerator()
  const studyName = (id: string) => studies.find((s) => s.id === id)?.name ?? id
  const act = (studyId: string, fn: (d: FieldworkDoc) => FieldworkDoc) => updateFieldwork(studyId, fn)
  const all = scopeDocs(fieldworks, me, (id) => studies.find((s) => s.id === id)?.client)
  return { me, all, act, studyName, language: getLanguage }
}

/** Dev only: starts a live escalation so the pinned card shows. It offers the session to the standby moderators of the first study this moderator is on standby for. */
function DevBar({ data }: { data: ReturnType<typeof useModeratorData> }) {
  const { me, all, act } = data
  const toast = useToast()
  return (
    <div className="flex items-center gap-2 rounded-sm border border-dashed border-mist-strong px-3 py-2">
      <Button
        size="sm"
        data-testid="dev-trigger-escalation"
        onClick={() => {
          for (const [studyId, doc] of Object.entries(all)) {
            if (!doc.plan.escalation?.moderators.some((m) => m.id === me.id)) continue
            const next = devTriggerEscalation(doc)
            if (next) {
              act(studyId, () => next)
              toast('Dev: a participant asked for a person. The card is pinned for the standby moderators.')
              return
            }
          }
          toast('Dev: no study you are on standby for has a session to use.')
        }}
      >
        Dev: trigger escalation
      </Button>
      <span className="text-xs text-graphite">Shows the pinned live card, offered at once to every online standby moderator.</span>
    </div>
  )
}

/** Someone invited as a team moderator who hasn't accepted yet: the invitation is all there is. */
function InviteGate({ data }: { data: ReturnType<typeof useModeratorData> }) {
  const { me } = data
  return (
    <div className="flex flex-col gap-6" data-testid="invite-gate">
      <PageHeader id="M1" title="Accept your invitation" description={`You were invited to moderate for ${me.company ?? 'a research team'}. Accept to see your sessions, take requests and set your hours.`} />
      <div className="max-w-xl rounded-md border border-mist bg-surface p-5">
        <p className="text-sm">
          The invitation was sent to <span className="font-medium">{me.email}</span>. Open the link in that email to accept. Until you do, nothing else is available to you.
        </p>
        {import.meta.env.DEV && (
          <Button className="mt-4" size="sm" data-testid="dev-accept-invite" onClick={() => activateTeamPerson(me.id)}>
            Dev: accept the invitation
          </Button>
        )}
      </div>
    </div>
  )
}

/** M1: the moderator's own sessions, the requests they can take, and when they are free. */
export function ModeratorSessions() {
  const data = useModeratorData()
  if (data.me.kind === 'invited') return <InviteGate data={data} />
  return <SessionsTabs data={data} />
}

function SessionsTabs({ data }: { data: ReturnType<typeof useModeratorData> }) {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'upcoming') as Tab
  const { me, all, studyName, language } = data

  const requests = useMemo(() => requestsFor(all, me.id, studyName, language), [all, me.id, studyName, language])
  const counts: Partial<Record<Tab, number>> = {
    upcoming: upcomingFor(all, me.id).length,
    requests: openCount(requests),
    completed: completedFor(all, me.id).length,
    submitted: submittedFor(all, me.id).length,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="M1" title="My sessions" description="The interviews you have booked, the requests from participants who asked to speak with a person, and the times you are free." />
      {import.meta.env.DEV && <DevBar data={data} />}
      <LiveCards data={data} />
      <div>
        <div role="tablist" aria-label="My sessions" className="flex gap-1 border-b border-mist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`mtab-${t.key}`}
              data-testid={`mtab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="mpanel"
              onClick={() => setParams((p) => (t.key === 'upcoming' ? p.delete('tab') : p.set('tab', t.key), p), { replace: true })}
              className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
            >
              {t.label}
              {counts[t.key] !== undefined && (
                <span data-testid={`mcount-${t.key}`} className={cn('inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums', t.key === 'requests' && counts.requests ? 'bg-pending-bg text-pending-fg' : 'bg-haze text-graphite')}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div id="mpanel" role="tabpanel" aria-labelledby={`mtab-${tab}`} className="pt-5">
          {tab === 'upcoming' && <UpcomingTab data={data} />}
          {tab === 'requests' && <RequestsTab data={data} rows={requests} />}
          {tab === 'completed' && <CompletedTab data={data} />}
          {tab === 'submitted' && <SubmittedTab data={data} />}
          {tab === 'availability' && <AvailabilityEditor data={data} />}
        </div>
      </div>
    </div>
  )
}
