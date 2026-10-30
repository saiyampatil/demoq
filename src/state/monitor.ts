// What R18 tells the Researcher: am I on track, and what needs me. Everything here is computed from the
// study's session list (state/fieldwork.ts), so every number on the screen comes from the same place.

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

/**
 * Eligible people waiting to be invited as replacements: those who arrived after launch, plus anyone the screening
 * dashboard (R9) holds in Reserve. Invited candidates are no longer reserve.
 */
export function reserveCandidates(doc: FieldworkDoc | undefined, audience: AudienceDoc | undefined): ReserveCandidate[] {
  const own = doc?.reserve ?? []
  const known = new Set(own.map((c) => c.id))
  const screening = audience
    ? mockApplicants(audience)
        .filter((a) => a.outcome === 'Reserve' && !known.has(a.id))
        .map((a): ReserveCandidate => {
          const state = a.answers.find((x) => /state/i.test(x.question))?.answer ?? ''
          return { id: a.id, contact: a.contact, state, region: (regionOf(state) as Region | undefined) ?? null, arrivedAt: FIELDWORK_NOW, status: 'Reserve' }
        })
    : []
  return [...own.filter((c) => c.status === 'Reserve'), ...screening]
}

// ─── where each participant is ──────────────────────────────────────────────

/**
 * Every participant is in exactly one of these. A participant counts once, by their latest session:
 * a participant who retried is not a second person.
 */
export type Bucket = 'completed' | 'withdrew' | 'noShow' | 'inProgress'

export function bucketOf(p: Participant): Bucket {
  const started = p.sessions.some((s) => s.startedAt)
  if (p.latest.status === 'Completed') return 'completed'
  if (p.latest.status === 'Withdrawn') return 'withdrew'
  // A human-led participant who missed a slot is rescheduled, not gone.
  if (!started && p.latest.access === 'No-show' && p.latest.status !== 'Rescheduled' && p.latest.status !== 'Booked') return 'noShow'
  return 'inProgress'
}

// ─── Needs you ──────────────────────────────────────────────────────────────

export type NeedsAction = 'Assign moderator' | 'Resend link' | 'Retry' | 'Approve replacement' | 'Reschedule'

export type NeedsRow = {
  key: string
  /** The participant, when the row is about one. A reserve candidate with nobody to replace has no session. */
  session?: Session
  /** The reserve candidate an Approve replacement would invite. */
  candidate?: ReserveCandidate
  /** The label: a participant ID, or the candidate's applicant ID. */
  who: string
  /** What happened, in a few words. */
  what: string
  /** When it happened. */
  since: string
  action: NeedsAction
  /** Set when the action can't be taken yet, with the reason. */
  blocked?: string
  /** Higher is more urgent. */
  urgency: number
}

const hoursSince = (iso: string) => (new Date(FIELDWORK_NOW).getTime() - new Date(iso).getTime()) / HOUR
const lastEvent = (s: Session) => s.events.reduce((m, e) => (e.at > m ? e.at : m), s.events[0]?.at ?? FIELDWORK_NOW)

/**
 * Unfinished sessions that need the Researcher, most urgent first. Only a participant's latest session counts, and
 * only if it hasn't ended in Review: a finished interview is never here. A session the Researcher already acted on leaves.
 * A reserve candidate is paired with a participant who withdrew; one with nobody to replace gets a row of their own.
 */
export function needsYou(doc: FieldworkDoc, reserve: ReserveCandidate[]): NeedsRow[] {
  const human = doc.sessions.some((s) => s.mode === 'human')
  const rows: NeedsRow[] = []
  const unclaimed = [...reserve]
  const claim = () => unclaimed.shift()

  for (const { latest: s } of participantsOf(doc)) {
    if (s.status === 'Completed' || s.handled) continue
    const since = lastEvent(s)
    const openIssue = s.issues.find((i) => i.status === 'Open')
    const row = (action: NeedsAction, what: string, urgency: number, extra: Partial<NeedsRow> = {}) =>
      rows.push({ key: s.id, session: s, who: s.participantId, what, since, action, urgency: urgency + Math.min(9, hoursSince(since) / 24), ...extra })

    if (s.status === 'Technical Error') row('Retry', `Technical error: ${(openIssue?.type ?? 'the session stopped').toLowerCase()}. The interview didn’t finish.`, 90)
    else if (human && s.status === 'Booked' && !s.moderatorId) row('Assign moderator', 'Booked a slot, but no moderator is assigned.', 85)
    else if (human && s.status === 'Rescheduled') row('Reschedule', 'Missed or moved their slot and needs a new one.', 80)
    else if (s.status === 'Incomplete (resumable)') row('Resend link', 'Left part-way. They can resume from their link.', 70)
    else if (s.status === 'Withdrawn') {
      const c = claim()
      if (c) row('Approve replacement', `Withdrew from the study. ${c.id} passed screening and is ready to invite.`, 66, { candidate: c })
      else row('Approve replacement', 'Withdrew from the study.', 40, { blocked: 'No one is in the reserve. Recruit more first.' })
    } else if (s.status === 'Not started' || s.status === 'Booked') {
      if (openIssue) row('Resend link', `${openIssue.type}. They can’t start until it’s fixed.`, 75)
      else if (s.access === 'No-show') row('Resend link', 'Consented but never started.', 60)
      else if (s.access === 'Opened' && hoursSince(since) > 24) row('Resend link', 'Opened the link but hasn’t started.', 50)
      else if (s.access === 'Invited' && hoursSince(since) > 48) row('Resend link', 'Invited but hasn’t opened the link.', 45)
    }
  }
  // Reserve candidates with nobody to replace are still ready to invite.
  for (const c of unclaimed)
    rows.push({ key: c.id, candidate: c, who: c.id, what: 'Passed screening and is in the reserve, ready to invite.', since: c.arrivedAt, action: 'Approve replacement', urgency: 62 })
  return rows.sort((a, b) => b.urgency - a.urgency)
}

// ─── Funnel ─────────────────────────────────────────────────────────────────

export type FunnelStage = {
  key: 'invited' | 'opened' | 'consented' | 'started' | 'completed'
  label: string
  /** People who got this far. */
  reached: number
  /** People who left the study here: they withdrew or never showed. */
  left: { label: string; n: number }[]
  /** People who are here and may still move on. */
  waiting: { label: string; n: number }[]
}

/**
 * Invited → Opened → Consented → Started → Completed, counted by participant. Every participant is in exactly one
 * of four places: completed (accepted, under review or excluded, all inside it), withdrew, no-show, or still in
 * progress. Those four add up to the number invited. At every stage reached = reached at the next stage + left + waiting.
 */
export function funnel(doc: FieldworkDoc, outcomes: Outcomes) {
  const ps = participantsOf(doc)
  const started = (p: Participant) => p.sessions.some((s) => s.startedAt)
  const n = (f: (p: Participant) => boolean) => ps.filter(f).length
  const opened = ps.filter((p) => p.first.access !== 'Invited')
  const consented = ps.filter((p) => !!p.first.consent || p.first.access === 'Consented' || p.first.access === 'No-show')
  const startedPs = ps.filter(started)

  const prog = progress(doc, outcomes)
  const where = (b: Bucket) => ps.filter((p) => bucketOf(p) === b).length
  const completed = where('completed')
  const withdrew = where('withdrew')
  const noShow = where('noShow')
  const inProgress = where('inProgress')

  const stages = ([
    { key: 'invited', label: 'Invited', reached: ps.length, left: [], waiting: [{ label: 'Haven’t opened the link', n: ps.length - opened.length }] },
    { key: 'opened', label: 'Opened', reached: opened.length, left: [], waiting: [{ label: 'Opened, haven’t consented', n: opened.length - consented.length }] },
    {
      key: 'consented',
      label: 'Consented',
      reached: consented.length,
      left: [{ label: 'No-show', n: noShow }],
      waiting: [{ label: 'Consented, not started yet', n: consented.length - startedPs.length - noShow }],
    },
    {
      key: 'started',
      label: 'Started',
      reached: startedPs.length,
      left: [{ label: 'Withdrew', n: withdrew }],
      waiting: [
        { label: 'In progress', n: n((p) => p.latest.status === 'Active' || p.latest.status === 'Paused') },
        { label: 'Left part-way, can resume', n: n((p) => p.latest.status === 'Incomplete (resumable)') },
        { label: 'Technical error', n: n((p) => p.latest.status === 'Technical Error') },
        // Started before, and their next session is waiting to begin.
        { label: 'Back for another session', n: n((p) => started(p) && bucketOf(p) === 'inProgress' && !p.latest.startedAt) },
      ],
    },
    { key: 'completed', label: 'Completed', reached: completed, left: [], waiting: [] },
  ] as FunnelStage[]).map((st) => ({ ...st, left: st.left.filter((x) => x.n > 0), waiting: st.waiting.filter((x) => x.n > 0) }))

  return {
    stages,
    total: ps.length,
    /** The four places everyone is. They add up to `total`. */
    completed: { n: completed, accepted: prog.confirmed, pending: prog.pending, excluded: prog.excluded },
    withdrew,
    noShow,
    inProgress,
    sum: completed + withdrew + noShow + inProgress,
  }
}

// ─── The gap to the target ──────────────────────────────────────────────────

/**
 * One cohort, one target. Pace and coverage are separate questions: this is coverage.
 *   counting = accepted + under review (excluded removed)
 *   open     = invited, consented, in progress, booked, or with a human, and still able to finish
 *   ceiling  = counting + open
 *   gap      = target - ceiling
 * The reserve is not in the ceiling: reserve people only become interviews once they are invited.
 */
export type Gap = {
  target: number
  counting: number
  confirmed: number
  pending: number
  excluded: number
  open: number
  reserve: number
  ceiling: number
  gap: number
}

export function shortfall(doc: FieldworkDoc, target: number, outcomes: Outcomes, reserve: ReserveCandidate[]): Gap {
  const prog = progress(doc, outcomes)
  const open = participantsOf(doc).filter((p) => bucketOf(p) === 'inProgress').length
  const ceiling = prog.toward + open
  return { target, counting: prog.toward, confirmed: prog.confirmed, pending: prog.pending, excluded: prog.excluded, open, reserve: reserve.length, ceiling, gap: Math.max(0, target - ceiling) }
}

// ─── Verdict ────────────────────────────────────────────────────────────────

export type VerdictLevel = 'On track' | 'Behind pace' | 'At risk'

export type Verdict = {
  level: VerdictLevel
  /** One sentence. */
  sentence: string
  /** Shown when most progress is still pending review. */
  warning?: string
  /** What the numbers include. */
  basis: string
  /** The single most useful action. */
  action: { label: string; to: 'recruit' | 'needs' | 'review' | 'sessions' }
  gap: Gap
  figures: { toward: number; confirmed: number; pending: number; excluded: number; expected: number; day: number; days: number }
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
  const basis = `${gap.counting} counting (${gap.confirmed} accepted, ${gap.pending} under review${gap.excluded ? `, ${gap.excluded} excluded removed` : ''}) + ${gap.open} still open = ${gap.ceiling}.${gap.reserve ? ` The reserve has ${gap.reserve}, not invited yet.` : ''}`
  const warning = prog.pending > prog.toward / 2 && prog.toward > 0 ? `${prog.pending} of the ${prog.toward} counted are still under review, so only ${prog.confirmed} are confirmed. Pending sessions can still be excluded.` : undefined
  const people = (k: number) => `${k} ${k === 1 ? 'person needs' : 'people need'} you`

  if (gap.gap > 0)
    return {
      level: 'At risk',
      sentence: `Only ${gap.ceiling} of ${target} can finish. ${gap.gap} more ${gap.gap === 1 ? 'person is' : 'people are'} needed.`,
      warning,
      basis,
      action: { label: `Recruit ${gap.gap} more`, to: 'recruit' },
      gap,
      figures,
    }
  if (prog.toward < pace.expected)
    return {
      level: 'Behind pace',
      sentence: `${gap.counting} counting so far, but about ${pace.expected} are expected by day ${pace.day} of ${pace.days}. ${needs > 0 ? `${people(needs)}.` : `${gap.open} could still finish.`}`,
      warning,
      basis,
      action: needs > 0 ? { label: `Work through ${needs} needing you`, to: 'needs' } : { label: 'See who hasn’t started', to: 'sessions' },
      gap,
      figures,
    }
  return {
    level: 'On track',
    sentence: `${gap.counting} of ${target} counting, with ${gap.open} still open. ${needs > 0 ? `${people(needs)}.` : 'Nothing is blocking.'}`,
    warning,
    basis,
    action: needs > 0 ? { label: `Work through ${needs} needing you`, to: 'needs' } : { label: 'Review the finished sessions', to: 'review' },
    gap,
    figures,
  }
}
