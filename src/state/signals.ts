// Signals & tensions (Results Analysis, step 2). Worked out from the codebook and Review every time, never stored:
// a count is always "n of M" over the sessions accepted right now. Only the Researcher's decisions are kept (state/codebook.ts).

import { findReviewRecord } from '@/mock/review'
import {
  ACCEPTED_PARTICIPANTS,
  BANDS,
  MOMENTS,
  TENSION_DEFS,
  bandRank,
  excerptPoint,
  momentPoints,
  petOf,
  sessionOfParticipant,
  type Band,
  type Moment,
  type Point,
  type TensionDef,
} from '@/mock/signals'
import { codeThemes, denominator, peopleOf, tensionDecisions, themeCodes, type Basis, type Code, type CodebookDoc, type TensionDecision, type Theme } from './codebook'

export { BANDS, MOMENTS, TENSION_KINDS, type Band, type Moment, type Point, type TensionKind } from '@/mock/signals'
export { SIGNAL_RULES, signsOf } from '@/mock/signals'
export { petOf } from '@/mock/signals'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export { plural }

// ─── by code ────────────────────────────────────────────────────────────────

export type Pattern = 'Mostly steady' | 'Mixed' | 'Often hesitant' | 'Too few to read'
/** Too few people say a code to read a pattern from it. */
export const MIN_PEOPLE = 3

export function patternOf(marked: number, people: number): Pattern {
  if (people < MIN_PEOPLE) return 'Too few to read'
  const share = marked / people
  return share < 0.25 ? 'Mostly steady' : share < 0.6 ? 'Mixed' : 'Often hesitant'
}

export type CodeSignal = {
  code: Code
  people: number
  of: number
  marked: number
  some: number
  steady: number
  pattern: Pattern
  /** A pattern worth a look: mixed or often hesitant. These go into the report unless switched off. */
  notable: boolean
  use: boolean
  /** One point per person, the most hesitant first. A person with several quotes counts once, at their most hesitant. */
  points: Point[]
}

const worse = (a: Point, b: Point) => (bandRank(b.band) > bandRank(a.band) ? b : a)

/** The signals on every accepted code. Only quotes from sessions accepted right now count. */
export function codeSignals(doc: CodebookDoc, basis: Basis): CodeSignal[] {
  return doc.codes
    .filter((c) => c.status === 'Accepted')
    .map((code) => {
      const byPerson = new Map<string, Point>()
      code.excerpts
        .map((id) => excerptPoint(id))
        .filter((p) => basis.sessions.has(p.sessionId))
        .forEach((p) => byPerson.set(p.participantId, byPerson.has(p.participantId) ? worse(byPerson.get(p.participantId)!, p) : p))
      const points = [...byPerson.values()].sort((a, b) => bandRank(b.band) - bandRank(a.band) || a.participantId.localeCompare(b.participantId))
      const marked = points.filter((p) => p.band === 'Marked hesitation').length
      const some = points.filter((p) => p.band === 'Some hesitation').length
      const pattern = patternOf(marked, points.length)
      const notable = pattern === 'Mixed' || pattern === 'Often hesitant'
      return { code, people: points.length, of: denominator(code, basis), marked, some, steady: points.length - marked - some, pattern, notable, use: doc.signalPicks?.[code.id] ?? notable, points }
    })
}

/** Signals grouped under the themes built from codes, then whatever is not in a theme. */
export function signalGroups(doc: CodebookDoc, signals: CodeSignal[]): { id: string; name: string; theme?: Theme; rows: CodeSignal[] }[] {
  const placed = new Set<string>()
  const groups = codeThemes(doc).map((theme) => {
    const ids = new Set(themeCodes(doc, theme).map((c) => c.id))
    const rows = signals.filter((s) => ids.has(s.code.id))
    rows.forEach((r) => placed.add(r.code.id))
    return { id: theme.id, name: theme.name, theme, rows }
  })
  const rest = signals.filter((s) => !placed.has(s.code.id))
  return [...groups, { id: 'none', name: 'Not in a theme', rows: rest }].filter((g) => g.rows.length)
}

// ─── by moment ──────────────────────────────────────────────────────────────

export type Split = { counts: Record<Band, number>; n: number }
export type MomentSignal = { moment: Moment; all: Split; dog: Split; cat: Split; points: Point[] }

const split = (points: Point[]): Split => ({ counts: Object.fromEntries(BANDS.map((b) => [b, points.filter((p) => p.band === b).length])) as Record<Band, number>, n: points.length })

export function momentSignals(basis: Basis): MomentSignal[] {
  return MOMENTS.map((moment) => {
    const points = momentPoints(moment.id).filter((p) => basis.sessions.has(p.sessionId))
    return { moment, all: split(points), dog: split(points.filter((p) => p.pet === 'Dog')), cat: split(points.filter((p) => p.pet === 'Cat')), points: [...points].sort((a, b) => bandRank(b.band) - bandRank(a.band) || a.participantId.localeCompare(b.participantId)) }
  })
}

/** Below this many people a group is too small to read. */
export const SMALL_GROUP = 5

// ─── coverage ───────────────────────────────────────────────────────────────

export type Coverage = { sessions: number; video: number; audioOnly: number; excluded: number }
export function coverage(accepted: { media?: 'Video' | 'Audio only' }[], excluded: number): Coverage {
  const video = accepted.filter((a) => (a.media ?? 'Video') === 'Video').length
  return { sessions: accepted.length, video, audioOnly: accepted.length - video, excluded }
}

// ─── tensions ───────────────────────────────────────────────────────────────

export type TensionStatus = 'Suggested' | 'Turned into a theme' | 'Dismissed'
/** One side of a tension, in n of N. */
export type Side = { label: string; n: number; of: number; note?: string }
export type Clip = { participantId: string; sessionId: string; atSec: number; quote?: string; note: string }
export type Tension = TensionDef & {
  status: TensionStatus
  decision?: TensionDecision
  sides: Side[]
  clips: Clip[]
  /** Why it can't be reviewed right now, e.g. a code is no longer accepted. */
  unavailable?: string
  /** A caution to show beside the evidence. */
  caution?: string
}

const NEGATIVE = new Set(['Probably would not', 'Definitely would not'])

function surveyAnswer(participantId: string, survey: string, question: RegExp): string | undefined {
  return findReviewRecord(sessionOfParticipant(participantId))?.survey.find((q) => q.survey === survey && question.test(q.question))?.answer
}

const quoteOf = (p: Point) => p.excerpt?.text

/** Everything the screen shows for a tension, from the data as it stands. */
function evidence(def: TensionDef, doc: CodebookDoc, basis: Basis): Pick<Tension, 'sides' | 'clips' | 'caution'> {
  const code = (id: string) => doc.codes.find((c) => c.id === id)!
  const people = (id: string) => [...peopleOf(code(id), basis)].sort()
  const N = basis.participants.size

  if (def.id === 'tn-pause-survey') {
    const chose = people('c-idea-pause')
    const no = chose.filter((p) => NEGATIVE.has(surveyAnswer(p, 'Retention idea reaction', /how likely/i) ?? ''))
    return {
      sides: [
        { label: 'Picked pause as most likely to keep them', n: chose.length, of: N },
        { label: 'Of those, answered “probably” or “definitely would not” in the locked survey', n: no.length, of: chose.length },
      ],
      clips: no.map((p) => ({ participantId: p, sessionId: sessionOfParticipant(p), atSec: excerptPoint(code('c-idea-pause').excerpts.find((e) => e.includes(p))!).atSec, quote: excerptPoint(code('c-idea-pause').excerpts.find((e) => e.includes(p))!).excerpt?.text, note: `Locked survey answer: ${surveyAnswer(p, 'Retention idea reaction', /how likely/i)}` })),
      caution: no.length < 3 ? 'Only a few people. Read it as a prompt to look, not a result.' : undefined,
    }
  }
  if (def.id === 'tn-flex-behaviour') {
    const sig = codeSignals(doc, basis).find((s) => s.code.id === 'c-flex-first')
    const hes = (sig?.points ?? []).filter((p) => p.band === 'Marked hesitation')
    return {
      sides: [
        { label: 'Said flexibility matters more than price', n: sig?.people ?? 0, of: N },
        { label: 'Marked hesitation as they said it', n: hes.length, of: sig?.people ?? 0, note: 'Two or more of a long delay, a long pause, or fillers' },
      ],
      clips: hes.map((p) => ({ participantId: p.participantId, sessionId: p.sessionId, atSec: p.atSec, quote: quoteOf(p), note: p.reason })),
    }
  }
  if (def.id === 'tn-pet-segments') {
    const pet = (p: string) => petOf(p)
    const group = (g: 'Cat' | 'Dog') => [...basis.participants].filter((p) => pet(p) === g)
    const said = (id: string, g: 'Cat' | 'Dog') => people(id).filter((p) => pet(p) === g).length
    const cats = group('Cat').length
    const dogs = group('Dog').length
    return {
      sides: [
        { label: 'Cat owners said flexibility matters more', n: said('c-flex-first', 'Cat'), of: cats },
        { label: 'Cat owners said price matters more', n: said('c-price-first', 'Cat'), of: cats },
        { label: 'Dog owners said flexibility matters more', n: said('c-flex-first', 'Dog'), of: dogs },
        { label: 'Dog owners said price matters more', n: said('c-price-first', 'Dog'), of: dogs },
      ],
      clips: [...people('c-flex-first').filter((p) => pet(p) === 'Cat').slice(0, 2), ...people('c-price-first').filter((p) => pet(p) === 'Dog').slice(0, 2)].map((p) => {
        const flex = people('c-flex-first').includes(p)
        const ex = excerptPoint(code(flex ? 'c-flex-first' : 'c-price-first').excerpts.find((e) => e.includes(p))!)
        return { participantId: p, sessionId: ex.sessionId, atSec: ex.atSec, quote: ex.excerpt?.text, note: `${pet(p)} owner, said ${flex ? 'flexibility' : 'price'} matters more` }
      }),
      caution: `Directional. ${Math.min(cats, dogs)} to ${Math.max(cats, dogs)} people a group.${Math.min(cats, dogs) < SMALL_GROUP ? ' One group is too small to read.' : ''}`,
    }
  }
  if (def.id === 'tn-pause-concept') {
    const chose = people('c-idea-pause')
    const a = momentPoints('m-concept-a').filter((p) => basis.sessions.has(p.sessionId))
    const slow = chose.map((p) => a.find((x) => x.participantId === p)).filter((p): p is Point => !!p && p.band === 'Marked hesitation')
    return {
      sides: [
        { label: 'Chose pause in the comparison', n: chose.length, of: N },
        { label: 'Of those, marked hesitation at first sight of Concept A', n: slow.length, of: chose.length },
      ],
      clips: slow.map((p) => ({ participantId: p.participantId, sessionId: p.sessionId, atSec: p.atSec, note: p.reason })),
    }
  }
  // tn-vet-survey
  const vet = people('c-vet-diet')
  const other = vet.filter((p) => !/vet or store brand/i.test(surveyAnswer(p, 'Why they cancelled', /one reason/i) ?? ''))
  return {
    sides: [
      { label: 'Said a vet’s advice ended it', n: vet.length, of: N },
      { label: 'Of those, named something else as the one biggest reason in the survey', n: other.length, of: vet.length },
    ],
    clips: other.map((p) => {
      const ex = excerptPoint(code('c-vet-diet').excerpts.find((e) => e.includes(p))!)
      return { participantId: p, sessionId: ex.sessionId, atSec: ex.atSec, quote: ex.excerpt?.text, note: `Locked survey answer: ${surveyAnswer(p, 'Why they cancelled', /one reason/i)}` }
    }),
    caution: 'Only a few people. Read it as a prompt to look, not a result.',
  }
}

/** The tensions PulseAI suggests, with their evidence and where each one stands. */
export function tensionsOf(doc: CodebookDoc, basis: Basis): Tension[] {
  const decisions = tensionDecisions(doc)
  return TENSION_DEFS.map((def) => {
    const missing = def.codeIds.map((id) => doc.codes.find((c) => c.id === id)).filter((c): c is Code => !c || c.status !== 'Accepted')
    const decision = decisions[def.id]
    const status: TensionStatus = decision ? decision.status : 'Suggested'
    const unavailable = missing.length && !decision ? `Accept ${missing.map((c) => `“${c?.name}”`).join(' and ')} in the codebook to review this.` : undefined
    return { ...def, status, decision, unavailable, ...(unavailable ? { sides: [], clips: [] } : evidence(def, doc, basis)) }
  })
}

/** How the tensions stand, from the codebook alone: used by the stepper, which has no Review data. */
export function tensionCounts(doc: CodebookDoc) {
  const decisions = tensionDecisions(doc)
  const available = TENSION_DEFS.filter((d) => d.codeIds.every((id) => doc.codes.find((c) => c.id === id)?.status === 'Accepted') || decisions[d.id])
  const decided = available.filter((d) => decisions[d.id]).length
  return {
    total: available.length,
    toReview: available.length - decided,
    themes: available.filter((d) => decisions[d.id]?.status === 'Turned into a theme').length,
    dismissed: available.filter((d) => decisions[d.id]?.status === 'Dismissed').length,
  }
}

export { ACCEPTED_PARTICIPANTS }
