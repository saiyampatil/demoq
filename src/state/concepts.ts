// A2, the Concepts tab: for each concept, what people said, what they did, and what their first reaction showed, each with its own base,
// and whether the three agree. Worked out from the codebook, the mock choice task and the reveal readings every time. Never stored:
// only the Researcher's decision on a concept's line is (doc.insights, keyed "concept:{id}").
//
//   Said    people who picked the concept first (from its code), of the people who saw it.
//   Did     people who chose it in the choice task, of the people who saw it and finished the task. Absent when there is no choice task.
//   Showed  each person's warmest first reaction among the concepts they saw: Delight above Interest, then by intensity, at medium
//           confidence or higher. A tie counts for no concept, and so does no warm reading. Audio-only people and people who did not
//           consent are never read. Each concept's base is the people on video who saw it. Greyed under CONCEPTS.showedMinVideo people.
// Faces are read only in the first five seconds after the reveal, before the person speaks, and only here. They play no part in a theme.

import { CONCEPTS } from '@/config/concepts'
import { EARLY_MENTION, conceptStudyOf, revealReading, sawConcept, type ConceptDef, type RevealReading } from '@/mock/concepts'
import { hasVideo, type Emotion, type Intensity } from '@/mock/emotion'
import { liveExcerpts, peopleOf, type Basis, type CodebookDoc } from './codebook'
import { hash } from './hash'
import { checkNarration } from './narration'
import { insightStatus, type InsightNow } from './speech'

export type ReadingLite = { conceptId: string; label: Emotion; intensity: Intensity; confidence: number; /** The Researcher corrected it: PulseAI's own label, and whether the correction was "No clear reading". */ from?: Emotion; corrected?: boolean; noClear?: boolean } & Partial<Omit<RevealReading, 'label' | 'intensity' | 'confidence' | 'conceptId'>>
export type PersonConcept = {
  participantId: string
  saw: string[]
  video: boolean
  consent: boolean
  readings: ReadingLite[]
  /** The concept they said they would pick first. */
  said?: string
  /** The concept they chose in the choice task. Absent when there is none, or they did not finish it. */
  did?: string
}
export type ConceptInput = {
  concepts: { id: string; name: string }[]
  people: PersonConcept[]
  hasChoiceTask: boolean
  /** Said needs the concept's code to be accepted in the codebook. */
  saidAvailable: Record<string, boolean>
}

export type Measure = { n: number; of: number }
export type MeasureKey = 'said' | 'did' | 'showed'
export type Match = 'Agrees' | 'Differs' | 'Not enough'

export type ConceptResult = {
  id: string
  name: string
  /** People who saw it. */
  saw: number
  said?: Measure
  did?: Measure
  showed: Measure & { greyed: boolean }
  /** The measures that count toward Agrees and Differs: available, and Showed only when not greyed. */
  measures: MeasureKey[]
  /** 1 is the highest share among the concepts, by measure. Ties share a rank. */
  ranks: Partial<Record<MeasureKey, number>>
  rankGap: number
  spread: number
  match: Match
  /** The concept (or concepts, on a tie) with the highest share in each measure. */
  leads: Record<MeasureKey, boolean>
}

const WARM = new Set<string>(CONCEPTS.warmLabels)
const LABEL_RANK: Record<string, number> = { Delight: 2, Interest: 1 }
const INTENSITY_RANK: Record<Intensity, number> = { Low: 1, Medium: 2, High: 3 }
const warmScore = (r: ReadingLite) => (LABEL_RANK[r.label] ?? 0) * 10 + INTENSITY_RANK[r.intensity]

/** A person's warmest first reaction: the concept it was at, or null when there is none (no warm reading, a tie, no video, no consent). */
export function warmest(p: PersonConcept, rules: typeof CONCEPTS = CONCEPTS): string | null {
  if (!p.video || !p.consent) return null
  const warm = p.readings.filter((r) => p.saw.includes(r.conceptId) && WARM.has(r.label) && r.confidence >= rules.minConfidence).sort((a, b) => warmScore(b) - warmScore(a))
  if (!warm.length) return null
  if (warm.length > 1 && warmScore(warm[0]) === warmScore(warm[1])) return null
  return warm[0].conceptId
}

const share = (m: Measure) => (m.of ? m.n / m.of : 0)
/** Dense ranks by share, 1 highest. */
function ranksOf(values: number[]): number[] {
  const order = [...new Set(values)].sort((a, b) => b - a)
  return values.map((v) => order.indexOf(v) + 1)
}

export type Coverage = {
  people: number
  /** People who saw at least one concept and have a first reaction read at a reveal. */
  read: number
  audioOnly: number
  noConsent: number
  /** People on video who consented: the pool Showed draws from. */
  onVideo: number
}

export function coverageOf(input: ConceptInput): Coverage {
  const audioOnly = input.people.filter((p) => !p.video).length
  const noConsent = input.people.filter((p) => p.video && !p.consent).length
  return { people: input.people.length, read: input.people.filter((p) => p.readings.some((r) => p.saw.includes(r.conceptId))).length, audioOnly, noConsent, onVideo: input.people.length - audioOnly - noConsent }
}

export function computeConcepts(input: ConceptInput, rules: typeof CONCEPTS = CONCEPTS): ConceptResult[] {
  const cov = coverageOf(input)
  const greyed = cov.onVideo < rules.showedMinVideo
  const winner = new Map(input.people.map((p) => [p.participantId, warmest(p, rules)]))
  const base = input.concepts.map((c) => {
    const saw = input.people.filter((p) => p.saw.includes(c.id))
    const said: Measure | undefined = input.saidAvailable[c.id] ? { n: saw.filter((p) => p.said === c.id).length, of: saw.length } : undefined
    const did: Measure | undefined = input.hasChoiceTask ? (() => { const done = saw.filter((p) => p.did !== undefined); return { n: done.filter((p) => p.did === c.id).length, of: done.length } })() : undefined
    const pool = saw.filter((p) => p.video && p.consent)
    const showed = { n: pool.filter((p) => winner.get(p.participantId) === c.id).length, of: pool.length, greyed }
    return { c, saw: saw.length, said, did, showed }
  })
  const keys: MeasureKey[] = ['said', 'did', 'showed']
  const present = (k: MeasureKey) => base.every((b) => (k === 'showed' ? !b.showed.greyed : !!b[k]))
  const active = keys.filter(present)
  const ranks = Object.fromEntries(active.map((k) => [k, ranksOf(base.map((b) => share((k === 'showed' ? b.showed : b[k]) as Measure)))])) as Record<MeasureKey, number[]>
  return base.map((b, i): ConceptResult => {
    const mine = Object.fromEntries(active.map((k) => [k, ranks[k][i]])) as Partial<Record<MeasureKey, number>>
    const rs = Object.values(mine) as number[]
    const shares = active.map((k) => share((k === 'showed' ? b.showed : b[k]) as Measure))
    const rankGap = rs.length ? Math.max(...rs) - Math.min(...rs) : 0
    const spread = shares.length ? Math.max(...shares) - Math.min(...shares) : 0
    const need = Math.min(rules.differs.rankGap, input.concepts.length - 1)
    const match: Match = active.length < rules.minMeasures ? 'Not enough' : rankGap >= need && spread >= rules.differs.minSpread ? 'Differs' : 'Agrees'
    return {
      id: b.c.id,
      name: b.c.name,
      saw: b.saw,
      ...(b.said ? { said: b.said } : {}),
      ...(b.did ? { did: b.did } : {}),
      showed: b.showed,
      measures: active,
      ranks: mine,
      rankGap,
      spread,
      match,
      leads: { said: mine.said === 1, did: mine.did === 1, showed: mine.showed === 1 },
    }
  })
}

// ─── the concept's line ─────────────────────────────────────────────────────

export type ConceptLine = { sentence: string; figures: 2 }

/**
 * One sentence per concept, from its own numbers. Two figures, each "n of N" with its own base. Null when fewer than two measures are
 * available. Names what Showed is: the warmest first reaction, among people on video.
 */
export function conceptLine(r: ConceptResult): string | null {
  if (r.measures.length < CONCEPTS.minMeasures) return null
  const s = r.showed
  const d = r.did
  const a = r.said
  const useShowed = r.measures.includes('showed')
  const useDid = r.measures.includes('did') && d
  const useSaid = r.measures.includes('said') && a
  const f = (m: Measure) => `${m.n} of ${m.of}`
  // Two shares within CONCEPTS.similar of each other read as the same.
  const cmp = (x: Measure, y: Measure) => (Math.abs(share(x) - share(y)) < CONCEPTS.similar ? 0 : Math.sign(share(x) - share(y)))
  if (useShowed && useDid) {
    const c = cmp(s, d!)
    if (c > 0) return `${r.name} drew the warmest first reaction for ${f(s)} on video, but only ${f(d!)} chose it to take home.`
    if (c < 0) return `${f(d!)} chose ${r.name} to take home, but it drew the warmest first reaction for only ${f(s)} on video.`
    return `${r.name} drew the warmest first reaction for ${f(s)} on video, and ${f(d!)} chose it to take home.`
  }
  if (useSaid && useDid) {
    const c = cmp(a!, d!)
    if (c > 0) return `${f(a!)} said they would pick ${r.name} first, but only ${f(d!)} chose it to take home.`
    if (c < 0) return `${f(d!)} chose ${r.name} to take home, more than the ${f(a!)} who said they would pick it first.`
    return `${f(a!)} said they would pick ${r.name} first, and ${f(d!)} chose it to take home.`
  }
  if (useSaid && useShowed) {
    const c = cmp(a!, s)
    if (c > 0) return `${f(a!)} said they would pick ${r.name} first, but it drew the warmest first reaction for only ${f(s)} on video.`
    if (c < 0) return `${r.name} drew the warmest first reaction for ${f(s)} on video, more than the ${f(a!)} who said they would pick it first.`
    return `${f(a!)} said they would pick ${r.name} first, and it drew the warmest first reaction for ${f(s)} on video.`
  }
  return null
}

/** The rules a concept line must pass: the shared narration validator, with two figures allowed (each has its own base). */
export const checkConceptLine = (text: string) => checkNarration(text, { maxWords: 30, figuresAllowed: 2 })

/** What the line is made from now, for a decision to be compared against later. Same shape as a theme's. */
export function conceptNow(r: ConceptResult, sentence: string | null): InsightNow {
  const m = r.did ?? r.said ?? r.showed
  const text = sentence ?? ''
  return { text, fingerprint: hash(JSON.stringify({ i: r.id, s: r.said ?? null, d: r.did ?? null, h: [r.showed.n, r.showed.of, r.showed.greyed], t: text })), snap: { n: m.n, of: m.of, verdict: r.match, text } }
}

export type ConceptRow = ConceptResult & { key: string; line: string | null; now: InsightNow; decision: ReturnType<typeof insightStatus> }

/** Every concept of a study with its line and where the Researcher's decision on it stands. */
export function conceptRows(doc: CodebookDoc, basis: Basis): { rows: ConceptRow[]; coverage: Coverage; input: ConceptInput; hasChoiceTask: boolean; defs: ConceptDef[] } | undefined {
  const input = conceptInputOf(doc, basis)
  if (!input) return undefined
  const rows = computeConcepts(input).map((r): ConceptRow => {
    const line = conceptLine(r)
    const now = conceptNow(r, line)
    const key = `concept:${r.id}`
    return { ...r, key, line, now, decision: insightStatus(doc.insights?.[key], now) }
  })
  return { rows, coverage: coverageOf(input), input, hasChoiceTask: input.hasChoiceTask, defs: conceptStudyOf(doc.studyId)!.concepts }
}

// ─── the clips ──────────────────────────────────────────────────────────────

const EMOTION_ORDER: Record<string, number> = { Delight: 7, Interest: 6, Surprise: 5, Neutral: 4, Confusion: 3, Doubt: 2, Frustration: 1 }
export type Clip = { rank: number; participantId: string; sessionId: string; reading: ReadingLite & { cue: string; onsetSec: number; revealAtSec: number; sessionId: string }; /** Their warmest first reaction was at this concept. */ warmestHere: boolean }

/** The first reactions at a concept, warmest first: Delight above Interest and the rest, then by intensity, then by how sure PulseAI is. */
export function clipsOf(input: ConceptInput, conceptId: string, limit: number = CONCEPTS.clips): { clips: Clip[]; total: number } {
  const all = input.people
    .filter((p) => p.video && p.consent && p.saw.includes(conceptId))
    .flatMap((p) => {
      const r = p.readings.find((x) => x.conceptId === conceptId)
      return r && r.cue !== undefined && r.onsetSec !== undefined && r.revealAtSec !== undefined && r.sessionId ? [{ p, r: r as Clip['reading'] }] : []
    })
    .sort((a, b) => (EMOTION_ORDER[b.r.label] - EMOTION_ORDER[a.r.label]) || (INTENSITY_RANK[b.r.intensity] - INTENSITY_RANK[a.r.intensity]) || b.r.confidence - a.r.confidence || a.p.participantId.localeCompare(b.p.participantId))
  return { total: all.length, clips: all.slice(0, limit).map((x, i) => ({ rank: i + 1, participantId: x.p.participantId, sessionId: x.r.sessionId, reading: x.r, warmestHere: warmest(x.p) === conceptId })) }
}

/** The people behind a measure of a concept, for the panel's list. */
export function peopleBehind(input: ConceptInput, conceptId: string, key: MeasureKey): { participantId: string; word: string }[] {
  const saw = input.people.filter((p) => p.saw.includes(conceptId))
  if (key === 'said') return saw.filter((p) => p.said === conceptId).map((p) => ({ participantId: p.participantId, word: 'Picked it first' }))
  if (key === 'did') return saw.filter((p) => p.did === conceptId).map((p) => ({ participantId: p.participantId, word: 'Chose it' }))
  return saw
    .filter((p) => p.video && p.consent && warmest(p) === conceptId)
    .map((p) => { const r = p.readings.find((x) => x.conceptId === conceptId)!; return { participantId: p.participantId, word: `${r.label} · ${r.intensity.toLowerCase()}` } })
}

// ─── the inputs, from the mock study and the codebook ───────────────────────

/** The concept inputs of a study, or undefined when it tested none. */
export function conceptInputOf(doc: CodebookDoc, basis: Basis): ConceptInput | undefined {
  const study = conceptStudyOf(doc.studyId)
  if (!study) return undefined
  const codeOf = (c: ConceptDef) => doc.codes.find((x) => x.id === c.codeId)
  const sayers = new Map(study.concepts.map((c) => [c.id, (() => { const code = codeOf(c); return code && code.status === 'Accepted' ? peopleOf(code, basis) : new Set<string>() })()]))
  const people = [...basis.participants].sort().map((participantId): PersonConcept => ({
    participantId,
    saw: study.concepts.filter((c) => sawConcept(study, participantId, c.id)).map((c) => c.id),
    video: hasVideo(participantId),
    consent: !study.noFaceConsent.includes(participantId),
    // A Researcher's correction ("Not right?") replaces the label here, so every count and line follows it. "No clear reading" is never warm.
    readings: study.concepts.flatMap((c): ReadingLite[] => {
      const r = revealReading(study.studyId, participantId, c.id)
      if (!r) return []
      const fix = doc.faceFixes?.[`m:${c.id}:${participantId}`]
      if (!fix) return [{ ...r, conceptId: c.id }]
      if (fix.to === 'No clear expression') return [{ ...r, conceptId: c.id, label: 'Neutral', intensity: 'Low', from: r.label, corrected: true, noClear: true }]
      return [{ ...r, conceptId: c.id, label: fix.to, from: r.label, corrected: true }]
    }),
    said: study.concepts.find((c) => sayers.get(c.id)!.has(participantId))?.id,
    did: study.choice?.picks[participantId],
  }))
  return { concepts: study.concepts.map((c) => ({ id: c.id, name: c.name })), people, hasChoiceTask: !!study.choice, saidAvailable: Object.fromEntries(study.concepts.map((c) => [c.id, codeOf(c)?.status === 'Accepted'])) }
}

// ─── text signals (transcripts only, never a verdict input) ─────────────────

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const HEDGE = new RegExp(`\\b(?:${CONCEPTS.hedging.map(escape).join('|')})\\b`, 'i')

export type Observation = { n: number; of: number; who: string[] }
export type TextSignals = { hedged: Observation; raised: Observation }

/** "Hedged n of N" (an answer with a hedging word) and "Raised before asked n of N" (mentioned before the guide question about it), for one code. */
export function textSignalsOf(code: { id: string; excerpts: string[]; questionId: string; isNew: boolean }, doc: CodebookDoc, basis: Basis): TextSignals {
  const quotes = liveExcerpts(code as CodebookDoc['codes'][number], basis)
  const people = [...new Set(quotes.map((e) => e.participantId))].sort()
  const hedged = people.filter((p) => quotes.some((e) => e.participantId === p && HEDGE.test(e.text)))
  const raised = people.filter((p) => `${p}|${code.id}` in EARLY_MENTION)
  void doc
  return { hedged: { n: hedged.length, of: people.length, who: hedged }, raised: { n: raised.length, of: people.length, who: raised } }
}
