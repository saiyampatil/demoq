// Review (4.8) data. The sessions come from the study's one session list
// (mock/sessions.ts): every completed session is here, and nothing else is. Moderator type is fixed per study.
import { SEED_SESSIONS, sessionIdOf, type SeedSession } from './sessions'
import { SKIN_SURVEYS, surveyAnswerFor, type SurveyDef, type SurveyFormat } from './surveys'

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

export type Decision = { by: string; at: string; note: string; /** Exclusion reasons picked in the modal. */ reasons?: string[] }

/**
 * Everything that happens to a session in review, in order, and never erased. The status is worked out from it:
 * the last decision or reopen wins. Seeded decisions are the first entries; the Researcher's actions are appended.
 */
export type ReviewEvent = { id: string; at: string; by: string } & (
  | { type: 'decision'; outcome: 'Accepted' | 'Excluded'; note: string; reasons?: string[] }
  | { type: 'reopen'; reason: string }
  | { type: 'clarify'; to: 'Participant' | 'Moderator'; message: string; flagIds: string[] }
  | { type: 'answer'; from: string; text: string; replyTo: string }
  | { type: 'replacement'; candidateId: string; invitedAs: string }
  | { type: 'dismiss'; flagId: string; reason: string }
)

/** A clarification that has been asked and not answered. */
export type OpenClarification = { id: string; to: 'Participant' | 'Moderator'; message: string; flagIds: string[]; by: string; at: string }

export type StimulusStatus = 'Loaded' | 'Fallback used' | 'Failed'
export type StimulusCard = { name: string; version: string; kind: 'Concept card' | 'Image' | 'Video'; shownAtSec: number; status: StimulusStatus }
export type SurveyResponse = {
  /** The survey's title, so a session with several surveys groups its questions. */
  survey: string
  question: string
  format: SurveyFormat
  options: string[]
  /** Rating scale only: what the two ends mean. */
  scale?: { low: string; high: string }
  answer: string
  answeredAtSec: number
  /** A follow-up probe about the answer. It never changes the recorded answer. */
  probe?: { question: string; answer: string }
}

export type ReviewedMeta = { version: number; editedBy: string; editedAt: string; summary: string; edits: { index: number; text: string }[] }

export type ReviewSession = {
  /** The session's ID, e.g. P-2041-1. It is what the review routes use. */
  id: string
  /** The person, e.g. P-2041. This is the main label on every screen. */
  participantId: string
  /** Which of the participant's sessions this is, and how many they have. The suffix shows only when there is more than one. */
  sessionNo: number
  sessionCount: number
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
  /** false for a session that completed but has no scores or flags yet. It shows "Not scored yet". */
  scored: boolean
  status: ReviewStatus
  decision?: Decision
  /** Worked out from `events` when the session is read through the review state (state/decisions.ts). */
  events?: ReviewEvent[]
  /** Flags the Researcher dismissed, with who and why. A dismissed flag stays listed and stops counting toward the scores. */
  dismissed?: Record<string, { by: string; at: string; reason: string }>
  /** Set while a clarification has been asked and not answered. The status stays Under review. */
  awaiting?: OpenClarification
  /** The scores before any flag was dismissed, so the breakdown can show what was given back. */
  baseScores?: { integrity: number; quality: number }
  stimuli: StimulusCard[]
  survey: SurveyResponse[]
  /** Notes written by the AI agent. Tagged AI-generated wherever they're shown. */
  aiNotes: string[]
  turnCount: number
  /** What was recorded. Absent means video. */
  media?: 'Video' | 'Audio only'
  reviewed?: ReviewedMeta
  /** Seed data: the participant invited in this excluded session's place. */
  seedReplacement?: string
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

/**
 * What differs from one study to the next: the concepts shown, the survey asked, what is said in the transcript, the
 * decisions already made. The review records of the seed study and of Pet Food Subscription Churn are both built from this.
 */
export type ReviewPack = {
  seeds: SeedSession[]
  /** The guide version the interviews ran from, as it reads on a session. */
  guide: string
  stimuli: { name: string; version: string; kind: StimulusCard['kind'] }[]
  /** The surveys the guide runs, in order. Each session answers every question. */
  surveys: SurveyDef[]
  questions: string[]
  answers: string[]
  /** Flag wording that names the product or the topic. Anything not here uses the standard wording. */
  library: Partial<Record<FlagType, Partial<{ rationale: string; text: string }>>>
  decisions: Record<string, Decision>
  /** An excluded participant and who was invited in their place. */
  replacements: Record<string, string>
  reviewed: Record<string, ReviewedMeta>
  /** The session with a long transcript and a survey follow-up probe. */
  sample?: string
  aiNotes: (stimulusName: string, flags: number, stimulusFault: boolean) => string[]
}
const libOf = (pack: ReviewPack, t: FlagType) => ({ ...LIBRARY[t], ...pack.library[t] })
const packOfSession = new Map<string, ReviewPack>()

/** Decisions the seed study already has. They are starting data: the Researcher can reopen any of them. */
const SKIN_DECISIONS: Record<string, Decision> = {
  'P-2062': { by: 'Maya Ortiz', at: '2026-11-07T09:10:00-05:00', note: 'A short connection drop. The answer was repeated and is usable.' },
  'P-2063': { by: 'Maya Ortiz', at: '2026-11-05T09:30:00-05:00', note: 'Same device and near-identical answers as P-2043. Excluded as a duplicate.' },
  'P-2064': { by: 'Maya Ortiz', at: '2026-11-08T09:05:00-05:00', note: 'The agent led the answers and the participant disengaged. Not usable.' },
}

const SKIN_STIMULI = [
  { name: 'Concept A: 72-hour hydration', version: 'v1', kind: 'Concept card' as const },
  { name: 'Concept B: Refillable jar', version: 'v1', kind: 'Concept card' as const },
  { name: 'Concept C: Barrier repair', version: 'v2', kind: 'Concept card' as const },
]


/** The full sample is the pack's sample session at 2,400 turns. Other sessions get a shorter transcript. */
function build(seed: SeedSession, pack: ReviewPack): ReviewSession {
  const { participant, at: completedAt, durationMin = 20 } = seed
  const id = sessionIdOf(seed)
  const { integrity, quality, status } = seed.review!
  const flagTypes = seed.review!.flags as FlagType[]
  const moderator = AI
  const moderatorType: ModeratorType = 'AI agent'
  const total = durationMin * 60
  const count = id === pack.sample ? 2400 : 160
  const atOf = (idx: number) => Math.floor((idx * total) / count)
  // A flag points at a real turn: AI-side flags on AI turns (even), participant-side flags on participant turns (odd).
  const idxFor = (sec: number, side: 'AI' | 'Participant') => {
    let i = Math.min(count - 2, Math.max(2, Math.round((sec / total) * count)))
    if (i % 2 !== (side === 'AI' ? 0 : 1)) i += 1
    return i
  }

  const hasStimFlag = flagTypes.includes('Incorrect stimulus presentation')
  const stimuli: StimulusCard[] = pack.stimuli.map((s, i) => ({ ...s, shownAtSec: atOf(idxFor(total * (0.3 + i * 0.2), 'AI')), status: 'Loaded' as StimulusStatus }))
  if (hasStimFlag) stimuli[1].status = id === pack.sample ? 'Fallback used' : parseInt(id.slice(2), 10) % 2 ? 'Failed' : 'Fallback used'

  // The other flags sit at fixed points in the interview, clear of the stimulus (at about half way).
  const spots = [0.18, 0.34, 0.72, 0.88]
  let spot = 0
  const flags: ReviewFlag[] = flagTypes.map((type, i) => {
    const lib = libOf(pack, type)
    const sec = type === 'Incorrect stimulus presentation' ? stimuli[1].shownAtSec : total * spots[spot++ % spots.length]
    const idx = idxFor(sec, lib.side)
    return { id: `${id}-f${i + 1}`, type, track: FLAG_TRACK[type], severity: lib.severity, rationale: lib.rationale, atSec: atOf(idx), turn: idx + 1 }
  })
  // The failed stimulus is shown at the flagged turn.
  const sf = flags.find((f) => f.type === 'Incorrect stimulus presentation')
  if (sf) stimuli[1].shownAtSec = sf.atSec

  const survey: SurveyResponse[] = pack.surveys.flatMap((sv, si) =>
    sv.questions.map((q, qi, all) => {
      const answer = surveyAnswerFor(participant, sv.title, q)
      return {
        survey: sv.title,
        question: q.text,
        format: q.format,
        options: q.options,
        ...(q.scale ? { scale: q.scale } : {}),
        answer,
        answeredAtSec: Math.round(total * (0.84 - 0.06 * (pack.surveys.length - 1 - si)) + qi * 12 - (all.length - 1) * 6),
        // One session has a follow-up on its first answer. The probe never changes it.
        probe: id === pack.sample && si === 0 && qi === 0 ? { question: `You said “${answer}”. What would make it a definite yes?`, answer: 'If it really lasted all day and the jar felt solid. The answer above stays as I chose it.' } : undefined,
      }
    }),
  )
  return {
    id,
    participantId: participant,
    sessionNo: seed.no ?? 1,
    sessionCount: pack.seeds.filter((x) => x.participant === participant).length,
    moderator,
    moderatorType,
    release: 'Release v1.0',
    guide: pack.guide,
    completedAt,
    durationMin,
    integrity,
    quality,
    flags,
    scored: true,
    status,
    decision: pack.decisions[participant],
    seedReplacement: pack.replacements[participant],
    stimuli,
    survey,
    aiNotes: pack.aiNotes(pack.stimuli[id.charCodeAt(5) % pack.stimuli.length].name.split(':')[0], flags.length, hasStimFlag),
    turnCount: count,
    ...(seed.media ? { media: seed.media } : {}),
    reviewed: pack.reviewed[id],
  }
}


// ─── transcripts ────────────────────────────────────────────────────────────

export type Turn = { index: number; turn: number; atSec: number; speaker: 'AI' | 'Participant'; text: string }

const SKIN_QUESTIONS = [
  'Walk me through your face moisturizer routine.',
  'What do you like about the one you use most?',
  'What would make you try a new one?',
  'What stands out to you about this concept?',
  'Is anything unclear to you?',
  'Does the refill feel premium or cheap?',
]
const SKIN_ANSWERS = [
  'Mostly a gel-cream, morning and night.',
  'It sinks in fast and doesn’t feel greasy.',
  'If it really lasted all day I’d try it.',
  'The claim is bold, but I’ve heard that before.',
  'I’m not sure what barrier repair means.',
  'It feels premium if the jar looks solid.',
]


const SKIN_PACK: ReviewPack = {
  seeds: SEED_SESSIONS,
  guide: 'Guide v3',
  stimuli: SKIN_STIMULI,
  surveys: [SKIN_SURVEYS.reaction, SKIN_SURVEYS.scent],
  questions: SKIN_QUESTIONS,
  answers: SKIN_ANSWERS,
  library: {},
  decisions: SKIN_DECISIONS,
  replacements: {},
  sample: 'P-2041-1',
  reviewed: {
    'P-2041-1': {
      version: 2,
      editedBy: 'Maya Ortiz',
      editedAt: '2026-11-04T09:20:00-05:00',
      summary: 'Corrected 3 mis-transcribed product names. The raw transcript is unchanged.',
      edits: [
        { index: 119, text: 'I use a gel-cream in the morning, and the Verdane one at night.' },
        { index: 743, text: 'Concept A says 72-hour hydration, which I doubt.' },
        { index: 1501, text: 'The refillable jar looks premium to me.' },
      ],
    },
  },
  aiNotes: (stim, flags, fault) => [
    'Described a gel-cream routine, morning and night, and valued a light feel.',
    `${stim} drew the strongest reaction.${fault ? ' One concept card did not load as planned.' : ''}`,
    flags ? `${flags} ${flags === 1 ? 'flag was' : 'flags were'} raised for review.` : 'No issues were raised during the interview.',
  ],
}

/** The review records of a pack: every completed session in its seed list, and nothing else. */
export function buildReviewSessions(pack: ReviewPack): ReviewSession[] {
  const list = pack.seeds.filter((x) => x.variant === 'done' && x.review).map((x) => build(x, pack))
  list.forEach((r) => packOfSession.set(r.id, pack))
  return list
}

export const reviewSessions: ReviewSession[] = buildReviewSessions(SKIN_PACK)

/** Studies with their own review records register them here, so lookups by session ID find them. */
const extraSets: ReviewSession[][] = []
export const registerReviewSessions = (list: ReviewSession[]) => {
  extraSets.push(list)
}
export const findReviewRecord = (id: string): ReviewSession | undefined => reviewSessions.find((x) => x.id === id) ?? extraSets.flat().find((x) => x.id === id)

/** Lines a study writes into its transcripts at fixed turns, e.g. the answers the codebook quotes. */
const placedLines = new Map<string, Map<number, string>>()
export function placeTranscriptLines(sessionId: string, lines: { index: number; text: string }[]) {
  const m = placedLines.get(sessionId) ?? new Map<number, string>()
  lines.forEach((l) => m.set(l.index, l.text))
  placedLines.set(sessionId, m)
}

/**
 * The raw transcript is immutable. The reviewed copy is a separate, versioned copy with a few corrections,
 * and who made them. Flagged turns carry the text that raised the flag.
 */
export function transcriptFor(sessionId: string, version: 'raw' | 'reviewed' = 'raw'): Turn[] {
  const s = findReviewRecord(sessionId)
  const pack = packOfSession.get(sessionId)
  if (!s || !pack) return []
  const total = s.durationMin * 60
  const turns: Turn[] = Array.from({ length: s.turnCount }, (_, i) => ({
    index: i,
    turn: i + 1,
    atSec: Math.floor((i * total) / s.turnCount),
    speaker: i % 2 === 0 ? 'AI' : 'Participant',
    text: i % 2 === 0 ? pack.questions[(i / 2) % pack.questions.length] : pack.answers[((i - 1) / 2) % pack.answers.length],
  }))
  placedLines.get(sessionId)?.forEach((text, i) => {
    if (turns[i]) turns[i] = { ...turns[i], text }
  })
  s.flags.forEach((f) => {
    turns[f.turn - 1].text = libOf(pack, f.type).text
  })
  if (version === 'reviewed' && s.reviewed) s.reviewed.edits.forEach((e) => (turns[e.index] = { ...turns[e.index], text: e.text }))
  return turns
}

// ─── helpers ────────────────────────────────────────────────────────────────

export type ScoreBand = 'High' | 'Mid' | 'Low'
export const scoreBand = (v: number): ScoreBand => (v >= 75 ? 'High' : v >= 50 ? 'Mid' : 'Low')

/**
 * The first entries in a session's history. A seeded decision starts the history; nothing is ever decided by a rule.
 * A completed session arrives Under review and stays there until the Researcher decides.
 */
export function seedEvents(s: ReviewSession): ReviewEvent[] {
  if ((s.status === 'Accepted' || s.status === 'Excluded') && s.decision) {
    const replaced: ReviewEvent[] = s.seedReplacement ? [{ id: `${s.id}-replace`, at: s.decision.at, by: s.decision.by, type: 'replacement', candidateId: `A-${s.seedReplacement.slice(2)}`, invitedAs: s.seedReplacement }] : []
    return [...replaced, { id: `${s.id}-seed`, at: s.decision.at, by: s.decision.by, type: 'decision', outcome: s.status, note: s.decision.note, reasons: s.decision.reasons }]
  }
  return []
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

/** A completed session with no review record yet: it is in the queue, Under review, with nothing scored. */
export function unscoredSession(i: { id: string; participantId: string; no: number; count: number; moderator: string; human: boolean; release: string; guide: string; completedAt: string; durationMin: number; turnCount: number; stimuli: StimulusCard[] }): ReviewSession {
  return {
    id: i.id,
    participantId: i.participantId,
    sessionNo: i.no,
    sessionCount: i.count,
    moderator: i.moderator,
    moderatorType: i.human ? 'Human' : 'AI agent',
    release: i.release,
    guide: i.guide,
    completedAt: i.completedAt,
    durationMin: i.durationMin,
    integrity: 0,
    quality: 0,
    flags: [],
    scored: false,
    status: 'Under review',
    stimuli: i.stimuli,
    survey: [],
    aiNotes: [],
    turnCount: i.turnCount,
  }
}
