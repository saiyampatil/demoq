// Emotion & behaviour (Results Analysis, step 2): signals and tensions. Worked out from the codebook and Review every time,
// never stored: a count is always "n of M" over the sessions accepted right now. Only the Researcher's decisions are kept
// (state/codebook.ts). Emotion and voice rules live in state/emotion.ts.

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
import { askedOf, codeThemes, denominator, peopleOf, tensionDecisions, themeCodes, unthemed, type Basis, type Code, type CodebookDoc, type TensionDecision, type Theme } from './codebook'
import { emotionSplit, faceOf, fitOf, fitSplit, hasVideo, noReading, toneSplit, FIT_RULE_TEXT, STANCE_LABEL, VALENCE, type Emotion, type EmotionSplit, type FitPattern, type FitSplit, type Stance, type ToneSplit } from './emotion'

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
  /** Faces among the same people, one moment each. */
  emotions: EmotionSplit
  tones: ToneSplit
  /** Whether how they said it fits what the words claim. */
  fit: FitSplit
  /** A pattern worth a look: hesitation that is mixed or often, or words and delivery that don't fit. These go into the report unless switched off. */
  notable: boolean
  /** Enough people to read a pattern. Below that, nothing about this code can go into the report. */
  readable: boolean
  use: boolean
  /** One point per person, the most hesitant first. A person with several quotes counts once, at their most hesitant. */
  points: Point[]
}

const worse = (a: Point, b: Point) => (bandRank(b.band) > bandRank(a.band) ? b : a)

/** The signals on every accepted code. Only quotes from sessions accepted right now count. */
export function codeSignals(doc: CodebookDoc, basis: Basis): CodeSignal[] {
  // A code inside a theme goes into the report through its theme's tick. Its own tick only counts when the Researcher set one
  // (older data), so the same signal is never in the report twice.
  const themed = new Set(codeThemes(doc).flatMap((t) => themeCodes(doc, t).map((c) => c.id)))
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
      const fit = fitSplit(points, doc)
      const readable = points.length >= MIN_PEOPLE
      const notable = readable && (pattern === 'Mixed' || pattern === 'Often hesitant' || fit.pattern === 'Mixed' || fit.pattern === 'Conflicting')
      return {
        code,
        people: points.length,
        of: denominator(code, basis),
        marked,
        some,
        steady: points.length - marked - some,
        pattern,
        emotions: emotionSplit(points, doc),
        tones: toneSplit(points),
        fit,
        notable,
        readable,
        use: readable && (doc.signalPicks?.[code.id] ?? (themed.has(code.id) ? false : notable)),
        points,
      }
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
export type MomentSignal = { moment: Moment; all: Split; dog: Split; cat: Split; emotions: { all: EmotionSplit; dog: EmotionSplit; cat: EmotionSplit }; tones: ToneSplit; points: Point[] }

const split = (points: Point[]): Split => ({ counts: Object.fromEntries(BANDS.map((b) => [b, points.filter((p) => p.band === b).length])) as Record<Band, number>, n: points.length })

export function momentSignals(basis: Basis, doc: CodebookDoc): MomentSignal[] {
  return MOMENTS.map((moment) => {
    const points = momentPoints(moment.id).filter((p) => basis.sessions.has(p.sessionId))
    const dog = points.filter((p) => p.pet === 'Dog')
    const cat = points.filter((p) => p.pet === 'Cat')
    return {
      moment,
      all: split(points),
      dog: split(dog),
      cat: split(cat),
      emotions: { all: emotionSplit(points, doc), dog: emotionSplit(dog, doc), cat: emotionSplit(cat, doc) },
      tones: toneSplit(points),
      points: [...points].sort((a, b) => bandRank(b.band) - bandRank(a.band) || a.participantId.localeCompare(b.participantId)),
    }
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

export type TensionStatus = 'Suggested' | 'Added as a tension theme' | 'Dismissed'
/** One side of a tension, in n of N. */
export type Side = { label: string; n: number; of: number; note?: string }
/** A face reading shown on a clip: where it was read, what was seen (the lead), and what it reads as (after any correction). */
export type ClipFace = { where: string; cue: string; atSec: number; onsetSec: number; emotion: Emotion | null; intensity: string; corrected: boolean }
export type Clip = { participantId: string; sessionId: string; atSec: number; quote?: string; note: string; faces?: ClipFace[] }
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

/** The face at a point, ready for a clip. Nothing when there is no video. */
function clipFace(p: Point | undefined, doc: CodebookDoc, where: string): ClipFace[] {
  const f = p ? faceOf(p, doc) : undefined
  return f && p ? [{ where, cue: f.reading.cue, atSec: p.atSec, onsetSec: f.reading.onsetSec, emotion: f.emotion, intensity: f.reading.intensity, corrected: !!f.fix }] : []
}
const WARM = new Set<Emotion>(['Delight', 'Interest'])

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
      clips: hes.map((p) => ({ participantId: p.participantId, sessionId: p.sessionId, atSec: p.atSec, quote: quoteOf(p), note: p.reason, faces: clipFace(p, doc, 'As they said it') })),
    }
  }
  if (def.id === 'tn-pause-portion-face') {
    const chose = people('c-idea-pause')
    const onVideo = chose.filter(hasVideo)
    const atC = momentPoints('m-concept-c').filter((p) => basis.sessions.has(p.sessionId))
    const atA = momentPoints('m-concept-a').filter((p) => basis.sessions.has(p.sessionId))
    const warm = onVideo.filter((p) => {
      const pt = atC.find((x) => x.participantId === p)
      const f = pt ? faceOf(pt, doc) : undefined
      return !!f?.emotion && WARM.has(f.emotion)
    })
    const audioOnly = chose.length - onVideo.length
    return {
      sides: [
        { label: 'Picked pause as most likely to keep them, and were on video', n: onVideo.length, of: chose.length, note: audioOnly ? `${audioOnly} audio-only, so no face reading` : undefined },
        { label: 'Of those, delight or interest at first sight of Concept C, portion-matched boxes', n: warm.length, of: onVideo.length },
      ],
      clips: onVideo.map((p) => {
        const c = atC.find((x) => x.participantId === p)
        const ex = excerptPoint(code('c-idea-pause').excerpts.find((e) => e.includes(p))!)
        return {
          participantId: p,
          sessionId: ex.sessionId,
          // Play lands on the quoted answer. Each face below carries its own time, at the concept it was read on.
          atSec: ex.atSec,
          quote: ex.excerpt?.text,
          note: 'Their words when asked which idea would keep them. The faces were read in the first five seconds of each concept.',
          faces: [...clipFace(atA.find((x) => x.participantId === p), doc, 'Concept A, pause'), ...clipFace(c, doc, 'Concept C, portions')],
        }
      }),
      caution: onVideo.length < SMALL_GROUP ? 'Only a few people on video. Read it as a prompt to look, not a result.' : undefined,
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
      clips: slow.map((p) => ({ participantId: p.participantId, sessionId: p.sessionId, atSec: p.atSec, note: p.reason, faces: clipFace(p, doc, 'First sight of Concept A') })),
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
    themes: available.filter((d) => decisions[d.id]?.status === 'Added as a tension theme').length,
    dismissed: available.filter((d) => decisions[d.id]?.status === 'Dismissed').length,
  }
}

export { ACCEPTED_PARTICIPANTS }

/**
 * What a theme made from a tension counts: the tension's own finding (the "of those" side), not everyone who said its
 * codes. Undefined for a comparison between groups, which has no single number.
 */
export function tensionHeadline(doc: CodebookDoc, basis: Basis, tensionId: string): Side | undefined {
  const t = tensionsOf(doc, basis).find((x) => x.id === tensionId)
  if (!t || t.unavailable || t.kind === 'Between segments') return undefined
  return t.sides[t.sides.length - 1]
}

// ─── a theme, rolled up ─────────────────────────────────────────────────────

/** One line per theme across its codes, each person once (at their most hesitant moment): the founder brief's "Theme is verbally positive but…". */
export type ThemeRollup = { people: number; emotions: EmotionSplit; marked: number; fit: FitSplit; positiveClaim: boolean; unsettled: number; text: string; highlight?: string }

export function themeRollup(doc: CodebookDoc, rows: CodeSignal[]): ThemeRollup | undefined {
  if (!rows.length) return undefined
  const dedupe = (rs: CodeSignal[]) => {
    const byPerson = new Map<string, Point>()
    rs.flatMap((r) => r.points).forEach((p) => byPerson.set(p.participantId, byPerson.has(p.participantId) ? worse(byPerson.get(p.participantId)!, p) : p))
    return [...byPerson.values()]
  }
  const points = dedupe(rows)
  const emotions = emotionSplit(points, doc)
  const marked = points.filter((p) => p.band === 'Marked hesitation').length
  const fit = fitSplit(points, doc)
  // The warning only counts people who spoke positively: someone complaining with a frown is consistent, not a warning sign.
  const speakers = dedupe(rows.filter((r) => r.points[0]?.stance === 'Positive'))
  const positiveClaim = speakers.length >= MIN_PEOPLE && speakers.length * 2 >= points.length
  const unsettled = speakers.filter((p) => {
    const f = faceOf(p, doc)
    return p.band === 'Marked hesitation' || (!!f?.emotion && VALENCE[f.emotion] === 'Negative')
  }).length
  const v = emotions.valence
  const n = points.length
  const gap = [emotions.noVideo ? `${emotions.noVideo} audio-only` : '', emotions.unclear ? `${emotions.unclear} marked no clear expression` : ''].filter(Boolean).join(', ')
  const faces = emotions.read ? `Faces read for ${emotions.read} of ${n}${gap ? ` (${gap})` : ''}: ${v.Positive} positive, ${v.Neutral} neutral, ${v.Negative} negative, ${v.Unclear} unclear.` : `No faces read (${gap || 'no video'}).`
  const text = `${n} ${n === 1 ? 'person' : 'people'}. ${faces} Marked hesitation in ${marked} of ${n}.`
  // Every number in the warning traces back: who spoke for it, who in the theme did not, and how each of the unsettled was seen.
  const onFace = speakers.filter((p) => {
    const f = faceOf(p, doc)
    return !!f?.emotion && VALENCE[f.emotion] === 'Negative'
  }).length
  const speakerIds = new Set(speakers.map((p) => p.participantId))
  const others = points.filter((p) => !speakerIds.has(p.participantId))
  const noVideoSpeakers = speakers.filter((p) => !faceOf(p, doc)).length
  const highlight =
    positiveClaim && unsettled / speakers.length >= 0.3
      ? `Of the ${speakers.length} who spoke for it, ${unsettled} showed doubt or frustration on their face (${onFace}) or marked hesitation without it (${unsettled - onFace}).` +
        (others.length ? ` The other ${others.length === 1 ? 'person' : `${others.length} people`} in this theme (${others.map((p) => p.participantId).join(', ')}) only stated a fact or complained, so there is no positive claim to check.` : '') +
        (noVideoSpeakers ? ` ${noVideoSpeakers} of the ${speakers.length} ${noVideoSpeakers === 1 ? 'is' : 'are'} audio-only, so ${noVideoSpeakers === 1 ? 'is' : 'are'} read on hesitation alone.` : '')
      : undefined
  return { people: points.length, emotions, marked, fit, positiveClaim, unsettled, text, highlight }
}

// ─── by theme: the profile of a theme ───────────────────────────────────────

/** How many of the people with a claim had each channel against the words, for one side of the words. */
export type StanceGap = { n: number; Hesitation: number; Face: number; Voice: number; noVideo: number }

/**
 * One theme's people, rolled up with the same rules as a code. Each person counts once, at the quote where their
 * delivery fit their words least (then where they hesitated most), so every channel is read on the same people.
 */
export type Rollup = {
  people: number
  points: Point[]
  emotions: EmotionSplit
  tones: ToneSplit
  marked: number
  some: number
  steady: number
  pattern: Pattern
  /** The words-vs-delivery split over the people with a claim, by the one rule (FIT_RULE). */
  fit: FitSplit
  /** The verdict: the fit pattern, or "Too few to read" under MIN_PEOPLE people. */
  verdict: FitPattern
  /** People by what their words claim: speaks for it, complains, or states a fact. */
  stances: Record<Stance, number>
  positive: StanceGap
  negative: StanceGap
}

const FIT_RANK = { Fits: 1, Partly: 2, 'Doesn’t fit': 3 } as const
const emptyGap = (): StanceGap => ({ n: 0, Hesitation: 0, Face: 0, Voice: 0, noVideo: 0 })

/** One point per person: where their delivery fit their words least, then where they hesitated most. */
export function onePerPerson(points: Point[], doc: CodebookDoc): Point[] {
  const score = (p: Point) => {
    const f = fitOf(p, faceOf(p, doc)).fit
    return (f ? FIT_RANK[f] : 0) * 10 + bandRank(p.band)
  }
  const byPerson = new Map<string, Point>()
  points.forEach((p) => {
    const cur = byPerson.get(p.participantId)
    if (!cur || score(p) > score(cur)) byPerson.set(p.participantId, p)
  })
  return [...byPerson.values()].sort((a, b) => score(b) - score(a) || a.participantId.localeCompare(b.participantId))
}

/** The roll-up of a set of people's points. Pure: the same points and corrections always give the same profile. */
export function rollupPoints(all: Point[], doc: CodebookDoc): Rollup {
  const points = onePerPerson(all, doc)
  const marked = points.filter((p) => p.band === 'Marked hesitation').length
  const some = points.filter((p) => p.band === 'Some hesitation').length
  const fit = fitSplit(points, doc)
  const stances: Record<Stance, number> = { Positive: 0, Negative: 0, Neutral: 0 }
  const positive = emptyGap()
  const negative = emptyGap()
  points.forEach((p) => {
    const stance = p.stance ?? 'Neutral'
    stances[stance]++
    if (stance === 'Neutral') return
    const g = stance === 'Positive' ? positive : negative
    const face = faceOf(p, doc)
    const { against } = fitOf(p, face)
    g.n++
    if (!face) g.noVideo++
    against.forEach((c) => g[c]++)
  })
  return {
    people: points.length,
    points,
    emotions: emotionSplit(points, doc),
    tones: toneSplit(points),
    marked,
    some,
    steady: points.length - marked - some,
    pattern: patternOf(marked, points.length),
    fit,
    verdict: points.length < MIN_PEOPLE ? 'Too few to read' : fit.pattern,
    stances,
    positive,
    negative,
  }
}

/** The rule for a theme's verdict, in one line for the screen. It is the per-code rule, applied to the theme's people. */
export const THEME_RULE_TEXT = `Each person counts once, at the quote where their delivery fit their words least. ${FIT_RULE_TEXT}`

/** What the words claim across a theme's people, from the same per-code stance the Words row uses. */
export function stanceSummary(r: Pick<Rollup, 'stances'>): { short: string; long: string } {
  const { Positive: pos, Negative: neg, Neutral: neu } = r.stances
  const kinds = [pos && 'Positive', neg && 'Negative', neu && 'Neutral'].filter(Boolean) as Stance[]
  if (kinds.length === 0) return { short: '—', long: 'No one said it' }
  if (kinds.length === 1) return { short: kinds[0] === 'Positive' ? 'Speaks for it' : kinds[0] === 'Negative' ? 'Complains' : 'States a fact', long: STANCE_LABEL[kinds[0]] }
  const parts = [pos && `${pos} speak for it`, neg && `${neg} complain`, neu && `${neu} state a fact or preference`].filter(Boolean)
  return { short: 'Mixed words', long: `Mixed: ${parts.join(', ')}` }
}

/** What the people did against their words, as a phrase that follows "people argued for it, but" or "also". */
const AGAINST: Record<'positive' | 'negative', Partial<Record<'Hesitation' | 'Face' | 'Voice', string>>> = {
  positive: { Hesitation: 'hesitated as they said it', Face: 'had faces that read as doubt or frustration', Voice: 'sounded flat or tense' },
  negative: { Face: 'had faces that read as delight or interest as they said it' },
}

/** The gap, named in plain words and counted in people: "4 of 7 people argued for it, but hesitated as they said it." */
function gapSentence(g: StanceGap, kind: 'positive' | 'negative', lead: 'but' | 'still', short = false): string {
  if (!g.n) return ''
  const clauses = (['Hesitation', 'Face', 'Voice'] as const)
    .map((c) => ({ k: g[c], c, text: AGAINST[kind][c] }))
    .filter((x): x is { k: number; c: 'Hesitation' | 'Face' | 'Voice'; text: string } => x.k > 0 && !!x.text)
    .sort((a, b) => b.k - a.k)
  if (!clauses.length) return ''
  const verb = kind === 'positive' ? 'argued for it' : 'complained about it'
  const [first, ...more0] = short ? [clauses[0]] : clauses
  const rest = more0
  const head = lead === 'but' ? `${first.k} of ${g.n} people ${verb}, but ${first.text}` : `Still, ${first.k} of ${g.n} ${g.n === 1 ? 'person' : 'people'} who ${verb} ${first.text}`
  const more = rest.map((x) => `; ${x.k} of ${g.n} also ${x.text}`).join('')
  const seen = !short && clauses.some((x) => x.c === 'Face') && g.noVideo ? ` (faces were read for ${g.n - g.noVideo} of ${g.n}; ${g.noVideo} audio-only)` : ''
  return `${head}${more}${seen}.`
}

/** The headline for a theme, built only from its numbers. Names the gap in plain words, or says delivery matched. */
/** `short` keeps only the lead: what a row shows. The full sentence, with every channel and who was left out, is the panel's. */
export function headlineOf(r: Rollup, short = false): string {
  if (r.verdict === 'Too few to read') return `Only ${plural(r.people, 'person', 'people')} said this, too few to read a pattern.`
  if (r.fit.n === 0) return 'These words state a fact or a preference, so there is no claim for the face, voice or hesitation to disagree with.'
  const gaps = [gapSentence(r.positive, 'positive', r.verdict === 'Consistent' ? 'still' : 'but', short), gapSentence(r.negative, 'negative', r.verdict === 'Consistent' ? 'still' : 'but', short)].filter(Boolean)
  if (r.verdict === 'Consistent' || r.verdict === 'No claim') return [`Delivery matched the words for ${r.fit.fits} of ${r.fit.n} people.`, ...(short ? [] : gaps)].join(' ')
  return gaps.length ? gaps.join(' ') : `Delivery pulled against the words for ${r.fit.partly + r.fit.doesnt} of ${r.fit.n} people.`
}

export type ThemeSignal = Rollup & {
  /** The theme's id, "none" for codes in no theme. */
  id: string
  name: string
  definition?: string
  kind: 'theme' | 'none' | 'tension'
  theme?: Theme
  /** The accepted codes in it, each with its own signals and verdict. */
  codes: CodeSignal[]
  /** People asked at least one of its questions: the N under "said by". */
  of: number
  notAsked: number
  headline: string
  /** The headline's lead only, for a row. */
  summary: string
  /** Where each number comes from and who is left out, so the lines add up. */
  trace: string
  readable: boolean
  notable: boolean
  /** Whether its profile goes into the report. Tension themes and "Not in a theme" are not ticked as a theme. */
  use: boolean
  tickable: boolean
  /** The moment that best shows the gap, or the first one when there is none. Play opens it. */
  play?: Point
}

function profile(base: { id: string; name: string; definition?: string; kind: ThemeSignal['kind']; theme?: Theme }, rows: CodeSignal[], doc: CodebookDoc, basis: Basis): ThemeSignal {
  const r = rollupPoints(rows.flatMap((x) => x.points), doc)
  const asked = new Set(rows.flatMap((x) => [...askedOf(x.code, basis)]))
  const of = asked.size
  const readable = r.people >= MIN_PEOPLE
  const notable = readable && (r.pattern === 'Mixed' || r.pattern === 'Often hesitant' || r.verdict === 'Mixed' || r.verdict === 'Conflicting')
  const tickable = base.kind === 'theme'
  const gap = r.emotions
  const trace = [
    `${r.people} of ${of} said it${basis.participants.size - of ? ` (${basis.participants.size - of} weren’t asked)` : ''}`,
    `faces read for ${gap.read} of ${r.people}${noReading(gap) ? ` (${noReading(gap)})` : ''}`,
    `${r.fit.n} of ${r.people} spoke for or against it${r.people - r.fit.n ? `, ${r.people - r.fit.n} only stated a fact or preference` : ''}`,
  ].join('; ')
  return {
    ...r,
    ...base,
    codes: rows,
    of,
    notAsked: basis.participants.size - of,
    headline: headlineOf(r),
    summary: headlineOf(r, true),
    trace: `${trace[0].toUpperCase()}${trace.slice(1)}.`,
    readable,
    notable,
    tickable,
    use: tickable && readable && (doc.themePicks?.[base.id] ?? notable),
    play: r.points[0],
  }
}

/**
 * Every accepted theme with its signals as one result: code themes, then the codes in no theme, then tension themes.
 * Worked out from the codebook and Review every time. Only the Researcher's ticks are stored (doc.themePicks).
 */
export function themeSignals(doc: CodebookDoc, basis: Basis, signals: CodeSignal[] = codeSignals(doc, basis)): ThemeSignal[] {
  const rowsOf = (codes: { id: string }[]) => {
    const ids = new Set(codes.map((c) => c.id))
    return signals.filter((s) => ids.has(s.code.id))
  }
  const own = codeThemes(doc)
    .filter((t) => themeCodes(doc, t).length > 0)
    .map((t) => profile({ id: t.id, name: t.name, definition: t.definition, kind: 'theme', theme: t }, rowsOf(themeCodes(doc, t)), doc, basis))
  const loose = rowsOf(unthemed(doc))
  const none = loose.length ? [profile({ id: 'none', name: 'Not in a theme', definition: 'Accepted codes that are not in a theme yet.', kind: 'none' }, loose, doc, basis)] : []
  const tension = doc.themes
    .filter((t) => t.tensionId)
    .map((t) => profile({ id: t.id, name: t.name, definition: t.definition, kind: 'tension', theme: t }, rowsOf(themeCodes(doc, t)), doc, basis))
  return [...own, ...none, ...tension]
}

// ─── what stands out ────────────────────────────────────────────────────────

/** A pattern written as a sentence, with where to see it. The first thing the Researcher reads. */
export type Standout = { id: string; kind: 'code' | 'moment' | 'tensions'; lens: 'hesitation' | 'emotion' | 'fit'; target?: string; lead: string; detail: string }

/** A moment's name without the "First reaction:" lead, for lists. */
export const shortMoment = (m: Moment) => m.label.replace(/^First reaction: /, '')
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n)

/** What the people who were asked a moment's question show. A moment needs this many people before it can lead a list. */
const LEADER_MIN_PEOPLE = 10
/** The moments with the most people showing marked hesitation. More than one when they tie on the count, which is the common case. Empty below three people. */
export function mostHesitation(moments: MomentSignal[]): MomentSignal[] {
  const pool = moments.filter((m) => m.all.n >= LEADER_MIN_PEOPLE)
  const top = Math.max(0, ...pool.map((m) => m.all.counts['Marked hesitation']))
  return top >= 3 ? pool.filter((m) => m.all.counts['Marked hesitation'] === top) : []
}

/** The concepts whose first reaction is the most positive, by the share of faces read. Several when they tie exactly. Needs at least two concepts to compare. */
export function mostPositive(moments: MomentSignal[]): MomentSignal[] {
  const concepts = moments.filter((m) => m.moment.kind === 'stimulus' && m.emotions.all.read >= LEADER_MIN_PEOPLE)
  if (concepts.length < 2) return []
  // Compare p/r by cross-multiplying, so a tie is exact and never a rounding accident.
  const beats = (a: MomentSignal, b: MomentSignal) => a.emotions.all.valence.Positive * b.emotions.all.read > b.emotions.all.valence.Positive * a.emotions.all.read
  const best = concepts.reduce((x, y) => (beats(y, x) ? y : x))
  return concepts.filter((m) => !beats(best, m))
}

export function standouts(signals: CodeSignal[], moments: MomentSignal[], toReview: number): Standout[] {
  const out: Standout[] = []
  // The most positive first reaction to a concept, among the faces read. A tie is said as a tie.
  const lead = mostPositive(moments)
  if (lead.length) {
    const total = moments.filter((m) => m.moment.kind === 'stimulus' && m.emotions.all.read >= LEADER_MIN_PEOPLE).length
    const each = (m: MomentSignal) => `${shortMoment(m.moment)} (${m.emotions.all.valence.Positive} of ${m.emotions.all.read})`
    if (lead.length === 1) {
      const e = lead[0].emotions.all
      out.push({ id: `emotion-${lead[0].moment.id}`, kind: 'moment', lens: 'emotion', target: lead[0].moment.id, lead: lead[0].moment.label, detail: `${e.valence.Positive} of ${e.read} faces read as delight or interest, the most positive first reaction of the ${total} concepts.` })
    } else {
      out.push({ id: `emotion-${lead[0].moment.id}`, kind: 'moment', lens: 'emotion', target: lead[0].moment.id, lead: `${numberWord(lead.length)} concepts tie for the most positive first reaction`, detail: `Faces read as delight or interest: ${lead.map(each).join('; ')}.` })
    }
  }
  // Where the words and the delivery disagree most.
  const conflict = signals.filter((s) => s.fit.pattern === 'Conflicting' || s.fit.pattern === 'Mixed').sort((a, b) => (b.fit.doesnt + b.fit.partly) / b.fit.n - (a.fit.doesnt + a.fit.partly) / a.fit.n)[0]
  if (conflict)
    out.push({ id: `fit-${conflict.code.id}`, kind: 'code', lens: 'fit', target: conflict.code.id, lead: conflict.code.name, detail: `Said by ${conflict.people} of ${conflict.of}. For ${conflict.fit.doesnt + conflict.fit.partly} of ${conflict.fit.n}, the face, voice or hesitation didn’t match the words.` })
  // The most hesitant code that isn't already there.
  const hes = signals.filter((s) => s.readable && (s.pattern === 'Mixed' || s.pattern === 'Often hesitant') && s.code.id !== conflict?.code.id).sort((a, b) => b.marked / b.people - a.marked / a.people)[0]
  if (hes) out.push({ id: `code-${hes.code.id}`, kind: 'code', lens: 'hesitation', target: hes.code.id, lead: hes.code.name, detail: `Said by ${hes.people} of ${hes.of}, with marked hesitation in ${hes.marked} of ${hes.people}.` })
  // The most hesitant moment. When several share the top count, none of them is "the" most: say they tie.
  const tops = mostHesitation(moments)
  if (tops.length === 1) {
    const t = tops[0]
    out.push({ id: `moment-${t.moment.id}`, kind: 'moment', lens: 'hesitation', target: t.moment.id, lead: t.moment.label, detail: `${t.all.counts['Marked hesitation']} of ${t.all.n} showed marked hesitation, the most of any moment.` })
  } else if (tops.length > 1) {
    const count = tops[0].all.counts['Marked hesitation']
    out.push({ id: `moment-${tops[0].moment.id}`, kind: 'moment', lens: 'hesitation', target: tops[0].moment.id, lead: `${numberWord(tops.length)} moments tie for the most hesitation`, detail: `Marked hesitation in ${count} people at each: ${tops.map((m) => `${shortMoment(m.moment)} (${count} of ${m.all.n})`).join('; ')}.` })
  }
  if (toReview > 0) out.push({ id: 'tensions', kind: 'tensions', lens: 'hesitation', lead: `${plural(toReview, 'tension')} to review`, detail: 'Where what people said doesn’t add up.' })
  return out
}

/** The tensions that draw on a code, so a code's panel can lead to them. */
export const tensionsFor = (tensions: Tension[], codeId: string) => tensions.filter((t) => t.codeIds.includes(codeId) && !t.unavailable)
