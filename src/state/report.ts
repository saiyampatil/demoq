// Results Analysis, A3 Report state. One report per study, kept in the browser.
// Drafts live here until publish (a later phase). Nothing reaches the client until published.
import { useSyncExternalStore } from 'react'
import { currentUser } from '@/mock/people'
import { CODEBOOK_STUDY } from '@/state/codebook'
import { now, uid } from './brief'

export const REPORT_STORAGE_KEY = 'pulseai-qual:report'
/** Bump when the stored shape changes. A report saved with an older shape is replaced by a fresh seed. */
const SCHEMA = 2

export type Strength = 'Strong' | 'Weak' | 'Unanswered'
export type DraftKind = 'ai' | 'researcher'

export type Citation =
  | { kind: 'excerpt'; id: string }
  | { kind: 'code'; id: string }
  | { kind: 'theme'; id: string }
  | { kind: 'tension'; id: string }

/** A sentence with no citations is "uncited". That is derived, not stored. */
export type Sentence = { id: string; text: string; cites: Citation[] }

export type LogEntry = {
  id: string
  at: string
  by: string
  action: string
  detail?: string
  before?: string
  after?: string
}

type Draftable = {
  aiDraft: Sentence[]
  researcherDraft: Sentence[]
  active: DraftKind
  edits: LogEntry[]
}

export type ExecSummary = Draftable
export type Finding = Draftable & { questionId: string }

export type ReportDoc = {
  studyId: string
  schema: number
  createdAt: string
  updatedAt: string
  builtOn: string[]
  execSummary: ExecSummary
  findings: Finding[]
}

export type Target = 'exec' | { questionId: string }
export type ReportSeed = { exec: Sentence[]; findings: Record<string, Sentence[]> }

/**
 * How strong a finding is, from the excerpts under its accepted codes. Assumption, logged in docs/OPEN_QUESTIONS.md:
 * under 2 excerpts is Unanswered, 2 to 5 is Weak, 6 or more is Strong, and a question some sessions were not asked
 * can be at most Weak.
 */
export const STRENGTH = { minExcerpts: 2, strongExcerpts: 6 } as const

export function strengthFor(excerptCount: number, someNotAsked: boolean): Strength {
  if (excerptCount < STRENGTH.minExcerpts) return 'Unanswered'
  if (excerptCount < STRENGTH.strongExcerpts || someNotAsked) return 'Weak'
  return 'Strong'
}

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

const entry = (by: string, action: string, detail?: string, before?: string, after?: string): LogEntry => ({
  id: uid('re'),
  at: now(),
  by,
  action,
  ...(detail !== undefined ? { detail } : {}),
  ...(before !== undefined ? { before } : {}),
  ...(after !== undefined ? { after } : {}),
})

function patch(d: ReportDoc, target: Target, fn: (t: Draftable) => Draftable): ReportDoc {
  if (target === 'exec') return { ...d, execSummary: fn(d.execSummary) }
  return { ...d, findings: d.findings.map((f) => (f.questionId === target.questionId ? { ...f, ...fn(f) } : f)) }
}

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
  value: { text: string; cites: Citation[] },
  { by }: { by: string },
): ReportDoc {
  return patch(d, target, (t) => {
    const idx = t.researcherDraft.findIndex((s) => s.id === sentenceId)
    const next: Sentence = { id: sentenceId, text: value.text, cites: value.cites }
    const researcherDraft = idx >= 0 ? t.researcherDraft.map((s, i) => (i === idx ? next : s)) : [...t.researcherDraft, next]
    const detail = `${value.cites.length} citation${value.cites.length === 1 ? '' : 's'}`
    const log = idx >= 0 ? entry(by, 'Edited sentence', detail, t.researcherDraft[idx].text, value.text) : entry(by, 'Added sentence', detail, undefined, value.text)
    return { ...t, researcherDraft, edits: [...t.edits, log] }
  })
}

export const REPORT_USER = currentUser.name