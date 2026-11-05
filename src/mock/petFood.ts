// Pet Food Subscription Churn (Burrow Pet): a finished study, filled in from the brief to the review decisions, so a
// second study can be followed end to end. It is built from the same shapes as the seed study (Moisturizer Concept
// Study) but says its own things: the brief, the audience and screener, the guide, the concepts, the interviews.

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
import { PET_SEED_SESSIONS } from './sessions'
import { PET_SURVEYS, surveyItem } from './surveys'
import type { StudyRecord } from './types'

export const PET_ID = 'pet-food-churn'
const CLIENT = 'Burrow Pet'
const maya = people.researcher.name
const dana = 'Dana Whitfield'
const DANA_ROLE = 'Head of Customer Insights'

// ─── the brief ──────────────────────────────────────────────────────────────

const email = `Hi Maya,

Thanks for the call. Here's the brief for the subscription churn study.

What we need to learn: why dog and cat owners cancel their Burrow Pet subscription in the first six months, which reasons carry the most weight, and which of three retention ideas would have kept them or would bring them back. We also need to know whether flexibility (pausing, swapping a recipe, smaller portions) matters more than price.

About us: Burrow Pet is a US direct-to-consumer pet food brand. We deliver fresh-baked dog and cat food on subscription and sell only through burrowpet.example. Monthly churn has doubled since the March price rise.

The category: subscription pet food is crowded. Fresh-food brands win on ingredients and convenience, retailer autoship programs win on price and easy skipping, and vet-recommended diets are the fastest-growing segment.

Who to talk to: dog or cat owners aged 28 to 55 who cancelled a pet food subscription in the last six months and still feed a dog or cat packaged or delivered food every day.

Market: United States.

We'd like 20 completed interviews, about 25 minutes each.

For background, our 2025 exit survey found that price was the most common reason, but only a third of the people who gave it said a discount would have kept them.

Thanks,
${dana}
${DANA_ROLE}, ${CLIENT}`

const fromClient = (text: string): ExtractedSection => ({ text, source: 'Client-provided' })
const extracted: Record<SectionKey, ExtractedSection> = {
  objective: fromClient('Find out why dog and cat owners cancel their pet food subscription in the first six months and which reasons carry the most weight. Learn which of three retention ideas (pause, recipe swap, portion-matched boxes) would have kept them or would bring them back, and whether flexibility matters more than price.'),
  brand: fromClient('Burrow Pet is a US direct-to-consumer pet food brand. It delivers fresh-baked dog and cat food on subscription and sells only through its own site. Monthly churn has doubled since the March price rise.'),
  category: fromClient('Subscription pet food is crowded. Fresh-food brands win on ingredients and convenience, retailer autoship programs win on price and easy skipping, and vet-recommended diets are the fastest-growing segment.'),
  audience: fromClient('Dog or cat owners aged 28 to 55 in the United States who cancelled a pet food subscription in the last six months and still feed a dog or cat packaged or delivered food every day.'),
  market: fromClient('United States.'),
  sampleSize: fromClient('20 completed interviews.'),
  length: fromClient('About 25 minutes per interview.'),
}

function petBrief(): BriefDoc {
  const at = '2026-08-03T14:20:00-04:00'
  const sections: Sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, { ...extracted[k], lastEdited: { by: AI_NAME, at } }])) as Sections
  const approvedAt = '2026-08-04T10:00:00-04:00'
  return {
    studyId: PET_ID,
    sampleKey: 'complete',
    original: { kind: 'text', label: 'Written brief (email)', from: `${dana}, ${CLIENT}`, receivedAt: '2026-08-03T14:12:00-04:00', text: email, textLabel: 'Email text' },
    previousResearch: true,
    chat: [
      { id: 'm-1', at: '2026-08-03T14:14:00-04:00', role: 'researcher', kind: 'text', text: email },
      { id: 'm-2', at: '2026-08-03T14:15:00-04:00', role: 'ai', kind: 'step', step: 'extract', detail: 'Found 7 of 7 sections in the input.', items: ['In the input: all seven sections', 'Previous research is mentioned. It stays in the original input.'] },
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
    approval: { by: maya, at: approvedAt, version: 1, method: 'Client', client: dana },
    events: [
      { id: 'e-1', type: 'saved', at, by: AI_NAME, version: 1, note: 'AI draft from intake' },
      { id: 'e-2', type: 'shared', at: '2026-08-03T16:30:00-04:00', by: maya, version: 1 },
      { id: 'e-3', type: 'approved', at: approvedAt, by: maya, version: 1, method: 'Client', client: dana },
    ],
  }
}

// ─── the audience and the screener ──────────────────────────────────────────

let fn = 0
const filter = (field: Filter['field'], value: string, extra: Partial<Filter> = {}): Filter => ({ id: `pf-${++fn}`, field, value, origin: 'ai', ...extra })

function petAudience(brief: BriefDoc): AudienceDoc {
  const filters = [
    filter('gender', 'Any gender'),
    filter('age', '', { origin: 'edited', min: '28', max: '55' }),
    filter('country', 'United States'),
    filter('productUsage', 'Feeds a dog or cat packaged or delivered food daily'),
    filter('purchaseFrequency', 'Cancelled a pet food subscription in the last 6 months'),
  ]
  const def: AudienceDef = {
    total: 20,
    totalOrigin: 'ai',
    bufferPct: 20,
    cohort: { id: 'c-main', name: 'Dog and cat owners 28–55 who cancelled a pet food subscription', nameOrigin: 'edited', filters, missing: [] },
    exclusions: STANDARD_EXCLUSIONS.map((e, i) => ({ id: `ex-${i + 1}`, ...e })),
  }
  // The standard screener, reworded for pets. Each question keeps the tag of the filter it checks, so screening can read it.
  const questions = generateQuestions(def).map((q) => {
    if (q.field === 'productUsage') return { ...q, text: 'How often do you feed your dog or cat packaged or delivered food?' }
    if (q.field === 'purchaseFrequency')
      return { ...q, text: 'When did you cancel a pet food subscription?', options: ['In the last month', '1–3 months ago', '4–6 months ago', 'More than 6 months ago', 'I have never had one'], purpose: 'Checks that they cancelled a subscription in the window.' }
    if (q.field === 'industry') return { ...q, text: 'Do you or anyone in your household work in market research, advertising or pet care?' }
    if (q.field === 'brands') return { ...q, text: 'Which pet food brands or subscriptions have you used in the last 6 months?', options: ['Burrow Pet', 'The Farmer’s Dog', 'Chewy Autoship', 'Ollie', 'Nom Nom', 'A store brand', 'Other', 'None'], purpose: 'Checks recent experience with pet food subscriptions.' }
    return q
  })
  const invited = '2026-08-28T10:15:00-04:00'
  const candidates: Candidate[] = [
    ...Array.from({ length: 6 }, (_, i): Candidate => ({ id: `cd-m${i + 1}`, value: `usr_${71204 + i * 11}`, idType: 'userId', source: 'Manual', addedAt: '2026-08-27T09:20:00-04:00', invitedAt: invited })),
    ...Array.from({ length: 20 }, (_, i): Candidate => ({ id: `cd-e${i + 1}`, value: `NS-${73310 + i * 9}`, idType: 'userId', source: 'External', addedAt: '2026-08-27T09:25:00-04:00', invitedAt: invited })),
  ]
  const doc: AudienceDoc = {
    studyId: PET_ID,
    briefVersion: brief.versions[0].number,
    pending: [],
    def,
    status: 'Confirmed',
    version: 1,
    confirmed: { version: 1, by: maya, at: '2026-08-08T10:00:00-04:00', def: structuredClone(def) },
    events: [
      { id: 'ae-1', at: '2026-08-05T09:40:00-04:00', by: AI_NAME, version: 1, type: 'drafted' },
      { id: 'ae-2', at: '2026-08-08T10:00:00-04:00', by: maya, version: 1, type: 'confirmed' },
    ],
    screener: { status: 'Ready', questions, generatedAt: '2026-08-08T10:10:00-04:00', fromAudienceVersion: 1, accepted: { by: maya, at: '2026-08-10T09:00:00-04:00' } },
    reward: seedReward('United States', 50, 25, maya, '2026-08-10T09:00:00-04:00'),
    sourcing: { option: 'external', panelName: 'Northstar Consumer Panel (mock)', candidates },
  }
  const view = poolView(mockApplicants(doc), doc)
  const shortfall = view.members.length < view.need ? { have: view.members.length, need: view.need } : null
  return { ...doc, pool: { at: '2026-09-04T16:20:00-04:00', by: maya, members: view.members.map((m) => ({ applicantId: m.id })), reserve: view.reserve.map((m) => ({ applicantId: m.id })), shortfall, reserveShortfall: view.reserveShort ? { have: view.reserve.length, need: view.reserveSize } : null, reason: shortfall ? `Launched with ${shortfall.have} of ${shortfall.need}.` : undefined } }
}

// ─── the guide ──────────────────────────────────────────────────────────────

const stimuliItems: Stimulus[] = [
  { id: 'st-a', name: 'Concept A: Pause, don’t cancel', kind: 'concept', detail: '1 page', active: true, addedAt: '2026-08-12T10:00:00-04:00', addedBy: maya },
  { id: 'st-b', name: 'Concept B: Recipe swap guarantee', kind: 'concept', detail: '1 page', active: true, addedAt: '2026-08-12T10:02:00-04:00', addedBy: maya },
  { id: 'st-c', name: 'Concept C: Portion-matched boxes', kind: 'concept', detail: '1 page', active: true, addedAt: '2026-08-12T10:04:00-04:00', addedBy: maya },
  { id: 'st-v', name: 'Unboxing walkthrough, 20 seconds', kind: 'video', detail: 'MP4, 6.1 MB', active: false, addedAt: '2026-08-12T10:10:00-04:00', addedBy: maya },
  surveyItem('st-sv-keep', PET_SURVEYS.keep, '2026-08-12T10:15:00-04:00', 'PulseAI'),
  surveyItem('st-sv-reason', PET_SURVEYS.reason, '2026-08-12T10:16:00-04:00', 'PulseAI'),
]

const q = (text: string, extra: Partial<Question> = {}): Question => ({ id: uid('q'), text, mandatory: false, probes: [], banned: [], maxFollowUps: null, covers: [], origin: 'ai', ...extra })

function petGuideContent(): Guide {
  const objectives = [
    { id: 'o1', text: 'Why owners cancel, in their own words, and which reasons carry the most weight' },
    { id: 'o2', text: 'Which retention idea would have kept them, or would bring them back' },
    { id: 'o3', text: 'Whether flexibility (pause, swap, portions) matters more than price' },
    { id: 'o4', text: 'How they feed and shop for their pet today' },
  ]
  const fu = 2
  const intro = [
    q('Welcome the participant, explain this is a conversation with an AI interviewer that is recorded, and that there are no right or wrong answers.', { mandatory: true }),
    q('To start, tell me about your household and the pet you feed.', { probes: ['What kind of pet is it, and how old?', 'Who usually buys the food?'], covers: ['o4'], maxFollowUps: fu }),
  ]
  const behaviours = [
    q('Walk me through what your dog or cat eats on a normal day, and where each thing comes from.', { mandatory: true, probes: ['Dry, wet or fresh?', 'Who decides what they eat?'], covers: ['o4'], maxFollowUps: fu }),
    q('How did you come to start the subscription, and what did you expect from it?', { mandatory: true, probes: ['What else did you consider?', 'What made you choose that one?'], covers: ['o4'], maxFollowUps: fu }),
    q('What did you like most about it in the first month?', { probes: ['Can you give me an example?'], covers: ['o4', 'o3'], maxFollowUps: fu }),
  ]
  const themes = [
    q('Take me back to when you cancelled. What happened, step by step?', { mandatory: true, probes: ['When did you first think about cancelling?', 'What was the last straw?'], covers: ['o1'], banned: ['Was it because of the price?'], maxFollowUps: fu }),
    q('Which of the reasons you gave carried the most weight, and which were just the last straw?', { mandatory: true, probes: ['If that one hadn’t happened, would you have stayed?'], covers: ['o1'], maxFollowUps: fu }),
    q('What, if anything, could the company have done to keep you?', { mandatory: true, probes: ['Would you have noticed if they had?'], covers: ['o2'], banned: ['Would a discount have kept you?'], maxFollowUps: fu }),
    q('How did you feel about committing to a delivery schedule?', { probes: ['What happened when you wanted to skip a box?'], covers: ['o3'], maxFollowUps: fu }),
  ]
  const exercises: Question[] = []
  stimuliItems
    .filter((s) => s.active)
    .forEach((s, n) => {
      exercises.push(q(`Here is ${s.name}. Tell me your first reaction, before I say anything about it.`, { mandatory: true, stimulusId: s.id, probes: ['What stands out to you?', 'Is anything unclear?'], banned: ['Don’t you think this is a good idea?'], covers: ['o2'], maxFollowUps: fu }))
      if (n === 0) exercises.push(q('Now a short survey on screen, “Retention idea reaction”. Please answer each question as it appears.', { mandatory: true, surveyId: 'st-sv-keep', covers: ['o2'] }))
    })
  exercises.push(q('Which of these would have been most likely to keep you, and why?', { mandatory: true, probes: ['What puts the others behind it?'], covers: ['o2'], maxFollowUps: fu }))
  exercises.push(q('Some of these are about flexibility, not price. Does flexibility matter more or less than a lower price to you, and why?', { mandatory: true, probes: ['Can you think of a time it made the difference?'], banned: ['It’s about price, isn’t it?'], covers: ['o3'], maxFollowUps: fu }))
  exercises.push(q('One more short survey on screen, “Why they cancelled”. Please answer each question as it appears.', { surveyId: 'st-sv-reason', covers: ['o1'] }))
  const reflection = [
    q('Looking back, what is the single biggest thing that would bring you back?', { mandatory: true, covers: ['o2'], maxFollowUps: fu }),
    q('Is there anything we didn’t ask that matters to you when you choose a pet food?'),
  ]
  const wrap = [q('Thank the participant, explain what happens next and how the incentive is sent, then end the interview.', { mandatory: true })]
  // If no idea appeals, skip the comparison and go to what would bring them back.
  const first = exercises.find((x) => x.stimulusId)
  const compare = exercises.find((x) => x.text.startsWith('Which of these'))
  if (first && compare) compare.branch = { ifQuestionId: first.id, answer: 'None of them appeal', action: 'skip-to', targetId: reflection[0].id }

  const minutes = [2, 5, 7, 7, 3, 1]
  const titles = ['Intro', 'How they feed and shop', 'Subscribing and cancelling', 'Retention ideas', 'Reflection', 'Wrap-up']
  const sections: GuideSection[] = [intro, behaviours, themes, exercises, reflection, wrap].map((qs, n) => ({ id: uid('s'), title: titles[n], minutes: minutes[n], questions: qs, origin: 'ai' as const }))
  return {
    sections,
    objectives,
    wrapUp: ['Every mandatory question has been asked.', 'The target duration of 25 minutes is reached.', 'The participant asks to stop. End politely and thank them.', 'Hard stop: at 90% of the target duration, move to wrap-up even if optional questions remain.'],
    generatedAt: '2026-08-12T14:00:00-04:00',
    builtFrom: { briefVersion: 1, audienceVersion: 1, mode: 'ai', durationMin: 25 },
    overrides: {},
  }
}

function petGuide(): GuideDoc {
  const moderator = { ...emptyModerator(), mode: 'ai' as const, agentId: 'ava', style: 'warm' as const, durationMin: 25, standby: acceptedRoster(['u-priya', 'u-jordan'], 'English (US)') }
  const ev = (at: string, by: string, version: number, type: GuideDoc['events'][number]['type'], extra: { note?: string; feedback?: string } = {}) => ({ id: uid('ge'), at, by, version, type, ...extra })
  return {
    studyId: PET_ID,
    moderator,
    stimuli: { items: structuredClone(stimuliItems), skipped: false },
    guide: petGuideContent(),
    status: 'Approved',
    version: 2,
    edits: 0,
    approved: { version: 2, by: maya, at: '2026-08-20T10:00:00-04:00', onBehalfOf: `${dana} (client)` },
    events: [
      ev('2026-08-12T14:00:00-04:00', 'PulseAI', 1, 'drafted'),
      ev('2026-08-14T09:30:00-04:00', maya, 1, 'shared'),
      ev('2026-08-16T11:00:00-04:00', maya, 1, 'changes-requested', { note: `Requested by ${dana}`, feedback: 'Please ask directly about the March price rise. That is what our board wants to understand.' }),
      ev('2026-08-16T11:00:00-04:00', maya, 2, 'reopened', { note: 'Version 2 opened for the client’s changes. Version 1 is frozen.' }),
      ev('2026-08-19T15:45:00-04:00', maya, 2, 'shared'),
      ev('2026-08-20T09:40:00-04:00', dana, 2, 'client-approved', { note: dana }),
      ev('2026-08-20T10:00:00-04:00', maya, 2, 'approved', { note: `Client ${dana} approved` }),
    ],
  }
}

// ─── the interviews and their review ────────────────────────────────────────

const PET_LINES = [
  'We feed two scoops morning and night, mostly the Burrow chicken recipe.',
  'The price went up twice in six months, and that was when I started looking around.',
  'Biscuit got bored of the chicken after a few weeks, and the swap was a hassle.',
  'I’d have stayed if I could have skipped a box without a fight.',
  'Honestly, the boxes started piling up when we were away.',
  'My vet suggested a different diet, so that settled it.',
]

export const PET_CONTENT: FieldworkContent = { seeds: PET_SEED_SESSIONS, lines: PET_LINES, start: '2026-09-07T09:00:00-04:00' }

const NOTES: Record<string, string> = {
  'P-3102': 'The vague answer about cancelling was probed on the next turn. Usable.',
  'P-3106': 'The failed concept card was counted as not seen, as the guide says. The rest is usable.',
  'P-3108': 'A short run of quick answers early on, then fully engaged. Usable.',
  'P-3111': 'The agent asked about vet bills, which is outside the guide. The answers on cancelling are unaffected.',
  'P-3112': 'Same device and near-identical answers as P-3103. Excluded as a duplicate.',
  'P-3116': 'The agent never asked what would bring them back, so that theme is missing here. The cancellation story is complete, so it is kept.',
  'P-3119': 'The agent led the answers and the participant went quiet for long stretches. Not usable.',
}

/** Every completed interview was decided the day after it ended. */
const decisions: Record<string, Decision> = Object.fromEntries(
  PET_SEED_SESSIONS.filter((s) => s.variant === 'done').map((s) => {
    const done = new Date(s.at)
    done.setHours(done.getHours() + 18)
    return [s.participant, { by: maya, at: done.toISOString(), note: NOTES[s.participant] ?? 'Read the transcript and the survey answers. No concerns. Usable.' }]
  }),
)

const REPLACEMENTS = { 'P-3112': 'P-3121', 'P-3119': 'P-3122' }

const PET_PACK: ReviewPack = {
  seeds: PET_SEED_SESSIONS,
  guide: 'Guide v2',
  stimuli: stimuliItems.filter((s) => s.active).map((s) => ({ name: s.name, version: 'v1', kind: 'Concept card' as const })),
  surveys: [PET_SURVEYS.keep, PET_SURVEYS.reason],
  questions: [
    'Walk me through what your dog or cat eats on a normal day.',
    'What did you like about the subscription at the start?',
    'Take me back to when you cancelled. What happened?',
    'What stands out to you about this idea?',
    'Is anything unclear to you?',
    'Would this have kept you subscribed?',
  ],
  answers: [
    'Two scoops, morning and night, from the Burrow box.',
    'It was easy and I never ran out.',
    'The price went up twice and Biscuit got bored of the chicken.',
    'The pause idea sounds useful, honestly.',
    'I’m not sure how the swap would actually work.',
    'Maybe, if I could skip a delivery without a fight.',
  ],
  library: {
    'Identity mismatch': { text: 'I’m 61, actually. I’m feeding my daughter’s dog while she’s away.' },
    'Screener contradiction': { rationale: 'The answer contradicts the screener, which said they feed a dog or cat every day.', text: 'We don’t really have a pet at the moment, it’s my sister’s dog.' },
    'Duplicate entry': { text: 'The price went up twice and my dog got bored of the chicken, so I cancelled.' },
    'Missed core theme': { rationale: 'A mandatory guide theme (what would bring them back) was never asked.' },
    'Repetitive AI prompt': { text: 'Walk me through what your dog eats on a normal day.' },
    'Guide deviation': { rationale: 'The agent asked about vet bills, which isn’t in the approved guide.', text: 'Before we continue, how much do you spend at the vet each year?' },
    'Audio-transcript mismatch': { text: 'We switched when the box got [inaudible] expensive and he stopped [inaudible].' },
    'Leading question': { text: 'Wouldn’t you say the swap guarantee is better than your old subscription?' },
  },
  decisions,
  replacements: REPLACEMENTS,
  reviewed: {
    'P-3107-1': {
      version: 2,
      editedBy: maya,
      editedAt: '2026-09-17T09:20:00-04:00',
      summary: 'Corrected 2 mis-transcribed brand names. The raw transcript is unchanged.',
      edits: [
        { index: 41, text: 'We switched from the Burrow box to a store brand after the second price rise.' },
        { index: 97, text: 'The Farmer’s Dog was too expensive, so we went back to kibble.' },
      ],
    },
  },
  aiNotes: (stim, flags, fault) => [
    'Cancelled after the second price rise and said the dog got bored of one recipe.',
    `${stim} drew the strongest reaction.${fault ? ' One concept card did not load as planned.' : ''}`,
    flags ? `${flags} ${flags === 1 ? 'flag was' : 'flags were'} raised for review.` : 'No issues were raised during the interview.',
  ],
}
registerReviewSessions(buildReviewSessions(PET_PACK))

// ─── the whole study ────────────────────────────────────────────────────────

const launchSeed = (guide: GuideDoc): LaunchSeed => ({
  guideVersion: guide.version,
  stimuli: stimuliItems.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name })),
  fieldwork: { start: '2026-09-08', end: '2026-09-22' },
  consentAt: '2026-08-24T15:00:00-04:00',
  releaseAt: '2026-09-04T09:40:00-04:00',
  testRunsAt: ['2026-09-02T11:00:00-04:00', '2026-09-02T11:20:00-04:00'],
  mandatory: guide.guide!.sections.flatMap((s) => s.questions).filter((x) => x.mandatory).length,
  durationMin: 25,
  domain: 'burrowpet.example',
})

export const PET_RECORD: StudyRecord = {
  id: PET_ID,
  name: 'Pet Food Subscription Churn',
  client: CLIENT,
  clientContact: dana,
  category: 'Pet care: subscription food',
  moderatorType: 'AI-led',
  targetCompletes: 20,
  completedSessions: 22,
  timeZone: 'America/New_York',
  updatedAt: '2026-10-09T12:00:00-04:00',
  status: 'Complete',
  releaseVersion: 'Release v1.0',
  brief: { status: 'Approved', version: 1, approval: { by: maya, onBehalfOf: `${dana} (client)`, at: '2026-08-04T10:00:00-04:00', version: 1 } },
  audience: { status: 'Confirmed', version: 1, approval: { by: maya, at: '2026-08-08T10:00:00-04:00', version: 1 } },
  guide: { status: 'Approved', version: 2, approval: { by: maya, onBehalfOf: `${dana} (client)`, at: '2026-08-20T10:00:00-04:00', version: 2 } },
}

export type PetSeed = { brief: BriefDoc; audience: AudienceDoc; guide: GuideDoc; launch: ReturnType<typeof seedLaunchDoc>; fieldwork: FieldworkDoc }

/** Builds the study's documents, from the brief to a closed fieldwork with every interview decided. */
export function seedPetFood(): PetSeed {
  const brief = petBrief()
  const audience = petAudience(brief)
  const guide = petGuide()
  const launch = seedLaunchDoc(PET_ID, 'live', CLIENT, launchSeed(guide))
  const plan = compileStudyPlan(guide, studyLanguage(brief))
  if (plan.state !== 'ok') throw new Error('The Pet Food guide does not compile')
  const base = generateFieldwork({ studyId: PET_ID, audience, guide, plan: plan.plan, releaseNumber: 1, releaseVersion: 'Release v1.0', launch, content: PET_CONTENT })
  const invited = (id: string, state: string, at: string) => ({
    id: `A-${id.slice(2)}`,
    contact: `Phone · (312) ••• ${id.slice(2)}`,
    state,
    region: (regionOf(state) as FieldworkDoc['reserve'][number]['region']) ?? null,
    arrivedAt: '2026-09-09T10:00:00-04:00',
    source: 'External' as const,
    screenedUnder: 1,
    status: 'Invited' as const,
    invitedAs: id,
    invitedAt: at,
  })
  // Three people asked to talk to a person during the interview, and it went three different ways.
  const at = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString()
  const esc = (when: string, kind: 'system' | 'participant' | 'moderator', text: string) => ({ id: uid('ev'), at: when, kind, text })
  // P-3115 booked a free time with Jordan from the calendar. No answer was needed, and Jordan joined at the booked time.
  const asked = '2026-09-15T16:41:00-04:00'
  const booked = '2026-09-16T10:00:00-04:00'
  // P-3108 asked for a time that suited them. Jordan couldn't do it, so it fell to the Researcher, who assigned Priya. Priya joined.
  const asked2 = '2026-09-12T14:55:00-04:00'
  // P-3123 chose to end the interview rather than wait.
  const asked3 = '2026-09-18T14:12:00-04:00'
  base.sessions = base.sessions.map((s) =>
    s.id === 'P-3115-1'
      ? {
          ...s,
          moderatorId: 'u-jordan',
          events: [
            ...s.events,
            esc(asked, 'participant', 'Asked to talk to a human moderator'),
            esc(at(asked, 2), 'participant', 'Booked a time with Jordan Lee: Sep 16, 10:00 AM ET. A new link was sent.'),
            esc(booked, 'moderator', 'Jordan Lee joined at Sep 16, 10:00 AM ET'),
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
      : s.id === 'P-3108-1'
        ? {
            ...s,
            moderatorId: 'u-priya',
            events: [
              ...s.events,
              esc(asked2, 'participant', 'Asked to talk to a human moderator'),
              esc(at(asked2, 0.5), 'participant', 'Asked for a time that suits them: Sep 14, Sep 15, afternoon or evening. Sent to Jordan Lee.'),
              esc(at(asked2, 1.3), 'system', 'Jordan Lee couldn’t do those times. It is waiting for the Researcher.'),
              esc(at(asked2, 3), 'system', `${maya} assigned Priya Shah (online) and notified them`),
              esc(at(asked2, 5), 'moderator', 'Priya Shah joined at Sep 12, 3:00 PM ET'),
            ],
            escalation: {
              requestedAt: asked2,
              status: 'Joined' as const,
              fellThroughAt: at(asked2, 1.3),
              moderatorId: 'u-jordan',
              request: { sentAt: at(asked2, 0.5), days: ['2026-09-14', '2026-09-15'], windows: ['Afternoon' as const, 'Evening' as const], note: '', response: 'Declined' as const, respondedAt: at(asked2, 1.3) },
              choice: { by: 'Participant' as const, at: at(asked2, 0.5), how: 'Requested a time' as const },
              actedBy: { by: maya, at: at(asked2, 3), action: 'Assigned' as const, moderatorId: 'u-priya' },
              acceptedBy: 'u-priya',
              joinedAt: at(asked2, 5),
            },
          }
        : s.id === 'P-3123-1'
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
  const entry = (at: string, by: string, text: string) => ({ id: uid('fl'), at, by, text })
  const fieldwork: FieldworkDoc = {
    ...base,
    reserve: [invited('P-3121', 'Georgia', '2026-09-14T10:30:00-04:00'), invited('P-3122', 'New Jersey', '2026-09-18T09:45:00-04:00')],
    log: [
      entry('2026-09-14T10:30:00-04:00', maya, 'Invited 1 from the reserve: A-3121 as P-3121'),
      entry('2026-09-18T09:45:00-04:00', maya, 'Invited 1 from the reserve: A-3122 as P-3122'),
      entry('2026-09-23T10:00:00-04:00', maya, 'Closed fieldwork'),
    ],
    closed: { by: maya, at: '2026-09-23T10:00:00-04:00' },
  }
  return { brief, audience, guide, launch, fieldwork }
}
