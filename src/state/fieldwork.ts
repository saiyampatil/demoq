// Modules 4.6 and 4.7, seen from the researcher and the moderator: fieldwork sessions, their records, and the
// actions that change them. Sessions are mock records built from the confirmed pool when a release goes live.
// The participant and moderator runtime (4.2 to 4.5) writes through the same actions.

import type { AudienceDoc, SourceTag } from './audience'
import { formatDate, formatSlot } from '@/lib/format'
import { studyTimeZone } from '@/lib/timeZone'
import type { ReviewStatus } from '@/mock/review'
import { now, uid } from './brief'
import type { GuideDoc } from './guide'
import type { LaunchDoc, PlanItem, StudyPlan } from './launch'
import { SEED_SESSIONS, sessionIdOf } from '@/mock/sessions'
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

export type Session = {
  /** The session's ID, e.g. P-2041-1. A participant who comes back (resume, retry, reschedule) gets P-2041-2. */
  id: string
  /** The person, e.g. P-2041. The main label on every screen. */
  participantId: string
  /** Which of the participant's sessions this is. */
  no: number
  applicantId: string
  ref: string
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
  paused: { reason: string; by: string; at: string } | null
  /** Set when the Researcher closed fieldwork: no more invitations or sessions. The study is Complete. */
  closed?: { by: string; at: string }
  /** A top-up: the Researcher asked for more applicants after launch to close a gap. */
  topUp?: { requested: number; by: string; at: string }
  /** The Researcher lowered the target. It replaces the audience's target for every count. */
  targetChange?: { from: number; to: number; by: string; at: string; reason: string }
  log: LogEntry[]
  /** Reserve people who have been invited. The rest of the reserve is read from screening (R9). */
  reserve: ReserveCandidate[]
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
export const SESSION_SEED = 7

const DEVICES = ['Mobile · iOS Safari', 'Mobile · Android Chrome', 'Desktop · Chrome', 'Desktop · Safari', 'Desktop · Edge']

/** The participant's reference as the Researcher sourced it, masked like the sourcing list. */
const refOf = (id: string) => `Phone · (212) ••• ${id.slice(2)}`

/** Builds the study's sessions from the one seed list (mock/sessions.ts), so Fieldwork and Review always agree. */
export function generateFieldwork(i: GenInput): FieldworkDoc {
  const human = i.guide.moderator.mode === 'human'
  const mods = human ? i.guide.moderator.humanIds : []

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
      ref: refOf(r.participant),
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
    ref: s.ref,
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
      ref: c.contact,
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
  const gone = patch(doc, sessionId, (x) => ({ ...addEventAt(when, x, 'system', `${by} gave up on this participant and opened a slot: ${reason.trim()}`), gaveUp: { reason: reason.trim(), at: when, by } }))
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
    return { ...addEventAt(when, x, 'participant', 'Answered the next question'), transcript: [...x.transcript, { at: when, speaker: 'Participant', ai: false, text: PARTICIPANT[n % PARTICIPANT.length] }] }
  })
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
