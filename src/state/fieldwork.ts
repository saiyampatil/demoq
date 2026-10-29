// Modules 4.6 and 4.7, seen from the researcher and the moderator: fieldwork sessions, their records, and the
// actions that change them. Sessions are mock records built from the confirmed pool when a release goes live.
// The participant and moderator runtime (4.2 to 4.5) writes through the same actions.

import type { AudienceDoc } from './audience'
import { now, uid } from './brief'
import type { GuideDoc } from './guide'
import type { LaunchDoc, PlanItem, StudyPlan } from './launch'
import { inPool, inviteRef, mockApplicants, regionOf } from './screening'

export type AccessStatus = 'Invited' | 'Opened' | 'Consented' | 'No-show'
/** "Not started" and "Booked" are additions to the session vocabulary; see docs/OPEN_QUESTIONS.md. */
export type SessionStatus = 'Not started' | 'Booked' | 'Active' | 'Paused' | 'Incomplete (resumable)' | 'Rescheduled' | 'Withdrawn' | 'Technical Error' | 'Completed'
export type EventKind = 'system' | 'participant' | 'moderator' | 'stimulus' | 'survey'
export type SessionEvent = { id: string; at: string; kind: EventKind; text: string }
export type StimulusResult = { name: string; result: 'Shown' | 'Failed to load' | 'Not shown' }
/** Survey answers are locked once recorded; follow-up probes never change them. */
export type Answer = { questionId: string; question: string; answer: string; lockedAt: string }
export type TranscriptTurn = { at: string; speaker: string; ai: boolean; text: string }
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
  id: string
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
}

export type LogEntry = { id: string; at: string; by: string; text: string }

export type FieldworkDoc = {
  studyId: string
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
}

// ─── mock generation ────────────────────────────────────────────────────────

/** The prototype's clock for fieldwork data. */
export const FIELDWORK_NOW = '2026-11-08T17:00:00-05:00'
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

type Variant = 'done' | 'active' | 'incomplete' | 'error' | 'withdrawn' | 'booked' | 'rescheduled' | 'noshow' | 'invited' | 'opened'

type Row = { ref: string; applicantId: string; cohort: string | null; state: string | null; reserve: boolean; variant: Variant; k: number }

export type GenInput = {
  studyId: string
  audience: AudienceDoc
  guide: GuideDoc
  plan: StudyPlan
  releaseNumber: number
  releaseVersion: string
  prefix: string
  launch?: LaunchDoc
}

const DEVICES = ['Mobile · iOS Safari', 'Mobile · Android Chrome', 'Desktop · Chrome', 'Desktop · Safari', 'Desktop · Edge']
const SPREAD_STATES = ['New York', 'Texas', 'California', 'Illinois', 'Georgia', 'Washington', 'Massachusetts', 'Florida', 'Ohio', 'Colorado']

// What goes wrong, in the order it is handed out. Pre-session problems land on people who haven't started; the rest on interviews.
const BEFORE: [IssueType, IssueSeverity, 'Open' | 'Resolved', string?][] = [
  ['Microphone permission denied', 'Blocking', 'Open'],
  ['Link expired or invalid', 'Blocking', 'Open'],
  ['Camera not detected', 'Blocking', 'Resolved', 'Joined in audio-only access mode'],
  ['Unsupported browser or device', 'Blocking', 'Resolved', 'Sent a link to open in Chrome'],
  ['Consent capture failed', 'Blocking', 'Resolved', 'Participant consented again and it was saved'],
]
const DURING: [IssueType, IssueSeverity, 'Open' | 'Resolved', string?][] = [
  ['Connection lost', 'Blocking', 'Open'],
  ['Audio dropped', 'Degraded', 'Resolved', 'Participant rejoined and the answer was repeated'],
  ['Video stream interrupted', 'Degraded', 'Resolved', 'Stream restarted after 40 seconds'],
  ['Stimulus failed to load', 'Degraded', 'Open'],
  ['Survey answer not saved', 'Degraded', 'Resolved', 'Answer re-entered and locked'],
  ['Recording failed to start', 'Blocking', 'Open'],
  ['Recording upload incomplete', 'Degraded', 'Resolved', 'Upload retried and verified'],
  ['Transcription delayed', 'Minor', 'Open'],
  ['AI agent timeout', 'Degraded', 'Resolved', 'Session resumed'],
  ['Moderator disconnected', 'Degraded', 'Resolved', 'Moderator rejoined and the session continued'],
  ['Echo or background noise', 'Minor', 'Resolved', 'Noted for the reviewer'],
]

export function generateFieldwork(i: GenInput): FieldworkDoc {
  const human = i.guide.moderator.mode === 'human'
  const mods = human ? i.guide.moderator.humanIds : []
  const apps = mockApplicants(i.audience)
  const pool = apps.filter(inPool).sort((a, b) => a.id.localeCompare(b.id))
  const rest = apps.filter((a) => !inPool(a) && a.outcome !== 'Ineligible').sort((a, b) => a.id.localeCompare(b.id))
  const known = new Set(apps.map((a) => a.contact))
  const pads = i.audience.sourcing.candidates.filter((c) => c.invitedAt && !known.has(inviteRef(c)))
  const stateOf = (a: { answers: { question: string; answer: string }[] }) => a.answers.find((x) => /state/i.test(x.question))?.answer || null

  const poolVariant = (k: number): Variant =>
    (human
      ? (['done', 'done', 'noshow', 'active', 'booked', 'booked', 'rescheduled', 'withdrawn'] as Variant[])
      : (['done', 'done', 'active', 'incomplete', 'error', 'done', 'withdrawn', 'done'] as Variant[]))[k] ?? (human ? 'booked' : 'done')
  const restVariant = (k: number): Variant => (['opened', 'invited', 'noshow', 'invited', 'opened', 'invited'] as Variant[])[k % 6]

  const rows: Row[] = [
    ...pool.map((a, k): Row => ({ ref: a.contact, applicantId: a.id, cohort: a.cohort, state: stateOf(a), reserve: false, variant: poolVariant(k), k })),
    ...rest.slice(0, 10).map((a, k): Row => ({ ref: a.contact, applicantId: a.id, cohort: a.cohort, state: stateOf(a), reserve: a.outcome === 'Reserve', variant: restVariant(k), k })),
  ]
  // Invitees who never answered the screener still hold a session, so the list is never thin.
  pads.slice(0, Math.max(0, 20 - rows.length)).forEach((c, k) => rows.push({ ref: inviteRef(c), applicantId: `A-x${k + 1}`, cohort: null, state: SPREAD_STATES[k % SPREAD_STATES.length], reserve: false, variant: 'opened', k }))

  const items = i.plan.sections.flatMap((s) => s.items)
  const mandatory = items.filter((x) => x.core).map((x) => x.id)
  const stimNames = [...new Set(items.map((x) => x.stimulus).filter((x): x is string => !!x))]
  const failed = i.guide.stimuli.items.filter((s) => s.renderOk === false).map((s) => s.name)
  const surveyItems = items.filter((x) => x.survey)
  const options = (text: string) => i.guide.moderator.surveys.find((s) => s.text === text)?.options ?? ['Yes', 'No']
  const lang = i.guide.moderator.language
  const consentAt = i.launch?.setup.consent[lang]?.at
  const wording = `${lang}, approved ${new Date(consentAt ?? '2026-10-26T15:00:00-04:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}`

  const sessions = rows.map((r, n): Session => {
    const id = `${i.prefix}${String(n + 1).padStart(3, '0')}`
    const humanSession = human
    const modId = humanSession ? mods[n % mods.length] ?? null : null
    const moderator = modId ? HUMAN_NAMES[modId] ?? 'Moderator' : 'AI moderator'
    const v = r.variant
    const started = v === 'done' || v === 'active' || v === 'incomplete' || v === 'error' || v === 'withdrawn'

    // Past sessions are spread across the days since launch; booked ones are still ahead.
    const pastAt = at(FIELDWORK_START, Math.floor(r.k / 2) * 1440 + (r.k % 2) * 300 + 75)
    const nowish = at(FIELDWORK_NOW, -22)
    const aheadAt = at(FIELDWORK_NOW, (1 + (r.k % 5)) * 1440 - 7 * 60 + (r.k % 3) * 120)
    const hasSlot = humanSession && v !== 'invited' && v !== 'opened'
    const slot = hasSlot ? (v === 'active' ? nowish : v === 'booked' ? aheadAt : v === 'rescheduled' ? at(FIELDWORK_NOW, 2 * 1440 - 180) : pastAt) : null
    const t0 = (humanSession ? slot : v === 'active' ? nowish : started || v === 'noshow' ? pastAt : at(FIELDWORK_NOW, -(r.k + 1) * 300)) ?? pastAt

    const access: AccessStatus = v === 'noshow' ? 'No-show' : v === 'invited' ? 'Invited' : v === 'opened' ? 'Opened' : 'Consented'
    const status: SessionStatus =
      v === 'done' ? 'Completed' : v === 'active' ? 'Active' : v === 'incomplete' ? 'Incomplete (resumable)' : v === 'error' ? 'Technical Error' : v === 'withdrawn' ? 'Withdrawn' : v === 'booked' ? 'Booked' : v === 'rescheduled' || (v === 'noshow' && humanSession) ? 'Rescheduled' : 'Not started'

    const askedCount = v === 'done' ? items.length : v === 'active' ? 3 : v === 'incomplete' ? 2 : v === 'error' ? 1 : v === 'withdrawn' ? 1 : 0
    const asked = items.slice(0, askedCount).map((x) => x.id)
    const covered = v === 'done' ? mandatory : v === 'active' ? mandatory.slice(0, 2) : v === 'incomplete' ? mandatory.slice(0, 1) : []
    const shownCount = v === 'done' ? stimNames.length : v === 'active' || v === 'incomplete' ? Math.min(1, stimNames.length) : 0
    const stimuli: StimulusResult[] = started
      ? stimNames.map((name, j) => ({ name, result: v === 'error' && j === 0 ? 'Failed to load' : j < shownCount ? (failed.includes(name) ? 'Failed to load' : 'Shown') : 'Not shown' }))
      : []

    const region = (regionOf(r.state ?? '') as Region | undefined) ?? null
    const device = DEVICES[(n * 3 + 1) % DEVICES.length]
    const consented = access === 'Consented' || (v === 'noshow' && humanSession)
    const consent: ConsentRecord | null = consented
      ? {
          at: at(t0, v === 'booked' ? -1500 : -300),
          wording,
          recording: true,
          aiModerator: !humanSession,
          dataUse: true,
          recontact: n % 3 !== 0,
          over18: true,
          device,
          withdrawn: v === 'withdrawn' ? { at: at(t0, 6), reason: 'Chose to stop during the interview and withdrew consent for the recording.' } : undefined,
        }
      : null

    const events: SessionEvent[] = [ev(at(t0, -1440 * 2), 'system', 'Invited to the study')]
    if (access !== 'Invited') events.push(ev(at(t0, -1500), 'participant', 'Opened the invite link'))
    if (consent) events.push(ev(consent.at, 'participant', humanSession ? 'Consented to recording' : 'Consented to recording and to an AI moderator'))
    if (humanSession && slot) events.push(ev(at(t0, -1490), 'system', `Booked a slot with ${moderator}`))
    if (v === 'noshow') events.push(ev(at(t0, 10), 'system', humanSession ? 'Did not join at the booked slot. Sent to rescheduling (4.7).' : 'The invitation window is still open. No interview started.'))
    if (v === 'rescheduled') events.push(ev(at(t0, -60), 'participant', 'Asked to move the slot. Sent to rescheduling (4.7).'))
    if (started) events.push(ev(t0, 'system', humanSession ? `${moderator} joined at the booked slot` : 'Interview started'))
    stimuli.forEach((s, j) => {
      const w = at(t0, 4 + j * 3)
      if (s.result === 'Shown') events.push(ev(w, 'stimulus', `Shown: ${s.name}`))
      if (s.result === 'Failed to load') events.push(ev(w, 'stimulus', `Could not load: ${s.name}. Counted as not seen.`))
    })
    const answers: Answer[] = v === 'done' ? surveyItems.map((x) => ({ questionId: x.id, question: x.survey!, answer: options(x.survey!)[(n + r.k) % options(x.survey!).length], lockedAt: at(t0, 12) })) : []
    answers.forEach((a) => events.push(ev(a.lockedAt, 'survey', `Answered and locked: ${a.question}`)))
    if (v === 'incomplete') events.push(ev(at(t0, 9), 'system', 'The participant left. The session can be resumed.'))
    if (v === 'error') events.push(ev(at(t0, 3), 'system', 'Technical error: the connection dropped before the session could continue.'))
    if (v === 'withdrawn') events.push(ev(at(t0, 6), 'participant', 'Withdrew from the study. Consent for the recording was withdrawn.'))
    const duration = v === 'done' ? i.plan.durationMin - 3 + ((n * 7) % 9) : v === 'incomplete' ? 9 : v === 'error' ? 3 : v === 'withdrawn' ? 6 : null
    if (v === 'done') events.push(ev(at(t0, duration ?? 0), 'system', 'Interview completed'))

    const transcript: TranscriptTurn[] = items.slice(0, Math.min(askedCount, 3)).flatMap((x, j) => [
      { at: at(t0, j * 3), speaker: moderator, ai: !humanSession, text: x.text },
      { at: at(t0, j * 3 + 1), speaker: 'Participant', ai: false, text: PARTICIPANT[(n + j) % PARTICIPANT.length] },
    ])

    return {
      id,
      applicantId: r.applicantId,
      ref: r.ref,
      cohort: r.cohort,
      region,
      state: r.state,
      device,
      reserve: r.reserve,
      mode: humanSession ? 'human' : 'ai',
      access,
      status,
      moderatorId: modId,
      slot,
      startedAt: started ? t0 : null,
      durationMin: duration,
      events,
      stimuli,
      answers,
      asked,
      covered,
      followUps: {},
      transcript,
      issues: [],
      consent,
      notes:
        humanSession && v === 'done' && r.k === 0
          ? { takeaways: 'Hydration matters most. Concept A’s 72-hour claim was doubted until she heard the test method.', friction: 'The refill question came late and felt rushed.', missing: 'None.', recontact: 'Yes', recontactNote: 'Open to a follow-up on the refill pouch.', by: moderator, at: at(t0, 40) }
          : null,
    }
  })

  // Hand out the technical issues: before-interview ones to people who haven't started, the rest to interviews.
  const mk = (t0: string, spec: [IssueType, IssueSeverity, 'Open' | 'Resolved', string?], by: string): TechIssue => ({
    id: uid('ti'),
    type: spec[0],
    severity: spec[1],
    at: t0,
    status: spec[2],
    resolution: spec[3],
    resolvedBy: spec[2] === 'Resolved' ? by : undefined,
    resolvedAt: spec[2] === 'Resolved' ? at(t0, 25) : undefined,
  })
  const notStarted = sessions.filter((x) => !x.startedAt)
  BEFORE.forEach((spec, j) => {
    const s = notStarted[j]
    if (s) s.issues.push(mk(at(s.slot ?? s.events[0].at, 30), spec, 'Maya Ortiz'))
  })
  const ran = sessions.filter((x) => x.startedAt)
  const doneRan = ran.filter((x) => x.status === 'Completed')
  const during = DURING.filter(([t]) => (human ? t !== 'AI agent timeout' : t !== 'Moderator disconnected'))
  // Interviews that ended on an error carry the open blocking problem.
  const errored = ran.find((x) => x.status === 'Technical Error')
  if (errored) errored.issues.push(mk(at(errored.startedAt!, 3), ['Connection lost', 'Blocking', 'Open'], 'Maya Ortiz'))
  during
    .filter(([t]) => t !== 'Connection lost')
    .forEach((spec, j) => {
      const pickFrom = doneRan.length ? doneRan : ran
      const s = pickFrom[j % pickFrom.length]
      if (s && s.issues.length < 3) s.issues.push(mk(at(s.startedAt!, 5 + j), spec, 'Maya Ortiz'))
    })
  // The "Recording failed" case belongs on an interview that can't be used.
  const wd = ran.find((x) => x.status === 'Withdrawn')
  if (wd && !wd.issues.some((x) => x.type === 'Recording failed to start')) wd.issues.push(mk(at(wd.startedAt!, 1), ['Recording failed to start', 'Blocking', 'Open'], 'Maya Ortiz'))

  return {
    studyId: i.studyId,
    releaseNumber: i.releaseNumber,
    releaseVersion: i.releaseVersion,
    plan: i.plan,
    failedStimuli: failed,
    sessions,
    window: i.launch?.setup.fieldwork ?? { start: '2026-11-03', end: '2026-11-17' },
    consentWording: wording,
    paused: null,
    log: [],
  }
}

/** Names of the human moderators the mock data can assign. */
const HUMAN_NAMES: Record<string, string> = { 'u-jordan': 'Jordan Lee', 'u-priya': 'Priya Shah', 'u-sam': 'Sam Okafor', 'u-elena': 'Elena Brooks' }
export const moderatorName = (id: string | null) => (id ? (HUMAN_NAMES[id] ?? id) : 'AI moderator')

// ─── reading ────────────────────────────────────────────────────────────────

export const planItems = (plan: StudyPlan): (PlanItem & { section: string })[] => plan.sections.flatMap((s) => s.items.map((x) => ({ ...x, section: s.title })))

export function fieldworkSummary(doc: FieldworkDoc) {
  const s = doc.sessions
  const n = (f: (x: Session) => boolean) => s.filter(f).length
  return {
    invited: s.length,
    consented: n((x) => x.access === 'Consented'),
    inProgress: n((x) => x.status === 'Active' || x.status === 'Paused'),
    completed: n((x) => x.status === 'Completed'),
    noShow: n((x) => x.access === 'No-show'),
    rescheduled: n((x) => x.status === 'Rescheduled'),
    attention: s.filter(needsAttention).length,
  }
}

export const needsAttention = (x: Session) =>
  x.status === 'Technical Error' || x.status === 'Incomplete (resumable)' || x.status === 'Rescheduled' || x.status === 'Withdrawn' || x.access === 'No-show'

export function attentionReason(x: Session): string {
  if (x.status === 'Technical Error') return 'Technical error. Needs a retry or a new slot.'
  if (x.status === 'Incomplete (resumable)') return 'Left part-way. The participant can resume.'
  if (x.access === 'No-show') return x.mode === 'human' ? 'Missed the booked slot. Needs rescheduling.' : 'Has not started inside the invitation window.'
  if (x.status === 'Rescheduled') return 'Moved to a new slot.'
  return 'Withdrew from the study.'
}

export function quotaFill(doc: FieldworkDoc, audience: AudienceDoc | undefined) {
  return (audience?.def?.cohorts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    target: c.participants ?? 0,
    completed: doc.sessions.filter((x) => x.cohort === c.name && x.status === 'Completed' && !x.reserve).length,
    inProgress: doc.sessions.filter((x) => x.cohort === c.name && (x.status === 'Active' || x.status === 'Paused')).length,
    reserve: doc.sessions.filter((x) => x.cohort === c.name && x.reserve).length,
  }))
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

export const pauseFieldwork = (doc: FieldworkDoc, reason: string, by: string): FieldworkDoc =>
  doc.paused ? doc : { ...doc, paused: { reason: reason.trim(), by, at: now() }, log: [...doc.log, { id: uid('fl'), at: now(), by, text: `Paused fieldwork: ${reason.trim()}` }] }

export const resumeFieldwork = (doc: FieldworkDoc, by: string): FieldworkDoc =>
  doc.paused ? { ...doc, paused: null, log: [...doc.log, { id: uid('fl'), at: now(), by, text: 'Resumed fieldwork' }] } : doc

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
export function pacing(doc: FieldworkDoc, target: number) {
  const w = doc.window
  const completed = doc.sessions.filter((x) => x.status === 'Completed').length
  if (!w) return { completed, target, days: 0, day: 0, expected: 0, projected: completed, left: 0 }
  const day0 = new Date(`${w.start}T00:00:00-05:00`).getTime()
  const end = new Date(`${w.end}T23:59:59-05:00`).getTime()
  const days = Math.round((end - day0) / 86400000)
  const day = Math.min(days, Math.max(1, Math.ceil((new Date(FIELDWORK_NOW).getTime() - day0) / 86400000)))
  const expected = Math.round((target * day) / days)
  const projected = Math.round((completed / day) * days)
  return { completed, target, days, day, expected, projected, left: days - day }
}

export function regionMatrix(doc: FieldworkDoc, audience: AudienceDoc | undefined) {
  const cohorts = audience?.def?.cohorts ?? []
  const done = doc.sessions.filter((x) => x.status === 'Completed' && !x.reserve)
  const rows = cohorts.map((c) => {
    const mine = done.filter((x) => x.cohort === c.name)
    return { id: c.id, name: c.name, target: c.participants ?? 0, completed: mine.length, byRegion: Object.fromEntries(REGIONS.map((r) => [r, mine.filter((x) => x.region === r).length])) as Record<Region, number> }
  })
  const totals = Object.fromEntries(REGIONS.map((r) => [r, done.filter((x) => x.region === r).length])) as Record<Region, number>
  return { rows, totals, total: done.length, unplaced: done.filter((x) => !x.region).length }
}

export function issueSummary(doc: FieldworkDoc) {
  const all = doc.sessions.flatMap((s) => s.issues.map((i) => ({ ...i, sessionId: s.id, ref: s.ref })))
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

export function consentSummary(doc: FieldworkDoc) {
  const s = doc.sessions
  const given = s.filter((x) => x.consent && !x.consent.withdrawn)
  const withdrawn = s.filter((x) => x.consent?.withdrawn)
  const pending = s.filter((x) => !x.consent)
  const recontact = given.filter((x) => x.consent!.recontact).length
  return { given: given.length, withdrawn: withdrawn.length, pending: pending.length, recontact, recontactPct: given.length ? Math.round((recontact / given.length) * 100) : 0, total: s.length }
}

export const resolveIssue = (doc: FieldworkDoc, sessionId: string, issueId: string, by: string, resolution: string): FieldworkDoc => {
  const when = now()
  const type = doc.sessions.find((s) => s.id === sessionId)?.issues.find((x) => x.id === issueId)?.type
  return {
    ...patch(doc, sessionId, (s) => addEvent({ ...s, issues: s.issues.map((x) => (x.id === issueId && x.status === 'Open' ? { ...x, status: 'Resolved' as const, resolution: resolution.trim(), resolvedBy: by, resolvedAt: when } : x)) }, 'system', `${type} marked resolved by ${by}`)),
    log: [...doc.log, { id: uid('fl'), at: when, by, text: `Resolved “${type}” on ${sessionId}: ${resolution.trim()}` }],
  }
}
