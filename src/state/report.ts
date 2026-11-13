// Results Analysis, A3 Report state. One report per study, kept in the browser.
// Drafts and approvals live here until publish (docs/ANALYSIS_PLAN.md). Nothing reaches the client until published,
// and a published version never changes. What each sentence means is worked out in state/reportLogic.ts.
import { useSyncExternalStore } from 'react'
import { currentUser } from '@/mock/people'
import { CODEBOOK_STUDY } from '@/state/codebook'
import { now, uid } from './brief'

export const REPORT_STORAGE_KEY = 'pulseai-qual:report'
/** Bump when the stored shape changes. A report saved with an older shape is replaced by a fresh seed. */
const SCHEMA = 3
/** A saved report is only usable if it has the current shape. */
export const isCurrentReport = (d: ReportDoc | undefined): d is ReportDoc => !!d && d.schema === SCHEMA

export type Strength = 'Strong' | 'Weak' | 'Unanswered'
export type DraftKind = 'ai' | 'researcher'

export type Citation =
  | { kind: 'excerpt'; id: string }
  | { kind: 'code'; id: string }
  | { kind: 'theme'; id: string }
  | { kind: 'tension'; id: string }

/**
 * One sentence of the report. `text` is the wording the Researcher sees and approves. `template` is the same sentence with
 * live numbers as tokens ({n:code-id} of {of:code-id}). When the numbers move, the live wording differs from `text` and the
 * sentence offers a suggested update; it never rewrites itself.
 */
export type Sentence = { id: string; text: string; template?: string; cites: Citation[] }

export type LogEntry = {
  id: string
  at: string
  by: string
  action: string
  detail?: string
  before?: string
  after?: string
}

/** An approval is of exact wording and exact citations. Change either and it no longer holds. */
export type Approval = {
  by: string
  at: string
  /** The report version this approval is for: the one that will be published next. */
  version: number
  text: string
  cites: string
  /** Why it was approved without a citation. */
  reason?: string
  /** Why the wording was kept after its numbers changed. */
  keptNumbers?: { why: string; live: string }
}

type Draftable = {
  aiDraft: Sentence[]
  researcherDraft: Sentence[]
  active: DraftKind
  edits: LogEntry[]
}

export type ExecSummary = Draftable
export type Finding = Draftable & {
  questionId: string
  /** Left out of the report by the Researcher. It stays in the workspace. */
  omitted?: { by: string; at: string; why: string }
}

export type PublishedVersion = { version: number; at: string; by: string }

export type ReportDoc = {
  studyId: string
  schema: number
  createdAt: string
  updatedAt: string
  builtOn: string[]
  execSummary: ExecSummary
  findings: Finding[]
  /** By sentence ID. */
  approvals: Record<string, Approval>
  /** Decisions on the report as a whole: approvals, sections left out, numbers kept. Newest first. */
  log: LogEntry[]
  /** Frozen snapshots. A published version never changes. */
  published: PublishedVersion[]
}

export type Target = 'exec' | { questionId: string }
export type ReportSeed = { exec: Sentence[]; findings: Record<string, Sentence[]> }

type Store = Record<string, ReportDoc>

let store: Store = (() => {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY)
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
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
}

function seedReport(studyId: string, builtOn: string[], questionIds: string[], seed: ReportSeed): ReportDoc {
  const stamp = now()
  const fresh = (list: Sentence[]) => list.map((s) => ({ ...s, cites: [...s.cites] }))
  return {
    studyId,
    schema: SCHEMA,
    createdAt: stamp,
    updatedAt: stamp,
    builtOn,
    execSummary: { aiDraft: fresh(seed.exec), researcherDraft: [], active: 'ai', edits: [] },
    findings: questionIds.map((questionId) => ({
      questionId,
      aiDraft: fresh(seed.findings[questionId] ?? []),
      researcherDraft: [],
      active: 'ai',
      edits: [],
    })),
    approvals: {},
    log: [],
    published: [],
  }
}

/** Creates the report the first time, and replaces one saved with an older shape. Call from an effect, not from render. */
export function ensureReport(studyId: string, builtOn: string[], questionIds: string[], seed: ReportSeed): ReportDoc | undefined {
  if (studyId !== CODEBOOK_STUDY) return undefined
  const existing = store[studyId]
  if (existing && existing.schema === SCHEMA) return existing
  const doc = seedReport(studyId, builtOn, questionIds, seed)
  store = { ...store, [studyId]: doc }
  save()
  emit()
  return doc
}

export function useReport(studyId: string): ReportDoc | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store[studyId],
  )
}

/** Applies a change to the stored report. Always works from the latest saved copy, so a slow timer can't overwrite newer edits. */
export function updateReport(studyId: string, fn: (d: ReportDoc) => ReportDoc) {
  const doc = store[studyId]
  if (!doc) return
  store = { ...store, [studyId]: { ...fn(doc), updatedAt: now() } }
  save()
  emit()
}

/** Forgets the saved report so the next visit starts from the AI drafts again. Used by tests. */
export function resetReport() {
  store = {}
  save()
  emit()
}

const entry = (by: string, action: string, detail?: string, before?: string, after?: string): LogEntry => ({
  id: uid('re'),
  at: now(),
  by,
  action,
  ...(detail !== undefined ? { detail } : {}),
  ...(before !== undefined ? { before } : {}),
  ...(after !== undefined ? { after } : {}),
})

const logged = (d: ReportDoc, e: LogEntry): ReportDoc => ({ ...d, log: [e, ...d.log] })

function patch(d: ReportDoc, target: Target, fn: (t: Draftable) => Draftable): ReportDoc {
  if (target === 'exec') return { ...d, execSummary: fn(d.execSummary) }
  return { ...d, findings: d.findings.map((f) => (f.questionId === target.questionId ? { ...f, ...fn(f) } : f)) }
}

export const draftOf = (t: Draftable) => (t.active === 'ai' ? t.aiDraft : t.researcherDraft)

export function setActive(d: ReportDoc, target: Target, draft: DraftKind, { by }: { by: string }): ReportDoc {
  return patch(d, target, (t) => ({
    ...t,
    active: draft,
    edits: [...t.edits, entry(by, 'Set active draft', draft === 'ai' ? 'AI draft' : 'Researcher draft')],
  }))
}

export function copyAIToResearcher(d: ReportDoc, target: Target, { by }: { by: string }): ReportDoc {
  return patch(d, target, (t) => {
    const next = t.aiDraft.map((s) => ({ ...s, id: uid('s'), cites: [...s.cites] }))
    return {
      ...t,
      researcherDraft: next,
      active: 'researcher',
      edits: [...t.edits, entry(by, 'Copied AI draft to Researcher draft', `${next.length} sentence${next.length === 1 ? '' : 's'}`)],
    }
  })
}

/**
 * Keeps a draft's AI sentences in step with what the data now supports, without a log entry. A sentence whose wording (template)
 * and sources are unchanged stays exactly as it is, so its approval and any "numbers changed" suggestion are untouched. A new
 * sentence is added, one that no longer holds is dropped, and one whose wording changed is replaced.
 */
export function syncAIDraft(d: ReportDoc, target: Target, wanted: Sentence[]): ReportDoc {
  const t = target === 'exec' ? d.execSummary : d.findings.find((f) => f.questionId === target.questionId)
  if (!t) return d
  const next = wanted.map((w) => {
    const have = t.aiDraft.find((s) => s.id === w.id)
    return have && have.template === w.template && citesKey(have.cites) === citesKey(w.cites) ? have : w
  })
  const same = next.length === t.aiDraft.length && next.every((s, i) => s === t.aiDraft[i])
  return same ? d : patch(d, target, (x) => ({ ...x, aiDraft: next }))
}

export function replaceAIDraft(d: ReportDoc, target: Target, sentences: Sentence[], { by }: { by: string }): ReportDoc {
  return patch(d, target, (t) => ({
    ...t,
    aiDraft: sentences,
    edits: [...t.edits, entry(by, 'Regenerated AI draft', `${sentences.length} sentence${sentences.length === 1 ? '' : 's'}`)],
  }))
}

/** Saves the text and citations of one Researcher-draft sentence. An ID that isn't in the draft yet adds a new sentence at the end. */
export function saveSentence(
  d: ReportDoc,
  target: Target,
  sentenceId: string,
  value: { text: string; template?: string; cites: Citation[] },
  { by }: { by: string },
): ReportDoc {
  return patch(d, target, (t) => {
    const idx = t.researcherDraft.findIndex((s) => s.id === sentenceId)
    const next: Sentence = { id: sentenceId, text: value.text, ...(value.template ? { template: value.template } : {}), cites: value.cites }
    const researcherDraft = idx >= 0 ? t.researcherDraft.map((s, i) => (i === idx ? next : s)) : [...t.researcherDraft, next]
    const detail = `${value.cites.length} citation${value.cites.length === 1 ? '' : 's'}`
    const log = idx >= 0 ? entry(by, 'Edited sentence', detail, t.researcherDraft[idx].text, value.text) : entry(by, 'Added sentence', detail, undefined, value.text)
    return { ...t, researcherDraft, edits: [...t.edits, log] }
  })
}

export function deleteSentence(d: ReportDoc, target: Target, sentenceId: string, { by }: { by: string }): ReportDoc {
  return patch(d, target, (t) => {
    const gone = t.researcherDraft.find((s) => s.id === sentenceId)
    return { ...t, researcherDraft: t.researcherDraft.filter((s) => s.id !== sentenceId), edits: [...t.edits, entry(by, 'Deleted sentence', undefined, gone?.text)] }
  })
}

// ─── approval ───────────────────────────────────────────────────────────────

export const citesKey = (cites: Citation[]) => cites.map((c) => `${c.kind}:${c.id}`).sort().join('|')
export const nextVersion = (d: ReportDoc) => d.published.length + 1

function findSentence(d: ReportDoc, id: string): Sentence | undefined {
  const lists = [d.execSummary, ...d.findings].flatMap((t) => [...t.aiDraft, ...t.researcherDraft])
  return lists.find((s) => s.id === id)
}

/** Approves one sentence exactly as it reads now. Without a citation, a reason is required and is logged with the approval. */
export function approveSentence(d: ReportDoc, id: string, { by }: { by: string }, opts: { reason?: string; keptNumbers?: { why: string; live: string } } = {}): ReportDoc {
  const s = findSentence(d, id)
  if (!s) return d
  const approval: Approval = { by, at: now(), version: nextVersion(d), text: s.text, cites: citesKey(s.cites), ...(opts.reason?.trim() ? { reason: opts.reason.trim() } : {}), ...(opts.keptNumbers ? { keptNumbers: opts.keptNumbers } : {}) }
  const detail = opts.keptNumbers ? `Kept as written after the numbers changed: ${opts.keptNumbers.why}` : opts.reason?.trim() ? `Without a citation: ${opts.reason.trim()}` : undefined
  return logged({ ...d, approvals: { ...d.approvals, [id]: approval } }, entry(by, 'Approved sentence', detail, undefined, s.text))
}

export function approveSentences(d: ReportDoc, ids: string[], who: { by: string }): ReportDoc {
  return ids.reduce((acc, id) => approveSentence(acc, id, who), d)
}

export function withdrawApproval(d: ReportDoc, id: string, { by }: { by: string }): ReportDoc {
  const s = findSentence(d, id)
  const { [id]: _gone, ...rest } = d.approvals
  void _gone
  return logged({ ...d, approvals: rest }, entry(by, 'Withdrew approval', undefined, s?.text))
}

/** Takes the suggested wording: the live numbers go into the sentence. Its approval no longer holds, so it is to review again. */
export function applyUpdate(d: ReportDoc, target: Target, sentenceId: string, live: string, { by }: { by: string }): ReportDoc {
  const before = findSentence(d, sentenceId)?.text
  const patched = patch(d, target, (t) => {
    const swap = (list: Sentence[]) => list.map((s) => (s.id === sentenceId ? { ...s, text: live } : s))
    return { ...t, aiDraft: swap(t.aiDraft), researcherDraft: swap(t.researcherDraft), edits: [...t.edits, entry(by, 'Updated numbers', undefined, before, live)] }
  })
  return logged(patched, entry(by, 'Updated numbers in a sentence', undefined, before, live))
}

// ─── sections ───────────────────────────────────────────────────────────────

export function omitFinding(d: ReportDoc, questionId: string, why: string, { by }: { by: string }): ReportDoc {
  return logged({ ...d, findings: d.findings.map((f) => (f.questionId === questionId ? { ...f, omitted: { by, at: now(), why: why.trim() } } : f)) }, entry(by, 'Left a finding out of the report', why.trim(), questionId))
}

export function includeFinding(d: ReportDoc, questionId: string, { by }: { by: string }): ReportDoc {
  return logged({ ...d, findings: d.findings.map((f) => (f.questionId === questionId ? { ...f, omitted: undefined } : f)) }, entry(by, 'Put a finding back in the report', undefined, questionId))
}

export const REPORT_USER = currentUser.name
