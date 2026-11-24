// What the A3 report is made from, and ONLY this: the approved brief, the approved guide's stimuli and objectives, who took part, and
// the A2 items the Researcher has accepted (theme insights, concept lines, tensions added as a tension theme). Anything not accepted,
// and anything Out of date, is never read. Pure functions: no React, nothing stored.
import { VERDICT_LABEL } from '@/config/delivery'
import { reportPackOf } from '@/mock/reportPacks'
import { hasVideo } from '@/mock/emotion'
import { segmentOf, segmentsOf } from '@/mock/studyAnalysis'
import { questionsOf } from '@/mock/codebook'
import type { BriefDoc } from './brief'
import type { GuideDoc } from './guide'
import { codeThemes, peopleOf, tensionDecisions, themeCodes, type Basis, type CodebookDoc } from './codebook'
import { conceptRows } from './concepts'
import { coverage as coverageOf, themeSignals, tensionLines, tensionsOf, type Coverage } from './signals'

export type Objective = { id: string; text: string }

/** What the summary needs from outside the analysis. A missing field is left missing and its sentence is left out. Nothing is guessed. */
export type ReportInputs = {
  studyId: string
  client?: string
  /** The approved brief's research objective, in its own words. */
  objective?: string
  /** The decision, from the study's report pack (in production the AI paraphrases the approved brief). */
  decision?: string
  primaryObjective?: string
  /** The approved guide's objectives, in guide order. */
  objectives: Objective[]
  questionObjective: Record<string, string>
  pickQuestion?: string
  /** Names of the concepts the approved guide shows. */
  stimuli: string[]
  mode: 'ai' | 'human'
  /** People in accepted sessions. */
  people: number
  /** The two groups, in reading order: the lower-case noun and how many people. */
  segments: { label: string; noun: string; n: number }[]
  /** Faces read at the concept reveals, and speech read, from the accepted sessions. */
  coverage: Coverage
}

/** The brief's objective as it was approved, or the latest version if none is marked approved. */
export function approvedObjective(brief: BriefDoc | undefined): string | undefined {
  if (!brief) return undefined
  const v = brief.versions.find((x) => x.number === brief.approval?.version) ?? brief.versions.at(-1)
  const t = v?.sections.objective?.text?.trim()
  return t ? t : undefined
}

export function reportInputs(o: { studyId: string; client?: string; brief?: BriefDoc; guide?: GuideDoc; basis: Basis; excluded?: number }): ReportInputs {
  const pack = reportPackOf(o.studyId)
  const seg = segmentsOf(o.studyId)
  const people = [...o.basis.participants]
  const count = (key: string) => people.filter((p) => segmentOf(p) === key).length
  const stimuli = (o.guide?.stimuli.items ?? []).filter((s) => s.kind === 'concept' && s.active).map((s) => s.name.replace(/^Concept [A-Z]:\s*/, ''))
  return {
    studyId: o.studyId,
    client: o.client?.trim() || undefined,
    objective: approvedObjective(o.brief),
    decision: pack?.decision,
    primaryObjective: pack?.primaryObjective,
    objectives: o.guide?.guide?.objectives.map((x) => ({ id: x.id, text: x.text })) ?? [],
    questionObjective: pack?.questionObjective ?? {},
    pickQuestion: pack?.pickQuestion,
    stimuli,
    mode: o.guide?.moderator.mode ?? 'ai',
    people: people.length,
    segments: [seg.first, seg.second].map((g) => ({ label: g.label, noun: g.noun, n: count(g.key) })),
    coverage: coverageOf(people.map((p) => ({ media: hasVideo(p) ? ('Video' as const) : ('Audio only' as const) })), o.excluded ?? 0),
  }
}

// ─── the accepted A2 items ──────────────────────────────────────────────────

export type ItemKind = 'theme' | 'concept' | 'tension'

/** One thing the Researcher accepted in A2, with the sentence they accepted. `text` is verbatim: for a theme or a concept it is the wording they approved (or edited), for a tension the shared tension sentence. */
export type Item = {
  /** Theme ID, concept key ("concept:m-concept-a") or tension ID. */
  id: string
  kind: ItemKind
  name: string
  text: string
  /** The people the sentence is about (its base), for ranking. */
  people: number
  /** A Gap or Mixed theme, a concept whose measures Differ: the findings worth leading with. */
  gap: boolean
  /** A group under 10 people, as A2 says. Tensions only. */
  directional: boolean
  /** The guide questions it answers, so it belongs to their objectives. */
  questionIds: string[]
  /** What an exec sentence is built from: the item's own accepted numbers. */
  facts: ThemeFacts | ConceptFacts | TensionFacts
}
export type ThemeFacts = { type: 'theme'; n: number; of: number; verdict: string; flat?: number; positive?: number }
export type ConceptFacts = { type: 'concept'; did?: { n: number; of: number }; said?: { n: number; of: number }; match: string }
export type TensionFacts = { type: 'tension'; kind: string; line: { n: number; of: number } }

const isAccepted = (status: string | undefined) => status === 'Accepted' || status === 'Edited'

export type Accepted = { themes: Item[]; concepts: Item[]; tensions: Item[] }

/** Everything accepted in A2 right now. An item whose decision is Out of date, Left out, or not made is not accepted. */
export function acceptedItems(doc: CodebookDoc, basis: Basis, inputs: Pick<ReportInputs, 'pickQuestion'>): Accepted {
  const pick = inputs.pickQuestion ? [inputs.pickQuestion] : []
  const themes: Item[] = []
  const themeOrder = codeThemes(doc)
  for (const s of themeSignals(doc, basis)) {
    const theme = themeOrder.find((t) => t.id === s.id)
    if (!theme) continue
    const d = doc.insights?.[s.id]
    if (!d || !s.decision || !isAccepted(s.decision.status)) continue
    const questionIds = [...new Set(themeCodes(doc, theme).map((c) => c.questionId))]
    const text = d.text
    const flat = text.match(/(\d+) of those (\d+)/)
    themes.push({
      id: s.id,
      kind: 'theme',
      name: s.name,
      text,
      people: s.now?.snap.of ?? 0,
      gap: s.now?.snap.verdict === VERDICT_LABEL.Conflicting || s.now?.snap.verdict === VERDICT_LABEL.Mixed,
      directional: false,
      questionIds,
      facts: { type: 'theme', n: s.now!.snap.n, of: s.now!.snap.of, verdict: s.now!.snap.verdict, flat: flat ? Number(flat[1]) : undefined, positive: flat ? Number(flat[2]) : undefined },
    })
  }
  const concepts: Item[] = []
  for (const r of conceptRows(doc, basis)?.rows ?? []) {
    const d = doc.insights?.[r.key]
    if (!d || !isAccepted(r.decision.status)) continue
    concepts.push({
      id: r.key,
      kind: 'concept',
      name: r.name,
      text: d.text,
      people: r.did?.of ?? r.said?.of ?? r.saw,
      gap: r.match === 'Differs',
      directional: false,
      questionIds: pick,
      facts: { type: 'concept', did: r.did, said: r.said, match: r.match },
    })
  }
  const tensions: Item[] = []
  const decisions = tensionDecisions(doc)
  const seg = segmentsOf(doc.studyId)
  for (const t of tensionsOf(doc, basis)) {
    if (t.unavailable || decisions[t.id]?.status !== 'Added as a tension theme') continue
    const lines = tensionLines(t, [seg.first.label, seg.second.label])
    if (!lines.length) continue
    tensions.push({
      id: t.id,
      kind: 'tension',
      name: t.kind,
      text: lines.map((l) => l.text).join(' '),
      people: t.base,
      gap: false,
      directional: t.directional,
      questionIds: pick,
      facts: { type: 'tension', kind: t.kind, line: { n: lines[0].n, of: lines[0].of } },
    })
  }
  return { themes, concepts, tensions }
}

// ─── the guide questions ────────────────────────────────────────────────────

export type QuestionRow = {
  id: string
  /** The real guide question, as the participant heard it. */
  text: string
  /** The short name the codebook uses. */
  label: string
  /** The guide section it sits in. */
  section: string
  objectiveId?: string
  codeIds: string[]
  /** People who gave an answer coded under it, out of everyone in accepted sessions. */
  n: number
  of: number
  /** Accepted people who were not asked. */
  notAsked: number
}

/** One row per guide question of the study, in guide order. */
export function questionRows(doc: CodebookDoc, basis: Basis, inputs: Pick<ReportInputs, 'questionObjective'>): QuestionRow[] {
  return questionsOf(doc.studyId).map((q) => {
    const codes = doc.codes.filter((c) => c.questionId === q.id && c.status === 'Accepted')
    const n = new Set(codes.flatMap((c) => [...peopleOf(c, basis)])).size
    return {
      id: q.id,
      text: q.text,
      label: q.label,
      section: q.section,
      objectiveId: inputs.questionObjective[q.id],
      codeIds: codes.map((c) => c.id),
      n,
      of: basis.participants.size,
      notAsked: q.skipped.filter((s) => basis.participants.has(s.participantId)).length,
    }
  })
}
