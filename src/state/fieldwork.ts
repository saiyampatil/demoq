// Modules 4.6 and 4.7, seen from the researcher and the moderator: fieldwork sessions, their records, and the
// actions that change them. Sessions are mock records built from the confirmed pool when a release goes live.
// The participant and moderator runtime (4.2 to 4.5) writes through the same actions.

import type { AudienceDoc } from './audience'
import { now, uid } from './brief'
import type { GuideDoc } from './guide'
import type { LaunchDoc, PlanItem, StudyPlan } from './launch'
import { DEFAULT_COHORT_NAMES, SEED_SESSIONS } from '@/mock/sessions'
import { regionOf } from './screening'

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
export const SESSION_SEED = 2

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
  const wording = `${lang}, approved ${new Date(consentAt ?? '2026-10-26T15:00:00-04:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}`

  const sessions = SEED_SESSIONS.map((r, n): Session => {
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
    const consented = access === 'Consented' || v === 'noshow'
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
    const events: SessionEvent[] = [ev(invitedAt, 'system', 'Invited to the study')]
    if (access !== 'Invited') events.push(ev(v === 'opened' ? r.at : at(consent?.at ?? t0, -10), 'participant', 'Opened the invite link'))
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
        return { id: `${r.id}-ti${j + 1}`, type: t, severity, at: when, status: st, resolution, resolvedBy: st === 'Resolved' ? 'Maya Ortiz' : undefined, resolvedAt: st === 'Resolved' ? at(when, 25) : undefined }
      })
      .filter((x) => !ISSUE_META[x.type].only || ISSUE_META[x.type].only === (human ? 'Human-led' : 'AI-led'))

    return {
      id: r.id,
      applicantId: `A-${r.id.slice(2)}`,
      ref: refOf(r.id),
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
  }
}

/** Names of the human moderators the mock data can assign. */
const HUMAN_NAMES: Record<string, string> = { 'u-jordan': 'Jordan Lee', 'u-priya': 'Priya Shah', 'u-sam': 'Sam Okafor', 'u-elena': 'Elena Brooks' }
/** The same name Review shows for the session's moderator. */
export const moderatorName = (id: string | null) => (id ? (HUMAN_NAMES[id] ?? id) : 'AI agent (Ava)')

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

/** Completed sessions that count toward quota: Excluded sessions stay visible but are out of quotas. */
export const countsTowardQuota = (x: Session, excluded: ReadonlySet<string>) => x.status === 'Completed' && !x.reserve && !excluded.has(x.id)

export function quotaFill(doc: FieldworkDoc, audience: AudienceDoc | undefined, excluded: ReadonlySet<string> = new Set()) {
  return (audience?.def?.cohorts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    target: c.participants ?? 0,
    completed: doc.sessions.filter((x) => x.cohort === c.name && countsTowardQuota(x, excluded)).length,
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
export function pacing(doc: FieldworkDoc, target: number, excluded: ReadonlySet<string> = new Set()) {
  const w = doc.window
  const completed = doc.sessions.filter((x) => countsTowardQuota(x, excluded)).length
  if (!w) return { completed, target, days: 0, day: 0, expected: 0, projected: completed, left: 0 }
  const day0 = new Date(`${w.start}T00:00:00-05:00`).getTime()
  const end = new Date(`${w.end}T23:59:59-05:00`).getTime()
  const days = Math.round((end - day0) / 86400000)
  const day = Math.min(days, Math.max(1, Math.ceil((new Date(FIELDWORK_NOW).getTime() - day0) / 86400000)))
  const expected = Math.round((target * day) / days)
  const projected = Math.round((completed / day) * days)
  return { completed, target, days, day, expected, projected, left: days - day }
}

export function regionMatrix(doc: FieldworkDoc, audience: AudienceDoc | undefined, excluded: ReadonlySet<string> = new Set()) {
  const cohorts = audience?.def?.cohorts ?? []
  const done = doc.sessions.filter((x) => countsTowardQuota(x, excluded))
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
