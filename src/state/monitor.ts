// What R18 tells the Researcher: am I on track, and what needs me. Everything here is computed from the
// study's session list (state/fieldwork.ts), so every number on the screen comes from the same place.

import { formatDate } from '@/lib/format'
import type { AudienceDoc } from './audience'
import {
  FIELDWORK_NOW,
  pacing,
  participantsOf,
  progress,
  type FieldworkDoc,
  type Outcomes,
  type Participant,
  type Region,
  type ReserveCandidate,
  type Session,
} from './fieldwork'
import { mockApplicants, regionOf } from './screening'

const HOUR = 3600000

/** "12 min ago", "5 h ago", "3 days ago", on the fieldwork clock. */
export function ago(iso: string): string {
  const ms = Math.max(0, new Date(FIELDWORK_NOW).getTime() - new Date(iso).getTime())
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60000))} min ago`
  if (ms < 24 * HOUR) return `${Math.round(ms / HOUR)} h ago`
  const d = Math.round(ms / (24 * HOUR))
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}

// ─── the fieldwork window ───────────────────────────────────────────────────

/** A date-only value (the window's end) as "Nov 17, 2026". Noon keeps the zone from moving it to another day. */
const dayLabel = (d: string) => formatDate(`${d}T12:00:00-05:00`)

const windowEnd = (doc: FieldworkDoc) => (doc.window ? new Date(`${doc.window.end}T23:59:59-05:00`).getTime() : Infinity)
/** True once the fieldwork window has ended on the prototype clock. */
export const windowClosed = (doc: FieldworkDoc) => new Date(FIELDWORK_NOW).getTime() > windowEnd(doc)

// ─── the reserve ────────────────────────────────────────────────────────────

export type ReserveStatus = 'Available' | 'Invited' | 'Expired' | 'Used' | 'Re-screen needed'
export type ReserveRow = ReserveCandidate & { label: ReserveStatus }

/** An invitation that sits unopened this long is Expired. */
const INVITE_LIFE_HOURS = 72

/** Screened under an older audience version than the one now in force: they must be screened again. */
export function needsRescreen(c: Pick<ReserveCandidate, 'screenedUnder'>, audience: AudienceDoc | undefined): boolean {
  if (!audience) return false
  const under = c.screenedUnder ?? audience.screener?.fromAudienceVersion ?? audience.version
  return audience.version > under
}

/**
 * The whole reserve, first in first out. Everyone who passed screening and is not in an interview: eligible applicants
 * beyond the target, and anyone screened after launch. Invited people stay listed, as Invited, Used or Expired.
 */
export function reserveRows(doc: FieldworkDoc | undefined, audience: AudienceDoc | undefined): ReserveRow[] {
  const stored = doc?.reserve ?? []
  const known = new Set(stored.map((c) => c.id))
  const fromScreening = audience
    ? mockApplicants(audience)
        .filter((a) => a.outcome === 'Reserve' && !known.has(a.id))
        .map((a): ReserveCandidate => {
          const state = a.answers.find((x) => /state/i.test(x.question))?.answer ?? ''
          return { id: a.id, contact: a.contact, state, region: (regionOf(state) as Region | undefined) ?? null, arrivedAt: a.submittedAt, source: a.source, screenedUnder: a.screenedUnder, status: 'Reserve' }
        })
    : []
  const labelOf = (c: ReserveCandidate): ReserveStatus => {
    if (c.status === 'Invited') {
      const s = doc?.sessions.find((x) => x.participantId === c.invitedAs)
      if (s && (s.startedAt || s.status !== 'Not started' || s.access === 'Consented')) return 'Used'
      if (s && s.access === 'Invited' && c.invitedAt && (new Date(FIELDWORK_NOW).getTime() - new Date(c.invitedAt).getTime()) / HOUR > INVITE_LIFE_HOURS) return 'Expired'
      return 'Invited'
    }
    return needsRescreen(c, audience) ? 'Re-screen needed' : 'Available'
  }
  const rank = (r: ReserveRow) => (r.label === 'Available' || r.label === 'Re-screen needed' ? 0 : 1)
  return [...fromScreening, ...stored]
    .map((c): ReserveRow => ({ ...c, label: labelOf(c) }))
    .sort((a, b) => rank(a) - rank(b) || new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime() || a.id.localeCompare(b.id))
}

/** The reserve people who can be invited now, first in first out. Re-screen needed, invited and expired people are not offered. */
export function reserveCandidates(doc: FieldworkDoc | undefined, audience: AudienceDoc | undefined): ReserveCandidate[] {
  return reserveRows(doc, audience).filter((r) => r.label === 'Available')
}

// ─── where each participant is ──────────────────────────────────────────────

/**
 * Every participant is in exactly one of these. A participant counts once, by their latest session:
 * a participant who retried is not a second person.
 */
export type Bucket = 'completed' | 'withdrew' | 'noShow' | 'gaveUp' | 'inProgress'

export function bucketOf(p: Participant): Bucket {
  const started = p.sessions.some((s) => s.startedAt)
  if (p.latest.status === 'Completed') return 'completed'
  if (p.latest.gaveUp) return 'gaveUp'
  if (p.latest.status === 'Withdrawn') return 'withdrew'
  // A human-led participant who missed a slot is rescheduled, not gone.
  if (!started && p.latest.access === 'No-show' && p.latest.status !== 'Rescheduled' && p.latest.status !== 'Booked') return 'noShow'
  return 'inProgress'
}

// ─── Needs you ──────────────────────────────────────────────────────────────

export type NeedsAction = 'Assign moderator' | 'Resend link' | 'Reissue link' | 'Resume' | 'Retry' | 'Reschedule'

export type NeedsRow = {
  key: string
  session: Session
  /** The participant ID. */
  who: string
  /** What happened, in a few words. */
  what: string
  /** When it happened. */
  since: string
  action: NeedsAction
  /** The action sends the participant a link or an invitation, so a paused study blocks it. */
  invites: boolean
  /** The participant is stuck: the Researcher can resume them, or give up and open their slot. */
  stuck: boolean
  /** Higher is more urgent. */
  urgency: number
}

const hoursSince = (iso: string) => (new Date(FIELDWORK_NOW).getTime() - new Date(iso).getTime()) / HOUR
const lastEvent = (s: Session) => s.events.reduce((m, e) => (e.at > m ? e.at : m), s.events[0]?.at ?? FIELDWORK_NOW)

/**
 * Unfinished sessions that need the Researcher, most urgent first. Only a participant's latest session counts, and
 * only if it hasn't ended in Review: a finished interview is never here. A session the Researcher already acted on
 * leaves. Replacement needs are never rows: a withdrawal, an exclusion or a no-show after the window opens a slot,
 * and an open slot shows as the gap on the verdict.
 */
export function needsYou(doc: FieldworkDoc): NeedsRow[] {
  const human = doc.sessions.some((s) => s.mode === 'human')
  const closed = windowClosed(doc)
  const rows: NeedsRow[] = []

  for (const { latest: s } of participantsOf(doc)) {
    if (s.status === 'Completed' || s.status === 'Withdrawn' || s.handled || s.gaveUp) continue
    const since = lastEvent(s)
    const openIssue = s.issues.find((i) => i.status === 'Open')
    const row = (action: NeedsAction, what: string, urgency: number, extra: Partial<NeedsRow> = {}) =>
      rows.push({ key: s.id, session: s, who: s.participantId, what, since, action, invites: action !== 'Assign moderator', stuck: false, urgency: urgency + Math.min(9, hoursSince(since) / 24), ...extra })

    if (s.status === 'Technical Error') row('Retry', `Technical error: ${(openIssue?.type ?? 'the session stopped').toLowerCase()}. The interview didn’t finish.`, 90, { stuck: true })
    else if (human && s.status === 'Booked' && !s.moderatorId) row('Assign moderator', 'Booked a slot, but no moderator is assigned.', 85)
    else if (human && s.status === 'Rescheduled') row('Reschedule', 'Missed or moved their slot and needs a new one.', 80)
    else if (s.status === 'Incomplete (resumable)') row('Resume', 'Left part-way. They can resume from their link.', 70, { stuck: true })
    else if (s.status === 'Not started' || s.status === 'Booked') {
      if (openIssue?.type === 'Link expired or invalid') row('Reissue link', `${openIssue.type}. They can’t start until a new link is issued.`, 75, { stuck: true })
      else if (openIssue) row('Resend link', `${openIssue.type}. They can’t start until it’s fixed.`, 75, { stuck: true })
      // A no-show holds their slot until the window closes. After that the slot is open and the gap shows it.
      else if (s.access === 'No-show') {
        if (!closed) row('Resend link', 'Consented but never started.', 60)
      } else if (s.access === 'Opened' && hoursSince(since) > 24) row('Resend link', 'Opened the link but hasn’t started.', 50)
      else if (s.access === 'Invited' && hoursSince(since) > 48) row('Resend link', 'Invited but hasn’t opened the link.', 45)
    }
  }
  return rows.sort((a, b) => b.urgency - a.urgency)
}

// ─── Funnel ─────────────────────────────────────────────────────────────────

export type FunnelStage = {
  key: 'invited' | 'opened' | 'consented' | 'started' | 'completed'
  label: string
  /** People who got this far. */
  reached: number
  /** People who left the study here, or whose slot is open or held. `note` says which. */
  left: { label: string; n: number; note?: string }[]
  /** People who are here and may still move on. */
  waiting: { label: string; n: number }[]
}

/**
 * Invited → Opened → Consented → Started → Completed, counted by participant. Every participant is in exactly one
 * of five places: completed (accepted, under review or excluded, all inside it), withdrew, no-show, given up, or still
 * in progress. Those add up to the number invited. At every stage reached = reached at the next stage + left + waiting.
 */
export function funnel(doc: FieldworkDoc, outcomes: Outcomes) {
  const ps = participantsOf(doc)
  const started = (p: Participant) => p.sessions.some((s) => s.startedAt)
  const opened = ps.filter((p) => p.first.access !== 'Invited')
  const consented = ps.filter((p) => !!p.first.consent || p.first.access === 'Consented' || p.first.access === 'No-show')
  const startedPs = ps.filter(started)
  const gu = (p: Participant) => bucketOf(p) === 'gaveUp'
  const n = (f: (p: Participant) => boolean) => ps.filter(f).length

  const prog = progress(doc, outcomes)
  const where = (b: Bucket) => ps.filter((p) => bucketOf(p) === b).length
  const completed = where('completed')
  const withdrew = where('withdrew')
  const noShow = where('noShow')
  const gaveUp = where('gaveUp')
  const inProgress = where('inProgress')

  const closed = windowClosed(doc)
  const noShowNote = closed ? 'slot opened' : `slot held until ${doc.window ? dayLabel(doc.window.end) : 'the window closes'}`
  const notOpened = (p: Participant) => !opened.includes(p)
  const openedOnly = (p: Participant) => opened.includes(p) && !consented.includes(p)
  const consentedOnly = (p: Participant) => consented.includes(p) && !started(p)

  const stages = ([
    {
      key: 'invited',
      label: 'Invited',
      reached: ps.length,
      left: [{ label: 'Given up', n: n((p) => gu(p) && notOpened(p)), note: 'slot opened' }],
      waiting: [{ label: 'Haven’t opened the link', n: n((p) => notOpened(p) && !gu(p)) }],
    },
    {
      key: 'opened',
      label: 'Opened',
      reached: opened.length,
      left: [{ label: 'Given up', n: n((p) => gu(p) && openedOnly(p)), note: 'slot opened' }],
      waiting: [{ label: 'Opened, haven’t consented', n: n((p) => openedOnly(p) && !gu(p)) }],
    },
    {
      key: 'consented',
      label: 'Consented',
      reached: consented.length,
      left: [
        { label: 'No-show', n: noShow, note: noShowNote },
        { label: 'Given up', n: n((p) => gu(p) && consentedOnly(p)), note: 'slot opened' },
      ],
      waiting: [{ label: 'Consented, not started yet', n: n((p) => consentedOnly(p) && !gu(p) && bucketOf(p) !== 'noShow') }],
    },
    {
      key: 'started',
      label: 'Started',
      reached: startedPs.length,
      left: [
        { label: 'Withdrew', n: withdrew },
        { label: 'Given up', n: n((p) => gu(p) && started(p)), note: 'slot opened' },
      ],
      waiting: [
        { label: 'In progress', n: n((p) => !gu(p) && (p.latest.status === 'Active' || p.latest.status === 'Paused')) },
        { label: 'Left part-way, can resume', n: n((p) => !gu(p) && p.latest.status === 'Incomplete (resumable)') },
        { label: 'Technical error', n: n((p) => !gu(p) && p.latest.status === 'Technical Error') },
        // Started before, and their next session is waiting to begin.
        { label: 'Back for another session', n: n((p) => started(p) && bucketOf(p) === 'inProgress' && !p.latest.startedAt) },
      ],
    },
    { key: 'completed', label: 'Completed', reached: completed, left: [], waiting: [] },
  ] as FunnelStage[]).map((st) => ({ ...st, left: st.left.filter((x) => x.n > 0), waiting: st.waiting.filter((x) => x.n > 0) }))

  return {
    stages,
    total: ps.length,
    /** The five places everyone is. They add up to `total`. */
    completed: { n: completed, accepted: prog.confirmed, pending: prog.pending, excluded: prog.excluded },
    withdrew,
    noShow,
    gaveUp,
    inProgress,
    sum: completed + withdrew + noShow + gaveUp + inProgress,
  }
}

// ─── The slot ledger and the gap to the target ──────────────────────────────

export type SlotState = 'counting' | 'running' | 'noShow' | 'open'

export type SlotRelease = { participantId: string; why: 'Excluded' | 'Withdrew' | 'No-show, window closed' | 'Given up'; detail?: string }

/**
 * One cohort, one target: the target is a number of slots, and each is held or open.
 *
 * A slot is held by a counting interview (accepted or under review), by a participant who can still finish (invited,
 * consented, in progress, booked, or with a human), or by a no-show while the fieldwork window is open.
 *
 * A slot opens only when someone is excluded in review, withdraws, is a no-show after the window closes, or the
 * Researcher gives up on them with a reason. A technical error, a participant who left part-way, an invalid link
 * and an escalation that is waiting for a moderator never open a slot: they keep it and show up in Needs you.
 */
export type Ledger = {
  target: number
  slots: SlotState[]
  counting: number
  confirmed: number
  pending: number
  /** Participants who can still finish and hold a slot. */
  running: number
  /** No-shows that still hold a slot because the window is open. */
  noShowHeld: number
  /** Open slots. */
  open: number
  /** More people hold slots than the target has (the over-recruitment buffer). */
  over: number
  released: SlotRelease[]
  windowOpen: boolean
  windowEnd: string | null
}

export function slotLedger(doc: FieldworkDoc, target: number, outcomes: Outcomes): Ledger {
  const prog = progress(doc, outcomes)
  const ps = participantsOf(doc)
  const closed = windowClosed(doc)
  const running = ps.filter((p) => bucketOf(p) === 'inProgress').length
  const noShows = ps.filter((p) => bucketOf(p) === 'noShow')
  const noShowHeld = closed ? 0 : noShows.length
  const held = prog.toward + running + noShowHeld
  const released: SlotRelease[] = [
    ...doc.sessions.filter((x) => x.status === 'Completed' && !x.reserve && outcomes.get(x.id) === 'Excluded').map((x): SlotRelease => ({ participantId: x.participantId, why: 'Excluded' })),
    ...ps.filter((p) => bucketOf(p) === 'withdrew').map((p): SlotRelease => ({ participantId: p.id, why: 'Withdrew' })),
    ...(closed ? noShows.map((p): SlotRelease => ({ participantId: p.id, why: 'No-show, window closed' })) : []),
    ...ps.filter((p) => bucketOf(p) === 'gaveUp').map((p): SlotRelease => ({ participantId: p.id, why: 'Given up', detail: p.latest.gaveUp?.reason })),
  ]
  const at = (k: number, from: number) => Math.max(0, Math.min(k, target - from))
  const c = at(prog.toward, 0)
  const r = at(running, c)
  const h = at(noShowHeld, c + r)
  const open = Math.max(0, target - held)
  return {
    target,
    slots: [...Array(c).fill('counting'), ...Array(r).fill('running'), ...Array(h).fill('noShow'), ...Array(open).fill('open')] as SlotState[],
    counting: prog.toward,
    confirmed: prog.confirmed,
    pending: prog.pending,
    running,
    noShowHeld,
    open,
    over: Math.max(0, held - target),
    released,
    windowOpen: !closed,
    windowEnd: doc.window ? doc.window.end : null,
  }
}

/**
 * Coverage. counting + everyone who still holds a slot is the ceiling; target minus the ceiling is the gap, which is
 * the number of open slots. The reserve is not in the ceiling: reserve people only become interviews when invited.
 */
export type Gap = {
  target: number
  counting: number
  confirmed: number
  pending: number
  excluded: number
  /** Everyone besides the counting interviews who still holds a slot: still open, plus no-shows holding theirs. */
  open: number
  running: number
  noShowHeld: number
  /** Reserve people who can be invited now. */
  reserve: number
  ceiling: number
  gap: number
  windowEnd: string | null
}

export function shortfall(doc: FieldworkDoc, target: number, outcomes: Outcomes, reserve: ReserveCandidate[]): Gap {
  const l = slotLedger(doc, target, outcomes)
  const prog = progress(doc, outcomes)
  const open = l.running + l.noShowHeld
  const ceiling = l.counting + open
  return { target, counting: l.counting, confirmed: l.confirmed, pending: l.pending, excluded: prog.excluded, open, running: l.running, noShowHeld: l.noShowHeld, reserve: reserve.length, ceiling, gap: Math.max(0, target - ceiling), windowEnd: l.windowEnd }
}

// ─── Verdict ────────────────────────────────────────────────────────────────

export type VerdictLevel = 'On track' | 'Behind pace' | 'At risk'

/** What the verdict offers. `invite` and `source` fill the gap; the rest take you somewhere. */
export type VerdictAction = { kind: 'invite' | 'source' | 'needs' | 'sessions' | 'review'; label: string; n?: number }

export type Verdict = {
  level: VerdictLevel
  /** One sentence. */
  sentence: string
  /** Shown when most progress is still pending review. */
  warning?: string
  /** What the numbers include. */
  basis: string
  /** What to do, by situation. Several only when the reserve covers part of the gap. */
  actions: VerdictAction[]
  gap: Gap
  figures: { toward: number; confirmed: number; pending: number; excluded: number; expected: number; day: number; days: number }
}

/** The action for an open gap, by how much of it the reserve covers. */
export function gapActions(gap: number, reserve: number): VerdictAction[] {
  if (gap <= 0) return []
  if (reserve >= gap) return [{ kind: 'invite', n: gap, label: `Invite ${gap} from reserve` }]
  if (reserve > 0) return [{ kind: 'invite', n: reserve, label: `Invite ${reserve} from reserve, ${gap - reserve} more needed` }, { kind: 'source', n: gap - reserve, label: 'Source more' }]
  return [{ kind: 'source', n: gap, label: `Source ${gap} more` }]
}

/**
 * Coverage first, then pace.
 *   gap > 0: At risk. The sentence leads with how many can finish and how many more are needed, never with pace.
 *   else counting < expected by now: Behind pace.
 *   else On track.
 * Expected-by-now comes from the fieldwork window. It is a pace figure only and is never the denominator of "done".
 */
export function verdict(doc: FieldworkDoc, target: number, outcomes: Outcomes, reserve: ReserveCandidate[], needs: number): Verdict {
  const prog = progress(doc, outcomes)
  const pace = pacing(doc, target, outcomes)
  const gap = shortfall(doc, target, outcomes, reserve)
  const figures = { toward: prog.toward, confirmed: prog.confirmed, pending: prog.pending, excluded: prog.excluded, expected: pace.expected, day: pace.day, days: pace.days }
  const held = gap.noShowHeld ? ` + ${gap.noShowHeld} no-show${gap.noShowHeld === 1 ? '' : 's'} holding a slot until ${gap.windowEnd ? dayLabel(gap.windowEnd) : 'the window closes'}` : ''
  const basis = `${gap.counting} counting (${gap.confirmed} accepted, ${gap.pending} under review${gap.excluded ? `, ${gap.excluded} excluded removed` : ''}) + ${gap.running} still open${held} = ${gap.ceiling}.${gap.reserve ? ` The reserve has ${gap.reserve}, not invited yet.` : ''}`
  const warning = prog.pending > prog.toward / 2 && prog.toward > 0 ? `${prog.pending} of the ${prog.toward} counted are still under review, so only ${prog.confirmed} are confirmed. Pending sessions can still be excluded.` : undefined
  const people = (k: number) => `${k} ${k === 1 ? 'person needs' : 'people need'} you`

  if (gap.gap > 0)
    return {
      level: 'At risk',
      sentence: `Only ${gap.ceiling} of ${target} can finish. ${gap.gap} more ${gap.gap === 1 ? 'person is' : 'people are'} needed.`,
      warning,
      basis,
      actions: gapActions(gap.gap, gap.reserve),
      gap,
      figures,
    }
  if (prog.toward < pace.expected)
    return {
      level: 'Behind pace',
      sentence: `${gap.counting} counting so far, but about ${pace.expected} are expected by day ${pace.day} of ${pace.days}. ${needs > 0 ? `${people(needs)}.` : `${gap.open} could still finish.`}`,
      warning,
      basis,
      actions: needs > 0 ? [{ kind: 'needs', label: `Work through ${needs} needing you` }] : [{ kind: 'sessions', label: 'See who hasn’t started' }],
      gap,
      figures,
    }
  return {
    level: 'On track',
    sentence: `${gap.counting} of ${target} counting, with ${gap.open} still open. ${needs > 0 ? `${people(needs)}.` : 'Nothing is blocking.'}`,
    warning,
    basis,
    actions: needs > 0 ? [{ kind: 'needs', label: `Work through ${needs} needing you` }] : [{ kind: 'review', label: 'Review the finished sessions' }],
    gap,
    figures,
  }
}
