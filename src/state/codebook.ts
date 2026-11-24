// The living codebook (Results Analysis, founder brief step 1). One per study, kept in the browser.
// Counts are never stored: "n of N" is worked out from the quotes and the current Review decisions every time.

import { useSyncExternalStore } from 'react'
import {
  AI_CODER,
  CODEBOOK_PACKS,
  CODEBOOK_STUDY,
  CODE_QUESTIONS,
  EXCERPTS,
  petOf,
  questionsOf,
  type CodeQuestion,
  type CodeStatus,
  type Excerpt,
  type LogEntry,
  type SeedCode,
  type SeedTensionDecision,
} from '@/mock/codebook'
import { segmentsOf } from '@/mock/studyAnalysis'
import type { Emotion, Stance } from '@/mock/emotion'
import { hash } from './hash'
import { now, uid } from './brief'

export type { CodeStatus, Excerpt, LogEntry, Pet } from '@/mock/codebook'
export { hasAnalysis } from '@/mock/studyAnalysis'

export type Code = SeedCode
/** A theme made from a tension (docs/ANALYSIS_PLAN.md). It groups codes that are also in other themes, and the codes stay where they are. */
export type Theme = { id: string; name: string; definition: string; codeIds: string[]; by: string; at: string; tensionId?: string }
export type TensionDecision = SeedTensionDecision

export type CodebookDoc = {
  studyId: string
  codedAt: string
  /** The accepted sessions the codes were drawn from. If Review changes, the codebook is out of date. */
  builtOn: string[]
  codes: Code[]
  themes: Theme[]
  /** Excerpts surfaced after a change, waiting for Add or Skip, by code. */
  pending: Record<string, string[]>
  /** Excerpts the Researcher skipped, never offered again for that code. */
  skipped: Record<string, string[]>
  dismissedSuggestions: string[]
  /** What the Researcher decided on each tension. A tension not listed is still to review. */
  tensions?: Record<string, TensionDecision>
  /** Signals the Researcher switched on or off for the report, by code. Not listed means the default: on when notable. */
  signalPicks?: Record<string, boolean>
  /** Signal profiles the Researcher switched on or off for the report, by theme. Not listed means the default: on when the theme's pattern is notable. */
  themePicks?: Record<string, boolean>
  /** The Researcher's corrections to face readings, by reading key. The original reading is kept beside it. */
  faceFixes?: Record<string, FaceFix>
  /**
   * The Researcher's corrections to what the words claim. Keyed "code:{codeId}" for a whole code, or "person:{codeId}|{participantId}"
   * for one person at a code. The AI's own stance is kept beside each correction.
   */
  stanceFixes?: Record<string, StanceFix>
  /** What the Researcher decided on each theme's insight, by theme. A theme not listed is Suggested. */
  insights?: Record<string, InsightDecision>
  /** The seed's own decisions on insights have been put in place, once. */
  decisionsSeeded?: boolean
  /** Which version of the study's seed this was made from. */
  seedVersion?: number
  /** The Researcher's own note on a theme's insight, by theme. Kept apart from the insight sentence and never part of it. */
  insightNotes?: Record<string, string>
  /** A code's own say on whether its moments go in the report, by code. Not set means it follows its theme's decision. */
  codeOverrides?: Record<string, boolean>
  /** Counts the times the analysis data changed (codes, themes, corrections, sessions), so a decision can say which version it saw. 1 when unset. */
  dataVersion?: number
  /** Quotes added from Explore, kept so a refresh finds them. They are put back into EXCERPTS when the codebook loads. */
  addedExcerpts?: Record<string, Excerpt>
  log: LogEntry[]
}

/** A correction to what the words claim, with the AI's own stance beside it. */
export type StanceFix = { to: Stance; from: Stance; by: string; at: string; why?: string }
/** The numbers and words an insight was made from, kept so "Out of date" can show old beside new. */
export type InsightSnap = { n: number; of: number; verdict: string; text: string }
/** A decision on a theme's insight sentence. `text` is what is shown (the AI's, or the Researcher's wording). */
export type InsightDecision = {
  status: 'Accepted' | 'Edited' | 'Left out'
  by: string
  at: string
  text: string
  /** The sentence the AI computed when this was decided. */
  original: string
  /** Fingerprint of what it was made from. If it changes, the decision is Out of date. */
  fingerprint: string
  snap: InsightSnap
  /** The data version it was decided on. */
  dataVersion: number
  why?: string
}

/** A face reading the Researcher corrected. "No clear expression" takes the reading out of every count. */
export type FaceFix = { to: Emotion | 'No clear expression'; from: Emotion; by: string; at: string; why: string }

// ─── store ──────────────────────────────────────────────────────────────────

const KEY = 'pulseai-qual:codebook'
type Store = Record<string, CodebookDoc>

/** Quotes added from Explore live in the codebook doc. Put them where every screen looks quotes up. */
function registerExcerpts(s: Store) {
  Object.values(s).forEach((d) => Object.values(d.addedExcerpts ?? {}).forEach((e) => (EXCERPTS[e.id] = e)))
  return s
}

let store: Store = registerExcerpts(
  (() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as Store
    } catch {
      // Storage blocked or corrupt.
    }
    return {}
  })(),
)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
}

export function seedCodebook(studyId: string, acceptedSessions: string[]): CodebookDoc | undefined {
  const pack = CODEBOOK_PACKS[studyId]
  if (!pack) return undefined
  return {
    studyId,
    codedAt: pack.codedAt,
    seedVersion: pack.seedVersion,
    builtOn: acceptedSessions,
    codes: structuredClone(pack.codes),
    themes: structuredClone(pack.themes),
    pending: {},
    skipped: {},
    dismissedSuggestions: [],
    tensions: structuredClone(pack.tensions),
    signalPicks: {},
    log: structuredClone(pack.log),
  }
}

/** What counts as the analysis data: the codes and their quotes, who is in each theme, the corrections, and the sessions. */
const dataSig = (d: CodebookDoc) =>
  hash(JSON.stringify({ c: d.codes.map((c) => [c.id, c.status, c.excerpts, c.mergedInto]), t: d.themes.map((t) => [t.id, t.codeIds]), f: d.stanceFixes ?? {}, b: d.builtOn }))
export const dataVersionOf = (d: CodebookDoc) => d.dataVersion ?? 1

export function updateCodebook(studyId: string, fn: (d: CodebookDoc) => CodebookDoc) {
  const doc = store[studyId]
  if (!doc) return
  let next = fn(doc)
  if (next !== doc && dataSig(next) !== dataSig(doc)) next = { ...next, dataVersion: dataVersionOf(doc) + 1 }
  store = registerExcerpts({ ...store, [studyId]: next })
  save()
  emit()
}

/** Puts the seed in place the first time a study's codebook is opened. */
export function ensureCodebook(studyId: string, acceptedSessions: string[]) {
  // A codebook saved from an older seed points at quotes that are gone. It starts again from the current seed.
  const wanted = CODEBOOK_PACKS[studyId]?.seedVersion
  if (store[studyId] && wanted !== undefined && (store[studyId].seedVersion ?? 1) !== wanted) {
    const { [studyId]: _old, ...rest } = store
    void _old
    store = rest
  }
  if (store[studyId]) {
    // An older theme-level tick becomes code-level ticks, once. Nothing else is touched.
    const moved = migrateThemePicks(store[studyId])
    if (moved !== store[studyId]) {
      store = { ...store, [studyId]: moved }
      save()
    }
    return
  }
  const seed = seedCodebook(studyId, acceptedSessions)
  if (!seed) return
  store = { ...store, [studyId]: seed }
  save()
}

export function resetCodebook() {
  store = {}
  save()
  emit()
}

/** The doc as it stands now, for code that is not a component. */
export const getCodebook = (studyId: string): CodebookDoc | undefined => store[studyId]

export function useCodebook(studyId: string): CodebookDoc | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store[studyId],
  )
}

// ─── reading ────────────────────────────────────────────────────────────────

/** The guide questions of a study, in order. */
export const questionsOfStudy = (studyId: string): CodeQuestion[] => (CODEBOOK_PACKS[studyId] ? questionsOf(studyId) : [])
/** A guide question by ID. Question IDs are unique across studies. */
export const questionOf = (id: string): CodeQuestion => Object.values(CODEBOOK_PACKS).flatMap((p) => p.questions).find((q) => q.id === id)!
export const excerpt = (id: string): Excerpt => EXCERPTS[id]

export type Confidence = 'High' | 'Medium' | 'Low'
export const band = (c: number): Confidence => (c >= 0.8 ? 'High' : c >= 0.6 ? 'Medium' : 'Low')
export const WEAK_MATCH = 0.6

/** What the counts are against right now: the accepted participants, and who answered each question. */
export type Basis = { participants: Set<string>; sessions: Set<string> }
export function basisOf(acceptedSessions: { id: string; participantId: string }[]): Basis {
  return { participants: new Set(acceptedSessions.map((s) => s.participantId)), sessions: new Set(acceptedSessions.map((s) => s.id)) }
}

/** The quotes that count: only from sessions that are accepted now. */
export const liveExcerpts = (code: Code, basis: Basis) => code.excerpts.map(excerpt).filter((e) => basis.sessions.has(e.sessionId))

/** N for a code: everyone accepted who was asked its question. New codes are against everyone. */
export function denominator(code: Pick<Code, 'questionId' | 'isNew'>, basis: Basis) {
  return askedOf(code, basis).size
}

/** Who was asked the question behind a code: everyone accepted, minus anyone it was skipped for. New codes are against everyone. */
export function askedOf(code: Pick<Code, 'questionId' | 'isNew'>, basis: Basis): Set<string> {
  if (code.isNew) return new Set(basis.participants)
  const skipped = new Set(questionOf(code.questionId).skipped.map((s) => s.participantId))
  return new Set([...basis.participants].filter((p) => !skipped.has(p)))
}

export const peopleOf = (code: Code, basis: Basis) => new Set(liveExcerpts(code, basis).map((e) => e.participantId))

/** How many of these people are in each of the study's two groups, in the order they read on screen. */
export function segmentSplit(studyId: string, people: Set<string>): { first: number; second: number } {
  const { first } = segmentsOf(studyId)
  const out = { first: 0, second: 0 }
  people.forEach((p) => (petOf(p) === first.key ? out.first++ : out.second++))
  return out
}

/** The codes that were merged into this one, so it can be shown as one code with its history ("includes …"). A code merged into a merged code counts too. */
export function mergedFrom(doc: CodebookDoc, id: string): Code[] {
  const direct = doc.codes.filter((c) => c.status === 'Merged' && c.mergedInto === id)
  return [...direct, ...direct.flatMap((c) => mergedFrom(doc, c.id))]
}

/** Other open codes said by the same people, most overlap first. A likely merge. */
export function similarCodes(doc: CodebookDoc, code: Code, basis: Basis) {
  const mine = peopleOf(code, basis)
  if (!mine.size) return []
  return doc.codes
    .filter((c) => c.id !== code.id && (c.status === 'Suggested' || c.status === 'Accepted') && (c.questionId === code.questionId || c.isNew || code.isNew))
    .map((c) => {
      const theirs = peopleOf(c, basis)
      const shared = [...theirs].filter((p) => mine.has(p)).length
      return { code: c, shared, score: shared / new Set([...mine, ...theirs]).size }
    })
    .filter((x) => x.shared >= 2 && x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
}

/** A theme's codes as they stand: merged ones point at what they were merged into, and only accepted codes count. */
export function themeCodes(doc: CodebookDoc, theme: Theme): Code[] {
  const seen = new Set<string>()
  const out: Code[] = []
  theme.codeIds.forEach((id) => {
    let c = doc.codes.find((x) => x.id === id)
    while (c?.status === 'Merged' && c.mergedInto) c = doc.codes.find((x) => x.id === c!.mergedInto)
    if (c && c.status === 'Accepted' && !seen.has(c.id)) {
      seen.add(c.id)
      out.push(c)
    }
  })
  return out
}

export const themePeople = (doc: CodebookDoc, theme: Theme, basis: Basis) => new Set(themeCodes(doc, theme).flatMap((c) => [...peopleOf(c, basis)]))

/** Themes the Researcher built from codes. A tension theme borrows codes and never owns them. */
export const codeThemes = (doc: CodebookDoc) => doc.themes.filter((t) => !t.tensionId)

export function unthemed(doc: CodebookDoc): Code[] {
  const inTheme = new Set(codeThemes(doc).flatMap((t) => themeCodes(doc, t).map((c) => c.id)))
  return doc.codes.filter((c) => c.status === 'Accepted' && !inTheme.has(c.id))
}

/** AI theme drafts that still make sense: at least two of their codes are accepted and not yet in a theme. */
export function openSuggestions(doc: CodebookDoc) {
  const free = new Set(unthemed(doc).map((c) => c.id))
  return (CODEBOOK_PACKS[doc.studyId]?.themeSuggestions ?? []).filter((s) => !doc.dismissedSuggestions.includes(s.id))
    .map((s) => ({ ...s, codeIds: s.codeIds.filter((id) => free.has(id)) }))
    .filter((s) => s.codeIds.length >= 2)
}

export function counts(doc: CodebookDoc) {
  const by = (s: CodeStatus) => doc.codes.filter((c) => c.status === s).length
  return { total: doc.codes.length, suggested: by('Suggested'), accepted: by('Accepted'), rejected: by('Rejected'), merged: by('Merged'), themes: doc.themes.length }
}

// ─── changing ───────────────────────────────────────────────────────────────

type Who = { by: string }
const entry = (by: string, code: Pick<Code, 'id' | 'name'>, action: string, detail?: string, why?: string): LogEntry => ({
  id: uid('cl'),
  at: now(),
  by,
  target: { kind: 'code', id: code.id, name: code.name },
  action,
  ...(detail ? { detail } : {}),
  ...(why?.trim() ? { why: why.trim() } : {}),
})
const themeEntry = (by: string, t: Pick<Theme, 'id' | 'name'>, action: string, detail?: string, why?: string): LogEntry => ({
  ...entry(by, t, action, detail, why),
  target: { kind: 'theme', id: t.id, name: t.name },
})

const setCode = (d: CodebookDoc, id: string, fn: (c: Code) => Code): CodebookDoc => ({ ...d, codes: d.codes.map((c) => (c.id === id ? fn(c) : c)) })
const log = (d: CodebookDoc, ...entries: LogEntry[]): CodebookDoc => ({ ...d, log: [...entries, ...d.log] })
const codeOf = (d: CodebookDoc, id: string) => d.codes.find((c) => c.id === id)!

/** Founder brief step 3: after a change, look through the other transcripts for excerpts that now fit. */
function surface(d: CodebookDoc, id: string): CodebookDoc {
  const c = codeOf(d, id)
  const skipped = new Set(d.skipped[id] ?? [])
  const fresh = c.more.filter((x) => !c.excerpts.includes(x) && !skipped.has(x))
  return { ...d, pending: { ...d.pending, [id]: fresh } }
}

export function acceptCodes(d: CodebookDoc, ids: string[], { by }: Who, why?: string): CodebookDoc {
  let out = d
  ids.forEach((id) => {
    out = setCode(out, id, (c) => ({ ...c, status: 'Accepted', decided: { by, at: now(), ...(why?.trim() ? { why: why.trim() } : {}) } }))
    out = log(out, entry(by, codeOf(out, id), 'Accepted', ids.length > 1 ? `One of ${ids.length} accepted together` : undefined, why))
  })
  return out
}

/** Rejecting takes the code out of any theme. */
export function rejectCode(d: CodebookDoc, id: string, { by }: Who, why: string): CodebookDoc {
  const out = setCode(d, id, (c) => ({ ...c, status: 'Rejected', decided: { by, at: now(), why: why.trim() } }))
  return log({ ...out, themes: out.themes.map((t) => ({ ...t, codeIds: t.codeIds.filter((x) => x !== id) })) }, entry(by, codeOf(d, id), 'Rejected', undefined, why))
}

export function restoreCode(d: CodebookDoc, id: string, { by }: Who): CodebookDoc {
  const out = setCode(d, id, (c) => ({ ...c, status: 'Suggested', decided: undefined }))
  return log(out, entry(by, codeOf(d, id), 'Restored', 'Back to Suggested'))
}

export function renameCode(d: CodebookDoc, id: string, name: string, { by }: Who, why?: string): CodebookDoc {
  const before = codeOf(d, id).name
  const out = setCode(d, id, (c) => ({ ...c, name: name.trim() }))
  return surface(log(out, entry(by, codeOf(out, id), 'Renamed', `From “${before}”`, why)), id)
}

export function editDefinition(d: CodebookDoc, id: string, definition: string, { by }: Who, why?: string): CodebookDoc {
  const out = setCode(d, id, (c) => ({ ...c, definition: definition.trim() }))
  return surface(log(out, entry(by, codeOf(out, id), 'Edited the definition', undefined, why)), id)
}

/** Merging moves every quote into the target. The source stays in the codebook as Merged, so the history reads. */
export function mergeCodes(d: CodebookDoc, sourceId: string, targetId: string, name: string, { by }: Who, why: string): CodebookDoc {
  const src = codeOf(d, sourceId)
  const tgt = codeOf(d, targetId)
  const renamed = name.trim() && name.trim() !== tgt.name
  let out = setCode(d, targetId, (c) => ({
    ...c,
    name: renamed ? name.trim() : c.name,
    excerpts: [...c.excerpts, ...src.excerpts.filter((x) => !c.excerpts.includes(x))],
    more: [...c.more, ...src.more.filter((x) => !c.more.includes(x))],
  }))
  out = setCode(out, sourceId, (c) => ({ ...c, status: 'Merged', mergedInto: targetId, excerpts: [], decided: { by, at: now(), why: why.trim() } }))
  out = { ...out, themes: out.themes.map((t) => ({ ...t, codeIds: [...new Set(t.codeIds.map((x) => (x === sourceId ? targetId : x)))] })) }
  const { [sourceId]: _drop, ...pending } = out.pending
  out = log({ ...out, pending }, entry(by, src, 'Merged', `Into “${codeOf(out, targetId).name}”`, why))
  if (renamed) out = log(out, entry(by, codeOf(out, targetId), 'Renamed', `From “${tgt.name}”, in a merge`))
  return surface(out, targetId)
}

export function removeQuote(d: CodebookDoc, id: string, excerptId: string, { by }: Who, why: string): CodebookDoc {
  const e = excerpt(excerptId)
  const out = setCode(d, id, (c) => ({ ...c, excerpts: c.excerpts.filter((x) => x !== excerptId) }))
  return log(
    { ...out, skipped: { ...out.skipped, [id]: [...(out.skipped[id] ?? []), excerptId] } },
    entry(by, codeOf(out, id), 'Removed a quote', `${e.participantId}: “${e.text}”`, why),
  )
}

export function addCandidate(d: CodebookDoc, id: string, excerptId: string, { by }: Who): CodebookDoc {
  const e = excerpt(excerptId)
  const out = setCode(d, id, (c) => ({ ...c, excerpts: [...c.excerpts, excerptId] }))
  return log({ ...out, pending: { ...out.pending, [id]: (out.pending[id] ?? []).filter((x) => x !== excerptId) } }, entry(by, codeOf(out, id), 'Added a quote', `${e.participantId}: “${e.text}”`))
}

export function skipCandidate(d: CodebookDoc, id: string, excerptId: string): CodebookDoc {
  return {
    ...d,
    pending: { ...d.pending, [id]: (d.pending[id] ?? []).filter((x) => x !== excerptId) },
    skipped: { ...d.skipped, [id]: [...(d.skipped[id] ?? []), excerptId] },
  }
}

/** Bring the codebook in line with Review: quotes from sessions no longer accepted are dropped for good. */
export function rebuild(d: CodebookDoc, accepted: string[], { by }: Who): CodebookDoc {
  const keep = new Set(accepted)
  const dropped = d.builtOn.filter((s) => !keep.has(s))
  const added = accepted.filter((s) => !d.builtOn.includes(s))
  const out: CodebookDoc = { ...d, builtOn: accepted, codes: d.codes.map((c) => ({ ...c, excerpts: c.excerpts.filter((x) => keep.has(excerpt(x).sessionId)) })) }
  const parts = [dropped.length && `Left out ${dropped.join(', ')}`, added.length && `Coded ${added.join(', ')} (no new quotes in this prototype)`].filter(Boolean).join('. ')
  return log(out, { id: uid('cl'), at: now(), by, target: { kind: 'codebook', id: 'codebook', name: 'Codebook' }, action: 'Updated to Review', detail: parts || 'No changes' })
}

// Themes

export function createTheme(d: CodebookDoc, name: string, definition: string, codeIds: string[], { by }: Who, from?: string): CodebookDoc {
  const t: Theme = { id: uid('t'), name: name.trim(), definition: definition.trim(), codeIds: [], by, at: now() }
  const out = moveIntoTheme({ ...d, themes: [...d.themes, t] }, codeIds, t.id)
  return log(
    from ? { ...out, dismissedSuggestions: [...out.dismissedSuggestions, from] } : out,
    themeEntry(by, t, from ? 'Accepted a suggested theme' : 'Created theme', `${codeIds.length} ${codeIds.length === 1 ? 'code' : 'codes'}`),
  )
}

/** A code sits in one theme at a time: moving it takes it out of the others. */
function moveIntoTheme(d: CodebookDoc, codeIds: string[], themeId: string | null): CodebookDoc {
  return {
    ...d,
    themes: d.themes.map((t) => {
      if (t.tensionId) return t
      const kept = t.codeIds.filter((x) => !codeIds.includes(x))
      return t.id === themeId ? { ...t, codeIds: [...kept, ...codeIds] } : { ...t, codeIds: kept }
    }),
  }
}

export function moveCode(d: CodebookDoc, codeId: string, themeId: string | null, { by }: Who): CodebookDoc {
  const from = codeThemes(d).find((t) => themeCodes(d, t).some((c) => c.id === codeId))
  if ((from?.id ?? null) === themeId) return d
  const out = moveIntoTheme(d, [codeId], themeId)
  const to = out.themes.find((t) => t.id === themeId)
  const code = codeOf(d, codeId)
  return log(out, to ? themeEntry(by, to, 'Added a code', `“${code.name}”${from ? `, from “${from.name}”` : ''}`) : themeEntry(by, from!, 'Took out a code', `“${code.name}”`))
}

export function editTheme(d: CodebookDoc, id: string, name: string, definition: string, { by }: Who): CodebookDoc {
  const before = d.themes.find((t) => t.id === id)!
  const out = { ...d, themes: d.themes.map((t) => (t.id === id ? { ...t, name: name.trim(), definition: definition.trim() } : t)) }
  const detail = before.name !== name.trim() ? `Renamed from “${before.name}”` : 'Edited the definition'
  return log(out, themeEntry(by, { id, name: name.trim() }, 'Edited theme', detail))
}

export function deleteTheme(d: CodebookDoc, id: string, { by }: Who, why: string): CodebookDoc {
  const t = d.themes.find((x) => x.id === id)!
  const { [t.tensionId ?? '']: _gone, ...rest } = d.tensions ?? {}
  void _gone
  const out = { ...d, themes: d.themes.filter((x) => x.id !== id), ...(t.tensionId ? { tensions: rest } : {}) }
  return log(out, themeEntry(by, t, 'Deleted theme', t.tensionId ? 'The tension is back in Emotion & behaviour, to review' : 'Its codes went back to “Not in a theme”', why))
}

// Tensions (Emotion & behaviour)

/** The decisions on each tension. A decision saved as "Turned into a theme", before the rename, reads as "Added as a tension theme". */
export const tensionDecisions = (d: CodebookDoc): Record<string, TensionDecision> =>
  Object.fromEntries(Object.entries(d.tensions ?? CODEBOOK_PACKS[d.studyId]?.tensions ?? {}).map(([id, v]) => [id, (v.status as string) === 'Turned into a theme' ? { ...v, status: 'Added as a tension theme' as const } : v]))

const tensionEntry = (by: string, t: { id: string; title: string }, action: string, detail?: string, why?: string): LogEntry => ({
  id: uid('cl'),
  at: now(),
  by,
  target: { kind: 'tension', id: t.id, name: t.title },
  action,
  ...(detail ? { detail } : {}),
  ...(why?.trim() ? { why: why.trim() } : {}),
})

/** Turn a tension into a theme. The theme lists the tension's codes without taking them out of the themes they're in. */
export function turnTensionIntoTheme(d: CodebookDoc, tension: { id: string; title: string }, codeIds: string[], name: string, definition: string, { by }: Who): CodebookDoc {
  const t: Theme = { id: uid('t'), name: name.trim(), definition: definition.trim(), codeIds, by, at: now(), tensionId: tension.id }
  const out: CodebookDoc = { ...d, themes: [...d.themes, t], tensions: { ...tensionDecisions(d), [tension.id]: { status: 'Added as a tension theme', by, at: t.at, themeId: t.id } } }
  return log(out, tensionEntry(by, tension, 'Added as a tension theme', `“${t.name}”`), themeEntry(by, t, 'Created theme', 'From a tension'))
}

export function dismissTension(d: CodebookDoc, tension: { id: string; title: string }, { by }: Who, why: string): CodebookDoc {
  return log({ ...d, tensions: { ...tensionDecisions(d), [tension.id]: { status: 'Dismissed', by, at: now(), why: why.trim() } } }, tensionEntry(by, tension, 'Dismissed', undefined, why))
}

/** Put a dismissed or turned tension back to review. A tension theme made from it is taken out with it, and its codes stay where they are. */
export function restoreTension(d: CodebookDoc, tension: { id: string; title: string }, { by }: Who): CodebookDoc {
  const { [tension.id]: _gone, ...rest } = tensionDecisions(d)
  void _gone
  const theme = d.themes.find((t) => t.tensionId === tension.id)
  const { [theme?.id ?? '']: _pick, ...picks } = d.themePicks ?? {}
  void _pick
  return log({ ...d, tensions: rest, themes: d.themes.filter((t) => t.tensionId !== tension.id), themePicks: picks }, tensionEntry(by, tension, 'Restored', theme ? `Back to review. The tension theme “${theme.name}” was taken out` : 'Back to review'))
}

/** Whether a theme's signal profile goes into the report. Not set means on when the pattern is notable. */
export function setThemePick(d: CodebookDoc, theme: { id: string; name: string }, on: boolean, { by }: Who): CodebookDoc {
  return log({ ...d, themePicks: { ...(d.themePicks ?? {}), [theme.id]: on } }, themeEntry(by, theme, on ? 'Signals added to the report' : 'Signals left out of the report'))
}

/**
 * Signals go into the report per code. An older theme-level tick (on or off) is carried to the accepted codes of that theme that have no
 * code-level tick of their own, once. The theme-level value stays in the doc, unread. Returns the same doc when there is nothing to carry.
 */
export function migrateThemePicks(d: CodebookDoc): CodebookDoc {
  const picks = d.themePicks ?? {}
  const own = d.signalPicks ?? {}
  const next = { ...own }
  const entries: LogEntry[] = []
  for (const theme of codeThemes(d)) {
    if (picks[theme.id] === undefined) continue
    const codes = themeCodes(d, theme).filter((c) => c.status === 'Accepted' && own[c.id] === undefined)
    if (!codes.length) continue
    codes.forEach((c) => (next[c.id] = picks[theme.id]))
    entries.push(themeEntry('PulseAI', theme, 'Signals tick moved to its codes', `${picks[theme.id] ? 'On' : 'Off'} for ${codes.length} ${codes.length === 1 ? 'code' : 'codes'}`))
  }
  return entries.length ? log({ ...d, signalPicks: next }, ...entries) : d
}

/** Several codes at once, from a theme's switch: one entry in the log for the whole group. */
export function setSignalPicks(d: CodebookDoc, codes: { id: string }[], on: boolean, group: string, { by }: Who): CodebookDoc {
  if (!codes.length) return d
  const picks = { ...(d.signalPicks ?? {}) }
  codes.forEach((c) => (picks[c.id] = on))
  const detail = `${group}: ${codes.length} ${codes.length === 1 ? 'code' : 'codes'}`
  return log({ ...d, signalPicks: picks }, { id: uid('cl'), at: now(), by, target: { kind: 'codebook', id: 'codebook', name: 'Codebook' }, action: on ? 'Signals added to the report' : 'Signals left out of the report', detail })
}

/** Whether a code's signals go into the report. Not set means on when the pattern is notable. */
export function setSignalPick(d: CodebookDoc, code: { id: string; name: string }, on: boolean, { by }: Who): CodebookDoc {
  return log({ ...d, signalPicks: { ...(d.signalPicks ?? {}), [code.id]: on } }, entry(by, code, on ? 'Signals added to the report' : 'Signals left out of the report'))
}

/**
 * Correct what PulseAI read on a face. The reason is required and logged; the original stays visible beside the
 * correction, and every count that uses this moment updates. Correcting it back to PulseAI's own label removes the fix.
 */
export function correctFace(d: CodebookDoc, key: string, name: string, from: Emotion, to: FaceFix['to'], { by }: Who, why: string): CodebookDoc {
  const { [key]: _old, ...rest } = d.faceFixes ?? {}
  void _old
  const back = to === from
  const faceFixes = back ? rest : { ...rest, [key]: { to, from, by, at: now(), why: why.trim() } }
  const e: LogEntry = { id: uid('cl'), at: now(), by, target: { kind: 'reading', id: key, name }, action: back ? 'Face reading restored' : 'Face reading corrected', detail: back ? `Back to PulseAI’s “${from}”` : `From “${from}” to “${to}”`, ...(why.trim() ? { why: why.trim() } : {}) }
  return log({ ...d, faceFixes }, e)
}

export const dismissSuggestion = (d: CodebookDoc, id: string): CodebookDoc => ({ ...d, dismissedSuggestions: [...d.dismissedSuggestions, id] })
/** Offer a dismissed suggestion again. */
export const restoreSuggestion = (d: CodebookDoc, id: string): CodebookDoc => ({ ...d, dismissedSuggestions: d.dismissedSuggestions.filter((x) => x !== id) })

/** What Explore hands over when the Researcher accepts a proposed code. The quotes are whole transcript turns, word for word. */
export type IdeaCode = {
  name: string
  definition: string
  /** What the Researcher typed, kept in the log as the reason. */
  idea: string
  /** The guide question it falls under, or null: it goes in "New codes, not asked about in the guide". */
  questionId: string | null
  anchorQuestionId: string
  quotes: { sessionId: string; participantId: string; turnIndex: number; atSec: number; text: string; questionId: string | null }[]
}

/**
 * Adds one Accepted code from an idea typed in Explore, with its quotes. One log entry: who, when, and the idea as the why.
 * Counts, themes and the Codebook tab follow from the doc, so nothing else needs refreshing.
 */
export function addIdeaCode(d: CodebookDoc, id: string, input: IdeaCode, { by }: Who): CodebookDoc {
  const at = now()
  const added: Record<string, Excerpt> = {}
  input.quotes.forEach((q) => {
    const eid = `hl-${id}-${q.participantId}-${q.turnIndex}`
    added[eid] = { id: eid, sessionId: q.sessionId, participantId: q.participantId, questionId: q.questionId ?? input.anchorQuestionId, text: q.text, turnIndex: q.turnIndex, atSec: q.atSec, confidence: 0.7 }
  })
  const people = new Set(input.quotes.map((q) => q.participantId)).size
  const code: Code = {
    id,
    name: input.name.trim(),
    definition: input.definition.trim(),
    questionId: input.questionId ?? input.anchorQuestionId,
    isNew: input.questionId === null,
    status: 'Accepted',
    confidence: 0.7,
    excerpts: Object.keys(added),
    more: [],
    decided: { by, at, why: `From an idea typed in Explore: “${input.idea}”` },
  }
  const out: CodebookDoc = { ...d, codes: [...d.codes, code], addedExcerpts: { ...(d.addedExcerpts ?? {}), ...added } }
  return log(out, entry(by, code, 'Accepted', `Added from Explore: ${input.quotes.length} ${input.quotes.length === 1 ? 'quote' : 'quotes'} from ${people} ${people === 1 ? 'person' : 'people'}`, `Typed idea: “${input.idea}”`))
}

/** Pet Food's guide questions, kept for callers that predate a second study. Use questionsOfStudy for a study. */
export { AI_CODER, CODE_QUESTIONS, CODEBOOK_STUDY }


// ─── what the words claim: corrections ──────────────────────────────────────

const STANCE_WORD: Record<Stance, string> = { Positive: 'For it', Negative: 'Against it', Neutral: 'Just describes' }
const stanceEntry = (by: string, kind: 'code' | 'reading', id: string, name: string, action: string, detail: string, why?: string): LogEntry => ({
  id: uid('cl'),
  at: now(),
  by,
  target: { kind, id, name },
  action,
  detail,
  ...(why?.trim() ? { why: why.trim() } : {}),
})

/**
 * Correct what a whole code's words claim: for it, against it, or just describes. `ai` is PulseAI's own stance, so choosing it again
 * removes the correction. Every count, verdict and insight that uses the code updates, and the change is logged.
 */
export function correctCodeStance(d: CodebookDoc, code: Pick<Code, 'id' | 'name'>, ai: Stance, to: Stance, { by }: Who, why?: string): CodebookDoc {
  const key = `code:${code.id}`
  const { [key]: old, ...rest } = d.stanceFixes ?? {}
  const from = old?.to ?? ai
  if (to === from) return d
  const stanceFixes = to === ai ? rest : { ...rest, [key]: { to, from: ai, by, at: now(), ...(why?.trim() ? { why: why.trim() } : {}) } }
  return log({ ...d, stanceFixes }, stanceEntry(by, 'code', code.id, code.name, 'Stance corrected', `From “${STANCE_WORD[from]}” to “${STANCE_WORD[to]}”`, why))
}

/** The same for one person at one code ("Not right?" in the people list). `current` is the stance the code has now, before this person's own correction. */
export function correctPersonStance(d: CodebookDoc, code: Pick<Code, 'id' | 'name'>, participantId: string, current: Stance, to: Stance, { by }: Who, why?: string): CodebookDoc {
  const key = `person:${code.id}|${participantId}`
  const { [key]: old, ...rest } = d.stanceFixes ?? {}
  if (to === (old?.to ?? current)) return d
  const stanceFixes = to === current ? rest : { ...rest, [key]: { to, from: current, by, at: now(), ...(why?.trim() ? { why: why.trim() } : {}) } }
  return log({ ...d, stanceFixes }, stanceEntry(by, 'reading', key, `${participantId}, ${code.name}`, 'Person’s stance corrected', `From “${STANCE_WORD[old?.to ?? current]}” to “${STANCE_WORD[to]}”`, why))
}

// ─── theme insights: accept, edit, leave out ────────────────────────────────

type InsightNowArg = { text: string; fingerprint: string; snap: InsightSnap }
const insightEntry = (by: string, t: Pick<Theme, 'id' | 'name'>, action: string, detail?: string, why?: string) => themeEntry(by, t, action, detail, why)

function decide(d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, now_: InsightNowArg, status: InsightDecision['status'], text: string, { by }: Who, why?: string): CodebookDoc {
  // Too few people to read a pattern (no sentence): nothing to accept or edit, and leaving it out needs a reason.
  if (!now_.text && (status !== 'Left out' || !why?.trim())) return d
  const decision: InsightDecision = { status, by, at: now(), text, original: now_.text, fingerprint: now_.fingerprint, snap: now_.snap, dataVersion: dataVersionOf(d), ...(why?.trim() ? { why: why.trim() } : {}) }
  return log({ ...d, insights: { ...(d.insights ?? {}), [theme.id]: decision } }, insightEntry(by, theme, `Insight ${status.toLowerCase()}`, status === 'Left out' ? undefined : `“${text}”`, why))
}
/** Accept the computed sentence as it is. */
export const acceptInsight = (d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, now_: InsightNowArg, who: Who) => decide(d, theme, now_, 'Accepted', now_.text, who)
/** Accept the Researcher's wording of it. The caller has already checked it (checkInsightEdit in state/speech.ts). */
export const editInsight = (d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, now_: InsightNowArg, text: string, who: Who) => decide(d, theme, now_, text.trim() === now_.text ? 'Accepted' : 'Edited', text.trim(), who)
/** Keep the insight out of the report. A reason is optional. */
export const leaveOutInsight = (d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, now_: InsightNowArg, who: Who, why?: string) => decide(d, theme, now_, 'Left out', now_.text, who, why)
/** Put an insight back to Suggested. */
export function restoreInsight(d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, { by }: Who): CodebookDoc {
  const { [theme.id]: _gone, ...rest } = d.insights ?? {}
  void _gone
  return log({ ...d, insights: rest }, insightEntry(by, theme, 'Insight restored', 'Back to suggested'))
}

/** The Researcher's note on a theme's insight. Empty removes it. */
export function setInsightNote(d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, note: string, { by }: Who): CodebookDoc {
  const text = note.trim()
  const { [theme.id]: old, ...rest } = d.insightNotes ?? {}
  if ((old ?? '') === text) return d
  return log({ ...d, insightNotes: text ? { ...rest, [theme.id]: text } : rest }, insightEntry(by, theme, text ? 'Note added' : 'Note removed', text || undefined))
}

/** Put a decision back as it was (the Undo after Accept or Leave out). `prev` is what was stored before, or nothing. */
export function undoInsight(d: CodebookDoc, theme: Pick<Theme, 'id' | 'name'>, prev: InsightDecision | undefined, { by }: Who): CodebookDoc {
  const { [theme.id]: _now, ...rest } = d.insights ?? {}
  void _now
  return log({ ...d, insights: prev ? { ...rest, [theme.id]: prev } : rest }, insightEntry(by, theme, 'Insight decision undone', prev ? `Back to “${prev.status}”` : 'Back to suggested'))
}

/** Whether one code's moments go in the report when that differs from its theme's decision. Choosing what the theme says removes the override. */
export function setCodeOverride(d: CodebookDoc, code: Pick<Code, 'id' | 'name'>, on: boolean | undefined, { by }: Who): CodebookDoc {
  const { [code.id]: _old, ...rest } = d.codeOverrides ?? {}
  void _old
  return log({ ...d, codeOverrides: on === undefined ? rest : { ...rest, [code.id]: on } }, entry(by, code, on === undefined ? 'Follows its theme again' : on ? 'Moments added to the report' : 'Moments left out of the report'))
}
