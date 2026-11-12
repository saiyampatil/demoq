import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { cn } from '@/components/cn'
import { useStudies } from '@/state/StudyContext'
import { completedFor, openCount, requestsFor, submittedFor, upcomingFor } from '@/state/requests'
import type { FieldworkDoc } from '@/state/fieldwork'
import { PageHeader } from '../shared/PageHeader'
import { AvailabilityTab, CompletedTab, SubmittedTab, UpcomingTab } from './OtherTabs'
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

/** What every tab reads: the moderator, and the fieldwork records of every study, which is where sessions and requests live. */
export function useModeratorData() {
  const { fieldworks, updateFieldwork, studies, getLanguage } = useStudies()
  const { me } = useModerator()
  const studyName = (id: string) => studies.find((s) => s.id === id)?.name ?? id
  const act = (studyId: string, fn: (d: FieldworkDoc) => FieldworkDoc) => updateFieldwork(studyId, fn)
  return { me, all: fieldworks, act, studyName, language: getLanguage }
}

/** M1: the moderator's own sessions, the requests they can take, and when they are free. */
export function ModeratorSessions() {
  const data = useModeratorData()
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
          {tab === 'availability' && <AvailabilityTab data={data} />}
        </div>
      </div>
    </div>
  )
}
