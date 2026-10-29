// Modules 4.6 and 4.7, seen from the researcher and the moderator: fieldwork sessions, their records, and the
// actions that change them. Sessions are mock records built from the confirmed pool when a release goes live.
// The participant and moderator runtime (4.2 to 4.5) writes through the same actions.

import type { AudienceDoc } from './audience'
import { now, uid } from './brief'
import type { GuideDoc } from './guide'
import type { PlanItem, StudyPlan } from './launch'
import { inPool, inviteRef, mockApplicants } from './screening'

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

export type Session = {
  id: string
  applicantId: string
  ref: string
  cohort: string | null
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
  paused: { reason: string; by: string; at: string } | null
  log: LogEntry[]
}

// ─── mock generation ────────────────────────────────────────────────────────

/** The prototype's clock for fieldwork data. */
export const FIELDWORK_NOW = '2026-11-03T17:00:00-05:00'
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

type Variant = 'done' | 'active' | 'incomplete' | 'error' | 'booked' | 'rescheduled' | 'noshow' | 'invited' | 'opened'

type Row = { ref: string; applicantId: string; cohort: string | null; reserve: boolean; variant: Variant; k: number }

export type GenInput = {
  studyId: string
  audience: AudienceDoc
  guide: GuideDoc
  plan: StudyPlan
  releaseNumber: number
  releaseVersion: string
  prefix: string
}

export function generateFieldwork(i: GenInput): FieldworkDoc {
  const human = i.guide.moderator.mode === 'human'
  const mods = human ? i.guide.moderator.humanIds : []
  const apps = mockApplicants(i.audience)
  const pool = apps.filter(inPool).sort((a, b) => a.id.localeCompare(b.id))
  const rest = apps.filter((a) => !inPool(a) && a.outcome !== 'Ineligible').sort((a, b) => a.id.localeCompare(b.id))
  const known = new Set(apps.map((a) => a.contact))
  const pads = i.audience.sourcing.candidates.filter((c) => c.invitedAt && !known.has(inviteRef(c)))

  const poolVariant = (k: number): Variant =>
    human ? (['done', 'done', 'noshow', 'active', 'booked', 'booked', 'rescheduled'] as Variant[])[k] ?? 'booked' : (['active', 'incomplete', 'error'] as Variant[])[k] ?? 'done'
  const restVariant = (k: number): Variant => (k === 2 ? 'opened' : k === 3 && !human ? 'noshow' : 'invited')

  const rows: Row[] = [
    ...pool.map((a, k): Row => ({ ref: a.contact, applicantId: a.id, cohort: a.cohort, reserve: false, variant: poolVariant(k), k })),
    ...rest.slice(0, 6).map((a, k): Row => ({ ref: a.contact, applicantId: a.id, cohort: a.cohort, reserve: a.outcome === 'Reserve', variant: restVariant(k), k })),
  ]
  // Invitees who never answered the screener still hold a session, so the list is never thin.
  pads.slice(0, Math.max(0, 14 - rows.length)).forEach((c, k) => rows.push({ ref: inviteRef(c), applicantId: `A-x${k + 1}`, cohort: null, reserve: false, variant: 'opened', k }))

  const items = i.plan.sections.flatMap((s) => s.items)
  const mandatory = items.filter((x) => x.core).map((x) => x.id)
  const stimNames = [...new Set(items.map((x) => x.stimulus).filter((x): x is string => !!x))]
  const failed = i.guide.stimuli.items.filter((s) => s.renderOk === false).map((s) => s.name)
  const surveyItems = items.filter((x) => x.survey)
  const options = (text: string) => i.guide.moderator.surveys.find((s) => s.text === text)?.options ?? ['Yes', 'No']

  const sessions = rows.map((r, n): Session => {
    const id = `${i.prefix}${String(n + 1).padStart(3, '0')}`
    const humanSession = human
    const modId = humanSession ? mods[n % mods.length] ?? null : null
    const moderator = modId ? HUMAN_NAMES[modId] ?? 'Moderator' : 'AI moderator'
    const slotBase = '2026-11-03T10:00:00-05:00'
    const slot = humanSession && (r.variant !== 'invited' && r.variant !== 'opened') ? at(slotBase, (r.k % 4) * 120 + Math.floor(r.k / 4) * 1440) : null
    const aiStart = at('2026-11-03T09:15:00-05:00', r.k * 45)
    const start = humanSession ? slot : aiStart
    const started = ['done', 'active', 'incomplete', 'error'].includes(r.variant)

    const access: AccessStatus = r.variant === 'noshow' ? 'No-show' : r.variant === 'invited' ? 'Invited' : r.variant === 'opened' ? 'Opened' : 'Consented'
    const status: SessionStatus =
      r.variant === 'done'
        ? 'Completed'
        : r.variant === 'active'
          ? 'Active'
          : r.variant === 'incomplete'
            ? 'Incomplete (resumable)'
            : r.variant === 'error'
              ? 'Technical Error'
              : r.variant === 'booked'
                ? 'Booked'
                : r.variant === 'rescheduled' || (r.variant === 'noshow' && humanSession)
                  ? 'Rescheduled'
                  : 'Not started'

    const askedCount = r.variant === 'done' ? items.length : r.variant === 'active' ? 3 : r.variant === 'incomplete' ? 2 : r.variant === 'error' ? 1 : 0
    const asked = items.slice(0, askedCount).map((x) => x.id)
    const covered = r.variant === 'done' ? mandatory : r.variant === 'active' ? mandatory.slice(0, 2) : r.variant === 'incomplete' ? mandatory.slice(0, 1) : []
    const shownCount = r.variant === 'done' ? stimNames.length : r.variant === 'active' || r.variant === 'incomplete' ? Math.min(1, stimNames.length) : 0
    const stimuli: StimulusResult[] = started
      ? stimNames.map((name, j) => ({ name, result: r.variant === 'error' && j === 0 ? 'Failed to load' : j < shownCount ? (failed.includes(name) ? 'Failed to load' : 'Shown') : 'Not shown' }))
      : []

    const t0 = start ?? aiStart
    const events: SessionEvent[] = [ev(at(t0, -1440), 'system', 'Invited to the study')]
    if (access !== 'Invited') events.push(ev(at(t0, -600), 'participant', 'Opened the invite link'))
    if (access === 'Consented') events.push(ev(at(t0, -300), 'participant', humanSession ? 'Consented to recording' : 'Consented to recording and to an AI moderator'))
    if (humanSession && slot) events.push(ev(at(t0, -290), 'system', `Booked a slot with ${moderator}`))
    if (r.variant === 'noshow') events.push(ev(at(t0, 10), 'system', humanSession ? 'Did not join at the booked slot. Sent to rescheduling (4.7).' : 'The invitation window is still open. No interview started.'))
    if (r.variant === 'rescheduled') events.push(ev(at(t0, -60), 'participant', 'Asked to move the slot. Sent to rescheduling (4.7).'))
    if (started) events.push(ev(t0, 'system', humanSession ? `${moderator} joined at the booked slot` : 'Interview started'))
    stimuli.forEach((s, j) => {
      const w = at(t0, 4 + j * 3)
      if (s.result === 'Shown') events.push(ev(w, 'stimulus', `Shown: ${s.name}`))
      if (s.result === 'Failed to load') events.push(ev(w, 'stimulus', `Could not load: ${s.name}. Counted as not seen.`))
    })

    const answers: Answer[] =
      r.variant === 'done'
        ? surveyItems.map((x) => ({ questionId: x.id, question: x.survey!, answer: options(x.survey!)[(n + r.k) % options(x.survey!).length], lockedAt: at(t0, 12) }))
        : []
    answers.forEach((a) => events.push(ev(a.lockedAt, 'survey', `Answered and locked: ${a.question}`)))
    if (r.variant === 'incomplete') events.push(ev(at(t0, 9), 'system', 'The participant left. The session can be resumed.'))
    if (r.variant === 'error') events.push(ev(at(t0, 3), 'system', 'Technical error: the stimulus failed to load and the connection dropped.'))
    const duration = r.variant === 'done' ? i.plan.durationMin - 2 + (n % 4) : r.variant === 'incomplete' ? 9 : r.variant === 'error' ? 3 : null
    if (r.variant === 'done') events.push(ev(at(t0, duration ?? 0), 'system', 'Interview completed'))

    const transcript: TranscriptTurn[] = items.slice(0, Math.min(askedCount, 3)).flatMap((x, j) => [
      { at: at(t0, j * 3), speaker: moderator, ai: !humanSession, text: x.text },
      { at: at(t0, j * 3 + 1), speaker: 'Participant', ai: false, text: PARTICIPANT[(n + j) % PARTICIPANT.length] },
    ])

    return {
      id,
      applicantId: r.applicantId,
      ref: r.ref,
      cohort: r.cohort,
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
      notes:
        humanSession && r.variant === 'done' && r.k === 0
          ? { takeaways: 'Hydration matters most. Concept A’s 72-hour claim was doubted until she heard the test method.', friction: 'The refill question came late and felt rushed.', missing: 'None.', recontact: 'Yes', recontactNote: 'Open to a follow-up on the refill pouch.', by: moderator, at: at(t0, 40) }
          : null,
    }
  })

  return {
    studyId: i.studyId,
    releaseNumber: i.releaseNumber,
    releaseVersion: i.releaseVersion,
    plan: i.plan,
    failedStimuli: failed,
    sessions,
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
