// R24 Evidence and audit trail: a record of Review, never an editor. Rows are derived from the same review
// sessions R21 and R22 read, so a decision made in R22 shows here the moment it is recorded.

import { useSyncExternalStore } from 'react'
import type { ReviewSession } from '@/mock/review'

/** Dev-only: shapes the rows so every state of the table can be seen. "live" reads the real review records. */
export type EvidenceMock = 'live' | 'complete' | 'missing' | 'mixed'
export const evidenceMockLabel: Record<EvidenceMock, string> = {
  live: 'Live review records',
  complete: 'All reviewed',
  missing: 'Some missing decisions',
  mixed: 'Mixed scores',
}

const KEY = 'pulseai-qual:evidence-mock'
const read = (): EvidenceMock => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'complete' || v === 'missing' || v === 'mixed' ? v : 'live'
  } catch {
    return 'live'
  }
}
let mock: EvidenceMock = read()
const listeners = new Set<() => void>()
export function setEvidenceMock(m: EvidenceMock) {
  mock = m
  try {
    localStorage.setItem(KEY, m)
  } catch {
    /* the mock mode is a dev convenience; it just won't survive a refresh */
  }
  listeners.forEach((l) => l())
}
export const useEvidenceMock = (): EvidenceMock =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => mock,
  )

export type Artifact = { present: true; version?: number } | { present: false }
export type DecisionLabel = 'Accepted' | 'Excluded' | 'Request clarification' | 'Replacement ordered' | 'None yet'

export type EvidenceRow = {
  id: string
  participantId: string
  /** The raw transcript is written once by the session and never edited. */
  transcript: Artifact
  /** The reviewed copy is a separate artifact with its own version number. It is never the transcript. */
  reviewed: Artifact
  /** Both scores or neither, side by side. They are never combined. */
  scores: { integrity: number; quality: number } | null
  decision: DecisionLabel
  /** Set when a session was Excluded and a replacement was invited. */
  replacementFor?: boolean
  release: string
  guide: string
  /** What the row lacks, in words. Empty means the session's record is complete. */
  missing: string[]
}

const hasEvent = (r: ReviewSession, type: string) => (r.events ?? []).some((e) => e.type === type)

function derive(r: ReviewSession): EvidenceRow {
  const decided = r.status === 'Accepted' || r.status === 'Excluded'
  const replaced = hasEvent(r, 'replacement')
  const decision: DecisionLabel = r.awaiting ? 'Request clarification' : replaced && r.status === 'Excluded' ? 'Replacement ordered' : r.status === 'Accepted' || r.status === 'Excluded' ? r.status : 'None yet'
  return {
    id: r.id,
    participantId: r.participantId,
    transcript: r.turnCount > 0 ? { present: true } : { present: false },
    // A reviewed copy exists once the session has been reviewed. P-2041-1's was edited, so it is on a later version.
    reviewed: r.reviewed ? { present: true, version: r.reviewed.version } : decided ? { present: true, version: 1 } : { present: false },
    scores: decided || r.awaiting ? { integrity: r.integrity, quality: r.quality } : null,
    decision,
    replacementFor: decision === 'Replacement ordered',
    release: r.release,
    guide: r.guide,
    missing: [],
  }
}

/** What is missing, in the words the table shows. A session still under review lacks its decision, copy and scores. */
export function gaps(row: EvidenceRow): string[] {
  const out: string[] = []
  if (!row.transcript.present) out.push('Raw transcript')
  if (!row.reviewed.present) out.push('Reviewed copy')
  if (!row.scores) out.push('Scores')
  if (row.decision === 'None yet' || row.decision === 'Request clarification') out.push('Review decision')
  return out
}

/** The dev modes reshape rows by position, so the same four sessions always show the same story. */
function shape(rows: EvidenceRow[], mode: EvidenceMock, source: ReviewSession[]): EvidenceRow[] {
  if (mode === 'live') return rows
  return rows.map((row, i) => {
    const s = source[i]
    const base: EvidenceRow = {
      ...row,
      transcript: { present: true },
      reviewed: { present: true, version: s.reviewed?.version ?? 1 },
      scores: { integrity: s.integrity, quality: s.quality },
      decision: i % 3 === 2 ? 'Excluded' : 'Accepted',
      replacementFor: false,
    }
    if (mode === 'complete') return base
    if (mode === 'missing') {
      // One session lacks each artifact, so every kind of gap shows.
      if (i === 0) return { ...base, decision: 'None yet', reviewed: { present: false }, scores: null }
      if (i === 1) return { ...base, transcript: { present: false } }
      if (i === 2) return { ...base, reviewed: { present: false } }
      if (i === 3) return { ...base, decision: 'Request clarification' }
      return base
    }
    // mixed: scores spread across High, Mid and Low, with the decision outcomes a Researcher might see.
    const spread = [
      { integrity: 92, quality: 41 },
      { integrity: 58, quality: 88 },
      { integrity: 34, quality: 71 },
      { integrity: 81, quality: 79 },
      { integrity: 47, quality: 52 },
    ][i % 5]
    const decision: DecisionLabel = i % 5 === 2 ? 'Replacement ordered' : i % 5 === 1 ? 'Excluded' : 'Accepted'
    return { ...base, scores: spread, decision, replacementFor: decision === 'Replacement ordered' }
  })
}

/** One row per session that reached Review, with what is and isn't on file for it. */
export function evidenceRows(review: ReviewSession[], mode: EvidenceMock): EvidenceRow[] {
  return shape(review.map(derive), mode, review).map((r) => ({ ...r, missing: gaps(r) }))
}

export type Retention = { label: string; value: string }
/** Mock policy text. The real retention settings live in R23, which isn't built yet. */
export const retentionPolicy: Retention[] = [
  { label: 'Raw media', value: 'Retained 90 days after fieldwork closes, then deleted' },
  { label: 'Transcripts', value: 'Retained 24 months' },
  { label: 'Reviewed copies and decisions', value: 'Retained for the life of the study record' },
]
