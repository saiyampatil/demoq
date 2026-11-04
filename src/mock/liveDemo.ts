// "Live: demo": the Moisturizer study live in fieldwork, with what a walk-through needs to have in it. The ordinary
// "Live in fieldwork" stage has an empty reserve and no escalations, so Invite from reserve and the escalation record
// have nothing to show. This adds them on top of the same sessions, so every number on the Overview still agrees.

import type { AudienceDoc } from '@/state/audience'
import { uid } from '@/state/brief'
import type { Escalation, FieldworkDoc, ReserveCandidate, Session, SessionEvent } from '@/state/fieldwork'
import { regionOf } from '@/state/screening'

const at = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString()
const ev = (when: string, kind: SessionEvent['kind'], text: string): SessionEvent => ({ id: uid('ev'), at: when, kind, text })
const MAYA = 'Maya Ortiz'

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

/** Each escalation the walk-through can open, on a session that fits it. They end four different ways. */
const ESCALATIONS: Record<string, Fix> = {
  // A standby moderator took it at once. It never reached the Researcher.
  'P-2043-1': (s, t) => {
    const asked = at(t, 6)
    const esc: Escalation = {
      requestedAt: asked,
      status: 'Joined',
      offers: [
        { moderatorId: 'u-priya', at: at(asked, 0.3), outcome: 'Declined' },
        { moderatorId: 'u-jordan', at: at(asked, 0.8), outcome: 'Accepted' },
      ],
      acceptedBy: 'u-jordan',
      joinedAt: at(asked, 2),
    }
    return {
      ...s,
      moderatorId: 'u-jordan',
      escalation: esc,
      events: [
        ...s.events,
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(asked, 'system', 'Offered to Priya Shah, who has 60 seconds to answer'),
        ev(at(asked, 0.3), 'system', 'Priya Shah declined'),
        ev(at(asked, 0.3), 'system', 'Offered to Jordan Lee, who has 60 seconds to answer'),
        ev(at(asked, 0.8), 'system', 'Jordan Lee accepted'),
        ev(at(asked, 2), 'moderator', 'Jordan Lee joined'),
      ],
    }
  },
  // Nobody answered, so it fell through to the Researcher, who assigned Priya. She joined.
  'P-2045-1': (s, t) => {
    const asked = at(t, 5)
    const esc: Escalation = {
      requestedAt: asked,
      status: 'Joined',
      fellThroughAt: at(asked, 1.3),
      offers: [
        { moderatorId: 'u-jordan', at: at(asked, 0.3), outcome: 'Declined' },
        { moderatorId: 'u-priya', at: at(asked, 1.3), outcome: 'Timed out' },
        { moderatorId: 'u-priya', at: at(asked, 4), outcome: 'Assigned' },
      ],
      actedBy: { by: MAYA, at: at(asked, 4), action: 'Assigned', moderatorId: 'u-priya' },
      acceptedBy: 'u-priya',
      joinedAt: at(asked, 6),
    }
    return {
      ...s,
      moderatorId: 'u-priya',
      escalation: esc,
      events: [
        ...s.events,
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(asked, 'system', 'Offered to Jordan Lee, who has 60 seconds to answer'),
        ev(at(asked, 0.3), 'system', 'Jordan Lee declined'),
        ev(at(asked, 0.3), 'system', 'Offered to Priya Shah, who has 60 seconds to answer'),
        ev(at(asked, 1.3), 'system', 'Priya Shah didn’t answer in 60 seconds (timed out)'),
        ev(at(asked, 1.3), 'system', 'No moderator accepted. It is waiting for the Researcher.'),
        ev(at(asked, 4), 'system', `${MAYA} assigned Priya Shah (online) and notified them`),
        ev(at(asked, 6), 'moderator', 'Priya Shah joined'),
      ],
    }
  },
  // Nobody answered and the participant chose to leave rather than wait. The recording and consent stand.
  'P-2050-1': (s, t) => {
    const asked = at(t, 3)
    const esc: Escalation = {
      requestedAt: asked,
      status: 'Ended by participant',
      fellThroughAt: at(asked, 1.3),
      offers: [
        { moderatorId: 'u-priya', at: at(asked, 0.3), outcome: 'Declined' },
        { moderatorId: 'u-jordan', at: at(asked, 1.3), outcome: 'Timed out' },
      ],
      choice: { by: 'Participant', at: at(asked, 3), how: 'Ended the interview' },
    }
    return {
      ...s,
      consent: s.consent ? { ...s.consent, withdrawn: undefined } : s.consent,
      escalation: esc,
      events: [
        ...s.events.filter((e) => !/Withdrew from the study/.test(e.text)),
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(asked, 'system', 'Offered to Priya Shah, who has 60 seconds to answer'),
        ev(at(asked, 0.3), 'system', 'Priya Shah declined'),
        ev(at(asked, 0.3), 'system', 'Offered to Jordan Lee, who has 60 seconds to answer'),
        ev(at(asked, 1.3), 'system', 'Jordan Lee didn’t answer in 60 seconds (timed out)'),
        ev(at(asked, 1.3), 'system', 'No moderator accepted. It is waiting for the Researcher.'),
        ev(at(asked, 3), 'participant', 'Chose to end the interview instead of waiting for a moderator'),
        ev(at(asked, 3.2), 'system', 'Left the study. The recording and consent stand.'),
      ],
    }
  },
  // Nobody was free, but a human slot was, so the participant booked a follow-up themselves.
  'P-2047-1': (s, t) => {
    const asked = at(t, 4)
    const slot = '2026-11-12T11:00:00-05:00'
    const esc: Escalation = {
      requestedAt: asked,
      status: 'Booked by participant',
      offers: [],
      choice: { by: 'Participant', at: at(asked, 1), how: 'Booked a follow-up', slot },
    }
    return {
      ...s,
      status: 'Booked' as const,
      slot,
      escalation: esc,
      issues: s.issues.map((i) => (i.status === 'Open' ? { ...i, status: 'Resolved' as const, via: 'session-start' as const, resolution: 'participant booked a follow-up', resolvedBy: 'The participant', resolvedAt: at(asked, 1) } : i)),
      events: [
        ...s.events,
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(asked, 'system', 'No moderator is on standby'),
        ev(at(asked, 1), 'participant', 'Booked a human follow-up for Nov 12, 11:00 AM ET'),
      ],
    }
  },
  // Asked for a human just now and nobody accepted: it is waiting for the Researcher, who can assign or send a link.
  'P-2042-1': (s, t) => {
    const asked = at(t, 3)
    const esc: Escalation = {
      requestedAt: asked,
      status: 'Waiting for moderator',
      fellThroughAt: at(asked, 1.3),
      offers: [
        { moderatorId: 'u-priya', at: at(asked, 0.3), outcome: 'Declined' },
        { moderatorId: 'u-jordan', at: at(asked, 1.3), outcome: 'Timed out' },
      ],
    }
    return {
      ...s,
      escalation: esc,
      events: [
        ...s.events,
        ev(asked, 'participant', 'Asked to talk to a human moderator'),
        ev(asked, 'system', 'Offered to Priya Shah, who has 60 seconds to answer'),
        ev(at(asked, 0.3), 'system', 'Priya Shah declined'),
        ev(at(asked, 0.3), 'system', 'Offered to Jordan Lee, who has 60 seconds to answer'),
        ev(at(asked, 1.3), 'system', 'Jordan Lee didn’t answer in 60 seconds (timed out)'),
        ev(at(asked, 1.3), 'system', 'No moderator accepted. It is waiting for the Researcher.'),
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
