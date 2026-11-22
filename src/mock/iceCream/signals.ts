// Behavioural signals for Ice Cream Flavour Concept Test: the key moments of the interview, who hesitated at each flavour's first
// reaction, how often people hesitated on each code, and the tensions PulseAI would suggest. Everything is simulated and
// deterministic (see ../signals.ts for how a number is drawn). The story is in docs/ICE_CREAM_STORY.md.
// This file adds to the shared tables in ../signalKit and imports only types from ../signals.

import { addReactions, PLAN, registerSignalPack } from '../signalKit'
import type { Moment, TensionDef } from '../signals'

const STUDY = 'ice-cream-flavours'

const concept = (letter: 'A' | 'B' | 'C', name: string, fraction: number): Moment => ({
  id: `m-concept-${letter.toLowerCase()}`,
  label: `First reaction: Concept ${letter}, ${name}`,
  text: `Here is Concept ${letter}. Tell me your first reaction, before I say anything about it.`,
  kind: 'stimulus',
  fraction,
})

/** The first reaction to each flavour, shown between about 38% and 54% of the way through the interview. */
const CONCEPTS: Moment[] = [concept('A', 'Salted Caramel Swirl', 0.38), concept('B', 'Mango Lassi', 0.46), concept('C', 'Cookie Dough Crunch', 0.54)]

// Who hesitated at each flavour's first reaction. The rest were steady. P-4106 never saw Concept B (the card failed to load, which
// counts as not seen), so there is no reaction to measure.
//   A, the familiar one: only two people hesitated hard, and they are the ones who did not know what to make of a safe flavour.
//   B, the lassi: the most hesitation, from anyone who did not know what a lassi is, including three who then chose it.
//   C, cookie dough: steady for parents, a little hesitation from adults who worry about sweetness.
addReactions(
  {
    'm-concept-a': { marked: ['P-4116', 'P-4120'], some: ['P-4108', 'P-4113'] },
    'm-concept-b': { marked: ['P-4103', 'P-4113', 'P-4120', 'P-4111', 'P-4117', 'P-4105'], some: ['P-4108', 'P-4107', 'P-4114', 'P-4118', 'P-4101'] },
    'm-concept-c': { marked: ['P-4118'], some: ['P-4101', 'P-4115', 'P-4116'] },
  },
  { 'm-concept-b': ['P-4106'] },
)

// [marked, some] among the people who said each code. Codes not listed are all steady.
Object.assign(PLAN, {
  'ic-pick-mango': [3, 1],
  'ic-mango-different': [1, 1],
  'ic-lassi-unclear': [2, 1],
  'ic-explain-lassi': [1, 1],
  'ic-pick-caramel': [0, 2],
  'ic-caramel-safe': [0, 1],
  'ic-pick-cookie': [0, 1],
  'ic-sweet-worry': [1, 1],
  'ic-price-limit': [0, 1],
  'ic-stick-usual': [0, 2],
  'ic-kids-wont': [1, 1],
  'ic-try-new': [0, 1],
  'ic-pay-more-new': [0, 1],
  'ic-less-sweet': [0, 1],
  'ic-when-hot-day': [0, 1],
} satisfies Record<string, [number, number]>)

/** What the system suggests. The numbers on each are worked out from the data when the screen opens. */
export const ICE_TENSION_DEFS: TensionDef[] = [
  {
    id: 'tn-caramel-survey',
    kind: 'Said vs survey',
    title: 'Called Salted Caramel Swirl the one they would buy first, but some then said they probably wouldn’t buy it',
    summary: 'In the interview these people picked caramel. In the locked survey right after, some chose a no.',
    themeName: 'Caramel: said yes, answered no',
    codeIds: ['ic-pick-caramel'],
  },
  {
    id: 'tn-caramel-mango-face',
    kind: 'Said vs emotion',
    title: 'Picked caramel in words, but their faces lit up most at Mango Lassi',
    summary: 'Asked which flavour they would buy first, these people said Salted Caramel Swirl. On video, their warmest first reaction was not to caramel but to a different flavour, Mango Lassi. This sets a choice against a face at another concept.',
    themeName: 'Caramel in words, mango in the face',
    codeIds: ['ic-pick-caramel'],
    momentId: 'm-concept-b',
  },
  {
    id: 'tn-segments',
    kind: 'Between segments',
    title: 'Parents lean to Cookie Dough; adults without children lean to Mango Lassi',
    summary: 'The same question, with different answers in each group. Not everyone in either group gave a clear answer. Directional: the groups are small.',
    themeName: 'Parents and cookie dough, adults and mango',
    codeIds: ['ic-pick-cookie', 'ic-pick-mango'],
    answers: ['Would buy Cookie Dough Crunch first', 'Would buy Mango Lassi first'],
  },
  {
    id: 'tn-mango-concept',
    kind: 'Between concepts',
    title: 'Chose Mango Lassi in the end, but hesitated when first shown it',
    summary: 'These people chose mango in the end. When they were first shown Mango Lassi (Concept B), they hesitated. This sets a choice against how they sounded at the same concept.',
    themeName: 'Mango: a slow first reaction',
    codeIds: ['ic-pick-mango'],
    momentId: 'm-concept-b',
  },
  {
    id: 'tn-price-survey',
    kind: 'Said vs survey',
    title: 'Said a high price would stop them, but answered “probably would” in the survey',
    summary: 'In conversation these people said a price over about six dollars would stop them. In the locked survey, most still said they would buy their favourite flavour.',
    themeName: 'Price limit or still a yes',
    codeIds: ['ic-price-limit'],
  },
]

registerSignalPack({ studyId: STUDY, concepts: CONCEPTS, tensions: ICE_TENSION_DEFS })
