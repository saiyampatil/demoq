// A3 Word cloud: what each word is made of, and the Researcher's edits to it. The cloud is a display layer over the codebook: its
// number for a word is the codebook's, minus statements deleted or ignored, plus statements added. Only deletes and adds are saved
// (and logged). Ignores live in the page and are never saved. Nothing here writes to the codebook, the report or a transcript.
import { useSyncExternalStore } from 'react'
import { bandOf, WORDCLOUD, type Band } from '@/config/wordcloud'
import { petOf } from '@/mock/codebook'
import { detailsOf, type Details } from '@/mock/participantDetails'
import { findReviewRecord, transcriptFor } from '@/mock/review'
import { now, uid } from './brief'
import { codeThemes, liveExcerpts, themeCodes, type Basis, type Code, type CodebookDoc, type Theme } from './codebook'
import { numbersOf } from './reportLogic'

export const WORDCLOUD_STORAGE_KEY = 'pulseai-qual:wordcloud'

export type Kind = 'theme' | 'code'
export type WordKey = string // 'theme:t-price' | 'code:c-price-rise'
export const keyOf = (kind: Kind, id: string): WordKey => `${kind}:${id}`

export type Removal = { id: string; wordKey: WordKey; excerptId: string; by: string; at: string }
export type Addition = { id: string; wordKey: WordKey; sessionId: string; participantId: string; turnIndex: number; atSec: number; text: string; by: string; at: string }
export type LogEntry = { id: string; at: string; by: string; action: string; detail?: string }
export type CloudDoc = {
  studyId: string
  removed: Removal[]
  added: Addition[]
  /** What the cloud shows now: the deletes and adds as they stood at the last Regenerate. */
  applied: { removed: string[]; added: string[] }
  regeneratedAt: string
  log: LogEntry[]
}
/** A removal's identity: the word it was removed from and the statement. */
export const removalKey = (wordKey: WordKey, excerptId: string) => `${wordKey}|${excerptId}`

type Store = Record<string, CloudDoc>
let store: Store = (() => {
  try {
    const raw = localStorage.getItem(WORDCLOUD_STORAGE_KEY)
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
    localStorage.setItem(WORDCLOUD_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
}
const blank = (studyId: string): CloudDoc => ({ studyId, removed: [], added: [], applied: { removed: [], added: [] }, regeneratedAt: now(), log: [] })
export function useWordCloud(studyId: string): CloudDoc | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store[studyId],
  )
}
/** Makes the study's cloud record the first time. Call from an effect. */
export function ensureCloud(studyId: string) {
  if (store[studyId]) return
  store = { ...store, [studyId]: blank(studyId) }
  save()
  emit()
}
function update(studyId: string, fn: (d: CloudDoc) => CloudDoc) {
  const doc = store[studyId]
  if (!doc) return
  store = { ...store, [studyId]: fn(doc) }
  save()
  emit()
}
export function resetWordCloud() {
  store = {}
  save()
  emit()
}
const logged = (d: CloudDoc, by: string, action: string, detail?: string): CloudDoc => ({ ...d, log: [{ id: uid('wl'), at: now(), by, action, ...(detail ? { detail } : {}) }, ...d.log] })

export const deleteStatement = (studyId: string, wordKey: WordKey, excerptId: string, wordName: string, by: string) =>
  update(studyId, (d) => (d.removed.some((r) => r.wordKey === wordKey && r.excerptId === excerptId) ? d : logged({ ...d, removed: [...d.removed, { id: uid('rm'), wordKey, excerptId, by, at: now() }] }, by, 'Deleted a statement from the word cloud', wordName)))
export const restoreStatement = (studyId: string, wordKey: WordKey, excerptId: string, wordName: string, by: string) =>
  update(studyId, (d) => logged({ ...d, removed: d.removed.filter((r) => !(r.wordKey === wordKey && r.excerptId === excerptId)) }, by, 'Restored a statement to the word cloud', wordName))
export const addStatement = (studyId: string, a: Omit<Addition, 'id' | 'at'>, wordName: string) =>
  update(studyId, (d) => (d.added.some((x) => x.wordKey === a.wordKey && x.sessionId === a.sessionId && x.turnIndex === a.turnIndex) ? d : logged({ ...d, added: [...d.added, { ...a, id: uid('ad'), at: now() }] }, a.by, 'Added a statement to the word cloud', wordName)))
export const removeAddition = (studyId: string, id: string, wordName: string, by: string) =>
  update(studyId, (d) => logged({ ...d, added: d.added.filter((x) => x.id !== id) }, by, 'Removed an added statement', wordName))
/** Regenerate: the cloud now shows the edits as they stand. */
export const regenerateCloud = (studyId: string, by: string) =>
  update(studyId, (d) => logged({ ...d, applied: { removed: d.removed.map((r) => removalKey(r.wordKey, r.excerptId)), added: d.added.map((a) => a.id) }, regeneratedAt: now() }, by, 'Regenerated the word cloud'))

// ─── statements and words ───────────────────────────────────────────────────

export type Statement = {
  /** The coded quote's ID, or the addition's. */
  id: string
  sessionId: string
  participantId: string
  turnIndex: number
  atSec: number
  text: string
  /** The model's confidence. Statements the Researcher added have none. */
  confidence?: number
  codeId?: string
  codeName?: string
  added: boolean
  additionId?: string
  details: Details
}

/** The edits a calculation applies. Deletes and adds come from the store; ignores come from the page. */
export type Edits = { removed: Set<string>; added: Addition[]; ignored: Set<string> }
export const NO_EDITS: Edits = { removed: new Set(), added: [], ignored: new Set() }

/** The edits as the cloud last showed them (a Regenerate): the saved deletes and adds that were applied then. */
export const appliedEdits = (d: CloudDoc, ignored: Set<string> = new Set()): Edits => ({ removed: new Set(d.applied.removed), added: d.added.filter((a) => d.applied.added.includes(a.id)), ignored })
/** The edits as they stand now. */
export const currentEdits = (d: CloudDoc, ignored: Set<string> = new Set()): Edits => ({ removed: new Set(d.removed.map((r) => removalKey(r.wordKey, r.excerptId))), added: d.added, ignored })

export type WordDef = { key: WordKey; id: string; kind: Kind; name: string; codes: Code[]; theme?: Theme }

/** Every word the cloud could show: accepted themes (not tension themes) or accepted codes. */
export function wordDefs(doc: CodebookDoc, kind: Kind): WordDef[] {
  if (kind === 'theme') return codeThemes(doc).flatMap((theme) => (themeCodes(doc, theme).length ? [{ key: keyOf('theme', theme.id), id: theme.id, kind, name: theme.name, codes: themeCodes(doc, theme), theme }] : []))
  const themeOf = (c: Code) => codeThemes(doc).find((t) => themeCodes(doc, t).some((x) => x.id === c.id))
  return doc.codes.filter((c) => c.status === 'Accepted').map((code) => ({ key: keyOf('code', code.id), id: code.id, kind, name: code.name, codes: [code], theme: themeOf(code) }))
}

/** The model's statements behind a word: the quotes of its accepted codes, from accepted sessions only. */
export function baseStatements(def: WordDef, basis: Basis): Statement[] {
  const seen = new Set<string>()
  const out: Statement[] = []
  for (const code of def.codes)
    for (const e of liveExcerpts(code, basis)) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push({ id: e.id, sessionId: e.sessionId, participantId: e.participantId, turnIndex: e.turnIndex, atSec: e.atSec, text: e.text, confidence: e.confidence, codeId: code.id, codeName: code.name, added: false, details: detailsOf(e.participantId) })
    }
  return out
}

/** Statements with the edits applied. An edit that points at something that no longer exists simply matches nothing. */
export function statementsOf(def: WordDef, basis: Basis, edits: Edits): { included: Statement[]; removed: Statement[]; ignored: Statement[] } {
  const base = baseStatements(def, basis)
  const included: Statement[] = []
  const removed: Statement[] = []
  const ignored: Statement[] = []
  for (const s of base) {
    const k = removalKey(def.key, s.id)
    if (edits.removed.has(k)) removed.push(s)
    else if (edits.ignored.has(k)) ignored.push(s)
    else included.push(s)
  }
  const have = new Set(base.map((s) => `${s.sessionId}|${s.turnIndex}`))
  for (const a of edits.added) {
    // Added to another word, from a session that is no longer accepted, or already a statement here: skipped.
    if (a.wordKey !== def.key || !basis.sessions.has(a.sessionId) || have.has(`${a.sessionId}|${a.turnIndex}`)) continue
    have.add(`${a.sessionId}|${a.turnIndex}`)
    const s: Statement = { id: a.id, sessionId: a.sessionId, participantId: a.participantId, turnIndex: a.turnIndex, atSec: a.atSec, text: a.text, added: true, additionId: a.id, details: detailsOf(a.participantId) }
    if (edits.removed.has(removalKey(def.key, s.id))) removed.push(s)
    else if (edits.ignored.has(removalKey(def.key, s.id))) ignored.push(s)
    else included.push(s)
  }
  return { included, removed, ignored }
}

export type Word = {
  key: WordKey
  id: string
  kind: Kind
  name: string
  /** People with at least one included statement. */
  n: number
  /** Who they are counted against: the codebook's own denominator, from numbersOf. */
  of: number
  /** The codebook's n for the same word, before any edit. */
  codebookN: number
  /** The average of the model's confidence over included statements. Added statements have none and are left out. */
  avg?: number
  band: Band
  theme?: Theme
}

export function wordOf(def: WordDef, doc: CodebookDoc, basis: Basis, edits: Edits): Word | undefined {
  const base = numbersOf(def.id, { doc, basis })
  if (!base) return undefined
  const { included } = statementsOf(def, basis, edits)
  const n = new Set(included.map((s) => s.participantId)).size
  const scored = included.filter((s) => s.confidence !== undefined)
  const avg = scored.length ? scored.reduce((t, s) => t + s.confidence!, 0) / scored.length : undefined
  return { key: def.key, id: def.id, kind: def.kind, name: def.name, n, of: base.of, codebookN: base.n, avg, band: bandOf(avg), theme: def.theme }
}

/** Every word with at least one person, most people first. The layout is made from this list, so the minimum never moves a word. */
export function allWords(doc: CodebookDoc, basis: Basis, kind: Kind, edits: Edits): Word[] {
  return wordDefs(doc, kind)
    .flatMap((d) => {
      const w = wordOf(d, doc, basis, edits)
      return w && w.n > 0 ? [w] : []
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, WORDCLOUD.maxWords)
}

/** What is shown, and how many were left out and why. */
export function shownWords(all: Word[], min: number, doc: CodebookDoc, basis: Basis, kind: Kind, edits: Edits) {
  const pool = wordDefs(doc, kind).flatMap((d) => {
    const w = wordOf(d, doc, basis, edits)
    return w ? [w] : []
  })
  const shown = all.filter((w) => w.n >= min)
  const belowMin = pool.filter((w) => w.n < min).length
  const beyondCap = Math.max(0, pool.filter((w) => w.n >= min).length - shown.length)
  return { shown, belowMin, beyondCap }
}

// ─── pending changes ────────────────────────────────────────────────────────

/** Changes not yet in the cloud: deletes, adds, restores and ignores that differ from the last Regenerate. */
export function pendingChanges(d: CloudDoc, ignored: Set<string>, appliedIgnored: Set<string>): number {
  const now = new Set(d.removed.map((r) => removalKey(r.wordKey, r.excerptId)))
  const was = new Set(d.applied.removed)
  const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length
  const addNow = new Set(d.added.map((a) => a.id))
  return diff(now, was) + diff(addNow, new Set(d.applied.added)) + diff(ignored, appliedIgnored)
}

// ─── transcript search for Add ──────────────────────────────────────────────

export type Hit = { sessionId: string; participantId: string; turnIndex: number; atSec: number; text: string; before: string; after: string; details: Details }
const clip = (t: string | undefined) => (t ?? '').replace(/\s+/g, ' ').slice(0, 140)

/** Participants' words in the full transcripts of accepted sessions only, up to 20, taken a person at a time so it isn't one voice. */
export function searchTranscripts(basis: Basis, query: string): Hit[] {
  const q = query.trim().toLowerCase()
  if (q.length < WORDCLOUD.search.minChars) return []
  const byPerson = new Map<string, Hit[]>()
  for (const sessionId of [...basis.sessions].sort()) {
    const rec = findReviewRecord(sessionId)
    if (!rec || !basis.participants.has(rec.participantId)) continue
    const turns = transcriptFor(sessionId, 'reviewed')
    turns.forEach((t, i) => {
      if (t.speaker !== 'Participant' || !t.text.toLowerCase().includes(q)) return
      const hit: Hit = { sessionId, participantId: rec.participantId, turnIndex: t.index, atSec: t.atSec, text: t.text, before: clip(turns[i - 1]?.text), after: clip(turns[i + 1]?.text), details: detailsOf(rec.participantId) }
      byPerson.set(rec.participantId, [...(byPerson.get(rec.participantId) ?? []), hit])
    })
  }
  const lists = [...byPerson.values()]
  const out: Hit[] = []
  for (let round = 0; out.length < WORDCLOUD.search.maxResults; round++) {
    const row = lists.map((l) => l[round]).filter(Boolean)
    if (!row.length) break
    out.push(...row.slice(0, WORDCLOUD.search.maxResults - out.length))
  }
  return out
}

export const segmentOf = (participantId: string) => `${petOf(participantId)} owner`
