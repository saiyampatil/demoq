// All mock data for Review (4.8) and Evidence and audit (4.9), in one file so it can be swapped for an API.
// 24 completed sessions: 18 under review, 4 accepted (3 auto-accepted for having no flags), 2 excluded.
// Moderator type is fixed per study (AI-led here), so every session is run by the AI agent. 12 sessions per cohort, matching the quotas.

export const REVIEW_STUDY_ID = 'moisturizer-concept'

export type FlagType =
  | 'Leading question'
  | 'Off-topic answer'
  | 'Low engagement'
  | 'Possible duplicate'
  | 'Audio quality'
  | 'Mandatory question skipped'
  | 'Stimulus not seen'
  | 'Contradictory answer'
export type FlagSeverity = 'High' | 'Medium' | 'Low'
/** Which score a flag belongs to. The two tracks are never read as one list. */
export type FlagTrack = 'Integrity' | 'Quality'
export type ReviewStatus = 'Under review' | 'Accepted' | 'Excluded'
/** Segments are the audience cohorts (Module 2). The names are read from the audience at render time. */
export type CohortId = 'c-younger' | 'c-older'
export type ModeratorType = 'AI agent' | 'Human'

/** Decision support only. A flag never excludes a session by itself. */
export type ReviewFlag = { id: string; type: FlagType; track: FlagTrack; severity: FlagSeverity; rationale: string; atSec: number }

export type Decision = { by: string; at: string; note: string; auto?: boolean }

export type StimulusCard = { name: string; kind: 'Concept card' | 'Image' | 'Video'; shownAtSec: number; result: 'Shown' | 'Failed to load' }
export type SurveyResponse = { question: string; answer: string }

export type ReviewSession = {
  id: string
  cohortId: CohortId
  moderator: string
  moderatorType: ModeratorType
  release: string
  completedAt: string
  durationMin: number
  /** Participant integrity: eligibility and engagement. 0 to 100. */
  integrity: number
  /** Interview quality: moderator thoroughness and objectivity. 0 to 100. Never merged with integrity. */
  quality: number
  flags: ReviewFlag[]
  status: ReviewStatus
  decision?: Decision
  stimuli: StimulusCard[]
  survey: SurveyResponse[]
}

export const FLAG_TYPES: FlagType[] = [
  'Leading question',
  'Off-topic answer',
  'Low engagement',
  'Possible duplicate',
  'Audio quality',
  'Mandatory question skipped',
  'Stimulus not seen',
  'Contradictory answer',
]
export const MODERATOR_TYPES: ModeratorType[] = ['AI agent', 'Human']

export const FLAG_TRACKS: FlagTrack[] = ['Integrity', 'Quality']
export const trackLabel: Record<FlagTrack, string> = { Integrity: 'Participant integrity', Quality: 'Interview quality' }
/** Integrity: eligibility and engagement. Quality: moderator thoroughness and objectivity, and how the interview ran. */
export const FLAG_TRACK: Record<FlagType, FlagTrack> = {
  'Low engagement': 'Integrity',
  'Contradictory answer': 'Integrity',
  'Off-topic answer': 'Integrity',
  'Possible duplicate': 'Integrity',
  'Leading question': 'Quality',
  'Mandatory question skipped': 'Quality',
  'Stimulus not seen': 'Quality',
  'Audio quality': 'Quality',
}

const LIBRARY: Record<FlagType, { severity: FlagSeverity; rationale: string }> = {
  'Leading question': { severity: 'High', rationale: 'The moderator suggested the answer before the participant gave one.' },
  'Off-topic answer': { severity: 'Medium', rationale: 'The answer doesn’t address the question that was asked.' },
  'Low engagement': { severity: 'Medium', rationale: 'Very short answers, and long gaps before replying, across several questions.' },
  'Possible duplicate': { severity: 'High', rationale: 'Same device and near-identical answers to another session in this study.' },
  'Audio quality': { severity: 'Low', rationale: 'Background noise made part of the answer hard to hear.' },
  'Mandatory question skipped': { severity: 'High', rationale: 'A mandatory guide question was never asked.' },
  'Stimulus not seen': { severity: 'Medium', rationale: 'A stimulus failed to load, so the reaction can’t be counted.' },
  'Contradictory answer': { severity: 'Medium', rationale: 'This answer contradicts what the participant said earlier.' },
}

type Row = [id: string, cohortId: CohortId, mod: string, type: ModeratorType, at: string, min: number, integ: number, qual: number, flags: FlagType[], status: ReviewStatus]

const AI = 'AI agent (Ava)'
const ROWS: Row[] = [
  ['P-2041', 'c-younger', AI, 'AI agent', '2026-11-03T11:20:00-05:00', 22, 41, 78, ['Low engagement', 'Mandatory question skipped', 'Contradictory answer', 'Stimulus not seen'], 'Under review'],
  ['P-2042', 'c-older', AI, 'AI agent', '2026-11-03T14:05:00-05:00', 24, 58, 71, ['Leading question', 'Off-topic answer'], 'Under review'],
  ['P-2043', 'c-younger', AI, 'AI agent', '2026-11-03T16:40:00-05:00', 19, 34, 82, ['Low engagement', 'Possible duplicate', 'Audio quality'], 'Under review'],
  ['P-2044', 'c-younger', AI, 'AI agent', '2026-11-04T10:15:00-05:00', 26, 77, 49, ['Leading question'], 'Under review'],
  ['P-2045', 'c-older', AI, 'AI agent', '2026-11-04T12:30:00-05:00', 20, 69, 85, ['Stimulus not seen'], 'Under review'],
  ['P-2046', 'c-younger', AI, 'AI agent', '2026-11-04T15:10:00-05:00', 23, 52, 38, ['Leading question', 'Off-topic answer', 'Mandatory question skipped'], 'Under review'],
  ['P-2047', 'c-younger', AI, 'AI agent', '2026-11-05T09:50:00-05:00', 21, 88, 79, ['Audio quality'], 'Under review'],
  ['P-2048', 'c-older', AI, 'AI agent', '2026-11-05T11:25:00-05:00', 25, 63, 66, ['Off-topic answer'], 'Under review'],
  ['P-2049', 'c-younger', AI, 'AI agent', '2026-11-05T14:00:00-05:00', 18, 29, 74, ['Low engagement', 'Contradictory answer'], 'Under review'],
  ['P-2050', 'c-younger', AI, 'AI agent', '2026-11-06T10:35:00-05:00', 22, 47, 90, ['Possible duplicate'], 'Under review'],
  ['P-2051', 'c-older', AI, 'AI agent', '2026-11-06T13:20:00-05:00', 27, 81, 55, ['Leading question', 'Mandatory question skipped'], 'Under review'],
  ['P-2052', 'c-younger', AI, 'AI agent', '2026-11-06T16:05:00-05:00', 24, 72, 43, ['Leading question', 'Off-topic answer', 'Low engagement'], 'Under review'],
  ['P-2053', 'c-older', AI, 'AI agent', '2026-11-07T09:30:00-05:00', 20, 55, 76, ['Stimulus not seen'], 'Under review'],
  ['P-2054', 'c-older', AI, 'AI agent', '2026-11-07T12:10:00-05:00', 21, 91, 83, ['Audio quality'], 'Under review'],
  ['P-2055', 'c-younger', AI, 'AI agent', '2026-11-07T15:45:00-05:00', 25, 36, 61, ['Contradictory answer', 'Off-topic answer'], 'Under review'],
  ['P-2056', 'c-older', AI, 'AI agent', '2026-11-08T10:00:00-05:00', 19, 66, 88, ['Mandatory question skipped'], 'Under review'],
  ['P-2057', 'c-older', AI, 'AI agent', '2026-11-08T13:15:00-05:00', 26, 79, 51, ['Leading question'], 'Under review'],
  ['P-2058', 'c-younger', AI, 'AI agent', '2026-11-09T09:40:00-05:00', 22, 44, 69, ['Low engagement', 'Stimulus not seen'], 'Under review'],
  ['P-2059', 'c-younger', AI, 'AI agent', '2026-11-03T12:00:00-05:00', 21, 92, 90, [], 'Accepted'],
  ['P-2060', 'c-older', AI, 'AI agent', '2026-11-04T11:00:00-05:00', 24, 87, 84, [], 'Accepted'],
  ['P-2061', 'c-older', AI, 'AI agent', '2026-11-05T10:20:00-05:00', 20, 85, 92, [], 'Accepted'],
  ['P-2062', 'c-younger', AI, 'AI agent', '2026-11-06T11:40:00-05:00', 25, 74, 77, ['Audio quality'], 'Accepted'],
  ['P-2063', 'c-older', AI, 'AI agent', '2026-11-04T16:30:00-05:00', 17, 22, 64, ['Possible duplicate', 'Low engagement', 'Contradictory answer'], 'Excluded'],
  ['P-2064', 'c-older', AI, 'AI agent', '2026-11-07T11:30:00-05:00', 15, 31, 33, ['Leading question', 'Off-topic answer', 'Low engagement', 'Mandatory question skipped'], 'Excluded'],
]

const DECISIONS: Record<string, Decision> = {
  'P-2059': { by: 'PulseAI (auto)', at: '2026-11-03T12:22:00-05:00', note: 'No flags, so the session was accepted automatically. The Researcher can reopen it.', auto: true },
  'P-2060': { by: 'PulseAI (auto)', at: '2026-11-04T11:25:00-05:00', note: 'No flags, so the session was accepted automatically. The Researcher can reopen it.', auto: true },
  'P-2061': { by: 'PulseAI (auto)', at: '2026-11-05T10:42:00-05:00', note: 'No flags, so the session was accepted automatically. The Researcher can reopen it.', auto: true },
  'P-2062': { by: 'Maya Ortiz', at: '2026-11-07T09:10:00-05:00', note: 'Background noise in one answer. The transcript is clear and the answer is usable.' },
  'P-2063': { by: 'Maya Ortiz', at: '2026-11-05T09:30:00-05:00', note: 'Same device and near-identical answers as P-2043. Excluded as a duplicate.' },
  'P-2064': { by: 'Maya Ortiz', at: '2026-11-08T09:05:00-05:00', note: 'The moderator led the answers and the participant disengaged. Not usable.' },
}

const STIMULI: Omit<StimulusCard, 'shownAtSec'>[] = [
  { name: 'Concept A: 72-hour hydration', kind: 'Concept card', result: 'Shown' },
  { name: 'Concept B: Refillable jar', kind: 'Concept card', result: 'Shown' },
  { name: 'Concept C: Barrier repair', kind: 'Concept card', result: 'Shown' },
]

function build(r: Row): ReviewSession {
  const [id, cohortId, moderator, moderatorType, completedAt, durationMin, integrity, quality, flagTypes, status] = r
  const total = durationMin * 60
  const flags: ReviewFlag[] = flagTypes.map((type, i) => ({
    id: `${id}-f${i + 1}`,
    type,
    track: FLAG_TRACK[type],
    severity: LIBRARY[type].severity,
    rationale: LIBRARY[type].rationale,
    atSec: Math.round(((i + 1) * total) / (flagTypes.length + 1)),
  }))
  return {
    id,
    cohortId,
    moderator,
    moderatorType,
    release: 'Release 1',
    completedAt,
    durationMin,
    integrity,
    quality,
    flags,
    status,
    decision: DECISIONS[id],
    stimuli: STIMULI.map((s, i) => ({ ...s, shownAtSec: Math.round(total * (0.3 + i * 0.2)), result: flagTypes.includes('Stimulus not seen') && i === 1 ? 'Failed to load' : 'Shown' })),
    survey: [{ question: 'After seeing the concept, how likely would you be to buy it?', answer: ['Probably would', 'Might or might not', 'Definitely would', 'Probably would not'][id.charCodeAt(5) % 4] }],
  }
}

export const reviewSessions: ReviewSession[] = ROWS.map(build)

// ─── transcripts ────────────────────────────────────────────────────────────

export type Turn = { index: number; atSec: number; speaker: 'AI' | 'Participant' | 'Moderator'; text: string }

const QUESTIONS = [
  'Walk me through your face moisturizer routine.',
  'What do you like about the one you use most?',
  'What would make you try a new one?',
  'What stands out to you about this concept?',
  'Is anything unclear to you?',
  'Does the refill feel premium or cheap?',
]
const ANSWERS = [
  'Mostly a gel-cream, morning and night.',
  'It sinks in fast and doesn’t feel greasy.',
  'If it really lasted all day I’d try it.',
  'The claim is bold, but I’ve heard that before.',
  'I’m not sure what barrier repair means.',
  'It feels premium if the jar looks solid.',
]

/** The full sample is P-2041 at 2,400 turns. Other sessions return a shorter excerpt. */
export function transcriptFor(sessionId: string): Turn[] {
  const s = reviewSessions.find((x) => x.id === sessionId)
  if (!s) return []
  const count = sessionId === 'P-2041' ? 2400 : 160
  const total = s.durationMin * 60
  const speaker: Turn['speaker'] = s.moderatorType === 'AI agent' ? 'AI' : 'Moderator'
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    atSec: Math.floor((i * total) / count),
    speaker: i % 2 === 0 ? speaker : 'Participant',
    text: i % 2 === 0 ? QUESTIONS[(i / 2) % QUESTIONS.length] : ANSWERS[((i - 1) / 2) % ANSWERS.length],
  }))
}

// ─── helpers ────────────────────────────────────────────────────────────────

export type ScoreBand = 'High' | 'Mid' | 'Low'
export const scoreBand = (v: number): ScoreBand => (v >= 75 ? 'High' : v >= 50 ? 'Mid' : 'Low')

export function reviewSummary(list: ReviewSession[]) {
  const n = (s: ReviewStatus) => list.filter((x) => x.status === s).length
  const auto = list.filter((x) => x.status === 'Accepted' && x.decision?.auto).length
  return { total: list.length, underReview: n('Under review'), accepted: n('Accepted'), excluded: n('Excluded'), autoAccepted: auto, reviewedAccepted: n('Accepted') - auto }
}
