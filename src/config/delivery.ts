// How delivery is read against the words (Results Analysis, A2). One rule, stated once, used by every screen.
// Verdicts come from speech only: tone and certainty, each against the person's own baseline, read for everyone (audio-only included).
// Faces play no part in any verdict, row or count. They are stored and never used here.
// Thresholds are mock values awaiting founder approval (docs/OPEN_QUESTIONS.md).

export const DELIVERY = {
  /** Fewer people than this and no verdict is read. */
  minPeople: 3,
  /** "Most": a verdict needs strictly more than this share of the people with a position. Exactly half is never more than half. */
  majority: 0.5,
  /** For it: these tones do not match the words. Against it: these do not match. Hesitation never counts here. */
  positive: { tones: ['Tense', 'Flat'] as const },
  negative: { tones: ['Animated'] as const },
  /** "Positive words, hesitant delivery": shown for a positive claim when at least this share of the people who were for it hesitated. */
  hesitantInsight: { minShare: 0.5 },
  /** A clause in an insight sentence, or a "What stood out" label, needs at least this many people. Under it the clause is left out. */
  clauseMin: 3,
  /** Moments to watch: how many clips a theme and a code show at most, one per person. */
  moments: { theme: 5, code: 3 },
  /**
   * How a moment is scored, by distance from that person's own baseline and by whether it contradicts their words.
   * Each measure is capped, so one extreme number never decides alone.
   */
  momentScore: { delayCap: 4, pauseCap: 2, fillersCap: 2, toneWeight: 1, contradictBonus: 2, hesitantBonus: 1 },
}

/**
 * The final A2 vocabulary and colours, in one place. Every screen reads its words, definitions and colours from here, so none can drift.
 * The keys are the internal names and never change. The hex values are the only colours a verdict or a "did it match" chip may use, and
 * they are kept apart from the Face and Speech palettes (tokens.css), which are drawn as dots and bars, never as filled pills.
 */
/**
 * A chip is a restrained, translucent pill: a tint of its colour at 8 to 14 percent, a 1px muted border of the same colour, dark text and a small icon.
 * `accent` is the solid colour for a tile edge or an icon, and `fill` a solid pastel for a Theme map bubble. Contrast of `fg` on the tint is at least 4.5:1.
 */
export type Chip = { bg: string; fg: string; line: string; accent: string; fill: string; dotted?: boolean }

/** Row verdict: how delivery stood against the words for the people with a position. */
export const VERDICT_LABEL = {
  Consistent: 'Consistent',
  Mixed: 'Mixed',
  Conflicting: 'Gap',
  'No claim': 'No position',
  'Too few to read': 'Too few to read',
} as const
export type VerdictKey = keyof typeof VERDICT_LABEL
export const verdictLabel = (v: VerdictKey) => VERDICT_LABEL[v]
export const VERDICT_ORDER: VerdictKey[] = ['Consistent', 'Mixed', 'Conflicting', 'No claim', 'Too few to read']
export const VERDICT_DEF: Record<VerdictKey, string> = {
  Consistent: 'More than half of the people with a position matched.',
  Mixed: 'Neither side has more than half, including when many were hesitant.',
  Conflicting: 'More than half had no match.',
  'No claim': 'Nobody took a side.',
  'Too few to read': 'Under 3 people, too few to read a pattern.',
}
export const VERDICT_COLOUR: Record<VerdictKey, Chip> = {
  /** Sage green. */
  Consistent: { bg: 'rgba(46, 125, 79, 0.12)', fg: '#1f5a37', line: 'rgba(46, 125, 79, 0.38)', accent: '#2e7d4f', fill: '#b7d9c4' },
  /** Pale champagne amber. */
  Mixed: { bg: 'rgba(217, 162, 27, 0.14)', fg: '#6b4a00', line: 'rgba(184, 134, 11, 0.42)', accent: '#b8860b', fill: '#f3dea0' },
  /** Muted red. */
  Conflicting: { bg: 'rgba(196, 22, 42, 0.10)', fg: '#8f1220', line: 'rgba(196, 22, 42, 0.36)', accent: '#c4162a', fill: '#efb0b8' },
  /** Frosted neutral grey. */
  'No claim': { bg: 'rgba(107, 112, 128, 0.10)', fg: '#3f4250', line: 'rgba(107, 112, 128, 0.32)', accent: '#6b7080', fill: '#d6d8de' },
  /** Transparent, dotted outline. */
  'Too few to read': { bg: 'transparent', fg: '#4a4d5c', line: '#7b7f90', accent: '#7b7f90', fill: '#ffffff', dotted: true },
}

/** Did one person's delivery match their words. Always in this order: Matched, No match, Hesitant. */
export type FitKey = 'Matches' | 'Pulls against' | 'Uncertain'
export const FIT_ORDER: FitKey[] = ['Matches', 'Pulls against', 'Uncertain']
export const FIT_LABEL: Record<FitKey, string> = { Matches: 'Matched', 'Pulls against': 'No match', Uncertain: 'Hesitant' }
export const FIT_DEF: Record<FitKey, string> = {
  Matches: 'Nothing in how they sounded contradicted the words.',
  'Pulls against': 'How they sounded contradicted the words.',
  Uncertain: 'Nothing contradicted the words, but they hesitated a lot. Never counts toward Gap.',
}
export const FIT_COLOUR: Record<FitKey, Chip> = {
  Matches: VERDICT_COLOUR.Consistent,
  'Pulls against': VERDICT_COLOUR.Conflicting,
  /** Indigo. */
  Uncertain: { bg: 'rgba(91, 69, 217, 0.10)', fg: '#3e2ca8', line: 'rgba(91, 69, 217, 0.36)', accent: '#5b45d9', fill: '#cfc8f3' },
}

/** What people said, in plain people-language. No colour. The keys are the internal stance names. */
export type Side = 'Positive' | 'Negative' | 'Neutral'
/** One person, or a code row: "Spoke in favour". */
export const SIDE_LABEL: Record<Side, string> = { Positive: 'Spoke in favour', Negative: 'Spoke against it', Neutral: 'Just described it' }
export const SIDE_DEF: Record<Side, string> = {
  Positive: 'They spoke in favour of it.',
  Negative: 'They spoke against it.',
  Neutral: 'They just described what happened. Nothing for delivery to match, so these people are not checked.',
}
/** A group of people: "8 people spoke in favour", "1 person spoke against it". */
export const sideGroupLine = (side: 'Positive' | 'Negative', n: number) => `${n} ${n === 1 ? 'person' : 'people'} ${side === 'Positive' ? 'spoke in favour' : 'spoke against it'}`
/** The heading of one of two stacked tile groups: "Spoke in favour · 8". */
export const sideGroupHead = (side: 'Positive' | 'Negative', n: number) => `${SIDE_LABEL[side]} · ${n}`
/** The quiet grey line for people who just described it. */
export const describedLine = (n: number) => `${n} just described what happened, not checked`
export const RAISED_TIP = { theme: 'People who raised this theme', code: 'People who raised this code' }

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)
const lower = (xs: readonly string[]) => xs.map((x) => x.toLowerCase())

/** The rule in the five lines the "How it’s decided" popover shows. Built from the numbers above, so the text and the code cannot drift. */
export const DELIVERY_RULE_LINES: string[] = [
  'We look at people who spoke in favour or against it and compare how they sounded with what they said. Faces play no part.',
  `No match if they spoke in favour and sounded ${list(lower(DELIVERY.positive.tones))}, or spoke against it and sounded ${list(lower(DELIVERY.negative.tones))}.`,
  `More than half matched: ${VERDICT_LABEL.Consistent}. More than half had no match: ${VERDICT_LABEL.Conflicting}. Otherwise ${VERDICT_LABEL.Mixed}. Under ${DELIVERY.minPeople} people: ${VERDICT_LABEL['Too few to read']}.`,
  `Hesitating a lot, with nothing else off, shows as ${FIT_LABEL.Uncertain} and never counts toward ${VERDICT_LABEL.Conflicting}.`,
  'Each person counts once. With several codes in a theme, their positions are counted together.',
]
