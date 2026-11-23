// Emotion and voice (Results Analysis, step 2): how a reading becomes a count, and how it is checked against the words.
// Worked out every time from the mock readings and the Researcher's corrections, never stored.
//
// The rules, in one place (thresholds are mock values, docs/OPEN_QUESTIONS.md):
// - A face reading counts only when there is video. No video is "no reading", never Neutral.
// - A Researcher's correction replaces PulseAI's label everywhere. "No clear expression" takes it out of every count.
// - Faces are grouped Positive (delight, interest), Neutral (neutral, surprise), Negative (doubt, frustration) and Unclear
//   (confusion). Confusion is not negative in the counts, but it does pull against a positive claim (see the rule below).
// - Faces are for looking at, not for deciding: they play no part in any verdict (state/speech.ts is speech only). Faces stay stored.
// - Words vs delivery, the person-by-person verdict and the insight sentences are in state/speech.ts.

import { DELIVERY_RULE_LINES } from '@/config/delivery'
export { FIT_COLOUR, FIT_DEF, FIT_LABEL, FIT_ORDER, VERDICT_COLOUR, VERDICT_DEF, VERDICT_LABEL, VERDICT_ORDER, SIDE_DEF, SIDE_LABEL, describedLine, sideGroupHead, sideGroupLine, RAISED_TIP, verdictLabel } from '@/config/delivery'
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

export { fitOf, speechAgainst, type Channel, type Fit, type FitResult } from './speech'

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

export { FIT_RULE, fitSplit, type FitPattern, type FitSplit } from './speech'
/** The rule above, in the five lines the screen shows behind "How it’s decided". */
export const FIT_RULE_TEXT = DELIVERY_RULE_LINES.join(' ')

/** "Doubt", "Delight (high)": a label with its strength, for clips and notes. */
export const faceLabel = (f: Face) => (f.emotion ? (f.emotion === 'Neutral' ? 'Neutral' : `${f.emotion} (${f.reading.intensity.toLowerCase()})`) : 'No clear expression')

/** A face's intensity, for sorting: no reading last, then neutral, then by strength. */
export const faceWeight = (f: Face | undefined) => (!f?.emotion ? -1 : f.emotion === 'Neutral' ? 0 : ({ Low: 1, Medium: 2, High: 3 } as Record<Intensity, number>)[f.reading.intensity])
