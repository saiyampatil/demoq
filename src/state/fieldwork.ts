// Modules 4.6 and 4.7, seen from the researcher and the moderator: fieldwork sessions, their records, and the
// actions that change them. Sessions are mock records built from the confirmed pool when a release goes live.
// The participant and moderator runtime (4.2 to 4.5) writes through the same actions.

import { TERMINATE_IN_PROGRESS_AS } from '@/config/terminate'
import type { AudienceDoc, SourceTag } from './audience'
import { formatDate, formatDay, formatSlot } from '@/lib/format'
import { studyTimeZone } from '@/lib/timeZone'
import type { ReviewStatus } from '@/mock/review'
import { now, uid } from './brief'
import { surveyAnswerFor } from '@/mock/surveys'
import { humanIdsOf, surveysOf, type GuideDoc } from './guide'
import type { LaunchDoc, PlanItem, StudyPlan } from './launch'
import { SEED_SESSIONS, sessionIdOf, type SeedSession } from '@/mock/sessions'
import { MODERATOR_ROSTER, STUDY_ZONE } from '@/mock/moderation'
import { countryOfRegion, participantEmail } from '@/mock/participants'
import { inheritablePlan, planned, type SessionPlan } from './stimulusPlans'
import { regionOf } from './screening'
import { profileEdit } from './moderatorProfiles'
import { getTeamPerson } from './teamModerators'
import { busyAt, nextWeekdayAt, openSlots, slotProblem, type Busy, type Slot } from './standby'

export type AccessStatus = 'Invited' | 'Opened' | 'Consented' | 'No-show'
/** "Not started" and "Booked" are additions to the session vocabulary; see docs/OPEN_QUESTIONS.md. */
export type SessionStatus = 'Not started' | 'Booked' | 'Active' | 'Paused' | 'Incomplete (resumable)' | 'Rescheduled' | 'Withdrawn' | 'Technical Error' | 'Completed'
export type EventKind = 'system' | 'participant' | 'moderator' | 'stimulus' | 'survey'
/** `marker: 'handoff'` is the point where a returning participant's new session picked up from the previous one. */
export type SessionEvent = { id: string; at: string; kind: EventKind; text: string; marker?: 'handoff' }
export type StimulusResult = { name: string; result: 'Shown' | 'Failed to load' | 'Not shown' }
/** Survey answers are locked once recorded; follow-up probes never change them. */
/** `survey` is the survey's title, so a session with several questions groups them. A multiple choice answer lists its picks, separated by semicolons. */
export type Answer = { questionId: string; survey?: string; question: string; answer: string; lockedAt: string }
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

/**
 * What ends an issue. Nobody confirms a fix they can't see: an issue resolves from the next event, not from a click.
 *   session-start  the participant's next session starts (device and browser problems, a rescheduled session)
 *   resume         the participant resumes (connection lost)
 *   link-opened    the reissued link is opened (link expired)
 *   system         PulseAI recovers (transcription, media and platform problems; the Researcher has nothing to do)
 * A Researcher can also end one by giving up on the participant, or by closing it without a fix with a reason.
 */
export type ResolvedVia = 'session-start' | 'resume' | 'link-opened' | 'system' | 'self-service' | 'gave-up' | 'closed'
export type IssueFix = { fixer: 'Participant' | 'Researcher' | 'PulseAI'; via: 'session-start' | 'resume' | 'link-opened' | 'system'; resolvesWhen: string }

const NEXT_SESSION: IssueFix = { fixer: 'Participant', via: 'session-start', resolvesWhen: 'The participant’s next session starts' }
const SYSTEM: IssueFix = { fixer: 'PulseAI', via: 'system', resolvesWhen: 'PulseAI recovers' }
export const ISSUE_FIX: Record<IssueType, IssueFix> = {
  'Microphone permission denied': NEXT_SESSION,
  'Camera not detected': NEXT_SESSION,
  'Unsupported browser or device': NEXT_SESSION,
  'Link expired or invalid': { fixer: 'Researcher', via: 'link-opened', resolvesWhen: 'The reissued link is opened' },
  'Connection lost': { fixer: 'Participant', via: 'resume', resolvesWhen: 'The participant resumes' },
  'Moderator disconnected': { fixer: 'Researcher', via: 'session-start', resolvesWhen: 'The rescheduled session starts' },
  'Consent capture failed': SYSTEM,
  'Audio dropped': SYSTEM,
  'Video stream interrupted': SYSTEM,
  'Echo or background noise': SYSTEM,
  'Stimulus failed to load': SYSTEM,
  'Survey answer not saved': SYSTEM,
  'Recording failed to start': SYSTEM,
  'Recording upload incomplete': SYSTEM,
  'Transcription delayed': SYSTEM,
  'AI agent timeout': SYSTEM,
}
/** PulseAI is handling it: the Researcher has no action on it. */
export const handledBySystem = (t: IssueType) => ISSUE_FIX[t].fixer === 'PulseAI'

/** What resolved it, in the words shown after "Resolved:". */
const RESOLVED_LABEL: Record<Exclude<ResolvedVia, 'gave-up' | 'closed'>, string> = {
  'session-start': 'participant started their next session',
  resume: 'participant resumed',
  'link-opened': 'the reissued link was opened',
  system: 'PulseAI recovered',
  'self-service': 'the participant fixed it with the on-screen steps',
}

export type TechIssue = {
  id: string
  type: IssueType
  severity: IssueSeverity
  at: string
  status: 'Open' | 'Resolved'
  resolution?: string
  resolvedBy?: string
  resolvedAt?: string
  /** The participant fixed it themselves with the on-screen steps (P18), before the Researcher had to do anything. */
  selfService?: boolean
  /** The event that resolved it. An issue is never resolved by a bare click: it is an event, or a reason. */
  via?: ResolvedVia
  /** What happened, for the record, when the seed or the Researcher said more than the event does. */
  detail?: string
}

/**
 * One go at fixing a problem without the Researcher. The participant is walked through steps and re-checks; after
 * one retry that still fails it goes to the Researcher (Needs you), with a note that this was already tried.
 */
export type SelfService = {
  id: string
  issue: IssueType
  startedAt: string
  /** How many times they pressed Try again. */
  checks: number
  outcome: 'resolved' | 'unresolved'
  at: string
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

/**
 * A participant asked to talk to a person during an AI interview. They see the standby moderators' calendar and choose:
 * book a time (it was free, so nothing needs answering), ask for a time that suits them (the moderator accepts or
 * declines), or end the interview. A request nobody answers, or that is declined, falls to the Researcher
 * ("Waiting for moderator"), who can assign a moderator or send a booking link. This is only ever shown on the session.
 */
export type RequestWindow = 'Morning' | 'Afternoon' | 'Evening'
export type TimeRequest = {
  sentAt: string
  /** Calendar dates the participant can do, YYYY-MM-DD. */
  days: string[]
  windows: RequestWindow[]
  note: string
  response: 'Pending' | 'Accepted' | 'Declined'
  respondedAt?: string
  /** The one time the participant suggested when the AI asked, as a UTC instant. Moderators on standby schedule at it or edit it. */
  suggested?: string
  /** The participant's own time zone, so a moderator can see their local time beside it. */
  zone?: string
}
export type EndReason = 'Can’t wait' | 'Uncomfortable' | 'Something else'
export type Escalation = {
  /** When they asked to talk to a person. */
  requestedAt: string
  status: 'Offering live' | 'Time requested' | 'Waiting for participant' | 'Request accepted' | 'Cancelled by participant' | 'Waiting for moderator' | 'Assigned' | 'Booking link sent' | 'Joined' | 'Given up' | 'Ended by participant' | 'Booked by participant'
  /** When it fell through to the Researcher. */
  fellThroughAt?: string
  /** The standby moderator the participant booked, or the one their request went to. */
  moderatorId?: string
  /** The booked time: picked from the calendar, or the moderator's answer to a request. */
  slot?: string
  request?: TimeRequest
  acceptedBy?: string
  joinedAt?: string
  /** What the participant chose: book a time, ask for one, or end the interview (with the reason, if they gave one). */
  choice?: { by: 'Participant'; at: string; how: 'Ended the interview' | 'Booked a follow-up' | 'Requested a time'; slot?: string; reason?: EndReason }
  /** What the Researcher did when it fell through. */
  actedBy?: { by: string; at: string; action: 'Assigned' | 'Booking link'; moderatorId?: string }
  /** Dev only: time added to the clock, to see a long wait. */
  extraWaitMin?: number
  /**
   * The live offer: every online standby moderator is offered the session at the same moment, with one 60-second timer for
   * all of them. The first to accept takes it and the card goes from the others. Kept after for the record.
   */
  live?: { offeredTo: string[]; offeredAt: string; /** Real clock when the timer started, for the countdown. */ startedAtMs: number; answers: Record<string, 'Declined' | 'No answer'> }
  /** Moderators who pressed "Can't take this". The request is hidden for them and stays for the others. */
  declinedBy?: string[]
  /** A moderator changed the time. The participant was emailed Accept or Decline; until they answer, nobody else can take it. */
  proposed?: { slot: string; by: string; at: string }
}

export type Session = {
  escalation?: Escalation
  /** The session's ID, e.g. P-2041-1. A participant who comes back (resume, retry, reschedule) gets P-2041-2. */
  id: string
  /** The person, e.g. P-2041. The main label on every screen. */
  participantId: string
  /** Which of the participant's sessions this is. */
  no: number
  /** The release and guide version this session ran under, set when a later release replaces the study's. Absent: the study's current one. */
  releaseVersion?: string
  guideVersion?: number
  applicantId: string
  /** The participant's email address. Shown masked; the full address is on hover. */
  email: string
  country: string
  region: Region | null
  state: string | null
  device: string
  reserve: boolean
  mode: 'ai' | 'human'
  access: AccessStatus
  status: SessionStatus
  /**
   * Where the session stands in validation (Review). null until the session is Completed; Under review the moment it
   * completes, never Accepted or Excluded by itself. A Researcher's decision (the review record) takes it from there.
   */
  validationStatus: ReviewStatus | null
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
  /** Set when the Researcher gave up on this participant: their slot is open again. The data is kept. */
  gaveUp?: { reason: string; at: string; by: string }
  /** The participant's own attempts at fixing a technical problem (P18), oldest first. */
  selfService?: SelfService[]
  /** The stimuli this participant sees and in what order, set when they book or are accepted. A reschedule keeps it. See state/stimulusPlans.ts. */
  stimulusPlan?: SessionPlan
  /** The guide version a moderator was shown when this session was booked. The brief says when the guide has changed since. */
  bookedGuide?: number
  /** The quota segment, for a study that has more than one. Absent: the one cohort. */
  segment?: string
  /** A draft of the moderator's notes, saved and not yet submitted. */
  notesDraft?: { takeaways: string; at: string }
  /** The moderator asked to be reassigned ("Can't make it"). The Researcher sees it in Needs you until they assign someone. */
  reassign?: { by: string; reason: string; at: string }
  /** Human-led: the moderator didn't join the booked slot. Our fault, so the participant is never marked No-show. Mock-driven until the moderator flow exists. */
  moderatorNoShow?: { at: string }
}

/**
 * Someone who passed screening and is not in an interview. They wait in the reserve until the Researcher invites them.
 * Reserve people only ever come through screening (R9), never straight into an interview.
 */
export type ReserveCandidate = {
  id: string
  contact: string
  state: string
  region: Region | null
  /** When they were screened. The reserve is first in, first out by this. */
  arrivedAt: string
  source: SourceTag
  /** The audience version they were screened under. A reserve person screened under an older one needs re-screening. */
  screenedUnder?: number
  status: 'Reserve' | 'Invited'
  invitedAs?: string
  invitedAt?: string
}

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
  /** `kind: 'version'` is a pause to change the guide or stimuli: it ends by relaunching the next release, not by resuming. */
  paused: { reason: string; by: string; at: string; kind?: 'version' } | null
  /** Set when the Researcher closed fieldwork: no more invitations or sessions. The study is Complete. */
  closed?: { by: string; at: string }
  /** Set when the Researcher terminated the study: it stopped before it was done. `ended` is the sessions that were in progress. */
  terminated?: { by: string; at: string; reason: string; ended: number }
  /** What participants say in this study, in rotation, for turns simulated later. Absent for the seed study. */
  lines?: string[]
  /** A top-up: the Researcher asked for more applicants after launch to close a gap. */
  topUp?: { requested: number; by: string; at: string }
  /** Dev only: minutes added to the prototype clock by "Simulate time passing", to see grace periods end. */
  clockSkewMin?: number
  /** The Researcher lowered the target. It replaces the audience's target for every count. */
  targetChange?: { from: number; to: number; by: string; at: string; reason: string }
  log: LogEntry[]
  /** Reserve people who have been invited. The rest of the reserve is read from screening (R9). */
  reserve: ReserveCandidate[]
  /** Set when the Moderator view's mock data (src/mock/moderatorSeed.ts) has been added to this record. */
  modSeed?: number
  /** Set when the seeded sessions have been given stimulus plans for the session brief (src/mock/moderatorSeed.ts). */
  planSeed?: number
}

// ─── mock generation ────────────────────────────────────────────────────────

/** The prototype's clock for fieldwork data. */
export const FIELDWORK_NOW = '2026-11-11T17:00:00-05:00'
/**
 * The clock a study's screens read: the prototype clock plus whatever "Simulate time passing" added, and never behind the
 * newest thing recorded on the study (a new event is stamped a minute after the last), so something that just happened
 * is never "in the future".
 */
export function fieldworkNow(doc: Pick<FieldworkDoc, 'clockSkewMin' | 'sessions' | 'log'>): string {
  const base = new Date(FIELDWORK_NOW).getTime() + (doc.clockSkewMin ?? 0) * 60000
  const latest = Math.max(base, ...doc.log.map((l) => new Date(l.at).getTime()), ...doc.sessions.flatMap((s) => s.events.map((e) => new Date(e.at).getTime())))
  return new Date(latest).toISOString()
}
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

/** What a study's seed sessions say and when they ran, where it isn't the seed study's. */
export type FieldworkContent = {
  seeds: SeedSession[]
  /** What participants say in the conversation, in rotation. */
  lines: string[]
  /** When fieldwork opened: the invitations went out just before. */
  start: string
}

export type GenInput = {
  /** Another study's sessions. The seed study's are used when this is missing. */
  content?: FieldworkContent
  studyId: string
  audience: AudienceDoc
  guide: GuideDoc
  plan: StudyPlan
  releaseNumber: number
  releaseVersion: string
  launch?: LaunchDoc
}

/** Bumped when the seed session list changes, so saved fieldwork is rebuilt from it. */
export const SESSION_SEED = 9

const DEVICES = ['Mobile · iOS Safari', 'Mobile · Android Chrome', 'Desktop · Chrome', 'Desktop · Safari', 'Desktop · Edge']


/** Builds the study's sessions from the one seed list (mock/sessions.ts), so Fieldwork and Review always agree. */
export function generateFieldwork(i: GenInput): FieldworkDoc {
  const human = i.guide.moderator.mode === 'human'
  const mods = human ? humanIdsOf(i.guide.moderator) : []

  const items = i.plan.sections.flatMap((s) => s.items)
  const mandatory = items.filter((x) => x.core).map((x) => x.id)
  const stimNames = [...new Set(items.map((x) => x.stimulus).filter((x): x is string => !!x))]
  const failed = i.guide.stimuli.items.filter((s) => s.renderOk === false).map((s) => s.name)
  const surveyItems = items.filter((x) => x.survey)
  const questionsOf = (title: string) => surveysOf(i.guide).find((s) => s.title === title)?.questions ?? []
  const lang = i.plan.language
  const consentAt = i.launch?.setup.consent[lang]?.at
  const wording = `${lang}, approved ${formatDate(consentAt ?? '2026-10-26T15:00:00-04:00')}`

  const seeds = i.content?.seeds ?? SEED_SESSIONS
  const lines = i.content?.lines ?? PARTICIPANT
  const start = i.content?.start ?? FIELDWORK_START
  const raw = seeds.map((r, n): Session => {
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

    const invitedAt = at(start, -60 + (n % 6) * 15)
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
    const answers: Answer[] = v === 'done' ? surveyItems.flatMap((x) => questionsOf(x.survey!).map((sq) => ({ questionId: `${x.id}:${sq.id}`, survey: x.survey!, question: sq.text, answer: surveyAnswerFor(r.participant, x.survey!, sq), lockedAt: at(t0, 12) }))) : []
    answers.forEach((a) => events.push(ev(a.lockedAt, 'survey', `Answered and locked: ${a.question}`)))
    if (v === 'incomplete') events.push(ev(at(t0, 9), 'system', 'The participant left. The session can be resumed.'))
    if (v === 'error') events.push(ev(at(t0, 3), 'system', 'Technical error: the connection dropped before the session could continue.'))
    if (v === 'withdrawn') events.push(ev(at(t0, 6), 'participant', 'Withdrew from the study. Consent for the recording was withdrawn.'))
    if (v === 'done') events.push(ev(r.at, 'system', 'Interview completed'))

    const transcript: TranscriptTurn[] = items.slice(0, Math.min(askedCount, 3)).flatMap((x, j) => [
      { at: at(t0, j * 3), speaker: moderator, ai: !human, text: x.text },
      { at: at(t0, j * 3 + 1), speaker: 'Participant', ai: false, text: lines[(n + j) % lines.length] },
    ])

    // A participant who tried the on-screen steps and still couldn't fix it: the seed's one visible example of a failed self-service.
    const failedSS = r.selfService
    const selfService: SelfService[] | undefined = failedSS ? [{ id: `${sessionIdOf(r)}-ss1`, issue: failedSS.issue as IssueType, startedAt: at(t0, 20), checks: failedSS.checks, outcome: 'unresolved', at: at(t0, 26) }] : undefined
    if (failedSS) events.push(ev(at(t0, 26), 'system', `${failedSS.issue}: the participant followed the on-screen steps and checked ${failedSS.checks} times. It still isn’t fixed, so the research team was told.`))

    const issues: TechIssue[] = (r.issues ?? [])
      .map(([type, severity, st, resolution], j): TechIssue => {
        // Human-led sessions have a moderator who can drop, not an AI agent that can time out.
        const t = (human && type === 'AI agent timeout' ? 'Moderator disconnected' : type) as IssueType
        const when = at(t0, started ? 3 + j * 4 : 20)
        const fix = ISSUE_FIX[t]
        if (st === 'Open') return { id: `${sessionIdOf(r)}-ti${j + 1}`, type: t, severity, at: when, status: 'Open' }
        // A withdrawal is the Researcher's to close; everything else resolved from the event that fixes it.
        const closed = r.variant === 'withdrawn'
        const via: ResolvedVia = closed ? 'closed' : fix.via
        return {
          id: `${sessionIdOf(r)}-ti${j + 1}`,
          type: t,
          severity,
          at: when,
          status: 'Resolved',
          via,
          resolution: closed ? `closed without a fix: ${resolution}` : RESOLVED_LABEL[fix.via],
          detail: closed ? undefined : resolution,
          resolvedBy: closed ? 'Maya Ortiz' : fix.via === 'system' ? 'PulseAI' : 'The participant',
          resolvedAt: at(when, 25),
        }
      })
      .filter((x) => !ISSUE_META[x.type].only || ISSUE_META[x.type].only === (human ? 'Human-led' : 'AI-led'))

    return {
      id: sessionIdOf(r),
      validationStatus: status === 'Completed' ? 'Under review' : null,
      participantId: r.participant,
      no: r.no ?? 1,
      applicantId: `A-${r.participant.slice(2)}`,
      email: participantEmail(r.participant),
      country: countryOfRegion(region),
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
      selfService,
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

  const generated: FieldworkDoc = {
    studyId: i.studyId,
    seed: SESSION_SEED,
    releaseNumber: i.releaseNumber,
    releaseVersion: i.releaseVersion,
    plan: i.plan,
    failedStimuli: failed,
    sessions,
    window: i.launch?.setup.fieldwork ?? { start: '2026-11-03', end: '2026-11-17' },
    consentWording: wording,
    lines: i.content?.lines,
    paused: null,
    log: [],
    reserve: [],
  }
  // A release that splits or rotates the stimuli gives each session its plan, and the AI shows them in that order.
  const withPlans = assignPlans(generated)
  return withPlans === generated ? generated : { ...withPlans, sessions: withPlans.sessions.map((x) => (x.stimulusPlan && x.stimuli.length ? { ...x, stimuli: inPlanOrder(x) } : x)) }
}

/** A session's stimulus results in its plan's order and only its group's stimuli. The results stay in step: the first ones shown are the first in the plan. */
const inPlanOrder = (s: Session): StimulusResult[] => s.stimulusPlan!.names.map((name, j) => ({ name, result: s.stimuli[j]?.result ?? 'Not shown' }))

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
export const moderatorName = (id: string | null) => (id ? (profileEdit(id)?.name ?? getTeamPerson(id)?.name ?? HUMAN_NAMES[id] ?? id) : 'AI agent (Ava)')

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

/** Review outcomes by session ID. Read through `outcomeOf` (state/selectors.ts), never directly. */
export type Outcomes = ReadonlyMap<string, ReviewStatus>

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

/**
 * Gives every session that is booked, started or finished a stimulus plan, when the release splits or rotates the stimuli.
 * Human-led sessions have one once they book; AI-led once they are accepted and start. A session that already has one keeps it,
 * so a reschedule never changes it. Does nothing for a release where everyone sees all in the library's order.
 */
export function assignPlans(doc: FieldworkDoc): FieldworkDoc {
  // Remember the guide version each session was booked under. Only the first time: a later guide change leaves it alone.
  const stamped = doc.sessions.some((s) => s.bookedGuide === undefined && s.status !== 'Not started')
    ? { ...doc, sessions: doc.sessions.map((s) => (s.bookedGuide === undefined && s.status !== 'Not started' ? { ...s, bookedGuide: doc.plan.guideVersion } : s)) }
    : doc
  const plans = stamped.plan.stimulusPlans
  if (!plans || plans.length < 2) return stamped
  doc = stamped
  const when = doc.window ? tick(doc) : now()
  let sessions = doc.sessions
  for (const s of doc.sessions) {
    if (s.stimulusPlan || s.status === 'Not started' || s.status === 'Withdrawn' || s.access === 'No-show' || s.gaveUp) continue
    const given = planned(s, plans, sessions, doc.plan.guideVersion, when)
    if (given !== s) sessions = sessions.map((x) => (x.id === s.id ? given : x))
  }
  return sessions === doc.sessions ? doc : { ...doc, sessions }
}

export function startSession(doc: FieldworkDoc, id: string, by: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === id)
  if (!s || !(s.status === 'Booked' || s.status === 'Rescheduled' || s.status === 'Incomplete (resumable)')) return doc
  const started = patch(doc, id, (x) => addEvent({ ...x, status: 'Active', startedAt: x.startedAt ?? now() }, 'system', `${by} started the session`))
  return participantStarted(started, s.participantId, s.status === 'Incomplete (resumable)' || !!s.carried, tick(doc))
}

export function endSession(doc: FieldworkDoc, id: string, by: string, outcome: 'Completed' | 'Incomplete (resumable)'): FieldworkDoc {
  return patch(doc, id, (s) => {
    if (s.status !== 'Active') return s
    const mins = s.startedAt ? Math.max(1, Math.round((Date.now() - new Date(s.startedAt).getTime()) / MIN)) : 1
    return addEvent({ ...s, status: outcome, validationStatus: outcome === 'Completed' ? 'Under review' : null, durationMin: s.durationMin ?? Math.min(mins, doc.plan.durationMin) }, 'moderator', outcome === 'Completed' ? `${by} ended the session` : `${by} ended the session early. It can be resumed.`)
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
export const recordAnswer = (doc: FieldworkDoc, id: string, item: PlanItem, question: { id: string; text: string }, answer: string) =>
  patch(doc, id, (s) => {
    const key = `${item.id}:${question.id}`
    return s.status !== 'Active' || s.answers.some((a) => a.questionId === key)
      ? s
      : addEvent({ ...s, answers: [...s.answers, { questionId: key, survey: item.survey, question: question.text, answer, lockedAt: now() }] }, 'survey', `Answered and locked: ${question.text}`)
  })

export const submitNotes = (doc: FieldworkDoc, id: string, notes: Notes) => patch(doc, id, (s) => (sessionEnded(s) && !s.notes ? addEvent({ ...s, notes }, 'moderator', `${notes.by} submitted post-session notes`) : s))

/**
 * The time for a new fieldwork event: the prototype's fieldwork clock, or just after the latest thing already
 * recorded, so new entries always come after the seeded ones.
 */
export function tick(doc: FieldworkDoc): string {
  const latest = [fieldworkNow(doc), ...doc.log.map((l) => l.at), ...doc.sessions.flatMap((s) => s.events.map((e) => e.at))].reduce((m, x) => Math.max(m, new Date(x).getTime()), 0)
  return new Date(latest + MIN).toISOString()
}

export const pauseFieldwork = (doc: FieldworkDoc, reason: string, by: string, kind?: 'version'): FieldworkDoc => {
  const when = tick(doc)
  const text = kind === 'version' ? `Paused fieldwork to change the guide or stimuli: ${reason.trim()}` : `Paused fieldwork: ${reason.trim()}`
  return doc.paused ? doc : { ...doc, paused: { reason: reason.trim(), by, at: when, ...(kind ? { kind } : {}) }, log: [...doc.log, { id: uid('fl'), at: when, by, text }] }
}

/**
 * Dev only: gives `people` different participants an issue of this type, already resolved, so Needs you and the close
 * check don't move. Marked so it can be taken out again.
 */
export function seedRepeatingProblem(doc: FieldworkDoc, type: IssueType, people: number): FieldworkDoc {
  const when = tick(doc)
  const have = new Set(doc.sessions.filter((s) => s.issues.some((i) => i.type === type)).map((s) => s.participantId))
  const chosen = new Map<string, string>()
  for (const s of doc.sessions) if (!have.has(s.participantId) && !chosen.has(s.participantId) && chosen.size < people) chosen.set(s.participantId, s.id)
  const ids = new Set(chosen.values())
  return {
    ...doc,
    sessions: doc.sessions.map((s) =>
      ids.has(s.id)
        ? { ...s, issues: [...s.issues, { id: `seed-rp-${s.id}-${type}`, type, severity: 'Degraded' as const, at: when, status: 'Resolved' as const, via: 'system' as const, resolution: 'seeded for testing (mock)', resolvedBy: 'Dev panel', resolvedAt: when }] }
        : s,
    ),
  }
}

/** Dev only: takes out what `seedRepeatingProblem` added. */
export const clearSeededProblems = (doc: FieldworkDoc): FieldworkDoc => ({ ...doc, sessions: doc.sessions.map((s) => (s.issues.some((i) => i.id.startsWith('seed-rp-')) ? { ...s, issues: s.issues.filter((i) => !i.id.startsWith('seed-rp-')) } : s)) })

export const startTopUp = (doc: FieldworkDoc, requested: number, by: string): FieldworkDoc => {
  const when = tick(doc)
  return { ...doc, topUp: { requested: (doc.topUp?.requested ?? 0) + requested, by, at: when }, log: [...doc.log, { id: uid('fl'), at: when, by, text: `Started a top-up: sourcing ${requested} more applicants for screening` }] }
}

/** Moves the end of the fieldwork window later. A reason is required; who and when are logged. */
export function extendWindow(doc: FieldworkDoc, end: string, reason: string, by: string): FieldworkDoc {
  if (!doc.window || !reason.trim() || end <= doc.window.end) return doc
  const when = tick(doc)
  return { ...doc, window: { ...doc.window, end }, log: [...doc.log, { id: uid('fl'), at: when, by, text: `Extended the fieldwork window from ${formatDate(`${doc.window.end}T12:00:00-05:00`)} to ${formatDate(`${end}T12:00:00-05:00`)}: ${reason.trim()}` }] }
}

/** Lowers the target. It can't go below what already counts. A reason is required; who and when are logged. */
export function lowerTarget(doc: FieldworkDoc, from: number, to: number, reason: string, by: string): FieldworkDoc {
  if (!reason.trim() || to >= from || to < 1) return doc
  const when = tick(doc)
  return { ...doc, targetChange: { from: doc.targetChange?.from ?? from, to, by, at: when, reason: reason.trim() }, log: [...doc.log, { id: uid('fl'), at: when, by, text: `Lowered the target from ${from} to ${to}: ${reason.trim()}` }] }
}

export const closeFieldwork = (doc: FieldworkDoc, by: string): FieldworkDoc => {
  if (doc.closed) return doc
  const when = tick(doc)
  return { ...doc, closed: { by, at: when }, log: [...doc.log, { id: uid('fl'), at: when, by, text: 'Closed fieldwork' }] }
}

/**
 * Stops the study now. Needs a reason; who and when are logged. Sessions in progress end (see config/terminate.ts),
 * finished ones stay as they are and go on to Review.
 */
export const terminateFieldwork = (doc: FieldworkDoc, reason: string, by: string): FieldworkDoc => {
  if (doc.closed || doc.terminated || !reason.trim()) return doc
  const when = tick(doc)
  const inProgress = (s: Session) => s.status === 'Active' || s.status === 'Paused'
  const ended = doc.sessions.filter(inProgress).length
  return {
    ...doc,
    terminated: { by, at: when, reason: reason.trim(), ended },
    sessions: doc.sessions.map((s) => (inProgress(s) ? addEventAt(when, { ...s, status: TERMINATE_IN_PROGRESS_AS }, 'system', 'Ended when the study was terminated') : s)),
    log: [...doc.log, { id: uid('fl'), at: when, by, text: `Terminated the study: ${reason.trim()}${ended ? ` (${ended} ${ended === 1 ? 'session' : 'sessions'} in progress ended)` : ''}` }],
  }
}

export const resumeFieldwork = (doc: FieldworkDoc, by: string): FieldworkDoc =>
  doc.paused ? { ...doc, paused: null, log: [...doc.log, { id: uid('fl'), at: tick(doc), by, text: 'Resumed fieldwork' }] } : doc

// ─── monitoring figures (R18) ───────────────────────────────────────────────

/** Ends the matching open issues, and says so on the session. Every resolution carries what resolved it and when. */
type How = { via: ResolvedVia; resolution: string }
function resolveIssues(doc: FieldworkDoc, match: (s: Session, i: TechIssue) => boolean, how: How | ((i: TechIssue) => How), by: string, when: string): FieldworkDoc {
  const of = (i: TechIssue) => (typeof how === 'function' ? how(i) : how)
  return {
    ...doc,
    sessions: doc.sessions.map((s) => {
      const hit = s.issues.filter((i) => i.status === 'Open' && match(s, i))
      if (!hit.length) return s
      const ids = new Set(hit.map((i) => i.id))
      const issues = s.issues.map((i) => (ids.has(i.id) ? { ...i, status: 'Resolved' as const, ...of(i), resolvedBy: by, resolvedAt: when } : i))
      return hit.reduce((acc, i) => addEventAt(when, acc, 'system', `${i.type} resolved: ${of(i).resolution}`), { ...s, issues })
    }),
  }
}

/**
 * The participant's session starts. That resolves their open device and browser problems, their expired link (it was
 * opened to get here), and, if it is a resume, a lost connection. Across all of their sessions: the problem was on an
 * earlier one.
 */
function participantStarted(doc: FieldworkDoc, participantId: string, resumed: boolean, when: string): FieldworkDoc {
  return resolveIssues(
    doc,
    (s, i) => {
      if (s.participantId !== participantId) return false
      const v = ISSUE_FIX[i.type].via
      return v === 'session-start' || v === 'link-opened' || (v === 'resume' && resumed)
    },
    (i) => ({ via: ISSUE_FIX[i.type].via, resolution: RESOLVED_LABEL[ISSUE_FIX[i.type].via] }),
    'The participant',
    when,
  )
}

/** The reissued link is opened. The Researcher sent it, so a link nobody has reissued doesn't count. */
function linkOpened(doc: FieldworkDoc, s: Session, when: string): FieldworkDoc {
  if (!s.handled) return doc
  return resolveIssues(doc, (x, i) => x.participantId === s.participantId && ISSUE_FIX[i.type].via === 'link-opened', { via: 'link-opened', resolution: RESOLVED_LABEL['link-opened'] }, 'The participant', when)
}

/** PulseAI recovers from what it was handling on this session: transcription, media, platform. Nothing for the Researcher to do. */
export function recoverSystem(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  return resolveIssues(doc, (s, i) => s.id === sessionId && handledBySystem(i.type), { via: 'system', resolution: RESOLVED_LABEL.system }, 'PulseAI', tick(doc))
}

/**
 * The only manual way to end an issue besides giving up on the participant: close it without a fix, with a reason.
 * It is logged with who and when. The Researcher cannot confirm a fix they can't see, so there is no "mark resolved".
 */
export function closeWithoutFix(doc: FieldworkDoc, sessionId: string, issueId: string, reason: string, by: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  const issue = s?.issues.find((x) => x.id === issueId && x.status === 'Open')
  if (!s || !issue || !reason.trim() || handledBySystem(issue.type)) return doc
  const when = tick(doc)
  const text = reason.trim()
  const next = {
    ...doc,
    sessions: doc.sessions.map((x) =>
      x.id !== sessionId ? x : addEventAt(when, { ...x, issues: x.issues.map((i) => (i.id === issueId ? { ...i, status: 'Resolved' as const, via: 'closed' as const, resolution: `closed without a fix: ${text}`, resolvedBy: by, resolvedAt: when } : i)) }, 'system', `${issue.type} closed without a fix by ${by}: ${text}`),
    ),
  }
  return logged(next, when, by, `Closed “${issue.type}” on ${sessionId} without a fix: ${text}`)
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
    validationStatus: null,
    participantId: s.participantId,
    no,
    applicantId: s.applicantId,
    email: s.email,
    country: s.country,
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
 * Inviting from the reserve turns each chosen candidate into a new participant with a first session. The slot they
 * take is one that opened earlier (an exclusion, a withdrawal, a no-show after the window, or a given-up session).
 * Candidates are invited in the order given; the Reserve tab hands them over first in, first out unless you pick.
 */
export function inviteFromReserve(doc: FieldworkDoc, by: string, candidates: ReserveCandidate[]): FieldworkDoc {
  if (!candidates.length) return doc
  const when = tick(doc)
  const first = doc.sessions[0]
  let next = doc
  const made: string[] = []
  for (const c of candidates) {
    if (next.reserve.some((x) => x.id === c.id && x.status === 'Invited')) continue
    const n = Math.max(2040, ...next.sessions.map((x) => parseInt(x.participantId.slice(2), 10) || 0)) + 1
    const participantId = `P-${n}`
    const session: Session = {
      id: `${participantId}-1`,
      validationStatus: null,
      participantId,
      no: 1,
      applicantId: c.id,
      email: participantEmail(participantId),
      country: countryOfRegion(c.region),
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
      events: [ev(when, 'system', `Invited from the reserve (screened ${formatDate(c.arrivedAt)}). Approved by ${by}.`)],
      stimuli: [],
      answers: [],
      asked: [],
      covered: [],
      followUps: {},
      transcript: [],
      notes: null,
      issues: [],
      consent: null,
      // The replacement takes over the plan of the person they replace, so the balance holds.
      ...(doc.plan.stimulusPlans ? { stimulusPlan: inheritablePlan(next.sessions) } : {}),
    }
    // Rows from the Reserve tab carry a display label; only the candidate itself is stored.
    const { label: _label, ...plain } = c as ReserveCandidate & { label?: string }
    const stored: ReserveCandidate = { ...plain, status: 'Invited', invitedAs: participantId, invitedAt: when }
    const reserve = next.reserve.some((x) => x.id === c.id) ? next.reserve.map((x) => (x.id === c.id ? stored : x)) : [...next.reserve, stored]
    next = { ...next, reserve, sessions: [...next.sessions, session] }
    made.push(`${c.id} as ${participantId}`)
  }
  return logged(next, when, by, `Invited ${made.length} from the reserve: ${made.join(', ')}`)
}

/**
 * Gives up on a stuck participant (technical error, left part-way, a link that won't work). Their slot opens again so
 * the gap shows it. The reason is required and logged; their data and session record are kept.
 */
export function giveUp(doc: FieldworkDoc, sessionId: string, reason: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s || s.gaveUp || !reason.trim()) return doc
  const gone = patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'system', `${by} gave up on this participant and opened a slot: ${reason.trim()}`), gaveUp: { reason: reason.trim(), at: when, by }, ...(x.escalation && x.escalation.status !== 'Joined' ? { escalation: { ...x.escalation, status: 'Given up' as const } } : {}) }))
  // Giving up closes what is still open on the session, with that reason.
  const closed = resolveIssues(gone, (x, i) => x.id === sessionId && !handledBySystem(i.type), { via: 'gave-up', resolution: `given up and replaced: ${reason.trim()}` }, by, when)
  return logged(closed, when, by, `Gave up on ${s.participantId} and opened a slot: ${reason.trim()}`)
}

/** How serious each problem the participant can fix themselves is, if it isn't fixed. */
export const SELF_SERVICE_SEVERITY: Partial<Record<IssueType, IssueSeverity>> = {
  'Microphone permission denied': 'Blocking',
  'Camera not detected': 'Blocking',
  'Unsupported browser or device': 'Blocking',
  'Connection lost': 'Blocking',
  'Audio dropped': 'Degraded',
  'Video stream interrupted': 'Degraded',
}

/**
 * The participant fixed the problem themselves. The interview carries on from the last saved question (nothing is
 * restarted or asked again), the problem is logged as resolved so it counts as having happened and is never open, and
 * the session never reaches Needs you.
 */
export function selfServiceResolved(doc: FieldworkDoc, sessionId: string, issue: IssueType, checks: number, startedAt: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  const when = tick(doc)
  const severity = SELF_SERVICE_SEVERITY[issue] ?? 'Degraded'
  const detail = `Fixed with the on-screen steps${checks > 1 ? ' (it took a second check)' : ''}.`
  const record: SelfService = { id: uid('ss'), issue, startedAt, checks, outcome: 'resolved', at: when }
  return logged(
    patch(doc, sessionId, (x) => ({
      ...addEventAt(
        when,
        addEventAt(when, x, 'system', `${issue}: the participant fixed it themselves with the on-screen steps (${checks} ${checks === 1 ? 'check' : 'checks'}). The Researcher wasn’t needed.`),
        'system',
        'The interview resumed from the last saved question. Nothing was restarted or asked again.',
      ),
      issues: [...x.issues, { id: uid('ti'), type: issue, severity, at: startedAt, status: 'Resolved' as const, via: 'self-service' as const, resolution: RESOLVED_LABEL['self-service'], detail, resolvedBy: 'The participant (self-service)', resolvedAt: when, selfService: true }],
      selfService: [...(x.selfService ?? []), record],
    })),
    when,
    'The participant',
    `${s.participantId} fixed “${issue}” themselves with the on-screen steps`,
  )
}

/**
 * The on-screen steps and one retry didn't fix it. The session becomes a Technical Error with the problem open, so it
 * reaches Needs you like any other, with a note that self-service was already tried.
 */
export function selfServiceFailed(doc: FieldworkDoc, sessionId: string, issue: IssueType, checks: number, startedAt: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  const when = tick(doc)
  const severity = SELF_SERVICE_SEVERITY[issue] ?? 'Blocking'
  const record: SelfService = { id: uid('ss'), issue, startedAt, checks, outcome: 'unresolved', at: when }
  return logged(
    patch(doc, sessionId, (x) => ({
      ...addEventAt(when, x, 'system', `${issue}: the participant followed the on-screen steps and checked ${checks} times. It still isn’t fixed, so the research team was told.`),
      status: 'Technical Error' as const,
      issues: [...x.issues, { id: uid('ti'), type: issue, severity, at: startedAt, status: 'Open' as const }],
      selfService: [...(x.selfService ?? []), record],
    })),
    when,
    'The participant',
    `${s.participantId} couldn’t fix “${issue}” with the on-screen steps and the research team was told`,
  )
}

/**
 * The mock of a participant opening their link. While the study is paused they are told it is unavailable and nothing
 * starts; otherwise a new person's first visit opens the link and the next one starts the session.
 */
export function openLink(doc: FieldworkDoc, sessionId: string, paused: boolean): { doc: FieldworkDoc; result: 'unavailable' | 'opened' | 'started' | 'ignored' } {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return { doc, result: 'ignored' }
  const when = tick(doc)
  const blocked = s.status === 'Not started' || s.status === 'Booked' || s.status === 'Incomplete (resumable)'
  if (!blocked) return { doc, result: 'ignored' }
  if (paused) return { doc: patch(doc, sessionId, (x) => addEventAt(when, x, 'participant', 'Opened their link while the study was paused. Shown: “This study is temporarily unavailable.” Nothing started.')), result: 'unavailable' }
  if (s.access === 'Invited') return { doc: linkOpened(patch(doc, sessionId, (x) => addEventAt(when, { ...x, access: 'Opened' }, 'participant', 'Opened their link')), s, when), result: 'opened' }
  const resumed = s.status === 'Incomplete (resumable)' || !!s.carried
  const started = patch(doc, sessionId, (x) => addEventAt(when, { ...x, access: 'Consented', status: 'Active', startedAt: x.startedAt ?? when }, 'participant', resumed ? 'Resumed the interview' : 'Started the interview'))
  return { doc: participantStarted(linkOpened(started, s, when), s.participantId, resumed, when), result: 'started' }
}

/** The mock of a running interview moving on: pausing the study never interrupts it. */
export function simulateTurn(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const when = tick(doc)
  return patch(doc, sessionId, (x) => {
    if (x.status !== 'Active') return x
    const n = x.transcript.length
    return { ...addEventAt(when, x, 'participant', 'Answered the next question'), transcript: [...x.transcript, { at: when, speaker: 'Participant', ai: false, text: (doc.lines ?? PARTICIPANT)[n % (doc.lines ?? PARTICIPANT).length] }] }
  })
}

// ─── escalation to a human ──────────────────────────────────────────────────

const escalate = (doc: FieldworkDoc, sessionId: string, fn: (s: Session, e: Escalation) => Session): FieldworkDoc => patch(doc, sessionId, (s) => (s.escalation ? fn(s, s.escalation) : s))

/** Whether the Researcher is the one who can move it on: nobody accepted, or a request is still waiting for an answer. */
export const needsResearcher = (e: Escalation) => e.status === 'Waiting for moderator' || e.status === 'Time requested'

/** The standby moderators this release offers to participants. */
const standbyTeam = (doc: FieldworkDoc) => doc.plan.escalation?.moderators ?? []

/** Times already booked, so two participants never hold the same one. */
const takenSlots = (doc: FieldworkDoc): Set<string> => new Set(doc.sessions.flatMap((s) => (s.escalation?.moderatorId && s.escalation.slot ? [`${s.escalation.moderatorId}|${new Date(s.escalation.slot).toISOString()}`] : [])))

/** What a participant who asks for a human can book from `from`. */
export const standbySlots = (doc: FieldworkDoc, from: string): Slot[] => openSlots(standbyTeam(doc), from, takenSlots(doc))

/** A participant in an AI interview who hasn't asked yet. */
const canAsk = (s: Session) => s.status === 'Active' && !s.escalation

/** The participant ends the interview. The session is Withdrawn, like any participant who leaves. */
export function participantEnds(doc: FieldworkDoc, sessionId: string, reason?: EndReason): FieldworkDoc {
  const when = tick(doc)
  const asked = at(when, -1)
  return patch(doc, sessionId, (s) => {
    if (!canAsk(s)) return s
    const asking = addEventAt(asked, s, 'participant', 'Asked to talk to a human moderator')
    return {
      ...addEventAt(when, asking, 'participant', `Chose to end the interview${reason ? `: ${reason.toLowerCase()}` : ''}`),
      status: 'Withdrawn' as const,
      escalation: { requestedAt: asked, status: 'Ended by participant', choice: { by: 'Participant', at: when, how: 'Ended the interview', ...(reason ? { reason } : {}) } },
    }
  })
}

/** The participant books the first free time on the standby calendar. The session is Booked for it. Nothing to answer: the time was free. */
export function participantBooks(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const when = tick(doc)
  const asked = at(when, -2)
  const slot = standbySlots(doc, when)[0]
  if (!slot) return doc
  return patch(doc, sessionId, (s) => {
    if (!canAsk(s)) return s
    const asking = addEventAt(asked, s, 'participant', 'Asked to talk to a human moderator')
    return {
      ...addEventAt(when, asking, 'participant', `Booked a time with ${slot.name}: ${formatSlot(slot.start)}. A new link was sent.`),
      status: 'Booked' as const,
      slot: slot.start,
      moderatorId: slot.moderatorId,
      escalation: { requestedAt: asked, status: 'Booked by participant', moderatorId: slot.moderatorId, slot: slot.start, choice: { by: 'Participant', at: when, how: 'Booked a follow-up', slot: slot.start } },
    }
  })
}

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })

/** The participant asks for a time that suits them. The request goes to the standby moderator and waits for an answer. */
export function participantRequests(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const when = tick(doc)
  const asked = at(when, -2)
  const moderatorId = standbyTeam(doc)[0]?.id
  if (!moderatorId) return doc
  // The next two weekdays, afternoon or evening.
  const days: string[] = []
  for (let i = 1; days.length < 2 && i < 8; i++) {
    const t = new Date(new Date(when).getTime() + i * 86400000)
    if (t.getUTCDay() !== 0 && t.getUTCDay() !== 6) days.push(ET_DATE.format(t))
  }
  const sess = doc.sessions.find((x) => x.id === sessionId)
  const request: TimeRequest = { sentAt: when, days, windows: ['Afternoon', 'Evening'], note: 'Evenings after work suit me best.', response: 'Pending', suggested: suggestedTime(when, sess), zone: participantZone(sess) }
  return patch(doc, sessionId, (s) => {
    if (!canAsk(s)) return s
    const asking = addEventAt(asked, s, 'participant', 'Asked to talk to a human moderator')
    return {
      ...addEventAt(when, asking, 'participant', `Asked for a time that suits them: ${days.map((d) => formatDay(`${d}T12:00:00-05:00`)).join(', ')}, ${request.windows.join(' or ').toLowerCase()}. Sent to ${moderatorName(moderatorId)}.`),
      status: 'Booked' as const,
      slot: null,
      moderatorId,
      escalation: { requestedAt: asked, status: 'Time requested', moderatorId, request, choice: { by: 'Participant', at: when, how: 'Requested a time' } },
    }
  })
}

/** The participant's time zone, from their region. A mock: the product would take it from their device. */
const REGION_ZONE: Record<Region, string> = { Northeast: 'America/New_York', Midwest: 'America/Chicago', South: 'America/New_York', West: 'America/Los_Angeles' }
export const participantZone = (s: Pick<Session, 'region'> | undefined): string => (s?.region ? REGION_ZONE[s.region] : STUDY_ZONE.timeZone)
/** The time a participant suggests when the AI asks: the next weekday at noon where they are. */
const suggestedTime = (when: string, s: Pick<Session, 'region'> | undefined) => nextWeekdayAt(participantZone(s), when, 12, 0)

/** What every request says it is about. */
export const REQUEST_REASON = 'Asked to speak with a person'
/** How long a live offer waits for a moderator to answer. */
export const LIVE_OFFER_SECONDS = 60

/** The sections the AI had covered when the person was asked for, with how many of each section's questions. */
export function coveredSections(doc: FieldworkDoc, s: Session): { title: string; done: number; of: number }[] {
  return doc.plan.sections.map((sec) => ({ title: sec.title, done: sec.items.filter((i) => s.covered.includes(i.id)).length, of: sec.items.length })).filter((x) => x.done > 0)
}

/** Standby moderators in the order a live escalation offers it: online and on standby, the one idle longest first. */
export function liveQueue(doc: FieldworkDoc): string[] {
  const team = new Set(standbyTeam(doc).map((m) => m.id))
  return MODERATOR_ROSTER.filter((m) => team.has(m.id) && m.standby && m.state === 'Online')
    .sort((a, b) => b.idleMin - a.idleMin)
    .map((m) => m.id)
}

/** The participant asks for a person in a live interview. It is offered to every online standby moderator at once, with one timer. */
export function participantAsksLive(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const when = tick(doc)
  const asked = at(when, -1)
  const offeredTo = liveQueue(doc)
  const withOffer = patch(doc, sessionId, (s) => {
    if (!canAsk(s)) return s
    const asking = addEventAt(asked, s, 'participant', 'Asked to talk to a human moderator')
    return {
      ...addEventAt(when, asking, 'system', offeredTo.length ? `Offered to ${offeredTo.map(moderatorName).join(' and ')} at the same time. The first to accept takes it; nobody accepting in ${LIVE_OFFER_SECONDS} seconds means the AI asks for a time.` : 'No standby moderator is online to take it live.'),
      escalation: { requestedAt: asked, status: 'Offering live', live: { offeredTo, offeredAt: when, startedAtMs: Date.now(), answers: {} } },
    }
  })
  return offeredTo.length ? withOffer : raiseRequest(withOffer, sessionId)
}

/** Whether a moderator has this live offer in front of them: offered, not answered, and nobody has taken it. */
export const isOfferedTo = (s: Session, moderatorId: string) => s.escalation?.status === 'Offering live' && !!s.escalation.live?.offeredTo.includes(moderatorId) && !s.escalation.live.answers[moderatorId]

/** A moderator accepts or declines the live offer. The first to accept takes it, and the offer is gone for everyone else. When every one has declined, the AI asks for a time. */
export function liveOfferAnswered(doc: FieldworkDoc, sessionId: string, moderatorId: string, how: 'Accepted' | 'Declined'): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  const e = s?.escalation
  if (!s || !e || !e.live || !isOfferedTo(s, moderatorId)) return doc
  const when = tick(doc)
  const who = moderatorName(moderatorId)
  if (how === 'Accepted') return patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'moderator', `${who} accepted first and joined`), moderatorId, escalation: { ...e, status: 'Joined', moderatorId, acceptedBy: moderatorId, joinedAt: when } }))
  const answers = { ...e.live.answers, [moderatorId]: 'Declined' as const }
  const left = e.live.offeredTo.filter((id) => !answers[id])
  const moved = patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'system', left.length ? `${who} declined.` : `${who} declined. Nobody took it live.`), escalation: { ...e, live: { ...e.live!, answers } } }))
  return left.length ? moved : raiseRequest(moved, sessionId)
}

/** The 60 seconds ran out with nobody accepting. The AI asks the participant for a time. */
export function liveOfferExpired(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  const e = s?.escalation
  if (!s || !e?.live || e.status !== 'Offering live') return doc
  const when = tick(doc)
  const answers = { ...e.live.answers, ...Object.fromEntries(e.live.offeredTo.filter((id) => !e.live!.answers[id]).map((id) => [id, 'No answer' as const])) }
  return raiseRequest(patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'system', `${LIVE_OFFER_SECONDS} seconds ran out and nobody accepted.`), escalation: { ...e, live: { ...e.live!, answers } } })), sessionId)
}

/**
 * Nobody took the live escalation. The AI asks the participant for a time to continue with a person, and a request with
 * that time goes to every moderator on standby for the study (it also shows in Needs you, as any request nobody picked up).
 */
function raiseRequest(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const when = tick(doc)
  const sess = doc.sessions.find((x) => x.id === sessionId)
  if (!sess?.escalation || sess.escalation.status !== 'Offering live') return doc
  const suggested = suggestedTime(when, sess)
  const zone = participantZone(sess)
  const request: TimeRequest = { sentAt: when, days: [ET_DATE.format(new Date(suggested))], windows: ['Afternoon'], note: 'Suggested when the AI asked.', response: 'Pending', suggested, zone }
  return patch(doc, sessionId, (s) => ({
    ...addEventAt(when, s, 'participant', `Asked for a time to continue with a person: ${formatSlot(suggested)}. Sent to the standby moderators.`),
    status: 'Booked' as const,
    slot: null,
    escalation: { ...s.escalation!, status: 'Time requested', moderatorId: standbyTeam(doc)[0]?.id, request, choice: { by: 'Participant', at: when, how: 'Requested a time' } },
  }))
}

/**
 * Dev: a live escalation that nobody takes, from start to request. Uses an Active session that hasn't asked; failing that,
 * starts the first one that hasn't begun, with a few turns already covered. Returns undefined when the study has no standby
 * moderators or no session to use.
 */
export function devRaiseRequest(doc: FieldworkDoc): FieldworkDoc | undefined {
  const prepared = devSessionToAsk(doc)
  if (!prepared) return undefined
  const { base, target } = prepared
  let out = participantAsksLive(base, target.id)
  // One moderator declines, the timer runs out on the rest.
  const first = out.sessions.find((x) => x.id === target.id)?.escalation?.live?.offeredTo[0]
  if (first) out = liveOfferAnswered(out, target.id, first, 'Declined')
  return liveOfferExpired(out, target.id)
}

/** Dev: a participant asks for a person live and the offer stays open, so a moderator's pinned card shows. */
export function devTriggerEscalation(doc: FieldworkDoc): FieldworkDoc | undefined {
  const prepared = devSessionToAsk(doc)
  return prepared ? participantAsksLive(prepared.base, prepared.target.id) : undefined
}

/** An Active session that hasn't asked yet, or the first one that hasn't begun, started with a few turns covered. */
function devSessionToAsk(doc: FieldworkDoc): { base: FieldworkDoc; target: Session } | undefined {
  if (!doc.plan.escalation?.offered) return undefined
  const ready = doc.sessions.find((s) => canAsk(s))
  if (ready) return { base: doc, target: ready }
  const idle = doc.sessions.find((s) => s.status === 'Not started' && !s.gaveUp && !s.handled)
  if (!idle) return undefined
  const items = planItems(doc.plan).slice(0, 3)
  const when = tick(doc)
  const lines = doc.lines ?? PARTICIPANT
  const base = patch(doc, idle.id, (s) => ({
    ...addEventAt(when, s, 'system', 'Started (dev)'),
    status: 'Active' as const,
    startedAt: when,
    asked: items.map((i) => i.id),
    covered: items.slice(0, 2).map((i) => i.id),
    transcript: items.flatMap((i, n) => [
      { at: when, speaker: 'AI', ai: true, text: i.text },
      { at: when, speaker: 'Participant', ai: false, text: lines[n % lines.length] },
    ]),
  }))
  return { base, target: base.sessions.find((x) => x.id === idle.id)! }
}

/** The times a moderator is holding in this study: booked sessions, and times they proposed and are waiting on. */
export function busyIn(doc: FieldworkDoc, moderatorId: string): Busy[] {
  return doc.sessions.flatMap((s) => {
    const out: Busy[] = []
    if (s.moderatorId === moderatorId && s.slot && s.status === 'Booked') out.push(busyAt(s.slot, s.participantId))
    if (s.escalation?.status === 'Waiting for participant' && s.escalation.proposed?.by === moderatorId) out.push(busyAt(s.escalation.proposed.slot, `held for ${s.participantId}`))
    return out
  })
}

const isOpenRequest = (s: Session) => s.escalation?.status === 'Time requested' && !!s.escalation.request

/** The session books the time. Only a request still open can be booked, so the first moderator to act is the only one. */
function book(doc: FieldworkDoc, sessionId: string, moderatorId: string, slot: string, text: string): FieldworkDoc {
  const when = tick(doc)
  return patch(doc, sessionId, (s) => {
    const e = s.escalation
    if (!e?.request) return s
    return {
      ...addEventAt(when, s, 'system', text),
      status: 'Booked' as const,
      slot,
      moderatorId,
      escalation: { ...e, status: 'Request accepted', moderatorId, slot, acceptedBy: moderatorId, proposed: undefined, request: { ...e.request, response: 'Accepted', respondedAt: when } },
    }
  })
}

/** "Schedule at this time": books the participant's suggested time. Needs the moderator to be free then, and the time not to have passed. */
export function scheduleRequest(doc: FieldworkDoc, sessionId: string, moderatorId: string, busy: readonly Busy[]): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  const suggested = s?.escalation?.request?.suggested
  if (!s || !isOpenRequest(s) || !suggested || s.escalation?.declinedBy?.includes(moderatorId)) return doc
  if (slotProblem(moderatorId, new Date(suggested).getTime(), new Date(fieldworkNow(doc)).getTime(), busy)) return doc
  return book(doc, sessionId, moderatorId, suggested, `${moderatorName(moderatorId)} scheduled it at the participant’s time: ${formatSlot(suggested)}. The session continues where the AI stopped.`)
}

/** "Edit time": the moderator picks a time they are free. The participant is emailed Accept or Decline, and the request waits. */
export function proposeRequestTime(doc: FieldworkDoc, sessionId: string, moderatorId: string, slot: string, busy: readonly Busy[]): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s || !isOpenRequest(s) || s.escalation?.declinedBy?.includes(moderatorId)) return doc
  if (slotProblem(moderatorId, new Date(slot).getTime(), new Date(fieldworkNow(doc)).getTime(), busy)) return doc
  const when = tick(doc)
  return patch(doc, sessionId, (x) => ({
    ...addEventAt(when, x, 'moderator', `${moderatorName(moderatorId)} proposed ${formatSlot(slot)}. The participant was emailed to accept or decline.`),
    escalation: { ...x.escalation!, status: 'Waiting for participant', proposed: { slot, by: moderatorId, at: when } },
  }))
}

/** Dev: the participant answers the new time. Accepting books it; declining puts the request back to Open for everyone. */
export function participantAnswersProposal(doc: FieldworkDoc, sessionId: string, answer: 'Accepted' | 'Declined'): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  const p = s?.escalation?.proposed
  if (!s || s.escalation?.status !== 'Waiting for participant' || !p) return doc
  if (answer === 'Accepted') return book(doc, sessionId, p.by, p.slot, `The participant accepted ${formatSlot(p.slot)} with ${moderatorName(p.by)}. The session continues where the AI stopped.`)
  const when = tick(doc)
  return patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'participant', `Declined ${formatSlot(p.slot)}. The request is open again.`), escalation: { ...x.escalation!, status: 'Time requested', proposed: undefined } }))
}

/** Dev: the participant withdraws the request before anyone books it. */
export function participantCancelsRequest(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s?.escalation || (s.escalation.status !== 'Time requested' && s.escalation.status !== 'Waiting for participant')) return doc
  const when = tick(doc)
  return patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'participant', 'Cancelled the request to continue with a person.'), status: 'Withdrawn' as const, slot: null, escalation: { ...x.escalation!, status: 'Cancelled by participant', proposed: undefined } }))
}

/** "Can't take this": hidden for this moderator, still there for the others. When every standby moderator has said so, it falls to the Researcher. */
export function cantTakeRequest(doc: FieldworkDoc, sessionId: string, moderatorId: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s || !isOpenRequest(s)) return doc
  const declinedBy = [...new Set([...(s.escalation!.declinedBy ?? []), moderatorId])]
  const everyone = standbyTeam(doc).every((m) => declinedBy.includes(m.id))
  const when = tick(doc)
  return patch(doc, sessionId, (x) => ({
    ...(everyone ? addEventAt(when, x, 'system', 'Every standby moderator said they can’t take it. It is waiting for the Researcher.') : x),
    escalation: { ...x.escalation!, declinedBy, ...(everyone ? { status: 'Waiting for moderator' as const, fellThroughAt: when } : {}) },
  }))
}

const WINDOW_HOURS: Record<RequestWindow, [number, number]> = { Morning: [5, 12], Afternoon: [12, 17], Evening: [17, 24] }
const etHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' })

/** Dev: the moderator the request went to answers it. Accepting books a time they have free, one that suits the participant if there is one. */
export function moderatorAnswers(doc: FieldworkDoc, sessionId: string, answer: 'Accepted' | 'Declined'): FieldworkDoc {
  const when = tick(doc)
  return escalate(doc, sessionId, (s, e) => {
    const r = e.request
    if (e.status !== 'Time requested' || !r || !e.moderatorId) return s
    const who = moderatorName(e.moderatorId)
    if (answer === 'Declined')
      return { ...addEventAt(when, s, 'system', `${who} couldn’t do those times. It is waiting for the Researcher.`), escalation: { ...e, status: 'Waiting for moderator', fellThroughAt: when, request: { ...r, response: 'Declined', respondedAt: when } } }
    const free = standbySlots(doc, when).filter((x) => x.moderatorId === e.moderatorId)
    const suits = free.find((x) => r.days.includes(ET_DATE.format(new Date(x.start))) && r.windows.some((w) => { const h = Number(etHour.format(new Date(x.start))); return h >= WINDOW_HOURS[w][0] && h < WINDOW_HOURS[w][1] }))
    const slot = suits ?? free[0]
    if (!slot) return s
    return {
      ...addEventAt(when, s, 'system', `${who} accepted and confirmed ${formatSlot(slot.start)}. A new link was sent.`),
      slot: slot.start,
      escalation: { ...e, status: 'Request accepted', slot: slot.start, request: { ...r, response: 'Accepted', respondedAt: when } },
    }
  })
}

/** Dev: moves the clock on (or back to the start with 0), so grace periods run out. */
export const advanceClock = (doc: FieldworkDoc, minutes: number): FieldworkDoc => ({ ...doc, clockSkewMin: minutes === 0 ? 0 : (doc.clockSkewMin ?? 0) + minutes })

/** Dev: adds hours to how long a participant has been waiting, to see the time left on the promise run down. */
export const addWait = (doc: FieldworkDoc, sessionId: string, hours: number): FieldworkDoc => escalate(doc, sessionId, (s, e) => (needsResearcher(e) ? { ...s, escalation: { ...e, extraWaitMin: (e.extraWaitMin ?? 0) + hours * 60 } } : s))

/** The Researcher picks a moderator. They are notified whatever their state or standby; nobody is picked for them. */
export function assignEscalation(doc: FieldworkDoc, sessionId: string, moderatorId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const state = MODERATOR_ROSTER.find((m) => m.id === moderatorId)?.state ?? 'Offline'
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s?.escalation || !needsResearcher(s.escalation)) return doc
  return logged(
    escalate(doc, sessionId, (x, e) => ({
      ...addEventAt(when, x, 'system', `${by} assigned ${moderatorName(moderatorId)} (${state.toLowerCase()}) and notified them`),
      escalation: { ...e, status: 'Assigned', actedBy: { by, at: when, action: 'Assigned', moderatorId } },
    })),
    when,
    by,
    `Assigned ${moderatorName(moderatorId)} to ${s.participantId}, who asked for a human`,
  )
}

/** Dev: the moderator the Researcher assigned joins. */
export function assignedJoins(doc: FieldworkDoc, sessionId: string): FieldworkDoc {
  return escalate(doc, sessionId, (s, e) => {
    const id = e.actedBy?.moderatorId
    if (e.status !== 'Assigned' || !id) return s
    const joined = tick(doc)
    return { ...addEventAt(joined, s, 'moderator', `${moderatorName(id)} joined at ${formatSlot(joined)}`), moderatorId: id, escalation: { ...e, status: 'Joined', acceptedBy: id, joinedAt: joined } }
  })
}

/** The participant is sent a link to book a human follow-up. The session becomes Booked. */
export function sendBookingLink(doc: FieldworkDoc, sessionId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s?.escalation || !needsResearcher(s.escalation)) return doc
  return logged(
    escalate(doc, sessionId, (x, e) => ({
      ...addEventAt(when, x, 'system', `${by} sent ${x.participantId} a link to book a human follow-up`),
      status: 'Booked' as const,
      slot: null,
      escalation: { ...e, status: 'Booking link sent', actedBy: { by, at: when, action: 'Booking link' } },
    })),
    when,
    by,
    `Sent ${s.participantId} a booking link for a human follow-up`,
  )
}

/**
 * The moderator didn't show, so it is our fault: the participant is sent a booking link for a free reschedule. They are
 * never marked No-show, keep their incentive and their slot in the study, and the session leaves Needs you.
 */
export function sendRescheduleLink(doc: FieldworkDoc, sessionId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  return logged(
    patch(doc, sessionId, (x) => handledBy(addEventAt(when, x, 'system', `${by} sent ${x.participantId} a booking link for a free reschedule. The missed slot was our fault: no No-show, no penalty, the incentive and the slot are kept.`), when, by, 'Send booking link')),
    when,
    by,
    `Sent ${s.participantId} a booking link for a free reschedule after the moderator didn’t join`,
  )
}

/**
 * Dev: the moderator doesn't join a booked slot. Uses the first human-led booking that can have it. An AI-led study has
 * none, so it turns the first participant who consented and hasn't started into a human-led booking whose slot just passed.
 * Returns the doc unchanged when there is nobody to use.
 */
export function simulateModeratorNoShow(doc: FieldworkDoc): FieldworkDoc {
  const free = (x: Session) => !x.handled && !x.gaveUp && !x.moderatorNoShow
  const booked = doc.sessions.find((x) => x.mode === 'human' && x.status === 'Booked' && free(x))
  const waiting = booked ?? doc.sessions.find((x) => x.status === 'Not started' && x.access === 'Consented' && !x.startedAt && free(x))
  if (!waiting) return doc
  const when = tick(doc)
  const moderatorId = waiting.moderatorId ?? HUMAN_MODERATOR_IDS[0]
  return patch(doc, waiting.id, (x) =>
    addEventAt(
      when,
      { ...x, mode: 'human' as const, status: 'Booked' as const, moderatorId, slot: x.slot ?? at(when, -30), moderatorNoShow: { at: when } },
      'system',
      `${moderatorName(moderatorId)} didn’t join the booked slot. This one is on us, not the participant.`,
    ),
  )
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

/** "Can't make it": the moderator asks the study's Researcher to reassign a booked session, and says why. */
export function requestReassign(doc: FieldworkDoc, sessionId: string, moderatorId: string, reason: string): FieldworkDoc {
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s || s.moderatorId !== moderatorId || s.status !== 'Booked' || s.reassign || !reason.trim()) return doc
  const when = tick(doc)
  return logged(
    patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'moderator', `${moderatorName(moderatorId)} can’t make the booked time and asked for someone else: “${reason.trim()}”`), reassign: { by: moderatorId, reason: reason.trim(), at: when }, handled: undefined })),
    when,
    moderatorName(moderatorId),
    `Asked to be reassigned from ${s.participantId}: ${reason.trim()}`,
  )
}

export function assignModerator(doc: FieldworkDoc, sessionId: string, moderatorId: string, by: string): FieldworkDoc {
  const when = tick(doc)
  const s = doc.sessions.find((x) => x.id === sessionId)
  if (!s) return doc
  return logged(
    patch(doc, sessionId, (x) => handledBy(addEventAt(when, { ...x, moderatorId, reassign: undefined }, 'system', `${by} assigned ${moderatorName(moderatorId)}`), when, by, 'Assign moderator')),
    when,
    by,
    `Assigned ${moderatorName(moderatorId)} to ${s.participantId}`,
  )
}
