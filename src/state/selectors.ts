// The one place every derived number comes from: what R18 tells the Researcher (am I on track, what needs me),
// and what R21 and the stepper count. All of it is computed from the study's session list
// (state/fieldwork.ts) and the review records on it, so no screen counts for itself and two screens cannot disagree.
//
// The counted session of a participant is their latest session that is Completed. A participant counts once,
// however many sessions they have. Validation (Under review, Accepted, Excluded) belongs to a Completed session
// only: it is Under review the moment the session completes, and only a Researcher's decision changes it.

import { formatDate, formatStamp } from '@/lib/format'
import type { AudienceDoc } from './audience'
import { ESCALATION_PROMISE_HOURS, MODERATOR_ROSTER, type ModeratorState } from '@/mock/moderation'
import { NEEDS_YOU_GRACE_MIN } from '@/mock/needsYou'
import type { ReviewSession, ReviewStatus } from '@/mock/review'
import {
  FIELDWORK_NOW,
  fieldworkNow,
  handledBySystem,
  moderatorName,
  ISSUE_FIX,
  ISSUE_META,
  ISSUE_TYPES,
  REGIONS,
  participantsOf,
  type FieldworkDoc,
  type Outcomes,
  type Participant,
  type Region,
  type ReserveCandidate,
  type Session,
  type TechIssue,
} from './fieldwork'
import { mockApplicants, regionOf } from './screening'

const HOUR = 3600000

// ─── counted sessions and validation ────────────────────────────────────────

/** The participant's latest Completed session: the one that counts. */
export const countedSessionOf = (p: Participant): Session | undefined => [...p.sessions].reverse().find((x) => x.status === 'Completed')

/** One session per participant who has completed: the interviews that are in Review and toward the target. */
export const countedSessions = (doc: FieldworkDoc): Session[] => participantsOf(doc).flatMap((p) => countedSessionOf(p) ?? [])

/** Where a Completed session stands in validation. Review decisions come in through `outcomes`; with none it is Under review. */
export const outcomeOf = (outcomes: Outcomes, s: Session): ReviewStatus => outcomes.get(s.id) ?? s.validationStatus ?? 'Under review'

/** null until the session is Completed. */
export const validationOf = (outcomes: Outcomes, s: Session): ReviewStatus | null => (s.status === 'Completed' ? outcomeOf(outcomes, s) : null)

/** Review outcomes by session, from the review records. */
export const outcomesOf = (review: ReviewSession[]): Outcomes => new Map(review.map((r) => [r.id, r.status]))

/** The counted sessions that are not Excluded: they hold a slot and count toward the target. */
export const towardSessions = (doc: FieldworkDoc, outcomes: Outcomes): Session[] => countedSessions(doc).filter((x) => outcomeOf(outcomes, x) !== 'Excluded')

/** The status words from the brief, merging the access and session tracks into one fieldwork status. */
export type FieldworkStatus = 'Invited' | 'Booked' | 'Not started' | 'In progress' | 'Completed' | 'Incomplete' | 'Rescheduled' | 'Withdrawn' | 'Technical error' | 'No-show'
export function fieldworkStatus(s: Session): FieldworkStatus {
  switch (s.status) {
    case 'Completed': return 'Completed'
    case 'Active':
    case 'Paused': return 'In progress'
    case 'Incomplete (resumable)': return 'Incomplete'
    case 'Technical Error': return 'Technical error'
    case 'Withdrawn': return 'Withdrawn'
    case 'Rescheduled': return 'Rescheduled'
    case 'Booked': return 'Booked'
    default: return s.access === 'No-show' ? 'No-show' : s.access === 'Invited' || s.access === 'Opened' ? 'Invited' : 'Not started'
  }
}

/** What the Review queue and the stepper count. `total` is the Completed interviews and is the funnel's Completed. */
export function reviewCounts(review: ReviewSession[]) {
  const n = (st: ReviewStatus) => review.filter((x) => x.status === st).length
  return {
    total: review.length,
    underReview: n('Under review'),
    waiting: review.filter((x) => x.status === 'Under review' && x.awaiting).length,
    accepted: n('Accepted'),
    excluded: n('Excluded'),
  }
}

/** Every moderator with where they are now, for assigning one. A moderator on a live session is in session, and not on standby. */
export function moderatorRoster(doc: FieldworkDoc): { id: string; name: string; state: ModeratorState; standby: boolean }[] {
  const busy = new Set(doc.sessions.filter((s) => s.status === 'Active' && s.moderatorId).map((s) => s.moderatorId))
  return MODERATOR_ROSTER.map((m) => ({ id: m.id, name: moderatorName(m.id), state: busy.has(m.id) ? 'In session' : m.state, standby: m.standby && !busy.has(m.id) }))
}

/** Who each outstanding clarification is waiting for. A clarification keeps the session Under review; it is a research matter, never Needs you. */
export function waitingFor(review: ReviewSession[]) {
  const open = review.filter((x) => x.status === 'Under review' && x.awaiting)
  return { participant: open.filter((x) => x.awaiting!.to === 'Participant').length, moderator: open.filter((x) => x.awaiting!.to === 'Moderator').length }
}

/** The handoff to Analysis: every counted session has a decision. `undecided` is what is still Under review. */
export function handoffGate(review: ReviewSession[]) {
  const c = reviewCounts(review)
  return { total: c.total, undecided: c.underReview, complete: c.total > 0 && c.underReview === 0 }
}

/**
 * What stops fieldwork from closing: a participant (by their latest session) still in progress, left part-way, or
 * stuck on a technical error. Someone the Researcher gave up on, or whose earlier attempt failed but later completed,
 * no longer blocks.
 */
export function closeBlockers(doc: FieldworkDoc) {
  const ps = participantsOf(doc).filter((p) => !p.latest.gaveUp && !countedSessionOf(p))
  const n = (st: Session['status']) => ps.filter((p) => p.latest.status === st).length
  const inProgress = ps.filter((p) => p.latest.status === 'Active' || p.latest.status === 'Paused').length
  const incomplete = n('Incomplete (resumable)')
  const technical = ps.filter((p) => p.latest.status === 'Technical Error').length
  const parts = [inProgress && `${inProgress} in progress`, incomplete && `${incomplete} left part-way`, technical && `${technical} with a technical error`].filter(Boolean) as string[]
  return { inProgress, incomplete, technical, blocked: parts.length > 0, reason: parts.length ? `Can’t close yet: ${parts.join(', ')}. Finish them or give up on them first.` : undefined }
}

/** Sessions and people are different numbers: a participant who came back has two sessions. */
export const sessionTotals = (doc: FieldworkDoc) => ({ sessions: doc.sessions.length, participants: participantsOf(doc).length })

/** "12 min ago", "5 h ago", "3 days ago", on the fieldwork clock. */
export function ago(iso: string, now: string = FIELDWORK_NOW): string {
  const ms = Math.max(0, new Date(now).getTime() - new Date(iso).getTime())
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
export const windowClosed = (doc: FieldworkDoc) => new Date(fieldworkNow(doc)).getTime() > windowEnd(doc)

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
  // The reserve locked in R11, and anyone screened after launch who qualified.
  const inFinalReserve = new Set((audience?.pool?.reserve ?? []).map((r) => r.applicantId))
  const fromScreening = audience
    ? mockApplicants(audience)
        .filter((a) => (a.reserveBound || inFinalReserve.has(a.id)) && !known.has(a.id))
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
  if (countedSessionOf(p)) return 'completed'
  if (p.latest.gaveUp) return 'gaveUp'
  if (p.latest.status === 'Withdrawn') return 'withdrew'
  // A human-led participant who missed a slot is rescheduled, not gone.
  if (!started && p.latest.access === 'No-show' && p.latest.status !== 'Rescheduled' && p.latest.status !== 'Booked') return 'noShow'
  return 'inProgress'
}

// ─── Needs you ──────────────────────────────────────────────────────────────
//
// A row belongs here only if the participant cannot recover alone and a Researcher action is the only thing that
// moves it forward. It is the slow-path safety net: the participant's own screens handle the first minutes, and what
// PulseAI is handling stays in the Issues tab. Eight kinds, nothing else.

export type NeedsKind = 'escalation' | 'moderator-no-show' | 'self-service' | 'connection-lost' | 'link-expired' | 'left-part-way' | 'never-started' | 'pulseai'

export type NeedsAction = 'Assign moderator' | 'Send booking link' | 'Resend link' | 'Reissue link' | 'Resume' | 'Retry' | 'Copy report for support'

export type NeedsRow = {
  key: string
  session: Session
  /** The participant ID. */
  who: string
  kind: NeedsKind
  /** What happened, in plain words. */
  what: string
  /** Whose side the failure was on. "Our side" is never penalised: no No-show, no lost incentive or slot, a free reschedule. */
  fault: 'Participant side' | 'Our side'
  /** When it happened. */
  since: string
  /** The primary action. */
  action: NeedsAction
  /** The action sends the participant a link or an invitation, so a paused study blocks it. */
  invites: boolean
  /** "Give up and replace" is offered. Not on PulseAI hasn't recovered: the Researcher can't replace someone over our own failure. */
  giveUp: boolean
  /** Said under what happened: that the participant already tried to fix it themselves, so nobody repeats a step. */
  note?: string
  /** The open PulseAI issue, for the support report. */
  issue?: TechIssue
  /** Waiting for moderator: the promise clock. */
  escalation?: { waitedMin: number; leftMin: number }
}

const timesWord = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** The participant already tried the on-screen steps for this problem and it didn't work. */
export function selfServiceNote(s: Session): string | undefined {
  const last = [...(s.selfService ?? [])].reverse().find((x) => x.outcome === 'unresolved')
  if (!last || !s.issues.some((i) => i.status === 'Open' && i.type === last.issue)) return undefined
  return `Self-service tried ${timesWord(last.checks)}, didn’t fix it.`
}

const lastEvent = (s: Session) => s.events.reduce((m, e) => (e.at > m ? e.at : m), s.events[0]?.at ?? FIELDWORK_NOW)

/**
 * What the Researcher can do about unfinished sessions, in this order: a participant waiting for a moderator (oldest
 * first), then our-side failures, then everything else by age, oldest first. Only a participant's latest session
 * counts. A row leaves when the next event happens (they resume, open the link, start, PulseAI recovers) or when the
 * Researcher acts or gives up with a reason. Nobody marks anything resolved.
 */
export function needsYou(doc: FieldworkDoc): NeedsRow[] {
  const closed = windowClosed(doc)
  const now = new Date(fieldworkNow(doc)).getTime()
  const rows: (NeedsRow & { tier: 1 | 2 | 3 })[] = []
  /** A row never appears before its grace period ends. */
  const past = (since: string, graceMin: number) => now - new Date(since).getTime() >= graceMin * 60000

  for (const { latest: s } of participantsOf(doc)) {
    if (s.gaveUp || s.status === 'Withdrawn') continue
    const base = { key: s.id, session: s, who: s.participantId }
    const open = s.issues.filter((i) => i.status === 'Open')
    const rank = { Blocking: 0, Degraded: 1, Minor: 2 } as const
    const oldest = (list: TechIssue[]) => [...list].sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.localeCompare(a.at))[0]

    // 1. Waiting for moderator: someone asked for a human and nobody accepted. An accepted escalation never comes here.
    if (s.escalation?.status === 'Waiting for moderator') {
      const waited = Math.max(0, (now - new Date(s.escalation.requestedAt).getTime()) / 60000 + (s.escalation.extraWaitMin ?? 0))
      rows.push({ ...base, tier: 1, kind: 'escalation', what: 'Asked for a human and no moderator accepted.', fault: 'Our side', since: s.escalation.requestedAt, action: 'Assign moderator', invites: true, giveUp: true, escalation: { waitedMin: waited, leftMin: ESCALATION_PROMISE_HOURS * 60 - waited } })
      continue
    }

    if (s.status !== 'Completed' && !s.handled) {
      const connection = open.find((i) => i.type === 'Connection lost')
      const expired = open.find((i) => i.type === 'Link expired or invalid')
      const droppedMod = open.find((i) => i.type === 'Moderator disconnected')
      const failedSS = [...(s.selfService ?? [])].reverse().find((x) => x.outcome === 'unresolved')
      const deviceIssue = failedSS ? open.find((i) => i.type === failedSS.issue && ISSUE_FIX[i.type].via === 'session-start') : undefined
      const note = selfServiceNote(s)

      // 2. Moderator didn't show (human-led). Our fault: free reschedule, never a No-show.
      if (s.mode === 'human' && (s.moderatorNoShow || droppedMod)) {
        if (past(s.moderatorNoShow?.at ?? droppedMod!.at, NEEDS_YOU_GRACE_MIN.moderatorNoShow))
        rows.push({ ...base, tier: 2, kind: 'moderator-no-show', what: s.moderatorNoShow ? 'The moderator didn’t join the booked slot.' : 'The moderator disconnected and the interview didn’t finish.', fault: 'Our side', since: s.moderatorNoShow?.at ?? droppedMod!.at, action: 'Send booking link', invites: true, giveUp: true })
        continue
      }
      // 3. Self-service failed: they tried the on-screen steps and one retry, and it still isn't fixed. No attempt, no row.
      if (deviceIssue && failedSS) {
        if (past(failedSS.at, NEEDS_YOU_GRACE_MIN.selfServiceFailed))
        rows.push({ ...base, tier: 3, kind: 'self-service', what: `${deviceIssue.type}. The on-screen steps didn’t fix it.`, fault: 'Participant side', since: failedSS.at, action: 'Resend link', invites: true, giveUp: true, note })
        continue
      }
      // 4. Connection lost and they never came back.
      if (connection && (s.status === 'Technical Error' || s.status === 'Incomplete (resumable)')) {
        if (past(connection.at, NEEDS_YOU_GRACE_MIN.connectionLost))
        rows.push({ ...base, tier: 3, kind: 'connection-lost', what: 'Connection lost and they haven’t come back.', fault: 'Participant side', since: connection.at, action: s.status === 'Incomplete (resumable)' ? 'Resume' : 'Retry', invites: true, giveUp: true, note })
        continue
      }
      // 5. Link expired or invalid: they can't start until a new link is issued.
      if (expired) {
        if (past(expired.at, NEEDS_YOU_GRACE_MIN.linkExpired))
        rows.push({ ...base, tier: 3, kind: 'link-expired', what: 'Their link is expired or invalid, so they can’t start.', fault: 'Participant side', since: expired.at, action: 'Reissue link', invites: true, giveUp: true })
        continue
      }
      // 6. Left part-way and never returned.
      if (s.status === 'Incomplete (resumable)') {
        if (past(lastEvent(s), NEEDS_YOU_GRACE_MIN.leftPartWay))
        rows.push({ ...base, tier: 3, kind: 'left-part-way', what: 'Left part-way and hasn’t come back.', fault: 'Participant side', since: lastEvent(s), action: 'Resend link', invites: true, giveUp: true })
        continue
      }
      // 7. Consented (or opened the link) and never started. A no-show after the window closes opens a slot instead; the gap shows it.
      if (s.status === 'Not started' && s.access !== 'Invited' && !(s.access === 'No-show' && closed)) {
        if (past(lastEvent(s), NEEDS_YOU_GRACE_MIN.neverStarted))
        rows.push({ ...base, tier: 3, kind: 'never-started', what: s.consent || s.access === 'No-show' || s.access === 'Consented' ? 'Consented but never started.' : 'Opened the link but never started.', fault: 'Participant side', since: lastEvent(s), action: 'Resend link', invites: true, giveUp: true })
        continue
      }
    }

    // 8. PulseAI hasn't recovered from what it was handling. The Researcher can only report it. A finished interview is in Review, not here.
    const system = s.status === 'Completed' ? undefined : oldest(open.filter((i) => handledBySystem(i.type)))
    if (system && past(system.at, NEEDS_YOU_GRACE_MIN.pulseAiUnrecovered)) rows.push({ ...base, tier: 2, kind: 'pulseai', what: `${system.type}. PulseAI is still working on it.`, fault: 'Our side', since: system.at, action: 'Copy report for support', invites: false, giveUp: false, issue: system })
  }

  // Waiting for moderator first, then our-side failures, then the rest. Oldest first within each.
  return rows.sort((a, b) => a.tier - b.tier || (a.tier === 1 ? b.escalation!.waitedMin - a.escalation!.waitedMin : a.since.localeCompare(b.since))).map(({ tier: _tier, ...row }) => row)
}

/** The text the Researcher pastes to support for a problem PulseAI hasn't recovered from. */
export function supportReport(doc: FieldworkDoc, row: NeedsRow): string {
  const s = row.session
  const i = row.issue
  return [
    'PulseAI support report',
    `Study: ${doc.studyId} (${doc.releaseVersion})`,
    `Session: ${s.id}${s.mode === 'human' ? ' (human-led)' : ' (AI-led)'}`,
    `Participant: ${s.participantId}`,
    `Device: ${s.device}`,
    i ? `Problem: ${i.type} (${i.severity})` : `Problem: ${row.what}`,
    i ? `Started: ${formatStamp(i.at)}` : `Since: ${formatStamp(row.since)}`,
    'Status: still open after the 2 hour timeout',
  ].join('\n')
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

// ─── The participant journey ────────────────────────────────────────────────

export type JourneyKey = 'invited' | 'opened' | 'booked' | 'started' | 'completed'
export type JourneyStage = { key: JourneyKey; label: string; /** People who got at least this far. */ reached: number }
export type JourneyStep = { from: JourneyKey; to: JourneyKey; /** People whose furthest stage is `from`. */ lost: number; /** Share of `from` who went on, whole percent. */ pct: number; biggest: boolean }

/** A human-led study has a booking step between opening the link and starting. */
export const isHumanLed = (doc: FieldworkDoc) => doc.sessions[0]?.mode === 'human'

const JOURNEY_LABEL: Record<JourneyKey, string> = { invited: 'Invited', opened: 'Opened', booked: 'Booked', started: 'Started', completed: 'Completed' }
/** Below this many invited, percentages say nothing. */
export const JOURNEY_MIN_INVITED = 10

const journeyKeys = (human: boolean): JourneyKey[] => (human ? ['invited', 'opened', 'booked', 'started', 'completed'] : ['invited', 'opened', 'started', 'completed'])

/** The furthest stage a participant reached. Everyone is in exactly one. */
function furthest(p: Participant, keys: JourneyKey[]): JourneyKey {
  const started = p.sessions.some((s) => s.startedAt)
  const reached: Record<JourneyKey, boolean> = {
    invited: true,
    opened: p.first.access !== 'Invited' || started,
    booked: p.sessions.some((s) => s.slot || s.startedAt || s.status === 'Booked'),
    started,
    completed: bucketOf(p) === 'completed',
  }
  return [...keys].reverse().find((k) => reached[k]) ?? 'invited'
}

/**
 * Where invited people are lost. Each participant is counted once, at the furthest stage reached, so the stages are
 * cumulative ("reached at least") and an arrow's loss is the people whose furthest stage is the one it leaves. The
 * numbers come from the same participants as the verdict, the KPI strip and the funnel invariants.
 */
export function journey(doc: FieldworkDoc) {
  const human = isHumanLed(doc)
  const keys = journeyKeys(human)
  const ps = participantsOf(doc)
  const at = new Map(ps.map((p) => [p.id, keys.indexOf(furthest(p, keys))]))
  const stages: JourneyStage[] = keys.map((key, i) => ({ key, label: JOURNEY_LABEL[key], reached: [...at.values()].filter((x) => x >= i).length }))
  const steps: JourneyStep[] = stages.slice(0, -1).map((st, i) => ({ from: st.key, to: stages[i + 1].key, lost: st.reached - stages[i + 1].reached, pct: st.reached ? Math.round((stages[i + 1].reached / st.reached) * 100) : 0, biggest: false }))
  const worst = steps.reduce<JourneyStep | null>((m, x) => (x.lost > (m?.lost ?? 0) ? x : m), null)
  if (worst) worst.biggest = true
  const tooEarly = ps.length < JOURNEY_MIN_INVITED

  const reading = (() => {
    if (tooEarly) return { text: `Too early to read. Percentages start at ${JOURNEY_MIN_INVITED} invited people; ${ps.length} so far.` }
    if (!worst) return { text: 'Nobody has been lost so far.' }
    const lostWord = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`
    if (worst.from === 'invited') return { text: 'Most loss is before people open the link. Check the invitation email and resend to those who haven’t opened.', link: { label: `See the ${lostWord(worst.lost)} who haven’t opened`, stuck: worst.from } }
    if (worst.from === 'opened') return { text: 'People open but don’t start. Check booking availability and reminders.', link: { label: `See the ${lostWord(worst.lost)} who opened and stopped`, stuck: worst.from } }
    if (worst.from === 'booked') return { text: 'People book a slot but don’t start. Check the reminders and the slot times.', link: { label: `See the ${lostWord(worst.lost)} who booked and didn’t start`, stuck: worst.from } }
    return { text: 'People leave during the interview. Check interview length and technical issues.', link: { label: `See the ${lostWord(worst.lost)} who started and didn’t finish`, stuck: worst.from } }
  })()
  return { human, stages, steps, total: ps.length, tooEarly, reading }
}

/** The participants behind a number on the journey: those who reached a stage, or those whose furthest stage it is. */
export function journeyPeople(doc: FieldworkDoc, by: { reached?: JourneyKey; stuck?: JourneyKey }): Set<string> | undefined {
  const keys = journeyKeys(isHumanLed(doc))
  const key = by.reached ?? by.stuck
  if (!key || !keys.includes(key)) return undefined
  const idx = keys.indexOf(key)
  return new Set(participantsOf(doc).filter((p) => { const f = keys.indexOf(furthest(p, keys)); return by.reached ? f >= idx : f === idx }).map((p) => p.id))
}

// ─── The slot ledger and the gap to the target ──────────────────────────────

/** Accepted is green, Under review amber, running and noShow white (held by someone who can still finish), open a dashed red gap. */
export type SlotState = 'accepted' | 'review' | 'running' | 'noShow' | 'open'

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
  const acc = Math.min(c, prog.confirmed)
  const r = at(running, c)
  const h = at(noShowHeld, c + r)
  const open = Math.max(0, target - held)
  return {
    target,
    slots: [...Array(acc).fill('accepted'), ...Array(c - acc).fill('review'), ...Array(r).fill('running'), ...Array(h).fill('noShow'), ...Array(open).fill('open')] as SlotState[],
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
  /** How the gap is closed, with the reasoning in one line. Only when there is a gap. */
  plan?: ReturnType<typeof closingPlan>
  gap: Gap
  figures: { toward: number; confirmed: number; pending: number; excluded: number; expected: number; day: number; days: number }
}

/** The study's target: the Researcher's lowered target if there is one, else the audience's. */
export const targetOf = (doc: FieldworkDoc | undefined, audience: AudienceDoc | undefined, fallback = 0) => doc?.targetChange?.to ?? audience?.def?.total ?? fallback

/** Share of invited participants who completed an interview. It sets how many more people to source. */
export function completionRate(doc: FieldworkDoc) {
  const ps = participantsOf(doc)
  const completed = ps.filter((p) => bucketOf(p) === 'completed').length
  return { completed, invited: ps.length, rate: ps.length ? completed / ps.length : 0 }
}

/** How long, in days, it takes to source, screen and interview someone new. A mock figure. */
export const TOPUP_DAYS = 4

/**
 * How to close an open gap. The reserve is invited first (all of it: not everyone will finish), and what it can't cover
 * is sourced, scaled up by the completion rate: gap divided by the share of invited people who complete, rounded up.
 */
export function closingPlan(gap: number, reserve: number, rate: number) {
  const remaining = Math.max(0, gap - reserve)
  const pct = Math.round(rate * 100)
  // With no completions yet there is no rate to scale by, so every invited person is assumed to finish.
  const source = remaining > 0 ? Math.ceil(remaining / (rate > 0 ? rate : 1)) : 0
  const line = [`Need ${gap}`, reserve > 0 ? `${reserve} in reserve${remaining > 0 ? `, ${remaining} still to find` : ''}` : null, rate > 0 ? `${pct}% of invited people complete` : 'no one has completed yet', source > 0 ? `source ${source}` : null].filter(Boolean).join(' · ')
  return { need: gap, inReserve: reserve, remaining, rate, pct, source, line }
}

/** The actions for an open gap, by how much of it the reserve covers. The first is the primary one. */
export function gapActions(gap: number, reserve: number, rate: number): VerdictAction[] {
  if (gap <= 0) return []
  const plan = closingPlan(gap, reserve, rate)
  const invite: VerdictAction = { kind: 'invite', n: reserve, label: `Invite all ${reserve} from reserve` }
  const source: VerdictAction = { kind: 'source', n: plan.source, label: `Source ${plan.source} more` }
  if (reserve >= gap) return [invite]
  if (reserve > 0) return [invite, source]
  return [source]
}

/**
 * A top-up is sourcing after launch: applicants who arrived and answered the screener go through screening into the
 * reserve, never straight to interviews. This is where each one is. Derived from the audience, so it moves with R9.
 */
export function topUpStatus(doc: FieldworkDoc, audience: AudienceDoc | undefined) {
  const candidates = audience?.sourcing.candidates.filter((c) => c.afterLaunch) ?? []
  const applicants = audience ? mockApplicants(audience).filter((a) => a.afterLaunch) : []
  const inReserve = new Set(reserveRows(doc, audience).filter((r) => r.label === 'Available').map((r) => r.id))
  const sourced = candidates.length
  const inScreening = sourced - applicants.length + applicants.filter((a) => a.outcome === 'Pending review').length
  const newInReserve = applicants.filter((a) => inReserve.has(a.id)).length
  const running = sourced > 0 && (inScreening > 0 || newInReserve > 0)
  return { sourced, inScreening, eligible: newInReserve, newInReserve, running, requested: doc.topUp?.requested ?? sourced }
}

/** Days left in the window against the days a new person needs to be sourced, screened and interviewed. */
export function timeCheck(doc: FieldworkDoc, target: number, outcomes: Outcomes) {
  const left = pacing(doc, target, outcomes).left
  return { left, needed: TOPUP_DAYS, short: !!doc.window && left < TOPUP_DAYS }
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
  const rate = completionRate(doc).rate
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
      sentence: `${gap.ceiling} of ${target} can finish. ${gap.gap} more ${gap.gap === 1 ? 'person' : 'people'} needed.`,
      warning,
      basis,
      actions: gapActions(gap.gap, gap.reserve, rate),
      plan: closingPlan(gap.gap, gap.reserve, rate),
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

// ─── progress: confirmed and pending ────────────────────────────────────────

/** Two numbers wherever progress appears: confirmed (Accepted) and pending (Under review). Excluded are removed. */
export function progress(doc: FieldworkDoc, outcomes: Outcomes) {
  const done = countedSessions(doc)
  const n = (st: ReviewStatus) => done.filter((x) => outcomeOf(outcomes, x) === st).length
  const confirmed = n('Accepted')
  const pending = n('Under review')
  return { completed: done.length, confirmed, pending, excluded: n('Excluded'), toward: confirmed + pending }
}

/** The study's one target, with who counts toward it. */
export function targetFill(doc: FieldworkDoc, audience: AudienceDoc | undefined, outcomes: Outcomes) {
  const prog = progress(doc, outcomes)
  return {
    name: audience?.def?.cohort.name ?? 'Participants',
    target: targetOf(doc, audience),
    accepted: prog.confirmed,
    pending: prog.pending,
    excluded: prog.excluded,
    /** Toward the target: accepted plus pending. */
    completed: prog.toward,
    inProgress: doc.sessions.filter((x) => x.status === 'Active').length,
    reserve: doc.sessions.filter((x) => x.reserve).length,
  }
}


const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

export function durationStats(doc: FieldworkDoc) {
  const done = doc.sessions.filter((x) => x.status === 'Completed' && x.durationMin !== null)
  const d = done.map((x) => x.durationMin as number).sort((a, b) => a - b)
  const target = doc.plan.durationMin
  return {
    n: d.length,
    target,
    avg: avg(d),
    median: d.length ? d[Math.floor(d.length / 2)] : null,
    min: d[0] ?? null,
    max: d[d.length - 1] ?? null,
    over: d.filter((x) => x > target).length,
    partial: doc.sessions.filter((x) => x.status === 'Incomplete (resumable)' || x.status === 'Withdrawn' || x.status === 'Technical Error').length,
  }
}

/** Pace against the fieldwork window, on the prototype clock. */
export function pacing(doc: FieldworkDoc, target: number, outcomes: Outcomes) {
  const w = doc.window
  const completed = towardSessions(doc, outcomes).length
  if (!w) return { completed, target, days: 0, day: 0, expected: 0, projected: completed, left: 0 }
  const day0 = new Date(`${w.start}T00:00:00-05:00`).getTime()
  const end = new Date(`${w.end}T23:59:59-05:00`).getTime()
  const days = Math.round((end - day0) / 86400000)
  const day = Math.min(days, Math.max(1, Math.ceil((new Date(FIELDWORK_NOW).getTime() - day0) / 86400000)))
  const expected = Math.round((target * day) / days)
  const projected = Math.round((completed / day) * days)
  return { completed, target, days, day, expected, projected, left: days - day }
}

export function regionMatrix(doc: FieldworkDoc, outcomes: Outcomes) {
  const done = towardSessions(doc, outcomes)
  const totals = Object.fromEntries(REGIONS.map((r) => [r, done.filter((x) => x.region === r).length])) as Record<Region, number>
  return { totals, total: done.length, unplaced: done.filter((x) => !x.region).length }
}

/**
 * Says so only when the regions are skewed: with at least six interviews counted, one region holds more than half
 * of them, or (with ten or more) a region has none. Otherwise there is nothing to alert on.
 */
export function regionSkew(totals: Record<Region, number>, total: number): string | undefined {
  if (total < 6) return undefined
  const top = REGIONS.reduce((a, r) => (totals[r] > totals[a] ? r : a), REGIONS[0])
  if (totals[top] / total > 0.5) return `${top} holds ${totals[top]} of the ${total} interviews counted (${Math.round((totals[top] / total) * 100)}%). Recruit more from the other regions if the client needs a spread.`
  const empty = REGIONS.filter((r) => totals[r] === 0)
  if (total >= 10 && empty.length) return `No interviews counted from ${empty.join(' or ')} yet, out of ${total}.`
  return undefined
}

export function issueSummary(doc: FieldworkDoc) {
  const all = doc.sessions.flatMap((s) => s.issues.map((i) => ({ ...i, sessionId: s.id, participantId: s.participantId, no: s.no, email: s.email })))
  return {
    all,
    open: all.filter((x) => x.status === 'Open').length,
    blocking: all.filter((x) => x.status === 'Open' && x.severity === 'Blocking').length,
    resolved: all.filter((x) => x.status === 'Resolved').length,
    /** Fixed by the participant with the on-screen steps. A count here and nothing in Needs you. */
    selfFixed: all.filter((x) => x.selfService).length,
    sessions: new Set(all.map((x) => x.sessionId)).size,
    byType: ISSUE_TYPES.map((t) => {
      const xs = all.filter((x) => x.type === t)
      return { type: t, ...ISSUE_META[t], ...ISSUE_FIX[t], count: xs.length, open: xs.filter((x) => x.status === 'Open').length, sessions: [...new Set(xs.map((x) => x.sessionId))] }
    }),
  }
}

/** Consent is given once per participant, in their first session; later sessions reuse it. */
export function consentSummary(doc: FieldworkDoc) {
  const ps = participantsOf(doc)
  const given = ps.filter((p) => p.first.consent && !p.first.consent.withdrawn)
  const withdrawn = ps.filter((p) => p.first.consent?.withdrawn)
  const pending = ps.filter((p) => !p.first.consent)
  const recontact = given.filter((p) => p.first.consent!.recontact).length
  return { given: given.length, withdrawn: withdrawn.length, pending: pending.length, recontact, recontactPct: given.length ? Math.round((recontact / given.length) * 100) : 0, total: ps.length }
}

