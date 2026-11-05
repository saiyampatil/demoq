// The living codebook (Results Analysis, founder brief step 1). One per study, kept in the browser.
// Counts are never stored: "n of N" is worked out from the quotes and the current Review decisions every time.

import { useSyncExternalStore } from 'react'
import {
  AI_CODER,
  CODE_QUESTIONS,
  CODED_AT,
  CODEBOOK_STUDY,
  EXCERPTS,
  SEED_CODES,
  SEED_LOG,
  SEED_THEMES,
  THEME_SUGGESTIONS,
  petOf,
  type CodeStatus,
  type Excerpt,
  type LogEntry,
  type Pet,
  type SeedCode,
} from '@/mock/codebook'
import { now, uid } from './brief'

export type { CodeStatus, Excerpt, LogEntry, Pet } from '@/mock/codebook'

export type Code = SeedCode
export type Theme = { id: string; name: string; definition: string; codeIds: string[]; by: string; at: string }

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
  log: LogEntry[]
}

// ─── store ──────────────────────────────────────────────────────────────────

const KEY = 'pulseai-qual:codebook'
type Store = Record<string, CodebookDoc>

let store: Store = (() => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // Storage blocked or corrupt.
  }
  return {}
})()
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
  if (studyId !== CODEBOOK_STUDY) return undefined
  return {
    studyId,
    codedAt: CODED_AT,
    builtOn: acceptedSessions,
    codes: structuredClone(SEED_CODES),
    themes: structuredClone(SEED_THEMES),
    pending: {},
    skipped: {},
    dismissedSuggestions: [],
    log: structuredClone(SEED_LOG),
  }
}

export function updateCodebook(studyId: string, fn: (d: CodebookDoc) => CodebookDoc) {
  const doc = store[studyId]
  if (!doc) return
  store = { ...store, [studyId]: fn(doc) }
  save()
  emit()
}

/** Puts the seed in place the first time a study's codebook is opened. */
export function ensureCodebook(studyId: string, acceptedSessions: string[]) {
  if (store[studyId]) return
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

export const questionOf = (id: string) => CODE_QUESTIONS.find((q) => q.id === id)!
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
  if (code.isNew) return basis.participants.size
  const skipped = new Set(questionOf(code.questionId).skipped.map((s) => s.participantId))
  return [...basis.participants].filter((p) => !skipped.has(p)).length
}

export const peopleOf = (code: Code, basis: Basis) => new Set(liveExcerpts(code, basis).map((e) => e.participantId))

export function petSplit(people: Set<string>): Record<Pet, number> {
  const out: Record<Pet, number> = { Dog: 0, Cat: 0 }
  people.forEach((p) => out[petOf(p)]++)
  return out
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

export function unthemed(doc: CodebookDoc): Code[] {
  const inTheme = new Set(doc.themes.flatMap((t) => themeCodes(doc, t).map((c) => c.id)))
  return doc.codes.filter((c) => c.status === 'Accepted' && !inTheme.has(c.id))
}

/** AI theme drafts that still make sense: at least two of their codes are accepted and not yet in a theme. */
export function openSuggestions(doc: CodebookDoc) {
  const free = new Set(unthemed(doc).map((c) => c.id))
  return THEME_SUGGESTIONS.filter((s) => !doc.dismissedSuggestions.includes(s.id))
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
      const kept = t.codeIds.filter((x) => !codeIds.includes(x))
      return t.id === themeId ? { ...t, codeIds: [...kept, ...codeIds] } : { ...t, codeIds: kept }
    }),
  }
}

export function moveCode(d: CodebookDoc, codeId: string, themeId: string | null, { by }: Who): CodebookDoc {
  const from = d.themes.find((t) => themeCodes(d, t).some((c) => c.id === codeId))
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
  return log({ ...d, themes: d.themes.filter((x) => x.id !== id) }, themeEntry(by, t, 'Deleted theme', 'Its codes went back to “Not in a theme”', why))
}

export const dismissSuggestion = (d: CodebookDoc, id: string): CodebookDoc => ({ ...d, dismissedSuggestions: [...d.dismissedSuggestions, id] })

export { AI_CODER, CODE_QUESTIONS, CODEBOOK_STUDY }
