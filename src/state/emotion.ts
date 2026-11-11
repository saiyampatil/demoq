// Emotion and voice (Results Analysis, step 2): how a reading becomes a count, and how it is checked against the words.
// Worked out every time from the mock readings and the Researcher's corrections, never stored.
//
// The rules, in one place (thresholds are mock values, docs/OPEN_QUESTIONS.md):
// - A face reading counts only when there is video. No video is "no reading", never Neutral.
// - A Researcher's correction replaces PulseAI's label everywhere. "No clear expression" takes it out of every count.
// - Words vs delivery only applies where the words make a claim: speaking for something (positive) or complaining (negative).
//   Against a positive claim: a negative face at medium or high intensity, a flat or tense voice, or marked hesitation.
//   Against a complaint: a positive face at medium or high intensity (a laugh while complaining is worth a look).
//   One channel against is "Partly". Two or more, or a high-intensity face against, is "Doesn't fit".

import { EMOTIONS, TONES, VALENCE, VALENCES, type Emotion, type FaceReading, type Intensity, type Tone, type Valence } from '@/mock/emotion'
import type { Point } from '@/mock/signals'
import type { CodebookDoc, FaceFix } from './codebook'

export { EMOTIONS, EMOTION_HINT, INTENSITIES, STANCE_LABEL, TONES, TONE_HINT, VALENCE, VALENCES, VOICE_RULES, hasVideo, stanceOf } from '@/mock/emotion'
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

export type Channel = 'Face' | 'Voice' | 'Hesitation'
export type Fit = 'Fits' | 'Partly' | 'Doesn’t fit'
export type FitResult = { fit?: Fit; against: Channel[] }

export function fitOf(p: Point, face: Face | undefined): FitResult {
  if (!p.stance || p.stance === 'Neutral') return { against: [] }
  const against: Channel[] = []
  const felt = face?.emotion ? VALENCE[face.emotion] : undefined
  const strong = face?.reading.intensity !== 'Low'
  if (felt && strong && ((p.stance === 'Positive' && felt === 'Negative') || (p.stance === 'Negative' && felt === 'Positive'))) against.push('Face')
  if (p.stance === 'Positive' && (p.voice.tone === 'Flat' || p.voice.tone === 'Tense')) against.push('Voice')
  if (p.stance === 'Positive' && p.band === 'Marked hesitation') against.push('Hesitation')
  const highFace = against.includes('Face') && face?.reading.intensity === 'High'
  return { fit: against.length >= 2 || highFace ? 'Doesn’t fit' : against.length === 1 ? 'Partly' : 'Fits', against }
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

/** The emotion seen most, preferring a non-neutral one on a tie. Undefined when nobody's face was read. */
export function topEmotion(s: EmotionSplit): Emotion | undefined {
  if (!s.read) return undefined
  return [...EMOTIONS].sort((a, b) => s.counts[b] - s.counts[a] || Number(a === 'Neutral') - Number(b === 'Neutral'))[0]
}

export type ToneSplit = { counts: Record<Tone, number>; n: number }
export function toneSplit(points: Point[]): ToneSplit {
  const counts = Object.fromEntries(TONES.map((t) => [t, 0])) as Record<Tone, number>
  points.forEach((p) => counts[p.voice.tone]++)
  return { counts, n: points.length }
}

export type FitPattern = 'Consistent' | 'Mixed' | 'Conflicting' | 'Too few to read' | 'No claim'
export type FitSplit = { fits: number; partly: number; doesnt: number; n: number; pattern: FitPattern }
/** Fewer people than this with a claim, and no pattern is read. Matches the hesitation rule. */
export const FIT_MIN = 3

export function fitSplit(points: Point[], doc: CodebookDoc): FitSplit {
  const fits = points.map((p) => fitOf(p, faceOf(p, doc)).fit).filter((f): f is Fit => !!f)
  const n = fits.length
  const doesnt = fits.filter((f) => f === 'Doesn’t fit').length
  const partly = fits.filter((f) => f === 'Partly').length
  const pattern: FitPattern = points.length && !n ? 'No claim' : n < FIT_MIN ? 'Too few to read' : doesnt / n >= 0.4 ? 'Conflicting' : (doesnt + partly) / n >= 0.3 ? 'Mixed' : 'Consistent'
  return { fits: n - doesnt - partly, partly, doesnt, n, pattern }
}

/** "Doubt", "Delight (high)": a label with its strength, for clips and notes. */
export const faceLabel = (f: Face) => (f.emotion ? (f.emotion === 'Neutral' ? 'Neutral' : `${f.emotion} (${f.reading.intensity.toLowerCase()})`) : 'No clear expression')

/** A face's intensity, for sorting: no reading last, then neutral, then by strength. */
export const faceWeight = (f: Face | undefined) => (!f?.emotion ? -1 : f.emotion === 'Neutral' ? 0 : ({ Low: 1, Medium: 2, High: 3 } as Record<Intensity, number>)[f.reading.intensity])
