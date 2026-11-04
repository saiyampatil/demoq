import { journeyPeople, needsYou, type JourneyKey } from '@/state/selectors'
import type { FieldworkDoc, Session } from '@/state/fieldwork'
import { screenById, studyPath } from '@/routes/screens'

export type Filter = 'All' | 'In progress' | 'Completed' | 'Needs you' | 'Not started' | 'Has open issues' | 'Issues' | 'Escalated'
export const FILTERS: Filter[] = ['All', 'In progress', 'Completed', 'Needs you', 'Not started', 'Has open issues', 'Issues', 'Escalated']
const match: Record<Exclude<Filter, 'Needs you'>, (s: Session) => boolean> = {
  All: () => true,
  'In progress': (s) => s.status === 'Active' || s.status === 'Paused',
  Completed: (s) => s.status === 'Completed',
  'Not started': (s) => s.status === 'Not started' || s.status === 'Booked',
  'Has open issues': (s) => s.issues.some((i) => i.status === 'Open'),
  // Any issue at all, open or resolved: how a Researcher finds the sessions that had one now the Issues tab is gone.
  Issues: (s) => s.issues.length > 0,
  Escalated: (s) => !!s.escalation,
}

/** The parts of the Sessions tab's address that decide which sessions are listed. A session page carries them so Previous, Next and Back follow the same list. */
export const LIST_KEYS = ['filter', 'q', 'reached', 'stuck', 'issue', 'ids', 'about'] as const

export const listParams = (params: URLSearchParams) => Object.fromEntries(LIST_KEYS.flatMap((k) => (params.get(k) ? [[k, params.get(k) as string]] : [])))

/** The sessions the Sessions tab lists for these params, in table order. */
export function sessionRows(doc: FieldworkDoc, params: URLSearchParams): Session[] {
  const asked = params.get('filter') as Filter | null
  const filter = asked && FILTERS.includes(asked) ? asked : 'All'
  const needing = new Set(needsYou(doc).flatMap((r) => (r.session ? [r.session.id] : [])))
  const test = (s: Session) => (filter === 'Needs you' ? needing.has(s.id) : match[filter](s))
  const reached = params.get('reached') as JourneyKey | null
  const stuck = params.get('stuck') as JourneyKey | null
  const people = reached || stuck ? journeyPeople(doc, reached ? { reached } : { stuck: stuck! }) : undefined
  const issueType = params.get('issue')
  // A list of people from a finding (coverage, patterns): participant IDs, comma separated.
  const ids = params.get('ids') ? new Set((params.get('ids') as string).split(',')) : undefined
  const q = (params.get('q') ?? '').trim().toLowerCase()
  return doc.sessions.filter((s) => test(s) && (!people || people.has(s.participantId)) && (!ids || ids.has(s.participantId)) && (!issueType || s.issues.some((i) => issueType.split('|').includes(i.type))) && (!q || [s.id, s.participantId, s.email, s.country].some((x) => x.toLowerCase().includes(q))))
}

export const sessionHref = (studyId: string, id: string, query?: Record<string, string>) => {
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
  return `${studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })}${qs}`
}

/** The Sessions tab with the list the Researcher had, and the row they just viewed. */
export const sessionsTabHref = (studyId: string, list: Record<string, string>, viewed?: string) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', ...list, ...(viewed ? { viewed } : {}) })}`
