// Modules 4.6 and 4.7, seen from the researcher and the moderator: fieldwork sessions, their records, and the
// actions that change them. Sessions are mock records built from the confirmed pool when a release goes live.
// The participant and moderator runtime (4.2 to 4.5) writes through the same actions.

import type { AudienceDoc } from './audience'
import { formatDate, formatSlot } from '@/lib/format'
import { studyTimeZone } from '@/lib/timeZone'
import type { ReviewStatus } from '@/mock/review'
import { now, uid } from './brief'
import type { GuideDoc } from './guide'
import type { LaunchDoc, PlanItem, StudyPlan } from './launch'
import { DEFAULT_COHORT_NAMES, SEED_SESSIONS, sessionIdOf } from '@/mock/sessions'
import { regionOf } from './screening'

export type AccessStatus = 'Invited' | 'Opened' | 'Consented' | 'No-show'
/** "Not started" and "Booked" are additions to the session vocabulary; see docs/OPEN_QUESTIONS.md. */
export type SessionStatus = 'Not started' | 'Booked' | 'Active' | 'Paused' | 'Incomplete (resumable)' | 'Rescheduled' | 'Withdrawn' | 'Technical Error' | 'Completed'
export type EventKind = 'system' | 'participant' | 'moderator' | 'stimulus' | 'survey'
/** `marker: 'handoff'` is the point where a returning participant's new session picked up from the previous one. */
export type SessionEvent = { id: string; at: string; kind: EventKind; text: string; marker?: 'handoff' }
export type StimulusResult = { name: string; result: 'Shown' | 'Failed to load' | 'Not shown' }
/** Survey answers are locked once recorded; follow-up probes never change them. */
export type Answer = { questionId: string; question: string; answer: string; lockedAt: string }
export type TranscriptTurn = { at: string; speaker: string; ai: boolean; text: string }

/** What a returning participant's new session picked up from the previous session's last saved state (4.7). Never a blank restart. */
export type Carried = { from: string; at: string; questions: number; covered: number; answerIds: string[]; stimuliShown: string[]; turns: TranscriptTurn[] }
export type Notes = { takeaways: string; friction: string; missing: string; recontact: 'Yes' | 'No' | 'Maybe'; recontactNote: string; by: string; at: string }

export type Region = 'Northeast' | 'Midwest' | 'South' | 'West'
export const REGIONS: Region[] = ['Northeast', 'Midwest', 'South', 'West']

export type IssueSeverity = 'Blocking' | 'Degraded' | 'Minor'
export type IssueArea = 'Participant device' | 'Network' | 'Platform' | 'Media' | 'Moderator'
/** Every kind of technical problem a session can hit. */
export type IssueType =
  | 'Microphone permission denied'
  | 'Camera not detected'
  | 'Unsupported browser or device'
  | 'Link expired or invalid'
  | 'Consent capture failed'
  | 'Connection lost'
  | 'Audio dropped'
  | 'Video stream interrupted'
  | 'Echo or background noise'
  | 'Stimulus failed to load'
  | 'Survey answer not saved'
  | 'Recording failed to start'
  | 'Recording upload incomplete'
  | 'Transcription delayed'
  | 'AI agent timeout'
  | 'Moderator disconnected'

export const ISSUE_META: Record<IssueType, { area: IssueArea; stage: 'Before the interview' | 'During the interview'; action: string; only?: 'AI-led' | 'Human-led' }> = {
  'Microphone permission denied': { area: 'Participant device', stage: 'Before the interview', action: 'Ask the participant to allow microphone access in the browser, then resend the link.' },
  'Camera not detected': { area: 'Participant device', stage: 'Before the interview', action: 'Ask them to check the camera is connected and not in use, or offer the audio-only access mode.' },
  'Unsupported browser or device': { area: 'Participant device', stage: 'Before the interview', action: 'Send a link to open in a supported browser (Chrome, Safari or Edge).' },
  'Link expired or invalid': { area: 'Platform', stage: 'Before the interview', action: 'Reissue the unique link, or extend the invitation window.' },
  'Consent capture failed': { area: 'Platform', stage: 'Before the interview', action: 'Ask the participant to consent again. No interview starts without a recorded consent.' },
  'Connection lost': { area: 'Network', stage: 'During the interview', action: 'Let the participant resume the same session from their link, or book a new slot.' },
  'Audio dropped': { area: 'Network', stage: 'During the interview', action: 'Check the answer was captured. Ask the question again if part of it was lost.' },
  'Video stream interrupted': { area: 'Media', stage: 'During the interview', action: 'Restart the stream. The session continues once video is back.' },
  'Echo or background noise': { area: 'Participant device', stage: 'During the interview', action: 'Note it for the reviewer. Quality flags are decided in Review.' },
  'Stimulus failed to load': { area: 'Media', stage: 'During the interview', action: 'A failed stimulus counts as not seen. Re-show it, or check the asset in the library.' },
  'Survey answer not saved': { area: 'Platform', stage: 'During the interview', action: 'Re-enter the answer. Once recorded, a survey answer is locked.' },
  'Recording failed to start': { area: 'Media', stage: 'During the interview', action: 'Stop the session. A session without a recording can’t be used, so offer a new slot.' },
  'Recording upload incomplete': { area: 'Media', stage: 'During the interview', action: 'Retry the upload and verify the file before the session goes to Review.' },
  'Transcription delayed': { area: 'Platform', stage: 'During the interview', action: 'No action needed unless it stays delayed. The transcript fills in when ready.' },
  'AI agent timeout': { only: 'AI-led', area: 'Platform', stage: 'During the interview', action: 'Resume the session. If it repeats, pause fieldwork and check the agent.' },
  'Moderator disconnected': { only: 'Human-led', area: 'Moderator', stage: 'During the interview', action: 'The session is rescheduled and the participant is not marked No-show.' },
}
export const ISSUE_TYPES = Object.keys(ISSUE_META) as IssueType[]

export type TechIssue = {
  id: string
  type: IssueType
  severity: IssueSeverity
  at: string
  status: 'Open' | 'Resolved'
  resolution?: string
  resolvedBy?: string
  resolvedAt?: string
}

/** What the participant agreed to, with the wording version, and when it was withdrawn if it was. */
export type ConsentRecord = {
  at: string
  wording: string
  recording: boolean
  aiModerator: boolean
  dataUse: boolean
  /** Optional: may we contact them for future research. */
  recontact: boolean
  over18: boolean
  device: string
  withdrawn?: { at: string; reason: string }
}

export type Session = {
  /** The session's ID, e.g. P-2041-1. A participant who comes back (resume, retry, reschedule) gets P-2041-2. */
  id: string
  /** The person, e.g. P-2041. The main label on every screen. */
  participantId: string
  /** Which of the participant's sessions this is. */
  no: number
  applicantId: string
  ref: string
  cohort: string | null
  region: Region | null
  state: string | null
  device: string
  reserve: boolean
  mode: 'ai' | 'human'
  access: AccessStatus
  status: SessionStatus
  moderatorId: string | null
  slot: string | null
  startedAt: string | null
  durationMin: number | null
  events: SessionEvent[]
  stimuli: StimulusResult[]
  answers: Answer[]
  asked: string[]
  covered: string[]
  followUps: Record<string, number>
  transcript: TranscriptTurn[]
  notes: Notes | null
  issues: TechIssue[]
  consent: ConsentRecord | null
  /** Set on a session that resumed an earlier one: what was carried over, and where. */
  carried?: Carried
  /** Set when the Researcher acted on it from Needs you. A handled session leaves that list. */
  handled?: { action: string; at: string; by: string }
}

/** Someone who passed screening for a cohort after launch. They wait in the reserve until a replacement is approved. */
export type ReserveCandidate = { id: string; cohort: string; contact: string; state: string; region: Region | null; arrivedAt: string; status: 'Reserve' | 'Invited'; invitedAs?: string }

/** Screening reopened for one cohort, with the same screener and audience rules. */
export type Recruiting = { cohort: string; openedAt: string; by: string; screenerVersion: string; status: 'Open' | 'Closed'; arrived: number }

export type LogEntry = { id: string; at: string; by: string; text: string }

export type FieldworkDoc = {
  studyId: string
  /** Which seed session list built this doc. See SESSION_SEED. */
  seed?: number
  releaseNumber: number
  releaseVersion: string
  /** The plan this release runs from. Sessions stay tied to it. */
  plan: StudyPlan
  failedStimuli: string[]
  sessions: Session[]
  /** The fieldwork window from study setup. */
  window: { start: string; end: string } | null
  /** Which consent wording sessions agreed to, e.g. "English (US), approved Oct 26 2026". */
  consentWording: string
  paused: { reason: string; by: string; at: string } | null
  log: LogEntry[]
  /** Eligible applicants who arrived after launch, waiting to be invited as replacements. */
  reserve: ReserveCandidate[]
  /** Cohorts whose screening has been reopened. */
  recruiting: Recruiting[]
}

// ─── mock generation ────────────────────────────────────────────────────────

/** The prototype's clock for fieldwork data. */
export const FIELDWORK_NOW = '2026-11-11T17:00:00-05:00'
const FIELDWORK_START = '2026-11-03T09:00:00-05:00'
const MIN = 60000
const at = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * MIN).toISOString()
const ev = (when: string, kind: EventKind, text: string): SessionEvent => ({ id: uid('ev'), at: when, kind, text })

const PARTICIPANT = [
  'Mostly a gel-cream, morning and night. It’s lightweight, which I like.',
  'I switched last year because my old one felt heavy by midday.',
  'The refill idea is nice, but it would have to feel as good as the jar.',
  'I’d try it if it really lasts all day. I’ve heard that claim before, though.',
  'Honestly the price would decide it for me.',
  'My skin gets tight in winter, so hydration matters most.',
]

export type GenInput = {
  studyId: string
  audience: AudienceDoc
  guide: GuideDoc
  plan: StudyPlan
  releaseNumber: number
  releaseVersion: string
  launch?: LaunchDoc
}

/** Bumped when the seed session list changes, so saved fieldwork is rebuilt from it. */
export const SESSION_SEED = 4

const DEVICES = ['Mobile · iOS Safari', 'Mobile · Android Chrome', 'Desktop · Chrome', 'Desktop · Safari', 'Desktop · Edge']

/** The participant's reference as the Researcher sourced it, masked like the sourcing list. */
const refOf = (id: string) => `Phone · (212) ••• ${id.slice(2)}`

/** Builds the study's sessions from the one seed list (mock/sessions.ts), so Fieldwork and Review always agree. */
export function generateFieldwork(i: GenInput): FieldworkDoc {
  const human = i.guide.moderator.mode === 'human'
  const mods = human ? i.guide.moderator.humanIds : []
  const cohortName = (id: string) => i.audience.def?.cohorts.find((c) => c.id === id)?.name ?? DEFAULT_COHORT_NAMES[id as keyof typeof DEFAULT_COHORT_NAMES] ?? id

  const items = i.plan.sections.flatMap((s) => s.items)
  const mandatory = items.filter((x) => x.core).map((x) => x.id)
  const stimNames = [...new Set(items.map((x) => x.stimulus).filter((x): x is string => !!x))]
  const failed = i.guide.stimuli.items.filter((s) => s.renderOk === false).map((s) => s.name)
  const surveyItems = items.filter((x) => x.survey)
  const options = (text: string) => i.guide.moderator.surveys.find((s) => s.text === text)?.options ?? ['Yes', 'No']
  const lang = i.guide.moderator.language
  const consentAt = i.launch?.setup.consent[lang]?.at
  const wording = `${lang}, approved ${formatDate(consentAt ?? '2026-10-26T15:00:00-04:00')}`

  const raw = SEED_SESSIONS.map((r, n): Session => {
    const modId = human ? (mods[n % mods.length] ?? null) : null
    const moderator = moderatorName(modId)
    const v = r.variant
    const started = v === 'done' || v === 'active' || v === 'incomplete' || v === 'error' || v === 'withdrawn'
    const duration = started && v !== 'active' ? (r.durationMin ?? i.plan.durationMin) : null
    // For a completed session the seed time is when it ended; for the rest it is the person's latest step.
    const t0 = v === 'done' ? at(r.at, -(duration ?? 0)) : r.at
    // Human-led: people who consented book a slot, and a missed slot is sent to rescheduling.
    const slot = human ? (v === 'consented' ? at(FIELDWORK_NOW, (1 + (n % 4)) * 1440 - 6 * 60) : v === 'noshow' ? at(FIELDWORK_NOW, 2 * 1440 - 180) : started ? t0 : null) : null

    const access: AccessStatus = v === 'noshow' ? 'No-show' : v === 'invited' ? 'Invited' : v === 'opened' ? 'Opened' : 'Consented'
    const status: SessionStatus =
      v === 'done' ? 'Completed' : v === 'active' ? 'Active' : v === 'incomplete' ? 'Incomplete (resumable)' : v === 'error' ? 'Technical Error' : v === 'withdrawn' ? 'Withdrawn' : human && v === 'consented' ? 'Booked' : human && v === 'noshow' ? 'Rescheduled' : 'Not started'

    const askedCount = v === 'done' ? items.length : v === 'active' ? 3 : v === 'incomplete' ? 2 : v === 'error' || v === 'withdrawn' ? 1 : 0
    const asked = items.slice(0, askedCount).map((x) => x.id)
    const covered = v === 'done' ? mandatory : v === 'active' ? mandatory.slice(0, 2) : v === 'incomplete' ? mandatory.slice(0, 1) : []
    const shownCount = v === 'done' ? stimNames.length : v === 'active' || v === 'incomplete' ? Math.min(1, stimNames.length) : 0
    // A session whose seed has a stimulus problem lost the second concept card, as its review record shows.
    const stimFault = r.issues?.some(([t]) => t === 'Stimulus failed to load')
    const stimuli: StimulusResult[] = started
      ? stimNames.map((name, j) => ({ name, result: j < shownCount ? (failed.includes(name) || (stimFault && j === 1) ? 'Failed to load' : 'Shown') : 'Not shown' }))
      : []

    const region = (regionOf(r.state) as Region | undefined) ?? null
    const device = DEVICES[(n * 3 + 1) % DEVICES.length]
    // A second session reuses the consent the participant gave in their first one.
    const later = (r.no ?? 1) > 1
    const consented = !later && (access === 'Consented' || v === 'noshow')
    const consent: ConsentRecord | null = consented
      ? {
          at: at(t0, v === 'consented' || v === 'noshow' ? 0 : -300),
          wording,
          recording: true,
          aiModerator: !human,
          dataUse: true,
          recontact: n % 3 !== 0,
          over18: true,
          device,
          withdrawn: v === 'withdrawn' ? { at: at(t0, 6), reason: 'Chose to stop during the interview and withdrew consent for the recording.' } : undefined,
        }
      : null

    const invitedAt = at(FIELDWORK_START, -60 + (n % 6) * 15)
    const events: SessionEvent[] = later ? [ev(at(t0, -5), 'participant', `Came back on a new link. This is session ${r.no}; consent from session 1 still applies.`)] : [ev(invitedAt, 'system', 'Invited to the study')]
    if (!later && access !== 'Invited') events.push(ev(v === 'opened' ? r.at : at(consent?.at ?? t0, -10), 'participant', 'Opened the invite link'))
    if (consent) events.push(ev(consent.at, 'participant', human ? 'Consented to recording' : 'Consented to recording and to an AI moderator'))
    if (human && slot && !started) events.push(ev(at(consent?.at ?? t0, 5), 'system', `Booked a slot with ${moderator}`))
    if (v === 'noshow') events.push(ev(at(t0, 1440), 'system', human ? 'Did not join at the booked slot. Sent to rescheduling (4.7).' : 'Consented but has not started the interview.'))
    if (started) events.push(ev(t0, 'system', human ? `${moderator} joined at the booked slot` : 'Interview started'))
    stimuli.forEach((s, j) => {
      const w = at(t0, 4 + j * 3)
      if (s.result === 'Shown') events.push(ev(w, 'stimulus', `Shown: ${s.name}`))
      if (s.result === 'Failed to load') events.push(ev(w, 'stimulus', `Could not load: ${s.name}. Counted as not seen.`))
    })
    const answers: Answer[] = v === 'done' ? surveyItems.map((x) => ({ questionId: x.id, question: x.survey!, answer: options(x.survey!)[n % options(x.survey!).length], lockedAt: at(t0, 12) })) : []
    answers.forEach((a) => events.push(ev(a.lockedAt, 'survey', `Answered and locked: ${a.question}`)))
    if (v === 'incomplete') events.push(ev(at(t0, 9), 'system', 'The participant left. The session can be resumed.'))
    if (v === 'error') events.push(ev(at(t0, 3), 'system', 'Technical error: the connection dropped before the session could continue.'))
    if (v === 'withdrawn') events.push(ev(at(t0, 6), 'participant', 'Withdrew from the study. Consent for the recording was withdrawn.'))
    if (v === 'done') events.push(ev(r.at, 'system', 'Interview completed'))

    const transcript: TranscriptTurn[] = items.slice(0, Math.min(askedCount, 3)).flatMap((x, j) => [
      { at: at(t0, j * 3), speaker: moderator, ai: !human, text: x.text },
      { at: at(t0, j * 3 + 1), speaker: 'Participant', ai: false, text: PARTICIPANT[(n + j) % PARTICIPANT.length] },
    ])

    const issues: TechIssue[] = (r.issues ?? [])
      .map(([type, severity, st, resolution], j): TechIssue => {
        // Human-led sessions have a moderator who can drop, not an AI agent that can time out.
        const t = (human && type === 'AI agent timeout' ? 'Moderator disconnected' : type) as IssueType
        const when = at(t0, started ? 3 + j * 4 : 20)
        return { id: `${sessionIdOf(r)}-ti${j + 1}`, type: t as IssueType, severity, at: when, status: st, resolution, resolvedBy: st === 'Resolved' ? 'Maya Ortiz' : undefined, resolvedAt: st === 'Resolved' ? at(when, 25) : undefined }
      })
      .filter((x) => !ISSUE_META[x.type].only || ISSUE_META[x.type].only === (human ? 'Human-led' : 'AI-led'))

    return {
      id: sessionIdOf(r),
      participantId: r.participant,
      no: r.no ?? 1,
      applicantId: `A-${r.participant.slice(2)}`,
      ref: refOf(r.participant),
      cohort: cohortName(r.cohortId),
      region,
      state: r.state,
      device,
      reserve: false,
      mode: human ? 'human' : 'ai',
      access,
      status,
      moderatorId: modId,
      slot,
      startedAt: started ? t0 : null,
      durationMin: duration,
      events: events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
      stimuli,
      answers,
      asked,
      covered,
      followUps: {},
      transcript,
      issues,
      consent,
      notes:
        human && v === 'done' && n === 0
          ? { takeaways: 'Hydration matters most. Concept A’s 72-hour claim was doubted until she heard the test method.', friction: 'The refill question came late and felt rushed.', missing: 'None.', recontact: 'Yes', recontactNote: 'Open to a follow-up on the refill pouch.', by: moderator, at: at(r.at, 20) }
          : null,
    }
  })

  // A returning participant's later session resumes from the previous one's last saved state.
  const sessions = raw.map((s) => {
    const prev = s.no > 1 ? raw.find((x) => x.participantId === s.participantId && x.no === s.no - 1) : undefined
    return prev ? resumeFrom(prev, s) : s
  })

  return {
    studyId: i.studyId,
    seed: SESSION_SEED,
    releaseNumber: i.releaseNumber,
    releaseVersion: i.releaseVersion,
    plan: i.plan,
    failedStimuli: failed,
    sessions,
    window: i.launch?.setup.fieldwork ?? { start: '2026-11-03', end: '2026-11-17' },
    consentWording: wording,
    paused: null,
    log: [],
    reserve: [],
    recruiting: [],
  }
}

/**
 * The new session starts from the previous session's last saved state: questions asked, what was covered, stimuli
 * shown, locked survey answers and the conversation so far. The handoff point is marked in its timeline.
 */
export function resumeFrom(prev: Session, next: Session): Session {
  const lastSaved = prev.events.reduce((m, e) => (e.at > m ? e.at : m), prev.events[0]?.at ?? FIELDWORK_NOW)
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]
  const stimuli = [...prev.stimuli.filter((x) => x.result === 'Shown'), ...next.stimuli.filter((x) => !prev.stimuli.some((y) => y.name === x.name && y.result === 'Shown'))]
  const answers = [...prev.answers, ...next.answers.filter((a) => !prev.answers.some((x) => x.questionId === a.questionId))]
  const first = next.events[0]?.at ?? lastSaved
  const marker: SessionEvent = {
    id: uid('ev'),
    at: new Date(new Date(first).getTime() + 1000).toISOString(),
    kind: 'system',
    marker: 'handoff',
    text: `Handoff point: resumed from the last saved state of ${prev.id}. ${prev.asked.length} ${prev.asked.length === 1 ? 'question' : 'questions'} already asked and ${prev.answers.length} survey ${prev.answers.length === 1 ? 'answer' : 'answers'} kept. Nothing is asked again.`,
  }
  return {
    ...next,
    asked: union(prev.asked, next.asked),
    covered: union(prev.covered, next.covered),
    followUps: { ...prev.followUps, ...next.followUps },
    stimuli,
    answers,
    transcript: [...prev.transcript, ...next.transcript.slice(prev.transcript.length)],
    events: [...next.events, marker].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    carried: { from: prev.id, at: lastSaved, questions: prev.asked.length, covered: prev.covered.length, answerIds: prev.answers.map((a) => a.questionId), stimuliShown: prev.stimuli.filter((x) => x.result === 'Shown').map((x) => x.name), turns: prev.transcript },
  }
}

/** Names of the human moderators the mock data can assign. */
export const HUMAN_MODERATOR_IDS = ['u-priya', 'u-jordan', 'u-sam', 'u-elena']
const HUMAN_NAMES: Record<string, string> = { 'u-jordan': 'Jordan Lee', 'u-priya': 'Priya Shah', 'u-sam': 'Sam Okafor', 'u-elena': 'Elena Brooks' }
/** The same name Review shows for the session's moderator. */
export const moderatorName = (id: string | null) => (id ? (HUMAN_NAMES[id] ?? id) : 'AI agent (Ava)')

// ─── reading ────────────────────────────────────────────────────────────────

export const planItems = (plan: StudyPlan): (PlanItem & { section: string })[] => plan.sections.flatMap((s) => s.items.map((x) => ({ ...x, section: s.title })))

// ─── participants and sessions ──────────────────────────────────────────────

/** A person and every session they have had. Counts of people always use `latest`; counts of sessions use `sessions`. */
export type Participant = { id: string; sessions: Session[]; first: Session; latest: Session }

export function participantsOf(doc: FieldworkDoc): Participant[] {
  const by = new Map<string, Session[]>()
  doc.sessions.forEach((s) => by.set(s.participantId, [...(by.get(s.participantId) ?? []), s]))
  return [...by.entries()].map(([id, list]) => {
    const sessions = [...list].sort((a, b) => a.no - b.no)
    return { id, sessions, first: sessions[0], latest: sessions[sessions.length - 1] }
  })
}

export const latestSessions = (doc: FieldworkDoc) => participantsOf(doc).map((p) => p.latest)
export const sessionCountOf = (doc: FieldworkDoc, s: Pick<Session, 'participantId'>) => doc.sessions.filter((x) => x.participantId === s.participantId).length
export const sessionsOfParticipant = (doc: FieldworkDoc, participantId: string) => doc.sessions.filter((x) => x.participantId === participantId).sort((a, b) => a.no - b.no)

/** A URL can name a session (P-2041-2) or just the participant (P-2041), which means their latest session. */
export function resolveSession(doc: FieldworkDoc, param: string): { session: Session; exact: boolean } | undefined {
  const exact = doc.sessions.find((x) => x.id === param)
  if (exact) return { session: exact, exact: true }
  const mine = sessionsOfParticipant(doc, param)
  return mine.length ? { session: mine[mine.length - 1], exact: false } : undefined
}

// ─── progress: confirmed and pending ────────────────────────────────────────

/** Review outcomes by session ID. A completed session with no review record yet is waiting in the queue. */
export type Outcomes = ReadonlyMap<string, ReviewStatus>
const outcomeOf = (outcomes: Outcomes, s: Session): ReviewStatus => outcomes.get(s.id) ?? 'Under review'

/** Completed sessions that count toward the target: Accepted (confirmed) or Under review (pending). Excluded ones are out of quotas. */
export const countsToward = (x: Session, outcomes: Outcomes) => x.status === 'Completed' && !x.reserve && outcomeOf(outcomes, x) !== 'Excluded'

/** Two numbers wherever progress appears: confirmed (Accepted) and pending (Under review). Excluded are removed. */
export function progress(doc: FieldworkDoc, outcomes: Outcomes) {
  const done = doc.sessions.filter((x) => x.status === 'Completed' && !x.reserve)
  const n = (st: ReviewStatus) => done.filter((x) => outcomeOf(outcomes, x) === st).length
  const confirmed = n('Accepted')
  const pending = n('Under review')
  return { completed: done.length, confirmed, pending, excluded: n('Excluded'), toward: confirmed + pending }
}

export function quotaFill(doc: FieldworkDoc, audience: AudienceDoc | undefined, outcomes: Outcomes) {
  return (audience?.def?.cohorts ?? []).map((c) => {
    const mine = doc.sessions.filter((x) => x.cohort === c.name && x.status === 'Completed' && !x.reserve)
    const n = (st: ReviewStatus) => mine.filter((x) => outcomeOf(outcomes, x) === st).length
    const accepted = n('Accepted')
    const pending = n('Under review')
    return {
      id: c.id,
      name: c.name,
      target: c.participants ?? 0,
      accepted,
      pending,
      excluded: n('Excluded'),
      /** Toward the quota: accepted plus pending. */
      completed: accepted + pending,
      inProgress: doc.sessions.filter((x) => x.cohort === c.name && (x.status === 'Active' || x.status === 'Paused')).length,
      reserve: doc.sessions.filter((x) => x.cohort === c.name && x.reserve).length,
    }
  })
}

export function findSession(all: Record<string, FieldworkDoc>, id: string): { doc: FieldworkDoc; session: Session } | undefined {
  for (const doc of Object.values(all)) {
    const session = doc.sessions.find((x) => x.id === id)
    if (session) return { doc, session }
  }
}

export const sessionEnded = (s: Session) => s.status === 'Completed' || s.status === 'Incomplete (resumable)' || s.status === 'Technical Error'

// ─── actions ────────────────────────────────────────────────────────────────

const patch = (doc: FieldworkDoc, id: string, fn: (s: Session) => Session): FieldworkDoc => ({ ...doc, sessions: doc.sessions.map((s) => (s.id === id ? fn(s) : s)) })
const addEvent = (s: Session, kind: EventKind, text: string): Session => ({ ...s, events: [...s.events, ev(now(), kind, text)] })
const addEventAt = (when: string, s: Session, kind: EventKind, text: string): Session => ({ ...s, events: [...s.events, ev(when, kind, text)] })
const addTurn = (s: Session, speaker: string, ai: boolean, text: string): Session => ({ ...s, transcript: [...s.transcript, { at: now(), speaker, ai, text }] })

export function startSession(doc: FieldworkDoc, id: string, by: string): FieldworkDoc {
  return patch(doc, id, (s) => (s.status === 'Booked' || s.status === 'Rescheduled' || s.status === 'Incomplete (resumable)' ? addEvent({ ...s, status: 'Active', startedAt: s.startedAt ?? now() }, 'system', `${by} started the session`) : s))
}

export function endSession(doc: FieldworkDoc, id: string, by: string, outcome: 'Completed' | 'Incomplete (resumable)'): FieldworkDoc {
  return patch(doc, id, (s) => {
    if (s.status !== 'Active') return s
    const mins = s.startedAt ? Math.max(1, Math.round((Date.now() - new Date(s.startedAt).getTime()) / MIN)) : 1
    return addEvent({ ...s, status: outcome, durationMin: s.durationMin ?? Math.min(mins, doc.plan.durationMin) }, 'moderator', outcome === 'Completed' ? `${by} ended the session` : `${by} ended the session early. It can be resumed.`)
  })
}

export const askQuestion = (doc: FieldworkDoc, id: string, item: PlanItem, by: string, ai: boolean) =>
  patch(doc, id, (s) => (s.status !== 'Active' || s.asked.includes(item.id) ? s : addTurn(addEvent({ ...s, asked: [...s.asked, item.id] }, 'moderator', `Asked Q${item.n}`), by, ai, item.text)))

export const markCovered = (doc: FieldworkDoc, id: string, item: PlanItem, by: string) =>
  patch(doc, id, (s) => (s.status !== 'Active' || s.covered.includes(item.id) ? s : addEvent({ ...s, covered: [...s.covered, item.id] }, 'moderator', `${by} marked Q${item.n} covered`)))

/** A permitted probe. Stops at the question's maximum follow-ups. */
export const useProbe = (doc: FieldworkDoc, id: string, item: PlanItem, probe: string, by: string) =>
  patch(doc, id, (s) => {
    const used = s.followUps[item.id] ?? 0
    if (s.status !== 'Active' || (item.maxFollowUps !== null && used >= item.maxFollowUps)) return s
    return addTurn(addEvent({ ...s, followUps: { ...s.followUps, [item.id]: used + 1 } }, 'moderator', `Follow-up ${used + 1} on Q${item.n}`), by, false, probe)
  })

export const showStimulus = (doc: FieldworkDoc, id: string, name: string) =>
  patch(doc, id, (s) => {
    if (s.status !== 'Active' || s.stimuli.some((x) => x.name === name && x.result !== 'Not shown')) return s
    const failed = doc.failedStimuli.includes(name)
    const stimuli = s.stimuli.some((x) => x.name === name) ? s.stimuli.map((x) => (x.name === name ? { ...x, result: failed ? ('Failed to load' as const) : ('Shown' as const) } : x)) : [...s.stimuli, { name, result: failed ? ('Failed to load' as const) : ('Shown' as const) }]
    return addEvent({ ...s, stimuli }, 'stimulus', failed ? `Could not load: ${name}. Counted as not seen.` : `Shown: ${name}`)
  })

/** Survey answers are fixed once recorded. A second answer to the same question is ignored. */
export const recordAnswer = (doc: FieldworkDoc, id: string, item: PlanItem, answer: string) =>
  patch(doc, id, (s) => (s.status !== 'Active' || s.answers.some((a) => a.questionId === item.id) ? s : addEvent({ ...s, answers: [...s.answers, { questionId: item.id, question: item.survey ?? '', answer, lockedAt: now() }] }, 'survey', `Answered and locked: ${item.survey}`)))

export const submitNotes = (doc: FieldworkDoc, id: string, notes: Notes) => patch(doc, id, (s) => (sessionEnded(s) && !s.notes ? addEvent({ ...s, notes }, 'moderator', `${notes.by} submitted post-session notes`) : s))

/**
 * The time for a new fieldwork event: the prototype's fieldwork clock, or just after the latest thing already
 * recorded, so new entries always come after the seeded ones.
 */
export function tick(doc: FieldworkDoc): string {
  const latest = [FIELDWORK_NOW, ...doc.log.map((l) => l.at), ...doc.sessions.flatMap((s) => s.events.map((e) => e.at))].reduce((m, x) => Math.max(m, new Date(x).getTime()), 0)
  return new Date(latest + MIN).toISOString()
}

export const pauseFieldwork = (doc: FieldworkDoc, reason: string, by: string): FieldworkDoc => {
  const when = tick(doc)
  return doc.paused ? doc : { ...doc, paused: { reason: reason.trim(), by, at: when }, log: [...doc.log, { id: uid('fl'), at: when, by, text: `Paused fieldwork: ${reason.trim()}` }] }
}

export const resumeFieldwork = (doc: FieldworkDoc, by: string): FieldworkDoc =>
  doc.paused ? { ...doc, paused: null, log: [...doc.log, { id: uid('fl'), at: tick(doc), by, text: 'Resumed fieldwork' }] } : doc

// ─── monitoring figures (R18) ───────────────────────────────────────────────

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

export function durationStats(doc: FieldworkDoc) {
  const done = doc.sessions.filter((x) => x.status === 'Completed' && x.durationMin !== null)
  const d = done.map((x) => x.durationMin as number).sort((a, b) => a - b)
  const target = doc.plan.durationMin
  const byCohort = [...new Set(done.map((x) => x.cohort ?? 'No cohort'))].map((c) => {
    const xs = done.filter((x) => (x.cohort ?? 'No cohort') === c).map((x) => x.durationMin as number)
    return { name: c, n: xs.length, avg: avg(xs) }
  })
  return {
    n: d.length,
    target,
    avg: avg(d),
    median: d.length ? d[Math.floor(d.length / 2)] : null,
    min: d[0] ?? null,
    max: d[d.length - 1] ?? null,
    over: d.filter((x) => x > target).length,
    byCohort,
    partial: doc.sessions.filter((x) => x.status === 'Incomplete (resumable)' || x.status === 'Withdrawn' || x.status === 'Technical Error').length,
  }
}

/** Pace against the fieldwork window, on the prototype clock. */
export function pacing(doc: FieldworkDoc, target: number, outcomes: Outcomes) {
  const w = doc.window
  const completed = doc.sessions.filter((x) => countsToward(x, outcomes)).length
  if (!w) return { completed, target, days: 0, day: 0, expected: 0, projected: completed, left: 0 }
  const day0 = new Date(`${w.start}T00:00:00-05:00`).getTime()
  const end = new Date(`${w.end}T23:59:59-05:00`).getTime()
  const days = Math.round((end - day0) / 86400000)
  const day = Math.min(days, Math.max(1, Math.ceil((new Date(FIELDWORK_NOW).getTime() - day0) / 86400000)))
  const expected = Math.round((target * day) / days)
  const projected = Math.round((completed / day) * days)
  return { completed, target, days, day, expected, projected, left: days - day }
}

export function regionMatrix(doc: FieldworkDoc, audience: AudienceDoc | undefined, outcomes: Outcomes) {
  const cohorts = audience?.def?.cohorts ?? []
  const done = doc.sessions.filter((x) => countsToward(x, outcomes))
  const rows = cohorts.map((c) => {
    const mine = done.filter((x) => x.cohort === c.name)
    return { id: c.id, name: c.name, target: c.participants ?? 0, completed: mine.length, byRegion: Object.fromEntries(REGIONS.map((r) => [r, mine.filter((x) => x.region === r).length])) as Record<Region, number> }
  })
  const totals = Object.fromEntries(REGIONS.map((r) => [r, done.filter((x) => x.region === r).length])) as Record<Region, number>
  return { rows, totals, total: done.length, unplaced: done.filter((x) => !x.region).length }
}

/**
 * Says so only when the regions are skewed: with at least six interviews counted, one region holds more than half
 * of them, or (with ten or more) a region has none. Otherwise there is nothing to alert on.
 */
export function regionSkew(totals: Record<Region, number>, total: number): string | undefined {
  if (total < 6) return undefined
  const top = REGIONS.reduce((a, r) => (totals[r] > totals[a] ? r : a), REGIONS[0])
  if (totals[top] / total > 0.5) return `${top} holds ${totals[top]} of the ${total} interviews counted (${Math.round((totals[top] / total) * 100)}%). Recruit more from the other regions if the client needs a spread.`
  const empty = REGIONS.filter((r) => totals[r] === 0)
  if (total >= 10 && empty.length) return `No interviews counted from ${empty.join(' or ')} yet, out of ${total}.`
  return undefined
}

export function issueSummary(doc: FieldworkDoc) {
  const all = doc.sessions.flatMap((s) => s.issues.map((i) => ({ ...i, sessionId: s.id, participantId: s.participantId, no: s.no, ref: s.ref })))
  return {
    all,
    open: all.filter((x) => x.status === 'Open').length,
    blocking: all.filter((x) => x.status === 'Open' && x.severity === 'Blocking').length,
    resolved: all.filter((x) => x.status === 'Resolved').length,
    sessions: new Set(all.map((x) => x.sessionId)).size,
    byType: ISSUE_TYPES.map((t) => {
      const xs = all.filter((x) => x.type === t)
      return { type: t, ...ISSUE_META[t], count: xs.length, open: xs.filter((x) => x.status === 'Open').length, sessions: [...new Set(xs.map((x) => x.sessionId))] }
    }),
  }
}

/** Consent is given once per participant, in their first session; later sessions reuse it. */
export function consentSummary(doc: FieldworkDoc) {
  const ps = participantsOf(doc)
  const given = ps.filter((p) => p.first.consent && !p.first.consent.withdrawn)
  const withdrawn = ps.filter((p) => p.first.consent?.withdrawn)
  const pending = ps.filter((p) => !p.first.consent)
  const recontact = given.filter((p) => p.first.consent!.recontact).length
  return { given: given.length, withdrawn: withdrawn.length, pending: pending.length, recontact, recontactPct: given.length ? Math.round((recontact / given.length) * 100) : 0, total: ps.length }
}

export const resolveIssue = (doc: FieldworkDoc, sessionId: string, issueId: string, by: string, resolution: string): FieldworkDoc => {
  const when = tick(doc)
  const type = doc.sessions.find((s) => s.id === sessionId)?.issues.find((x) => x.id === issueId)?.type
  return {
    ...patch(doc, sessionId, (s) => addEventAt(when, { ...s, issues: s.issues.map((x) => (x.id === issueId && x.status === 'Open' ? { ...x, status: 'Resolved' as const, resolution: resolution.trim(), resolvedBy: by, resolvedAt: when } : x)) }, 'system', `${type} marked resolved by ${by}`)),
    log: [...doc.log, { id: uid('fl'), at: when, by, text: `Resolved “${type}” on ${sessionId}: ${resolution.trim()}` }],
  }
}

// ─── Needs you: what the Researcher can do about a session ──────────────────

const logged = (doc: FieldworkDoc, when: string, by: string, text: string): FieldworkDoc => ({ ...doc, log: [...doc.log, { id: uid('fl'), at: when, by, text }] })
const handledBy = (s: Session, when: string, by: string, action: string): Session => ({ ...s, handled: { action, at: when, by } })

/** Sends the participant their link again (a resume link if they left part-way). */
export function resendLink(doc: FieldworkDoc, sessionId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  const resume = s.status === 'Incomplete (resumable)'
  return logged(
    patch(doc, sessionId, (x) => handledBy(addEventAt(when, x, 'system', `${by} resent the ${resume ? 'resume ' : ''}link`), when, by, 'Resend link')),
    when,
    by,
    `Resent the ${resume ? 'resume ' : ''}link to ${s.participantId}`,
  )
}

/**
 * A retry is a new session for the same participant (P-2048-1 stays as it was and P-2048-2 begins), but it resumes:
 * the new session loads the previous session's last saved state (4.7) instead of starting blank.
 */
export function retrySession(doc: FieldworkDoc, sessionId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  const no = Math.max(...sessionsOfParticipant(doc, s.participantId).map((x) => x.no)) + 1
  const blank: Session = {
    id: `${s.participantId}-${no}`,
    participantId: s.participantId,
    no,
    applicantId: s.applicantId,
    ref: s.ref,
    cohort: s.cohort,
    region: s.region,
    state: s.state,
    device: s.device,
    reserve: s.reserve,
    mode: s.mode,
    access: 'Consented',
    status: 'Not started',
    moderatorId: s.moderatorId,
    slot: null,
    startedAt: null,
    durationMin: null,
    events: [ev(when, 'system', `${by} sent a retry link. Session ${no} starts when the participant opens it. Consent from session 1 still applies.`)],
    stimuli: [],
    answers: [],
    asked: [],
    covered: [],
    followUps: {},
    transcript: [],
    notes: null,
    issues: [],
    consent: null,
  }
  const next = resumeFrom(s, blank)
  const marked = patch(doc, sessionId, (x) => handledBy(addEventAt(when, x, 'system', `${by} sent a retry link. Session ${no} was created and will resume from here.`), when, by, 'Retry'))
  return logged({ ...marked, sessions: [...marked.sessions, next] }, when, by, `Sent a retry link to ${s.participantId}. Session ${no} resumes from session ${s.no}`)
}

/**
 * Approving a replacement invites a reserve candidate: they become a new participant with a first session. If the
 * replacement is for a participant who withdrew, that participant leaves Needs you.
 */
export function approveReplacement(doc: FieldworkDoc, by: string, target: { sessionId?: string; candidate: ReserveCandidate }): FieldworkDoc {
  const when = tick(doc)
  const c = target.candidate
  const n = Math.max(2040, ...doc.sessions.map((x) => parseInt(x.participantId.slice(2), 10) || 0)) + 1
  const participantId = `P-${n}`
  const replaced = target.sessionId ? doc.sessions.find((x) => x.id === target.sessionId) : undefined
  const first = doc.sessions[0]
  const session: Session = {
    id: `${participantId}-1`,
    participantId,
    no: 1,
    applicantId: c.id,
    ref: c.contact,
    cohort: c.cohort,
    region: c.region,
    state: c.state,
    device: 'Not known yet',
    reserve: false,
    mode: first?.mode ?? 'ai',
    access: 'Invited',
    status: 'Not started',
    moderatorId: null,
    slot: null,
    startedAt: null,
    durationMin: null,
    events: [ev(when, 'system', `Invited as a replacement from the reserve${replaced ? ` for ${replaced.participantId}` : ''}. Approved by ${by}.`)],
    stimuli: [],
    answers: [],
    asked: [],
    covered: [],
    followUps: {},
    transcript: [],
    notes: null,
    issues: [],
    consent: null,
  }
  const reserve = doc.reserve.some((x) => x.id === c.id) ? doc.reserve.map((x) => (x.id === c.id ? { ...x, status: 'Invited' as const, invitedAs: participantId } : x)) : [...doc.reserve, { ...c, status: 'Invited' as const, invitedAs: participantId }]
  const base: FieldworkDoc = { ...doc, reserve, sessions: [...doc.sessions, session] }
  const done = replaced ? patch(base, replaced.id, (x) => handledBy(addEventAt(when, x, 'system', `${by} approved a replacement: ${c.id} was invited as ${participantId}`), when, by, 'Approve replacement')) : base
  return logged(done, when, by, `Approved a replacement from the reserve${replaced ? ` for ${replaced.participantId}` : ''}: invited ${c.id} (${c.cohort}) as ${participantId}`)
}

/** Reopens screening for one cohort. The screener and the audience rules are unchanged, so no new version is made. */
export function reopenScreening(doc: FieldworkDoc, cohort: string, by: string, screenerVersion: string): FieldworkDoc {
  if (doc.recruiting.some((r) => r.cohort === cohort && r.status === 'Open')) return doc
  const when = tick(doc)
  return logged({ ...doc, recruiting: [...doc.recruiting.filter((r) => r.cohort !== cohort), { cohort, openedAt: when, by, screenerVersion, status: 'Open', arrived: 0 }] }, when, by, `Reopened screening for ${cohort} (${screenerVersion}, unchanged)`)
}

export function closeScreening(doc: FieldworkDoc, cohort: string, by: string): FieldworkDoc {
  const when = tick(doc)
  return logged({ ...doc, recruiting: doc.recruiting.map((r) => (r.cohort === cohort ? { ...r, status: 'Closed' as const } : r)) }, when, by, `Closed screening for ${cohort}`)
}

const ARRIVALS: Record<string, [string, string]> = { 'Younger, 25–34': ['Oregon', 'Phone · (503) ••• 4418'], 'Older, 35–44': ['Minnesota', 'Phone · (612) ••• 9072'] }

/** The mock: one applicant arrives for a cohort whose screening is open, passes the same rules, and goes to the reserve. */
export function arriveCandidate(doc: FieldworkDoc, cohort: string): FieldworkDoc {
  const r = doc.recruiting.find((x) => x.cohort === cohort && x.status === 'Open' && x.arrived === 0)
  if (!r) return doc
  const when = tick(doc)
  const [state, contact] = ARRIVALS[cohort] ?? ['Oregon', 'Phone · (503) ••• 4418']
  const candidate: ReserveCandidate = { id: `A-${2101 + doc.reserve.length}`, cohort, contact, state, region: (regionOf(state) as Region | undefined) ?? null, arrivedAt: when, status: 'Reserve' }
  return logged({ ...doc, reserve: [...doc.reserve, candidate], recruiting: doc.recruiting.map((x) => (x === r ? { ...x, arrived: 1 } : x)) }, when, 'PulseAI', `${candidate.id} passed screening for ${cohort} and went to the reserve list`)
}

/** Books the next free slot, two days out at 10:00, for a participant who missed or moved theirs. */
export function rescheduleSession(doc: FieldworkDoc, sessionId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  const day = new Date(new Date(when).getTime() + 2 * 1440 * MIN).toLocaleDateString('en-CA', { timeZone: studyTimeZone() })
  const slot = new Date(`${day}T10:00:00-05:00`).toISOString()
  return logged(
    patch(doc, sessionId, (x) => handledBy(addEventAt(when, { ...x, slot, status: 'Booked' }, 'system', `${by} rescheduled the session to ${formatSlot(slot)}`), when, by, 'Reschedule')),
    when,
    by,
    `Rescheduled ${s.participantId} to ${formatSlot(slot)}`,
  )
}

export function assignModerator(doc: FieldworkDoc, sessionId: string, moderatorId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  return logged(
    patch(doc, sessionId, (x) => handledBy(addEventAt(when, { ...x, moderatorId }, 'system', `${by} assigned ${moderatorName(moderatorId)}`), when, by, 'Assign moderator')),
    when,
    by,
    `Assigned ${moderatorName(moderatorId)} to ${s.participantId}`,
  )
}
