// Emotion readings for Pet Food Subscription Churn: what PulseAI would read from the face (video) and the voice (audio)
// at each coded quote and each key moment. Everything is simulated and deterministic: the same moment always gives the
// same reading. The concept reactions are written by hand so the study tells one coherent story (docs/DECISIONS.md):
//   Concept A (pause): surprise and doubt. Concept B (recipe swap): confusion for some, interest for others.
//   Concept C (portion-matched boxes): the warmest first reaction, including from people who picked pause in words.
//
// A face reading is a lead, not a verdict: it always carries the visible cue it rests on and a confidence, it is read
// against the person's own resting face, and a Researcher can correct it. No video means no reading, never "Neutral".

import type { Band } from './signals'
import { r1, seeded } from './seed'
import { PET_SEED_SESSIONS } from './sessions'

// ─── the vocabulary ─────────────────────────────────────────────────────────

/** A research set, not the clinical one: confusion and doubt are what a concept test needs; fear rarely is. */
export type Emotion = 'Delight' | 'Interest' | 'Surprise' | 'Neutral' | 'Confusion' | 'Doubt' | 'Frustration'
/** Ordered from warm to cold, so bars read the same way everywhere. */
export const EMOTIONS: Emotion[] = ['Delight', 'Interest', 'Surprise', 'Neutral', 'Confusion', 'Doubt', 'Frustration']

export type Valence = 'Positive' | 'Neutral' | 'Negative'
export const VALENCES: Valence[] = ['Positive', 'Neutral', 'Negative']
export const VALENCE: Record<Emotion, Valence> = {
  Delight: 'Positive',
  Interest: 'Positive',
  Surprise: 'Neutral',
  Neutral: 'Neutral',
  Confusion: 'Negative',
  Doubt: 'Negative',
  Frustration: 'Negative',
}

/** What each label means, in the words a researcher would use. Shown in tooltips and the legend. */
export const EMOTION_HINT: Record<Emotion, string> = {
  Delight: 'A clear, genuine smile: cheeks raised, eyes crinkled',
  Interest: 'Engaged: leaning in, brows lifted, eyes on the material',
  Surprise: 'A quick brow raise and widened eyes. Neither good nor bad on its own',
  Neutral: 'No movement beyond this person’s resting face',
  Confusion: 'Brows drawn together, a squint, a look back at the material',
  Doubt: 'Lips pressed or pulled to one side, a glance away, a small head shake',
  Frustration: 'Jaw tight, brows lowered, a sharp breath out or an eye roll',
}

export type Intensity = 'Low' | 'Medium' | 'High'
export const INTENSITIES: Intensity[] = ['Low', 'Medium', 'High']

export type FaceReading = {
  emotion: Emotion
  /** How strongly it showed, against this person's resting face. Neutral is always Low. */
  intensity: Intensity
  /** PulseAI's confidence in the label, 0 to 1. Shown as High, Medium or Low, never as a client number. */
  confidence: number
  /** What was visible, in plain words. A label is never shown without it. */
  cue: string
  /** Seconds into the moment when it showed. */
  onsetSec: number
}

/** What the words claim at a quote, set once per code. A complaint said with a frown is consistent, not a warning sign. */
export type Stance = 'Positive' | 'Negative' | 'Neutral'

export type Tone = 'Animated' | 'Even' | 'Flat' | 'Tense'
export const TONES: Tone[] = ['Animated', 'Even', 'Flat', 'Tense']
export const TONE_HINT: Record<Tone, string> = {
  Animated: 'Wider pitch than usual at a normal or quicker pace',
  Even: 'Close to how this person usually sounds',
  Flat: 'Narrow pitch and quieter than usual',
  Tense: 'Quicker than usual with a narrow, clipped pitch',
}

export type VoiceReading = {
  /** Words a minute here, and this person's usual. */
  pace: number
  usualPace: number
  /** Pitch range in semitones here, and this person's usual. */
  pitch: number
  usualPitch: number
  /** Loudness against their usual, in dB. */
  loudness: number
  tone: Tone
  reason: string
}

// ─── who has video ──────────────────────────────────────────────────────────

const AUDIO_ONLY = new Set(PET_SEED_SESSIONS.filter((s) => s.media === 'Audio only').map((s) => s.participant))
export const hasVideo = (participantId: string) => !AUDIO_ONLY.has(participantId)

// ─── voice: measured against the person's own usual ─────────────────────────

/** Mock thresholds (docs/OPEN_QUESTIONS.md). Ratios are against this person's usual pace and pitch range. */
export const VOICE_RULES = { tensePace: 1.2, tensePitch: 0.9, flatPitch: 0.75, flatLoudness: -2, animatedPitch: 1.25, animatedPace: 0.95 }

export function toneOf(v: Pick<VoiceReading, 'pace' | 'usualPace' | 'pitch' | 'usualPitch' | 'loudness'>): Tone {
  const pace = v.pace / v.usualPace
  const pitch = v.pitch / v.usualPitch
  if (pace >= VOICE_RULES.tensePace && pitch <= VOICE_RULES.tensePitch) return 'Tense'
  if (pitch <= VOICE_RULES.flatPitch && v.loudness <= VOICE_RULES.flatLoudness) return 'Flat'
  if (pitch >= VOICE_RULES.animatedPitch && pace >= VOICE_RULES.animatedPace) return 'Animated'
  return 'Even'
}

const usualPace = (p: string) => Math.round(125 + 35 * seeded(p, 21))
const usualPitch = (p: string) => r1(3.6 + 2.8 * seeded(p, 22))

/** Ranges that land in each tone: [pace ratio], [pitch ratio], [loudness dB]. */
const TONE_RANGES: Record<Tone, [[number, number], [number, number], [number, number]]> = {
  Animated: [[1.0, 1.15], [1.3, 1.6], [0, 3]],
  Even: [[0.9, 1.1], [0.86, 1.14], [-1, 1]],
  Flat: [[0.8, 0.95], [0.55, 0.7], [-4, -2.5]],
  Tense: [[1.24, 1.4], [0.7, 0.85], [1, 3]],
}
const within = ([lo, hi]: [number, number], x: number) => lo + (hi - lo) * x

/** Hand-set tones at coded quotes, by "codeId:participantId", where the story needs them. */
const VOICE_OVERRIDES: Record<string, Tone> = {
  'c-idea-pause:P-3104': 'Animated',
  'c-idea-pause:P-3109': 'Flat',
  'c-idea-pause:P-3121': 'Tense',
}
/** "x:c-idea-pause-P-3109-2" to "c-idea-pause:P-3109". */
const quoteRef = (key: string) => {
  const m = key.match(/^x:(.+)-(P-\d+)-\d+$/)
  return m ? `${m[1]}:${m[2]}` : ''
}

function targetTone(key: string, band: Band, stance?: Stance): Tone {
  const x = seeded(key, 30)
  if (band === 'Marked hesitation') return x < 0.45 ? 'Tense' : x < 0.75 ? 'Flat' : 'Even'
  if (band === 'Some hesitation') return x < 0.2 ? 'Tense' : x < 0.35 ? 'Flat' : x < 0.8 ? 'Even' : 'Animated'
  if (stance === 'Positive') return x < 0.45 ? 'Animated' : x < 0.95 ? 'Even' : 'Flat'
  if (stance === 'Negative') return x < 0.2 ? 'Tense' : x < 0.3 ? 'Animated' : 'Even'
  return x < 0.15 ? 'Animated' : x < 0.9 ? 'Even' : 'Flat'
}

export function voiceAt(key: string, participantId: string, band: Band, stance?: Stance): VoiceReading {
  const tone = VOICE_OVERRIDES[quoteRef(key)] ?? targetTone(key, band, stance)
  const [paceR, pitchR, loudR] = TONE_RANGES[tone]
  const up = usualPace(participantId)
  const ui = usualPitch(participantId)
  const v = { pace: Math.round(up * within(paceR, seeded(key, 31))), usualPace: up, pitch: r1(ui * within(pitchR, seeded(key, 32))), usualPitch: ui, loudness: r1(within(loudR, seeded(key, 33))) }
  const measured = toneOf(v)
  const louder = v.loudness === 0 ? 'as loud as usual' : `${Math.abs(v.loudness)} dB ${v.loudness > 0 ? 'louder' : 'quieter'} than usual`
  return { ...v, tone: measured, reason: `${v.pace} words a minute against their usual ${v.usualPace}, a pitch range of ${v.pitch} semitones against ${v.usualPitch}, ${louder}.` }
}

// ─── face: read against the person's resting face ───────────────────────────

const CUES: Record<Emotion, string[]> = {
  Delight: ['Broad smile reaching the eyes, cheeks raised', 'Smile widened as they spoke, eyes crinkled', 'Quick grin, then a nod'],
  Interest: ['Leaned in, brows lifted, eyes on the card', 'Small nod, steady gaze at the screen', 'Head tilt and a slight lean forward'],
  Surprise: ['Brows shot up, eyes widened for a moment', 'Quick brow raise and a blink', 'Eyes widened, mouth briefly open'],
  Neutral: ['Relaxed face, no change from their resting face', 'Still face, steady gaze', 'No movement beyond their usual'],
  Confusion: ['Brows drew together, a squint at the card', 'Brief frown and a look back at the screen', 'Head tilt with a furrowed brow'],
  Doubt: ['Lips pressed, eyes glanced away', 'Mouth pulled to one side, a small head shake', 'Brows lowered, a slow exhale'],
  Frustration: ['Jaw tightened, brows lowered', 'Eye roll and tight lips', 'Sharp breath out, a short head shake'],
}

const CONFIDENCE: Record<Intensity, [number, number]> = { High: [0.82, 0.93], Medium: [0.68, 0.84], Low: [0.52, 0.7] }

function reading(key: string, emotion: Emotion, intensity: Intensity): FaceReading {
  const level: Intensity = emotion === 'Neutral' ? 'Low' : intensity
  const range: [number, number] = emotion === 'Neutral' ? [0.74, 0.9] : CONFIDENCE[level]
  const cues = CUES[emotion]
  return {
    emotion,
    intensity: level,
    confidence: Math.round(within(range, seeded(key, 41)) * 100) / 100,
    cue: cues[Math.floor(seeded(key, 42) * cues.length)],
    onsetSec: r1(0.3 + 2.2 * seeded(key, 43)),
  }
}

type Set2 = [Emotion, Intensity]

/**
 * First reactions to each concept, in the first five seconds, for everyone with video. Written by hand.
 * P-3106 never saw Concept B (the card failed), so has no reading there.
 */
const CONCEPT_FACES: Record<string, Record<string, Set2>> = {
  'm-concept-a': {
    'P-3101': ['Confusion', 'Medium'],
    'P-3102': ['Interest', 'Medium'],
    'P-3103': ['Neutral', 'Low'],
    'P-3104': ['Doubt', 'Medium'],
    'P-3106': ['Neutral', 'Low'],
    'P-3107': ['Interest', 'Low'],
    'P-3108': ['Surprise', 'Low'],
    'P-3109': ['Doubt', 'High'],
    'P-3111': ['Neutral', 'Low'],
    'P-3114': ['Interest', 'Low'],
    'P-3115': ['Interest', 'Medium'],
    'P-3116': ['Surprise', 'Medium'],
    'P-3117': ['Neutral', 'Low'],
    'P-3120': ['Doubt', 'Medium'],
    'P-3121': ['Surprise', 'Medium'],
    'P-3122': ['Doubt', 'Low'],
  },
  'm-concept-b': {
    'P-3101': ['Interest', 'Low'],
    'P-3102': ['Interest', 'Medium'],
    'P-3103': ['Neutral', 'Low'],
    'P-3104': ['Neutral', 'Low'],
    'P-3107': ['Confusion', 'Medium'],
    'P-3108': ['Delight', 'Medium'],
    'P-3109': ['Neutral', 'Low'],
    'P-3111': ['Interest', 'Medium'],
    'P-3114': ['Neutral', 'Low'],
    'P-3115': ['Confusion', 'Low'],
    'P-3116': ['Interest', 'Medium'],
    'P-3117': ['Neutral', 'Low'],
    'P-3120': ['Confusion', 'High'],
    'P-3121': ['Neutral', 'Low'],
    'P-3122': ['Neutral', 'Low'],
  },
  'm-concept-c': {
    'P-3101': ['Interest', 'Low'],
    'P-3102': ['Delight', 'High'],
    'P-3103': ['Neutral', 'Low'],
    'P-3104': ['Delight', 'High'],
    'P-3106': ['Neutral', 'Low'],
    'P-3107': ['Interest', 'Medium'],
    'P-3108': ['Surprise', 'Medium'],
    'P-3109': ['Delight', 'Medium'],
    'P-3111': ['Neutral', 'Low'],
    'P-3114': ['Interest', 'Medium'],
    'P-3115': ['Delight', 'Low'],
    'P-3116': ['Interest', 'Low'],
    'P-3117': ['Neutral', 'Low'],
    'P-3120': ['Doubt', 'Low'],
    'P-3121': ['Delight', 'High'],
    'P-3122': ['Delight', 'Medium'],
  },
}

/** Hand-set readings at coded quotes, by "codeId:participantId", where the story needs them. The rest are drawn below. */
const QUOTE_FACES: Record<string, Set2> = {
  // Picked pause in words. One looked engaged; two looked unsure as they said it.
  'c-idea-pause:P-3104': ['Interest', 'Medium'],
  'c-idea-pause:P-3109': ['Doubt', 'Medium'],
  'c-idea-pause:P-3121': ['Doubt', 'Medium'],
  'c-idea-portion:P-3102': ['Delight', 'High'],
  'c-idea-portion:P-3122': ['Delight', 'Medium'],
  'c-idea-swap:P-3101': ['Doubt', 'Low'],
  'c-idea-swap:P-3108': ['Delight', 'Medium'],
  'c-idea-swap:P-3111': ['Interest', 'Low'],
  'c-idea-swap:P-3116': ['Interest', 'Medium'],
  'c-swap-unclear:P-3106': ['Confusion', 'Medium'],
  'c-swap-unclear:P-3120': ['Confusion', 'High'],
  'c-flex-first:P-3104': ['Interest', 'Medium'],
  'c-flex-first:P-3109': ['Doubt', 'Low'],
  'c-flex-first:P-3114': ['Interest', 'Low'],
  'c-flex-first:P-3121': ['Neutral', 'Low'],
  'c-piling-up:P-3104': ['Frustration', 'High'],
  'c-piling-up:P-3121': ['Frustration', 'Medium'],
}

/** What each code's words claim. Codes not listed state a fact or a preference. */
const STANCE: Record<string, Stance> = {
  'c-runout': 'Positive',
  'c-ingredients': 'Positive',
  'c-skip-pause': 'Positive',
  'c-idea-pause': 'Positive',
  'c-idea-portion': 'Positive',
  'c-idea-swap': 'Positive',
  'c-flex-first': 'Positive',
  'c-stable-price': 'Positive',
  'c-schedule-fine': 'Positive',
  'c-control': 'Positive',
  'c-vet-recipe': 'Positive',
  'c-loyalty': 'Positive',
  'c-price-warning': 'Positive',
  'c-price-rise': 'Negative',
  'c-piling-up': 'Negative',
  'c-bag-size': 'Negative',
  'c-pet-refused': 'Negative',
  'c-swap-hassle': 'Negative',
  'c-delivery': 'Negative',
  'c-too-often': 'Negative',
  'c-hard-cancel': 'Negative',
  'c-schedule-clash': 'Negative',
  'c-swap-unclear': 'Negative',
  'c-trust': 'Negative',
  'c-nothing': 'Negative',
}
export const stanceOf = (codeId: string): Stance => STANCE[codeId] ?? 'Neutral'
export const STANCE_LABEL: Record<Stance, string> = { Positive: 'Speaks for it', Negative: 'Complains about it', Neutral: 'States a fact or preference' }

/** A reading drawn from what the words claim and how steady the answer was, for quotes the story doesn't set by hand. */
function drawn(key: string, stance: Stance, band: Band): Set2 {
  const x = seeded(key, 50)
  const y = seeded(key, 51)
  const level = (): Intensity => (y < 0.45 ? 'Low' : y < 0.85 ? 'Medium' : 'High')
  let emotion: Emotion
  if (stance === 'Positive') emotion = band === 'Steady' ? (x < 0.35 ? 'Interest' : x < 0.55 ? 'Delight' : x < 0.9 ? 'Neutral' : 'Surprise') : x < 0.3 ? 'Doubt' : x < 0.45 ? 'Confusion' : x < 0.75 ? 'Neutral' : 'Interest'
  else if (stance === 'Negative') emotion = x < 0.4 ? 'Frustration' : x < 0.6 ? 'Doubt' : x < 0.92 ? 'Neutral' : 'Confusion'
  else emotion = x < 0.6 ? 'Neutral' : x < 0.8 ? 'Interest' : x < 0.9 ? 'Doubt' : 'Surprise'
  return [emotion, level()]
}

export function faceAtExcerpt(excerptId: string, participantId: string, codeId: string | undefined, band: Band): FaceReading | undefined {
  if (!hasVideo(participantId)) return undefined
  const key = `x:${excerptId}`
  const set = (codeId && QUOTE_FACES[`${codeId}:${participantId}`]) || drawn(key, codeId ? stanceOf(codeId) : 'Neutral', band)
  return reading(key, set[0], set[1])
}

export function faceAtMoment(momentId: string, participantId: string, band: Band): FaceReading | undefined {
  if (!hasVideo(participantId)) return undefined
  const key = `m:${momentId}:${participantId}`
  const set = CONCEPT_FACES[momentId]?.[participantId] ?? drawn(key, 'Neutral', band)
  return reading(key, set[0], set[1])
}
