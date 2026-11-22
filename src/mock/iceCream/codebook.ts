// The codebook PulseAI drafted for Ice Cream Flavour Concept Test, and what Maya Ortiz had already done with it.
// Every quote is written into that participant's transcript at the turn it cites, so a quote and its session never disagree.
// Who says what is fixed in docs/ICE_CREAM_STORY.md (picks, segments, survey answers). Quotes are short and spoken.

import '../iceCream'
import { buildPack, registerPack, type CodeQuestion, type Draft, type SeedTheme, type SeedTensionDecision } from '../codebookKit'
import { registerAnalysis, registerSegments } from '../studyAnalysis'

export const ICE_STUDY = 'ice-cream-flavours'
const maya = 'Maya Ortiz'
export const ICE_CODER = 'PulseAI'
export const ICE_CODED_AT = '2026-10-22T10:00:00-04:00'

// ─── who is in which group ──────────────────────────────────────────────────

const PARENTS = ['P-4102', 'P-4104', 'P-4105', 'P-4107', 'P-4109', 'P-4111', 'P-4114', 'P-4117', 'P-4121']
const ADULTS = ['P-4101', 'P-4103', 'P-4106', 'P-4108', 'P-4110', 'P-4113', 'P-4115', 'P-4116', 'P-4118', 'P-4120', 'P-4122']
registerAnalysis(ICE_STUDY)
registerSegments(
  ICE_STUDY,
  { first: { key: 'Parent', label: 'Parents', noun: 'parents', one: 'parent' }, second: { key: 'Adult', label: 'Adults without children', noun: 'adults without children', one: 'adult without children' } },
  Object.fromEntries([...PARENTS.map((p) => [p, 'Parent']), ...ADULTS.map((p) => [p, 'Adult'])]),
)

// ─── the guide questions the codes sit under ────────────────────────────────

export const ICE_QUESTIONS: CodeQuestion[] = [
  { id: 'iq-habit', label: 'How they buy ice cream', text: 'Walk me through the last time you bought a tub of ice cream.', section: 'How they buy ice cream', fraction: 0.14, skipped: [] },
  { id: 'iq-choose', label: 'How they choose a flavour', text: 'What usually makes you choose one flavour over another?', section: 'How they buy ice cream', fraction: 0.24, skipped: [] },
  { id: 'iq-pick', label: 'Which flavour they would buy first', text: 'Which of these three would you buy first, and why?', section: 'Choosing', fraction: 0.66, skipped: [] },
  { id: 'iq-stop', label: 'What would hold them back', text: 'What, if anything, would stop you buying it?', section: 'Choosing', fraction: 0.72, skipped: [] },
  {
    id: 'iq-price',
    label: 'What they would expect to pay',
    text: 'What would you expect to pay for a tub of the flavour you picked?',
    section: 'Choosing',
    fraction: 0.78,
    skipped: [{ participantId: 'P-4116', why: 'Never asked (flagged in Review)' }],
  },
  {
    id: 'iq-when',
    label: 'When they would eat it',
    text: 'Picture a tub in your freezer. When would you eat it, and who with?',
    section: 'Choosing',
    fraction: 0.84,
    // An optional question: the agent dropped it when time ran short.
    skipped: ['P-4102', 'P-4108', 'P-4111', 'P-4113', 'P-4116', 'P-4121'].map((participantId) => ({ participantId, why: 'Optional question, not asked' })),
  },
  { id: 'iq-change', label: 'What they would change', text: 'If you could change one thing about the flavour you liked best, what would it be?', section: 'Reflection', fraction: 0.9, skipped: [] },
]

// ─── the codes ──────────────────────────────────────────────────────────────

const DRAFTS: Draft[] = [
  // How they buy ice cream
  {
    id: 'ic-weekly-tub',
    name: 'Buys a tub every week',
    definition: 'Ice cream is a regular part of the weekly shop.',
    questionId: 'iq-habit',
    isNew: false,
    status: 'Accepted',
    confidence: 0.9,
    decided: { by: maya, at: '2026-10-22T14:05:00-04:00' },
    quotes: [
      ['P-4101', 'Pretty much every week. It goes in the trolley with the milk and eggs.'],
      ['P-4102', 'We get one on the Saturday shop, every Saturday.'],
      ['P-4104', 'A tub a week, sometimes two if it’s a hot week.'],
      ['P-4105', 'Every week, because it’s gone by Thursday.'],
      ['P-4107', 'I bought one on Sunday. I buy one most Sundays.'],
      ['P-4109', 'We always have one in the freezer. When it’s empty I buy another.'],
      ['P-4110', 'Weekly, usually on my way home on a Friday.'],
      ['P-4114', 'One tub a week for the family. That’s the routine.'],
      ['P-4117', 'Every Friday night is ice cream night, so every Friday I buy one.'],
    ],
    extra: [['P-4118', 'We get one most weeks, maybe skip one if we’ve been out.', 0.76]],
  },
  {
    id: 'ic-kids-decide',
    name: 'The kids pick the flavour',
    definition: 'Children at home have the deciding say.',
    questionId: 'iq-habit',
    isNew: false,
    status: 'Accepted',
    confidence: 0.87,
    decided: { by: maya, at: '2026-10-22T14:08:00-04:00' },
    quotes: [
      ['P-4102', 'My two choose. I just carry the tub to the till.'],
      ['P-4104', 'The kids pick it, honestly. If they won’t eat it, there’s no point.'],
      ['P-4105', 'My daughter decides. She’s eight and she has opinions.'],
      ['P-4109', 'Whatever the kids pointed at in the freezer aisle.'],
      ['P-4114', 'I let my son pick. Otherwise we get a fight at the checkout.'],
      ['P-4117', 'The kids vote. It’s basically a democracy, and I get one vote.'],
    ],
  },
  {
    id: 'ic-on-sale',
    name: 'Buys whatever is on sale',
    definition: 'The offer on the shelf decides which tub goes in the trolley.',
    questionId: 'iq-habit',
    isNew: false,
    status: 'Suggested',
    confidence: 0.74,
    quotes: [
      ['P-4105', 'It was two for six dollars, so that’s what I got.'],
      ['P-4106', 'I’ll be honest, I look for the yellow sale sticker first.'],
      ['P-4107', 'We usually buy Talenti, but the store brand when it’s on sale.'],
      ['P-4111', 'Whatever’s on offer that week. I’m not loyal to a brand.'],
      ['P-4118', 'Last week it was a buy-one-get-one, so I took two.'],
      ['P-4121', 'If something is half price, that’s the one that comes home.'],
    ],
  },
  {
    id: 'ic-treat-myself',
    name: 'Eats it as a treat for themselves',
    definition: 'Ice cream is a reward, eaten alone.',
    questionId: 'iq-habit',
    isNew: false,
    status: 'Suggested',
    confidence: 0.8,
    quotes: [
      ['P-4101', 'Mine is a bowl on the sofa once the day is done.'],
      ['P-4103', 'It’s my little reward after a long day.'],
      ['P-4106', 'It’s for me. Nobody else in my flat likes it.'],
      ['P-4110', 'I eat it straight from the tub on a Friday night. No judgment.'],
      ['P-4115', 'It’s my treat. I buy it for me.'],
      ['P-4122', 'I live alone, so a tub lasts me a week of little treats.'],
    ],
  },

  // How they choose a flavour
  {
    id: 'ic-stick-usual',
    name: 'Goes back to the usual flavour',
    definition: 'Tries something new now and then, then returns to vanilla or chocolate chip.',
    questionId: 'iq-choose',
    isNew: false,
    status: 'Accepted',
    confidence: 0.9,
    decided: { by: maya, at: '2026-10-22T14:12:00-04:00' },
    quotes: [
      ['P-4101', 'I try something new, and the next week I’m back to vanilla.'],
      ['P-4102', 'We always end up with vanilla or chocolate chip. Always.'],
      ['P-4105', 'I bought the cherry one once. Everyone ate it once. Then it was chocolate chip again.'],
      ['P-4107', 'New flavours are fun for a tub. After that I go back to what I know.'],
      ['P-4109', 'The new flavour is exciting for about a week, then we want our normal one.'],
      ['P-4110', 'I’m a creature of habit. Vanilla, mostly.'],
      ['P-4111', 'We tried the lemon one. It was fine. We went back to cookies and cream.'],
      ['P-4114', 'It’s chocolate chip for us, mostly. A new one every now and then.'],
      ['P-4117', 'We buy the usual, and a new one every few weeks to be adventurous.'],
      ['P-4118', 'If I like a new one I’ll buy it twice, then I drift back to vanilla.'],
      ['P-4121', 'Honestly, the kids ask for the same one every time.'],
    ],
    extra: [['P-4122', 'I usually end up back on chocolate chip after a week or two.', 0.72]],
  },
  {
    id: 'ic-try-new',
    name: 'Likes to try something new',
    definition: 'Enjoys a flavour they haven’t had before, and goes looking for one.',
    questionId: 'iq-choose',
    isNew: false,
    status: 'Accepted',
    confidence: 0.83,
    decided: { by: maya, at: '2026-10-22T14:15:00-04:00' },
    quotes: [
      ['P-4103', 'I always look at the new flavours first. That’s the fun part.'],
      ['P-4106', 'If there’s a new one, I’ll try it once.'],
      ['P-4108', 'I get bored of vanilla fast. I want something with a twist.'],
      ['P-4113', 'I love anything I haven’t tried before, especially fruity ones.'],
      ['P-4115', 'I’ll grab the weird flavour on the shelf, just to see.'],
      ['P-4116', 'I like finding new flavours, but I have to be able to picture the taste.'],
      ['P-4120', 'I’m the one who picks the odd flavour at the party.'],
      ['P-4122', 'Something different is the whole reason I’d pick a new tub.'],
    ],
  },
  {
    id: 'ic-tired-same',
    name: 'Bored of the same flavours',
    definition: 'Tired of the usual range and wants more choice.',
    questionId: 'iq-choose',
    isNew: false,
    status: 'Merged',
    confidence: 0.66,
    mergedInto: 'ic-try-new',
    decided: { by: maya, at: '2026-10-22T14:20:00-04:00', why: 'Same thing as liking to try something new, said another way.' },
    quotes: [],
  },
  {
    id: 'ic-mixins',
    name: 'Wants chunks and mix-ins',
    definition: 'A flavour is better with pieces in it: dough, cookies, chips.',
    questionId: 'iq-choose',
    isNew: false,
    status: 'Suggested',
    confidence: 0.78,
    quotes: [
      ['P-4102', 'If there are no bits in it, I’m not interested.'],
      ['P-4104', 'The kids go straight for anything with chunks.'],
      ['P-4109', 'Cookie dough, brownie bits, whatever. I want something to bite.'],
      ['P-4114', 'It has to have pieces. Smooth ice cream is boring.'],
      ['P-4117', 'Chunks are the best part. Everyone fights over them.'],
      ['P-4122', 'I judge a tub by how many chunks it has.'],
    ],
  },

  // Which flavour they would buy first
  {
    id: 'ic-pick-caramel',
    name: 'Would buy Salted Caramel Swirl first',
    definition: 'Picked the salted caramel as the flavour they would buy first.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Accepted',
    confidence: 0.88,
    decided: { by: maya, at: '2026-10-22T15:02:00-04:00' },
    quotes: [
      ['P-4101', 'The caramel one. I know I’d eat the whole tub.'],
      ['P-4106', 'Caramel. It’s the one I’d actually trust.'],
      ['P-4107', 'The salted caramel. It’s what everyone would eat.'],
      ['P-4110', 'Caramel, easy. Sweet and salty, you can’t go wrong.'],
      ['P-4111', 'The caramel, I think. The others feel like more of a gamble.'],
      ['P-4115', 'Salted caramel, because I like the salty bit.'],
      ['P-4118', 'Caramel. It’s the one I’d be sure about.'],
      ['P-4121', 'The caramel one. Even my picky eaters would try it.'],
    ],
  },
  {
    id: 'ic-pick-mango',
    name: 'Would buy Mango Lassi first',
    definition: 'Picked the mango lassi as the flavour they would buy first.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Accepted',
    confidence: 0.85,
    decided: { by: maya, at: '2026-10-22T15:04:00-04:00' },
    quotes: [
      ['P-4103', 'The mango lassi. It’s the only one I haven’t had before.'],
      ['P-4108', 'Mango, definitely. It’s the one I’d tell my friends about.'],
      ['P-4113', 'The lassi. Mango and cardamom sounds so good in the heat.'],
      ['P-4116', 'The mango one. I’d want to try it before the others get old.'],
      ['P-4120', 'Mango lassi. I’d buy it just because nobody else sells it.'],
    ],
  },
  {
    id: 'ic-pick-cookie',
    name: 'Would buy Cookie Dough Crunch first',
    definition: 'Picked the cookie dough as the flavour they would buy first.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Accepted',
    confidence: 0.87,
    decided: { by: maya, at: '2026-10-22T15:06:00-04:00' },
    quotes: [
      ['P-4102', 'The cookie dough, no question. My kids would lose their minds.'],
      ['P-4104', 'Cookie dough. It’s the one the whole house agrees on.'],
      ['P-4105', 'Cookie Dough Crunch, because I know it’ll get finished.'],
      ['P-4109', 'The cookie dough. It’s what we’d actually put in the trolley.'],
      ['P-4114', 'Cookie dough, because it’s fun and the kids love chunks.'],
      ['P-4117', 'Cookie dough. Everybody at my table would eat that.'],
      ['P-4122', 'Cookie dough, for me. I like the crunch more than the others.'],
    ],
  },
  {
    id: 'ic-caramel-safe',
    name: 'Caramel feels like the safe choice',
    definition: 'Chose caramel because it is familiar and unlikely to disappoint.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Suggested',
    confidence: 0.8,
    quotes: [
      ['P-4101', 'It’s the safe one. I’d never regret buying that.'],
      ['P-4107', 'Caramel is the sensible pick. Nobody complains about caramel.'],
      ['P-4110', 'It’s the one you can’t get wrong, so I’d start there.'],
      ['P-4111', 'The caramel feels like the safe bet. The others are risky.'],
      ['P-4118', 'I’d choose it because I already know I like it.'],
      ['P-4121', 'It’s the safest one, and I don’t want to waste money on a tub nobody eats.'],
    ],
  },
  {
    id: 'ic-mango-different',
    name: 'Mango is the one that’s different',
    definition: 'Found the mango lassi the most interesting because nobody else sells it.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Suggested',
    confidence: 0.82,
    quotes: [
      ['P-4101', 'The mango one is the interesting one. I’d like to try it, honestly.'],
      ['P-4103', 'That one is different from anything in my freezer.'],
      ['P-4108', 'It’s the only one that feels new. The others I’ve basically had.'],
      ['P-4113', 'Nobody does mango and cardamom. That’s what makes it special.'],
      ['P-4116', 'It’s the one that doesn’t sound like every other tub.'],
      ['P-4120', 'It’s a different taste altogether. I like that it’s not just sweet.'],
    ],
  },
  {
    id: 'ic-cookie-family',
    name: 'Cookie dough is one everyone will eat',
    definition: 'Chose cookie dough because the whole household will finish it.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Suggested',
    confidence: 0.86,
    quotes: [
      ['P-4102', 'There’s nothing in it anyone would pick out. Everybody eats it.'],
      ['P-4104', 'Even my husband would have some, and he never eats ice cream.'],
      ['P-4105', 'It’s the one nobody argues about.'],
      ['P-4109', 'It works for a seven-year-old and for me.'],
      ['P-4114', 'It’s a family flavour. That’s the point.'],
      ['P-4117', 'The whole table would eat it, so that’s the one.'],
    ],
  },
  {
    id: 'ic-lassi-unclear',
    name: 'Didn’t know what a lassi is',
    definition: 'Wasn’t sure what a lassi is, so couldn’t picture the taste.',
    questionId: 'iq-pick',
    isNew: false,
    status: 'Suggested',
    confidence: 0.7,
    quotes: [
      ['P-4103', 'I had to think about what a lassi even is. I’ve heard of it, I think.'],
      ['P-4111', 'What’s a lassi? I’d have to google it before I bought that.'],
      ['P-4113', 'I wasn’t sure at first. I had to read the description twice.'],
      ['P-4116', 'I don’t know what lassi tastes like, so I can’t say if I’d like it.'],
      ['P-4117', 'Lassi? I’ve never had one, so I’m guessing.', 0.64],
      ['P-4118', 'I don’t know that word. Is it like a smoothie?'],
      ['P-4120', 'Not everybody would know what lassi is, I think.'],
    ],
  },

  // What would hold them back
  {
    id: 'ic-kids-wont',
    name: 'The kids wouldn’t eat it',
    definition: 'Parents ruled out the mango because the children would refuse it.',
    questionId: 'iq-stop',
    isNew: false,
    status: 'Accepted',
    confidence: 0.84,
    decided: { by: maya, at: '2026-10-22T15:20:00-04:00' },
    quotes: [
      ['P-4105', 'Mango would be a waste of money. My daughter would not touch it.'],
      ['P-4107', 'The mango one, my kids would take one bite and say yuck.'],
      ['P-4109', 'The kids wouldn’t eat the mango. It sounds too grown-up.'],
      ['P-4111', 'The mango would stay in the freezer for months. My kids hate fruit ice cream.'],
      ['P-4114', 'My son would say it tastes funny. That’s the end of it.'],
      ['P-4117', 'Mango, with cardamom? The kids would say no before they tried it.'],
    ],
    extra: [['P-4121', 'My two wouldn’t go near a mango thing.', 0.78]],
  },
  {
    id: 'ic-sweet-worry',
    name: 'Worried it would be too sweet',
    definition: 'Afraid the flavour would be too sweet to finish a bowl.',
    questionId: 'iq-stop',
    isNew: false,
    status: 'Accepted',
    confidence: 0.76,
    decided: { by: maya, at: '2026-10-22T15:24:00-04:00' },
    quotes: [
      ['P-4101', 'Caramel is great, but I’d worry it’s too sweet after three spoons.'],
      ['P-4103', 'Mango and cream can be a lot. I’d worry it’s sugary.'],
      ['P-4115', 'That one’s very sweet. I’d get tired of it halfway through.', 0.57],
      ['P-4116', 'I’m not sure I’d finish a bowl. Sweet and creamy is heavy.'],
      ['P-4118', 'If it’s too sweet I can’t finish it, and then it’s wasted.'],
      ['P-4121', 'Cookie dough is too sweet for me. I’m the one who has half a scoop.'],
    ],
    extra: [['P-4122', 'Honestly, the only thing is if it’s too sugary.', 0.74]],
  },
  {
    id: 'ic-price-limit',
    name: 'A high price would stop them',
    definition: 'Over about six dollars a tub they would skip it or wait for a sale.',
    questionId: 'iq-stop',
    isNew: false,
    status: 'Suggested',
    confidence: 0.76,
    quotes: [
      ['P-4101', 'If it was seven dollars, I’d put it back.'],
      ['P-4106', 'Anything over six and I’d pass.', 0.55],
      ['P-4110', 'The price. Over six dollars and I’m out.'],
      ['P-4115', 'It’s a tub of ice cream. If it costs too much, I’ll just wait.'],
      ['P-4118', 'I’d wait for it to go on offer if it’s over six.'],
    ],
  },
  {
    id: 'ic-pay-wait-sale',
    name: 'Would wait for a sale',
    definition: 'Would hold off buying until the tub is discounted.',
    questionId: 'iq-stop',
    isNew: false,
    status: 'Merged',
    confidence: 0.68,
    mergedInto: 'ic-price-limit',
    decided: { by: maya, at: '2026-10-22T15:28:00-04:00', why: 'Same thing as a high price stopping them.' },
    quotes: [],
  },
  {
    id: 'ic-nothing-stop',
    name: 'Nothing would stop them',
    definition: 'Would buy it without hesitation.',
    questionId: 'iq-stop',
    isNew: false,
    status: 'Accepted',
    confidence: 0.8,
    decided: { by: maya, at: '2026-10-22T15:30:00-04:00' },
    quotes: [
      ['P-4102', 'Honestly, nothing. If it’s in the freezer I’m buying it.'],
      ['P-4104', 'Nothing really. I’d put it straight in the trolley.'],
      ['P-4113', 'I can’t think of anything. I’d just buy it.'],
      ['P-4122', 'Not really. I’d buy it on the day I saw it.'],
    ],
  },

  // What they would expect to pay
  {
    id: 'ic-pay-five-six',
    name: 'Expects to pay about five to six dollars',
    definition: 'A tub at around five to six dollars feels right.',
    questionId: 'iq-price',
    isNew: false,
    status: 'Accepted',
    confidence: 0.9,
    decided: { by: maya, at: '2026-10-22T15:40:00-04:00' },
    quotes: [
      ['P-4101', 'Five or six dollars is fine for a good one.'],
      ['P-4102', 'About five-fifty. That’s what a decent tub costs now.'],
      ['P-4104', 'Five to six. More than that and I’d think twice.'],
      ['P-4105', 'Around five dollars. I wouldn’t pay a lot more than that.'],
      ['P-4107', 'Five-ish. It’s ice cream, not a steak.'],
      ['P-4109', 'Five or six, same as the other premium ones.'],
      ['P-4110', 'Around five, maybe six at the most.'],
      ['P-4114', 'Six dollars, tops, for something a bit special.'],
      ['P-4117', 'Five to six dollars is what I pay now, so that.'],
      ['P-4121', 'Five dollars. Six if it’s really good.'],
      ['P-4122', 'About five dollars, I’d say.'],
    ],
  },
  {
    id: 'ic-pay-more-new',
    name: 'Would pay a little more for something different',
    definition: 'Would pay above the usual price for a flavour nobody else has.',
    questionId: 'iq-price',
    isNew: false,
    status: 'Suggested',
    confidence: 0.78,
    quotes: [
      ['P-4103', 'For the mango I’d pay seven. It’s not something I can get elsewhere.'],
      ['P-4108', 'If it’s unique, six or seven dollars is okay with me.'],
      ['P-4113', 'I’d pay a bit extra for it. A dollar more, no problem.'],
      ['P-4120', 'Maybe seven for the lassi. It’s special.'],
    ],
  },
  {
    id: 'ic-pay-under-five',
    name: 'Expects to pay under five dollars',
    definition: 'Thinks a tub should cost less than five dollars.',
    questionId: 'iq-price',
    isNew: false,
    status: 'Suggested',
    confidence: 0.74,
    quotes: [
      ['P-4106', 'Under five. That’s what I normally spend.', 0.52],
      ['P-4111', 'Four dollars, four-fifty. I wouldn’t go over five.'],
      ['P-4118', 'About four dollars. Anything higher, I’d wait for a sale.'],
    ],
  },

  // When they would eat it
  {
    id: 'ic-when-weekend',
    name: 'A weekend treat for the family',
    definition: 'Would eat it with the family on a Saturday or Sunday.',
    questionId: 'iq-when',
    isNew: false,
    status: 'Accepted',
    confidence: 0.86,
    decided: { by: maya, at: '2026-10-22T15:50:00-04:00' },
    quotes: [
      ['P-4104', 'Saturday evening, with the kids, in front of a film.'],
      ['P-4105', 'Sunday afternoon, when everybody’s home.'],
      ['P-4109', 'It would be our weekend dessert, all of us together.'],
      ['P-4114', 'Saturday night, the whole family, bowls on the sofa.'],
      ['P-4117', 'Friday movie night with the kids. That’s when it would go.'],
    ],
  },
  {
    id: 'ic-when-hot-day',
    name: 'On a hot day',
    definition: 'Would eat it to cool down when it’s hot out.',
    questionId: 'iq-when',
    isNew: false,
    status: 'Suggested',
    confidence: 0.78,
    quotes: [
      ['P-4103', 'On a really hot afternoon. Mango is made for that.'],
      ['P-4110', 'A hot day, definitely, straight from the freezer.'],
      ['P-4120', 'When it’s boiling outside. That’s when I want ice cream.'],
    ],
  },
  {
    id: 'ic-when-after-dinner',
    name: 'After dinner at home',
    definition: 'Would eat it as the usual dessert after a meal.',
    questionId: 'iq-when',
    isNew: false,
    status: 'Suggested',
    confidence: 0.8,
    quotes: [
      ['P-4101', 'After dinner, a bowl on the sofa. Every night, if I’m honest.'],
      ['P-4105', 'After tea, if everybody’s been good.'],
      ['P-4107', 'After dinner. We have a bit of dessert most evenings.'],
      ['P-4118', 'After dinner, in front of the television.'],
    ],
  },
  {
    id: 'ic-when-guests',
    name: 'When friends come over',
    definition: 'Would put it out when people visit.',
    questionId: 'iq-when',
    isNew: false,
    status: 'Suggested',
    confidence: 0.66,
    quotes: [
      ['P-4103', 'If friends come over, I’d bring it out as a surprise.'],
      ['P-4115', 'When I have people round. It’s a good talking point.', 0.58],
      ['P-4120', 'A party, with a few friends. It’s a conversation starter.'],
    ],
  },

  // What they would change
  {
    id: 'ic-less-sweet',
    name: 'Make it less sweet',
    definition: 'Would change the flavour to be less sweet.',
    questionId: 'iq-change',
    isNew: false,
    status: 'Accepted',
    confidence: 0.84,
    decided: { by: maya, at: '2026-10-22T16:00:00-04:00' },
    quotes: [
      ['P-4101', 'Less sugar. Keep the salt, dial the sweet down.'],
      ['P-4103', 'A bit less sweet and a bit more fruit.'],
      ['P-4115', 'I’d make it less sweet. That’s the only thing.'],
      ['P-4116', 'Less sweet, and I’d probably buy it every week.'],
      ['P-4118', 'Make it a bit less sugary and I’m sold.'],
      ['P-4122', 'Less sweet. The dough part is really sugary.'],
    ],
    extra: [['P-4121', 'Just a bit less sugar and I’d have picked it every time.', 0.7]],
  },
  {
    id: 'ic-more-best-part',
    name: 'More of the best part',
    definition: 'More caramel ribbon, more dough, more cookie pieces.',
    questionId: 'iq-change',
    isNew: false,
    status: 'Suggested',
    confidence: 0.78,
    quotes: [
      ['P-4101', 'More caramel swirl. There’s never enough ribbon.'],
      ['P-4102', 'More dough chunks, please. Double them.'],
      ['P-4104', 'More cookie dough. The kids pick it out first.'],
      ['P-4106', 'A thicker caramel ribbon through the middle.'],
      ['P-4107', 'More caramel, more salt, and I’d be happy.'],
      ['P-4110', 'More caramel in every scoop, not just the top.'],
      ['P-4114', 'More chunks all the way to the bottom of the tub.'],
    ],
  },
  {
    id: 'ic-explain-lassi',
    name: 'Explain what a lassi is on the tub',
    definition: 'A line on the tub would say what a lassi tastes like.',
    questionId: 'iq-change',
    isNew: false,
    status: 'Suggested',
    confidence: 0.8,
    quotes: [
      ['P-4103', 'Put a line on the tub, like “creamy mango yogurt drink, now in ice cream”.'],
      ['P-4111', 'Tell me what lassi is. One sentence on the front would do it.'],
      ['P-4113', 'A short note on the lid saying what it tastes like.'],
      ['P-4120', 'Say what a lassi is. Otherwise people will skip it.'],
    ],
  },
  {
    id: 'ic-kid-size',
    name: 'A smaller kid-size tub or cup',
    definition: 'A smaller pack so children can try it without a big commitment.',
    questionId: 'iq-change',
    isNew: false,
    status: 'Suggested',
    confidence: 0.62,
    quotes: [
      ['P-4105', 'A little single-serve cup, so the kids can try it first.'],
      ['P-4109', 'A mini tub. If they don’t like it, I haven’t wasted a big one.', 0.48],
      ['P-4117', 'Smaller sizes, so I can test a new flavour on the kids.'],
    ],
  },
  {
    id: 'ic-dairy-free',
    name: 'Wants a dairy-free version',
    definition: 'Would like the flavour made without dairy.',
    questionId: 'iq-change',
    isNew: false,
    status: 'Rejected',
    confidence: 0.5,
    decided: { by: maya, at: '2026-10-22T16:10:00-04:00', why: 'Only one person asked, and it is a different product from the three being tested.' },
    quotes: [['P-4116', 'If there was a dairy-free one, I’d be buying it for my sister.', 0.5]],
  },
]

// ─── themes ─────────────────────────────────────────────────────────────────

const THEMES: SeedTheme[] = [
  { id: 't-familiar', name: 'The safe choice wins the shelf', definition: 'People like the idea of something new, but most reach for the familiar flavour when they shop.', codeIds: ['ic-stick-usual', 'ic-weekly-tub', 'ic-pick-caramel'], by: maya, at: '2026-10-23T09:30:00-04:00' },
  { id: 't-family', name: 'Parents choose for the whole family', definition: 'With children at home, the flavour has to be one everyone will eat.', codeIds: ['ic-kids-decide', 'ic-pick-cookie', 'ic-kids-wont', 'ic-when-weekend'], by: maya, at: '2026-10-23T09:42:00-04:00' },
  // One approved tension, so the audio summary (and anything else that reads approved tensions) has one to show.
  { id: 't-tn-mango', name: 'Mango: a slow first reaction', definition: 'The first reaction to Mango Lassi and the later choice point in different directions for some people.', codeIds: ['ic-pick-mango'], by: maya, at: '2026-10-23T10:05:00-04:00', tensionId: 'tn-mango-concept' },
]

/** Themes PulseAI would propose for accepted codes that aren't in a theme yet. Each appears only once two of its codes are accepted. */
const THEME_SUGGESTIONS: Omit<SeedTheme, 'by' | 'at'>[] = [
  { id: 'ts-different', name: 'Adults want something different', definition: 'Adults without children like to try something new and will pay a little more for a flavour nobody else has.', codeIds: ['ic-try-new', 'ic-pick-mango', 'ic-pay-more-new', 'ic-mango-different', 'ic-when-hot-day'] },
  { id: 'ts-sweet', name: 'Sweetness is the limit', definition: 'The flavours are liked, but people worry about sweetness and would turn it down a notch.', codeIds: ['ic-less-sweet', 'ic-sweet-worry'] },
  { id: 'ts-price', name: 'Around five dollars is the line', definition: 'Most expect to pay five to six dollars. Above that, some would wait for a sale.', codeIds: ['ic-pay-five-six', 'ic-price-limit', 'ic-pay-under-five'] },
]

// ─── what has been decided on the tensions ──────────────────────────────────

const TENSIONS: Record<string, SeedTensionDecision> = {
  'tn-mango-concept': { status: 'Added as a tension theme', by: maya, at: '2026-10-23T10:05:00-04:00', themeId: 't-tn-mango' },
  'tn-price-survey': {
    status: 'Dismissed',
    by: maya,
    at: '2026-10-23T10:20:00-04:00',
    why: 'The survey asked about the flavour they liked best, with no price shown. Wanting the flavour and a limit on price don’t clash.',
  },
}

// ─── place the quotes in the transcripts and build the pack ─────────────────

/** P-4107's on-sale quote is a corrected line (turn 42) of the reviewed transcript, not a placed one. */
const CORRECTED: Record<string, { index: number; text: string }> = {
  'P-4107|ic-on-sale': { index: 41, text: 'We usually buy Talenti, but the store brand when it’s on sale.' },
}
// It is added to the code by buildPack, so it is not also written in the list above.
DRAFTS.find((d) => d.id === 'ic-on-sale')!.quotes = DRAFTS.find((d) => d.id === 'ic-on-sale')!.quotes.filter(([p]) => p !== 'P-4107')

export const ICE_PACK = registerPack(
  buildPack({
    studyId: ICE_STUDY,
    coder: ICE_CODER,
    codedAt: ICE_CODED_AT,
    questions: ICE_QUESTIONS,
    drafts: DRAFTS,
    sessionOf: (p) => (p === 'P-4104' ? 'P-4104-2' : `${p}-1`),
    corrected: CORRECTED,
    themes: THEMES,
    themeSuggestions: THEME_SUGGESTIONS,
    tensions: TENSIONS,
    suggestedDetail: `${DRAFTS.length} codes from 20 accepted sessions`,
    extraLog: () => [
      { id: 'l-rename', at: '2026-10-22T14:10:00-04:00', by: maya, target: { kind: 'code', id: 'ic-kids-decide', name: 'The kids pick the flavour' }, action: 'Renamed', detail: 'From “Children have the final say”', why: 'Use the words parents actually said.' },
      { id: 'l-tn-price', at: TENSIONS['tn-price-survey'].at, by: maya, target: { kind: 'tension', id: 'tn-price-survey', name: 'Said a high price would stop them, but answered “probably would” in the survey' }, action: 'Dismissed', why: TENSIONS['tn-price-survey'].why },
    ],
  }),
)
