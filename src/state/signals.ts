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
import { codeThemes, denominator, peopleOf, tensionDecisions, themeCodes, type Basis, type Code, type CodebookDoc, type TensionDecision, type Theme } from './codebook'
import { emotionSplit, faceLabel, faceOf, fitSplit, hasVideo, toneSplit, VALENCE, type Emotion, type EmotionSplit, type FitSplit, type ToneSplit } from './emotion'

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
        use: readable && (doc.signalPicks?.[code.id] ?? notable),
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

export type TensionStatus = 'Suggested' | 'Turned into a theme' | 'Dismissed'
/** One side of a tension, in n of N. */
export type Side = { label: string; n: number; of: number; note?: string }
/** A face reading shown on a clip: where it was read, and what (after any correction). */
export type ClipFace = { where: string; label: string; emotion: Emotion | null }
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
  return f ? [{ where, label: faceLabel(f), emotion: f.emotion }] : []
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
          atSec: c?.atSec ?? ex.atSec,
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
    themes: available.filter((d) => decisions[d.id]?.status === 'Turned into a theme').length,
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
  const faces = emotions.read ? `Faces read for ${emotions.read}: ${v.Positive} positive, ${v.Neutral} neutral, ${v.Negative} negative.` : 'No faces read (no video).'
  const text = `${points.length} ${points.length === 1 ? 'person' : 'people'}. ${faces} Marked hesitation in ${marked} of ${points.length}.`
  const highlight = positiveClaim && unsettled / speakers.length >= 0.3 ? `Of the ${speakers.length} who spoke for it, ${unsettled} showed doubt, confusion or frustration on their face, or marked hesitation.` : undefined
  return { people: points.length, emotions, marked, fit, positiveClaim, unsettled, text, highlight }
}

// ─── what stands out ────────────────────────────────────────────────────────

/** A pattern written as a sentence, with where to see it. The first thing the Researcher reads. */
export type Standout = { id: string; kind: 'code' | 'moment' | 'tensions'; lens: 'hesitation' | 'emotion' | 'fit'; target?: string; lead: string; detail: string }

export function standouts(signals: CodeSignal[], moments: MomentSignal[], toReview: number): Standout[] {
  const out: Standout[] = []
  // The warmest first reaction to a concept, among the faces read.
  const concepts = moments.filter((m) => m.moment.kind === 'stimulus' && m.emotions.all.read >= 10)
  const warmest = [...concepts].sort((a, b) => b.emotions.all.valence.Positive / b.emotions.all.read - a.emotions.all.valence.Positive / a.emotions.all.read)[0]
  if (warmest && concepts.length > 1) {
    const e = warmest.emotions.all
    out.push({ id: `emotion-${warmest.moment.id}`, kind: 'moment', lens: 'emotion', target: warmest.moment.id, lead: warmest.moment.label, detail: `Delight or interest on ${e.valence.Positive} of ${e.read} faces read, the warmest first reaction of the ${concepts.length} concepts.` })
  }
  // Where the words and the delivery disagree most.
  const conflict = signals.filter((s) => s.fit.pattern === 'Conflicting' || s.fit.pattern === 'Mixed').sort((a, b) => (b.fit.doesnt + b.fit.partly) / b.fit.n - (a.fit.doesnt + a.fit.partly) / a.fit.n)[0]
  if (conflict)
    out.push({ id: `fit-${conflict.code.id}`, kind: 'code', lens: 'fit', target: conflict.code.id, lead: conflict.code.name, detail: `Said by ${conflict.people} of ${conflict.of}. For ${conflict.fit.doesnt + conflict.fit.partly} of ${conflict.fit.n}, the face, voice or hesitation didn’t match the words.` })
  // The most hesitant code that isn't already there.
  const hes = signals.filter((s) => s.readable && (s.pattern === 'Mixed' || s.pattern === 'Often hesitant') && s.code.id !== conflict?.code.id).sort((a, b) => b.marked / b.people - a.marked / a.people)[0]
  if (hes) out.push({ id: `code-${hes.code.id}`, kind: 'code', lens: 'hesitation', target: hes.code.id, lead: hes.code.name, detail: `Said by ${hes.people} of ${hes.of}, with marked hesitation in ${hes.marked} of ${hes.people}.` })
  const top = moments.filter((m) => m.all.n >= 10).sort((a, b) => b.all.counts['Marked hesitation'] / b.all.n - a.all.counts['Marked hesitation'] / a.all.n)[0]
  if (top && top.all.counts['Marked hesitation'] >= 3) out.push({ id: `moment-${top.moment.id}`, kind: 'moment', lens: 'hesitation', target: top.moment.id, lead: top.moment.label, detail: `${top.all.counts['Marked hesitation']} of ${top.all.n} showed marked hesitation, the most of any moment.` })
  if (toReview > 0) out.push({ id: 'tensions', kind: 'tensions', lens: 'hesitation', lead: `${plural(toReview, 'tension')} to review`, detail: 'Where what people said doesn’t add up.' })
  return out
}

/** The tensions that draw on a code, so a code's panel can lead to them. */
export const tensionsFor = (tensions: Tension[], codeId: string) => tensions.filter((t) => t.codeIds.includes(codeId) && !t.unavailable)
