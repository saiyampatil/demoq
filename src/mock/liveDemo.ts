// "Live: demo": the Moisturizer study live in fieldwork, with what a walk-through needs to have in it. The ordinary
// "Live in fieldwork" stage has an empty reserve and no escalations, so Invite from reserve and the escalation record
// have nothing to show. This adds them on top of the same sessions, so every number on the Overview still agrees.

import type { AudienceDoc } from '@/state/audience'
import { uid } from '@/state/brief'
import { formatDay, formatSlot } from '@/lib/format'
import { FIELDWORK_NOW, type FieldworkDoc, type ReserveCandidate, type Session, type SessionEvent } from '@/state/fieldwork'
import { openSlots } from '@/state/standby'
import { regionOf } from '@/state/screening'

const at = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString()
const ev = (when: string, kind: SessionEvent['kind'], text: string): SessionEvent => ({ id: uid('ev'), at: when, kind, text })

/** Four people screened and approved who the target didn't need yet: first in, first out. One from each region. */
function demoReserve(audience: AudienceDoc | undefined): ReserveCandidate[] {
  const version = audience?.version ?? 1
  const people: Pick<ReserveCandidate, 'id' | 'contact' | 'state' | 'arrivedAt' | 'source'>[] = [
    { id: 'A-1201', contact: 'User ID · NS-91204', state: 'Pennsylvania', arrivedAt: '2026-11-05T10:20:00-05:00', source: 'External' },
    { id: 'A-1202', contact: 'Phone · (602) ••• 4417', state: 'Arizona', arrivedAt: '2026-11-06T14:05:00-05:00', source: 'Manual' },
    { id: 'A-1203', contact: 'User ID · NS-91233', state: 'North Carolina', arrivedAt: '2026-11-08T09:40:00-05:00', source: 'External' },
    { id: 'A-1204', contact: 'Phone · (313) ••• 8820', state: 'Michigan', arrivedAt: '2026-11-09T16:30:00-05:00', source: 'External' },
  ]
  return people.map((c): ReserveCandidate => ({ ...c, region: (regionOf(c.state) as ReserveCandidate['region']) ?? null, screenedUnder: version, status: 'Reserve' }))
}

type Fix = (s: Session, started: string) => Session

const STANDBY = [
  { id: 'u-jordan', name: 'Jordan Lee' },
  { id: 'u-priya', name: 'Priya Shah' },
]
/** The first free time a standby moderator had after `from`, the way the calendar offers it. */
const firstSlot = (moderatorId: string, from: string, skip = 0) => openSlots(STANDBY.filter((m) => m.id === moderatorId), from)[skip].start
const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
/** The first free time a standby moderator had on a given day, YYYY-MM-DD, after `from`. */
const slotOn = (moderatorId: string, from: string, day: string) => openSlots(STANDBY.filter((m) => m.id === moderatorId), from).find((x) => ET_DATE.format(new Date(x.start)) === day)!.start
/** The next two weekdays after `from`, YYYY-MM-DD. */
function nextWeekdays(from: string): string[] {
  const out: string[] = []
  for (let i = 1; out.length < 2 && i < 8; i++) {
    const t = new Date(new Date(from).getTime() + i * 86400000)
    if (t.getUTCDay() !== 0 && t.getUTCDay() !== 6) out.push(ET_DATE.format(t))
  }
  return out
}
const dayList = (days: string[]) => days.map((d) => formatDay(`${d}T12:00:00-05:00`)).join(', ')
const resolveOpen = (s: Session, when: string): Session['issues'] => s.issues.map((i) => (i.status === 'Open' ? { ...i, status: 'Resolved' as const, via: 'session-start' as const, resolution: 'participant asked for a human', resolvedBy: 'The participant', resolvedAt: when } : i))

/**
 * Each way a request for a human can stand, on a session that fits it. The first four are on the session page only; the
 * last is the one case the Researcher has to move on, so it is also in Needs you.
 */
const ESCALATIONS: Record<string, Fix> = {
  // Booked a free time from the calendar. No answer was needed, and Jordan joined at the booked time.
  'P-2043-1': (s, t) => {
    const asked = at(t, 6)
    const sentAt = at(asked, 2)
    const slot = firstSlot('u-jordan', sentAt)
    return {
      ...s,
      moderatorId: 'u-jordan',
      escalation: { requestedAt: asked, status: 'Joined', moderatorId: 'u-jordan', slot, choice: { by: 'Participant', at: sentAt, how: 'Booked a follow-up', slot }, acceptedBy: 'u-jordan', joinedAt: slot },
      events: [...s.events, ev(asked, 'participant', 'Asked to talk to a human moderator'), ev(sentAt, 'participant', `Booked a time with Jordan Lee: ${formatSlot(slot)}. A new link was sent.`), ev(slot, 'moderator', `Jordan Lee joined at ${formatSlot(slot)}`)],
    }
  },
  // Asked for a time that suited them. Priya accepted and confirmed one, and joined at it.
  'P-2045-1': (s, t) => {
    const asked = at(t, 5)
    const sentAt = at(asked, 1)
    const days = nextWeekdays(sentAt)
    const answered = at(sentAt, 25)
    // The moderator confirmed a time on the first day they asked for.
    const slot = slotOn('u-priya', answered, days[0])
    return {
      ...s,
      moderatorId: 'u-priya',
      escalation: {
        requestedAt: asked,
        status: 'Joined',
        moderatorId: 'u-priya',
        slot,
        request: { sentAt, days, windows: ['Afternoon', 'Evening'], note: 'Evenings after work suit me best.', response: 'Accepted', respondedAt: answered },
        choice: { by: 'Participant', at: sentAt, how: 'Requested a time' },
        acceptedBy: 'u-priya',
        joinedAt: slot,
      },
      events: [
        ...s.events,
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(sentAt, 'participant', `Asked for a time that suits them: ${dayList(days)}, afternoon or evening. Sent to Priya Shah.`),
        ev(answered, 'system', `Priya Shah accepted and confirmed ${formatSlot(slot)}. A new link was sent.`),
        ev(slot, 'moderator', `Priya Shah joined at ${formatSlot(slot)}`),
      ],
    }
  },
  // Chose to end the interview rather than wait. The recording and consent stand.
  'P-2050-1': (s, t) => {
    const asked = at(t, 3)
    return {
      ...s,
      consent: s.consent ? { ...s.consent, withdrawn: undefined } : s.consent,
      escalation: { requestedAt: asked, status: 'Ended by participant', choice: { by: 'Participant', at: at(asked, 1), how: 'Ended the interview', reason: 'Can’t wait' } },
      events: [
        ...s.events.filter((e) => !/Withdrew from the study/.test(e.text)),
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(at(asked, 1), 'participant', 'Chose to end the interview: can’t wait'),
        ev(at(asked, 1.2), 'system', 'Left the study. The recording and consent stand.'),
      ],
    }
  },
  // Booked a free time that is still ahead.
  'P-2047-1': (s, t) => {
    const asked = at(t, 4)
    const sentAt = at(asked, 1)
    const slot = firstSlot('u-jordan', FIELDWORK_NOW, 2)
    return {
      ...s,
      status: 'Booked' as const,
      slot,
      moderatorId: 'u-jordan',
      escalation: { requestedAt: asked, status: 'Booked by participant', moderatorId: 'u-jordan', slot, choice: { by: 'Participant', at: sentAt, how: 'Booked a follow-up', slot } },
      issues: resolveOpen(s, sentAt),
      events: [...s.events, ev(asked, 'participant', 'Asked to talk to a human moderator'), ev(sentAt, 'participant', `Booked a time with Jordan Lee: ${formatSlot(slot)}. A new link was sent.`)],
    }
  },
  // Asked for a time a few hours ago and the moderator hasn't answered yet. Within the promise, so not in Needs you.
  'P-2048-1': (s) => {
    const sentAt = at(FIELDWORK_NOW, -3 * 60)
    const asked = at(sentAt, -1)
    const days = nextWeekdays(sentAt)
    return {
      ...s,
      status: 'Booked' as const,
      slot: null,
      moderatorId: 'u-priya',
      escalation: {
        requestedAt: asked,
        status: 'Time requested',
        moderatorId: 'u-priya',
        request: { sentAt, days, windows: ['Morning'], note: 'I can only talk before work.', response: 'Pending' },
        choice: { by: 'Participant', at: sentAt, how: 'Requested a time' },
      },
      issues: resolveOpen(s, sentAt),
      events: [...s.events, ev(asked, 'participant', 'Asked to talk to a human moderator'), ev(sentAt, 'participant', `Asked for a time that suits them: ${dayList(days)}, morning. Sent to Priya Shah.`)],
    }
  },
  // The moderator couldn't do the times asked for, so it fell to the Researcher, who can assign someone or send a booking link.
  'P-2042-1': (s, t) => {
    const asked = at(t, 3)
    const sentAt = at(asked, 1)
    const days = nextWeekdays(sentAt)
    const declined = at(sentAt, 20)
    return {
      ...s,
      status: 'Booked' as const,
      slot: null,
      moderatorId: 'u-jordan',
      escalation: {
        requestedAt: asked,
        status: 'Waiting for moderator',
        fellThroughAt: declined,
        moderatorId: 'u-jordan',
        request: { sentAt, days, windows: ['Afternoon'], note: '', response: 'Declined', respondedAt: declined },
        choice: { by: 'Participant', at: sentAt, how: 'Requested a time' },
      },
      issues: resolveOpen(s, sentAt),
      events: [
        ...s.events,
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(sentAt, 'participant', `Asked for a time that suits them: ${dayList(days)}, afternoon. Sent to Jordan Lee.`),
        ev(declined, 'system', 'Jordan Lee couldn’t do those times. It is waiting for the Researcher.'),
      ],
    }
  },
}

export function applyLiveDemo(doc: FieldworkDoc, audience: AudienceDoc | undefined): FieldworkDoc {
  return {
    ...doc,
    reserve: demoReserve(audience),
    sessions: doc.sessions.map((s) => {
      const fix = ESCALATIONS[s.id]
      return fix ? fix(s, s.startedAt ?? doc.window?.start ?? '2026-11-10T10:00:00-05:00') : s
    }),
  }
}
