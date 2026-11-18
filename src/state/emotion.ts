// Emotion and voice (Results Analysis, step 2): how a reading becomes a count, and how it is checked against the words.
// Worked out every time from the mock readings and the Researcher's corrections, never stored.
//
// The rules, in one place (thresholds are mock values, docs/OPEN_QUESTIONS.md):
// - A face reading counts only when there is video. No video is "no reading", never Neutral.
// - A Researcher's correction replaces PulseAI's label everywhere. "No clear expression" takes it out of every count.
// - Faces are grouped Positive (delight, interest), Neutral (neutral, surprise), Negative (doubt, frustration) and Unclear
//   (confusion). Confusion is never negative, and it is never counted for or against the words.
// - Delivery has two groups. Speech = tone + certainty (hesitation), read for everyone. Face = expression, video only.
// - Words vs delivery only applies where the words make a claim: speaking for something (positive) or complaining (negative).
//   Speech pulls against the words if the tone is Tense, or Flat against a positive claim; hesitation is ignored here.
//   Face pulls against if the expression opposes the claim at medium confidence or higher. Speech and Face never add together.
//   Neither against but marked hesitation: Uncertain, counted and shown, never counted toward Conflicting. Otherwise Matches.
//   Across the people with a claim (the rule and numbers are in src/config/delivery.ts): over half pull against is Conflicting,
//   over half match is Consistent, otherwise Mixed, and under the minimum, too few to read.

import { DELIVERY, DELIVERY_RULE } from '@/config/delivery'
import { EMOTIONS, TONES, VALENCE, VALENCES, type Emotion, type FaceReading, type Intensity, type Tone, type Valence } from '@/mock/emotion'
import type { Point } from '@/mock/signals'
import type { CodebookDoc, FaceFix } from './codebook'

export { EMOTIONS, EMOTION_HINT, INTENSITIES, STANCE_LABEL, TONES, TONE_HINT, VALENCE, VALENCES, VALENCE_WORD, VOICE_RULES, hasVideo, stanceOf } from '@/mock/emotion'
export type { Emotion, FaceReading, Intensity, Stance, Tone, Valence, VoiceReading } from '@/mock/emotion'

// ─── one moment ─────────────────────────────────────────────────────────────

/** The face reading as it stands: PulseAI's, or the Researcher's correction. `emotion` is null for "No clear expression". */
export type Face = { reading: FaceReading; emotion: Emotion | null; fix?: FaceFix }

export function faceOf(p: Point, doc: CodebookDoc): Face | undefined {
  if (!p.face) return undefined
  const fix = doc.faceFixes?.[p.key]
  if (!fix) return { reading: p.face, emotion: p.face.emotion }
  return { reading: p.face, emotion: fix.to === 'No clear expression' ? null : fix.to, fix }
}

/** The two groups of delivery. Speech is tone plus certainty (hesitation); Face is expression, video only. */
export type Channel = 'Speech' | 'Face'
/** One person against their words, once: neither group pulls against (Matches, or Uncertain when certainty is marked), or Speech or Face does. */
export type Fit = 'Matches' | 'Uncertain' | 'Pulls against'
export type FitResult = { fit?: Fit; against: Channel[] }

/** Speech pulls against the words: a tense tone, or a flat one against a positive claim. Hesitation is never used here. */
export const speechAgainst = (p: Point) => (DELIVERY.toneAgainst as readonly string[]).includes(p.voice.tone) || (p.stance === 'Positive' && (DELIVERY.toneAgainstPositive as readonly string[]).includes(p.voice.tone))

export function fitOf(p: Point, face: Face | undefined): FitResult {
  if (!p.stance || p.stance === 'Neutral') return { against: [] }
  const against: Channel[] = []
  const felt = face?.emotion ? VALENCE[face.emotion] : undefined
  const sure = !!face && face.reading.confidence >= DELIVERY.faceMinConfidence
  if (speechAgainst(p)) against.push('Speech')
  if (felt && sure && ((p.stance === 'Positive' && felt === 'Negative') || (p.stance === 'Negative' && felt === 'Positive'))) against.push('Face')
  // Speech and Face never add together: pulling against is one state, however many groups cause it.
  return { fit: against.length ? 'Pulls against' : p.band === 'Marked hesitation' ? 'Uncertain' : 'Matches', against }
}

// ─── many moments ───────────────────────────────────────────────────────────

/** Emotions among the people whose face was read. `noVideo` and `unclear` are said out loud, never folded into Neutral. */
export type EmotionSplit = { counts: Record<Emotion, number>; valence: Record<Valence, number>; read: number; noVideo: number; unclear: number }

export function emotionSplit(points: Point[], doc: CodebookDoc): EmotionSplit {
  const counts = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>
  const valence = Object.fromEntries(VALENCES.map((v) => [v, 0])) as Record<Valence, number>
  let noVideo = 0
  let unclear = 0
  for (const p of points) {
    const f = faceOf(p, doc)
    if (!f) noVideo++
    else if (!f.emotion) unclear++
    else {
      counts[f.emotion]++
      valence[VALENCE[f.emotion]]++
    }
  }
  return { counts, valence, read: points.length - noVideo - unclear, noVideo, unclear }
}

/** The emotions seen most among the faces read. More than one when they tie, so nothing is called "the most" on a tie. Empty when no face was read. */
export function topEmotions(s: EmotionSplit): Emotion[] {
  if (!s.read) return []
  const most = Math.max(...EMOTIONS.map((e) => s.counts[e]))
  return EMOTIONS.filter((e) => s.counts[e] === most)
}

/** Why some people have no face counted, said beside any "of N faces read". Empty when everyone was read. */
export const noReading = (e: EmotionSplit) => [e.noVideo ? `${e.noVideo} audio-only` : '', e.unclear ? `${e.unclear} marked no clear expression` : ''].filter(Boolean).join(', ')

export type ToneSplit = { counts: Record<Tone, number>; n: number }
export function toneSplit(points: Point[]): ToneSplit {
  const counts = Object.fromEntries(TONES.map((t) => [t, 0])) as Record<Tone, number>
  points.forEach((p) => counts[p.voice.tone]++)
  return { counts, n: points.length }
}

export type FitPattern = 'Consistent' | 'Mixed' | 'Conflicting' | 'Too few to read' | 'No claim'
export type FitSplit = { fits: number; uncertain: number; against: number; n: number; pattern: FitPattern }
/** The rule for the Words vs delivery column, from config. */
export const FIT_RULE = { min: DELIVERY.minPeople, majority: DELIVERY.majority }
/** The rule above, in the words the screen shows beside the Words vs delivery column. Built from the same numbers the code uses. */
export const FIT_RULE_TEXT = [DELIVERY_RULE.verdict, DELIVERY_RULE.speech, DELIVERY_RULE.face, DELIVERY_RULE.once, DELIVERY_RULE.uncertain].join(' ')

export function fitSplit(points: Point[], doc: CodebookDoc): FitSplit {
  const fits = points.map((p) => fitOf(p, faceOf(p, doc)).fit).filter((f): f is Fit => !!f)
  const n = fits.length
  const against = fits.filter((f) => f === 'Pulls against').length
  const uncertain = fits.filter((f) => f === 'Uncertain').length
  const matches = n - against - uncertain
  const pattern: FitPattern = points.length && !n ? 'No claim' : n < FIT_RULE.min ? 'Too few to read' : against / n > FIT_RULE.majority ? 'Conflicting' : matches / n > FIT_RULE.majority ? 'Consistent' : 'Mixed'
  return { fits: matches, uncertain, against, n, pattern }
}

/** "Doubt", "Delight (high)": a label with its strength, for clips and notes. */
export const faceLabel = (f: Face) => (f.emotion ? (f.emotion === 'Neutral' ? 'Neutral' : `${f.emotion} (${f.reading.intensity.toLowerCase()})`) : 'No clear expression')

/** A face's intensity, for sorting: no reading last, then neutral, then by strength. */
export const faceWeight = (f: Face | undefined) => (!f?.emotion ? -1 : f.emotion === 'Neutral' ? 0 : ({ Low: 1, Medium: 2, High: 3 } as Record<Intensity, number>)[f.reading.intensity])
