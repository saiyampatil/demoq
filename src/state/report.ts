// Results Analysis, A3 Report state. One report per study, kept in the browser. What the report SAYS is worked out every time from
// what the Researcher accepted in A1 and A2 (state/reportBlocks.ts); this file only keeps what the Researcher DECIDED about each
// block: approved, left out, and the fingerprint of what the block said when they decided. Nothing reaches the client until
// published, and a published version never changes.
import { useSyncExternalStore } from 'react'
import { currentUser } from '@/mock/people'
import { hasAnalysis } from '@/mock/studyAnalysis'
import { now, uid } from './brief'
import type { Line, PartKey } from './reportLines'

export const REPORT_STORAGE_KEY = 'pulseai-qual:report'
/**
 * Bump when the stored shape changes. A report saved with an older shape is replaced by an empty one. Version 4 replaced sentence-level
 * approvals with block-level ones, so every approval saved before it is discarded (an approval of a sentence says nothing about a block).
 */
const SCHEMA = 4
/** A saved report is only usable if it has the current shape. */
export const isCurrentReport = (d: ReportDoc | undefined): d is ReportDoc => !!d && d.schema === SCHEMA

export type Strength = 'Strong' | 'Weak' | 'Unanswered'

export type Citation =
  | { kind: 'excerpt'; id: string }
  | { kind: 'code'; id: string }
  | { kind: 'theme'; id: string }
  | { kind: 'tension'; id: string }

/** A pre-written sentence with its numbers as tokens (see state/reportLogic.ts renderTemplate). `text` is the wording once the numbers are in. */
export type Sentence = { id: string; text: string; template?: string; cites: Citation[] }

export type BlockStatus = 'To review' | 'Approved' | 'Out of date' | 'Left out'

/** What the block said when it was decided: every line's id and exact words, so an Out of date block can show old beside new. */
export type LineSnapshot = { id: string; text: string }

/** The Researcher's decision on one block. Approval is per block, never per sentence. */
export type BlockDecision = {
  status: 'Approved' | 'Left out'
  by: string
  at: string
  /** The report version this decision is for: the one that will be published next. */
  version: number
  /** Fingerprint of the block's inputs when it was decided. If the block's inputs change later, it is Out of date. */
  fingerprint: string
  snapshot: LineSnapshot[]
  /** Why it was left out. Optional. */
  reason?: string
}

export type LogEntry = { id: string; at: string; by: string; action: string; blockId: string; detail?: string }

/** A frozen copy of the Approved blocks as they were published. Never changes after it is written. */
export type PublishedBlock = { id: string; title: string; kicker?: string; number?: number; fingerprint: string; footnote?: string; lines: Line[] }
export type PublishedVersion = { version: number; at: string; by: string; blocks: PublishedBlock[]; /** The Researcher's own words, written by them. */ implications?: string }

/** The executive summary has two drafts: the AI's, and the Researcher's own (which starts empty). */
export type ExecDraft = { active: 'ai' | 'mine'; mine: Partial<Record<PartKey, string>>; implications: string }

export type ReportDoc = {
  studyId: string
  schema: number
  createdAt: string
  updatedAt: string
  /** By block ID. A block with no entry is To review. */
  decisions: Record<string, BlockDecision>
  /** Newest first. */
  log: LogEntry[]
  published: PublishedVersion[]
  /** The Researcher's wording over a generated sentence, by line ID. Numbers stay locked. */
  edits?: Record<string, string>
  exec?: ExecDraft
  /** The Researcher's own note on a block, by block ID. */
  notes?: Record<string, string>
}

type Store = Record<string, ReportDoc>

let store: Store = (() => {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // Storage blocked, corrupt, or no browser (a test).
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

export const newReport = (studyId: string): ReportDoc => {
  const stamp = now()
  return { studyId, schema: SCHEMA, createdAt: stamp, updatedAt: stamp, decisions: {}, log: [], published: [] }
}

/** Creates the report the first time, and replaces one saved with an older shape. Call from an effect, not from render. */
export function ensureReport(studyId: string): ReportDoc | undefined {
  if (!hasAnalysis(studyId)) return undefined
  if (isCurrentReport(store[studyId])) return store[studyId]
  store = { ...store, [studyId]: newReport(studyId) }
  save()
  emit()
  return store[studyId]
}

export function useReport(studyId: string): ReportDoc | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => store[studyId],
  )
}

export const getReport = (studyId: string): ReportDoc | undefined => store[studyId]

export function updateReport(studyId: string, fn: (d: ReportDoc) => ReportDoc) {
  const cur = store[studyId]
  if (!cur) return
  const next = fn(cur)
  if (next === cur) return
  store = { ...store, [studyId]: { ...next, updatedAt: now() } }
  save()
  emit()
}

/** Dev reset: forget every report. */
export function resetReport() {
  store = {}
  save()
  emit()
}

// ─── decisions: pure functions over a ReportDoc ─────────────────────────────

type Who = { by: string }
export type BlockRef = { id: string; fingerprint: string; lines: { id: string; text: string }[] }

export const nextVersion = (d: ReportDoc) => d.published.length + 1

const logged = (d: ReportDoc, by: string, action: string, blockId: string, detail?: string): LogEntry[] => [{ id: uid('rl'), at: now(), by, action, blockId, detail }, ...d.log]

/** Approve a block as it reads now. Records who, when, which report version, and the fingerprint of what it said. Also used to re-approve an Out of date block. */
export function approveBlock(d: ReportDoc, block: BlockRef, { by }: Who): ReportDoc {
  const decision: BlockDecision = { status: 'Approved', by, at: now(), version: nextVersion(d), fingerprint: block.fingerprint, snapshot: block.lines.map((l) => ({ id: l.id, text: l.text })) }
  return { ...d, decisions: { ...d.decisions, [block.id]: decision }, log: logged(d, by, d.decisions[block.id]?.status === 'Approved' ? 'Re-approved' : 'Approved', block.id) }
}

/** Leave a block out of the report. It stays in the workspace, counts as decided, and never reaches the client. */
export function leaveOutBlock(d: ReportDoc, block: BlockRef, { by }: Who, reason?: string): ReportDoc {
  const decision: BlockDecision = { status: 'Left out', by, at: now(), version: nextVersion(d), fingerprint: block.fingerprint, snapshot: block.lines.map((l) => ({ id: l.id, text: l.text })), ...(reason?.trim() ? { reason: reason.trim() } : {}) }
  return { ...d, decisions: { ...d.decisions, [block.id]: decision }, log: logged(d, by, 'Left out', block.id, reason?.trim() || undefined) }
}

/** Put a block back to To review (Undo of a first decision, or taking a block back from Left out). */
export function reopenBlock(d: ReportDoc, blockId: string, { by }: Who): ReportDoc {
  if (!d.decisions[blockId]) return d
  const rest = { ...d.decisions }
  delete rest[blockId]
  return { ...d, decisions: rest, log: logged(d, by, 'Put back to review', blockId) }
}

/** Undo a decision: put back exactly what the block had before it (nothing, or an earlier decision). */
export function restoreDecision(d: ReportDoc, blockId: string, previous: BlockDecision | undefined, { by }: Who): ReportDoc {
  const rest = { ...d.decisions }
  if (previous) rest[blockId] = previous
  else delete rest[blockId]
  return { ...d, decisions: rest, log: logged(d, by, 'Undid a decision', blockId) }
}

export const REPORT_USER = currentUser.name

// ─── wording, drafts, notes ─────────────────────────────────────────────────

export const execOf = (d: ReportDoc): ExecDraft => d.exec ?? { active: 'ai', mine: {}, implications: '' }

export function saveEdit(d: ReportDoc, lineId: string, text: string | undefined, { by }: Who, blockId: string): ReportDoc {
  const edits = { ...(d.edits ?? {}) }
  if (text === undefined) delete edits[lineId]
  else edits[lineId] = text
  return { ...d, edits, log: logged(d, by, text === undefined ? 'Went back to the generated wording' : 'Edited wording', blockId) }
}
export const setExecActive = (d: ReportDoc, active: 'ai' | 'mine', { by }: Who): ReportDoc => ({ ...d, exec: { ...execOf(d), active }, log: logged(d, by, active === 'mine' ? 'Switched to Mine' : 'Switched to AI draft', 'exec') })
export const setMinePart = (d: ReportDoc, part: PartKey, text: string): ReportDoc => ({ ...d, exec: { ...execOf(d), mine: { ...execOf(d).mine, [part]: text } } })
export const setImplications = (d: ReportDoc, text: string): ReportDoc => ({ ...d, exec: { ...execOf(d), implications: text } })
export const setNote = (d: ReportDoc, blockId: string, text: string): ReportDoc => ({ ...d, notes: { ...(d.notes ?? {}), [blockId]: text } })

// ─── publish ────────────────────────────────────────────────────────────────

type PublishBlock = Omit<BlockRef, 'lines'> & { title: string; kicker?: string; number?: number; footnote?: string; lines: Line[]; status: BlockStatus }

/** Freeze the Approved blocks exactly as shown. Nothing is sent. A published version never changes. */
export function publishReport(d: ReportDoc, blocks: PublishBlock[], { by }: Who): ReportDoc {
  const version = nextVersion(d)
  const snap: PublishedVersion = {
    version,
    at: now(),
    by,
    implications: execOf(d).implications.trim() || undefined,
    blocks: blocks.filter((b) => b.status === 'Approved').map((b) => ({ id: b.id, title: b.title, kicker: b.kicker, number: b.number, fingerprint: b.fingerprint, footnote: b.footnote, lines: b.lines.map((l) => ({ ...l })) })),
  }
  return { ...d, published: [...d.published, snap], log: logged(d, by, `Published version ${version}`, 'report') }
}

/** What differs from the last published version: blocks approved since, changed since, or no longer approved. */
export function changesSince(d: ReportDoc, blocks: { id: string; title: string; fingerprint: string; status: BlockStatus }[]): string[] {
  const last = d.published.at(-1)
  if (!last) return []
  const out: string[] = []
  const approved = blocks.filter((b) => b.status === 'Approved')
  for (const b of approved) {
    const was = last.blocks.find((x) => x.id === b.id)
    if (!was) out.push(`${b.title} is approved and was not in version ${last.version}`)
    else if (was.fingerprint !== b.fingerprint) out.push(`${b.title} has changed`)
  }
  for (const w of last.blocks) if (!approved.some((b) => b.id === w.id)) out.push(`${w.title} is no longer approved`)
  if ((execOf(d).implications.trim() || undefined) !== last.implications) out.push('Your implications have changed')
  return out
}
