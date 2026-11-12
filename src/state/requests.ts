// The Moderator view, read from the same fieldwork records the Researcher sees: escalation requests that no one took live,
// the sessions a moderator has booked, and the times they hold. Nothing is stored here; a request is an escalation on a
// session (state/fieldwork.ts), so the Researcher's record, Needs you and this list can never disagree.

import { participantName } from '@/mock/participants'
import { busyIn, coveredSections, fieldworkNow, moderatorName, participantZone, sessionEnded, type Escalation, type FieldworkDoc, type Session } from './fieldwork'
import { openSlots, slotProblem, type Busy } from './standby'

export type RequestStatus = 'Open' | 'Waiting for participant' | 'Scheduled' | 'Taken by someone else' | 'Cancelled by participant'
export type RequestFilter = 'Open' | 'Scheduled' | 'Closed'
export const REQUEST_FILTERS: RequestFilter[] = ['Open', 'Scheduled', 'Closed']

/** Open and Waiting for participant are both still to settle, so they share a filter and the count on the tab. */
export const filterOf = (status: RequestStatus): RequestFilter => (status === 'Open' || status === 'Waiting for participant' ? 'Open' : status === 'Scheduled' ? 'Scheduled' : 'Closed')

export type RequestRow = {
  key: string
  studyId: string
  studyName: string
  sessionId: string
  participantId: string
  name: string
  language: string
  covered: { title: string; done: number; of: number }[]
  /** The time the participant suggested, as a UTC instant, and the zone they are in. */
  suggested: string
  zone: string
  raisedAt: string
  status: RequestStatus
  /** Who has it, when someone else does: the moderator who scheduled it, or who proposed the new time. */
  heldBy?: string
  /** A new time a moderator proposed, waiting on the participant. */
  proposed?: { slot: string; by: string }
  /** Why "Schedule at this time" isn't available to this moderator, or null when it is. */
  problem: string | null
  /** The suggested time has passed: the request stays Open and only Edit time works. */
  passed: boolean
  session: Session
  doc: FieldworkDoc
}

/** Every time this moderator holds across all studies. */
export const busyAcross = (all: Record<string, FieldworkDoc>, moderatorId: string): Busy[] => Object.values(all).flatMap((d) => busyIn(d, moderatorId))

const onStandby = (doc: FieldworkDoc, moderatorId: string) => !!doc.plan.escalation?.moderators.some((m) => m.id === moderatorId)

/** A request made before it had a single suggested time (seed data) is read as its first day at 14:00 Eastern. */
const suggestedOf = (e: Escalation) => e.request?.suggested ?? new Date(`${e.request!.days[0]}T14:00:00-05:00`).toISOString()

function statusFor(e: Escalation, me: string): { status: RequestStatus; heldBy?: string } | null {
  switch (e.status) {
    case 'Cancelled by participant':
      return { status: 'Cancelled by participant' }
    case 'Waiting for participant':
      return { status: 'Waiting for participant', heldBy: e.proposed?.by }
    case 'Time requested':
      return e.declinedBy?.includes(me) ? null : { status: 'Open' }
    case 'Request accepted':
    case 'Joined':
    case 'Assigned':
    case 'Booking link sent': {
      const by = e.moderatorId ?? e.actedBy?.moderatorId
      return by === me ? { status: 'Scheduled' } : { status: 'Taken by someone else', heldBy: by }
    }
    default:
      return null
  }
}

/**
 * The requests this moderator can see: those for studies they are on standby for, except the ones they said they can't take.
 * Soonest suggested time first.
 */
export function requestsFor(all: Record<string, FieldworkDoc>, moderatorId: string, studyName: (id: string) => string, language: (id: string) => string | null): RequestRow[] {
  const busy = busyAcross(all, moderatorId)
  const rows: RequestRow[] = []
  for (const doc of Object.values(all)) {
    if (!onStandby(doc, moderatorId)) continue
    for (const session of doc.sessions) {
      const e = session.escalation
      if (!e?.request) continue
      const st = statusFor(e, moderatorId)
      if (!st) continue
      const suggested = suggestedOf(e)
      const now = new Date(fieldworkNow(doc)).getTime()
      const passed = new Date(suggested).getTime() <= now
      // Only an open request can be scheduled; the reason it can't is shown beside the button.
      const problem = st.status === 'Open' ? slotProblemFor(moderatorId, suggested, now, busy) : null
      rows.push({
        key: `${doc.studyId}|${session.id}`,
        studyId: doc.studyId,
        studyName: studyName(doc.studyId),
        sessionId: session.id,
        participantId: session.participantId,
        name: participantName(session.participantId),
        language: language(doc.studyId) ?? 'English (US)',
        covered: coveredSections(doc, session),
        suggested,
        zone: e.request.zone ?? participantZone(session),
        raisedAt: e.requestedAt,
        status: st.status,
        heldBy: st.heldBy,
        proposed: e.proposed ? { slot: e.proposed.slot, by: e.proposed.by } : undefined,
        problem,
        passed,
        session,
        doc,
      })
    }
  }
  return rows.sort((a, b) => a.suggested.localeCompare(b.suggested) || a.participantId.localeCompare(b.participantId))
}

const slotProblemFor = (moderatorId: string, iso: string, now: number, busy: Busy[]) => slotProblem(moderatorId, new Date(iso).getTime(), now, busy)

/** The number on the Requests tab: open ones, which is also the length of the Open filter. */
export const openCount = (rows: RequestRow[]) => rows.filter((r) => filterOf(r.status) === 'Open').length

export const whoHolds = (r: RequestRow) => (r.heldBy ? moderatorName(r.heldBy) : 'someone else')

// ─── the rest of the moderator's view ───────────────────────────────────────

export type SessionRow = { key: string; doc: FieldworkDoc; session: Session; studyId: string }
const mine = (all: Record<string, FieldworkDoc>, moderatorId: string, keep: (s: Session, doc: FieldworkDoc) => boolean): SessionRow[] =>
  Object.values(all).flatMap((doc) => doc.sessions.filter((s) => s.moderatorId === moderatorId && keep(s, doc)).map((session) => ({ key: `${doc.studyId}|${session.id}`, doc, session, studyId: doc.studyId })))

/** Booked sessions, soonest first. A session continued from the AI after a request is one of them. */
export const upcomingFor = (all: Record<string, FieldworkDoc>, moderatorId: string): SessionRow[] =>
  mine(all, moderatorId, (s) => s.status === 'Booked' && !!s.slot).sort((a, b) => a.session.slot!.localeCompare(b.session.slot!))

/** Interviews this moderator ran that still need their notes. */
export const completedFor = (all: Record<string, FieldworkDoc>, moderatorId: string): SessionRow[] => mine(all, moderatorId, (s) => sessionEnded(s) && !s.notes)

/** Interviews this moderator ran whose notes they submitted. */
export const submittedFor = (all: Record<string, FieldworkDoc>, moderatorId: string): SessionRow[] => mine(all, moderatorId, (s) => sessionEnded(s) && !!s.notes)

export type AvailabilityItem = { start: string; end: string; kind: 'free' | 'booked' | 'held'; label: string }

/**
 * The next week of the moderator's own hours: each time they are free, and each one booked (with the participant) or held
 * while a participant answers a new time. A booked time that isn't on the hour grid still shows, in order.
 */
export function availabilityFor7(all: Record<string, FieldworkDoc>, moderatorId: string, from: string): AvailabilityItem[] {
  const busy = busyAcross(all, moderatorId)
  const items: AvailabilityItem[] = []
  for (const doc of Object.values(all)) {
    for (const s of doc.sessions) {
      if (s.moderatorId === moderatorId && s.slot && s.status === 'Booked' && new Date(s.slot).getTime() > new Date(from).getTime()) items.push({ start: s.slot, end: new Date(new Date(s.slot).getTime() + 45 * 60000).toISOString(), kind: 'booked', label: `Booked: ${s.participantId}` })
      const p = s.escalation?.proposed
      if (s.escalation?.status === 'Waiting for participant' && p?.by === moderatorId) items.push({ start: p.slot, end: new Date(new Date(p.slot).getTime() + 45 * 60000).toISOString(), kind: 'held', label: `Held for ${s.participantId}, waiting for their answer` })
    }
  }
  const free = openSlots([{ id: moderatorId, name: moderatorName(moderatorId) }], from)
    .filter((sl) => !busy.some((b) => b.start < new Date(sl.end).getTime() && b.end > new Date(sl.start).getTime()))
    .map((sl): AvailabilityItem => ({ start: sl.start, end: sl.end, kind: 'free', label: 'Free' }))
  return [...items, ...free].sort((a, b) => a.start.localeCompare(b.start))
}
