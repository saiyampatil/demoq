// How delivery is read against the words (Results Analysis, A2 Signals). One rule, stated once, used by every screen.
// Delivery has two groups. Speech is tone plus certainty (hesitation), read for everyone. Face is expression, video only.
// Thresholds are mock values awaiting founder approval (docs/OPEN_QUESTIONS.md).

export const DELIVERY = {
  /** Fewer people with a claim than this and no verdict is read. */
  minPeople: 3,
  /** "Most": a verdict needs strictly more than this share of the people with a claim. */
  majority: 0.5,
  /** A face counts against the words only at this confidence or higher (the Medium band starts at 0.6). */
  faceMinConfidence: 0.6,
  /** Against a positive claim (they argued for it): these tones and expressions pull against the words. */
  positive: { tones: ['Tense', 'Flat'] as const, faces: ['Doubt', 'Frustration', 'Confusion'] as const },
  /** Against a complaint: sounding or looking pleased pulls against the words. Tense matches a complaint. */
  negative: { tones: ['Animated'] as const, faces: ['Delight', 'Interest'] as const },
  /** "Positive words, hesitant delivery": shown for a positive claim when at least this share of the people who argued for it hesitated. */
  hesitantInsight: { minShare: 0.5 },
}

/** The words on screen for each verdict: one map, used by every screen. The keys are the internal names and do not change. */
export const VERDICT_LABEL = {
  Consistent: 'Fits',
  Mixed: 'Partly fits',
  Conflicting: 'Doesn’t fit',
  'No claim': 'Facts only',
  'Too few to read': 'Too few to read',
} as const
export type VerdictKey = keyof typeof VERDICT_LABEL
export const verdictLabel = (v: VerdictKey) => VERDICT_LABEL[v]

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)
const lower = (xs: readonly string[]) => xs.map((x) => x.toLowerCase())

/** The rule in the five lines the "How it’s decided" popover shows. Built from the numbers above, so the text and the code cannot drift. */
export const DELIVERY_RULE_LINES: string[] = [
  'We look at people who argued for the idea and compare how they said it with what they said.',
  `It didn’t fit if the voice was ${list(lower(DELIVERY.positive.tones))}, or the face showed ${list(lower(DELIVERY.positive.faces))}. For a complaint, it didn’t fit if they sounded or looked pleased.`,
  `Most didn’t fit: “${VERDICT_LABEL.Conflicting}”. Most fit: “${VERDICT_LABEL.Consistent}”. Otherwise “${VERDICT_LABEL.Mixed}”. Under ${DELIVERY.minPeople} people: too few to read.`,
  'Long pauses alone never count as not fitting. They show as Uncertain.',
  'Each person counts once. Speech and face are never added together.',
]
