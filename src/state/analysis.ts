// Results Analysis, step 0: the base. What the analysis is built on, worked out from the same session list and review
// records every other screen reads, so the base can never disagree with Review. Nothing here is stored: a session is
// in the analysis when its Review decision is Accepted, and a corrected transcript replaces the raw one.

import type { FlagType, ReviewSession, ReviewStatus } from '@/mock/review'
import { moderatorName, type FieldworkDoc } from './fieldwork'

/** A caveat on the whole session (its data stays in, but can be checked without it) or on one question (that answer is left out of the question's n). */
export type CaveatScope = 'session' | 'question'
export type Caveat = { flagId: string; type: FlagType; scope: CaveatScope; label: string; detail: string }

/** These two flags take one answer away, not the session: the denominator of that question shrinks instead. */
const QUESTION_LEVEL: ReadonlySet<FlagType> = new Set(['Incorrect stimulus presentation', 'Missed core theme'])

const CAVEAT_LABEL: Record<FlagType, string> = {
  'Identity mismatch': 'Identity mismatch',
  'Screener contradiction': 'Screener contradiction',
  'Rushed response': 'Rushed answers',
  'Repetitive or canned answers': 'Canned answers',
  'Extended silence': 'Long silences',
  'Duplicate entry': 'Possible duplicate',
  'Technical error': 'Technical error',
  'Missed core theme': 'Theme not asked',
  'Repetitive AI prompt': 'Repeated prompt',
  'Insufficient probing': 'Under-probed',
  'Incorrect stimulus presentation': 'Concept not seen',
  'Guide deviation': 'Off-guide',
  'Audio-transcript mismatch': 'Transcript mismatch',
  'Leading question': 'Leading question',
}

export type ModeratorKind = 'AI' | 'AI then human' | 'Human'
export type BaseRow = {
  sessionId: string
  participantId: string
  sessionNo: number
  sessionCount: number
  region: string | null
  state: string | null
  moderator: { kind: ModeratorKind; human?: string }
  transcript: { reviewed: boolean; label: string }
  media: 'Video' | 'Audio only'
  caveats: Caveat[]
  status: ReviewStatus
  decidedAt?: string
  inAnalysis: boolean
  /** Short notes under the participant: only what the table can't say in a column. */
  notes: string[]
}

const firstName = (full: string) => full.split(' ')[0]

function caveatsOf(s: ReviewSession): Caveat[] {
  return s.flags
    .filter((f) => !s.dismissed?.[f.id])
    .map((f) => {
      const scope: CaveatScope = QUESTION_LEVEL.has(f.type) ? 'question' : 'session'
      // A failed or fallback card is named: "Concept B not seen".
      const unseen = f.type === 'Incorrect stimulus presentation' ? s.stimuli.find((x) => x.status !== 'Loaded') : undefined
      const label = unseen ? `${unseen.name.split(':')[0]} not seen` : CAVEAT_LABEL[f.type]
      return { flagId: f.id, type: f.type, scope, label, detail: f.rationale }
    })
}

/** One row per counted session. Accepted rows come first, then undecided, then Excluded, each by participant. */
export function baseRows(review: ReviewSession[], doc: FieldworkDoc | undefined): BaseRow[] {
  const rows = review.map((s): BaseRow => {
    const live = doc?.sessions.find((x) => x.id === s.id)
    const escalated = live?.escalation && (live.escalation.status === 'Joined' || live.escalation.acceptedBy)
    const humanId = live?.escalation?.acceptedBy ?? live?.moderatorId ?? null
    const moderator: BaseRow['moderator'] = escalated
      ? { kind: 'AI then human', human: firstName(moderatorName(humanId)) }
      : s.moderatorType === 'Human'
        ? { kind: 'Human', human: firstName(s.moderator) }
        : { kind: 'AI' }
    const notes: string[] = []
    if (s.sessionCount > 1) notes.push(s.sessionNo > 1 ? `Session ${s.sessionNo} only. Session ${s.sessionNo - 1} ended early.` : `Session ${s.sessionNo} only.`)
    if (moderator.kind === 'AI then human') notes.push('Turns tagged by moderator')
    return {
      sessionId: s.id,
      participantId: s.participantId,
      sessionNo: s.sessionNo,
      sessionCount: s.sessionCount,
      region: live?.region ?? null,
      state: live?.state ?? null,
      moderator,
      transcript: s.reviewed ? { reviewed: true, label: `Reviewed v${s.reviewed.version}` } : { reviewed: false, label: 'Raw' },
      media: s.media ?? 'Video',
      caveats: caveatsOf(s),
      status: s.status,
      decidedAt: s.decision?.at,
      inAnalysis: s.status === 'Accepted',
      notes,
    }
  })
  const rank = (r: BaseRow) => (r.status === 'Accepted' ? 0 : r.status === 'Under review' ? 1 : 2)
  return rows.sort((a, b) => rank(a) - rank(b) || a.participantId.localeCompare(b.participantId, undefined, { numeric: true }))
}

export type BaseSummary = {
  completed: number
  included: BaseRow[]
  excluded: BaseRow[]
  undecided: BaseRow[]
  corrected: BaseRow[]
  /** Whole-session caveats among the sessions in the analysis. */
  caveated: BaseRow[]
  /** Sessions with a question-level caveat: handled in the per-question denominators, not here. */
  questionLevel: BaseRow[]
  audioOnly: BaseRow[]
  video: number
}

export function baseSummary(rows: BaseRow[]): BaseSummary {
  const included = rows.filter((r) => r.inAnalysis)
  return {
    completed: rows.length,
    included,
    excluded: rows.filter((r) => r.status === 'Excluded'),
    undecided: rows.filter((r) => r.status === 'Under review'),
    corrected: included.filter((r) => r.transcript.reviewed),
    caveated: included.filter((r) => r.caveats.some((c) => c.scope === 'session')),
    questionLevel: included.filter((r) => r.caveats.some((c) => c.scope === 'question')),
    audioOnly: included.filter((r) => r.media === 'Audio only'),
    video: included.filter((r) => r.media === 'Video').length,
  }
}

export type BaseFilter = 'all' | 'included' | 'excluded' | 'corrected' | 'caveat' | 'audio'
export const BASE_FILTERS: { key: BaseFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'included', label: 'In the analysis' },
  { key: 'excluded', label: 'Not in analysis' },
  { key: 'corrected', label: 'Corrected transcript' },
  { key: 'caveat', label: 'Carry a caveat' },
  { key: 'audio', label: 'Audio only' },
]

export function filterRows(rows: BaseRow[], filter: BaseFilter): BaseRow[] {
  switch (filter) {
    case 'included':
      return rows.filter((r) => r.inAnalysis)
    case 'excluded':
      return rows.filter((r) => !r.inAnalysis)
    case 'corrected':
      return rows.filter((r) => r.inAnalysis && r.transcript.reviewed)
    case 'caveat':
      return rows.filter((r) => r.inAnalysis && r.caveats.some((c) => c.scope === 'session'))
    case 'audio':
      return rows.filter((r) => r.inAnalysis && r.media === 'Audio only')
    default:
      return rows
  }
}
