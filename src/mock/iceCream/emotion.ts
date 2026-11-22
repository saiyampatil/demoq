// Emotion readings for Ice Cream Flavour Concept Test, written by hand so the study tells one story (docs/ICE_CREAM_STORY.md):
//   Concept A, Salted Caramel Swirl: liked quietly. It is the familiar flavour, so few faces change.
//   Concept B, Mango Lassi: splits the room. Delight from some adults, doubt or confusion from parents and from anyone who did not know what a lassi is.
//   Concept C, Cookie Dough Crunch: lights up the parents.
// Four people used the audio-only access mode (P-4107, P-4110, P-4113, P-4120): they have a voice reading but never a face one.
// P-4106 never saw Concept B (the card failed), so has no reading there. Everything here joins the shared tables in ../emotionKit.

import { addConceptFaces, QUOTE_FACES, STANCE, VOICE_OVERRIDES, type Set2 } from '../emotionKit'
import type { Stance, Tone } from '../emotion'

addConceptFaces({
  'm-concept-a': {
    'P-4101': ['Interest', 'Low'],
    'P-4102': ['Neutral', 'Low'],
    'P-4103': ['Neutral', 'Low'],
    'P-4104': ['Interest', 'Medium'],
    'P-4105': ['Neutral', 'Low'],
    'P-4106': ['Interest', 'Medium'],
    'P-4108': ['Neutral', 'Low'],
    'P-4109': ['Delight', 'Medium'],
    'P-4111': ['Delight', 'Medium'],
    'P-4114': ['Interest', 'Low'],
    'P-4115': ['Delight', 'Medium'],
    'P-4116': ['Neutral', 'Low'],
    'P-4117': ['Neutral', 'Low'],
    'P-4118': ['Interest', 'Low'],
    'P-4121': ['Delight', 'Medium'],
    'P-4122': ['Neutral', 'Low'],
  },
  'm-concept-b': {
    'P-4101': ['Delight', 'Medium'],
    'P-4102': ['Doubt', 'Medium'],
    'P-4103': ['Delight', 'High'],
    'P-4104': ['Doubt', 'High'],
    'P-4105': ['Doubt', 'Medium'],
    'P-4108': ['Interest', 'Medium'],
    'P-4109': ['Doubt', 'Low'],
    'P-4111': ['Interest', 'Medium'],
    'P-4114': ['Doubt', 'Medium'],
    'P-4115': ['Delight', 'Low'],
    'P-4116': ['Confusion', 'Medium'],
    'P-4117': ['Confusion', 'Medium'],
    'P-4118': ['Neutral', 'Low'],
    'P-4121': ['Doubt', 'Low'],
    'P-4122': ['Interest', 'Low'],
  },
  'm-concept-c': {
    'P-4101': ['Neutral', 'Low'],
    'P-4102': ['Delight', 'High'],
    'P-4103': ['Doubt', 'Low'],
    'P-4104': ['Delight', 'High'],
    'P-4105': ['Delight', 'Medium'],
    'P-4106': ['Neutral', 'Low'],
    'P-4108': ['Neutral', 'Low'],
    'P-4109': ['Delight', 'High'],
    'P-4111': ['Neutral', 'Low'],
    'P-4114': ['Delight', 'High'],
    'P-4115': ['Doubt', 'Low'],
    'P-4116': ['Doubt', 'Medium'],
    'P-4117': ['Delight', 'Medium'],
    'P-4118': ['Doubt', 'Medium'],
    'P-4121': ['Interest', 'Low'],
    'P-4122': ['Delight', 'Medium'],
  },
})

/** Hand-set readings at coded quotes, by "codeId:participantId", where the story needs them. The rest are drawn from what the words claim. */
Object.assign(QUOTE_FACES, {
  // Picked caramel in words. Most looked fine saying it; two looked unsure, and they are the two who then said they probably wouldn't buy it.
  'ic-pick-caramel:P-4101': ['Interest', 'Low'],
  'ic-pick-caramel:P-4106': ['Neutral', 'Low'],
  'ic-pick-caramel:P-4111': ['Doubt', 'Low'],
  'ic-pick-caramel:P-4115': ['Interest', 'Medium'],
  'ic-pick-caramel:P-4118': ['Doubt', 'Medium'],
  'ic-pick-caramel:P-4121': ['Neutral', 'Low'],
  // Picked mango with delight in the words, but not always on the face: the story of a flavour people want and are unsure about.
  'ic-pick-mango:P-4103': ['Delight', 'Medium'],
  'ic-pick-mango:P-4108': ['Interest', 'Medium'],
  'ic-pick-mango:P-4116': ['Doubt', 'Low'],
  // Picked cookie dough: parents light up.
  'ic-pick-cookie:P-4102': ['Delight', 'High'],
  'ic-pick-cookie:P-4104': ['Delight', 'High'],
  'ic-pick-cookie:P-4105': ['Delight', 'Medium'],
  'ic-pick-cookie:P-4109': ['Delight', 'Medium'],
  'ic-pick-cookie:P-4114': ['Delight', 'High'],
  'ic-pick-cookie:P-4117': ['Interest', 'Medium'],
  'ic-pick-cookie:P-4122': ['Interest', 'Low'],
  // Said they did not know what a lassi is: confusion, which is not a no.
  'ic-lassi-unclear:P-4103': ['Confusion', 'Medium'],
  'ic-lassi-unclear:P-4111': ['Confusion', 'Low'],
  'ic-lassi-unclear:P-4116': ['Confusion', 'Medium'],
  'ic-lassi-unclear:P-4117': ['Confusion', 'Medium'],
  'ic-lassi-unclear:P-4118': ['Confusion', 'Low'],
  // Parents ruling out mango for the children, and the worries about sweetness and price: complaints said with a frown are consistent.
  'ic-kids-wont:P-4105': ['Doubt', 'Low'],
  'ic-kids-wont:P-4109': ['Neutral', 'Low'],
  'ic-kids-wont:P-4111': ['Doubt', 'Medium'],
  'ic-kids-wont:P-4117': ['Doubt', 'Medium'],
  'ic-sweet-worry:P-4101': ['Doubt', 'Low'],
  'ic-sweet-worry:P-4103': ['Neutral', 'Low'],
  'ic-sweet-worry:P-4115': ['Doubt', 'Medium'],
  'ic-sweet-worry:P-4118': ['Doubt', 'Medium'],
  'ic-price-limit:P-4101': ['Neutral', 'Low'],
  'ic-price-limit:P-4115': ['Doubt', 'Medium'],
  'ic-price-limit:P-4118': ['Frustration', 'Low'],
} satisfies Record<string, Set2>)

/** What each code's words claim. Codes not listed state a fact or a preference. */
Object.assign(STANCE, {
  'ic-pick-caramel': 'Positive',
  'ic-pick-mango': 'Positive',
  'ic-pick-cookie': 'Positive',
  'ic-caramel-safe': 'Positive',
  'ic-mango-different': 'Positive',
  'ic-cookie-family': 'Positive',
  'ic-try-new': 'Positive',
  'ic-weekly-tub': 'Positive',
  'ic-pay-more-new': 'Positive',
  'ic-nothing-stop': 'Positive',
  'ic-when-weekend': 'Positive',
  'ic-when-hot-day': 'Positive',
  'ic-when-after-dinner': 'Positive',
  'ic-when-guests': 'Positive',
  'ic-kids-wont': 'Negative',
  'ic-sweet-worry': 'Negative',
  'ic-price-limit': 'Negative',
  'ic-pay-wait-sale': 'Negative',
  'ic-lassi-unclear': 'Negative',
  'ic-pay-under-five': 'Negative',
  'ic-less-sweet': 'Negative',
} satisfies Record<string, Stance>)

/** Hand-set tones at coded quotes. Mango choosers say yes in words and sound unsure; cookie dough parents sound lively. */
Object.assign(VOICE_OVERRIDES, {
  'ic-pick-mango:P-4103': 'Tense',
  'ic-pick-mango:P-4113': 'Flat',
  'ic-pick-mango:P-4116': 'Flat',
  'ic-pick-caramel:P-4118': 'Flat',
  'ic-pick-cookie:P-4104': 'Animated',
  'ic-pick-cookie:P-4114': 'Animated',
  'ic-pick-cookie:P-4102': 'Animated',
} satisfies Record<string, Tone>)
