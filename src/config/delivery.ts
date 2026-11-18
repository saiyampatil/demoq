// How delivery is read against the words (Results Analysis, A2 Signals). One rule, stated once, used by every screen.
// Delivery has two groups. Speech is tone plus certainty (hesitation), read for everyone. Face is expression, video only.
// Thresholds are mock values awaiting founder approval (docs/OPEN_QUESTIONS.md).

export const DELIVERY = {
  /** Fewer people with a claim than this and no verdict is read. */
  minPeople: 3,
  /** "Over half": a verdict needs strictly more than this share of the people with a claim. */
  majority: 0.5,
  /** A face counts against the words only at this confidence or higher (the Medium band starts at 0.6). */
  faceMinConfidence: 0.6,
  /** Speech pulls against the words in these tones, whatever the claim. */
  toneAgainst: ['Tense'] as const,
  /** And in these tones when the person spoke for the thing. */
  toneAgainstPositive: ['Flat'] as const,
}

/** The rule in the words shown under the table. Built from the numbers above, so the text and the code cannot drift. */
export const DELIVERY_RULE = {
  verdict: `Conflicting: more than ${Math.round(DELIVERY.majority * 100) / 100 === 0.5 ? 'half' : `${DELIVERY.majority * 100}%`} of the people with a claim have delivery that pulls against their words. Consistent: more than half match. Otherwise Mixed. Under ${DELIVERY.minPeople} people: too few to read.`,
  speech: `Speech pulls against the words if the tone is ${DELIVERY.toneAgainst.map((t) => t.toLowerCase()).join(' or ')}, or ${DELIVERY.toneAgainstPositive.map((t) => t.toLowerCase()).join(' or ')} against a positive claim. Hesitation is not used here.`,
  face: 'Face pulls against the words if the expression opposes the claim at medium confidence or higher.',
  once: 'A person counts once: speech and face never add together.',
  uncertain: 'Uncertain: neither pulls against, but certainty is marked hesitation. Counted and shown, never counted toward Conflicting.',
}
