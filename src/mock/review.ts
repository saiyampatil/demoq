// Review (4.8) and Evidence and audit (4.9) data. The sessions come from the study's one session list
// (mock/sessions.ts): every completed session is here, and nothing else is. Moderator type is fixed per study.
import { DEFAULT_COHORT_NAMES, SEED_SESSIONS, type CohortId, type SeedSession } from './sessions'

export const REVIEW_STUDY_ID = 'moisturizer-concept'

export type FlagType =
  | 'Identity mismatch'
  | 'Screener contradiction'
  | 'Rushed response'
  | 'Repetitive or canned answers'
  | 'Extended silence'
  | 'Duplicate entry'
  | 'Technical error'
  | 'Missed core theme'
  | 'Repetitive AI prompt'
  | 'Insufficient probing'
  | 'Incorrect stimulus presentation'
  | 'Guide deviation'
  | 'Audio-transcript mismatch'
  | 'Leading question'
export type FlagSeverity = 'High' | 'Medium' | 'Low'
/** Which score a flag belongs to. The two tracks are never read as one list. */
export type FlagTrack = 'Integrity' | 'Quality'
export type ReviewStatus = 'Under review' | 'Accepted' | 'Excluded'
/** Segments are the audience cohorts (Module 2). The names are read from the audience at render time. */
export type { CohortId }
export { DEFAULT_COHORT_NAMES }
export type ModeratorType = 'AI agent' | 'Human'

/** Decision support only. A flag never excludes a session by itself. */
export type ReviewFlag = {
  id: string
  type: FlagType
  track: FlagTrack
  severity: FlagSeverity
  rationale: string
  /** The exact moment, matching the transcript turn it points at. */
  atSec: number
  /** 1-based turn number in the transcript. */
  turn: number
}

export type Decision = { by: string; at: string; note: string; auto?: boolean }

export type StimulusStatus = 'Loaded' | 'Fallback used' | 'Failed'
export type StimulusCard = { name: string; version: string; kind: 'Concept card' | 'Image' | 'Video'; shownAtSec: number; status: StimulusStatus }
export type SurveyResponse = {
  question: string
  options: string[]
  answer: string
  answeredAtSec: number
  /** A follow-up probe about the answer. It never changes the recorded answer. */
  probe?: { question: string; answer: string }
}

export type ReviewedMeta = { version: number; editedBy: string; editedAt: string; summary: string; edits: { index: number; text: string }[] }

export type ReviewSession = {
  id: string
  cohortId: CohortId
  moderator: string
  moderatorType: ModeratorType
  /** Release version the session ran on, and the guide it was built from. */
  release: string
  guide: string
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
  /** Notes written by the AI agent. Tagged AI-generated wherever they're shown. */
  aiNotes: string[]
  turnCount: number
  reviewed?: ReviewedMeta
}

export const FLAG_TRACKS: FlagTrack[] = ['Integrity', 'Quality']
export const trackLabel: Record<FlagTrack, string> = { Integrity: 'Participant integrity', Quality: 'Interview quality' }
export const trackShort: Record<FlagTrack, string> = { Integrity: 'Integrity', Quality: 'Interview quality' }
/** Integrity: eligibility and engagement. Quality: moderator thoroughness and objectivity, and how the interview ran. */
export const FLAG_TRACK: Record<FlagType, FlagTrack> = {
  'Identity mismatch': 'Integrity',
  'Screener contradiction': 'Integrity',
  'Rushed response': 'Integrity',
  'Repetitive or canned answers': 'Integrity',
  'Extended silence': 'Integrity',
  'Duplicate entry': 'Integrity',
  'Technical error': 'Integrity',
  'Missed core theme': 'Quality',
  'Repetitive AI prompt': 'Quality',
  'Insufficient probing': 'Quality',
  'Incorrect stimulus presentation': 'Quality',
  'Guide deviation': 'Quality',
  'Audio-transcript mismatch': 'Quality',
  'Leading question': 'Quality',
}
export const FLAG_TYPES = Object.keys(FLAG_TRACK) as FlagType[]
export const MODERATOR_TYPES: ModeratorType[] = ['AI agent', 'Human']

const LIBRARY: Record<FlagType, { severity: FlagSeverity; rationale: string; side: 'AI' | 'Participant'; text: string }> = {
  'Identity mismatch': { severity: 'High', rationale: 'The participant gave an age that doesn’t match their verified record.', side: 'Participant', text: 'I’m 52, actually. My daughter set this up for me.' },
  'Screener contradiction': { severity: 'Medium', rationale: 'The answer contradicts the screener, which said they use a moisturizer every day.', side: 'Participant', text: 'I haven’t really used a moisturizer in years, to be honest.' },
  'Rushed response': { severity: 'Medium', rationale: 'Several one-word answers in a row, given within two seconds of each question.', side: 'Participant', text: 'Fine. Sure. Yes. Next.' },
  'Repetitive or canned answers': { severity: 'Medium', rationale: 'The same phrasing is repeated across unrelated questions.', side: 'Participant', text: 'It’s good. It’s just good. It’s really good.' },
  'Extended silence': { severity: 'Low', rationale: 'No reply for 41 seconds after a direct question.', side: 'Participant', text: '[silence, 41 seconds]' },
  'Duplicate entry': { severity: 'High', rationale: 'Same device and near-identical answers to another session in this study.', side: 'Participant', text: 'It sinks in fast and doesn’t feel greasy, and I use it morning and night.' },
  'Technical error': { severity: 'Low', rationale: 'The connection dropped and the participant rejoined, so part of the answer was lost.', side: 'Participant', text: '[connection dropped, participant rejoined]' },
  'Missed core theme': { severity: 'High', rationale: 'A mandatory guide theme (refill format) was never asked.', side: 'AI', text: 'Great, thanks. Let’s move on to wrap up.' },
  'Repetitive AI prompt': { severity: 'Low', rationale: 'The agent repeated an earlier question word for word.', side: 'AI', text: 'Walk me through your face moisturizer routine.' },
  'Insufficient probing': { severity: 'Medium', rationale: 'A vague answer was accepted without a follow-up.', side: 'AI', text: 'Okay, that makes sense. Next question.' },
  'Incorrect stimulus presentation': { severity: 'Medium', rationale: 'The stimulus did not load as planned, so the reaction can’t be counted as a first reaction.', side: 'AI', text: 'Here is Concept B. [the planned card failed to load; a fallback was shown]' },
  'Guide deviation': { severity: 'Medium', rationale: 'The agent asked about budget, which isn’t in the approved guide.', side: 'AI', text: 'Before we continue, what do you usually spend on skincare each month?' },
  'Audio-transcript mismatch': { severity: 'Low', rationale: 'Background noise made the transcript differ from what was said.', side: 'Participant', text: 'I put it on after [inaudible] and the cream [inaudible] fast.' },
  'Leading question': { severity: 'High', rationale: 'The agent suggested the answer before the participant gave one.', side: 'AI', text: 'Wouldn’t you say this looks more premium than your current moisturizer?' },
}

/** Points a flag takes off its score. Scaled down so the flags never take off more than the score has lost. */
export const SEVERITY_WEIGHT: Record<FlagSeverity, number> = { High: 20, Medium: 12, Low: 6 }

const AI = 'AI agent (Ava)'

const DECISIONS: Record<string, Decision> = {
  'P-2059': { by: 'PulseAI (auto)', at: '2026-11-03T12:22:00-05:00', note: 'Auto-accepted: no flags raised.', auto: true },
  'P-2060': { by: 'PulseAI (auto)', at: '2026-11-04T11:25:00-05:00', note: 'Auto-accepted: no flags raised.', auto: true },
  'P-2061': { by: 'PulseAI (auto)', at: '2026-11-05T10:42:00-05:00', note: 'Auto-accepted: no flags raised.', auto: true },
  'P-2062': { by: 'Maya Ortiz', at: '2026-11-07T09:10:00-05:00', note: 'A short connection drop. The answer was repeated and is usable.' },
  'P-2063': { by: 'Maya Ortiz', at: '2026-11-05T09:30:00-05:00', note: 'Same device and near-identical answers as P-2043. Excluded as a duplicate.' },
  'P-2064': { by: 'Maya Ortiz', at: '2026-11-08T09:05:00-05:00', note: 'The agent led the answers and the participant disengaged. Not usable.' },
}

const STIMULI = [
  { name: 'Concept A: 72-hour hydration', version: 'v1', kind: 'Concept card' as const },
  { name: 'Concept B: Refillable jar', version: 'v1', kind: 'Concept card' as const },
  { name: 'Concept C: Barrier repair', version: 'v2', kind: 'Concept card' as const },
]

const SURVEY_Q = 'After seeing the concept, how likely would you be to buy it?'
const SURVEY_OPTIONS = ['Definitely would not', 'Probably would not', 'Might or might not', 'Probably would', 'Definitely would']

/** The full sample is P-2041 at 2,400 turns. Other sessions get a shorter transcript. */
const turnsFor = (id: string) => (id === 'P-2041' ? 2400 : 160)

function build(seed: SeedSession): ReviewSession {
  const { id, cohortId, at: completedAt, durationMin = 20 } = seed
  const { integrity, quality, status } = seed.review!
  const flagTypes = seed.review!.flags as FlagType[]
  const moderator = AI
  const moderatorType: ModeratorType = 'AI agent'
  const total = durationMin * 60
  const count = turnsFor(id)
  const atOf = (idx: number) => Math.floor((idx * total) / count)
  // A flag points at a real turn: AI-side flags on AI turns (even), participant-side flags on participant turns (odd).
  const idxFor = (sec: number, side: 'AI' | 'Participant') => {
    let i = Math.min(count - 2, Math.max(2, Math.round((sec / total) * count)))
    if (i % 2 !== (side === 'AI' ? 0 : 1)) i += 1
    return i
  }

  const hasStimFlag = flagTypes.includes('Incorrect stimulus presentation')
  const stimuli: StimulusCard[] = STIMULI.map((s, i) => ({ ...s, shownAtSec: atOf(idxFor(total * (0.3 + i * 0.2), 'AI')), status: 'Loaded' as StimulusStatus }))
  if (hasStimFlag) stimuli[1].status = id === 'P-2041' ? 'Fallback used' : parseInt(id.slice(2), 10) % 2 ? 'Failed' : 'Fallback used'

  // The other flags sit at fixed points in the interview, clear of the stimulus (at about half way).
  const spots = [0.18, 0.34, 0.72, 0.88]
  let spot = 0
  const flags: ReviewFlag[] = flagTypes.map((type, i) => {
    const lib = LIBRARY[type]
    const sec = type === 'Incorrect stimulus presentation' ? stimuli[1].shownAtSec : total * spots[spot++ % spots.length]
    const idx = idxFor(sec, lib.side)
    return { id: `${id}-f${i + 1}`, type, track: FLAG_TRACK[type], severity: lib.severity, rationale: lib.rationale, atSec: atOf(idx), turn: idx + 1 }
  })
  // The failed stimulus is shown at the flagged turn.
  const sf = flags.find((f) => f.type === 'Incorrect stimulus presentation')
  if (sf) stimuli[1].shownAtSec = sf.atSec

  const answer = SURVEY_OPTIONS[id.charCodeAt(5) % 5]
  return {
    id,
    cohortId,
    moderator,
    moderatorType,
    release: 'Release v1.0',
    guide: 'Guide v3',
    completedAt,
    durationMin,
    integrity,
    quality,
    flags,
    status,
    decision: DECISIONS[id],
    stimuli,
    survey: [
      {
        question: SURVEY_Q,
        options: SURVEY_OPTIONS,
        answer,
        answeredAtSec: Math.round(total * 0.84),
        probe: id === 'P-2041' ? { question: `You said “${answer}”. What would make it a definite yes?`, answer: 'If it really lasted all day and the jar felt solid. The answer above stays as I chose it.' } : undefined,
      },
    ],
    aiNotes: [
      'Described a gel-cream routine, morning and night, and valued a light feel.',
      `${STIMULI[id.charCodeAt(5) % 3].name.split(':')[0]} drew the strongest reaction.${hasStimFlag ? ' One concept card did not load as planned.' : ''}`,
      flags.length ? `${flags.length} ${flags.length === 1 ? 'flag was' : 'flags were'} raised for review.` : 'No issues were raised during the interview.',
    ],
    turnCount: count,
    reviewed:
      id === 'P-2041'
        ? {
            version: 2,
            editedBy: 'Maya Ortiz',
            editedAt: '2026-11-04T09:20:00-05:00',
            summary: 'Corrected 3 mis-transcribed product names. The raw transcript is unchanged.',
            edits: [
              { index: 119, text: 'I use a gel-cream in the morning, and the Verdane one at night.' },
              { index: 743, text: 'Concept A says 72-hour hydration, which I doubt.' },
              { index: 1501, text: 'The refillable jar looks premium to me.' },
            ],
          }
        : undefined,
  }
}

export const reviewSessions: ReviewSession[] = SEED_SESSIONS.filter((x) => x.variant === 'done' && x.review).map(build)

// ─── transcripts ────────────────────────────────────────────────────────────

export type Turn = { index: number; turn: number; atSec: number; speaker: 'AI' | 'Participant'; text: string }

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

/**
 * The raw transcript is immutable. The reviewed copy is a separate, versioned copy with a few corrections,
 * and who made them. Flagged turns carry the text that raised the flag.
 */
export function transcriptFor(sessionId: string, version: 'raw' | 'reviewed' = 'raw'): Turn[] {
  const s = reviewSessions.find((x) => x.id === sessionId)
  if (!s) return []
  const total = s.durationMin * 60
  const turns: Turn[] = Array.from({ length: s.turnCount }, (_, i) => ({
    index: i,
    turn: i + 1,
    atSec: Math.floor((i * total) / s.turnCount),
    speaker: i % 2 === 0 ? 'AI' : 'Participant',
    text: i % 2 === 0 ? QUESTIONS[(i / 2) % QUESTIONS.length] : ANSWERS[((i - 1) / 2) % ANSWERS.length],
  }))
  s.flags.forEach((f) => {
    turns[f.turn - 1].text = LIBRARY[f.type].text
  })
  if (version === 'reviewed' && s.reviewed) s.reviewed.edits.forEach((e) => (turns[e.index] = { ...turns[e.index], text: e.text }))
  return turns
}

// ─── helpers ────────────────────────────────────────────────────────────────

export type ScoreBand = 'High' | 'Mid' | 'Low'
export const scoreBand = (v: number): ScoreBand => (v >= 75 ? 'High' : v >= 50 ? 'Mid' : 'Low')

export function reviewSummary(list: ReviewSession[]) {
  const n = (s: ReviewStatus) => list.filter((x) => x.status === s).length
  const auto = list.filter((x) => x.status === 'Accepted' && x.decision?.auto).length
  return { total: list.length, underReview: n('Under review'), accepted: n('Accepted'), excluded: n('Excluded'), autoAccepted: auto, reviewedAccepted: n('Accepted') - auto }
}

/**
 * What took points off a score. Each flag on the track takes its severity's weight off, scaled so they never
 * take off more than the score has actually lost; the rest is "other factors". Dismissed flags give theirs back.
 */
export function scoreBreakdown(s: ReviewSession, track: FlagTrack, dismissed: ReadonlySet<string> = new Set()) {
  const base = track === 'Integrity' ? s.integrity : s.quality
  const mine = s.flags.filter((f) => f.track === track)
  const loss = 100 - base
  const raw = mine.reduce((n, f) => n + SEVERITY_WEIGHT[f.severity], 0)
  const scale = raw > loss && raw > 0 ? loss / raw : 1
  const items = mine.map((f) => ({ flag: f, points: Math.round(SEVERITY_WEIGHT[f.severity] * scale), dismissed: dismissed.has(f.id) }))
  const taken = items.reduce((n, i) => n + i.points, 0)
  const other = Math.max(0, loss - taken)
  const returned = items.filter((i) => i.dismissed).reduce((n, i) => n + i.points, 0)
  return { track, base, score: Math.min(100, base + returned), items, other, active: mine.filter((f) => !dismissed.has(f.id)) }
}

export const SESSION_FLAG_SEVERITY_ORDER: FlagSeverity[] = ['High', 'Medium', 'Low']
