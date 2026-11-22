// Ice Cream Flavour Concept Test (Scoop & Co): a second finished study, filled in from the brief to the review decisions
// and on into the analysis, so the whole flow can be followed on a topic anyone understands. It is built from the same
// shapes as Pet Food Subscription Churn (src/mock/petFood.ts) but says its own things: three new tub flavours, one
// group of parents and one of adults without children at home, and a client who wants to know which one to launch first.

import { AI_NAME, SECTION_KEYS, snapAll, uid, type BriefDoc, type ExtractedSection, type Sections, type SectionKey } from '@/state/brief'
import {
  generateQuestions,
  STANDARD_EXCLUSIONS,
  type AudienceDef,
  type AudienceDoc,
  type Candidate,
  type Filter,
} from '@/state/audience'
import { generateFieldwork, type FieldworkContent, type FieldworkDoc } from '@/state/fieldwork'
import { acceptedRoster, emptyModerator, type Guide, type GuideDoc, type GuideSection, type Question, type Stimulus } from '@/state/guide'
import { studyLanguage } from '@/state/language'
import { compileStudyPlan } from '@/state/launch'
import { seedReward } from '@/state/reward'
import { regionOf, mockApplicants, poolView } from '@/state/screening'
import { seedLaunchDoc, type LaunchSeed } from './launch'
import { people } from './people'
import { buildReviewSessions, registerReviewSessions, type Decision, type ReviewPack } from './review'
import { ICE_SEED_SESSIONS } from './sessions'
import { ICE_SURVEYS, surveyItem } from './surveys'
import type { StudyRecord } from './types'

export const ICE_ID = 'ice-cream-flavours'
const CLIENT = 'Scoop & Co'
const maya = people.researcher.name
const leah = 'Leah Brandt'
const LEAH_ROLE = 'Head of Product Development'

// ─── the brief ──────────────────────────────────────────────────────────────

const email = `Hi Maya,

Thanks for the call. Here's the brief for the new flavour study.

What we need to learn: which of three new tub flavours shoppers would buy first, and why. We also want to know what would hold them back and what they would expect to pay for a tub. We have room to launch one flavour in spring, so we need a clear first pick.

About us: Scoop & Co is a US ice cream brand sold in grocery stores. We make about a dozen tub flavours, mostly classics, and our best sellers are vanilla and chocolate chip.

The category: tub ice cream is crowded and driven by familiar flavours. The big brands compete on indulgent mix-ins, the store brands on price, and the newer lighter brands on fewer calories. Shoppers like to try a new flavour but most go back to what they know.

Who to talk to: adults aged 22 to 45 who buy tub ice cream at least once a week. We would like to hear from parents with children at home and from adults without children, because we think they want different things.

Market: United States.

We'd like 20 completed interviews, about 25 minutes each.

For background, our own sales data shows that new flavours sell well for the first month and then drop by half. We don't know whether people stopped liking them or just went back to their usual.

Thanks,
${leah}
${LEAH_ROLE}, ${CLIENT}`

const fromClient = (text: string): ExtractedSection => ({ text, source: 'Client-provided' })
const extracted: Record<SectionKey, ExtractedSection> = {
  objective: fromClient('Find out which of three new tub ice cream flavours (Salted Caramel Swirl, Mango Lassi, Cookie Dough Crunch) shoppers would buy first and why, what would hold them back, and what they would expect to pay for a tub. Give the client one clear first pick for a spring launch.'),
  brand: fromClient('Scoop & Co is a US ice cream brand sold in grocery stores. It makes about a dozen tub flavours, mostly classics, and its best sellers are vanilla and chocolate chip.'),
  category: fromClient('Tub ice cream is crowded and driven by familiar flavours. Big brands compete on indulgent mix-ins, store brands on price, and newer lighter brands on fewer calories. Shoppers like to try something new but most go back to what they know.'),
  audience: fromClient('Adults aged 22 to 45 in the United States who buy tub ice cream at least once a week, including parents with children at home and adults without children.'),
  market: fromClient('United States.'),
  sampleSize: fromClient('20 completed interviews.'),
  length: fromClient('About 25 minutes per interview.'),
}

function iceBrief(): BriefDoc {
  const at = '2026-09-14T14:20:00-04:00'
  const sections: Sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, { ...extracted[k], lastEdited: { by: AI_NAME, at } }])) as Sections
  const approvedAt = '2026-09-15T10:00:00-04:00'
  return {
    studyId: ICE_ID,
    sampleKey: 'complete',
    original: { kind: 'text', label: 'Written brief (email)', from: `${leah}, ${CLIENT}`, receivedAt: '2026-09-14T14:12:00-04:00', text: email, textLabel: 'Email text' },
    previousResearch: true,
    chat: [
      { id: 'm-1', at: '2026-09-14T14:14:00-04:00', role: 'researcher', kind: 'text', text: email },
      { id: 'm-2', at: '2026-09-14T14:15:00-04:00', role: 'ai', kind: 'step', step: 'extract', detail: 'Found 7 of 7 sections in the input.', items: ['In the input: all seven sections', 'Previous research is mentioned. It stays in the original input.'] },
      { id: 'm-3', at, role: 'ai', kind: 'step', step: 'draft', detail: 'Drafted the brief as version 1.' },
      { id: 'm-4', at, role: 'ai', kind: 'drafted' },
    ],
    pending: [],
    extracted: structuredClone(extracted),
    followUps: [],
    intakeComplete: true,
    draft: sections,
    versions: [{ number: 1, sections: snapAll(sections), savedBy: AI_NAME, savedAt: at, note: 'AI draft from intake' }],
    status: 'Approved',
    reviewRequests: [],
    approval: { by: maya, at: approvedAt, version: 1, method: 'Client', client: leah },
    events: [
      { id: 'e-1', type: 'saved', at, by: AI_NAME, version: 1, note: 'AI draft from intake' },
      { id: 'e-2', type: 'shared', at: '2026-09-14T16:30:00-04:00', by: maya, version: 1 },
      { id: 'e-3', type: 'approved', at: approvedAt, by: maya, version: 1, method: 'Client', client: leah },
    ],
  }
}

// ─── the audience and the screener ──────────────────────────────────────────

let fn = 0
const filter = (field: Filter['field'], value: string, extra: Partial<Filter> = {}): Filter => ({ id: `ic-${++fn}`, field, value, origin: 'ai', ...extra })

/** How many people are invited. Enough that, after screening and verification, the pool fills to the target with a full reserve. */
const EXTERNAL_INVITES = 56
const MANUAL_INVITES = 12

function iceAudience(brief: BriefDoc): AudienceDoc {
  const filters = [
    filter('gender', 'Any gender'),
    filter('age', '', { origin: 'edited', min: '22', max: '45' }),
    filter('country', 'United States'),
    filter('productUsage', 'Eats tub ice cream at home every week'),
    filter('purchaseFrequency', 'Bought a tub of ice cream in the last 3 months'),
  ]
  const def: AudienceDef = {
    total: 20,
    totalOrigin: 'ai',
    bufferPct: 20,
    cohort: { id: 'c-main', name: 'Adults 22–45 who buy tub ice cream every week, with or without children at home', nameOrigin: 'edited', filters, missing: [] },
    exclusions: STANDARD_EXCLUSIONS.map((e, i) => ({ id: `ex-${i + 1}`, ...e })),
  }
  // The standard screener, reworded for ice cream. Each question keeps the tag of the filter it checks, so screening can read it.
  const questions = generateQuestions(def).map((q) => {
    if (q.field === 'productUsage') return { ...q, text: 'How often do you eat ice cream from a tub at home?' }
    if (q.field === 'purchaseFrequency') return { ...q, text: 'When did you last buy a tub of ice cream?', options: ['In the last month', '1–3 months ago', '4–6 months ago', 'More than 6 months ago', 'I have never bought one'], purpose: 'Checks that they bought a tub in the window.' }
    if (q.field === 'industry') return { ...q, text: 'Do you or anyone in your household work in market research, advertising or food and drink?' }
    if (q.field === 'brands') return { ...q, text: 'Which ice cream brands have you bought in the last 3 months?', options: ['Ben & Jerry’s', 'Häagen-Dazs', 'Talenti', 'Breyers', 'Halo Top', 'A store brand', 'Other', 'None'], purpose: 'Checks recent experience with tub ice cream.' }
    return q
  })
  const invited = '2026-09-24T10:15:00-04:00'
  const candidates: Candidate[] = [
    ...Array.from({ length: MANUAL_INVITES }, (_, i): Candidate => ({ id: `cd-m${i + 1}`, value: `usr_${81204 + i * 11}`, idType: 'userId', source: 'Manual', addedAt: '2026-09-23T09:20:00-04:00', invitedAt: invited })),
    ...Array.from({ length: EXTERNAL_INVITES }, (_, i): Candidate => ({ id: `cd-e${i + 1}`, value: `NS-${83310 + i * 9}`, idType: 'userId', source: 'External', addedAt: '2026-09-23T09:25:00-04:00', invitedAt: invited })),
  ]
  const doc: AudienceDoc = {
    studyId: ICE_ID,
    briefVersion: brief.versions[0].number,
    pending: [],
    def,
    status: 'Confirmed',
    version: 1,
    confirmed: { version: 1, by: maya, at: '2026-09-18T10:00:00-04:00', def: structuredClone(def) },
    events: [
      { id: 'ae-1', at: '2026-09-16T09:40:00-04:00', by: AI_NAME, version: 1, type: 'drafted' },
      { id: 'ae-2', at: '2026-09-18T10:00:00-04:00', by: maya, version: 1, type: 'confirmed' },
    ],
    screener: { status: 'Ready', questions, generatedAt: '2026-09-18T10:10:00-04:00', fromAudienceVersion: 1, accepted: { by: maya, at: '2026-09-21T09:00:00-04:00' } },
    reward: seedReward('United States', 40, 25, maya, '2026-09-21T09:00:00-04:00'),
    sourcing: { option: 'external', panelName: 'Northstar Consumer Panel (mock)', candidates },
  }
  const view = poolView(mockApplicants(doc), doc)
  const shortfall = view.members.length < view.need ? { have: view.members.length, need: view.need } : null
  return { ...doc, pool: { at: '2026-09-30T16:20:00-04:00', by: maya, members: view.members.map((m) => ({ applicantId: m.id })), reserve: view.reserve.map((m) => ({ applicantId: m.id })), shortfall, reserveShortfall: view.reserveShort ? { have: view.reserve.length, need: view.reserveSize } : null, reason: shortfall ? `Launched with ${shortfall.have} of ${shortfall.need}.` : undefined } }
}

// ─── the guide ──────────────────────────────────────────────────────────────

const stimuliItems: Stimulus[] = [
  { id: 'st-a', name: 'Concept A: Salted Caramel Swirl', kind: 'concept', detail: '1 page', text: 'Vanilla ice cream ribboned with buttery salted caramel. Sweet first, with a pinch of sea salt at the end.', active: true, addedAt: '2026-09-22T10:00:00-04:00', addedBy: maya },
  { id: 'st-b', name: 'Concept B: Mango Lassi', kind: 'concept', detail: '1 page', text: 'Creamy yogurt-style ice cream blended with ripe mango and a hint of cardamom. Inspired by the Indian drink.', active: true, addedAt: '2026-09-22T10:02:00-04:00', addedBy: maya },
  { id: 'st-c', name: 'Concept C: Cookie Dough Crunch', kind: 'concept', detail: '1 page', text: 'Cookie dough ice cream with crunchy chocolate cookie pieces and chocolate chips in every spoonful.', active: true, addedAt: '2026-09-22T10:04:00-04:00', addedBy: maya },
  { id: 'st-v', name: 'Tub reveal, 15 seconds', kind: 'video', detail: 'MP4, 4.8 MB', active: false, addedAt: '2026-09-22T10:10:00-04:00', addedBy: maya },
  surveyItem('st-sv-reaction', ICE_SURVEYS.reaction, '2026-09-22T10:15:00-04:00', 'PulseAI'),
  surveyItem('st-sv-occasion', ICE_SURVEYS.occasion, '2026-09-22T10:16:00-04:00', 'PulseAI'),
]

const q = (text: string, extra: Partial<Question> = {}): Question => ({ id: uid('q'), text, mandatory: false, probes: [], banned: [], maxFollowUps: null, covers: [], origin: 'ai', ...extra })

function iceGuideContent(): Guide {
  const objectives = [
    { id: 'o1', text: 'How they buy ice cream today and what decides the flavour' },
    { id: 'o2', text: 'Their first reaction to each of the three new flavours' },
    { id: 'o3', text: 'Which flavour they would buy first, and why' },
    { id: 'o4', text: 'What would hold them back, including what they would expect to pay' },
    { id: 'o5', text: 'When and with whom they would eat it' },
  ]
  const fu = 2
  const intro = [
    q('Welcome the participant, explain this is a conversation with an AI interviewer that is recorded, and that there are no right or wrong answers.', { mandatory: true }),
    q('To start, tell me about your household and who else eats ice cream at home.', { probes: ['Are there children at home?', 'Who usually buys it?'], covers: ['o1'], maxFollowUps: fu }),
  ]
  const buying = [
    q('Walk me through the last time you bought a tub of ice cream.', { mandatory: true, probes: ['Where did you buy it?', 'What made you pick that flavour?'], covers: ['o1'], maxFollowUps: fu }),
    q('What usually makes you choose one flavour over another?', { mandatory: true, probes: ['Does anyone else get a say?', 'What puts you off a flavour?'], covers: ['o1'], maxFollowUps: fu }),
    q('Tell me about a new flavour you tried recently. What happened after the first tub?', { probes: ['Did you buy it again?', 'What brought you back to your usual?'], covers: ['o1'], maxFollowUps: fu }),
  ]
  const reactions: Question[] = []
  stimuliItems
    .filter((s) => s.kind === 'concept' && s.active)
    .forEach((s) => reactions.push(q(`Here is ${s.name}. Tell me your first reaction, before I say anything about it.`, { mandatory: true, stimulusId: s.id, probes: ['What stands out to you?', 'Is anything unclear?'], banned: ['Don’t you think this sounds delicious?'], covers: ['o2'], maxFollowUps: fu })))
  const choosing = [
    q('Which of these three would you buy first, and why?', { mandatory: true, probes: ['What puts the others behind it?', 'Who would you buy it for?'], banned: ['Salted caramel is the best one, isn’t it?'], covers: ['o3'], maxFollowUps: fu }),
    q('Now a short survey on screen, “Flavour reaction”. Please answer each question as it appears.', { mandatory: true, surveyId: 'st-sv-reaction', covers: ['o3'] }),
    q('What, if anything, would stop you buying it?', { mandatory: true, probes: ['Would you notice that in the shop?'], banned: ['Would the price stop you?'], covers: ['o4'], maxFollowUps: fu }),
    q('What would you expect to pay for a tub of the flavour you picked?', { mandatory: true, probes: ['What would feel too expensive?', 'What would feel like a bargain?'], covers: ['o4'], maxFollowUps: fu }),
    q('Picture a tub in your freezer. When would you eat it, and who with?', { probes: ['Is that different from your usual flavour?'], covers: ['o5'], maxFollowUps: fu }),
    q('One more short survey on screen, “When they would eat it”. Please answer each question as it appears.', { surveyId: 'st-sv-occasion', covers: ['o5'] }),
  ]
  const reflection = [
    q('If you could change one thing about the flavour you liked best, what would it be?', { mandatory: true, covers: ['o3'], maxFollowUps: fu }),
    q('Is there anything we didn’t ask that matters to you when you choose ice cream?'),
  ]
  const wrap = [q('Thank the participant, explain what happens next and how the incentive is sent, then end the interview.', { mandatory: true })]
  // If no flavour appeals, skip the comparison and go to what they would change.
  const compare = choosing[0]
  compare.branch = { ifQuestionId: reactions[0].id, answer: 'None of them appeal', action: 'skip-to', targetId: reflection[0].id }

  const minutes = [2, 6, 8, 5, 3, 1]
  const titles = ['Intro', 'How they buy ice cream', 'First reactions', 'Choosing', 'Reflection', 'Wrap-up']
  const sections: GuideSection[] = [intro, buying, reactions, choosing, reflection, wrap].map((qs, n) => ({ id: uid('s'), title: titles[n], minutes: minutes[n], questions: qs, origin: 'ai' as const }))
  return {
    sections,
    objectives,
    wrapUp: ['Every mandatory question has been asked.', 'The target duration of 25 minutes is reached.', 'The participant asks to stop. End politely and thank them.', 'Hard stop: at 90% of the target duration, move to wrap-up even if optional questions remain.'],
    generatedAt: '2026-09-22T14:00:00-04:00',
    builtFrom: { briefVersion: 1, audienceVersion: 1, mode: 'ai', durationMin: 25 },
    overrides: {},
  }
}

function iceGuide(): GuideDoc {
  const moderator = { ...emptyModerator(), mode: 'ai' as const, agentId: 'ava', style: 'warm' as const, durationMin: 25, standby: acceptedRoster(['u-priya', 'u-jordan'], 'English (US)') }
  const ev = (at: string, by: string, version: number, type: GuideDoc['events'][number]['type'], extra: { note?: string; feedback?: string } = {}) => ({ id: uid('ge'), at, by, version, type, ...extra })
  return {
    studyId: ICE_ID,
    moderator,
    stimuli: { items: structuredClone(stimuliItems), skipped: false },
    guide: iceGuideContent(),
    status: 'Approved',
    version: 2,
    edits: 0,
    approved: { version: 2, by: maya, at: '2026-09-29T10:00:00-04:00', onBehalfOf: `${leah} (client)` },
    events: [
      ev('2026-09-22T14:00:00-04:00', 'PulseAI', 1, 'drafted'),
      ev('2026-09-24T09:30:00-04:00', maya, 1, 'shared'),
      ev('2026-09-25T11:00:00-04:00', maya, 1, 'changes-requested', { note: `Requested by ${leah}`, feedback: 'Please ask people directly what they would expect to pay for a tub. Our retail buyers want a price point, not just a flavour.' }),
      ev('2026-09-25T11:00:00-04:00', maya, 2, 'reopened', { note: 'Version 2 opened for the client’s changes. Version 1 is frozen.' }),
      ev('2026-09-28T15:45:00-04:00', maya, 2, 'shared'),
      ev('2026-09-29T09:40:00-04:00', leah, 2, 'client-approved', { note: leah }),
      ev('2026-09-29T10:00:00-04:00', maya, 2, 'approved', { note: `Client ${leah} approved` }),
    ],
  }
}

// ─── the interviews and their review ────────────────────────────────────────

const ICE_LINES = [
  'We usually get a tub every week, mostly vanilla or chocolate chip for the kids.',
  'I like trying something new, but I always end up going back to my usual.',
  'The caramel one sounds like what I already eat, just a bit fancier.',
  'I wasn’t sure what a lassi was, to be honest.',
  'If it’s too sweet, I can’t finish a bowl.',
  'I’d buy it for the weekend, when everyone is home.',
]

export const ICE_CONTENT: FieldworkContent = { seeds: ICE_SEED_SESSIONS, lines: ICE_LINES, start: '2026-10-05T09:00:00-04:00' }

const NOTES: Record<string, string> = {
  'P-4102': 'The vague answer about choosing a flavour was probed on the next turn. Usable.',
  'P-4106': 'The failed Mango Lassi card was counted as not seen, as the guide says. The rest is usable.',
  'P-4108': 'A short run of quick answers early on, then fully engaged. Usable.',
  'P-4111': 'The agent asked about household income, which is outside the guide. The flavour answers are unaffected.',
  'P-4112': 'Same device and near-identical answers as P-4103. Excluded as a duplicate.',
  'P-4116': 'The agent never asked what they would expect to pay, so that theme is missing here. The flavour story is complete, so it is kept.',
  'P-4119': 'The agent led the answers and the participant went quiet for long stretches. Not usable.',
}

/** Every completed interview was decided the day after it ended. */
const decisions: Record<string, Decision> = Object.fromEntries(
  ICE_SEED_SESSIONS.filter((s) => s.variant === 'done').map((s) => {
    const done = new Date(s.at)
    done.setHours(done.getHours() + 18)
    return [s.participant, { by: maya, at: done.toISOString(), note: NOTES[s.participant] ?? 'Read the transcript and the survey answers. No concerns. Usable.' }]
  }),
)

const REPLACEMENTS = { 'P-4112': 'P-4121', 'P-4119': 'P-4122' }

const ICE_PACK: ReviewPack = {
  seeds: ICE_SEED_SESSIONS,
  guide: 'Guide v2',
  stimuli: stimuliItems.filter((s) => s.kind === 'concept' && s.active).map((s) => ({ name: s.name, version: 'v1', kind: 'Concept card' as const })),
  surveys: [ICE_SURVEYS.reaction, ICE_SURVEYS.occasion],
  questions: [
    'Walk me through the last time you bought a tub of ice cream.',
    'What usually makes you choose one flavour over another?',
    'Which of these three would you buy first?',
    'What stands out to you about this flavour?',
    'Is anything unclear to you?',
    'What would you expect to pay for a tub?',
  ],
  answers: [
    'A tub of vanilla from the supermarket, on the weekly shop.',
    'Mostly what the kids will actually eat.',
    'The caramel one, because it feels like the safe choice.',
    'It sounds rich, and I like the salty bit.',
    'I’m not sure what cardamom does in ice cream.',
    'Around five dollars. Over six and I’d wait for a sale.',
  ],
  library: {
    'Identity mismatch': { text: 'I’m 51, actually. I’m buying this for my grandchildren.' },
    'Screener contradiction': { rationale: 'The answer contradicts the screener, which said they buy tub ice cream every week.', text: 'I don’t really buy ice cream, my partner does the shopping.' },
    'Duplicate entry': { text: 'The salted caramel one, because it’s the safe choice and I could eat it every week.' },
    'Missed core theme': { rationale: 'A mandatory guide theme (what they would expect to pay) was never asked.' },
    'Repetitive AI prompt': { text: 'Walk me through the last time you bought a tub of ice cream.' },
    'Guide deviation': { rationale: 'The agent asked about household income, which isn’t in the approved guide.', text: 'Before we continue, roughly what is your household income?' },
    'Audio-transcript mismatch': { text: 'The [inaudible] one with the caramel was [inaudible] too sweet for us.' },
    'Leading question': { text: 'Wouldn’t you say the salted caramel is nicer than your usual flavour?' },
  },
  decisions,
  replacements: REPLACEMENTS,
  reviewed: {
    'P-4107-1': {
      version: 2,
      editedBy: maya,
      editedAt: '2026-10-27T09:20:00-04:00',
      summary: 'Corrected 2 mis-transcribed brand names. The raw transcript is unchanged.',
      edits: [
        { index: 41, text: 'We usually buy Talenti, but the store brand when it’s on sale.' },
        { index: 97, text: 'Ben & Jerry’s Cookie Dough is the one the kids always ask for.' },
      ],
    },
  },
  aiNotes: (stim, flags, fault) => [
    'Buys a tub most weeks, picks a flavour by what the household will eat, and likes to try something new now and then.',
    `${stim} drew the strongest reaction.${fault ? ' One concept card did not load as planned.' : ''}`,
    flags ? `${flags} ${flags === 1 ? 'flag was' : 'flags were'} raised for review.` : 'No issues were raised during the interview.',
  ],
}
registerReviewSessions(buildReviewSessions(ICE_PACK))

// ─── the whole study ────────────────────────────────────────────────────────

const launchSeed = (guide: GuideDoc): LaunchSeed => ({
  guideVersion: guide.version,
  stimuli: stimuliItems.filter((s) => s.kind === 'concept' && s.active).map((s) => ({ id: s.id, name: s.name })),
  fieldwork: { start: '2026-10-05', end: '2026-10-19' },
  consentAt: '2026-09-30T15:00:00-04:00',
  releaseAt: '2026-10-02T09:40:00-04:00',
  testRunsAt: ['2026-10-01T11:00:00-04:00', '2026-10-01T11:20:00-04:00'],
  mandatory: guide.guide!.sections.flatMap((s) => s.questions).filter((x) => x.mandatory).length,
  durationMin: 25,
  domain: 'scoopandco.example',
})

export const ICE_RECORD: StudyRecord = {
  id: ICE_ID,
  name: 'Ice Cream Flavour Concept Test',
  client: CLIENT,
  clientContact: leah,
  category: 'Food: tub ice cream',
  moderatorType: 'AI-led',
  targetCompletes: 20,
  completedSessions: 22,
  timeZone: 'America/New_York',
  updatedAt: '2026-10-30T12:00:00-04:00',
  status: 'Complete',
  releaseVersion: 'Release v1.0',
  brief: { status: 'Approved', version: 1, approval: { by: maya, onBehalfOf: `${leah} (client)`, at: '2026-09-15T10:00:00-04:00', version: 1 } },
  audience: { status: 'Confirmed', version: 1, approval: { by: maya, at: '2026-09-18T10:00:00-04:00', version: 1 } },
  guide: { status: 'Approved', version: 2, approval: { by: maya, onBehalfOf: `${leah} (client)`, at: '2026-09-29T10:00:00-04:00', version: 2 } },
}

export type IceSeed = { brief: BriefDoc; audience: AudienceDoc; guide: GuideDoc; launch: ReturnType<typeof seedLaunchDoc>; fieldwork: FieldworkDoc }

/** Builds the study's documents, from the brief to a closed fieldwork with every interview decided. */
export function seedIceCream(): IceSeed {
  const brief = iceBrief()
  const audience = iceAudience(brief)
  const guide = iceGuide()
  const launch = seedLaunchDoc(ICE_ID, 'live', CLIENT, launchSeed(guide))
  const plan = compileStudyPlan(guide, studyLanguage(brief))
  if (plan.state !== 'ok') throw new Error('The Ice Cream guide does not compile')
  const base = generateFieldwork({ studyId: ICE_ID, audience, guide, plan: plan.plan, releaseNumber: 1, releaseVersion: 'Release v1.0', launch, content: ICE_CONTENT })
  const invited = (id: string, state: string, at: string) => ({
    id: `A-${id.slice(2)}`,
    contact: `Phone · (312) ••• ${id.slice(2)}`,
    state,
    region: (regionOf(state) as FieldworkDoc['reserve'][number]['region']) ?? null,
    arrivedAt: '2026-10-07T10:00:00-04:00',
    source: 'External' as const,
    screenedUnder: 1,
    status: 'Invited' as const,
    invitedAs: id,
    invitedAt: at,
  })
  // Three people asked to talk to a person during the interview, and it went three different ways.
  const at = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString()
  const esc = (when: string, kind: 'system' | 'participant' | 'moderator', text: string) => ({ id: uid('ev'), at: when, kind, text })
  // P-4115 booked a free time with Jordan from the calendar. No answer was needed, and Jordan joined at the booked time.
  const asked = '2026-10-12T16:41:00-04:00'
  const booked = '2026-10-13T10:00:00-04:00'
  // P-4108 asked for a time that suited them. Jordan couldn't do it, so it fell to the Researcher, who assigned Priya. Priya joined.
  const asked2 = '2026-10-09T14:55:00-04:00'
  // P-4123 chose to end the interview rather than wait.
  const asked3 = '2026-10-15T14:12:00-04:00'
  base.sessions = base.sessions.map((s) =>
    s.id === 'P-4115-1'
      ? {
          ...s,
          moderatorId: 'u-jordan',
          events: [
            ...s.events,
            esc(asked, 'participant', 'Asked to talk to a human moderator'),
            esc(at(asked, 2), 'participant', 'Booked a time with Jordan Lee: Oct 13, 10:00 AM ET. A new link was sent.'),
            esc(booked, 'moderator', 'Jordan Lee joined at Oct 13, 10:00 AM ET'),
          ],
          escalation: {
            requestedAt: asked,
            status: 'Joined' as const,
            moderatorId: 'u-jordan',
            slot: booked,
            choice: { by: 'Participant' as const, at: at(asked, 2), how: 'Booked a follow-up' as const, slot: booked },
            acceptedBy: 'u-jordan',
            joinedAt: booked,
          },
        }
      : s.id === 'P-4108-1'
        ? {
            ...s,
            moderatorId: 'u-priya',
            events: [
              ...s.events,
              esc(asked2, 'participant', 'Asked to talk to a human moderator'),
              esc(at(asked2, 0.5), 'participant', 'Asked for a time that suits them: Oct 12, Oct 13, afternoon or evening. Sent to Jordan Lee.'),
              esc(at(asked2, 1.3), 'system', 'Jordan Lee couldn’t do those times. It is waiting for the Researcher.'),
              esc(at(asked2, 3), 'system', `${maya} assigned Priya Shah (online) and notified them`),
              esc(at(asked2, 5), 'moderator', 'Priya Shah joined at Oct 9, 3:00 PM ET'),
            ],
            escalation: {
              requestedAt: asked2,
              status: 'Joined' as const,
              fellThroughAt: at(asked2, 1.3),
              moderatorId: 'u-jordan',
              request: { sentAt: at(asked2, 0.5), days: ['2026-10-12', '2026-10-13'], windows: ['Afternoon' as const, 'Evening' as const], note: '', response: 'Declined' as const, respondedAt: at(asked2, 1.3) },
              choice: { by: 'Participant' as const, at: at(asked2, 0.5), how: 'Requested a time' as const },
              actedBy: { by: maya, at: at(asked2, 3), action: 'Assigned' as const, moderatorId: 'u-priya' },
              acceptedBy: 'u-priya',
              joinedAt: at(asked2, 5),
            },
          }
        : s.id === 'P-4123-1'
          ? {
              ...s,
              // Left because they couldn't wait, not because consent was withdrawn: the recording stays, so no consent withdrawal.
              consent: s.consent ? { ...s.consent, withdrawn: undefined } : s.consent,
              events: [
                ...s.events.filter((e) => !/Withdrew from the study/.test(e.text)),
                esc(asked3, 'participant', 'Asked to talk to a human moderator'),
                esc(at(asked3, 1), 'participant', 'Chose to end the interview: can’t wait'),
                esc(at(asked3, 1.2), 'system', 'Left the study. The recording and consent stand.'),
              ],
              escalation: {
                requestedAt: asked3,
                status: 'Ended by participant' as const,
                choice: { by: 'Participant' as const, at: at(asked3, 1), how: 'Ended the interview' as const, reason: 'Can’t wait' as const },
              },
            }
          : s,
  )
  const entry = (when: string, by: string, text: string) => ({ id: uid('fl'), at: when, by, text })
  const fieldwork: FieldworkDoc = {
    ...base,
    reserve: [invited('P-4121', 'Georgia', '2026-10-12T10:30:00-04:00'), invited('P-4122', 'New Jersey', '2026-10-16T09:45:00-04:00')],
    log: [
      entry('2026-10-12T10:30:00-04:00', maya, 'Invited 1 from the reserve: A-4121 as P-4121'),
      entry('2026-10-16T09:45:00-04:00', maya, 'Invited 1 from the reserve: A-4122 as P-4122'),
      entry('2026-10-20T10:00:00-04:00', maya, 'Closed fieldwork'),
    ],
    closed: { by: maya, at: '2026-10-20T10:00:00-04:00' },
  }
  return { brief, audience, guide, launch, fieldwork }
}
