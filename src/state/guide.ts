// Module 3 (R12, R13, R14): moderator setup, stimulus library and discussion guide.
// One GuideDoc per study. Every operation takes a doc and returns a new one; StudyContext stores and persists it.
//
// Versioning: a version that has been shared or approved is frozen. Any edit to the moderator config, the
// active stimuli or the guide after that creates the next version as a Draft, which needs fresh approval.

import type { ArtifactStatus } from '@/components/status'
import { AGENTS, HUMAN_MODERATORS } from '@/mock/moderation'
import { ratingOptions, SURVEY_LIMITS, surveySummary, type SurveyDef, type SurveyFormat, type SurveyQuestion } from '@/mock/surveys'
import type { StudyRecord } from '@/mock/types'
import type { Origin } from './audience'
import { AI_NAME, now, uid, type SectionKey, type SectionSnapshot } from './brief'
import { NO_LANGUAGE } from './language'
import { getTeamPerson } from './teamModerators'

// ─── moderator ──────────────────────────────────────────────────────────────

export type Mode = 'ai' | 'human'
export type Style = 'warm' | 'neutral' | 'probing'

export type { SurveyDef, SurveyFormat, SurveyQuestion }

/** A title and ordered questions, each with fixed wording and answer options. Once added to the library a survey can be switched on or off, never edited. */
export type Survey = { id: string; title: string; questions: SurveyQuestion[] }

export type ModeratorConfig = {
  mode: Mode | null
  agentId: string | null
  style: Style | null
  /** One value, in minutes, used by the guide's duration check in both modes. */
  durationMin: number
  surveys: Survey[]
  /** The moderator ids Fieldwork assigns sessions to: the accepted people. Kept in step with `team`. */
  humanIds: string[]
  /** Human-led: who was asked to moderate, and whether they accepted. Absent in studies saved before R12 had options. */
  team?: TeamMember[]
  /**
   * AI-led: PulseAI moderators on standby for a participant who asks to talk to a person. Optional: with none accepted,
   * participants aren't offered a human. They are never assigned interviews, so they are kept apart from `team`.
   */
  standby?: TeamMember[]
}

// ─── human moderators (R12) ─────────────────────────────────────────────────

export type ModSource = 'Myself' | 'PulseAI' | 'My team'
/**
 * "Accepted" is the one internal status for anyone who counts (it is shown as "Added"). "Requested" and "Declined" are no
 * longer created: they stay in the type so a study saved while requests existed still loads.
 */
export type ModStatus = 'Invited' | 'Requested' | 'Accepted' | 'Declined'
export const MOD_STATUSES: ModStatus[] = ['Invited', 'Requested', 'Accepted', 'Declined']

export type TeamMember = {
  id: string
  name: string
  email?: string
  source: ModSource
  language: string
  status: ModStatus
  /** Hours a week this person offers. Hours in the fieldwork window follow from it. */
  weeklyHours: number
  /** A moderator chosen from the PulseAI roster. */
  rosterId?: string
  /** Someone from the company's team list (state/teamModerators.ts). Their status is read from that list, so one acceptance counts in every study. */
  teamId?: string
  /** Studies saved before requests were removed: a PulseAI request that hasn't been matched to a person yet. */
  assign?: boolean
  by: string
  sentAt: string
}

/** A person from the team list counts once they are Active there, in every study they are on. Anyone else keeps their saved status. */
export function resolveMember(t: TeamMember): TeamMember {
  const person = getTeamPerson(t.teamId)
  if (!person) return t
  const status: ModStatus = person.status === 'Active' ? 'Accepted' : 'Invited'
  return status === t.status ? t : { ...t, status }
}

/** From a study saved while requests existed: a row to remove and add again. */
export const isLegacyRequest = (t: TeamMember) => t.status === 'Requested' || t.status === 'Declined' || !!t.assign

/** The team, whether it was saved with options or only as a list of moderator IDs. */
export function teamOf(m: ModeratorConfig): TeamMember[] {
  if (m.team) return m.team.map(resolveMember)
  return m.humanIds.map((id) => {
    const h = HUMAN_MODERATORS.find((x) => x.id === id)
    return { id, name: h?.name ?? id, source: 'PulseAI', language: h?.languages[0] ?? '', status: 'Accepted', weeklyHours: h?.weeklyHours ?? 10, rosterId: id, by: 'PulseAI', sentAt: '' }
  })
}

/** Roster moderators who have already accepted: the seed study's human-led setup. */
export const acceptedRoster = (ids: string[], language: string): TeamMember[] =>
  ids.map((id) => {
    const h = HUMAN_MODERATORS.find((x) => x.id === id)!
    return { id: `mod-${id}`, name: h.name, source: 'PulseAI', language, status: 'Accepted', weeklyHours: h.weeklyHours, rosterId: id, by: 'PulseAI', sentAt: '' }
  })

/** The id Fieldwork knows a moderator by: the roster id, or the name for someone outside the roster. */
export const moderatorKey = (t: TeamMember) => t.rosterId ?? t.name

/** Sets the team and keeps `humanIds` to the accepted people at this moment. A person accepting later changes `humanIdsOf`, not this. */
export function withTeam(m: ModeratorConfig, team: TeamMember[]): ModeratorConfig {
  return { ...m, team, humanIds: team.map(resolveMember).filter((t) => t.status === 'Accepted' && !t.assign).map(moderatorKey) }
}

export const standbyOf = (m: ModeratorConfig): TeamMember[] => (m.standby ?? []).map(resolveMember)
/** The standby moderators a participant can book: only those who accepted. */
export const acceptedStandby = (m: ModeratorConfig) => standbyOf(m).filter((t) => t.status === 'Accepted' && !t.assign)

export const acceptedOf = (m: ModeratorConfig) => teamOf(m).filter((t) => t.status === 'Accepted' && !t.assign)
/** The moderator ids Fieldwork assigns sessions to, worked out now so someone who accepted after the setup was saved is included. */
export const humanIdsOf = (m: ModeratorConfig) => (m.team ? acceptedOf(m).map(moderatorKey) : m.humanIds)
export const pendingOf = (m: ModeratorConfig) => teamOf(m).filter((t) => t.status === 'Invited' || t.status === 'Requested')

/** Weeks in the fieldwork window, from its two dates. One week when no window is set. */
export function windowWeeks(w: { start: string; end: string } | null | undefined) {
  if (!w?.start || !w.end) return 1
  const days = (Date.parse(`${w.end}T12:00:00`) - Date.parse(`${w.start}T12:00:00`)) / 86_400_000 + 1
  return Number.isFinite(days) && days > 0 ? Math.max(1 / 7, days / 7) : 1
}
export const hoursIn = (t: TeamMember, weeks: number) => Math.round(t.weeklyHours * weeks)

/** What the accepted moderators can cover against what the interviews need. Only Accepted people count. */
export function coverage(m: ModeratorConfig, interviews: number | null, weeks: number) {
  const accepted = acceptedOf(m)
  const available = accepted.reduce((n, t) => n + hoursIn(t, weeks), 0)
  const needed = interviews ? Math.ceil((interviews * m.durationMin) / 60) : 0
  return { accepted: accepted.length, available, needed, short: needed > 0 && available < needed, interviews }
}

/**
 * People whose language isn't the study's. They can't moderate an interview in another language. A person from the team
 * list has no language of their own and is taken to cover the study language (docs/OPEN_QUESTIONS.md).
 */
export const languageMismatches = (m: ModeratorConfig, language: string | null) => (language ? teamOf(m).filter((t) => !t.teamId && t.language !== language) : [])

export const DEFAULT_DURATION = 20

export const emptyModerator = (): ModeratorConfig => ({
  mode: null,
  agentId: null,
  style: null,
  durationMin: DEFAULT_DURATION,
  surveys: [],
  humanIds: [],
})

/** What is still missing before the guide can be drafted (PRD Module 3, acceptance criteria 2 and 3). */
export function configBlockers(m: ModeratorConfig, language: string | null): string[] {
  if (!m.mode) return ['Choose AI or human moderator']
  const out: string[] = []
  if (!language) out.push(NO_LANGUAGE)
  if (!m.durationMin || m.durationMin < 1) out.push('Set a target duration')
  if (m.mode === 'ai') {
    if (!m.agentId) out.push('Select an AI agent')
    if (!m.style) out.push('Choose a moderation style')
  } else if (teamOf(m).length === 0) out.push('Add at least one human moderator')
  return out
}

export const agentName = (id: string | null) => AGENTS.find((a) => a.id === id)?.name
export const humanName = (id: string) => HUMAN_MODERATORS.find((h) => h.id === id)?.name ?? id
export const humanNames = (m: ModeratorConfig) => acceptedOf(m).map((t) => t.name)

// ─── stimuli ────────────────────────────────────────────────────────────────

export type StimulusKind = 'image' | 'video' | 'concept' | 'survey'
export type Stimulus = {
  id: string
  name: string
  kind: StimulusKind
  detail: string
  active: boolean
  addedAt: string
  addedBy: string
  /** Mock: false when the file fails to render. Launch preflight checks it. */
  renderOk?: boolean
  /** A concept card written in the app: its text, and an optional picture kept as a small preview. */
  text?: string
  image?: string
  /** A survey's questions. Older items have none and keep one question in `name` and its options in `detail`. */
  questions?: SurveyQuestion[]
}
export type StimuliState = { items: Stimulus[]; skipped: boolean }

/** A survey item's questions. An older single-question item is read as a survey of one. */
export const questionsOfSurvey = (s: Stimulus): SurveyQuestion[] =>
  s.questions ?? [{ id: 'q1', text: s.name, format: 'single', options: s.detail.split('|').map((o) => o.trim()) }]

/** The surveys a question can run: the survey items in the stimulus library that are in the active set. */
export const surveysOf = (doc: { stimuli: StimuliState }): Survey[] =>
  doc.stimuli.items.filter((s) => s.kind === 'survey' && s.active).map((s) => ({ id: s.id, title: s.name, questions: questionsOfSurvey(s) }))

/** What stops a survey being added: the title, and each question's wording and answers. */
export function surveyProblems(def: { title: string; questions: Pick<SurveyQuestion, 'text' | 'format' | 'options'>[] }): { title?: string; questions: Record<number, string>; any: boolean } {
  const out = { title: undefined as string | undefined, questions: {} as Record<number, string>, any: false }
  if (!def.title.trim()) out.title = 'Give the survey a title.'
  def.questions.forEach((q, i) => {
    const opts = q.options.map((o) => o.trim()).filter(Boolean)
    if (!q.text.trim()) out.questions[i] = 'Write the question.'
    else if (q.format !== 'rating' && opts.length < SURVEY_LIMITS.minOptions) out.questions[i] = `Add at least ${SURVEY_LIMITS.minOptions} answers.`
    else if (q.format !== 'rating' && new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) out.questions[i] = 'Two answers are the same. Each one must be different.'
  })
  if (!def.questions.length) out.questions[0] = 'Add at least one question.'
  out.any = !!out.title || Object.keys(out.questions).length > 0
  return out
}

/** The library item for a survey the Researcher built. Questions get IDs here, and a rating's options are its numbers. */
export function newSurveyItem(def: SurveyDef, by: string): Stimulus {
  const questions: SurveyQuestion[] = def.questions.map((q, i) => ({
    id: `q${i + 1}`,
    text: q.text.trim(),
    format: q.format,
    options: q.format === 'rating' ? ratingOptions(q.options.length || 5) : q.options.map((o) => o.trim()).filter(Boolean),
    ...(q.format === 'rating' && (q.scale?.low.trim() || q.scale?.high.trim()) ? { scale: { low: q.scale?.low.trim() ?? '', high: q.scale?.high.trim() ?? '' } } : {}),
  }))
  return { id: uid('st'), name: def.title.trim(), kind: 'survey', detail: surveySummary(questions), questions, active: true, addedAt: now(), addedBy: by }
}

/** One line per survey for lists: "3 questions · single choice, rating scale". */
export const surveyFormats = (qs: SurveyQuestion[]) => [...new Set(qs.map((q) => q.format))]

export const kindLabel: Record<StimulusKind, string> = { image: 'Image', video: 'Video', concept: 'Concept card', survey: 'Survey' }

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const VIDEO_EXT = ['mp4', 'mov', 'webm']
const MAX_MB = 200

/** Reads a file name and size the way the real upload would, returning an item or an error to show. */
export function classifyFile(name: string, sizeBytes: number): { kind: StimulusKind; detail: string } | { error: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const mb = sizeBytes / 1_000_000
  if (mb > MAX_MB) return { error: `“${name}” is ${Math.round(mb)} MB. The limit is ${MAX_MB} MB. Compress it and upload again.` }
  const size = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(sizeBytes / 1000))} KB`
  if (IMAGE_EXT.includes(ext)) return { kind: 'image', detail: `${ext.toUpperCase()}, ${size}` }
  if (VIDEO_EXT.includes(ext)) return { kind: 'video', detail: `${ext.toUpperCase()}, ${size}` }
  return { error: `“${name}” isn’t a supported format (${ext ? `.${ext}` : 'no extension'}). Upload an image (PNG, JPG, WebP, GIF) or a video (MP4, MOV, WebM). For a concept, use New concept card.` }
}

/** The picture on a concept card: the same checks as an upload, but images only. */
export function classifyCardImage(name: string, sizeBytes: number): { detail: string } | { error: string } {
  const r = classifyFile(name, sizeBytes)
  if ('error' in r) return { error: r.error.replace(/ For a concept, use New concept card\.$/, '').replace('Upload an image (PNG, JPG, WebP, GIF) or a video (MP4, MOV, WebM).', 'Use an image (PNG, JPG, WebP, GIF).') }
  if (r.kind !== 'image') return { error: `“${name}” is a video. A concept card takes an image (PNG, JPG, WebP, GIF).` }
  return { detail: r.detail }
}

export const activeStimuli = (s: StimuliState) => s.items.filter((i) => i.active)

// ─── guide ──────────────────────────────────────────────────────────────────

export type Branch = { ifQuestionId: string; answer: string; action: 'skip-to' | 'branch-to'; targetId: string }

export type Question = {
  id: string
  text: string
  mandatory: boolean
  /** Follow-ups the moderator may use. */
  probes: string[]
  stimulusId?: string
  surveyId?: string
  /** Advanced. Phrasing the moderator must never use. */
  banned: string[]
  /** Advanced. null = no limit set. */
  maxFollowUps: number | null
  /** Advanced. */
  branch?: Branch
  /** Research objectives this question covers. */
  covers: string[]
  origin: Origin
}

export type GuideSection = { id: string; title: string; minutes: number; questions: Question[]; origin: Origin }
export type Objective = { id: string; text: string }

export type Override = { reason: string; by: string; at: string; /** The condition the override was given for. */ signature: string }

export type Guide = {
  sections: GuideSection[]
  objectives: Objective[]
  wrapUp: string[]
  generatedAt: string
  /** What it was drafted from. */
  builtFrom: { briefVersion: number; audienceVersion: number; mode: Mode; durationMin: number }
  overrides: { coverage?: Override; duration?: Override }
}

export type GuideEvent = {
  id: string
  at: string
  by: string
  version: number
  type: 'drafted' | 'redrafted' | 'saved' | 'emailed' | 'shared' | 'changes-requested' | 'client-approved' | 'approved' | 'reopened' | 'override'
  note?: string
  feedback?: string
}

export type GuideDoc = {
  studyId: string
  moderator: ModeratorConfig
  stimuli: StimuliState
  guide: Guide | null
  /** Set while the AI is drafting. Reaching R14 with a complete setup starts it. */
  guidePending?: boolean
  status: ArtifactStatus
  version: number
  /** Edits made to the current version, for the redraft warning. */
  edits: number
  approved?: { version: number; by: string; at: string; onBehalfOf?: string }
  events: GuideEvent[]
}

export const emptyGuideDoc = (studyId: string): GuideDoc => ({
  studyId,
  moderator: emptyModerator(),
  stimuli: { items: [], skipped: false },
  guide: null,
  status: 'Draft',
  version: 1,
  edits: 0,
  events: [],
})

export function guideSummary(doc: GuideDoc): StudyRecord['guide'] {
  if (!doc.guide) return { status: null, version: 0 }
  const a = doc.approved
  return {
    status: doc.status,
    version: doc.version,
    approval: doc.status === 'Approved' && a ? { by: a.by, onBehalfOf: a.onBehalfOf, at: a.at, version: a.version } : undefined,
  }
}

/** Changes to config, stimuli or guide go through here, so a frozen version moves on to a new Draft. */
function mutate(doc: GuideDoc, by: string, fn: (d: GuideDoc) => GuideDoc, note: string): GuideDoc {
  const next = fn(doc)
  if (!doc.guide || next === doc) return next
  if (doc.status === 'Draft') return { ...next, edits: doc.edits + 1 }
  const version = doc.version + 1
  return {
    ...next,
    status: 'Draft',
    version,
    edits: 1,
    events: [...doc.events, { id: uid('ge'), at: now(), by, version, type: 'reopened', note: `${note}. Version ${doc.version} is frozen.` }],
  }
}

export const nextVersionFor = (doc: GuideDoc) => (doc.guide ? doc.version + 1 : doc.version)

// ── moderator ops ──

export const editModerator = (doc: GuideDoc, by: string, fn: (m: ModeratorConfig) => ModeratorConfig, note = 'Moderator setup changed') =>
  mutate(doc, by, (d) => ({ ...d, moderator: fn(d.moderator) }), note)

// Human moderators. Adding or removing a person is an edit to the setup (like any other). What the person does next
// (accepts, declines, PulseAI confirms) happens outside the guide, so it never makes a new version.

const hasTeam = (m: ModeratorConfig) => teamOf(m)
const addMembers = (doc: GuideDoc, by: string, make: (at: string) => TeamMember[], note: string) =>
  editModerator(doc, by, (m) => withTeam(m, [...hasTeam(m), ...make(now())]), note)

/** "I'll moderate": the current user, accepted at once. */
export const addMyself = (doc: GuideDoc, by: string, language: string) =>
  teamOf(doc.moderator).some((t) => t.source === 'Myself')
    ? doc
    : addMembers(doc, by, (at) => [{ id: uid('mod'), name: by, source: 'Myself', language, status: 'Accepted', weeklyHours: 8, by, sentAt: at }], 'Added themselves as a moderator')

/** "Let PulseAI assign": a request for a number of moderators in the study language. Requested until PulseAI confirms. */
export const requestPulseAI = (doc: GuideDoc, by: string, count: number, language: string) =>
  addMembers(
    doc,
    by,
    (at) => Array.from({ length: Math.max(1, Math.floor(count)) }, (_, i) => ({ id: uid('mod'), name: `PulseAI moderator ${i + 1}`, source: 'PulseAI' as const, language, status: 'Requested' as const, weeklyHours: 10, assign: true, by, sentAt: at })),
    `Requested ${count} PulseAI ${count === 1 ? 'moderator' : 'moderators'}`,
  )

/** "Choose specific moderators": one person from the roster, Requested until they accept. */
export function requestRoster(doc: GuideDoc, by: string, rosterId: string, studyLanguage: string): GuideDoc {
  const h = HUMAN_MODERATORS.find((x) => x.id === rosterId)
  if (!h || teamOf(doc.moderator).some((t) => t.rosterId === rosterId)) return doc
  const language = h.languages.includes(studyLanguage) ? studyLanguage : h.languages[0]
  return addMembers(doc, by, (at) => [{ id: uid('mod'), name: h.name, source: 'PulseAI', language, status: 'Requested', weeklyHours: h.weeklyHours, rosterId, by, sentAt: at }], `Requested ${h.name}`)
}

/** "Someone from my team": each gets an email invitation and is Invited until they accept. */
export const inviteTeam = (doc: GuideDoc, by: string, people: { name: string; email: string }[], language: string) =>
  addMembers(doc, by, (at) => people.map((p) => ({ id: uid('mod'), name: p.name.trim(), email: p.email.trim(), source: 'My team' as const, language, status: 'Invited' as const, weeklyHours: 6, by, sentAt: at })), `Invited ${people.length} ${people.length === 1 ? 'person' : 'people'} from the team`)

export const removeMember = (doc: GuideDoc, by: string, id: string) => editModerator(doc, by, (m) => withTeam(m, teamOf(m).filter((t) => t.id !== id)), 'Removed a moderator')

export const setMemberLanguage = (doc: GuideDoc, by: string, id: string, language: string) => editModerator(doc, by, (m) => withTeam(m, teamOf(m).map((t) => (t.id === id ? { ...t, language } : t))), 'Moderator language changed')

const touchTeam = (doc: GuideDoc, fn: (team: TeamMember[]) => TeamMember[]): GuideDoc => ({ ...doc, moderator: withTeam(doc.moderator, fn(teamOf(doc.moderator))) })

/** Resend an invitation or request. A declined person is asked again. */
export const resendMember = (doc: GuideDoc, id: string) =>
  touchTeam(doc, (team) => team.map((t) => (t.id === id ? { ...t, sentAt: now(), status: t.status === 'Declined' ? (t.source === 'My team' ? 'Invited' : 'Requested') : t.status } : t)))

// Standby moderators (AI-led). PulseAI only: the Researcher asks for them and PulseAI confirms. Like any other setup edit,
// adding or removing one moves an approved guide on to a new version.

const withStandby = (m: ModeratorConfig, standby: TeamMember[]): ModeratorConfig => ({ ...m, standby })
const addStandby = (doc: GuideDoc, by: string, make: (at: string) => TeamMember[], note: string) =>
  editModerator(doc, by, (m) => withStandby(m, [...standbyOf(m), ...make(now())]), note)

/** "Let PulseAI assign": a request for a number of standby moderators in the study language. */
export const requestStandbyPulse = (doc: GuideDoc, by: string, count: number, language: string) =>
  addStandby(
    doc,
    by,
    (at) => Array.from({ length: Math.max(1, Math.floor(count)) }, (_, i) => ({ id: uid('sb'), name: `PulseAI moderator ${standbyOf(doc.moderator).length + i + 1}`, source: 'PulseAI' as const, language, status: 'Requested' as const, weeklyHours: 10, assign: true, by, sentAt: at })),
    `Requested ${count} standby ${count === 1 ? 'moderator' : 'moderators'}`,
  )

/** "Choose specific moderators": one person from the roster, Requested until they accept. */
export function requestStandbyRoster(doc: GuideDoc, by: string, rosterId: string, studyLanguage: string): GuideDoc {
  const h = HUMAN_MODERATORS.find((x) => x.id === rosterId)
  if (!h || standbyOf(doc.moderator).some((t) => t.rosterId === rosterId)) return doc
  const language = h.languages.includes(studyLanguage) ? studyLanguage : h.languages[0]
  return addStandby(doc, by, (at) => [{ id: uid('sb'), name: h.name, source: 'PulseAI', language, status: 'Requested', weeklyHours: h.weeklyHours, rosterId, by, sentAt: at }], `Requested ${h.name} on standby`)
}

export const removeStandby = (doc: GuideDoc, by: string, id: string) => editModerator(doc, by, (m) => withStandby(m, standbyOf(m).filter((t) => t.id !== id)), 'Removed a standby moderator')

const touchStandby = (doc: GuideDoc, fn: (list: TeamMember[]) => TeamMember[]): GuideDoc => (doc.moderator.standby ? { ...doc, moderator: withStandby(doc.moderator, fn(doc.moderator.standby)) } : doc)

/** Resend a request. A declined moderator is asked again. */
export const resendStandby = (doc: GuideDoc, id: string) =>
  touchStandby(doc, (list) => list.map((t) => (t.id === id ? { ...t, sentAt: now(), status: t.status === 'Declined' ? 'Requested' : t.status } : t)))

/** Dev: the person accepts or declines. */
export const setMemberStatus = (doc: GuideDoc, id: string, status: ModStatus) => {
  const set = (list: TeamMember[]) => list.map((t) => (t.id === id ? { ...t, status } : t))
  return standbyOf(doc.moderator).some((t) => t.id === id) ? touchStandby(doc, set) : touchTeam(doc, set)
}

/** Dev: PulseAI confirms its assignments. Each request is matched to a roster moderator who speaks the language and isn't on the list yet. */
export function confirmAssignments(doc: GuideDoc): GuideDoc {
  // Roster moderators already on either list are taken, so one person isn't matched twice.
  const taken = new Set([...teamOf(doc.moderator), ...standbyOf(doc.moderator)].map((t) => t.rosterId).filter(Boolean))
  const match = (list: TeamMember[]) =>
    list.map((t) => {
      if (!t.assign || t.status !== 'Requested') return t
      const h = HUMAN_MODERATORS.find((x) => !taken.has(x.id) && x.languages.includes(t.language))
      if (!h) return t
      taken.add(h.id)
      return { ...t, name: h.name, rosterId: h.id, assign: false, status: 'Accepted' as const, weeklyHours: h.weeklyHours }
    })
  return doc.moderator.mode === 'ai' ? touchStandby(doc, match) : touchTeam(doc, match)
}

/** Switching AI/human. Surveys stop applying, and the guide is drafted again for the new mode. */
export function switchMode(doc: GuideDoc, by: string, mode: Mode, language: string | null): GuideDoc {
  if (doc.moderator.mode === mode) return doc
  // Standby moderators belong to the AI-led setup, so they go when it changes.
  const m = { ...doc.moderator, mode, standby: undefined }
  if (!doc.guide) return { ...doc, moderator: m }
  const version = doc.version + 1
  return {
    ...doc,
    moderator: m,
    guide: null,
    guidePending: configBlockers(m, language).length === 0,
    status: 'Draft',
    version,
    edits: 0,
    events: [...doc.events, { id: uid('ge'), at: now(), by, version, type: 'reopened', note: `Switched to ${mode === 'ai' ? 'AI' : 'human'} moderator. The guide is drafted again. Version ${doc.version} is frozen.` }],
  }
}

export const startGuide = (doc: GuideDoc): GuideDoc => ({ ...doc, guidePending: true })

/** Regenerate from brief/audience: replaces every question and edit with a fresh draft. */
export function regenerateGuide(doc: GuideDoc, by: string): GuideDoc {
  if (!doc.guide) return startGuide(doc)
  const version = doc.version + 1
  return {
    ...doc,
    guide: null,
    guidePending: true,
    status: 'Draft',
    version,
    edits: 0,
    events: [...doc.events, { id: uid('ge'), at: now(), by, version, type: 'reopened', note: `Regenerated from the brief and audience. Version ${doc.version} is frozen.` }],
  }
}

// ── stimulus ops ──

export const editStimuli = (doc: GuideDoc, by: string, fn: (s: StimuliState) => StimuliState, note: string) =>
  mutate(doc, by, (d) => ({ ...d, stimuli: fn(d.stimuli) }), note)

// ── guide ops ──

export const editGuide = (doc: GuideDoc, by: string, fn: (g: Guide) => Guide, note = 'Guide edited') =>
  mutate(doc, by, (d) => (d.guide ? { ...d, guide: fn(d.guide) } : d), note)

// ─── numbering and lookups ──────────────────────────────────────────────────

export const allQuestions = (g: Guide) => g.sections.flatMap((s) => s.questions)
export const questionNumber = (g: Guide, id: string) => allQuestions(g).findIndex((q) => q.id === id) + 1

// ─── checks ─────────────────────────────────────────────────────────────────

export const totalMinutes = (g: Guide) => g.sections.reduce((n, s) => n + (Number.isFinite(s.minutes) ? s.minutes : 0), 0)

export function uncoveredObjectives(g: Guide): Objective[] {
  const covered = new Set(allQuestions(g).flatMap((q) => q.covers))
  return g.objectives.filter((o) => !covered.has(o.id))
}

const coverageSig = (g: Guide) => uncoveredObjectives(g).map((o) => o.id).join(',')
const durationSig = (g: Guide, target: number) => `${totalMinutes(g)}/${target}`

export type Check = { ok: boolean; message: string; overridden?: Override }

export function coverageCheck(g: Guide): Check {
  const gaps = uncoveredObjectives(g)
  if (!gaps.length) return { ok: true, message: `Every one of the ${g.objectives.length} objectives is covered by at least one question.` }
  const o = g.overrides.coverage
  return {
    ok: false,
    message: `${gaps.length === 1 ? '1 objective has' : `${gaps.length} objectives have`} no question: ${gaps.map((x) => `“${x.text}”`).join('; ')}.`,
    overridden: o && o.signature === coverageSig(g) ? o : undefined,
  }
}

export function durationCheck(g: Guide, target: number): Check {
  const sum = totalMinutes(g)
  if (sum === target) return { ok: true, message: `The sections add up to ${sum} minutes, the target.` }
  const over = sum > target
  const o = g.overrides.duration
  return {
    ok: false,
    message: `${sum} min, target ${target}: ${over ? 'over' : 'under'} by ${Math.abs(sum - target)}.`,
    overridden: o && o.signature === durationSig(g, target) ? o : undefined,
  }
}

export function overrideCheck(doc: GuideDoc, by: string, kind: 'coverage' | 'duration', reason: string): GuideDoc {
  const g = doc.guide
  if (!g) return doc
  const signature = kind === 'coverage' ? coverageSig(g) : durationSig(g, doc.moderator.durationMin)
  const o: Override = { reason: reason.trim(), by, at: now(), signature }
  // Overrides are part of the guide, so they follow the same version rules as any edit.
  return mutate(
    doc,
    by,
    (d) => ({ ...d, guide: { ...g, overrides: { ...g.overrides, [kind]: o } }, events: [...d.events, { id: uid('ge'), at: o.at, by, version: d.version, type: 'override', note: `${kind === 'coverage' ? 'Coverage' : 'Duration'} flag overridden: ${o.reason}` }] }),
    `${kind === 'coverage' ? 'Coverage' : 'Duration'} flag overridden`,
  )
}

/** Questions whose stimulus is switched off in the library, or gone from it. */
export type Flag = { question: Question; stimulusName: string; reason: 'inactive' | 'missing' }

export function flaggedQuestions(doc: GuideDoc): Flag[] {
  if (!doc.guide) return []
  const out: Flag[] = []
  allQuestions(doc.guide).forEach((q) => {
    if (!q.stimulusId) return
    const s = doc.stimuli.items.find((x) => x.id === q.stimulusId)
    if (!s) out.push({ question: q, stimulusName: 'a removed stimulus', reason: 'missing' })
    else if (!s.active) out.push({ question: q, stimulusName: s.name, reason: 'inactive' })
  })
  return out
}

/** A study with no client skips the client review. */
export const studyHasClient = (client: string | undefined) => !!client && client !== 'Client not set'

export function approvalBlockers(doc: GuideDoc, hasClient: boolean): string[] {
  if (!doc.guide) return ['The guide isn’t drafted yet']
  const out: string[] = []
  if (hasClient && !clientApprovedVersion(doc)) out.push(doc.status === 'In Review' ? 'Record the client’s decision first' : 'Share the guide with the client and record their approval first')
  const cov = coverageCheck(doc.guide)
  if (!cov.ok && !cov.overridden) out.push('Fix or override the coverage flag')
  const dur = durationCheck(doc.guide, doc.moderator.durationMin)
  if (!dur.ok && !dur.overridden) out.push('Fix or override the duration flag')
  const f = flaggedQuestions(doc)
  if (f.length) out.push(`${f.length === 1 ? '1 question uses' : `${f.length} questions use`} a stimulus that isn’t active`)
  if (allQuestions(doc.guide).some((q) => !q.text.trim())) out.push('Every question needs wording')
  return out
}

// ─── review and approval ────────────────────────────────────────────────────

/** Sets the version In Review. The PDF is sent by the researcher; email records who it was sent to. */
export function shareGuide(doc: GuideDoc, by: string, method: 'pdf' | 'email' = 'pdf', recipients: string[] = [], message = ''): GuideDoc {
  if (!doc.guide || doc.status === 'Approved') return doc
  const email = method === 'email'
  return {
    ...doc,
    status: 'In Review',
    // What is shared is the version as it stands, so its edits are part of it.
    edits: 0,
    events: [
      ...doc.events,
      { id: uid('ge'), at: now(), by, version: doc.version, type: email ? 'emailed' : 'shared', note: email ? recipients.join(', ') : undefined, feedback: email && message.trim() ? message.trim() : undefined },
    ],
  }
}

/** Saves the draft as the next version, like the brief. Only a Draft with unsaved edits can be saved. */
export function saveGuideVersion(doc: GuideDoc, by: string): GuideDoc {
  if (!doc.guide || doc.status !== 'Draft' || doc.edits === 0) return doc
  const version = doc.version + 1
  return {
    ...doc,
    version,
    edits: 0,
    events: [...doc.events, { id: uid('ge'), at: now(), by, version, type: 'saved', note: `${doc.edits} ${doc.edits === 1 ? 'edit' : 'edits'} saved from version ${doc.version}` }],
  }
}

/** Changes requested creates the next version as a Draft, with the client's feedback recorded. */
export function recordChangesRequested(doc: GuideDoc, by: string, client: string, feedback: string): GuideDoc {
  const version = doc.version + 1
  return {
    ...doc,
    status: 'Draft',
    version,
    edits: 0,
    events: [
      ...doc.events,
      { id: uid('ge'), at: now(), by, version: doc.version, type: 'changes-requested', feedback: feedback.trim(), note: `Requested by ${client}` },
      { id: uid('ge'), at: now(), by, version, type: 'reopened', note: `Version ${version} opened for the client’s changes. Version ${doc.version} is frozen.` },
    ],
  }
}

export function recordClientApproved(doc: GuideDoc, by: string, client: string): GuideDoc {
  return { ...doc, events: [...doc.events, { id: uid('ge'), at: now(), by, version: doc.version, type: 'client-approved', note: client }] }
}

export function approveGuide(doc: GuideDoc, by: string, client: string | undefined, hasClient: boolean): GuideDoc {
  if (!doc.guide || approvalBlockers(doc, hasClient).length) return doc
  const at = now()
  return {
    ...doc,
    status: 'Approved',
    approved: { version: doc.version, by, at, onBehalfOf: client },
    events: [...doc.events, { id: uid('ge'), at, by, version: doc.version, type: 'approved', note: client ? `Client ${client} approved` : undefined }],
  }
}

export const clientApprovedVersion = (doc: GuideDoc) => doc.events.some((e) => e.type === 'client-approved' && e.version === doc.version)

// ─── the handoff package for Module 4 ───────────────────────────────────────

export function handoffPackage(doc: GuideDoc) {
  return {
    guideVersion: doc.approved?.version ?? doc.version,
    moderator: doc.moderator,
    activeStimuli: doc.stimuli.items.filter((s) => s.active),
    surveys: surveysOf(doc),
    guide: doc.guide,
  }
}

// ─── AI draft ───────────────────────────────────────────────────────────────

export type DraftInput = {
  study: Pick<StudyRecord, 'client' | 'category'>
  briefSections?: Record<SectionKey, SectionSnapshot>
  briefVersion: number
  audienceVersion: number
  moderator: ModeratorConfig
  stimuli: StimuliState
}

/** Objectives the guide must cover, read from the approved brief's objective. */
export function deriveObjectives(objectiveText: string): Objective[] {
  if (/hydraveil/i.test(objectiveText))
    return [
      { id: 'o1', text: 'Which concept direction makes women with dry or combination skin want to switch' },
      { id: 'o2', text: 'What would stop them switching from their current moisturizer' },
      { id: 'o3', text: 'Whether the refill format reads as premium or cheap' },
      { id: 'o4', text: 'How they choose and use their current moisturizer today' },
    ]
  const parts = objectiveText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 12)
    .slice(0, 4)
  const list = parts.length ? parts : ['Understand how the audience feels about the concept']
  return [...list.map((text, i) => ({ id: `o${i + 1}`, text })), { id: `o${list.length + 1}`, text: 'How they choose and use products in this category today' }]
}

const q = (text: string, extra: Partial<Question> = {}): Question => ({
  id: uid('q'),
  text,
  mandatory: false,
  probes: [],
  banned: [],
  maxFollowUps: null,
  covers: [],
  origin: 'ai',
  ...extra,
})

const SECTION_BASE = [2, 4, 6, 5, 2, 1]

function scale(total: number): number[] {
  const out = SECTION_BASE.map((m) => Math.max(1, Math.round((m * total) / 20)))
  out[2] += total - out.reduce((a, b) => a + b, 0)
  return out
}

/** Mock AI draft. Starts fully covered, and in human mode has no surveys and no agent-specific wording. */
export function draftGuide(i: DraftInput): Guide {
  const m = i.moderator
  const ai = m.mode === 'ai'
  const objective = i.briefSections?.objective?.text ?? ''
  const objectives = deriveObjectives(objective)
  const O = (n: number) => objectives[n - 1]?.id
  const ids = (...n: number[]) => n.map(O).filter((x): x is string => !!x)
  const mins = scale(m.durationMin || DEFAULT_DURATION)
  const maxFU = ai ? 2 : null
  const active = i.stimuli.items.filter((s) => s.active)
  const surveys = surveysOf({ stimuli: i.stimuli })
  const survey = ai ? surveys[0] : undefined
  const survey2 = ai ? surveys[1] : undefined

  const intro = [
    q(
      ai
        ? 'Welcome the participant, explain this is a conversation with an AI interviewer that is recorded, and that there are no right or wrong answers.'
        : 'Welcome the participant, introduce yourself, and confirm they are happy to be recorded.',
      { mandatory: true },
    ),
    q('To start, tell me a little about yourself and what your skin is like.', { probes: ['How would you describe your skin in a few words?'], covers: ids(4), maxFollowUps: maxFU }),
  ]

  const behaviours = [
    q('Walk me through your face moisturizer routine, from morning to night.', {
      mandatory: true,
      probes: ['What do you use, and when?', 'What made you choose that product?'],
      covers: ids(4),
      maxFollowUps: maxFU,
    }),
    q('What do you like and dislike about the moisturizer you use most?', {
      mandatory: true,
      probes: ['Can you give me an example?', 'How does your skin feel a few hours later?'],
      covers: ids(4, 2),
      maxFollowUps: maxFU,
    }),
    q('When did you last think about switching, and what happened?', { probes: ['What would have made you switch?'], covers: ids(2), maxFollowUps: maxFU }),
  ]

  const themes = [
    q('What would make you try a new facial moisturizer?', { mandatory: true, probes: ['Is there a claim or ingredient that would get your attention?'], covers: ids(1, 2), banned: ['Wouldn’t you agree that…'], maxFollowUps: maxFU }),
    q('What would stop you from switching away from the one you use now?', { mandatory: true, probes: ['What would you need to see or try first?'], covers: ids(2), banned: ['Is price the main thing?'], maxFollowUps: maxFU }),
    q(`How much do claims like “72-hour hydration” matter when you choose a moisturizer?`, { probes: ['Do you believe claims like that?'], covers: ids(1), maxFollowUps: maxFU }),
  ]

  const exercises: Question[] = []
  const reactions = active.length ? active : []
  reactions.forEach((s, n) => {
    exercises.push(
      q(`Here is ${s.name}. Tell me your first reaction, before I say anything about it.`, {
        mandatory: true,
        stimulusId: s.id,
        probes: ['What stands out to you?', 'Is anything unclear?'],
        banned: ['Don’t you think this looks premium?'],
        maxFollowUps: maxFU,
        covers: ids(1, ...(s.name.toLowerCase().includes('refill') ? [3] : [])),
      }),
    )
    if (n === 0 && survey)
      exercises.push(q(`Now a short survey on screen, “${survey.title}”. Please answer each question as it appears.`, { mandatory: true, surveyId: survey.id, covers: ids(1) }))
  })
  if (reactions.length > 1)
    exercises.push(q('Which of these would make you most want to switch, and why?', { mandatory: true, probes: ['What puts the others behind it?'], covers: ids(1), maxFollowUps: maxFU }))
  if (!reactions.length)
    exercises.push(q('Imagine you are choosing a new moisturizer in a shop. Which three would you pick up first, and why?', { mandatory: true, probes: ['What made you reach for that one?'], covers: ids(1), maxFollowUps: maxFU }))
  exercises.push(
    q('Some of these come as a refill. Does a refill feel premium or cheap to you, and why?', { mandatory: true, probes: ['What would make a refill feel more premium?'], banned: ['It’s cheaper, right?'], covers: ids(3), maxFollowUps: maxFU }),
  )
  if (survey2) exercises.push(q(`One more short survey on screen, “${survey2.title}”. Please answer each question as it appears.`, { surveyId: survey2.id, covers: [] }))

  const reflection = [
    q('Looking back, what is the single biggest thing that would stop you switching?', { mandatory: true, covers: ids(2), maxFollowUps: maxFU }),
    q('Is there anything we didn’t ask that matters to you when you choose a moisturizer?'),
  ]

  const wrap = [
    q(
      ai ? 'Thank the participant, explain what happens next and how the incentive is sent, then end the interview.' : 'Thank the participant, explain what happens next and how the incentive is sent, then close the session.',
      { mandatory: true },
    ),
  ]

  // Branch: if no concept appeals, skip the "which would make you switch" comparison.
  const compare = exercises.find((x) => x.text.startsWith('Which of these'))
  const firstReaction = exercises.find((x) => x.stimulusId)
  if (compare && firstReaction && reactions.length > 1) {
    const refill = exercises.find((x) => x.text.startsWith('Some of these'))
    if (refill) compare.branch = { ifQuestionId: firstReaction.id, answer: 'None of them appeal', action: 'skip-to', targetId: refill.id }
  }

  const titles = ['Intro', 'Current behaviours', 'Research themes', 'Stimuli and exercises', 'Reflection', 'Wrap-up']
  const sections: GuideSection[] = [intro, behaviours, themes, exercises, reflection, wrap].map((qs, n) => ({
    id: uid('s'),
    title: titles[n],
    minutes: mins[n],
    questions: qs,
    origin: 'ai',
  }))

  // Safety net: a draft always covers every objective.
  const covered = new Set(sections.flatMap((s) => s.questions.flatMap((x) => x.covers)))
  objectives.filter((o) => !covered.has(o.id)).forEach((o) => sections[2].questions.push(q(`Tell me about this: ${o.text.charAt(0).toLowerCase()}${o.text.slice(1)}.`, { covers: [o.id], maxFollowUps: maxFU })))

  return {
    sections,
    objectives,
    wrapUp: [
      'Every mandatory question has been asked.',
      `The target duration of ${m.durationMin} minutes is reached.`,
      'The participant asks to stop. End politely and thank them.',
      'Hard stop: at 90% of the target duration, move to wrap-up even if optional questions remain.',
    ],
    generatedAt: now(),
    builtFrom: { briefVersion: i.briefVersion, audienceVersion: i.audienceVersion, mode: m.mode ?? 'ai', durationMin: m.durationMin },
    overrides: {},
  }
}

/** Builds the draft and records it as the current version. */
export function applyDraft(doc: GuideDoc, guide: Guide, by = AI_NAME): GuideDoc {
  const redraft = doc.events.some((e) => e.type === 'reopened' && e.version === doc.version)
  return {
    ...doc,
    guide,
    guidePending: false,
    edits: 0,
    events: [...doc.events, { id: uid('ge'), at: guide.generatedAt, by, version: doc.version, type: redraft ? 'redrafted' : 'drafted' }],
  }
}

// ─── download ───────────────────────────────────────────────────────────────

/** Plain-text version of the guide for emailing to the client outside the platform. */
export function guideAsText(doc: GuideDoc, studyName: string, language: string | null): string {
  const g = doc.guide
  if (!g) return ''
  const lines: string[] = [`${studyName}: discussion guide, version ${doc.version}`, `Moderator: ${doc.moderator.mode === 'ai' ? `AI (${agentName(doc.moderator.agentId) ?? 'agent not set'}, ${doc.moderator.style ?? ''} style)` : `Human (${humanNames(doc.moderator).join(', ')})`}`, `Language: ${language ?? 'Not set'}`, `Target duration: ${doc.moderator.durationMin} minutes`, '', 'RESEARCH OBJECTIVES']
  g.objectives.forEach((o, n) => lines.push(`  ${n + 1}. ${o.text}`))
  lines.push('')
  let n = 0
  g.sections.forEach((s, si) => {
    lines.push(`${si + 1}. ${s.title.toUpperCase()} (${s.minutes} min)`)
    s.questions.forEach((x) => {
      n += 1
      lines.push(`  Q${n}. ${x.text}${x.mandatory ? ' [mandatory]' : ' [optional]'}`)
      x.probes.forEach((p) => lines.push(`      Probe: ${p}`))
      const st = x.stimulusId && doc.stimuli.items.find((i) => i.id === x.stimulusId)
      if (st) lines.push(`      Show: ${st.name}`)
      const sv = x.surveyId && surveysOf(doc).find((i) => i.id === x.surveyId)
      if (sv) {
        lines.push(`      Survey: ${sv.title}`)
        sv.questions.forEach((sq, k) => lines.push(`        ${k + 1}. ${sq.text} [${sq.format === 'rating' ? `rating 1 to ${sq.options.length}` : sq.format === 'multiple' ? 'select all that apply' : 'pick one'}]${sq.format === 'rating' ? '' : ` ${sq.options.join(' / ')}`}`))
      }
      if (x.banned.length) lines.push(`      Never say: ${x.banned.join('; ')}`)
    })
    lines.push('')
  })
  lines.push('WRAP-UP CONDITIONS')
  g.wrapUp.forEach((w) => lines.push(`  - ${w}`))
  return lines.join('\n')
}

// ─── structure edits (used by R14) ──────────────────────────────────────────

export const newQuestion = (): Question => ({ id: uid('q'), text: '', mandatory: false, probes: [], banned: [], maxFollowUps: null, covers: [], origin: 'added' })
export const newSection = (): GuideSection => ({ id: uid('s'), title: 'New section', minutes: 0, questions: [], origin: 'added' })

/** Marks an AI question as edited once a person changes it. */
export const touchQuestion = (q: Question): Question => ({ ...q, origin: q.origin === 'ai' ? 'edited' : q.origin })

/** Drops branching rules that point at a question that no longer exists. */
export function pruneBranches(g: Guide): Guide {
  const ids = new Set(allQuestions(g).map((x) => x.id))
  return {
    ...g,
    sections: g.sections.map((s) => ({
      ...s,
      questions: s.questions.map((x) => (x.branch && (!ids.has(x.branch.ifQuestionId) || !ids.has(x.branch.targetId)) ? { ...x, branch: undefined } : x)),
    })),
  }
}

export function moveSection(g: Guide, id: string, dir: -1 | 1): Guide {
  const i = g.sections.findIndex((s) => s.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= g.sections.length) return g
  const sections = [...g.sections]
  ;[sections[i], sections[j]] = [sections[j], sections[i]]
  return { ...g, sections }
}

/** Moves a question up or down; at the edge of a section it moves into the neighbouring one. */
export function moveQuestion(g: Guide, id: string, dir: -1 | 1): Guide {
  const si = g.sections.findIndex((s) => s.questions.some((x) => x.id === id))
  if (si < 0) return g
  const sections = g.sections.map((s) => ({ ...s, questions: [...s.questions] }))
  const qs = sections[si].questions
  const i = qs.findIndex((x) => x.id === id)
  const j = i + dir
  if (j >= 0 && j < qs.length) {
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
  } else {
    const ti = si + dir
    if (ti < 0 || ti >= sections.length) return g
    const [moved] = qs.splice(i, 1)
    if (dir === -1) sections[ti].questions.push(moved)
    else sections[ti].questions.unshift(moved)
  }
  return { ...g, sections }
}

/** The AI's one-click fix for a coverage gap: adds a question for each uncovered objective. */
export function fixCoverage(g: Guide): Guide {
  const gaps = uncoveredObjectives(g)
  if (!gaps.length) return g
  const themes = g.sections.find((s) => /theme/i.test(s.title)) ?? g.sections[Math.min(2, g.sections.length - 1)]
  const added = gaps.map((o) => ({ ...newQuestion(), origin: 'ai' as Origin, text: `Tell me about this: ${o.text.charAt(0).toLowerCase()}${o.text.slice(1)}.`, covers: [o.id], mandatory: true }))
  return { ...g, sections: g.sections.map((s) => (s === themes ? { ...s, questions: [...s.questions, ...added] } : s)) }
}

/** The AI's one-click fix for duration: scales section times to the target, keeping their proportions. */
export function fixDuration(g: Guide, target: number): Guide {
  const sum = totalMinutes(g)
  if (!sum || !g.sections.length) return g
  const sections = g.sections.map((s) => ({ ...s, minutes: Math.max(0, Math.round((s.minutes * target) / sum)) }))
  const diff = target - sections.reduce((n, s) => n + s.minutes, 0)
  const biggest = sections.reduce((b, s, i) => (s.minutes > sections[b].minutes ? i : b), 0)
  sections[biggest] = { ...sections[biggest], minutes: sections[biggest].minutes + diff }
  return { ...g, sections }
}
