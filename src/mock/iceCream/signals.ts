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

// Who hesitated at each flavour's first reaction: nobody. Each person's first reaction is set by hand in ./target.ts, and the reveal
// moment starts just after their face first moved, so the face is always read before they speak. Everyone saw every card.
addReactions({ 'm-concept-a': { marked: [], some: [] }, 'm-concept-b': { marked: [], some: [] }, 'm-concept-c': { marked: [], some: [] } })

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

/** What the system suggests. The numbers on each are worked out from the data when the screen opens. In the order of the design data's cards. */
export const ICE_TENSION_DEFS: TensionDef[] = [
  {
    id: 'tn-segments',
    kind: 'Between segments',
    title: 'Cookie is a parents’ flavour; caramel and mango are the adults’',
    summary: 'The same question, with different answers in each group. Not everyone in either group gave a clear answer. Directional: the groups are small.',
    themeName: 'Parents and cookie dough, adults and caramel or mango',
    codeIds: ['ic-pick-cookie', 'ic-pick-mango'],
    answers: ['Would buy Cookie Dough Crunch first', 'Would buy Mango Lassi first'],
  },
  {
    id: 'tn-cookie-locked',
    kind: 'Said vs survey',
    title: 'Said Cookie Dough Crunch first, but some then said they probably wouldn’t buy it',
    summary: 'In the interview these people picked cookie dough. In the locked survey right after, some chose a no.',
    themeName: 'Cookie dough: said first, then wouldn’t buy',
    codeIds: ['ic-pick-cookie'],
  },
  {
    id: 'tn-mango-did',
    kind: 'Said vs did',
    title: 'Said Mango Lassi first, but fewer took it home',
    summary: 'These people said they would buy Mango Lassi first. In the choice task, fewer chose it to take home.',
    themeName: 'Mango: said first, not taken home',
    codeIds: ['ic-pick-mango'],
  },
  {
    id: 'tn-caramel-mango-face',
    kind: 'Said vs emotion',
    title: 'Said Salted Caramel first, but their warmest first reaction was somewhere else',
    summary: 'Asked which flavour they would buy first, these people said Salted Caramel Swirl. On video, their warmest first reaction was not to caramel but to a different flavour. This sets a choice against a face at another concept.',
    themeName: 'Caramel in words, another flavour in the face',
    codeIds: ['ic-pick-caramel'],
    momentId: 'm-concept-b',
  },
  {
    id: 'tn-price-survey',
    kind: 'Said vs survey',
    title: 'Said a high price would stop them, but answered positively in the locked survey',
    summary: 'In conversation these people said a price over about six dollars would stop them. In the locked survey, most still said they would buy their favourite flavour.',
    themeName: 'Price limit or still a yes',
    codeIds: ['ic-price-limit'],
  },
]

registerSignalPack({ studyId: STUDY, concepts: CONCEPTS, tensions: ICE_TENSION_DEFS })
