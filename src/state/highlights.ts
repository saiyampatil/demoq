// Real-time highlights (founder brief, step 7): the Researcher types an idea, the accepted interviews are scanned at once, and
// matching quotes are proposed as one code. The scan only reads. Nothing is written until the Researcher accepts (state/codebook.ts).
//
// Matching rule (keyword-based, prototype only; the product will use a semantic index, docs/OPEN_QUESTIONS.md #161):
//  1. The idea is split into words. Stop words are dropped and the rest are reduced to a stem ("pausing", "paused", "pause" all become "paus").
//  2. Only what a participant said is searched, in the sessions accepted in Review right now. Excluded sessions are never read.
//     The corrected transcript is used where one exists, otherwise the raw one.
//  3. A turn must contain at least half of the idea's stems (rounded up). Its score is how much of the idea it covers, with rarer
//     words counting for more (inverse document frequency across the turns searched).
//  4. Ties go to the shorter turn, then to the participant. Identical text in the same session counts once, and one person
//     contributes at most two turns, so ten results are ten different voices where there are that many.
//  5. The top ten are shown. Every quote is a whole turn, word for word. No score is ever shown, and nothing is said about a person.

import { CODE_QUESTIONS, petOf, type Pet } from '@/mock/codebook'
import { findReviewRecord, transcriptFor } from '@/mock/review'
import type { Basis, CodebookDoc } from './codebook'

// ─── words ──────────────────────────────────────────────────────────────────

const STOP = new Set(
  `a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your yours really thing things much many get got going like lot one`
    .split(/\s+/)
    .filter(Boolean),
)

/** A word reduced to a stem, so "piling", "piled" and "pile" meet. Rough on purpose: this is the prototype's stand-in for meaning. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']/g, '')
  if (w.length <= 3) return w
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`
  else
    for (const suffix of ['ing', 'edly', 'ed', 'ly', 'es', 's']) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
        w = w.slice(0, -suffix.length)
        break
      }
    }
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1)
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}

const WORD = /[A-Za-z0-9][A-Za-z0-9’']*/g
/** The content stems of a text, in order, without repeats. */
export function contentStems(text: string): string[] {
  const out: string[] = []
  for (const m of text.match(WORD) ?? []) {
    const lower = m.toLowerCase().replace(/[’']/g, '')
    if (STOP.has(lower) || STOP.has(m.toLowerCase())) continue
    const s = stem(m)
    if (s.length >= 2 && !out.includes(s)) out.push(s)
  }
  return out
}

/** The same idea always gives the same key, whatever the order or word forms, so a dismissed idea stays dismissed. */
export const ideaKey = (idea: string) => `hl:${[...contentStems(idea)].sort().join('+')}`

// ─── the guide question a turn falls under ──────────────────────────────────

const BY_POSITION = [...CODE_QUESTIONS].sort((a, b) => a.fraction - b.fraction)
/** Before the first question and after the last answer there is no guide question: the opening and the close. */
const CLOSE = 0.93
const SLACK = 0.01

/** The question the interview was on at this point: the last one asked before it. Null before the first question and in the close. */
export function questionAt(fraction: number): string | null {
  if (fraction < BY_POSITION[0].fraction - SLACK || fraction > CLOSE) return null
  let id = BY_POSITION[0].id
  for (const q of BY_POSITION) if (q.fraction <= fraction + SLACK) id = q.id
  return id
}
const nearestQuestion = (fraction: number) => BY_POSITION.reduce((best, q) => (Math.abs(q.fraction - fraction) < Math.abs(best.fraction - fraction) ? q : best)).id

// ─── the corpus: what participants said, in the accepted sessions ───────────

export type Hit = {
  /** Stable for a session and turn, so a list does not jump. */
  key: string
  sessionId: string
  participantId: string
  pet: Pet
  /** 0-based turn index and 1-based turn number. */
  turnIndex: number
  turn: number
  atSec: number
  text: string
  /** The guide question this fell under, or null for outside the guide. */
  questionId: string | null
  /** Where the turn sits in the interview, 0 to 1. */
  fraction: number
}
type Row = Hit & { stems: Set<string> }

const corpusCache = new Map<string, Row[]>()
function rowsOf(sessionId: string): Row[] {
  const cached = corpusCache.get(sessionId)
  if (cached) return cached
  const rec = findReviewRecord(sessionId)
  const rows: Row[] = rec
    ? transcriptFor(sessionId, 'reviewed')
        .filter((t) => t.speaker === 'Participant')
        .map((t) => ({
          key: `${sessionId}#${t.turn}`,
          sessionId,
          participantId: rec.participantId,
          pet: petOf(rec.participantId),
          turnIndex: t.index,
          turn: t.turn,
          atSec: t.atSec,
          text: t.text,
          questionId: questionAt(t.index / rec.turnCount),
          fraction: t.index / rec.turnCount,
          stems: new Set(contentStems(t.text)),
        }))
    : []
  corpusCache.set(sessionId, rows)
  return rows
}

// ─── the scan ───────────────────────────────────────────────────────────────

export const MAX_RESULTS = 10
const PER_PERSON = 2
export const MIN_IDEA_LENGTH = 2

export type ScanResult = {
  idea: string
  stems: string[]
  key: string
  hits: Hit[]
  /** How many accepted interviews were searched. */
  sessions: number
}

/** Reads the accepted interviews for an idea. Never writes. Throws nothing for an idea with no content words: it returns no hits. */
export function scanIdea(idea: string, basis: Basis): ScanResult {
  const text = idea.trim()
  const stems = contentStems(text)
  const sessions = [...basis.sessions].sort()
  const result: ScanResult = { idea: text, stems, key: ideaKey(text), hits: [], sessions: sessions.length }
  if (!stems.length) return result

  const rows = sessions.flatMap(rowsOf)
  const df = new Map<string, number>()
  rows.forEach((r) => r.stems.forEach((s) => df.set(s, (df.get(s) ?? 0) + 1)))
  const idf = (s: string) => Math.log(1 + rows.length / (1 + (df.get(s) ?? 0)))
  const total = stems.reduce((n, s) => n + idf(s), 0)
  const need = Math.ceil(stems.length / 2)

  const scored = rows
    .map((r) => {
      const matched = stems.filter((s) => r.stems.has(s))
      return { r, matched: matched.length, score: matched.reduce((n, s) => n + idf(s), 0) / total }
    })
    .filter((x) => x.matched >= need)
    .sort((a, b) => b.score - a.score || a.r.text.length - b.r.text.length || a.r.participantId.localeCompare(b.r.participantId) || a.r.turn - b.r.turn)

  const seen = new Set<string>()
  const perPerson = new Map<string, number>()
  for (const { r } of scored) {
    const same = `${r.sessionId}|${r.text.toLowerCase()}`
    if (seen.has(same) || (perPerson.get(r.participantId) ?? 0) >= PER_PERSON) continue
    seen.add(same)
    perPerson.set(r.participantId, (perPerson.get(r.participantId) ?? 0) + 1)
    const { stems: _drop, ...hit } = r
    void _drop
    result.hits.push(hit)
    if (result.hits.length === MAX_RESULTS) break
  }
  return result
}

// ─── the proposed code ──────────────────────────────────────────────────────

export type Proposal = {
  name: string
  definition: string
  /** The guide question most of the quotes fall under, or null: it goes in "New codes, not asked about in the guide". */
  questionId: string | null
  /** Where a code outside the guide is anchored, so it still has a position. */
  anchorQuestionId: string
  hits: Hit[]
  people: number
}

/** "pause as a reason to stay" to "Pause as a reason to stay". Never longer than a code name needs to be. */
export function nameFromIdea(idea: string): string {
  const t = idea.trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ')
  const cut = t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t
  return cut.charAt(0).toUpperCase() + cut.slice(1)
}

export const definitionFromIdea = (idea: string) => `Mentioned or described the idea “${idea.trim().replace(/[?.!]+$/, '')}”.`

/**
 * One proposed code from what was found. It sits under the guide question most of the quotes fall in, if at least half do;
 * otherwise outside the guide. If anyone was never asked that question (skipped), it also goes outside the guide, so its
 * "n of N" never counts someone who wasn't asked.
 */
export function proposalFor(scan: ScanResult, hits: Hit[] = scan.hits): Proposal | undefined {
  if (!hits.length) return undefined
  const byQuestion = new Map<string, number>()
  hits.forEach((h) => h.questionId && byQuestion.set(h.questionId, (byQuestion.get(h.questionId) ?? 0) + 1))
  const [top, n] = [...byQuestion.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  let questionId = top && n * 2 >= hits.length ? top : null
  if (questionId) {
    const q = CODE_QUESTIONS.find((x) => x.id === questionId)
    if (q?.skipped.some((s) => hits.some((h) => h.participantId === s.participantId))) questionId = null
  }
  const mid = hits.reduce((sum, h) => sum + h.fraction, 0) / hits.length
  return {
    name: nameFromIdea(scan.idea),
    definition: definitionFromIdea(scan.idea),
    questionId,
    anchorQuestionId: questionId ?? nearestQuestion(mid),
    hits,
    people: new Set(hits.map((h) => h.participantId)).size,
  }
}

/** Words of a quote that matched the idea, for highlighting in the list. */
export function matchedWords(text: string, stems: string[]): Set<string> {
  const out = new Set<string>()
  for (const m of text.match(WORD) ?? []) if (stems.includes(stem(m))) out.add(m.toLowerCase())
  return out
}

/** Accepted codes grouped by guide question, then the ones outside the guide, for the "current codes" list. */
export type CodeGroup = { id: string; label: string; codes: CodebookDoc['codes'] }
export function currentCodeGroups(doc: CodebookDoc): CodeGroup[] {
  const accepted = doc.codes.filter((c) => c.status === 'Accepted')
  const groups: CodeGroup[] = BY_POSITION.map((q) => ({ id: q.id, label: q.label, codes: accepted.filter((c) => !c.isNew && c.questionId === q.id) }))
  groups.push({ id: 'new', label: 'Outside the guide', codes: accepted.filter((c) => c.isNew) })
  return groups.filter((g) => g.codes.length)
}
