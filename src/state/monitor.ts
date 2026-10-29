// What R18 tells the Researcher: am I on track, and what needs me. Everything here is computed from the
// study's session list (state/fieldwork.ts), so every number on the screen comes from the same place.

import type { AudienceDoc } from './audience'
import {
  FIELDWORK_NOW,
  pacing,
  participantsOf,
  progress,
  quotaFill,
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
          return { id: a.id, cohort: a.cohort ?? '', contact: a.contact, state, region: (regionOf(state) as Region | undefined) ?? null, arrivedAt: FIELDWORK_NOW, status: 'Reserve' }
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
 * A reserve candidate is paired with a participant who withdrew from the same cohort; one with nobody to replace gets a row of their own.
 */
export function needsYou(doc: FieldworkDoc, reserve: ReserveCandidate[]): NeedsRow[] {
  const human = doc.sessions.some((s) => s.mode === 'human')
  const rows: NeedsRow[] = []
  const unclaimed = [...reserve]
  const claim = (cohort: string | null) => {
    const i = unclaimed.findIndex((c) => c.cohort === cohort)
    return i >= 0 ? unclaimed.splice(i, 1)[0] : undefined
  }

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
      const c = claim(s.cohort)
      if (c) row('Approve replacement', `Withdrew from the study. ${c.id} passed screening for ${c.cohort} and is ready to invite.`, 66, { candidate: c })
      else row('Approve replacement', 'Withdrew from the study.', 40, { blocked: `No one in ${s.cohort ?? 'this segment'} is in reserve. Recruit for it first.` })
    } else if (s.status === 'Not started' || s.status === 'Booked') {
      if (openIssue) row('Resend link', `${openIssue.type}. They can’t start until it’s fixed.`, 75)
      else if (s.access === 'No-show') row('Resend link', 'Consented but never started.', 60)
      else if (s.access === 'Opened' && hoursSince(since) > 24) row('Resend link', 'Opened the link but hasn’t started.', 50)
      else if (s.access === 'Invited' && hoursSince(since) > 48) row('Resend link', 'Invited but hasn’t opened the link.', 45)
    }
  }
  // Reserve candidates with nobody to replace are still ready to invite.
  for (const c of unclaimed)
    rows.push({ key: c.id, candidate: c, who: c.id, what: `Passed screening for ${c.cohort} and is in the reserve, ready to invite.`, since: c.arrivedAt, action: 'Approve replacement', urgency: 62 })
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

// ─── Shortfall: per cohort ──────────────────────────────────────────────────

export type CohortGap = {
  id: string
  name: string
  quota: number
  /** Accepted plus under review. Excluded are removed. */
  counting: number
  /** Still able to finish: not completed, withdrawn or no-show. */
  inProgress: number
  reserve: number
  /** The most this cohort can reach: counting, plus everyone still in progress, plus its reserve. */
  ceiling: number
  /** How many more it needs. Zero when the cohort can still fill. */
  short: number
}

/**
 * The gap per cohort against its quota, using confirmed plus pending. The overall figures are the sums, so a cohort
 * with spare people can't cover another that is short.
 */
export function shortfall(doc: FieldworkDoc, audience: AudienceDoc | undefined, outcomes: Outcomes, reserve: ReserveCandidate[]) {
  const fill = quotaFill(doc, audience, outcomes)
  const ps = participantsOf(doc)
  const cohorts: CohortGap[] = fill.map((f) => {
    const inProgress = ps.filter((p) => bucketOf(p) === 'inProgress' && p.latest.cohort === f.name).length
    const res = reserve.filter((c) => c.cohort === f.name).length
    const ceiling = f.completed + inProgress + res
    return { id: f.id, name: f.name, quota: f.target, counting: f.completed, inProgress, reserve: res, ceiling, short: Math.max(0, f.target - ceiling) }
  })
  const sum = (f: (c: CohortGap) => number) => cohorts.reduce((a, c) => a + f(c), 0)
  const prog = progress(doc, outcomes)
  const inProgress = ps.filter((p) => bucketOf(p) === 'inProgress').length
  return {
    cohorts,
    short: sum((c) => c.short),
    /** Overall, for the line under the cohorts: counting plus still in progress plus reserve. */
    counting: prog.toward,
    inProgress,
    reserve: reserve.length,
    ceiling: prog.toward + inProgress + reserve.length,
  }
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
  gap: ReturnType<typeof shortfall>
  figures: { toward: number; confirmed: number; pending: number; excluded: number; expected: number; day: number; days: number }
}

/**
 * On track, Behind pace or At risk. Pace uses confirmed plus pending sessions (and says so). At risk means a
 * cohort can't reach its quota even if everyone still in progress finishes and the reserve is invited.
 */
export function verdict(doc: FieldworkDoc, audience: AudienceDoc | undefined, target: number, outcomes: Outcomes, reserve: ReserveCandidate[], needs: number): Verdict {
  const prog = progress(doc, outcomes)
  const pace = pacing(doc, target, outcomes)
  const gap = shortfall(doc, audience, outcomes, reserve)
  const figures = { toward: prog.toward, confirmed: prog.confirmed, pending: prog.pending, excluded: prog.excluded, expected: pace.expected, day: pace.day, days: pace.days }
  const basis = `Counts accepted plus under-review sessions${prog.excluded ? `, with the ${prog.excluded} excluded removed` : ''}.`
  const warning = prog.pending > prog.toward / 2 && prog.toward > 0 ? `${prog.pending} of the ${prog.toward} are still under review, so only ${prog.confirmed} are confirmed. Pending sessions can still be excluded.` : undefined
  const done = `${prog.toward} of ${target} done, about ${pace.expected} expected by now.`
  const people = (k: number) => `${k} ${k === 1 ? 'person needs' : 'people need'} you`

  if (gap.short > 0) {
    const short = gap.cohorts.filter((c) => c.short > 0)
    return {
      level: 'At risk',
      sentence: `${done} ${short.map((c) => `${c.name} is short by ${c.short}`).join(' and ')}. Even if everyone still open finishes${gap.reserve > 0 ? ' and the reserve is invited' : ''}, you’d end on ${gap.ceiling}.`,
      warning,
      basis,
      action: { label: `Recruit at least ${gap.short} more`, to: 'recruit' },
      gap,
      figures,
    }
  }
  if (prog.toward < pace.expected)
    return {
      level: 'Behind pace',
      sentence: needs > 0 ? `${done} ${people(needs)}, and ${gap.inProgress} could still finish.` : `${done} ${gap.inProgress} could still finish.`,
      warning,
      basis,
      action: needs > 0 ? { label: `Work through ${needs} needing you`, to: 'needs' } : { label: 'See who hasn’t started', to: 'sessions' },
      gap,
      figures,
    }
  return {
    level: 'On track',
    sentence: `${done} ${needs > 0 ? `${people(needs)}.` : 'Nothing is blocking.'}`,
    warning,
    basis,
    action: needs > 0 ? { label: `Work through ${needs} needing you`, to: 'needs' } : { label: 'Review the finished sessions', to: 'review' },
    gap,
    figures,
  }
}
