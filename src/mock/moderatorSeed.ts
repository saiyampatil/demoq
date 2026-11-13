// Mock data for the Moderator view, so every tab shows something in the prototype. This is the only place it lives:
// delete this file and the one call in state/StudyContext.tsx and the Moderator view is empty again.
//
// It adds to the same fieldwork record the Researcher sees, never a second store: booked sessions, requests are
// escalations on sessions, and the Completed and Submitted lists are existing finished interviews given to a
// moderator. Each moderator only gets data in a study they can see (a team moderator: their own company's).
//
//   Jordan Lee (PulseAI, Eastern) and Ravi Menon (team moderator, Burrow Pet, India), both in Pet Food
//   Subscription Churn, the one study that has fieldwork in every state. Ravi's hours are US evenings, shown in IST.
//
// It deliberately adds nothing to the Moisturizer study's live fieldwork: that study's gap, Needs you and recovery
// scenarios are the Researcher's live-fieldwork demo, and extra booked sessions would change every number in it.
//
// Times are against the prototype clock (FIELDWORK_NOW, Wed Nov 11 2026, 5:00 PM Eastern).
// Switch it off for a run that needs empty tabs: localStorage "pulseai-qual:moderator-seed" = "off".

import { uid } from '@/state/brief'
import { FIELDWORK_NOW, moderatorName, planItems, type EventKind, type FieldworkDoc, type Notes, type Region, type Session, type SessionEvent } from '@/state/fieldwork'
import { nextWeekdayAt } from '@/state/standby'
import { zonedInstant } from '@/state/zone'
import { participantEmail } from './participants'

/**
 * The seeded sessions each hold a stimulus plan, so the session brief shows a different order for each participant, and one
 * of them was booked under the guide's earlier version so the "Guide updated" note shows. Its own flag, so saved progress
 * that already has the sessions picks the plans up without the sessions being added twice. Not a split study: it only shows what
 * a plan looks like in the brief.
 */
export const PLAN_SEED_VERSION = 1
const ORDERS: Record<string, number[]> = { 'P-9101': [0, 1, 2], 'P-9102': [1, 2, 0], 'P-9103': [2, 0, 1], 'P-9201': [1, 2, 0], 'P-9202': [2, 0, 1], 'P-9203': [0, 1, 2] }

function seedPlans(doc: FieldworkDoc): FieldworkDoc {
  const names = doc.plan.sections.flatMap((s) => s.items.map((i) => i.stimulus)).filter((x, i, a): x is string => !!x && a.indexOf(x) === i)
  if (names.length < 2) return doc
  const v = doc.plan.guideVersion
  return {
    ...doc,
    planSeed: PLAN_SEED_VERSION,
    sessions: doc.sessions.map((s) => {
      const order = ORDERS[s.participantId]
      if (!order || s.stimulusPlan) return s
      const picked = order.filter((i) => i < names.length).map((i) => names[i])
      const n = order[0]
      return {
        ...s,
        // Jordan's session tomorrow was booked under the earlier guide.
        bookedGuide: s.participantId === 'P-9103' ? Math.max(1, v - 1) : v,
        stimulusPlan: { id: `g1-r${n}`, group: 1, order: picked, names: picked, guideVersion: v, segment: 'All participants', assignedAt: inMin(-90) },
      }
    }),
  }
}

/** Bump when the seed changes, so saved progress picks it up. */
export const MODERATOR_SEED_VERSION = 1

const JORDAN = 'u-jordan'
const RAVI = 'tm-ravi'
const PET = 'pet-food-churn'

const MIN = 60000
const NOW = new Date(FIELDWORK_NOW).getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const inMin = (m: number) => iso(NOW + m * MIN)
/** A wall-clock time in Eastern, `days` after today. */
const eastern = (days: number, hh: number, mm: number) => iso(zonedInstant(2026, 11, 11 + days, hh, mm, 'America/New_York'))

const REGIONS: Region[] = ['Northeast', 'Midwest', 'South', 'West']
const STATES: Record<Region, string> = { Northeast: 'New York', Midwest: 'Illinois', South: 'Georgia', West: 'California' }
const LINES = ['Honestly I just want to talk to a person about this.', 'I switched last year because the old one felt heavy.', 'The price would decide it for me.']

const ev = (at: string, kind: EventKind, text: string): SessionEvent => ({ id: uid('ev'), at, kind, text })

/** A participant who has not started, ready to be given a booking or a request. */
function blank(n: number, mode: Session['mode']): Session {
  const id = `P-${n}`
  const region = REGIONS[n % 4]
  return {
    id: `${id}-1`,
    participantId: id,
    no: 1,
    applicantId: `A-${n}`,
    email: participantEmail(id),
    country: 'United States',
    region,
    state: STATES[region],
    device: 'Mobile · iOS Safari',
    reserve: false,
    mode,
    access: 'Consented',
    status: 'Not started',
    validationStatus: null,
    moderatorId: null,
    slot: null,
    startedAt: null,
    durationMin: null,
    events: [],
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
}

/** What the AI had done when the participant asked for a person: the first questions asked, two sections' worth covered, the talk so far. */
function interviewSoFar(doc: FieldworkDoc, s: Session, at: string): Session {
  const items = planItems(doc.plan)
  const asked = items.slice(0, 4)
  const lines = doc.lines ?? LINES
  const shown = doc.sessions.find((x) => x.stimuli.some((y) => y.result === 'Shown'))?.stimuli.find((y) => y.result === 'Shown')?.name
  return {
    ...s,
    startedAt: inMin(-50),
    asked: asked.map((i) => i.id),
    covered: asked.slice(0, 3).map((i) => i.id),
    transcript: asked.flatMap((i, n) => [
      { at, speaker: 'AI', ai: true, text: i.text },
      { at, speaker: 'Participant', ai: false, text: lines[n % lines.length] },
    ]),
    stimuli: shown ? [{ name: shown, result: 'Shown' as const }] : [],
  }
}

/** A session a moderator has booked. Continued from AI when it came from a request. */
function booked(doc: FieldworkDoc, n: number, moderatorId: string, slot: string, how: 'ai' | 'human'): Session {
  const s = blank(n, how)
  const base: Session = { ...s, status: 'Booked', slot, moderatorId, events: [ev(inMin(-90), 'system', `Booked with ${moderatorName(moderatorId)} for ${slot}`)] }
  if (how === 'human') return base
  const zone = base.region === 'West' ? 'America/Los_Angeles' : base.region === 'Midwest' ? 'America/Chicago' : 'America/New_York'
  const withTalk = interviewSoFar(doc, base, inMin(-75))
  return {
    ...withTalk,
    events: [...base.events, ev(inMin(-70), 'participant', 'Asked to talk to a human moderator'), ev(inMin(-62), 'system', `${moderatorName(moderatorId)} scheduled it at the participant’s time. The session continues where the AI stopped.`)],
    escalation: {
      requestedAt: inMin(-70),
      status: 'Request accepted',
      moderatorId,
      slot,
      acceptedBy: moderatorId,
      request: { sentAt: inMin(-68), days: [slot.slice(0, 10)], windows: ['Evening'], note: 'Suggested when the AI asked.', response: 'Accepted', respondedAt: inMin(-62), suggested: slot, zone },
      choice: { by: 'Participant', at: inMin(-68), how: 'Requested a time' },
    },
  }
}

type RequestKind = 'future' | 'passed' | 'waiting'
/** A request for a person that nobody took live. */
function request(doc: FieldworkDoc, n: number, kind: RequestKind, o: { suggested: string; proposed?: { slot: string; by: string }; declinedBy?: string[] }): Session {
  const s = interviewSoFar(doc, blank(n, 'ai'), inMin(-200))
  const zone = s.region === 'West' ? 'America/Los_Angeles' : s.region === 'Midwest' ? 'America/Chicago' : 'America/New_York'
  // A request stays within the promise (under 24 hours), so it is the moderators' to answer and not yet in Needs you.
  const raisedAt = kind === 'passed' ? inMin(-480) : kind === 'waiting' ? inMin(-300) : inMin(-40)
  return {
    ...s,
    status: 'Booked',
    slot: null,
    events: [ev(raisedAt, 'participant', 'Asked to talk to a human moderator'), ev(raisedAt, 'system', 'Nobody accepted live. The AI asked for a time and the request went to the standby moderators.')],
    escalation: {
      requestedAt: raisedAt,
      status: kind === 'waiting' ? 'Waiting for participant' : 'Time requested',
      moderatorId: undefined,
      request: { sentAt: raisedAt, days: [o.suggested.slice(0, 10)], windows: ['Evening'], note: 'Suggested when the AI asked.', response: 'Pending', suggested: o.suggested, zone },
      choice: { by: 'Participant', at: raisedAt, how: 'Requested a time' },
      ...(o.proposed ? { proposed: { slot: o.proposed.slot, by: o.proposed.by, at: inMin(-60) } } : {}),
      ...(o.declinedBy ? { declinedBy: o.declinedBy } : {}),
    },
  }
}

const NOTES = (by: string, n: number): Notes => ({
  takeaways: ['Wanted a person to answer a question about delivery dates, then talked easily about price.', 'Strong reaction to the second concept; pushed back on the claim in the first.', 'Cancelled over the second price rise, not the product.'][n % 3],
  friction: n % 2 ? 'The recording cut out for a few seconds around the middle.' : 'None.',
  missing: n % 2 ? 'Did not get to the closing exercise.' : 'Nothing.',
  recontact: (['Yes', 'Maybe', 'No'] as const)[n % 3],
  recontactNote: '',
  by,
  at: inMin(-1500 - n * 60),
})

/** Gives finished interviews to a moderator: `completed` still need notes (some with a draft), `submitted` have them. */
function giveFinished(doc: FieldworkDoc, moderatorId: string, completed: number, submitted: number, draftOn: number): FieldworkDoc {
  const free = [...doc.sessions].reverse().filter((s) => s.status === 'Completed' && !s.moderatorId && !s.notes && !s.escalation)
  const pick = free.slice(0, completed + submitted)
  const by = moderatorName(moderatorId)
  const given = new Map<string, Partial<Session>>()
  pick.forEach((s, i) => {
    if (i < completed) given.set(s.id, { moderatorId, ...(i < draftOn ? { notesDraft: { takeaways: NOTES(by, i).takeaways, at: inMin(-200 - i * 30) } } : {}) })
    else given.set(s.id, { moderatorId, notes: NOTES(by, i) })
  })
  return { ...doc, sessions: doc.sessions.map((s) => (given.has(s.id) ? { ...s, ...given.get(s.id) } : s)) }
}

const addStandby = (doc: FieldworkDoc, id: string, name: string): FieldworkDoc =>
  doc.plan.escalation && !doc.plan.escalation.moderators.some((m) => m.id === id) ? { ...doc, plan: { ...doc.plan, escalation: { ...doc.plan.escalation, moderators: [...doc.plan.escalation.moderators, { id, name }] } } } : doc

/** Pet Food Subscription Churn: bookings and finished interviews for Jordan and Ravi, and three requests both can see. */
function seedPet(doc: FieldworkDoc): FieldworkDoc {
  const sessions = [
    // Jordan: one in about 15 minutes (Continued from AI, Join interview there but not active yet), one later today, one tomorrow.
    booked(doc, 9101, JORDAN, inMin(15), 'ai'),
    booked(doc, 9102, JORDAN, eastern(0, 19, 0), 'human'),
    booked(doc, 9103, JORDAN, eastern(1, 11, 0), 'human'),
    // Ravi covers US evenings from India: 17:15 Eastern is 03:45 IST, 19:00 is 05:30 IST.
    booked(doc, 9201, RAVI, inMin(15), 'ai'),
    booked(doc, 9202, RAVI, eastern(0, 19, 0), 'human'),
    booked(doc, 9203, RAVI, eastern(1, 18, 0), 'human'),
    // Three requests, for every moderator on this study's standby list.
    request(doc, 9111, 'future', { suggested: nextWeekdayAt('America/New_York', FIELDWORK_NOW, 12, 0) }),
    request(doc, 9112, 'passed', { suggested: eastern(0, 11, 0) }), // already passed: only Edit time works
    request(doc, 9113, 'waiting', { suggested: eastern(1, 13, 0), proposed: { slot: eastern(1, 14, 0), by: JORDAN } }),
  ]
  const withBookings = addStandby({ ...doc, sessions: [...doc.sessions, ...sessions] }, RAVI, 'Ravi Menon')
  // Jordan already has one real finished interview in the seed data (a standby escalation he joined), so two more make three.
  return giveFinished(giveFinished(withBookings, JORDAN, 2, 2, 2), RAVI, 3, 2, 2)
}

const off = () => {
  try {
    return localStorage.getItem('pulseai-qual:moderator-seed') === 'off'
  } catch {
    return false
  }
}

/** Adds the Moderator view's mock data to the studies that have fieldwork. Safe to run twice: a seeded record says so. */
export function seedModerators(fieldworks: Record<string, FieldworkDoc>): Record<string, FieldworkDoc> {
  if (off()) return fieldworks
  return Object.fromEntries(
    Object.entries(fieldworks).map(([id, doc]) => {
      if (id !== PET) return [id, doc]
      const seeded = doc.modSeed === MODERATOR_SEED_VERSION ? doc : { ...seedPet(doc), modSeed: MODERATOR_SEED_VERSION }
      return [id, seeded.planSeed === PLAN_SEED_VERSION ? seeded : seedPlans(seeded)]
    }),
  )
}
