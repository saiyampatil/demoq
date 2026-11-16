// Audio summary settings (A3). Nothing here is hardcoded in the page or the logic: change a number here.

export const AUDIO = {
  /** Speaking speed, and the pause after each line. A line's length is its spoken words over this, plus the pause. */
  wordsPerMinute: 150,
  pauseSec: 0.6,
  /** Target lengths in minutes, and the range the brief allows. Outside the range is a warning, never a block. */
  targets: [8, 10, 12] as const,
  defaultTarget: 10,
  range: { min: 8, max: 12 },
  /** The most theme chapters in an episode, and quotes for each: one, or two for the largest when time allows. */
  maxThemes: 6,
  quotesPerTheme: 1,
  quotesForLargest: 2,
  largestCount: 2,
  /** A narration line is one claim, this long at most. */
  maxLineWords: 28,
  /** Mock voices. Changing one marks the lines it reads "Needs audio". */
  narratorVoices: ['Clear, professional', 'Warm', 'Smytten brand voice'] as const,
  quoteVoices: ['Second voice, neutral', 'Second voice, warm'] as const,
  speeds: [0.75, 1, 1.25, 1.5] as const,
  /** Words a narration line must never use: they claim more than a count can. */
  bannedWords: ['significant', 'significantly', 'proved', 'proves', 'clearly', 'obviously'],
  /** Words that read as advice: the AI states findings only. */
  adviceWords: ['should', 'recommend', 'must', 'need to', 'we suggest', 'ought'],
} as const

export type NarratorVoice = (typeof AUDIO.narratorVoices)[number]
export type QuoteVoice = (typeof AUDIO.quoteVoices)[number]
