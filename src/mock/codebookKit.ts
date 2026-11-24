// The machinery every study's codebook is built with: the types, the quote registry, and `buildPack`, which writes each
// quote into the participant's transcript at the turn it cites, so a quote and its session never disagree.
// A study supplies its content (questions, codes with quotes, themes, tensions) and gets a pack back. Pet Food's content is in
// codebook.ts, Ice Cream's in iceCream/codebook.ts. This file imports neither, so both can import it.

import { findReviewRecord, placeTranscriptLines, turnAtSec } from './review'

/** A guide question the codes are grouped under. `skipped` lists who was never asked it, so N is honest per question. */
export type CodeQuestion = { id: string; label: string; text: string; section: string; fraction: number; skipped: { participantId: string; why: string }[] }

export type Excerpt = {
  id: string
  sessionId: string
  participantId: string
  questionId: string
  text: string
  turnIndex: number
  atSec: number
  confidence: number
  /** The quote comes from a corrected line in the reviewed transcript. */
  corrected?: boolean
}

export type CodeStatus = 'Suggested' | 'Accepted' | 'Rejected' | 'Merged'

export type SeedCode = {
  id: string
  name: string
  definition: string
  /** The guide question it answers, or where a new code came up. */
  questionId: string
  isNew: boolean
  status: CodeStatus
  confidence: number
  excerpts: string[]
  /** Matching excerpts elsewhere, surfaced after the code changes (founder brief, step 3). */
  more: string[]
  decided?: { by: string; at: string; why?: string }
  mergedInto?: string
}

/** [participant, quote, confidence?]. A missing confidence means the code's own. */
export type Q = [string, string, number?]
export type Draft = Omit<SeedCode, 'excerpts' | 'more'> & { quotes: Q[]; extra?: Q[] }

export type SeedTheme = { id: string; name: string; definition: string; codeIds: string[]; by: string; at: string; /** A theme made from a tension: it borrows codes and owns none. */ tensionId?: string }

export type LogEntry = { id: string; at: string; by: string; target: { kind: 'code' | 'theme' | 'tension' | 'reading' | 'codebook'; id: string; name: string }; action: string; detail?: string; why?: string }

/** Decisions already made on the tensions PulseAI suggested (src/mock/signals.ts). */
export type SeedTensionDecision = { status: 'Added as a tension theme' | 'Dismissed'; by: string; at: string; why?: string; themeId?: string }

/** Every quote of every study, by ID. IDs are unique across studies. */
export const EXCERPTS: Record<string, Excerpt> = {}

export type PackConfig = {
  studyId: string
  /** Who drafted the codes. */
  coder: string
  codedAt: string
  questions: CodeQuestion[]
  drafts: Draft[]
  /** The session a participant's quotes are written into. Defaults to their first session. */
  sessionOf?: (participantId: string) => string
  /** Quotes that are corrected lines of the reviewed transcript, not placed ones, by "participant|codeId". */
  corrected?: Record<string, { index: number; text: string }>
  themes: SeedTheme[]
  themeSuggestions: Omit<SeedTheme, 'by' | 'at'>[]
  tensions: Record<string, SeedTensionDecision>
  /** Bumped when a study's seed is rewritten, so a browser still holding the old seed's codebook starts again from the new one. */
  seedVersion?: number
  /** Insights the Researcher had already accepted when the analysis opens: a theme by its ID, a concept by "concept:" and its moment ID. */
  insightDecisions?: { key: string; by: string; at: string }[]
  /** What the log says the AI did first, e.g. "20 codes from 20 accepted sessions". */
  suggestedDetail: string
  /** Log entries for decisions that are not a code's accept, reject or merge (a rename, a dismissed tension). */
  extraLog?: (codes: SeedCode[]) => LogEntry[]
}

export type CodebookPack = {
  studyId: string
  coder: string
  codedAt: string
  questions: CodeQuestion[]
  codes: SeedCode[]
  themes: SeedTheme[]
  themeSuggestions: Omit<SeedTheme, 'by' | 'at'>[]
  tensions: Record<string, SeedTensionDecision>
  insightDecisions: NonNullable<PackConfig['insightDecisions']>
  seedVersion: number
  log: LogEntry[]
}

const PROBES = ['Tell me more about that.', 'What else comes to mind?', 'Can you give me an example?', 'Anything else on that?']

/** Places every quote in its participant's transcript and builds the pack. Quotes already in EXCERPTS are never replaced. */
export function buildPack(cfg: PackConfig): CodebookPack {
  const sessionOf = cfg.sessionOf ?? ((p: string) => `${p}-1`)
  const corrected = cfg.corrected ?? {}
  // A corrected quote is a line of the reviewed transcript, so it is one of its code's quotes without being placed.
  Object.entries(corrected).forEach(([key, fixed]) => {
    const [participantId, codeId] = key.split('|')
    cfg.drafts.find((d) => d.id === codeId)!.quotes.push([participantId, fixed.text])
  })

  const placed = new Map<string, { index: number; text: string }[]>()
  const nextSlot = new Map<string, number>()
  const usedAt = new Map<string, Set<number>>()

  function place(code: Draft, [participantId, text, conf]: Q, n: number): string {
    const sessionId = sessionOf(participantId)
    const rec = findReviewRecord(sessionId)
    const id = `${code.id}-${participantId}-${n}`
    if (!rec) throw new Error(`No review record for ${sessionId}`)
    const total = rec.durationMin * 60
    const at = (i: number) => turnAtSec(sessionId, i, total, rec.turnCount)
    const fixed = corrected[`${participantId}|${code.id}`]
    let index: number
    if (fixed) index = fixed.index
    else {
      const q = cfg.questions.find((x) => x.id === code.questionId)!
      const key = `${sessionId}|${q.id}`
      const lines = placed.get(sessionId) ?? []
      const taken = new Set([...rec.flags.map((f) => f.turn - 1), ...(rec.reviewed?.edits.map((e) => e.index) ?? []), ...lines.map((l) => l.index)])
      const first = !nextSlot.has(key)
      let i = nextSlot.get(key) ?? Math.round(q.fraction * rec.turnCount) | 1
      // Nobody else's answer to this question starts on the same second: a tie reads as a copy and Play would be ambiguous.
      const seen = usedAt.get(q.id) ?? new Set<number>()
      while (taken.has(i) || taken.has(i - 1) || seen.has(at(i))) i += 2
      seen.add(at(i))
      usedAt.set(q.id, seen)
      nextSlot.set(key, i + 2)
      index = i
      lines.push({ index: i - 1, text: first ? q.text : PROBES[(i >> 1) % PROBES.length] }, { index: i, text })
      placed.set(sessionId, lines)
    }
    EXCERPTS[id] = { id, sessionId, participantId, questionId: code.questionId, text, turnIndex: index, atSec: at(index), confidence: conf ?? code.confidence, ...(fixed ? { corrected: true } : {}) }
    return id
  }

  const codes: SeedCode[] = cfg.drafts.map((d) => {
    const { quotes, extra = [], ...rest } = d
    return { ...rest, excerpts: quotes.map((q, n) => place(d, q, n)), more: extra.map((q, n) => place(d, q, n + 50)) }
  })
  placed.forEach((lines, sessionId) => placeTranscriptLines(sessionId, lines))

  const log: LogEntry[] = [{ id: 'l-0', at: cfg.codedAt, by: cfg.coder, target: { kind: 'codebook', id: 'codebook', name: 'Codebook' }, action: 'Suggested codes', detail: cfg.suggestedDetail }]
  codes.forEach((c) => {
    if (!c.decided) return
    const action = c.status === 'Accepted' ? 'Accepted' : c.status === 'Rejected' ? 'Rejected' : 'Merged'
    const detail = c.status === 'Merged' ? `Into “${codes.find((x) => x.id === c.mergedInto)!.name}”` : undefined
    log.push({ id: `l-${c.id}`, at: c.decided.at, by: c.decided.by, target: { kind: 'code', id: c.id, name: c.name }, action, detail, why: c.decided.why })
  })
  cfg.extraLog?.(codes).forEach((e) => log.push(e))
  cfg.themes.forEach((t) => log.push({ id: `l-${t.id}`, at: t.at, by: t.by, target: { kind: 'theme', id: t.id, name: t.name }, action: 'Created theme', detail: `${t.codeIds.length} codes` }))
  log.sort((a, b) => b.at.localeCompare(a.at))

  return { studyId: cfg.studyId, coder: cfg.coder, codedAt: cfg.codedAt, questions: cfg.questions, codes, themes: cfg.themes, themeSuggestions: cfg.themeSuggestions, tensions: cfg.tensions, insightDecisions: cfg.insightDecisions ?? [], seedVersion: cfg.seedVersion ?? 1, log }
}

/** Every study's codebook pack, by study ID. Each study registers its own. */
export const CODEBOOK_PACKS: Record<string, CodebookPack> = {}
export const registerPack = (pack: CodebookPack) => {
  CODEBOOK_PACKS[pack.studyId] = pack
  return pack
}
export const packOf = (studyId: string): CodebookPack => {
  const p = CODEBOOK_PACKS[studyId]
  if (!p) throw new Error(`No codebook for study ${studyId}`)
  return p
}
export const questionsOf = (studyId: string): CodeQuestion[] => packOf(studyId).questions
