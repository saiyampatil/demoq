// What R18 tells the Researcher: am I on track, and what needs me. Everything here is computed from the
// study's session list (state/fieldwork.ts), so every number on the screen comes from the same place.

import { mockApplicants } from './screening'
import type { AudienceDoc } from './audience'
import { FIELDWORK_NOW, pacing, participantsOf, progress, type FieldworkDoc, type Outcomes, type Session } from './fieldwork'

const HOUR = 3600000

/** "12 min ago", "5 h ago", "3 days ago", on the fieldwork clock. */
export function ago(iso: string): string {
  const ms = Math.max(0, new Date(FIELDWORK_NOW).getTime() - new Date(iso).getTime())
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60000))} min ago`
  if (ms < 24 * HOUR) return `${Math.round(ms / HOUR)} h ago`
  const d = Math.round(ms / (24 * HOUR))
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}

/** Eligible people the pool is full of: reserve candidates not yet invited. */
export const reserveLeft = (audience: AudienceDoc | undefined) => (audience ? mockApplicants(audience).filter((a) => a.outcome === 'Reserve').length : 0)

// ─── Needs you ──────────────────────────────────────────────────────────────

export type NeedsAction = 'Assign moderator' | 'Resend link' | 'Retry' | 'Approve replacement' | 'Reschedule'

export type NeedsRow = {
  key: string
  session: Session
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
 */
export function needsYou(doc: FieldworkDoc, reserve: number): NeedsRow[] {
  const human = doc.sessions.some((s) => s.mode === 'human')
  const rows: NeedsRow[] = []
  for (const { latest: s } of participantsOf(doc)) {
    if (s.status === 'Completed' || s.handled) continue
    const since = lastEvent(s)
    const openIssue = s.issues.find((i) => i.status === 'Open')
    const row = (action: NeedsAction, what: string, urgency: number, blocked?: string) => rows.push({ key: s.id, session: s, what, since, action, urgency: urgency + Math.min(9, hoursSince(since) / 24), blocked })

    if (s.status === 'Technical Error') row('Retry', `Technical error: ${(openIssue?.type ?? 'the session stopped').toLowerCase()}. The interview didn’t finish.`, 90)
    else if (human && s.status === 'Booked' && !s.moderatorId) row('Assign moderator', 'Booked a slot, but no moderator is assigned.', 85)
    else if (human && s.status === 'Rescheduled') row('Reschedule', 'Missed or moved their slot and needs a new one.', 80)
    else if (s.status === 'Incomplete (resumable)') row('Resend link', 'Left part-way. They can resume from their link.', 70)
    else if (s.status === 'Withdrawn') row('Approve replacement', 'Withdrew from the study.', 40, reserve > 0 ? undefined : 'No one is in reserve. Invite more people first.')
    else if (s.status === 'Not started' || s.status === 'Booked') {
      if (openIssue) row('Resend link', `${openIssue.type}. They can’t start until it’s fixed.`, 75)
      else if (s.access === 'No-show') row('Resend link', 'Consented but never started.', 60)
      else if (s.access === 'Opened' && hoursSince(since) > 24) row('Resend link', 'Opened the link but hasn’t started.', 50)
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
  /** People who left the study here for good. */
  left: { label: string; n: number }[]
  /** People who are here and may still move on. */
  waiting: { label: string; n: number }[]
}

/**
 * Invited → Opened → Consented → Started → Completed, counted by participant. At every stage
 * reached = reached at the next stage + left + waiting, so nobody goes unaccounted for.
 */
export function funnel(doc: FieldworkDoc) {
  const ps = participantsOf(doc)
  const started = (p: (typeof ps)[number]) => p.sessions.some((s) => s.startedAt)
  const n = (f: (p: (typeof ps)[number]) => boolean) => ps.filter(f).length
  const opened = ps.filter((p) => p.first.access !== 'Invited')
  const consented = ps.filter((p) => !!p.first.consent || p.first.access === 'Consented' || p.first.access === 'No-show')
  const startedPs = ps.filter(started)
  const completed = ps.filter((p) => p.latest.status === 'Completed')

  const noShow = n((p) => !started(p) && p.latest.access === 'No-show')
  const withdrawn = n((p) => p.latest.status === 'Withdrawn')
  const stages: FunnelStage[] = ([
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
      left: [{ label: 'Withdrew', n: withdrawn }],
      waiting: [
        { label: 'In progress', n: n((p) => p.latest.status === 'Active' || p.latest.status === 'Paused') },
        { label: 'Left part-way, can resume', n: n((p) => p.latest.status === 'Incomplete (resumable)') },
        { label: 'Technical error', n: n((p) => p.latest.status === 'Technical Error') },
        // A started participant whose new session is waiting to begin.
        { label: 'Back for another session', n: n((p) => started(p) && p.latest.status !== 'Completed' && !p.latest.startedAt && p.latest.access !== 'No-show') },
      ],
    },
    { key: 'completed', label: 'Completed', reached: completed.length, left: [], waiting: [] },
  ] as FunnelStage[]).map((st) => ({ ...st, left: st.left.filter((x) => x.n > 0), waiting: st.waiting.filter((x) => x.n > 0) }))

  // Every participant is either completed, left, or still waiting somewhere.
  const left = stages.reduce((sum, st) => sum + st.left.reduce((a, x) => a + x.n, 0), 0)
  const waiting = stages.reduce((sum, st) => sum + st.waiting.reduce((a, x) => a + x.n, 0), 0)
  return { stages, total: ps.length, completed: completed.length, left, waiting, accounted: completed.length + left + waiting }
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
  action: { label: string; to: 'sourcing' | 'needs' | 'review' | 'none' }
  coverage: { invited: number; target: number; reserve: number; dropped: { excluded: number; withdrawn: number }; canFinish: number; short: number }
  figures: { toward: number; confirmed: number; pending: number; excluded: number; expected: number; day: number; days: number }
}

/**
 * On track, Behind pace or At risk. Pace uses confirmed plus pending sessions (and says so). At risk means the people
 * already invited, plus the reserve, can't reach the target even if every one of them finishes.
 */
export function verdict(doc: FieldworkDoc, target: number, outcomes: Outcomes, reserve: number, needs: number): Verdict {
  const prog = progress(doc, outcomes)
  const pace = pacing(doc, target, outcomes)
  const ps = participantsOf(doc)
  // Still able to finish: not completed, not withdrawn.
  const open = ps.filter((p) => p.latest.status !== 'Completed' && p.latest.status !== 'Withdrawn').length
  const withdrawn = ps.filter((p) => p.latest.status === 'Withdrawn').length
  const canFinish = prog.toward + open
  const short = Math.max(0, target - (canFinish + reserve))
  const coverage = { invited: ps.length, target, reserve, dropped: { excluded: prog.excluded, withdrawn }, canFinish, short }
  const figures = { toward: prog.toward, confirmed: prog.confirmed, pending: prog.pending, excluded: prog.excluded, expected: pace.expected, day: pace.day, days: pace.days }
  const basis = `Counts accepted plus under-review sessions${prog.excluded ? `, with the ${prog.excluded} excluded removed` : ''}.`
  const warning = prog.pending > prog.toward / 2 && prog.toward > 0 ? `${prog.pending} of the ${prog.toward} are still under review, so only ${prog.confirmed} are confirmed. Pending sessions can still be excluded.` : undefined
  const done = `${prog.toward} of ${target} done, about ${pace.expected} expected by now.`

  if (short > 0)
    return {
      level: 'At risk',
      sentence: `${done} Even if everyone still open finishes, you’d end on ${canFinish + reserve}.`,
      warning,
      basis,
      action: { label: `Invite at least ${short} more`, to: 'sourcing' },
      coverage,
      figures,
    }
  if (prog.toward < pace.expected)
    return {
      level: 'Behind pace',
      sentence: needs > 0 ? `${done} ${needs} ${needs === 1 ? 'person needs' : 'people need'} you, and ${open} could still finish.` : `${done} ${open} could still finish.`,
      warning,
      basis,
      action: needs > 0 ? { label: `Work through ${needs} needing you`, to: 'needs' } : { label: 'Invite more participants', to: 'sourcing' },
      coverage,
      figures,
    }
  return {
    level: 'On track',
    sentence: `${done} ${needs > 0 ? `${needs} ${needs === 1 ? 'person needs' : 'people need'} you.` : 'Nothing is blocking.'}`,
    warning,
    basis,
    action: needs > 0 ? { label: `Work through ${needs} needing you`, to: 'needs' } : { label: 'Review the finished sessions', to: 'review' },
    coverage,
    figures,
  }
}
