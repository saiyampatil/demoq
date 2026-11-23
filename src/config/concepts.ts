// How a concept is read (A2, Concepts tab). Said, Did and Showed, each with its own base, and when they Differ.
// Thresholds are mock values awaiting founder approval (docs/OPEN_QUESTIONS.md). Nothing here is typed anywhere else.

export const CONCEPTS = {
  /** A face is read only in this many seconds after a concept is revealed, and only before the person speaks. */
  windowSec: 5,
  /** Showed: only these first reactions count as warm, Delight above Interest. */
  warmLabels: ['Delight', 'Interest'] as const,
  /** Showed: a reading counts at medium confidence or higher (the Medium band starts at 0.6). */
  minConfidence: 0.6,
  /** Showed is greyed when fewer people than this are on video (and have consented to a face reading). */
  showedMinVideo: 5,
  /**
   * A concept "Differs" when its rank across the measures it has moves by at least `rankGap` places (capped at the number of concepts
   * minus one), and its shares (n of N) across those measures are at least `minSpread` apart. Ranks are by share, so bases may differ.
   */
  differs: { rankGap: 2, minSpread: 0.2 },
  /** In a concept's line, two shares closer than this are said to agree (“and”), not to differ (“but only”). */
  similar: 0.1,
  /** At least this many measures are needed to say a concept agrees or differs. */
  minMeasures: 2,
  /** Showing the clips: how many first reactions a concept lists at most. */
  clips: 5,
  /** The words that make an answer hedged (text signals, transcripts only). Never a verdict input. */
  hedging: ['maybe', 'i guess', 'sort of', 'kind of', 'probably', 'i think', 'not sure', 'perhaps', 'i suppose', 'a bit', 'somewhat', 'might'] as const,
}

export type WarmLabel = (typeof CONCEPTS.warmLabels)[number]
