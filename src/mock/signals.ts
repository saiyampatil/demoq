// Behavioural signals for Pet Food Subscription Churn, as the product would measure them from the recordings.
// Everything here is simulated and deterministic: the same moment always gives the same numbers.
//
// A signal is a fact about one moment, never a conclusion: how long the answer took to start, the longest pause, and
// how many fillers or restarts there were, each compared with the same person's own usual answer time. Facial analysis is on hold.

import { CODE_QUESTIONS, EXCERPTS, SEED_CODES, petOf, type Excerpt } from './codebook'
import { findReviewRecord } from './review'
import { PET_SEED_SESSIONS, sessionIdOf } from './sessions'

export { petOf }

/** Mock thresholds (docs/OPEN_QUESTIONS.md). A moment shows a sign of hesitation for each one it meets. */
export const SIGNAL_RULES = { delaySec: 2, delayRatio: 1.5, pauseSec: 1.5, fillers: 2 }

export type Band = 'Steady' | 'Some hesitation' | 'Marked hesitation'
export const BANDS: Band[] = ['Steady', 'Some hesitation', 'Marked hesitation']
export type Facts = { delaySec: number; pauseSec: number; fillers: number }
export type Sign = 'delay' | 'pause' | 'fillers'

// ─── who, and what is measured ──────────────────────────────────────────────

const SESSION_OF = new Map(PET_SEED_SESSIONS.filter((s) => s.variant === 'done').map((s) => [s.participant, sessionIdOf(s)]))
/** The accepted participants, in order. Their sessions are the only ones a signal is ever measured on. */
export const ACCEPTED_PARTICIPANTS = PET_SEED_SESSIONS.filter((s) => s.variant === 'done' && s.review?.status === 'Accepted').map((s) => s.participant)
export const sessionOfParticipant = (p: string) => SESSION_OF.get(p) ?? `${p}-1`

export type Moment = { id: string; label: string; text: string; kind: 'question' | 'stimulus'; fraction: number }

/** The key moments: each guide question the codes answer, and the first reaction to each concept. */
export const MOMENTS: Moment[] = ([
  ...CODE_QUESTIONS.map((q): Moment => ({ id: q.id, label: q.label, text: q.text, kind: 'question', fraction: q.fraction })),
  { id: 'm-concept-a', label: 'First reaction: Concept A, Pause, don’t cancel', text: 'Here is Concept A. Tell me your first reaction, before I say anything about it.', kind: 'stimulus', fraction: 0.5 },
  { id: 'm-concept-b', label: 'First reaction: Concept B, Recipe swap guarantee', text: 'Here is Concept B. Tell me your first reaction, before I say anything about it.', kind: 'stimulus', fraction: 0.54 },
  { id: 'm-concept-c', label: 'First reaction: Concept C, Portion-matched boxes', text: 'Here is Concept C. Tell me your first reaction, before I say anything about it.', kind: 'stimulus', fraction: 0.58 },
] as Moment[]).sort((a, b) => a.fraction - b.fraction)

/** Who hesitated at each concept's first reaction. The rest were steady. */
const REACTIONS: Record<string, { marked: string[]; some: string[] }> = {
  'm-concept-a': { marked: ['P-3104', 'P-3109', 'P-3113', 'P-3118', 'P-3101', 'P-3110', 'P-3120'], some: ['P-3121', 'P-3105', 'P-3114'] },
  'm-concept-b': { marked: ['P-3110', 'P-3120', 'P-3116'], some: ['P-3101', 'P-3108', 'P-3111', 'P-3102'] },
  'm-concept-c': { marked: ['P-3113', 'P-3118'], some: ['P-3102', 'P-3122', 'P-3103'] },
}
/** A failed concept card is treated as not seen (P-3106's Concept B), so there is no reaction to measure. */
const NOT_SEEN: Record<string, string[]> = { 'm-concept-b': ['P-3106'] }

// ─── numbers ────────────────────────────────────────────────────────────────

const r1 = (x: number) => Math.round(x * 10) / 10
/** A stable number from 0 up to 1 for any text, so the mock never changes between loads. */
function u(seed: string, k = 0) {
  let h = 2166136261
  for (const ch of `${seed}|${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) / 2 ** 32
}

/** How long this person usually takes to start an answer, in seconds. */
export const usualDelay = (participantId: string) => r1(0.9 + 0.8 * u(participantId, 9))

export function signsOf(f: Facts, usual: number): Sign[] {
  const out: Sign[] = []
  if (f.delaySec >= SIGNAL_RULES.delaySec && f.delaySec >= SIGNAL_RULES.delayRatio * usual) out.push('delay')
  if (f.pauseSec >= SIGNAL_RULES.pauseSec) out.push('pause')
  if (f.fillers >= SIGNAL_RULES.fillers) out.push('fillers')
  return out
}
export const bandOf = (f: Facts, usual: number): Band => (signsOf(f, usual).length === 0 ? 'Steady' : signsOf(f, usual).length === 1 ? 'Some hesitation' : 'Marked hesitation')
export const bandRank = (b: Band) => BANDS.indexOf(b)

/** In words, for the panel: what was measured, and why this band. Describes, never diagnoses. */
export function reasonOf(f: Facts, usual: number): string {
  const signs = signsOf(f, usual)
  if (!signs.length) return `The answer started ${f.delaySec} s after the question, in line with this person’s usual ${usual} s. No long pause, ${f.fillers === 0 ? 'no fillers' : `${f.fillers} filler`}.`
  const parts: string[] = []
  if (signs.includes('delay')) parts.push(`The answer started ${f.delaySec} s after the question, ${r1(f.delaySec / usual)}× this person’s usual ${usual} s`)
  else parts.push(`The answer started ${f.delaySec} s after the question, close to this person’s usual ${usual} s`)
  if (signs.includes('pause')) parts.push(`longest pause ${f.pauseSec} s`)
  if (signs.includes('fillers')) parts.push(`${f.fillers} fillers or restarts`)
  return `${parts.map((x) => x[0].toUpperCase() + x.slice(1)).join('. ')}.`
}

/** Facts that land exactly in the wanted band, drawn from a seed. */
function makeFacts(seed: string, band: Band, usual: number): Facts {
  const a = u(seed, 1)
  const b = u(seed, 2)
  const c = u(seed, 3)
  const calm: Facts = { delaySec: r1(usual * (0.8 + 0.5 * a)), pauseSec: r1(0.3 + 0.9 * b), fillers: c < 0.6 ? 0 : 1 }
  const long = r1(Math.max(SIGNAL_RULES.delaySec + 0.1, usual * (1.7 + 0.6 * b)))
  const pause = r1(1.5 + 0.8 * b)
  const fill = 2 + Math.floor(b * 2)
  if (band === 'Steady') return calm
  const kind = Math.floor(a * 3)
  if (band === 'Some hesitation') return kind === 0 ? { ...calm, delaySec: long } : kind === 1 ? { ...calm, pauseSec: pause } : { ...calm, fillers: fill }
  if (c > 0.85) return { delaySec: long, pauseSec: pause, fillers: fill }
  return kind === 0 ? { ...calm, delaySec: long, pauseSec: pause } : kind === 1 ? { ...calm, delaySec: long, fillers: fill } : { ...calm, pauseSec: pause, fillers: fill }
}

// ─── per code: how many said it with a sign of hesitation ───────────────────

/** [marked, some] among the people who said each code. Codes not listed are all steady. */
const PLAN: Record<string, [number, number]> = {
  'c-runout': [0, 1],
  'c-ingredients': [0, 1],
  'c-intro-discount': [0, 1],
  'c-price-rise': [1, 2],
  'c-piling-up': [2, 2],
  'c-bag-size': [1, 1],
  'c-pet-refused': [1, 1],
  'c-swap-hassle': [0, 1],
  'c-vet-diet': [0, 1],
  'c-hard-cancel': [1, 1],
  'c-skip-pause': [1, 2],
  'c-price-warning': [0, 1],
  'c-loyalty': [1, 1],
  'c-schedule-clash': [2, 1],
  'c-schedule-fine': [0, 1],
  'c-idea-pause': [4, 1],
  'c-idea-portion': [0, 1],
  'c-idea-swap': [1, 1],
  'c-swap-unclear': [2, 1],
  'c-flex-first': [4, 1],
  'c-price-first': [1, 0],
  'c-both': [1, 1],
  'c-stable-price': [0, 1],
  'c-control': [1, 1],
  'c-trust': [1, 0],
}

const EXCERPT_BAND = new Map<string, Band>()
SEED_CODES.forEach((code) => {
  const [marked, some] = PLAN[code.id] ?? [0, 0]
  const order = [...code.excerpts].sort((x, y) => u(`${code.id}${x}`) - u(`${code.id}${y}`))
  order.forEach((id, i) => EXCERPT_BAND.set(id, i < marked ? 'Marked hesitation' : i < marked + some ? 'Some hesitation' : 'Steady'))
  code.more.forEach((id) => EXCERPT_BAND.set(id, 'Steady'))
})

export type Point = {
  participantId: string
  sessionId: string
  pet: 'Dog' | 'Cat'
  atSec: number
  facts: Facts
  usual: number
  band: Band
  reason: string
  /** The coded quote at this moment, when there is one. */
  excerpt?: Excerpt
}

function point(participantId: string, atSec: number, facts: Facts, excerpt?: Excerpt): Point {
  const usual = usualDelay(participantId)
  return { participantId, sessionId: sessionOfParticipant(participantId), pet: petOf(participantId), atSec, facts, usual, band: bandOf(facts, usual), reason: reasonOf(facts, usual), ...(excerpt ? { excerpt } : {}) }
}

/** The signals at one coded quote. */
export function excerptPoint(excerptId: string): Point {
  const e = EXCERPTS[excerptId]
  const band = EXCERPT_BAND.get(excerptId) ?? 'Steady'
  return point(e.participantId, e.atSec, makeFacts(excerptId, band, usualDelay(e.participantId)), e)
}

const worst = (a: Point, b: Point) => (bandRank(b.band) > bandRank(a.band) ? b : a)

/** Everyone's signals at a key moment. A person's coded quotes there set it; otherwise it is drawn from how often people hesitate. */
export function momentPoints(momentId: string): Point[] {
  const m = MOMENTS.find((x) => x.id === momentId)!
  const skipped = new Set([...(CODE_QUESTIONS.find((q) => q.id === momentId)?.skipped.map((s) => s.participantId) ?? []), ...(NOT_SEEN[momentId] ?? [])])
  return ACCEPTED_PARTICIPANTS.filter((p) => !skipped.has(p)).map((p) => {
    const rec = findReviewRecord(sessionOfParticipant(p))
    const at = Math.round(m.fraction * (rec?.durationMin ?? 25) * 60)
    if (m.kind === 'stimulus') {
      const r = REACTIONS[m.id]
      const band: Band = r.marked.includes(p) ? 'Marked hesitation' : r.some.includes(p) ? 'Some hesitation' : 'Steady'
      return point(p, at, makeFacts(`${m.id}${p}`, band, usualDelay(p)))
    }
    const mine = Object.values(EXCERPTS)
      .filter((e) => e.participantId === p && e.questionId === m.id && SEED_CODES.some((c) => c.excerpts.includes(e.id)))
      .map((e) => excerptPoint(e.id))
    if (mine.length) return mine.reduce(worst)
    const x = u(`${m.id}${p}`)
    const band: Band = x < 0.08 ? 'Marked hesitation' : x < 0.25 ? 'Some hesitation' : 'Steady'
    return point(p, at, makeFacts(`${m.id}${p}`, band, usualDelay(p)))
  })
}

// ─── tensions: what the product would suggest ───────────────────────────────

export type TensionKind = 'Said vs behaviour' | 'Said vs survey' | 'Between segments' | 'Between concepts'
export const TENSION_KINDS: TensionKind[] = ['Said vs behaviour', 'Said vs survey', 'Between segments', 'Between concepts']

/** What the system suggests. The numbers on each are worked out from the data when the screen opens. */
export type TensionDef = { id: string; kind: TensionKind; title: string; summary: string; themeName: string; codeIds: string[] }

export const TENSION_DEFS: TensionDef[] = [
  {
    id: 'tn-pause-survey',
    kind: 'Said vs survey',
    title: 'Called the pause idea the one most likely to keep them, but some said they probably wouldn’t keep a subscription',
    summary: 'In the interview these people picked pause. In the locked survey right after seeing it, some chose a no.',
    themeName: 'Pause: said yes, answered no',
    codeIds: ['c-idea-pause'],
  },
  {
    id: 'tn-flex-behaviour',
    kind: 'Said vs behaviour',
    title: 'Said flexibility matters more than price, but hesitated as they said it',
    summary: 'The words were clear. In a number of the answers the delay, pause or fillers were not.',
    themeName: 'Flexibility: said, but not settled',
    codeIds: ['c-flex-first'],
  },
  {
    id: 'tn-pet-segments',
    kind: 'Between segments',
    title: 'Cat owners lean to flexibility; dog owners lean to price',
    summary: 'The same question, answered differently by the two groups. Directional: the groups are small.',
    themeName: 'Cats and flexibility, dogs and price',
    codeIds: ['c-flex-first', 'c-price-first'],
  },
  {
    id: 'tn-pause-concept',
    kind: 'Between concepts',
    title: 'Chose the pause idea in the end, but hesitated when first shown it',
    summary: 'The first reaction to Concept A and the later choice point in different directions for some people.',
    themeName: 'Pause: a slow first reaction',
    codeIds: ['c-idea-pause'],
  },
  {
    id: 'tn-vet-survey',
    kind: 'Said vs survey',
    title: 'Said a vet’s advice ended it, but named price in the survey',
    summary: 'In conversation a vet recommendation ended it for these people. In the survey one named something else.',
    themeName: 'Vet advice or price',
    codeIds: ['c-vet-diet'],
  },
]
