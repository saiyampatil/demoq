// The A3 report as a list of blocks, worked out from what the Researcher accepted in A1 and A2 every time. Nothing here is stored:
// the only thing kept is each block's decision (state/report.ts). Footer, rail dots and tab badges all read `counts` from here,
// so they cannot disagree.
//
// Blocks (Ice Cream has 12): 1 Executive summary; 2 Concept results (only if the study has stimuli and a concept line is accepted);
// one per guide question, in guide order; How people sounded (only if a theme insight is accepted); Tensions (only if a tension is
// Added); Where the evidence is thin (only if a guide question is Thin or Unanswered).
//
// A block is To review until the Researcher approves it or leaves it out. Approval records the fingerprint of what the block said.
// If its inputs change later it is Out of date, with the old words kept beside the new. Nothing is rewritten silently.
import { findingDraftsOf } from '@/mock/report'
import { conceptRows } from './concepts'
import { hash } from './hash'
import { themeSignals } from './signals'
import type { Basis, CodebookDoc } from './codebook'
import { execOf, type BlockDecision, type BlockStatus, type LineSnapshot, type ReportDoc } from './report'
import { acceptedItems, questionRows, type Accepted, type QuestionRow, type ReportInputs } from './reportInputs'
import { renderTemplate, representativeQuotes, strengthFor } from './reportLogic'
import { partsOf, verbatim, type Line, type PartKey } from './reportLines'
import { buildSummary, checkLine, strengthOf, type SummaryResult } from './reportSummary'
import { speechCoverageLine } from './reportCoverage'

export type BlockKind = 'exec' | 'concepts' | 'question' | 'sounded' | 'tensions' | 'thin'
export type StrengthLabel = 'Strong' | 'Thin' | 'Unanswered'
/** The code's own labels are Strong, Weak and Unanswered. The report says Thin for Weak. */
export const strengthLabel = (s: ReturnType<typeof strengthFor>): StrengthLabel => (s === 'Weak' ? 'Thin' : s)

export type Block = {
  /** "exec", "concepts", "q:{questionId}", "sounded", "tensions" or "thin". */
  id: string
  kind: BlockKind
  title: string
  /** Guide questions: the section it sits in, a quiet line above the question. */
  kicker?: string
  /** Guide questions: 1 to 7 in guide order. */
  number?: number
  lines: Line[]
  /** A short grey line under the bullets: face coverage, speech coverage. */
  footnote?: string
  /** Guide questions: how strong the finding is, and on how many people. */
  strength?: { label: StrengthLabel; n: number; of: number; notAsked: number }
  /** A Thin or unanswered question: the one line saying so. */
  flag?: string
  /** Guide questions: the quotes to show, by excerpt. */
  quotes?: string[]
  /** The executive summary: inputs the brief does not hold, and the empty state. */
  missing?: SummaryResult['missing']
  empty?: boolean
  /** The executive summary: which draft it shows. */
  draft?: 'ai' | 'mine'
  /** The researcher's own note on this block. */
  note?: string
  /** Open by default. The guide-question group is collapsed. */
  defaultOpen: boolean
  fingerprint: string
  status: BlockStatus
  decision?: BlockDecision
  /** Out of date: what the block said when it was approved. */
  was?: LineSnapshot[]
}

export type Counts = {
  total: number
  approved: number
  leftOut: number
  toReview: number
  outOfDate: number
  /** To review plus Out of date: what "Review m blocks" steps through. */
  undecided: number
  /** Approved plus Left out. */
  decided: number
  /** Every block is decided. */
  ready: boolean
}

export function countsOf(blocks: Block[]): Counts {
  const n = (s: BlockStatus) => blocks.filter((b) => b.status === s).length
  const c = { total: blocks.length, approved: n('Approved'), leftOut: n('Left out'), toReview: n('To review'), outOfDate: n('Out of date') }
  return { ...c, undecided: c.toReview + c.outOfDate, decided: c.approved + c.leftOut, ready: c.toReview + c.outOfDate === 0 && c.total > 0 }
}

/** "7 questions · 3 approved · 2 flagged thin": the header of the collapsed group. */
export function questionGroupSummary(blocks: Block[]): string {
  const qs = blocks.filter((b) => b.kind === 'question')
  const flagged = qs.filter((b) => b.strength && b.strength.label !== 'Strong').length
  return `${qs.length} ${qs.length === 1 ? 'question' : 'questions'} · ${qs.filter((b) => b.status === 'Approved').length} approved · ${flagged} flagged thin`
}

const fingerprintOf = (b: Pick<Block, 'kind' | 'lines' | 'footnote' | 'strength' | 'missing' | 'empty'>) =>
  hash(JSON.stringify({ k: b.kind, l: b.lines.map((l) => [l.id, l.text, !!l.directional]), f: b.footnote ?? '', s: b.strength ?? null, m: b.missing ?? [], e: !!b.empty }))

/** Where a block stands, from the Researcher's decision on it. A left-out block stays left out. */
export function statusOf(fingerprint: string, d: BlockDecision | undefined): BlockStatus {
  if (!d) return 'To review'
  if (d.status === 'Left out') return 'Left out'
  return d.fingerprint === fingerprint ? 'Approved' : 'Out of date'
}

/** The one line saying a guide question is thin, written from its strength and the validator's rules. */
export function thinText(q: Pick<QuestionRow, 'n' | 'of' | 'notAsked'>): string {
  // "No one answered" only when no one did. One person is Unanswered by the strength rule, but it is one person.
  if (q.n === 0) return q.notAsked > 0 ? `No one answered; ${q.notAsked} of ${q.of} people were not asked.` : 'No one answered.'
  return q.notAsked > 0 ? `Only ${q.n} of ${q.of} people answered; ${q.notAsked} ${q.notAsked === 1 ? 'person was' : 'people were'} not asked.` : `Only ${q.n} of ${q.of} people answered.`
}

const thinLine = (q: QuestionRow): Line => verbatim(`thin:${q.id}`, thinText(q), 'Analysis', { type: 'question', id: q.id, codeIds: q.codeIds }, { lead: q.label })

const digits = (t: string) => (t.match(/\d+/g) ?? []).join(',')
/** What is wrong with a changed sentence: the numbers are locked, and it must pass the same rules as the generated one. Empty when fine. */
export function checkEdit(line: Pick<Line, 'text' | 'tag' | 'source'>, text: string): string[] {
  const problems: string[] = []
  if (digits(text) !== digits(line.text)) problems.push('The numbers are locked. Change the words around them, not the numbers.')
  if (!text.trim()) problems.push('A sentence cannot be empty.')
  return [...problems, ...checkLine({ text, tag: line.tag, source: line.source })]
}

export type ReportModel = {
  inputs: ReportInputs
  accepted: Accepted
  rows: QuestionRow[]
  summary: SummaryResult
  blocks: Block[]
  counts: Counts
}

/** The whole report as it stands. `report` carries the Researcher's decisions (none yet when undefined). */
export function reportModel(a: { studyId: string; doc: CodebookDoc; basis: Basis; inputs: ReportInputs; report?: ReportDoc }): ReportModel {
  const { doc, basis, inputs, report } = a
  const accepted = acceptedItems(doc, basis, inputs)
  const rows = questionRows(doc, basis, inputs)
  const summary = buildSummary(inputs, accepted, rows)
  const drafts = findingDraftsOf(doc.studyId)
  const ctx = { doc, basis }
  const blocks: Block[] = []
  const edits = report?.edits ?? {}
  // The Researcher's wording replaces a generated sentence only while its numbers are still the generated ones.
  const worded = (lines: Line[]): Line[] => lines.map((l) => (edits[l.id] && edits[l.id] !== l.text && digits(edits[l.id]) === digits(l.text) ? { ...l, text: edits[l.id], parts: partsOf(edits[l.id]), edited: true } : l))
  const add = (b: Omit<Block, 'fingerprint' | 'status' | 'decision' | 'was'>) => {
    b = { ...b, note: report?.notes?.[b.id] }
    const fingerprint = fingerprintOf(b)
    const decision = report?.decisions[b.id]
    const status = statusOf(fingerprint, decision)
    blocks.push({ ...b, fingerprint, status, decision, was: status === 'Out of date' ? decision?.snapshot : undefined })
  }

  // 1. Executive summary.
  const ex = execOf(report ?? ({ exec: undefined } as ReportDoc))
  const mine: Line[] = (['study', 'who', 'found', 'firm'] as PartKey[]).filter((k) => ex.mine[k]?.trim()).map((k) => ({ id: `mine-${k}`, text: ex.mine[k]!.trim(), parts: partsOf(ex.mine[k]!.trim()), tag: 'Analysis' as const, source: { type: 'mine' as const }, part: k }))
  add({ id: 'exec', kind: 'exec', title: 'Executive summary', lines: ex.active === 'mine' ? mine : worded(summary.lines.map((l) => ({ ...l }))), missing: ex.active === 'mine' ? undefined : summary.missing, empty: ex.active === 'mine' ? false : summary.empty, draft: ex.active, defaultOpen: true })

  // 2. Concept results: only if the study has stimuli and a concept line is accepted.
  const concepts = conceptRows(doc, basis)
  if (inputs.stimuli.length && accepted.concepts.length && concepts) {
    const c = concepts.coverage
    add({
      id: 'concepts',
      kind: 'concepts',
      title: 'Concept results',
      lines: accepted.concepts.map((x) => verbatim(`concept:${x.id.replace(/^concept:/, '')}`, x.text, 'Analysis', { type: 'concept', id: x.id.replace(/^concept:/, ''), name: x.name })),
      footnote: `Faces read at the reveal for ${c.read} of ${c.people} people${c.audioOnly ? ` · ${c.audioOnly} audio-only, not read` : ''}${c.noConsent ? ` · ${c.noConsent} did not consent` : ''}.`,
      defaultOpen: true,
    })
  }

  // 3. One block per guide question, in guide order.
  rows.forEach((q, i) => {
    const codes = doc.codes.filter((c) => c.questionId === q.id && c.status === 'Accepted')
    const accepted = new Set(codes.map((c) => c.id))
    const sentences = (drafts[q.id] ?? [])
      .filter((s) => s.cites.filter((c) => c.kind === 'code').every((c) => accepted.has(c.id)))
      .map((s) => ({ s, text: renderTemplate(s.template, ctx) }))
      .filter((x) => !x.text.includes('[?]'))
      .slice(0, 3)
    const label = strengthLabel(strengthFor(q.n, q.notAsked > 0))
    add({
      id: `q:${q.id}`,
      kind: 'question',
      title: q.text,
      kicker: q.section,
      number: i + 1,
      lines: worded(sentences.map((x) => verbatim(x.s.id, x.text, 'Analysis', { type: 'question', id: q.id, codeIds: x.s.cites.filter((c) => c.kind === 'code').map((c) => c.id) }))),
      strength: { label, n: q.n, of: q.of, notAsked: q.notAsked },
      flag: label === 'Strong' ? undefined : thinText(q),
      quotes: representativeQuotes(codes, basis, 2).map((x) => x.excerpt.id),
      defaultOpen: false,
    })
  })

  // 4. How people sounded: one bullet per accepted theme insight, led by the theme name.
  if (accepted.themes.length) {
    const order = themeSignals(doc, basis).map((t) => t.id)
    const themes = [...accepted.themes].sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id))
    add({
      id: 'sounded',
      kind: 'sounded',
      title: 'How people sounded',
      lines: themes.map((x) => verbatim(`theme:${x.id}`, x.text, 'Analysis', { type: 'theme', id: x.id, name: x.name }, { lead: x.name })),
      footnote: speechCoverageLine(inputs.coverage),
      defaultOpen: true,
    })
  }

  // 5. Tensions: one bullet per Added tension, led by its type, with the Directional tag where A2 says so.
  if (accepted.tensions.length) {
    add({
      id: 'tensions',
      kind: 'tensions',
      title: 'Tensions',
      lines: accepted.tensions.map((x) => verbatim(`tension:${x.id}`, x.text, 'Analysis', { type: 'tension', id: x.id, kind: x.name }, { lead: x.name, directional: x.directional || undefined })),
      defaultOpen: true,
    })
  }

  // 6. Where the evidence is thin: one bullet per guide question that is Thin or Unanswered.
  const thin = rows.filter((q) => strengthOf(q) !== 'Strong')
  if (thin.length) add({ id: 'thin', kind: 'thin', title: 'Where the evidence is thin', lines: thin.map(thinLine), defaultOpen: true })

  return { inputs, accepted, rows, summary, blocks, counts: countsOf(blocks) }
}

