// The A3 executive summary: written by code from a template, never by a model. Same idea as the A2 insight sentences: fixed wording with
// the numbers filled in, so nothing can say more than the data does. Findings only.
//
// INPUTS, and nothing else: the approved brief, the approved guide's stimuli, who took part, and ONLY the A2 items the Researcher
// accepted (theme insights, concept lines, tensions added as a tension theme), plus each guide question's strength. Anything not
// accepted, or Out of date, is never used.
//
// A  The study         "{Client} is deciding {decision}." "This study tested {the concepts}."
// B  Who took part     "{N} people took part in {AI-led} interviews, {n} {group} and {n} {group}."
// C  What we found     up to four sentences, one per selected accepted item, led by the brief's primary objective
// D  How firm this is  one sentence: what the evidence is thin on, only if there is something to say
// E  Implications      the Researcher's own field. Never written here, never counted here.
import { VERDICT_LABEL } from '@/config/delivery'
import { checkNarration, words } from './narration'
import type { Item, ReportInputs, QuestionRow, Accepted, ThemeFacts, ConceptFacts } from './reportInputs'
import type { Line, Part, PartKey } from './reportLines'
import { fig, lineOf, partsOf, txt } from './reportLines'
import { strengthFor } from './reportLogic'

export const MAX_SENTENCE_WORDS = 25
/** The summary as a whole: 120 to 220 words is the target, 250 the hard cap. */
export const SUMMARY_WORDS = { target: [120, 220], cap: 250 } as const
/** How many accepted items the "What we found" part carries. */
export const MAX_FOUND = 4

export const PART_LABEL: Record<PartKey, string> = { study: 'The study', who: 'Who took part', found: 'What we found', firm: 'How firm this is' }

// ─── the validator ──────────────────────────────────────────────────────────
// Failures block the sentence. It wraps the shared narration validator (never loosened here) and adds what only this page needs.

const FACE_LABELS = /\b(Delight|Interest|Surprise|Neutral|Confusion|Doubt|Frustration)\b|\breads? as\b/
const NEVER_SHOWN = ['emotion score', 'high emotion', 'micro-expression', 'signals', 'fits', 'uncertain']
const ADVICE = ['launch it']

/** What is wrong with one sentence of the report, in words. Empty when it passes. */
export function checkLine(l: Pick<Line, 'text' | 'tag' | 'source'>, o: { maxWords?: number } = {}): string[] {
  const problems = [...checkNarration(l.text, { maxWords: o.maxWords ?? MAX_SENTENCE_WORDS, figuresAllowed: 1 }).problems]
  if (!l.source) problems.push('No source')
  if (!l.tag) problems.push('No tag (Brief, Setup or Analysis)')
  if (FACE_LABELS.test(l.text)) problems.push('Names a face reading')
  NEVER_SHOWN.forEach((w) => new RegExp(`\\b${w}\\b`, 'i').test(l.text) && problems.push(`Uses “${w}”`))
  ADVICE.forEach((w) => new RegExp(`\\b${w}\\b`, 'i').test(l.text) && problems.push(`Reads as advice (“${w}”)`))
  // "Most" means more than half, wherever it appears, and the sentence must carry the figure that shows it.
  if (/\bmost\b/i.test(l.text)) {
    const fs = [...l.text.matchAll(/(\d+) of (?:the |those )?(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    if (!fs.some(([n, of]) => n * 2 > of)) problems.push('Says “most” without more than half')
  }
  return problems
}

// ─── selection (code, not the AI) ───────────────────────────────────────────

export type Selected = { item: Item; objectiveId?: string }

const rank = (a: Item, b: Item) => b.people - a.people || Number(b.gap) - Number(a.gap) || Number(b.kind === 'tension') - Number(a.kind === 'tension') || a.id.localeCompare(b.id)
const KIND_ORDER: Record<string, number> = { concept: 0, tension: 1, theme: 2 }

/** The objectives in the order the summary reads them: the primary one first, then the guide's own order. */
export const orderedObjectives = (i: Pick<ReportInputs, 'objectives' | 'primaryObjective'>) => [...i.objectives].sort((a, b) => Number(b.id === i.primaryObjective) - Number(a.id === i.primaryObjective))

const objectivesOf = (item: Item, i: Pick<ReportInputs, 'questionObjective'>) => [...new Set(item.questionIds.map((q) => i.questionObjective[q]).filter((x): x is string => !!x))]

/**
 * For each objective, its strongest accepted item (most people, then a Gap or Mixed verdict, then a tension). Then the remaining
 * slots, up to four in all, from accepted concept lines, then tensions, then the largest accepted themes.
 * An objective with no accepted item at all is returned in `unmet`: it goes to "How firm this is".
 */
export function selectItems(a: Accepted, i: Pick<ReportInputs, 'objectives' | 'primaryObjective' | 'questionObjective'>): { chosen: Selected[]; unmet: { id: string; text: string }[] } {
  const all = [...a.concepts, ...a.tensions, ...a.themes]
  const objectives = orderedObjectives(i)
  const chosen: Selected[] = []
  const unmet: { id: string; text: string }[] = []
  for (const o of objectives) {
    const mapped = all.filter((x) => objectivesOf(x, i).includes(o.id))
    if (!mapped.length) {
      unmet.push(o)
      continue
    }
    const best = mapped.filter((x) => !chosen.some((c) => c.item.id === x.id)).sort(rank)[0]
    if (best && chosen.length < MAX_FOUND) chosen.push({ item: best, objectiveId: o.id })
  }
  for (const kind of ['concept', 'tension', 'theme'] as const) {
    const pool = (kind === 'concept' ? a.concepts : kind === 'tension' ? a.tensions : a.themes).filter((x) => !chosen.some((c) => c.item.id === x.id)).sort(rank)
    for (const x of pool) if (chosen.length < MAX_FOUND) chosen.push({ item: x, objectiveId: objectivesOf(x, i)[0] })
  }
  const at = (s: Selected) => {
    const idx = objectives.findIndex((o) => o.id === s.objectiveId)
    return idx < 0 ? 99 : idx
  }
  chosen.sort((x, y) => at(x) - at(y) || KIND_ORDER[x.item.kind] - KIND_ORDER[y.item.kind] || rank(x.item, y.item))
  return { chosen, unmet }
}

// ─── the sentences ──────────────────────────────────────────────────────────

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const figOf = (n: number, of: number) => `${n} of ${of}`

/** Sentences for one accepted item, best wording first. The first one that passes the validator is used. One base each. */
function candidates(item: Item): Part[][] {
  const f = item.facts
  if (f.type === 'theme') {
    const t = f as ThemeFacts
    const lead = `On “${item.name}”, `
    const verbal = [fig(figOf(t.n, t.of)), txt(' people were verbally positive about it')]
    if (t.verdict === VERDICT_LABEL.Consistent) return [[txt(lead), ...verbal, txt(', and their delivery backed it up.')], [...verbal, txt(', and their delivery backed it up.')]]
    return [[txt(lead), ...verbal, txt(', but some of them sounded flat or tense.')], [txt(lead), ...verbal, txt(', but some sounded flat or tense.')], [...verbal, txt(', but some sounded flat or tense.')]]
  }
  if (f.type === 'concept') {
    const c = f as ConceptFacts
    const base = c.did ? [fig(figOf(c.did.n, c.did.of)), txt(` people chose ${item.name} to take home`)] : c.said ? [fig(figOf(c.said.n, c.said.of)), txt(` people said they would pick ${item.name} first`)] : undefined
    if (!base) return []
    if (c.match === 'Agrees') return [[...base, txt(', and what people said, did and showed on video agree.')], [...base, txt(', and the measures agree.')]]
    if (c.match === 'Differs') return [[...base, txt(', but what people said, did and showed on video do not all agree.')], [...base, txt(', but the measures do not all agree.')]]
    return [[...base, txt('.')]]
  }
  // A tension's sentence is the shared one: one base, written by tensionLines.
  return [partsOf(item.text)]
}

function foundLines(sel: Selected[], blocked: Blocked[]): Line[] {
  const out: Line[] = []
  for (const { item } of sel) {
    const source = item.kind === 'theme' ? ({ type: 'theme', id: item.id, name: item.name } as const) : item.kind === 'concept' ? ({ type: 'concept', id: item.id.replace(/^concept:/, ''), name: item.name } as const) : ({ type: 'tension', id: item.id, kind: item.name } as const)
    let used = false
    for (const parts of candidates(item)) {
      const line = lineOf(`exec-c-${item.id}`, parts, 'Analysis', source, { part: 'found', directional: item.directional || undefined })
      const problems = checkLine(line)
      if (!problems.length) {
        out.push(line)
        used = true
        break
      }
      blocked.push({ id: line.id, text: line.text, problems })
    }
    if (!used) continue
  }
  return out
}

export type Blocked = { id: string; text: string; problems: string[] }

/** A guide question is thin when too few people answered or some were not asked. */
export const strengthOf = (q: Pick<QuestionRow, 'n' | 'notAsked'>) => strengthFor(q.n, q.notAsked > 0)

/** The one sentence under "How firm this is". Names the first two things the evidence is thin on, then says how many more. */
export function firmness(i: Pick<ReportInputs, 'objectives' | 'primaryObjective'>, rows: QuestionRow[], unmet: { id: string; text: string }[], directional: boolean, accepted: boolean): Line | undefined {
  const thin = rows.filter((q) => strengthOf(q) !== 'Strong')
  const names: { name: string; qs: string[]; os: string[] }[] = []
  for (const o of orderedObjectives(i)) {
    const qs = thin.filter((q) => q.objectiveId === o.id)
    if (qs.length) names.push({ name: lowerFirst(qs.map((q) => q.label).join(' and ')), qs: qs.map((q) => q.id), os: [o.id] })
    else if (unmet.some((u) => u.id === o.id) && accepted) names.push({ name: lowerFirst(o.text), qs: [], os: [o.id] })
  }
  // Questions that belong to no objective (a study with no mapping) still count.
  thin.filter((q) => !q.objectiveId || !orderedObjectives(i).some((o) => o.id === q.objectiveId)).forEach((q) => names.push({ name: lowerFirst(q.label), qs: [q.id], os: [] }))
  const shown = names.slice(0, 2)
  const more = names.length - shown.length
  const source = { type: 'firmness' as const, questionIds: thin.map((q) => q.id), objectiveIds: names.flatMap((n) => n.os) }
  const build = (small: boolean): Line | undefined => {
    if (!shown.length && !small) return undefined
    const head = shown.length ? [txt(`Evidence is thin on ${more > 0 ? shown.map((s) => s.name).join(', ') : listOf(shown.map((s) => s.name))}`), ...(more > 0 ? [txt(' and '), fig(String(more)), txt(' more')] : [])] : []
    const tail = small ? [txt(shown.length ? '; some findings rest on groups under 10 people.' : 'Some findings rest on groups under 10 people.')] : [txt('.')]
    return lineOf('exec-d', [...head, ...tail], 'Analysis', source, { part: 'firm' })
  }
  // The small-group clause is added only when it still fits, and the sentence stays one.
  const withSmall = directional ? build(true) : undefined
  if (withSmall && !checkLine(withSmall).length) return withSmall
  const plain = build(false)
  return plain && !checkLine(plain).length ? plain : undefined
}

export type SummaryResult = {
  lines: Line[]
  /** Inputs the brief or the study does not hold. The sentence that needs one is left out; "Add this in the brief" shows at the top. */
  missing: ('client' | 'objective' | 'decision')[]
  /** Sentences the validator stopped, with why. Never shown to the client. */
  blocked: Blocked[]
  /** No accepted item at all: the empty state, not a summary. */
  empty: boolean
  chosen: Selected[]
  unmet: { id: string; text: string }[]
  words: number
}

export function buildSummary(i: ReportInputs, a: Accepted, rows: QuestionRow[]): SummaryResult {
  const blocked: Blocked[] = []
  const lines: Line[] = []
  const missing: SummaryResult['missing'] = []
  const empty = a.themes.length + a.concepts.length + a.tensions.length === 0
  const push = (l: Line) => {
    const problems = checkLine(l)
    if (problems.length) blocked.push({ id: l.id, text: l.text, problems })
    else lines.push(l)
  }

  // A. The study.
  if (!i.client) missing.push('client')
  if (!i.objective) missing.push('objective')
  if (!i.decision) missing.push('decision')
  if (i.client && i.objective && i.decision) push(lineOf('exec-a1', [txt(`${i.client} is deciding ${i.decision}.`)], 'Brief', { type: 'brief', section: 'objective' }, { part: 'study' }))
  if (i.stimuli.length) push(lineOf('exec-a2', [txt(`This study tested ${listOf(i.stimuli)}.`)], 'Setup', { type: 'setup', what: 'stimuli' }, { part: 'study' }))

  // B. Who took part.
  if (i.people > 0) {
    const [g1, g2] = i.segments
    const split = g1 && g2 && g1.n + g2.n > 0 ? [txt(', '), fig(String(g1.n)), txt(` ${g1.noun} and `), fig(String(g2.n)), txt(` ${g2.noun}`)] : []
    push(lineOf('exec-b', [fig(String(i.people)), txt(` people took part in ${i.mode === 'ai' ? 'AI-led' : 'human-led'} interviews`), ...split, txt('.')], 'Setup', { type: 'setup', what: 'sessions' }, { part: 'who' }))
  }

  // C. What we found, then D. how firm this is.
  const { chosen, unmet } = selectItems(a, i)
  if (!empty) {
    const found = foundLines(chosen, blocked)
    lines.push(...found)
    const directional = chosen.some((c) => c.item.directional)
    const d = firmness(i, rows, unmet, directional, true)
    if (d) lines.push(d)
  }

  const fitted = fitToCap(lines)
  return { lines: fitted.lines, missing, blocked, empty, chosen, unmet, words: fitted.words }
}

/**
 * The hard cap: while the summary is over it, drop the last finding. Each sentence is at most 25 words and there are at most
 * 2 + 1 + 4 + 1 of them, so the generator cannot reach the cap on its own; this is the guard if a limit above is ever raised.
 */
export function fitToCap(lines: Line[], cap: number = SUMMARY_WORDS.cap): { lines: Line[]; words: number } {
  const out = [...lines]
  let total = out.reduce((n, l) => n + words(l.text), 0)
  while (total > cap) {
    const idx = out.map((l) => l.part).lastIndexOf('found')
    if (idx < 0) break
    total -= words(out[idx].text)
    out.splice(idx, 1)
  }
  return { lines: out, words: total }
}

