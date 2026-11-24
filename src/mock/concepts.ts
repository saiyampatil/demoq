// What the Concepts tab needs that the rest of the mock data does not hold (docs/OPEN_QUESTIONS.md, #273 on):
//  - which codes say a concept was picked first, and the concept cards' names
//  - a mock choice task result for each person (Ice Cream only; Pet Food has no choice task, so its "Did" column is hidden)
//  - who did not consent to a face reading
//  - who saw which concepts (everyone saw every concept except where a card failed; a rotated study is in conceptFixtures.ts)
//  - the first reaction at each concept's reveal: label, intensity, confidence, cue, and when it showed, always inside the first five
//    seconds and always before the person began to speak
//  - a few mock "raised before asked" mentions, for the text signals
// Everything is simulated and deterministic. Reveal times come from Review (the card's shownAtSec); the faces are the hand-set first
// reactions in emotion.ts, with only their onset moved earlier when it would have fallen while the person was already speaking.

import { CONCEPTS } from '@/config/concepts'
import { faceAtMoment, hasVideo, type Emotion, type FaceReading, type Intensity } from './emotion'
import { findReviewRecord } from './review'
import { r1 } from './seed'
import { momentPoints, sessionOfParticipant } from './signals'
import { NOT_SEEN } from './signalKit'
import { ICE_ROSTER } from './iceCream/target'

export type ConceptDef = {
  /** The moment ID of its first reaction: m-concept-a, m-concept-b, m-concept-c. */
  id: string
  letter: 'A' | 'B' | 'C'
  /** The card's name: "Mango Lassi". */
  name: string
  /** The code that says people would pick it first. */
  codeId: string
}

export type ChoiceTask = { question: string; /** Each person's pick, by participant. A person with no entry did not complete it. */ picks: Record<string, string> }

export type ConceptStudy = {
  studyId: string
  concepts: ConceptDef[]
  choice?: ChoiceTask
  /** Participants who did not consent to a face reading. They are read on speech only, like audio-only people. */
  noFaceConsent: string[]
  /** Who saw which concepts, when not everyone saw all. Absent means everyone saw every concept (a failed card is in NOT_SEEN). */
  viewed?: Record<string, string[]>
}

const STUDIES: Record<string, ConceptStudy> = {}
export const registerConceptStudy = (s: ConceptStudy) => {
  STUDIES[s.studyId] = s
  return s
}
/** The concepts a study tested, or undefined when it tested none. */
export const conceptStudyOf = (studyId: string): ConceptStudy | undefined => STUDIES[studyId]
export const studiesWithConcepts = () => Object.keys(STUDIES)

/** Whether a person saw a concept. A failed card counts as not seen. */
export const sawConcept = (s: Pick<ConceptStudy, 'viewed'>, participantId: string, conceptId: string): boolean =>
  !(NOT_SEEN[conceptId] ?? []).includes(participantId) && (!s.viewed || !s.viewed[participantId] || s.viewed[participantId].includes(conceptId))

// ─── the studies ────────────────────────────────────────────────────────────

registerConceptStudy({
  studyId: 'pet-food-churn',
  concepts: [
    { id: 'm-concept-a', letter: 'A', name: 'Pause, don’t cancel', codeId: 'c-idea-pause' },
    { id: 'm-concept-b', letter: 'B', name: 'Recipe swap guarantee', codeId: 'c-idea-swap' },
    { id: 'm-concept-c', letter: 'C', name: 'Portion-matched boxes', codeId: 'c-idea-portion' },
  ],
  // No choice task: the interview asked which idea they preferred, and nothing was chosen afterwards. The Did column is hidden.
  noFaceConsent: ['P-3114'],
})

registerConceptStudy({
  studyId: 'ice-cream-flavours',
  concepts: [
    { id: 'm-concept-a', letter: 'A', name: 'Salted Caramel Swirl', codeId: 'ic-pick-caramel' },
    { id: 'm-concept-b', letter: 'B', name: 'Mango Lassi', codeId: 'ic-pick-mango' },
    { id: 'm-concept-c', letter: 'C', name: 'Cookie Dough Crunch', codeId: 'ic-pick-cookie' },
  ],
  choice: {
    question: 'Which tub would you take home today?',
    // Set in iceCream/target.ts, from the design data: Caramel 10, Mango 3, Cookie 7.
    picks: Object.fromEntries(Object.entries(ICE_ROSTER).map(([id, p]) => [id, p.did])),
  },
  noFaceConsent: [],
})

// ─── the first reaction at a reveal ─────────────────────────────────────────

export type RevealReading = {
  participantId: string
  conceptId: string
  sessionId: string
  /** What PulseAI read, how strongly, how sure it is, and what was visible. */
  label: Emotion
  intensity: Intensity
  confidence: number
  cue: string
  /** Seconds after the reveal when it showed. Always less than `speechStartSec` and inside `windowSec`. */
  onsetSec: number
  /** Seconds after the reveal when the person started to speak. */
  speechStartSec: number
  /** The window the face is read in: five seconds, or less if they started speaking sooner. */
  windowSec: number
  /** When the card went up, in seconds into the session. */
  revealAtSec: number
}

const cache = new Map<string, RevealReading | null>()

/**
 * The first reaction a person showed at a concept's reveal, or undefined when none can be read: no video, no consent, never saw it, or no
 * reading. Never a reading from while they were speaking.
 */
export function revealReading(studyId: string, participantId: string, conceptId: string): RevealReading | undefined {
  const study = conceptStudyOf(studyId)
  if (!study) return undefined
  const key = `${studyId}|${participantId}|${conceptId}`
  if (cache.has(key)) return cache.get(key) ?? undefined
  const out = read(study, participantId, conceptId)
  cache.set(key, out ?? null)
  return out
}

function read(study: ConceptStudy, participantId: string, conceptId: string): RevealReading | undefined {
  const concept = study.concepts.find((c) => c.id === conceptId)
  if (!concept || !hasVideo(participantId) || study.noFaceConsent.includes(participantId) || !sawConcept(study, participantId, conceptId)) return undefined
  const face: FaceReading | undefined = faceAtMoment(conceptId, participantId, 'Steady')
  if (!face) return undefined
  const point = momentPoints(conceptId, study.studyId).find((p) => p.participantId === participantId)
  const sessionId = sessionOfParticipant(participantId)
  const revealAtSec = findReviewRecord(sessionId)?.stimuli.find((x) => x.name.startsWith(`Concept ${concept.letter}`))?.shownAtSec
  if (!point || revealAtSec === undefined) return undefined
  const speechStartSec = point.facts.delaySec
  const windowSec = Math.min(CONCEPTS.windowSec, speechStartSec)
  // The reading must fall before they speak. A hand-set onset that would land after it is moved to just before.
  const onsetSec = r1(Math.max(0.2, Math.min(face.onsetSec, windowSec * 0.85)))
  return { participantId, conceptId, sessionId, label: face.emotion, intensity: face.intensity, confidence: face.confidence, cue: face.cue, onsetSec, speechStartSec, windowSec, revealAtSec }
}

// ─── text signals ───────────────────────────────────────────────────────────

/**
 * People who brought a code up before the guide asked about it, by "participant|code", and how many seconds earlier than the question.
 * Mock: the codes' quotes are placed after their question, so the earlier mention is recorded here.
 */
export const EARLY_MENTION: Record<string, number> = {
  'P-3101|c-price-rise': 140, 'P-3103|c-price-rise': 95, 'P-3110|c-price-rise': 210,
  'P-3104|c-piling-up': 120, 'P-3121|c-piling-up': 75,
  'P-3103|c-hard-cancel': 180, 'P-3122|c-hard-cancel': 100,
  'P-4106|ic-lassi-unclear': 60, 'P-4117|ic-lassi-unclear': 85, 'P-4107|ic-lassi-unclear': 45,
  'P-4101|ic-sweet-worry': 130, 'P-4115|ic-sweet-worry': 90,
  'P-4110|ic-price-limit': 150, 'P-4118|ic-price-limit': 110,
}
