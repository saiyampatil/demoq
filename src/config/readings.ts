// A2's output: one reading per theme, from the theme's own counts (who argued for it or complained, and how their delivery stood).
// Thresholds are mock values awaiting founder approval (docs/OPEN_QUESTIONS.md).

export const READINGS = {
  /** Fewer people with a claim than this and the theme is "Too few to read". */
  minClaim: 3,
  /** "More than half": strictly more than this share of the people with a claim. */
  majority: 0.5,
  /** A code needs this many readable people to count for "Split inside the theme". */
  splitMinPeople: 3,
  /** The hesitation line shows when the uncertain are at least this share of the people with a claim. */
  hesitationShare: 1 / 3,
  /** At most this many codes are named in the gap line. */
  gapCodes: 2,
  /** The validator's limits for a statement line: longer than a spoken line, up to three "n of N" figures. */
  maxWords: 40,
  figuresAllowed: 3,
}

export const READING_LABELS = ['Stated, not argued', 'Too few to read', 'Split inside the theme', 'Said and meant', 'Said, not backed', 'Partly backed', 'Said, but unsure'] as const
export type ReadingLabel = (typeof READING_LABELS)[number]
