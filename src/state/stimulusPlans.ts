// Which stimuli each participant sees, and in what order, so every stimulus gets an equal share of eyes and of first
// looks. Pure: the plans come from the approved guide's stimuli and the Researcher's setting; the counts come from the
// sessions every time and are never stored. Only a session's own plan is kept, on the session.
//
// The setting (Stimuli step): everyone sees all, or the stimuli are split into groups (a number of groups, or how many
// each person sees), and the order is rotated or not. The default, everyone sees all with no rotation, makes one plan:
// a study that never touches the setting behaves exactly as it did before.

import type { Session } from './fieldwork'
import type { StimuliState, Stimulus } from './guide'

export type Assignment = {
  mode: 'all' | 'split'
  /** Split: how many groups. Or, if `perPerson` is set, how many stimuli each person sees (the groups follow from it). */
  groups?: number
  perPerson?: number
  /** Rotate the order, so every stimulus is first, second and so on equally often. */
  rotate: boolean
}
export const DEFAULT_ASSIGNMENT: Assignment = { mode: 'all', rotate: false }
export const assignmentOf = (s: StimuliState): Assignment => s.assignment ?? DEFAULT_ASSIGNMENT

/** One way of showing the stimuli: a group's stimuli in one order. */
export type StimulusPlan = { id: string; group: number; order: string[]; names: string[] }

/** The plan a session holds. Kept on the session, so a later change to the guide never moves a booked participant. */
export type SessionPlan = StimulusPlan & { guideVersion: number; segment: string; assignedAt: string; /** A replacement takes over this person's plan. */ inheritedFrom?: string }

/** What participants are shown: the active stimuli, not the surveys, which have their own place in the interview. */
export const shownItems = (s: StimuliState): Stimulus[] => s.items.filter((i) => i.active && i.kind !== 'survey')

/** How many groups the setting makes of `n` stimuli. Everyone sees all is one group. */
export function groupCount(a: Assignment, n: number): number {
  if (a.mode === 'all') return 1
  if (a.perPerson) return n / a.perPerson
  return a.groups ?? 0
}

/** Why the setting can't be used, or null when it can. The guide can't be locked while this is not null. */
export function assignmentProblem(a: Assignment, n: number): string | null {
  if (a.mode === 'all') return null
  if (n === 0) return 'There are no stimuli to split.'
  const g = groupCount(a, n)
  if (a.perPerson !== undefined && (!Number.isInteger(a.perPerson) || a.perPerson < 1)) return 'Say how many stimuli each person sees: a whole number of 1 or more.'
  if (a.perPerson === undefined && (!Number.isInteger(a.groups) || (a.groups ?? 0) < 2)) return 'Split into 2 or more groups.'
  if (!Number.isInteger(g) || g < 1 || n % g !== 0) {
    const sizes = a.perPerson ? `${a.perPerson} each` : `${g} groups`
    return `${n} stimuli don’t split evenly into ${sizes}. Change the number so every group has the same count (${divisors(n).join(', ')} work${divisors(n).length === 1 ? 's' : ''}).`
  }
  if (g > n) return 'There can’t be more groups than stimuli.'
  return null
}
/** The ways n stimuli split into 2 or more equal groups, as a group count. */
const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((g) => g >= 2 && n % g === 0)

/** True when the setting leaves one plan: nothing is split and nothing rotates. */
export const isDefault = (a: Assignment) => a.mode === 'all' && !a.rotate

/**
 * Plans are the groups times the cyclic rotations of each group's order, so within a group every stimulus lands in every
 * position equally. Groups are consecutive runs of the library order. Without rotation each group has one order.
 */
export function buildPlans(items: Stimulus[], a: Assignment): StimulusPlan[] {
  if (items.length === 0 || assignmentProblem(a, items.length)) return []
  const g = groupCount(a, items.length)
  const size = items.length / g
  const plans: StimulusPlan[] = []
  for (let j = 0; j < g; j++) {
    const group = items.slice(j * size, (j + 1) * size)
    for (let r = 0; r < (a.rotate ? size : 1); r++) {
      const order = [...group.slice(r), ...group.slice(0, r)]
      plans.push({ id: `g${j + 1}-r${r}`, group: j + 1, order: order.map((i) => i.id), names: order.map((i) => i.name) })
    }
  }
  return plans
}

// ─── who counts ─────────────────────────────────────────────────────────────

/** A study has one cohort, so there is one quota segment. A session can name another, for a study that has several. */
export const SEGMENT = 'All participants'
export const segmentOf = (s: Pick<Session, 'segment'>) => s.segment ?? SEGMENT

/** Held, booked, started, completed and accepted sessions count. These release their plan: no-show, cancelled, excluded, given up. */
const releases = (s: Session, excluded: ReadonlySet<string>) => !!s.gaveUp || s.access === 'No-show' || s.status === 'Withdrawn' || s.escalation?.status === 'Cancelled by participant' || s.validationStatus === 'Excluded' || excluded.has(s.id)
/** A session that already showed a stimulus keeps counting even after it is released: those eyes were spent. */
const showed = (s: Session) => s.stimuli.some((x) => x.result === 'Shown')
export const counts = (s: Session, excluded: ReadonlySet<string> = new Set()) => !!s.stimulusPlan && (!releases(s, excluded) || showed(s))

/** The plans of the current guide that a session holds. A session booked under an older guide has plans that no longer exist. */
const live = (s: Session, plans: StimulusPlan[]) => !!s.stimulusPlan && plans.some((p) => p.id === s.stimulusPlan!.id)

/**
 * The plan for the next person in a segment: the group with the fewest people, then within it the order whose first stimulus
 * has been first the fewest times, then the first in the fixed order. Counted from the sessions, never stored.
 */
export function pickPlan(plans: StimulusPlan[], sessions: Session[], segment: string, excluded: ReadonlySet<string> = new Set()): StimulusPlan | undefined {
  if (plans.length === 0) return undefined
  const mine = sessions.filter((s) => counts(s, excluded) && segmentOf(s) === segment && live(s, plans))
  const groups = [...new Set(plans.map((p) => p.group))].sort((a, b) => a - b)
  const inGroup = (g: number) => mine.filter((s) => s.stimulusPlan!.group === g).length
  const group = groups.reduce((best, g) => (inGroup(g) < inGroup(best) ? g : best), groups[0])
  const candidates = plans.filter((p) => p.group === group)
  const firsts = (id: string) => mine.filter((s) => s.stimulusPlan!.group === group && s.stimulusPlan!.order[0] === id).length
  return candidates.reduce((best, p) => (firsts(p.order[0]) < firsts(best.order[0]) ? p : best), candidates[0])
}

/** Gives a session a plan if the study splits or rotates and it has none. A reschedule, which already has one, keeps it. */
export function planned(session: Session, plans: StimulusPlan[] | undefined, sessions: Session[], guideVersion: number, at: string): Session {
  if (session.stimulusPlan || !plans || plans.length < 2) return session
  const pick = pickPlan(plans, sessions.filter((s) => s.id !== session.id), segmentOf(session))
  return pick ? { ...session, stimulusPlan: { ...pick, guideVersion, segment: segmentOf(session), assignedAt: at } } : session
}

/** A person who gave up or was excluded leaves a plan nobody else holds yet. A replacement takes it over. */
export function inheritablePlan(sessions: Session[], excluded: ReadonlySet<string> = new Set()): SessionPlan | undefined {
  const taken = new Set(sessions.map((s) => s.stimulusPlan?.inheritedFrom).filter(Boolean))
  const gone = sessions.find((s) => s.stimulusPlan && releases(s, excluded) && !showed(s) && !taken.has(s.id))
  return gone?.stimulusPlan ? { ...gone.stimulusPlan, inheritedFrom: gone.id } : undefined
}

// ─── the balance, for the Researcher ────────────────────────────────────────

export type BalanceRow = { id: string; name: string; /** People holding a plan that has it. */ saw: number; /** People for whom it comes first. */ first: number; /** People who have actually been shown it. */ shown: number }
export type SegmentBalance = { segment: string; people: number; rows: BalanceRow[]; /** The most and the least any stimulus is seen by, when they differ by more than one. */ uneven?: { most: BalanceRow; least: BalanceRow }; /** The segment has fewer people than plans. */ unfilled?: string }

/** Per stimulus, per segment: who has it, who has it first, who has seen it. Null when the study doesn't split or rotate. */
export function balanceOf(plans: StimulusPlan[] | undefined, sessions: Session[], excluded: ReadonlySet<string> = new Set()): SegmentBalance[] | null {
  if (!plans || plans.length < 2) return null
  const stimuli = new Map<string, string>()
  plans.forEach((p) => p.order.forEach((id, i) => stimuli.set(id, p.names[i])))
  const segments = [...new Set([SEGMENT, ...sessions.filter((s) => counts(s, excluded) && live(s, plans)).map(segmentOf)])]
  return segments.map((segment) => {
    const mine = sessions.filter((s) => counts(s, excluded) && segmentOf(s) === segment && live(s, plans))
    const rows = [...stimuli.entries()].map(([id, name]): BalanceRow => ({
      id,
      name,
      saw: mine.filter((s) => s.stimulusPlan!.order.includes(id)).length,
      first: mine.filter((s) => s.stimulusPlan!.order[0] === id).length,
      shown: mine.filter((s) => s.stimuli.some((x) => x.name === name && x.result === 'Shown')).length,
    }))
    const most = rows.reduce((a, r) => (r.saw > a.saw ? r : a), rows[0])
    const least = rows.reduce((a, r) => (r.saw < a.saw ? r : a), rows[0])
    return {
      segment,
      people: mine.length,
      rows,
      uneven: most.saw - least.saw > 1 ? { most, least } : undefined,
      unfilled: mine.length < plans.length ? `${segment} has ${mine.length} ${mine.length === 1 ? 'person' : 'people'} for ${plans.length} plans, so not every plan can be used yet.` : undefined,
    }
  })
}
