// Emotion & behaviour (Results Analysis, step 2): signals and tensions. Worked out from the codebook and Review every time,
// never stored: a count is always "n of M" over the sessions accepted right now. Only the Researcher's decisions are kept
// (state/codebook.ts). Emotion and voice rules live in state/emotion.ts.

import { findReviewRecord } from '@/mock/review'
import {
  ACCEPTED_PARTICIPANTS,
  BANDS,
  bandRank,
  excerptPoint,
  momentPoints,
  momentsOf,
  sessionOfParticipant,
  tensionDefsOf,
  type Band,
  type Moment,
  type Point,
  type TensionDef,
} from '@/mock/signals'
import { askedOf, codeThemes, denominator, peopleOf, tensionDecisions, themeCodes, unthemed, type Basis, type Code, type CodebookDoc, type TensionDecision, type Theme } from './codebook'
import { DELIVERY, FIT_LABEL, SIDE_LABEL, describedLine } from '@/config/delivery'
import { segmentOf, segmentsOf, segmentWord } from '@/mock/studyAnalysis'
import { emotionSplit, faceOf, hasVideo, toneSplit, FIT_RULE_TEXT, type Emotion, type EmotionSplit, type Stance, type ToneSplit } from './emotion'
import { DELIVERY as RULES } from '@/config/delivery'
import { fitSplitOf, insightNow, insightOf, insightStatus, momentsToWatch, readPeople, speechAgainst, standoutOf, withStance, type Fit, type FitPattern, type FitSplit, type Insight, type InsightNow, type InsightStatus, type MomentToWatch, type PersonRead, type CodeStandout } from './speech'
export { checkInsightEdit } from './speech'
export type { CodeStandout, Insight, InsightNow, InsightStatus, MomentToWatch, PersonRead } from './speech'

export { BANDS, MOMENTS, TENSION_KINDS, TENSION_KIND_HINT, TENSION_KIND_LABEL, type Band, type Moment, type Point, type TensionKind } from '@/mock/signals'
export { SIGNAL_RULES, signsOf } from '@/mock/signals'
export { petOf, segmentOf, momentsOf, tensionDefsOf, acceptedParticipants } from '@/mock/signals'

/** A participant's segment as a short label beside their ID: "Cat owner", "Parent". */
export const segmentLabelOf = (participantId: string) => {
  const w = segmentWord(participantId)
  return w ? w[0].toUpperCase() + w.slice(1) : ''
}

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
  /** Readable and the words make a claim to check. "No claim" and "Too few to read" have nothing to show, so they are never ticked. */
  showable: boolean
  use: boolean
  /** One point per person, the most hesitant first. A person with several quotes counts once, at the moment their delivery pulled against their words most. */
  points: Point[]
  /** Every quote of this code from accepted sessions, with what the words claim as it stands now (after any correction). */
  positions: Point[]
  /** Each person's one reading: their side, whether their delivery matched, whether they hesitated. The verdict is counted from these. */
  reads: PersonRead[]
  /** The strongest speech pattern among the people who said it, or null when fewer than three share one. */
  standout: CodeStandout | null
  /** The clips most worth playing for this code, one per person, the clearest first, each with its measured reason. */
  moments: MomentToWatch[]
}

/** The signals on every accepted code. Only quotes from sessions accepted right now count. */
export function codeSignals(doc: CodebookDoc, basis: Basis): CodeSignal[] {
  return doc.codes
    .filter((c) => c.status === 'Accepted')
    .map((code) => {
      const raw = code.excerpts.map((id) => withStance(excerptPoint(id), doc)).filter((p) => basis.sessions.has(p.sessionId))
      // Each person once. Speech decides: their positions at this code are counted together (state/speech.ts).
      const reads = readPeople(raw, doc)
      const points = reads.map((r) => r.point).sort((a, b) => bandRank(b.band) - bandRank(a.band) || a.participantId.localeCompare(b.participantId))
      const marked = points.filter((p) => p.band === 'Marked hesitation').length
      const some = points.filter((p) => p.band === 'Some hesitation').length
      const pattern = patternOf(marked, points.length)
      const fit = fitSplitOf(reads)
      const readable = points.length >= MIN_PEOPLE
      const showable = readable && fit.pattern !== 'No claim'
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
        showable,
        use: showable && (doc.signalPicks?.[code.id] ?? notable),
        points,
        positions: raw,
        reads,
        standout: readable ? standoutOf(reads) : null,
        moments: momentsToWatch(reads, RULES.moments.code),
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
/** `first` and `second` are the study's two segments, in the order they read on screen (Pet Food: cat owners, dog owners). */
export type MomentSignal = { moment: Moment; all: Split; first: Split; second: Split; emotions: { all: EmotionSplit; first: EmotionSplit; second: EmotionSplit }; tones: ToneSplit; points: Point[] }

const split = (points: Point[]): Split => ({ counts: Object.fromEntries(BANDS.map((b) => [b, points.filter((p) => p.band === b).length])) as Record<Band, number>, n: points.length })

export function momentSignals(basis: Basis, doc: CodebookDoc): MomentSignal[] {
  const seg = segmentsOf(doc.studyId)
  return momentsOf(doc.studyId).map((moment) => {
    const points = momentPoints(moment.id, doc.studyId).filter((p) => basis.sessions.has(p.sessionId))
    const first = points.filter((p) => p.segment === seg.first.key)
    const second = points.filter((p) => p.segment === seg.second.key)
    return {
      moment,
      all: split(points),
      first: split(first),
      second: split(second),
      emotions: { all: emotionSplit(points, doc), first: emotionSplit(first, doc), second: emotionSplit(second, doc) },
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
export type Side = {
  label: string
  n: number
  of: number
  note?: string
  /**
   * The people in this side's group who are in none of its rows, so the lines always add up to the group. Worked out from the
   * sessions every time, never stored. `missing` marks the ones we have no reading for (didn't answer, no face read, not measured).
   */
  rest?: { label: string; n: number; of: number; missing?: boolean }[]
}
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
  /** Amber lines when more than a third of a group has no reading, so the card says how many people it really rests on. */
  coverage?: string[]
}

const NEGATIVE = new Set(['Probably would not', 'Definitely would not'])
const POSITIVE = new Set(['Probably would', 'Definitely would'])

function surveyAnswer(participantId: string, survey: string, question: RegExp): string | undefined {
  return findReviewRecord(sessionOfParticipant(participantId))?.survey.find((q) => q.survey === survey && question.test(q.question))?.answer
}


/** The face at a point, ready for a clip. Nothing when there is no video. */
function clipFace(p: Point | undefined, doc: CodebookDoc, where: string): ClipFace[] {
  const f = p ? faceOf(p, doc) : undefined
  return f && p ? [{ where, cue: f.reading.cue, atSec: p.atSec, onsetSec: f.reading.onsetSec, emotion: f.emotion, intensity: f.reading.intensity, corrected: !!f.fix }] : []
}
const WARM = new Set<Emotion>(['Delight', 'Interest'])

/** Everything the screen shows for a tension, from the data as it stands. */
/** More than a third of a group has no reading. */
const thin = (missing: number, of: number) => of > 0 && missing * 3 > of
const basedOn = (missing: number, of: number, who?: string) => `${who ? `${who}. ` : ''}Based on ${of - missing} of ${of} people. Read it as a prompt to look.`
const lines = (...l: ({ label: string; n: number; of: number; missing?: boolean } | false)[]) => l.filter((x): x is { label: string; n: number; of: number; missing?: boolean } => !!x && x.n > 0)

type Evidence = Pick<Tension, 'sides' | 'clips' | 'caution' | 'coverage'>
type Ctx = { doc: CodebookDoc; basis: Basis; studyId: string; N: number; code: (id: string) => Code; people: (id: string) => string[] }

const upperFirst = (t: string) => t[0].toUpperCase() + t.slice(1)
const lowerFirst = (t: string) => t[0].toLowerCase() + t.slice(1)
/** The coded quote a person said under a code. */
const quoteOf = (c: Ctx, codeId: string, p: string) => excerptPoint(c.code(codeId).excerpts.find((e) => e.includes(p))!)

/**
 * "Said vs survey", the first shape: people who said one thing in the interview, and how many of them locked a no in the survey.
 * Everyone in the group is on exactly one line: no, positively, or no clear answer (nothing answered, or "might or might not").
 */
function wordsThenNo(c: Ctx, o: { codeId: string; survey: string; question: RegExp; said: string; no: string }): Evidence {
  const chose = c.people(o.codeId)
  const answer = (p: string) => surveyAnswer(p, o.survey, o.question)
  const no = chose.filter((p) => NEGATIVE.has(answer(p) ?? ''))
  const silent = chose.filter((p) => !answer(p)).length
  const positive = chose.filter((p) => POSITIVE.has(answer(p) ?? '')).length
  const unclear = chose.length - no.length - positive
  return {
    sides: [
      { label: o.said, n: chose.length, of: c.N },
      { label: o.no, n: no.length, of: chose.length, rest: lines({ label: 'Answered positively', n: positive, of: chose.length }, { label: 'No clear survey answer', n: unclear, of: chose.length, missing: true }) },
    ],
    coverage: thin(silent, chose.length) ? [basedOn(silent, chose.length)] : undefined,
    clips: no.map((p) => {
      const ex = quoteOf(c, o.codeId, p)
      return { participantId: p, sessionId: sessionOfParticipant(p), atSec: ex.atSec, quote: ex.excerpt?.text, note: `Locked survey answer: ${surveyAnswer(p, o.survey, o.question)}` }
    }),
    caution: no.length < 3 ? 'Only a few people. Read it as a prompt to look, not a result.' : undefined,
  }
}

/** "Said vs survey", the second shape: people who said one thing, and how many of them locked a survey answer that `differs` from it. */
function wordsThenOther(c: Ctx, o: { codeId: string; survey: string; question: RegExp; said: string; other: string; same: string; differs: (answer: string) => boolean }): Evidence {
  const said = c.people(o.codeId)
  const answer = (p: string) => surveyAnswer(p, o.survey, o.question)
  const other = said.filter((p) => !!answer(p) && o.differs(answer(p)!))
  const silent = said.filter((p) => !answer(p)).length
  return {
    sides: [
      { label: o.said, n: said.length, of: c.N },
      { label: o.other, n: other.length, of: said.length, rest: lines({ label: o.same, n: said.length - silent - other.length, of: said.length }, { label: 'Didn’t answer the survey', n: silent, of: said.length, missing: true }) },
    ],
    coverage: thin(silent, said.length) ? [basedOn(silent, said.length)] : undefined,
    clips: other.map((p) => {
      const ex = quoteOf(c, o.codeId, p)
      return { participantId: p, sessionId: ex.sessionId, atSec: ex.atSec, quote: ex.excerpt?.text, note: `Locked survey answer: ${surveyAnswer(p, o.survey, o.question)}` }
    }),
    caution: 'Only a few people. Read it as a prompt to look, not a result.',
  }
}

/** "Said vs emotion": people who chose one concept in words, and how many looked delighted or interested at first sight of another. */
function wordsThenFace(c: Ctx, o: { codeId: string; faceMoment: string; ownMoment: string; said: string; warm: string; ownWhere: string; faceWhere: string; note: string }): Evidence {
  const chose = c.people(o.codeId)
  const onVideo = chose.filter(hasVideo)
  const atFace = momentPoints(o.faceMoment, c.studyId).filter((p) => c.basis.sessions.has(p.sessionId))
  const atOwn = momentPoints(o.ownMoment, c.studyId).filter((p) => c.basis.sessions.has(p.sessionId))
  const warm = onVideo.filter((p) => {
    const pt = atFace.find((x) => x.participantId === p)
    const f = pt ? faceOf(pt, c.doc) : undefined
    return !!f?.emotion && WARM.has(f.emotion)
  })
  const audioOnly = chose.length - onVideo.length
  // On video but no face read at that moment is "not read", never a neutral face.
  const unread = onVideo.filter((p) => {
    const pt = atFace.find((x) => x.participantId === p)
    return !(pt && faceOf(pt, c.doc)?.emotion)
  }).length
  const missingAll = audioOnly + unread
  return {
    sides: [
      { label: o.said, n: onVideo.length, of: chose.length, rest: lines({ label: 'Audio-only, so no face read', n: audioOnly, of: chose.length, missing: true }) },
      { label: o.warm, n: warm.length, of: onVideo.length, rest: lines({ label: 'Another reading', n: onVideo.length - warm.length - unread, of: onVideo.length }, { label: 'No face read at that moment', n: unread, of: onVideo.length, missing: true }) },
    ],
    coverage: thin(missingAll, chose.length) ? [basedOn(missingAll, chose.length)] : undefined,
    clips: onVideo.map((p) => {
      const f = atFace.find((x) => x.participantId === p)
      const ex = quoteOf(c, o.codeId, p)
      return {
        participantId: p,
        sessionId: ex.sessionId,
        // Play lands on the quoted answer. Each face below carries its own time, at the concept it was read on.
        atSec: ex.atSec,
        quote: ex.excerpt?.text,
        note: o.note,
        faces: [...clipFace(atOwn.find((x) => x.participantId === p), c.doc, o.ownWhere), ...clipFace(f, c.doc, o.faceWhere)],
      }
    }),
    caution: onVideo.length < SMALL_GROUP ? 'Only a few people on video. Read it as a prompt to look, not a result.' : undefined,
  }
}

/** "Between segments": the same question, answered one way by one group and another way by the other. `a` and `b` are the two answers (two codes). */
function acrossSegments(c: Ctx, o: { a: string; b: string; answers: [string, string] }): Evidence {
  const seg = segmentsOf(c.studyId)
  const group = (g: string) => [...c.basis.participants].filter((p) => segmentOf(p) === g)
  const said = (id: string, g: string) => c.people(id).filter((p) => segmentOf(p) === g).length
  const first = group(seg.first.key)
  const second = group(seg.second.key)
  const aIds = new Set(c.people(o.a))
  const bIds = new Set(c.people(o.b))
  // Everyone in the group who is in neither row. Someone who said both is counted once, on their own line.
  const rest = (m: string[]) => {
    const both = m.filter((p) => aIds.has(p) && bIds.has(p)).length
    const neither = m.filter((p) => !aIds.has(p) && !bIds.has(p)).length
    return { both, neither, size: m.length }
  }
  const r1 = rest(first)
  const r2 = rest(second)
  const restLines = (r: ReturnType<typeof rest>) => [{ label: 'No clear lean or didn’t say', n: r.neither, of: r.size, missing: true }, ...(r.both ? [{ label: 'Said both', n: r.both, of: r.size }] : [])]
  const flags = [thin(r1.neither, r1.size) && basedOn(r1.neither, r1.size, seg.first.label), thin(r2.neither, r2.size) && basedOn(r2.neither, r2.size, seg.second.label)].filter((x): x is string => !!x)
  const label = (g: { label: string }, answer: string) => `${g.label} ${lowerFirst(answer)}`
  return {
    coverage: flags.length ? flags : undefined,
    sides: [
      { label: label(seg.first, o.answers[0]), n: said(o.a, seg.first.key), of: first.length, rest: restLines(r1) },
      { label: label(seg.first, o.answers[1]), n: said(o.b, seg.first.key), of: first.length },
      { label: label(seg.second, o.answers[0]), n: said(o.a, seg.second.key), of: second.length, rest: restLines(r2) },
      { label: label(seg.second, o.answers[1]), n: said(o.b, seg.second.key), of: second.length },
    ],
    clips: [...c.people(o.a).filter((p) => segmentOf(p) === seg.first.key).slice(0, 2), ...c.people(o.b).filter((p) => segmentOf(p) === seg.second.key).slice(0, 2)].map((p) => {
      const isA = c.people(o.a).includes(p)
      const ex = quoteOf(c, isA ? o.a : o.b, p)
      return { participantId: p, sessionId: ex.sessionId, atSec: ex.atSec, quote: ex.excerpt?.text, note: `${upperFirst(segmentsOf(c.studyId).first.key === segmentOf(p) ? seg.first.one : seg.second.one)}, ${lowerFirst(o.answers[isA ? 0 : 1])}` }
    }),
    caution: `Directional. ${Math.min(first.length, second.length)} to ${Math.max(first.length, second.length)} people a group.${Math.min(first.length, second.length) < SMALL_GROUP ? ' One group is too small to read.' : ''}`,
  }
}

/** "Between concepts": people who chose a concept in the end, and how many hesitated hard when first shown that same concept. */
function chosenThenHesitated(c: Ctx, o: { codeId: string; momentId: string; chose: string; slow: string; where: string }): Evidence {
  const chose = c.people(o.codeId)
  const at = momentPoints(o.momentId, c.studyId).filter((p) => c.basis.sessions.has(p.sessionId))
  const atP = chose.map((p) => at.find((x) => x.participantId === p)).filter((p): p is Point => !!p)
  const slow = atP.filter((p) => p.band === 'Marked hesitation')
  const unread = chose.length - atP.length
  return {
    sides: [
      { label: o.chose, n: chose.length, of: c.N },
      { label: o.slow, n: slow.length, of: chose.length, rest: lines({ label: 'Steady, or only some hesitation', n: atP.length - slow.length, of: chose.length }, { label: 'Not measured at that moment', n: unread, of: chose.length, missing: true }) },
    ],
    coverage: thin(unread, chose.length) ? [basedOn(unread, chose.length)] : undefined,
    clips: slow.map((p) => ({ participantId: p.participantId, sessionId: p.sessionId, atSec: p.atSec, note: p.reason, faces: clipFace(p, c.doc, o.where) })),
  }
}

/** Everything the screen shows for a tension, from the data as it stands. Each tension names its codes, moments and survey; the five shapes above do the counting. */
function evidence(def: TensionDef, doc: CodebookDoc, basis: Basis): Evidence {
  const code = (id: string) => doc.codes.find((c) => c.id === id)!
  const c: Ctx = { doc, basis, studyId: doc.studyId, N: basis.participants.size, code, people: (id) => [...peopleOf(code(id), basis)].sort() }

  switch (def.id) {
    // ── Pet Food Subscription Churn ──
    case 'tn-pause-survey':
      return wordsThenNo(c, { codeId: 'c-idea-pause', survey: 'Retention idea reaction', question: /how likely/i, said: 'Picked pause as most likely to keep them', no: 'Of those, answered “probably” or “definitely would not” in the locked survey' })
    case 'tn-pause-portion-face':
      return wordsThenFace(c, {
        codeId: 'c-idea-pause',
        faceMoment: 'm-concept-c',
        ownMoment: 'm-concept-a',
        said: 'Picked pause as most likely to keep them, and were on video',
        warm: 'Of those, delight or interest at first sight of Concept C, portion-matched boxes',
        ownWhere: 'Concept A, pause',
        faceWhere: 'Concept C, portions',
        note: 'Their words when asked which idea would keep them. The faces were read in the first five seconds of each concept.',
      })
    case 'tn-pet-segments':
      return acrossSegments(c, { a: 'c-flex-first', b: 'c-price-first', answers: ['Said flexibility matters more', 'Said price matters more'] })
    case 'tn-pause-concept':
      return chosenThenHesitated(c, { codeId: 'c-idea-pause', momentId: 'm-concept-a', chose: 'Chose pause in the comparison', slow: 'Of those, marked hesitation at first sight of Concept A', where: 'First sight of Concept A' })
    case 'tn-vet-survey':
      return wordsThenOther(c, {
        codeId: 'c-vet-diet',
        survey: 'Why they cancelled',
        question: /one reason/i,
        said: 'Said a vet’s advice ended it',
        other: 'Of those, named something else as the one biggest reason in the survey',
        same: 'Named a vet or store brand',
        differs: (a) => !/vet or store brand/i.test(a),
      })
    // ── Ice Cream Flavour Concept Test ──
    case 'tn-caramel-survey':
      return wordsThenNo(c, { codeId: 'ic-pick-caramel', survey: 'Flavour reaction', question: /how likely/i, said: 'Picked Salted Caramel Swirl as the one they would buy first', no: 'Of those, answered “probably” or “definitely would not” in the locked survey' })
    case 'tn-caramel-mango-face':
      return wordsThenFace(c, {
        codeId: 'ic-pick-caramel',
        faceMoment: 'm-concept-b',
        ownMoment: 'm-concept-a',
        said: 'Picked Salted Caramel Swirl first, and were on video',
        warm: 'Of those, delight or interest at first sight of Concept B, Mango Lassi',
        ownWhere: 'Concept A, caramel',
        faceWhere: 'Concept B, mango',
        note: 'Their words when asked which flavour they would buy first. The faces were read in the first five seconds of each concept.',
      })
    case 'tn-segments':
      return acrossSegments(c, { a: 'ic-pick-cookie', b: 'ic-pick-mango', answers: def.answers! })
    case 'tn-mango-concept':
      return chosenThenHesitated(c, { codeId: 'ic-pick-mango', momentId: 'm-concept-b', chose: 'Would buy Mango Lassi first', slow: 'Of those, marked hesitation at first sight of Concept B', where: 'First sight of Concept B' })
    case 'tn-price-survey':
      return wordsThenOther(c, {
        codeId: 'ic-price-limit',
        survey: 'Flavour reaction',
        question: /how likely/i,
        said: 'Said a high price would stop them',
        other: 'Of those, answered “probably” or “definitely would” buy their favourite in the survey',
        same: 'Answered “might” or “would not”',
        differs: (a) => POSITIVE.has(a),
      })
    default:
      return { sides: [], clips: [] }
  }
}

/** The tensions PulseAI suggests, with their evidence and where each one stands. */
export function tensionsOf(doc: CodebookDoc, basis: Basis): Tension[] {
  const decisions = tensionDecisions(doc)
  return tensionDefsOf(doc.studyId).map((def) => {
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
  const defs = tensionDefsOf(doc.studyId)
  const available = defs.filter((d) => d.codeIds.every((id) => doc.codes.find((c) => c.id === id)?.status === 'Accepted') || decisions[d.id])
  const decided = available.filter((d) => decisions[d.id]).length
  return {
    total: available.length,
    /** Cards that wait on a code the Researcher has not accepted yet. Not actionable, so never in "to review". */
    waiting: defs.length - available.length,
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

/** One person-by-person tally of how delivery stood against the words, for the people with a position. The one place the figures come from. */
export type Breakdown = {
  /** Everyone who said it. */
  people: number
  /** People who spoke in favour, and people who spoke against it. Both took a side; the rest only described what happened. */
  positive: number
  negative: number
  against: number
  uncertain: number
  matched: number
  /** Those who only described it, so there is nothing to check. */
  factOnly: Point[]
}

/** The tally for a set of quotes. Each person is counted once, by the one rule (state/speech.ts). */
export function breakdownOf(all: Point[], doc: CodebookDoc): Breakdown {
  const reads = readPeople(all, doc)
  const claim = reads.filter((r) => r.fit)
  return {
    people: reads.length,
    positive: reads.filter((r) => r.side === 'Positive').length,
    negative: reads.filter((r) => r.side === 'Negative').length,
    against: claim.filter((r) => r.fit === 'Pulls against').length,
    uncertain: claim.filter((r) => r.fit === 'Uncertain').length,
    matched: claim.filter((r) => r.fit === 'Matches').length,
    factOnly: reads.filter((r) => !r.fit).map((r) => r.point).sort((a, b) => a.participantId.localeCompare(b.participantId)),
  }
}

/** Who spoke in favour and who against it, as a phrase: "8 spoke in favour and 6 spoke against it". */
const sidesPhrase = (pos: number, neg: number) => (pos && neg ? `${pos} spoke in favour and ${neg} spoke against it` : pos ? `${pos} spoke in favour` : `${neg} spoke against it`)

/** The one-line summary: "8 spoke in favour and 6 spoke against it. Matched 9, no match 3, hesitant 2." Empty when nobody took a side. */
export function breakdownLine(b: Breakdown): string {
  if (b.positive + b.negative === 0) return ''
  return `${sidesPhrase(b.positive, b.negative)}. ${FIT_LABEL.Matches} ${b.matched}, ${FIT_LABEL['Pulls against'].toLowerCase()} ${b.against}${b.uncertain ? `, ${FIT_LABEL.Uncertain.toLowerCase()} ${b.uncertain}` : ''}.`
}

/**
 * "Spoke in favour, hesitant delivery": among the people who spoke in favour, how many hesitated. An observation, never a verdict.
 * Only for a claim that is positive: at least three people were for it, and they are at least half of the people who said it.
 */
export function hesitantDelivery(all: Point[], doc: CodebookDoc): { said: number; speakers: number; hesitated: number } | null {
  const reads = readPeople(all, doc)
  const speakers = reads.filter((r) => r.side === 'Positive')
  if (speakers.length < MIN_PEOPLE || speakers.length * 2 < reads.length) return null
  const hesitated = speakers.filter((r) => r.hesitated).length
  return hesitated / speakers.length >= DELIVERY.hesitantInsight.minShare ? { said: reads.length, speakers: speakers.length, hesitated } : null
}

// ─── by theme: the profile of a theme ───────────────────────────────────────

/** How many of the people on one side had their speech go against their words. */
export type StanceGap = { n: number; Speech: number }

/**
 * One theme's people, rolled up with the same rules as a code. Each person counts once: their positions across the theme's codes
 * are counted together, and the quote that stands for them is where their delivery matched least.
 */
export type Rollup = {
  people: number
  /** One point per person: the quote that stands for them, the least matched first. */
  points: Point[]
  /** Every quote behind these people, with the stance as it stands. Counts are made from these, never from `points`. */
  positions: Point[]
  /** Each person's one reading. */
  reads: PersonRead[]
  /** One point per person chosen for reaction strength (Theme map colour), independent of the verdict rule. */
  strengthPoints: Point[]
  emotions: EmotionSplit
  tones: ToneSplit
  marked: number
  some: number
  steady: number
  pattern: Pattern
  /** The words-vs-delivery split over the people with a position, by the one rule (state/speech.ts). */
  fit: FitSplit
  /** The verdict: the fit pattern, or "Too few to read" under MIN_PEOPLE people. */
  verdict: FitPattern
  /** People by what they said: in favour, against, or just described. */
  stances: Record<Stance, number>
  positive: StanceGap
  negative: StanceGap
}

/**
 * The moment that stands for a person's reaction strength in the Theme map: where speech went most against a positive claim, then where
 * they hesitated most. Voice and hesitation only. It plays no part in the verdict.
 */
function strengthRank(p: Point): number {
  if (!p.stance || p.stance === 'Neutral') return bandRank(p.band)
  const n = (speechAgainst(p) ? 1 : 0) + (p.stance === 'Positive' && p.band === 'Marked hesitation' ? 1 : 0)
  return (n >= 2 ? 3 : n === 1 ? 2 : 1) * 10 + bandRank(p.band)
}
export function onePerPersonForStrength(points: Point[]): Point[] {
  const byPerson = new Map<string, Point>()
  points.forEach((p) => {
    const cur = byPerson.get(p.participantId)
    if (!cur || strengthRank(p) > strengthRank(cur)) byPerson.set(p.participantId, p)
  })
  return [...byPerson.values()]
}

/** One point per person: the quote that stands for them. Counts are never made from this, only from everyone's quotes. */
export const onePerPerson = (points: Point[], doc: CodebookDoc): Point[] => readPeople(points, doc).map((r) => r.point)

/** The roll-up of a set of quotes. Pure: the same quotes and corrections always give the same profile. */
export function rollupPoints(all: Point[], doc: CodebookDoc): Rollup {
  const quotes = all.map((p) => withStance(p, doc))
  const reads = readPeople(quotes, doc)
  const points = reads.map((r) => r.point)
  const marked = points.filter((p) => p.band === 'Marked hesitation').length
  const some = points.filter((p) => p.band === 'Some hesitation').length
  const fit = fitSplitOf(reads)
  const gap = (side: 'Positive' | 'Negative'): StanceGap => {
    const mine = reads.filter((r) => r.side === side)
    return { n: mine.length, Speech: mine.filter((r) => r.offTone).length }
  }
  const positive = gap('Positive')
  const negative = gap('Negative')
  return {
    people: reads.length,
    points,
    positions: quotes,
    reads,
    strengthPoints: onePerPersonForStrength(quotes),
    emotions: emotionSplit(points, doc),
    tones: toneSplit(points),
    marked,
    some,
    steady: points.length - marked - some,
    pattern: patternOf(marked, points.length),
    fit,
    verdict: fit.pattern,
    stances: { Positive: positive.n, Negative: negative.n, Neutral: reads.length - positive.n - negative.n },
    positive,
    negative,
  }
}

/** The rule for a theme's verdict, in one line for the screen. It is the per-code rule, applied to the theme's people. */
export const THEME_RULE_TEXT = `Each person counts once. ${FIT_RULE_TEXT}`

/** What people said across a theme's people, from the same per-code stance the Words row uses. */
export function stanceSummary(r: Pick<Rollup, 'stances'>): { short: string; long: string } {
  const { Positive: pos, Negative: neg, Neutral: neu } = r.stances
  const kinds = [pos && 'Positive', neg && 'Negative', neu && 'Neutral'].filter(Boolean) as Stance[]
  if (kinds.length === 0) return { short: '—', long: 'No one said it' }
  if (kinds.length === 1) return { short: SIDE_LABEL[kinds[0]], long: SIDE_LABEL[kinds[0]] }
  return { short: 'More than one side', long: [pos && sidesPhrase(pos, 0), neg && sidesPhrase(0, neg), neu && describedLine(neu)].filter(Boolean).join(', ') }
}

/** The gap, named in plain words and counted in people: "Of 7 who spoke in favour, 4 sounded flat or tense." */
function gapSentence(g: StanceGap, kind: 'positive' | 'negative'): string {
  if (!g.n || !g.Speech) return ''
  return `Of ${g.n} who ${kind === 'positive' ? 'spoke in favour' : 'spoke against it'}, ${g.Speech} ${kind === 'positive' ? 'sounded flat or tense' : 'sounded animated'}.`
}

/** The headline for a theme, built only from its numbers. Names the gap in plain words, or says delivery matched. */
export function headlineOf(r: Rollup, short = false): string {
  if (r.verdict === 'Too few to read') return `Only ${plural(r.people, 'person', 'people')} said this, too few to read a pattern.`
  if (r.fit.n === 0) return 'Nobody took a side, so there is nothing for the speech to match.'
  const gaps = [gapSentence(r.positive, 'positive'), gapSentence(r.negative, 'negative')].filter(Boolean)
  if (r.verdict === 'Consistent' || r.verdict === 'No claim') return [`Delivery matched the words for ${r.fit.fits} of ${r.fit.n} people.`, ...(short ? [] : gaps)].join(' ')
  return gaps.length ? (short ? gaps[0] : gaps.join(' ')) : `Delivery did not match the words for ${r.fit.against} of ${r.fit.n} people.`
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
  /** The one-sentence insight, computed. Null for "Not in a theme" and under three people. */
  insight: Insight | null
  /** The clips most worth playing for this theme, one per person, the clearest first, each with its measured reason. */
  moments: MomentToWatch[]
  /** What the insight is made from now, for a decision to be compared against. */
  now: InsightNow
  /** Where the Researcher's decision on the insight stands, and what it was and is when it is out of date. */
  decision: { status: InsightStatus; was?: InsightNow['snap']; now?: InsightNow['snap'] }
}

function profile(base: { id: string; name: string; definition?: string; kind: ThemeSignal['kind']; theme?: Theme }, rows: CodeSignal[], doc: CodebookDoc, basis: Basis): ThemeSignal {
  const r = rollupPoints(rows.flatMap((x) => x.positions), doc)
  const asked = new Set(rows.flatMap((x) => [...askedOf(x.code, basis)]))
  const of = asked.size
  const readable = r.people >= MIN_PEOPLE
  const notable = readable && (r.pattern === 'Mixed' || r.pattern === 'Often hesitant' || r.verdict === 'Mixed' || r.verdict === 'Conflicting')
  const tickable = base.kind === 'theme'
  const trace = [
    `${r.people} of ${of} said it${basis.participants.size - of ? ` (${basis.participants.size - of} weren’t asked)` : ''}`,
    `${r.fit.n} of ${r.people} spoke in favour or against it${r.people - r.fit.n ? `, ${r.people - r.fit.n} just described it` : ''}`,
  ].join('; ')
  const insight = base.kind === 'none' ? null : insightOf(r.reads)
  const now = insightNow(rows.map((x) => x.code.id), r.reads, insight, r.verdict)
  return {
    ...r,
    ...base,
    codes: rows,
    of,
    notAsked: basis.participants.size - of,
    headline: headlineOf(r),
    summary: readable && breakdownLine(breakdownOf(r.positions, doc)) ? breakdownLine(breakdownOf(r.positions, doc)) : headlineOf(r, true),
    trace: `${trace[0].toUpperCase()}${trace.slice(1)}.`,
    readable,
    notable,
    tickable,
    use: tickable && readable && (doc.themePicks?.[base.id] ?? notable),
    play: r.points[0],
    insight,
    moments: momentsToWatch(r.reads, RULES.moments.theme),
    now,
    decision: insightStatus(doc.insights?.[base.id], now),
  }
}

/**
 * Every accepted theme with its signals as one result: code themes, then the codes in no theme, then tension themes.
 * Worked out from the codebook and Review every time. Only the Researcher's decisions are stored (doc.insights, doc.themePicks).
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

// ─── a theme, read in words ─────────────────────────────────────────────────

/** One way delivery stood apart from the words, counted among the people on the side it applies to. */
export type DeliveryPattern = { key: 'hesitated' | 'speech'; side: 'Positive' | 'Negative'; n: number; of: number; /** "hesitated", "sounded flat or tense". */ text: string }

/** One side of what people said, with its people split by whether their delivery matched. */
export type SideGroup = {
  side: 'Positive' | 'Negative'
  /** The quote that stands for each person on this side. */
  points: Point[]
  reads: PersonRead[]
  tiles: Record<Fit, Point[]>
  /** Each person's one verdict, so a list of people shows the same one as the tile. */
  fits: Record<string, Fit>
  patterns: DeliveryPattern[]
}

export type SideSummary = {
  /** The one sentence (state/speech.ts insightOf), or a plain line when there are too few people. */
  sentence: string
  /** The N in "n of N people": the people who raised this theme or code. */
  of: number
  /** The sides that have people, the larger first. Two means two stacked tile groups. */
  groups: SideGroup[]
  /** People who just described what happened. Never checked. */
  described: Point[]
}

/** What people said, in one sentence, and the people behind it, from everyone's one reading. */
export function sideSummary(reads: PersonRead[]): SideSummary {
  const N = reads.length
  const group = (side: 'Positive' | 'Negative'): SideGroup => {
    const mine = reads.filter((r) => r.side === side)
    const of = (f: Fit) => mine.filter((r) => r.fit === f).map((r) => r.point)
    const all: DeliveryPattern[] = [
      { key: 'hesitated', side, n: mine.filter((r) => r.hesitated).length, of: mine.length, text: 'hesitated' },
      { key: 'speech', side, n: mine.filter((r) => r.offTone).length, of: mine.length, text: side === 'Positive' ? 'sounded flat or tense' : 'sounded animated' },
    ]
    return {
      side,
      points: mine.map((r) => r.point),
      reads: mine,
      tiles: { Matches: of('Matches'), 'Pulls against': of('Pulls against'), Uncertain: of('Uncertain') },
      fits: Object.fromEntries(mine.map((r) => [r.participantId, r.fit as Fit])),
      patterns: all.filter((x) => x.n >= RULES.clauseMin).sort((a, b) => b.n - a.n),
    }
  }
  const groups = (['Positive', 'Negative'] as const).filter((x) => reads.some((r) => r.side === x)).map(group).sort((a, b) => b.points.length - a.points.length || (a.side === 'Positive' ? -1 : 1))
  const insight = insightOf(reads)
  return { sentence: insight?.sentence ?? `Only ${plural(N, 'person', 'people')} said this, too few to read a pattern.`, of: N, groups, described: reads.filter((r) => !r.side).map((r) => r.point) }
}

export type ThemeInsight = {
  /** The one sentence, the groups behind it and who just described it. */
  summary: SideSummary
  /** The patterns that affect three or more people on their side, the most people first. */
  patterns: DeliveryPattern[]
  /** Codes in the theme whose verdict is Mixed or Gap, Gap first, then the most people with no match. */
  check: CodeSignal[]
  /** Small grey line: who just described it, who was audio-only. */
  coverage: string
}

/**
 * The theme panel's reading, built only from the theme's own people, so it can never disagree with the row or the codes beneath it.
 * Hesitation is named, never a verdict.
 */
export function themeInsight(t: Pick<ThemeSignal, 'reads' | 'people' | 'emotions' | 'codes'>): ThemeInsight {
  const summary = sideSummary(t.reads)
  const rank = (c: CodeSignal) => (c.fit.pattern === 'Conflicting' ? 0 : 1)
  const check = t.codes.filter((c) => c.fit.pattern === 'Mixed' || c.fit.pattern === 'Conflicting').sort((a, b) => rank(a) - rank(b) || b.fit.against - a.fit.against || a.code.name.localeCompare(b.code.name))
  const described = summary.described.length
  const coverage = [described > 0 ? `${described} just described it` : '', t.emotions.noVideo > 0 ? `${t.emotions.noVideo} audio-only, read on speech` : ''].filter(Boolean).join(' · ')
  return { summary, patterns: summary.groups.flatMap((g) => g.patterns), check, coverage }
}

// ─── what stands out ────────────────────────────────────────────────────────

/** A pattern written as a sentence, with where to see it. The first thing the Researcher reads. */
export type Standout = { id: string; kind: 'code' | 'moment' | 'tensions'; lens: 'speech' | 'emotion' | 'fit' | 'hesitant'; target?: string; lead: string; detail: string }

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

export function standouts(signals: CodeSignal[], moments: MomentSignal[], toReview: number, doc: CodebookDoc): Standout[] {
  const out: Standout[] = []
  // Positive words, hesitant delivery: an observation, never a verdict, and first when present. Only for a claim that is positive.
  const insights = signals
    .filter((s) => s.readable)
    .map((s) => ({ s, h: hesitantDelivery(s.points, doc) }))
    .filter((x): x is { s: CodeSignal; h: NonNullable<ReturnType<typeof hesitantDelivery>> } => !!x.h)
    .sort((a, b) => b.h.hesitated / b.h.speakers - a.h.hesitated / a.h.speakers || b.h.hesitated - a.h.hesitated)
    .slice(0, 2)
  insights.forEach(({ s, h }) => out.push({ id: `hesitant-${s.code.id}`, kind: 'code', lens: 'hesitant', target: s.code.id, lead: s.code.name, detail: `Said by ${h.said} of ${s.of}; ${h.hesitated} of ${h.speakers} hesitated.` }))
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
  const conflict = signals.filter((s) => s.fit.pattern === 'Conflicting' || s.fit.pattern === 'Mixed').sort((a, b) => (b.fit.against) / b.fit.n - (a.fit.against) / a.fit.n)[0]
  if (conflict)
    out.push({ id: `fit-${conflict.code.id}`, kind: 'code', lens: 'fit', target: conflict.code.id, lead: conflict.code.name, detail: `Said by ${conflict.people} of ${conflict.of}. For ${conflict.fit.against} of ${conflict.fit.n}, the speech or face did not match the words${conflict.fit.uncertain ? `, and ${conflict.fit.uncertain} were hesitant` : ''}.` })
  // The most hesitant code that isn't already there.
  const hes = signals.filter((s) => s.readable && (s.pattern === 'Mixed' || s.pattern === 'Often hesitant') && s.code.id !== conflict?.code.id && !insights.some((i) => i.s.code.id === s.code.id)).sort((a, b) => b.marked / b.people - a.marked / a.people)[0]
  if (hes) out.push({ id: `code-${hes.code.id}`, kind: 'code', lens: 'speech', target: hes.code.id, lead: hes.code.name, detail: `Said by ${hes.people} of ${hes.of}, with marked hesitation in ${hes.marked} of ${hes.people}.` })
  // The most hesitant moment. When several share the top count, none of them is "the" most: say they tie.
  const tops = mostHesitation(moments)
  if (tops.length === 1) {
    const t = tops[0]
    out.push({ id: `moment-${t.moment.id}`, kind: 'moment', lens: 'speech', target: t.moment.id, lead: t.moment.label, detail: `${t.all.counts['Marked hesitation']} of ${t.all.n} showed marked hesitation, the most of any moment.` })
  } else if (tops.length > 1) {
    const count = tops[0].all.counts['Marked hesitation']
    out.push({ id: `moment-${tops[0].moment.id}`, kind: 'moment', lens: 'speech', target: tops[0].moment.id, lead: `${numberWord(tops.length)} moments tie for the most hesitation`, detail: `Marked hesitation in ${count} people at each: ${tops.map((m) => `${shortMoment(m.moment)} (${count} of ${m.all.n})`).join('; ')}.` })
  }
  if (toReview > 0) out.push({ id: 'tensions', kind: 'tensions', lens: 'speech', lead: `${plural(toReview, 'tension')} to review`, detail: 'Where what people said doesn’t add up.' })
  return out
}

/** The tensions that draw on a code, so a code's panel can lead to them. */
export const tensionsFor = (tensions: Tension[], codeId: string) => tensions.filter((t) => t.codeIds.includes(codeId) && !t.unavailable)
