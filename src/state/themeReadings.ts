// A2's output: one reading per theme. PulseAI suggests a label and a short statement from the theme's own counts; the Researcher accepts,
// edits the wording, changes the label with a reason, or leaves it out. Nothing is accepted on its own, and nothing is rewritten silently:
// when the counts under an accepted reading change, it is Out of date and shows what moved.
//
// The counts are the theme's own, never recomputed here: R people with a claim (argued for it or complained), P whose delivery pulled
// against their words, U uncertain, M matched, each person once per theme (ThemeSignal.fit, from rollupPoints).

import { READINGS, type ReadingLabel } from '@/config/readings'
import { hash } from './audioScript'
import type { CodebookDoc, ReadingDecision } from './codebook'
import { faceOf, fitOf, type FitPattern } from './emotion'
import { checkNarration } from './narration'
import type { CodeSignal, Tension, ThemeSignal } from './signals'

export type Nums = { n: number; R: number; P: number; U: number; M: number; positive: number; negative: number; facts: number; audio: number; faces: number }
export type CodeNums = { id: string; name: string; verdict: FitPattern; R: number; P: number; U: number; M: number; positive: number; negative: number }
export type ReadingInput = { nums: Nums; codes: CodeNums[]; tensions: { id: string; title: string }[] }
export type Snap = { R: number; P: number; U: number; M: number; label: ReadingLabel }
export type Reading = { label: ReadingLabel; lines: string[]; coverage: string; nums: Nums; codes: CodeNums[]; tensions: { id: string; title: string }[]; fingerprint: string; snap: Snap; problems: string[] }

const more = (x: number, of: number) => x > of * READINGS.majority
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** "argued for it", "complained" or "argued for it or complained", from who made a claim. */
export const claimWord = (positive: number, negative: number) => (positive && negative ? 'argued for it or complained' : positive ? 'argued for it' : 'complained')

/** The label: the first rule that matches wins. */
export function labelOf({ nums: x, codes }: Pick<ReadingInput, 'nums' | 'codes'>): ReadingLabel {
  if (x.positive + x.negative === 0) return 'Stated, not argued'
  if (x.R < READINGS.minClaim) return 'Too few to read'
  const big = (v: FitPattern) => codes.some((c) => c.verdict === v && c.R >= READINGS.splitMinPeople)
  if (big('Consistent') && big('Conflicting')) return 'Split inside the theme'
  if (more(x.M, x.R)) return 'Said and meant'
  if (more(x.P, x.R)) return 'Said, not backed'
  return x.P >= x.U ? 'Partly backed' : 'Said, but unsure'
}

function firstLine(label: ReadingLabel, x: Nums, codes: CodeNums[]): string {
  const claim = claimWord(x.positive, x.negative)
  switch (label) {
    case 'Stated, not argued':
      return `All ${x.n} described what happened. Nobody argued for or against it, so there is no delivery to test.`
    case 'Too few to read':
      return `Only ${x.R} of ${x.n} had a claim with a readable delivery.`
    case 'Said and meant':
      return `${x.M} of ${x.R} who ${claim} sounded and looked like they meant it.`
    case 'Said, not backed':
      return `${x.P} of ${x.R} who ${claim} didn’t sound or look like they meant it.`
    case 'Partly backed':
      return `Of the ${x.R} who ${claim}, ${list([x.M ? `${x.M} sounded and looked like they meant it` : '', x.P ? `${x.P} ${x.M ? 'didn’t' : 'didn’t sound or look like they meant it'}` : '', x.U ? `${x.U} ${x.U === 1 ? 'was' : 'were'} unsure` : ''].filter(Boolean))}.`
    case 'Said, but unsure':
      return `Of the ${x.R} who ${claim}, ${list([x.U ? `${x.U} sounded unsure` : '', x.P ? `${x.P} didn’t sound like they meant it` : '', x.M ? `${x.M} ${x.P ? 'did' : 'sounded like they meant it'}` : ''].filter(Boolean))}.`
    case 'Split inside the theme': {
      const a = codes.filter((c) => c.verdict === 'Consistent' && c.R >= READINGS.splitMinPeople).sort((p, q) => q.M / q.R - p.M / p.R)[0]
      const b = codes.filter((c) => c.verdict === 'Conflicting' && c.R >= READINGS.splitMinPeople).sort((p, q) => q.P / q.R - p.P / p.R)[0]
      return `“${a.name}” reads as meant (${a.M} of ${a.R}); “${b.name}” doesn’t (${b.P} of ${b.R}).`
    }
  }
}

/** Where the gap sits: the codes whose people pulled against their words (or, with none, were unsure), at most two. */
function gapLine(x: Nums, codes: CodeNums[]): string | undefined {
  if (!x.P && !x.U) return undefined
  const by = x.P ? 'P' : 'U'
  const top = codes.filter((c) => c[by] > 0).sort((a, b) => b[by] / b.R - a[by] / a.R || b[by] - a[by]).slice(0, READINGS.gapCodes)
  if (!top.length) return undefined
  const what = by === 'P' ? 'pulled against their words' : 'were unsure'
  if (top.length === 1) {
    const c = top[0]
    return `The gap sits in “${c.name}”: ${c[by]} of the ${c.R} who ${claimWord(c.positive, c.negative)} ${what}.`
  }
  return `The gap sits in “${top[0].name}” (${top[0][by]} of ${top[0].R}) and “${top[1].name}” (${top[1][by]} of ${top[1].R}), who ${what}.`
}

/** The reading for a theme, from its counts. Pure. Every line passes the shared narration validator; problems are listed, never hidden. */
export function readingFrom(input: ReadingInput): Reading {
  const { nums: x, codes, tensions } = input
  const label = labelOf(input)
  const lines = [firstLine(label, x, codes)]
  if (label !== 'Stated, not argued' && label !== 'Too few to read') {
    const gap = gapLine(x, codes)
    if (gap) lines.push(gap)
    const third = [
      ...tensions.map((t) => `Related tension: ${t.title.replace(/\.$/, '')}.`),
      x.U >= x.R * READINGS.hesitationShare && x.U > 0 && label !== 'Said, but unsure' ? `${x.U} of ${x.R} hesitated while saying it.` : '',
    ].filter(Boolean)
    if (third.length) lines.push(third.join(' '))
  }
  const coverage = [x.facts ? `${x.facts} only stated a fact` : '', x.audio ? `${x.audio} audio-only, read on speech` : '', x.R ? `faces read for ${x.faces} of ${x.R}` : ''].filter(Boolean).join(' · ')
  const problems = lines.flatMap((l) => checkNarration(l, { maxWords: READINGS.maxWords, figuresAllowed: READINGS.figuresAllowed }).problems.map((p) => `${p}: “${l}”`))
  const snap: Snap = { R: x.R, P: x.P, U: x.U, M: x.M, label }
  const fingerprint = hash(JSON.stringify({ R: x.R, P: x.P, U: x.U, M: x.M, c: codes.map((c) => [c.id, c.verdict]), t: tensions.map((t) => t.id) }))
  return { label, lines, coverage, nums: x, codes, tensions, fingerprint, snap, problems }
}

/** The counts of a code, for the label rules and the gap line. */
export function codeNums(c: CodeSignal): CodeNums {
  return {
    id: c.code.id,
    name: c.code.name,
    verdict: c.readable ? c.fit.pattern : 'Too few to read',
    R: c.fit.n,
    P: c.fit.against,
    U: c.fit.uncertain,
    M: c.fit.fits,
    positive: c.points.filter((p) => p.stance === 'Positive').length,
    negative: c.points.filter((p) => p.stance === 'Negative').length,
  }
}

/** The tensions that touch a theme: they use at least one of its codes. Accepted ones (added as a tension theme) feed the statement. */
export const tensionsOfTheme = (t: Pick<ThemeSignal, 'codes'>, tensions: Tension[]) => {
  const ids = new Set(t.codes.map((c) => c.code.id))
  return tensions.filter((x) => x.codeIds.some((id) => ids.has(id)))
}

/** The reading for a theme in the app: its counts from A2's theme profile, its codes' verdicts, and the accepted tensions on it. */
export function readingOf(t: ThemeSignal, doc: CodebookDoc, tensions: Tension[]): Reading {
  const claimants = t.points.filter((p) => fitOf(p, faceOf(p, doc)).fit)
  const nums: Nums = {
    n: t.people,
    R: t.fit.n,
    P: t.fit.against,
    U: t.fit.uncertain,
    M: t.fit.fits,
    positive: t.stances.Positive,
    negative: t.stances.Negative,
    facts: t.stances.Neutral,
    audio: claimants.filter((p) => !faceOf(p, doc)).length,
    faces: claimants.filter((p) => faceOf(p, doc)?.emotion).length,
  }
  const accepted = tensionsOfTheme(t, tensions).filter((x) => x.status === 'Added as a tension theme').map((x) => ({ id: x.id, title: x.title }))
  return readingFrom({ nums, codes: t.codes.map(codeNums), tensions: accepted })
}

// ─── the Researcher's decision ──────────────────────────────────────────────

export type ReadingStatus = 'Suggested' | 'Accepted' | 'Edited' | 'Label changed' | 'Left out' | 'Out of date'

export function statusOf(d: ReadingDecision | undefined, r: Reading): ReadingStatus {
  if (!d) return 'Suggested'
  if (d.fingerprint !== r.fingerprint) return 'Out of date'
  if (d.status === 'Left out') return 'Left out'
  if (d.label) return 'Label changed'
  if (d.text) return 'Edited'
  return 'Accepted'
}
/** Goes to the report: accepted, edited or relabelled, and still in date. */
export const isAccepted = (s: ReadingStatus) => s === 'Accepted' || s === 'Edited' || s === 'Label changed'
/** Waiting for the Researcher: never reviewed, or reviewed and then the counts moved. */
export const needsReview = (s: ReadingStatus) => s === 'Suggested' || s === 'Out of date'

/** What the reading says now: the Researcher's wording if they edited it, otherwise PulseAI's. */
export const linesOf = (d: ReadingDecision | undefined, r: Reading) => (d?.text && d.fingerprint === r.fingerprint ? d.text : r.lines)
export const labelShown = (d: ReadingDecision | undefined, r: Reading): ReadingLabel => (d?.label && d.fingerprint === r.fingerprint ? d.label : r.label)

/** Numbers are locked: an edit keeps every number PulseAI wrote, in the same order, and passes the validator. Empty when it can be saved. */
export function editProblems(ai: string[], edited: string[]): string[] {
  const nums = (ls: string[]) => ls.join(' ').match(/\d+/g)?.join(',') ?? ''
  const out: string[] = []
  if (!edited.length || edited.every((l) => !l.trim())) out.push('Write something, or cancel')
  if (edited.length > 3) out.push('At most three lines')
  if (nums(edited) !== nums(ai)) out.push(`The numbers are locked. Keep ${nums(ai).split(',').filter(Boolean).join(', ') || 'no numbers'}, in that order`)
  edited.forEach((l) => checkNarration(l, { maxWords: READINGS.maxWords, figuresAllowed: READINGS.figuresAllowed }).problems.forEach((p) => out.push(p)))
  return out
}

/** A decision as it is saved: who, when and the data version it was made on. The version moves on when the counts under it changed. */
export function decisionFor(r: Reading, prev: ReadingDecision | undefined, by: string, sessions: number, part: Partial<ReadingDecision> & Pick<ReadingDecision, 'status'>): ReadingDecision {
  const version = !prev ? 1 : prev.fingerprint === r.fingerprint ? prev.version : prev.version + 1
  return { ...part, by, at: new Date().toISOString(), fingerprint: r.fingerprint, snap: r.snap, sessions, version, aiLines: r.lines }
}
