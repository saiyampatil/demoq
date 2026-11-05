// The codebook PulseAI drafted for Pet Food Subscription Churn, and what Maya Ortiz had already done with it.
// Every quote is written into that participant's transcript at the turn it cites, so a quote and its session never disagree.

import { findReviewRecord, placeTranscriptLines } from './review'
import './petFood'

export const CODEBOOK_STUDY = 'pet-food-churn'
const maya = 'Maya Ortiz'
export const AI_CODER = 'PulseAI'
export const CODED_AT = '2026-09-24T10:00:00-04:00'

/** A guide question the codes are grouped under. `skipped` lists who was never asked it, so N is honest per question. */
export type CodeQuestion = { id: string; label: string; text: string; section: string; fraction: number; skipped: { participantId: string; why: string }[] }

export const CODE_QUESTIONS: CodeQuestion[] = [
  { id: 'q-start', label: 'Starting the subscription', text: 'How did you come to start the subscription, and what did you expect from it?', section: 'How they feed and shop', fraction: 0.16, skipped: [] },
  { id: 'q-cancel', label: 'Why they cancelled', text: 'Take me back to when you cancelled. What happened, step by step?', section: 'Subscribing and cancelling', fraction: 0.3, skipped: [] },
  { id: 'q-keep', label: 'What could have kept them', text: 'What, if anything, could the company have done to keep you?', section: 'Subscribing and cancelling', fraction: 0.4, skipped: [] },
  {
    id: 'q-schedule',
    label: 'The delivery schedule',
    text: 'How did you feel about committing to a delivery schedule?',
    section: 'Subscribing and cancelling',
    fraction: 0.46,
    // An optional question: the agent dropped it when time ran short.
    skipped: ['P-3102', 'P-3108', 'P-3111', 'P-3113', 'P-3116', 'P-3121'].map((participantId) => ({ participantId, why: 'Optional question, not asked' })),
  },
  { id: 'q-ideas', label: 'Which retention idea would keep them', text: 'Which of these would have been most likely to keep you, and why?', section: 'Retention ideas', fraction: 0.66, skipped: [] },
  { id: 'q-flex', label: 'Flexibility or price', text: 'Some of these are about flexibility, not price. Does flexibility matter more or less than a lower price to you, and why?', section: 'Retention ideas', fraction: 0.76, skipped: [] },
  { id: 'q-back', label: 'What would bring them back', text: 'Looking back, what is the single biggest thing that would bring you back?', section: 'Reflection', fraction: 0.84, skipped: [{ participantId: 'P-3116', why: 'Never asked (flagged in Review)' }] },
]

/** The pet each person described in their intro answer. Used for the directional split on a code. */
export type Pet = 'Dog' | 'Cat'
const CATS = new Set(['P-3102', 'P-3105', 'P-3108', 'P-3110', 'P-3113', 'P-3116', 'P-3118', 'P-3121'])
export const petOf = (participantId: string): Pet => (CATS.has(participantId) ? 'Cat' : 'Dog')

export type Excerpt = {
  id: string
  sessionId: string
  participantId: string
  questionId: string
  text: string
  turnIndex: number
  atSec: number
  confidence: number
  /** The quote comes from a corrected line in the reviewed transcript. */
  corrected?: boolean
}

export type CodeStatus = 'Suggested' | 'Accepted' | 'Rejected' | 'Merged'

export type SeedCode = {
  id: string
  name: string
  definition: string
  /** The guide question it answers, or where a new code came up. */
  questionId: string
  isNew: boolean
  status: CodeStatus
  confidence: number
  excerpts: string[]
  /** Matching excerpts elsewhere, surfaced after the code changes (founder brief, step 3). */
  more: string[]
  decided?: { by: string; at: string; why?: string }
  mergedInto?: string
}

// ─── quotes ─────────────────────────────────────────────────────────────────
// [participant, quote, confidence?]. A missing confidence means the code's own.
type Q = [string, string, number?]

const sessionOf = (p: string) => (p === 'P-3104' ? 'P-3104-2' : `${p}-1`)

type Draft = Omit<SeedCode, 'excerpts' | 'more'> & { quotes: Q[]; extra?: Q[] }

const DRAFTS: Draft[] = [
  // Starting the subscription
  {
    id: 'c-runout',
    name: 'Wanted to stop running out',
    definition: 'Signed up so the food would arrive before the bag ran empty, without a store run.',
    questionId: 'q-start',
    isNew: false,
    status: 'Accepted',
    confidence: 0.88,
    decided: { by: maya, at: '2026-09-24T14:05:00-04:00' },
    quotes: [
      ['P-3101', 'We kept running out on a Sunday night, so having it just show up felt like a fix.'],
      ['P-3105', 'I signed up because I was tired of the late-night store run when the bag was empty.'],
      ['P-3109', 'The whole point was never running out. That’s what sold me.'],
      ['P-3114', 'Honestly, I just didn’t want to think about it anymore. It shows up, done.'],
      ['P-3120', 'We ran out twice in one month, and my husband said just get the subscription.'],
    ],
  },
  {
    id: 'c-ingredients',
    name: 'Hoped for better ingredients',
    definition: 'Expected fresher or healthier food than the store brands they had used.',
    questionId: 'q-start',
    isNew: false,
    status: 'Accepted',
    confidence: 0.82,
    decided: { by: maya, at: '2026-09-24T14:06:00-04:00' },
    quotes: [
      ['P-3103', 'I wanted something with real meat in it, not the filler stuff from the supermarket.'],
      ['P-3107', 'The vet said his coat looked dull, so I went looking for better food.'],
      ['P-3115', 'The ingredients list was short and I could read every word. That mattered.'],
      ['P-3122', 'I thought she deserved better than the cheapest bag.'],
    ],
  },
  {
    id: 'c-intro-discount',
    name: 'Joined for an intro discount',
    definition: 'Signed up because of a discounted or free first box.',
    questionId: 'q-start',
    isNew: false,
    status: 'Suggested',
    confidence: 0.71,
    quotes: [
      ['P-3102', 'There was fifty percent off the first box, so I thought why not.'],
      ['P-3108', 'Mostly the discount. I saw an ad with the first month half off.'],
      ['P-3117', 'A friend sent me a code for a free first box.'],
    ],
    extra: [['P-3121', 'I think it was a promo, something like sixty percent off the first one.', 0.74]],
  },

  // Why they cancelled
  {
    id: 'c-price-rise',
    name: 'Price went up',
    definition: 'Cancelled after one or more price rises made the box feel poor value.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Accepted',
    confidence: 0.93,
    decided: { by: maya, at: '2026-09-24T14:10:00-04:00' },
    quotes: [
      ['P-3101', 'The price went up twice in six months, and that was when I started looking around.'],
      ['P-3103', 'It crept up a few dollars each time and I stopped feeling it was worth it.'],
      ['P-3106', 'When they sent the email about the new price, I cancelled the same day.'],
      ['P-3110', 'It went from forty-something to almost sixty a box. That’s a lot for cat food.'],
      ['P-3114', 'Second price rise in March, and I was done.'],
      ['P-3117', 'I didn’t mind paying more at first, but the March increase was too much.'],
      ['P-3120', 'The price kept climbing and the food stayed the same.'],
    ],
  },
  {
    id: 'c-piling-up',
    name: 'Food piling up',
    definition: 'Deliveries arrived faster than the pet ate, so unopened food built up at home.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Suggested',
    confidence: 0.86,
    quotes: [
      ['P-3104', 'The bags just kept piling up in the garage, we couldn’t get through them.'],
      ['P-3109', 'Honestly, the boxes started piling up when we were away.'],
      ['P-3113', 'I had three bags in the closet and another one on the way.'],
      ['P-3118', 'She eats less than they thought, so we always had extra.'],
      ['P-3121', 'We were drowning in food. I gave two bags to my neighbour.'],
      ['P-3105', 'I kept pushing the date back, but it still came too often.'],
      ['P-3122', 'There was always one more box than we needed.', 0.69],
    ],
    extra: [['P-3114', 'By the end there was a stack of boxes by the back door.', 0.81]],
  },
  {
    id: 'c-bag-size',
    name: 'Bag size too big',
    definition: 'The bag or portion size was too large for a small pet.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Suggested',
    confidence: 0.64,
    quotes: [
      ['P-3113', 'The bags are sized for a big dog. I have one small cat.'],
      ['P-3118', 'Even the smallest bag lasted her two months.'],
      ['P-3105', 'A smaller bag would have fixed half my problem.'],
      ['P-3102', 'They only do the one size, and it’s way too much for him.', 0.58],
    ],
  },
  {
    id: 'c-pet-refused',
    name: 'Pet stopped eating it',
    definition: 'The pet got bored of the recipe or refused it.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Accepted',
    confidence: 0.89,
    decided: { by: maya, at: '2026-09-24T14:14:00-04:00' },
    quotes: [
      ['P-3101', 'Biscuit got bored of the chicken after a few weeks.'],
      ['P-3108', 'She just walked away from the bowl. Every time.'],
      ['P-3111', 'He ate it fine for a month and then flat out refused.'],
      ['P-3116', 'Cats are picky. She sniffed it and left.'],
      ['P-3110', 'My cat stopped finishing her bowl after the first month.'],
      ['P-3103', 'He started leaving half of it, which he never does.'],
    ],
  },
  {
    id: 'c-swap-hassle',
    name: 'Hard to change the recipe',
    definition: 'Switching to a different recipe was slow or hard to find.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Suggested',
    confidence: 0.77,
    quotes: [
      ['P-3101', 'The swap was a hassle. I had to email them and wait.'],
      ['P-3111', 'I couldn’t find where to change the flavour in the app.'],
      ['P-3108', 'By the time the new recipe came, she was off it already.'],
    ],
    extra: [['P-3116', 'I wanted to try the salmon, but it was a whole process.', 0.72]],
  },
  {
    id: 'c-vet-diet',
    name: 'Vet recommended a different diet',
    definition: 'A vet moved the pet to a diet the subscription didn’t offer.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Accepted',
    confidence: 0.91,
    decided: { by: maya, at: '2026-09-24T14:16:00-04:00' },
    quotes: [
      ['P-3115', 'My vet suggested a different diet, so that settled it.'],
      ['P-3107', 'The vet put him on a kidney diet, and they don’t make one.'],
      ['P-3117', 'Our vet wanted her on a prescription food.'],
    ],
  },
  {
    id: 'c-delivery',
    name: 'Delivery problems',
    definition: 'Boxes arrived late, damaged or not at all.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Rejected',
    confidence: 0.52,
    decided: { by: maya, at: '2026-09-24T14:20:00-04:00', why: 'Only one person had a late box. The other quote is about the schedule, not delivery.' },
    quotes: [
      ['P-3120', 'One box came two days late and we nearly ran out.', 0.66],
      ['P-3104', 'It always came on a Tuesday, which was fine, but we were never home.', 0.38],
    ],
  },
  {
    id: 'c-too-often',
    name: 'Boxes came too often',
    definition: 'Deliveries were more frequent than needed.',
    questionId: 'q-cancel',
    isNew: false,
    status: 'Merged',
    confidence: 0.7,
    mergedInto: 'c-piling-up',
    decided: { by: maya, at: '2026-09-24T14:24:00-04:00', why: 'Same thing as food piling up, said a different way.' },
    quotes: [],
  },
  {
    id: 'c-hard-cancel',
    name: 'Cancelling took several steps',
    definition: 'Stopping the subscription needed a call, a chat or several screens.',
    questionId: 'q-cancel',
    isNew: true,
    status: 'Suggested',
    confidence: 0.74,
    quotes: [
      ['P-3103', 'To cancel I had to call. Call! In this day and age.'],
      ['P-3110', 'They kept showing me offers before letting me cancel.'],
      ['P-3114', 'It took three screens and a survey to cancel.'],
      ['P-3122', 'I had to chat with someone just to stop it.'],
    ],
  },
  {
    id: 'c-gift-ended',
    name: 'Gift subscription ended',
    definition: 'Someone else paid for the first months, and they didn’t renew when it ran out.',
    questionId: 'q-cancel',
    isNew: true,
    status: 'Suggested',
    confidence: 0.68,
    quotes: [
      ['P-3106', 'It was a gift from my sister for three months, and when it ran out I didn’t renew.'],
      ['P-3121', 'My daughter set it up as a gift. When the gift ended, so did we.'],
    ],
  },

  // What could have kept them
  {
    id: 'c-skip-pause',
    name: 'Easy skip or pause',
    definition: 'Being able to skip or pause a delivery without contacting support.',
    questionId: 'q-keep',
    isNew: false,
    status: 'Accepted',
    confidence: 0.9,
    decided: { by: maya, at: '2026-09-24T14:30:00-04:00' },
    quotes: [
      ['P-3101', 'I’d have stayed if I could have skipped a box without a fight.'],
      ['P-3104', 'Just a pause button. That’s all I needed.'],
      ['P-3109', 'If I could skip when we travel, I’d still be a customer.'],
      ['P-3113', 'Let me skip a month from the app, no phone call.'],
      ['P-3118', 'A pause for when we had too much would have kept me.'],
      ['P-3105', 'Pause, not cancel. Give me that option.'],
      ['P-3114', 'Something simple, like skip next delivery.'],
    ],
    extra: [['P-3122', 'A skip button would have done it, honestly.', 0.83]],
  },
  {
    id: 'c-price-warning',
    name: 'Warn before a price rise',
    definition: 'Tell customers ahead of an increase, and say why.',
    questionId: 'q-keep',
    isNew: false,
    status: 'Suggested',
    confidence: 0.73,
    quotes: [
      ['P-3106', 'Give me a heads-up and a reason. I found out from my bank statement.'],
      ['P-3117', 'Just tell me before you charge me more.'],
      ['P-3110', 'If they’d explained why it went up, I might have stayed.'],
    ],
  },
  {
    id: 'c-nothing',
    name: 'Nothing would have kept them',
    definition: 'The reason to leave was outside the company’s control.',
    questionId: 'q-keep',
    isNew: false,
    status: 'Accepted',
    confidence: 0.84,
    decided: { by: maya, at: '2026-09-24T14:33:00-04:00' },
    quotes: [
      ['P-3115', 'Honestly, no. Once the vet said switch, that was it.'],
      ['P-3107', 'Nothing. He needs food they don’t make.'],
    ],
  },
  {
    id: 'c-loyalty',
    name: 'A loyalty price',
    definition: 'A lower price for staying a long time.',
    questionId: 'q-keep',
    isNew: false,
    status: 'Suggested',
    confidence: 0.58,
    quotes: [
      ['P-3120', 'Some reward for being there a year would’ve been nice.', 0.67],
      ['P-3103', 'Maybe a loyal-customer price. Not a coupon, a real price.', 0.62],
      ['P-3111', 'If they’d matched what I pay at the store.', 0.45],
    ],
  },

  // The delivery schedule
  {
    id: 'c-schedule-clash',
    name: 'Schedule didn’t fit real life',
    definition: 'A fixed schedule clashed with travel or with a pet’s changing appetite.',
    questionId: 'q-schedule',
    isNew: false,
    status: 'Accepted',
    confidence: 0.8,
    decided: { by: maya, at: '2026-09-24T14:40:00-04:00' },
    quotes: [
      ['P-3104', 'We travel a lot. A fixed date just doesn’t work for us.'],
      ['P-3109', 'Every four weeks sounds simple until you go on holiday.'],
      ['P-3120', 'Her appetite changes in summer. The schedule doesn’t.'],
      ['P-3114', 'I never knew if the next box was coming this week or next.', 0.63],
    ],
    extra: [['P-3117', 'Some months we need more, some months less.', 0.76]],
  },
  {
    id: 'c-schedule-fine',
    name: 'Fine with the schedule',
    definition: 'The schedule itself was not a problem.',
    questionId: 'q-schedule',
    isNew: false,
    status: 'Suggested',
    confidence: 0.69,
    quotes: [
      ['P-3101', 'The schedule itself was fine. It was everything else.'],
      ['P-3115', 'I liked that it came on its own. No complaints there.'],
      ['P-3117', 'The timing worked. I just didn’t like the price.'],
    ],
  },

  // Which retention idea would keep them
  {
    id: 'c-idea-pause',
    name: 'Pause would have kept them',
    definition: 'Picked the pause idea as the one most likely to keep them.',
    questionId: 'q-ideas',
    isNew: false,
    status: 'Accepted',
    confidence: 0.88,
    decided: { by: maya, at: '2026-09-24T15:02:00-04:00' },
    quotes: [
      ['P-3104', 'The pause one. Obviously. That’s my whole story.'],
      ['P-3109', 'Pause. It solves the travel problem.'],
      ['P-3113', 'The pause idea. I’d have used it every other month.'],
      ['P-3118', 'Pause, then I’d only get food when we need it.'],
      ['P-3121', 'The pause, because we always had too much.'],
      ['P-3105', 'Pause, for sure.'],
    ],
  },
  {
    id: 'c-idea-portion',
    name: 'Portion-matched boxes appeal',
    definition: 'Picked boxes sized to what the pet eats.',
    questionId: 'q-ideas',
    isNew: false,
    status: 'Suggested',
    confidence: 0.81,
    quotes: [
      ['P-3113', 'The portion box. Sized for my cat, finally.'],
      ['P-3118', 'If the box matched what she actually eats, that’s the dream.'],
      ['P-3102', 'Portions that fit him. That’s the one.'],
      ['P-3122', 'Matching the box to the dog makes the most sense.'],
    ],
  },
  {
    id: 'c-idea-swap',
    name: 'Recipe swap appeals',
    definition: 'Picked the recipe swap idea.',
    questionId: 'q-ideas',
    isNew: false,
    status: 'Suggested',
    confidence: 0.79,
    quotes: [
      ['P-3101', 'The swap one, if it’s really one tap.'],
      ['P-3108', 'The recipe swap. She gets bored so fast.'],
      ['P-3111', 'Swap, because he’s picky.'],
      ['P-3116', 'Swap. Cats need variety.'],
    ],
  },
  {
    id: 'c-swap-unclear',
    name: 'Unsure how the swap works',
    definition: 'Didn’t understand how the recipe swap would work in practice.',
    questionId: 'q-ideas',
    isNew: false,
    status: 'Suggested',
    confidence: 0.62,
    quotes: [
      ['P-3106', 'I’m not sure how the swap would actually work.'],
      ['P-3110', 'Does swap mean they pick or I pick? It wasn’t clear.', 0.57],
      ['P-3120', 'Would I have to wait a whole box to swap?'],
    ],
  },

  // Flexibility or price
  {
    id: 'c-flex-first',
    name: 'Flexibility matters more than price',
    definition: 'Would rather control deliveries than pay less.',
    questionId: 'q-flex',
    isNew: false,
    status: 'Accepted',
    confidence: 0.87,
    decided: { by: maya, at: '2026-09-24T15:10:00-04:00' },
    quotes: [
      ['P-3104', 'Flexibility, every time. I’d pay a bit more to control it.'],
      ['P-3109', 'I’d rather pay the same and skip when I want.'],
      ['P-3113', 'Price matters, but the waste is what annoyed me.', 0.71],
      ['P-3118', 'Flexibility. Throwing food away is the real cost.'],
      ['P-3121', 'Being in control matters more than a few dollars.'],
      ['P-3105', 'Flexible, because then I don’t waste money anyway.'],
      ['P-3114', 'Flexibility. The price was okay until the second rise.', 0.66],
    ],
  },
  {
    id: 'c-price-first',
    name: 'Price matters more',
    definition: 'A lower price outweighs flexibility.',
    questionId: 'q-flex',
    isNew: false,
    status: 'Accepted',
    confidence: 0.85,
    decided: { by: maya, at: '2026-09-24T15:11:00-04:00' },
    quotes: [
      ['P-3101', 'Honestly, price. Flexibility is nice, but money is money.'],
      ['P-3103', 'Price. I’d put up with a lot for a fair price.'],
      ['P-3110', 'Price, for me. Cat food shouldn’t cost that much.'],
      ['P-3117', 'Price first. Everything else second.'],
      ['P-3120', 'Lower price, no question.'],
      ['P-3106', 'Price. We’re on a budget.'],
    ],
  },
  {
    id: 'c-both',
    name: 'Both matter equally',
    definition: 'Couldn’t choose between flexibility and price.',
    questionId: 'q-flex',
    isNew: false,
    status: 'Suggested',
    confidence: 0.55,
    quotes: [
      ['P-3122', 'I don’t think I can pick. Both, really.', 0.6],
      ['P-3108', 'Hard to say. Depends on the month.', 0.49],
    ],
  },

  // What would bring them back
  {
    id: 'c-stable-price',
    name: 'A fair, stable price',
    definition: 'A price that is locked or changes rarely.',
    questionId: 'q-back',
    isNew: false,
    status: 'Accepted',
    confidence: 0.83,
    decided: { by: maya, at: '2026-09-24T15:20:00-04:00' },
    quotes: [
      ['P-3103', 'A price that doesn’t change every few months.'],
      ['P-3106', 'Go back to the old price and I’m back.'],
      ['P-3110', 'Lock the price for a year.'],
      ['P-3117', 'A fair price I can count on.'],
    ],
  },
  {
    id: 'c-control',
    name: 'Control over deliveries',
    definition: 'Deciding when, and how much, arrives.',
    questionId: 'q-back',
    isNew: false,
    status: 'Suggested',
    confidence: 0.8,
    quotes: [
      ['P-3104', 'Being able to pause from my phone.'],
      ['P-3109', 'Let me decide when the next box comes.'],
      ['P-3113', 'Smaller boxes and a skip button.'],
      ['P-3121', 'Control. That’s the one word.'],
    ],
  },
  {
    id: 'c-vet-recipe',
    name: 'A vet-approved recipe',
    definition: 'A recipe for pets on a special or prescription diet.',
    questionId: 'q-back',
    isNew: false,
    status: 'Suggested',
    confidence: 0.66,
    quotes: [
      ['P-3107', 'If they made a kidney-friendly recipe, I’d come back.'],
      ['P-3115', 'A vet-approved line. Then maybe.'],
    ],
  },
  {
    id: 'c-trust',
    name: 'Lost trust in the company',
    definition: 'Would need to trust the company again before returning.',
    questionId: 'q-back',
    isNew: true,
    status: 'Suggested',
    confidence: 0.6,
    quotes: [
      ['P-3102', 'I’d need to trust they won’t do the price thing again.'],
      ['P-3111', 'After the cancel runaround, I just don’t trust them.', 0.56],
    ],
  },
]

// ─── place the quotes in the transcripts ────────────────────────────────────

/** P-3107's price quote is a corrected line (turn 42) of the reviewed transcript, not a placed one. */
const CORRECTED: Record<string, { index: number; text: string }> = {
  'P-3107|c-price-rise': { index: 41, text: 'We switched from the Burrow box to a store brand after the second price rise.' },
}
DRAFTS.find((d) => d.id === 'c-price-rise')!.quotes.push(['P-3107', CORRECTED['P-3107|c-price-rise'].text])

const PROBES = ['Tell me more about that.', 'What else comes to mind?', 'Can you give me an example?', 'Anything else on that?']

export const EXCERPTS: Record<string, Excerpt> = {}
const placed = new Map<string, { index: number; text: string }[]>()
const nextSlot = new Map<string, number>()

function place(code: Draft, [participantId, text, conf]: Q, n: number): string {
  const sessionId = sessionOf(participantId)
  const rec = findReviewRecord(sessionId)
  const id = `${code.id}-${participantId}-${n}`
  if (!rec) throw new Error(`No review record for ${sessionId}`)
  const total = rec.durationMin * 60
  const at = (i: number) => Math.floor((i * total) / rec.turnCount)
  const fixed = CORRECTED[`${participantId}|${code.id}`]
  let index: number
  if (fixed) index = fixed.index
  else {
    const q = CODE_QUESTIONS.find((x) => x.id === code.questionId)!
    const key = `${sessionId}|${q.id}`
    const lines = placed.get(sessionId) ?? []
    const taken = new Set([...rec.flags.map((f) => f.turn - 1), ...(rec.reviewed?.edits.map((e) => e.index) ?? []), ...lines.map((l) => l.index)])
    const first = !nextSlot.has(key)
    let i = nextSlot.get(key) ?? Math.round(q.fraction * rec.turnCount) | 1
    while (taken.has(i) || taken.has(i - 1)) i += 2
    nextSlot.set(key, i + 2)
    index = i
    lines.push({ index: i - 1, text: first ? q.text : PROBES[(i >> 1) % PROBES.length] }, { index: i, text })
    placed.set(sessionId, lines)
  }
  EXCERPTS[id] = { id, sessionId, participantId, questionId: code.questionId, text, turnIndex: index, atSec: at(index), confidence: conf ?? code.confidence, ...(fixed ? { corrected: true } : {}) }
  return id
}

export const SEED_CODES: SeedCode[] = DRAFTS.map((d) => {
  const { quotes, extra = [], ...rest } = d
  return { ...rest, excerpts: quotes.map((q, n) => place(d, q, n)), more: extra.map((q, n) => place(d, q, n + 50)) }
})
placed.forEach((lines, sessionId) => placeTranscriptLines(sessionId, lines))

// "Boxes came too often" was merged into "Food piling up": its quotes now live there, so it keeps none of its own.

// ─── themes ─────────────────────────────────────────────────────────────────

export type SeedTheme = { id: string; name: string; definition: string; codeIds: string[]; by: string; at: string }

export const SEED_THEMES: SeedTheme[] = [
  { id: 't-price', name: 'Price creep', definition: 'Repeated price rises wore down the sense of value until people left.', codeIds: ['c-price-rise', 'c-price-first', 'c-stable-price'], by: maya, at: '2026-09-25T09:30:00-04:00' },
  { id: 't-pet', name: 'The pet decides', definition: 'The pet’s appetite or health ended the subscription, whatever the owner wanted.', codeIds: ['c-pet-refused', 'c-vet-diet', 'c-nothing'], by: maya, at: '2026-09-25T09:42:00-04:00' },
]

/** Themes PulseAI would propose for accepted codes that aren't in a theme yet. Each appears only once one of its codes qualifies. */
export const THEME_SUGGESTIONS: Omit<SeedTheme, 'by' | 'at'>[] = [
  { id: 'ts-control', name: 'Wanting control over deliveries', definition: 'People wanted to decide when food arrives and how much, and left when they couldn’t.', codeIds: ['c-skip-pause', 'c-schedule-clash', 'c-idea-pause', 'c-flex-first', 'c-control', 'c-piling-up', 'c-idea-portion'] },
  { id: 'ts-join', name: 'Why they joined', definition: 'Convenience and better food brought people in, not the price.', codeIds: ['c-runout', 'c-ingredients', 'c-intro-discount'] },
  { id: 'ts-friction', name: 'Friction in the account', definition: 'Changing a recipe or cancelling took more effort than people expected.', codeIds: ['c-swap-hassle', 'c-hard-cancel', 'c-swap-unclear'] },
]

// ─── the log so far ─────────────────────────────────────────────────────────

export type LogEntry = { id: string; at: string; by: string; target: { kind: 'code' | 'theme' | 'codebook'; id: string; name: string }; action: string; detail?: string; why?: string }

export const SEED_LOG: LogEntry[] = (() => {
  const out: LogEntry[] = [
    { id: 'l-0', at: CODED_AT, by: AI_CODER, target: { kind: 'codebook', id: 'codebook', name: 'Codebook' }, action: 'Suggested codes', detail: `${DRAFTS.length} codes from 20 accepted sessions` },
  ]
  SEED_CODES.forEach((c) => {
    if (!c.decided) return
    const action = c.status === 'Accepted' ? 'Accepted' : c.status === 'Rejected' ? 'Rejected' : 'Merged'
    const detail = c.status === 'Merged' ? `Into “${SEED_CODES.find((x) => x.id === c.mergedInto)!.name}”` : undefined
    out.push({ id: `l-${c.id}`, at: c.decided.at, by: c.decided.by, target: { kind: 'code', id: c.id, name: c.name }, action, detail, why: c.decided.why })
  })
  out.push({ id: 'l-rename', at: '2026-09-24T14:12:00-04:00', by: maya, target: { kind: 'code', id: 'c-pet-refused', name: 'Pet stopped eating it' }, action: 'Renamed', detail: 'From “Palatability issues”', why: 'Use the words people actually said.' })
  SEED_THEMES.forEach((t) => out.push({ id: `l-${t.id}`, at: t.at, by: t.by, target: { kind: 'theme', id: t.id, name: t.name }, action: 'Created theme', detail: `${t.codeIds.length} codes` }))
  return out.sort((a, b) => b.at.localeCompare(a.at))
})()
