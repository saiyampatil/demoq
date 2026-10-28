import type { BriefSample, ExtractedSection, SectionKey } from '@/state/brief'
import { people } from './people'

// Three mock inputs for R1, picked in the dev-only "Sample input" panel.
// Sentence links point at exact text in the original, so R4 can highlight where a sentence came from.

const client = `${people.client.name}, ${people.client.organization}`
const fromClient = (text: string, links: [string, string][] = []): ExtractedSection => ({
  text,
  source: 'Client-provided',
  links: links.map(([sentence, span]) => ({ sentence, span })),
})
const missing: ExtractedSection = { text: '', source: 'Missing' }

// ─── a) Complete brief ──────────────────────────────────────────────────────

const completeEmail = `Hi Maya,

Thanks for the call. Here's the brief for the HydraVeil 72h concept test.

What we need to learn: which of our three concept directions makes women with dry or combination skin want to switch from their current moisturizer, and what would stop them switching. We also need to know whether the refill format reads as premium or cheap.

About us: Verdane Skincare is a mid-priced US skincare brand. We sell through Target, Ulta and verdane.com, and our HydraVeil line is our best seller.

The category: facial moisturizers are crowded. Dermatologist-backed brands win on claims, and indie brands win on texture and sustainability. Refills are growing in prestige skincare but are rare at our price point.

Who to talk to: women aged 25 to 44 with dry or combination skin who use a facial moisturizer every day.

Market: United States.

We'd like 12 completed interviews, about 45 minutes each.

For background, our 2025 HydraVeil Night study found that texture was the main reason people stopped using the night cream.

Thanks,
Erin Walsh
Consumer Insights Lead, Verdane Skincare`

export const completeSections: Record<SectionKey, ExtractedSection> = {
  objective: fromClient(
    'Find out which of the three HydraVeil 72h concept directions makes women with dry or combination skin want to switch from their current moisturizer, and what would stop them switching. Learn whether the refill format reads as premium or cheap.',
    [
      [
        'Find out which of the three HydraVeil 72h concept directions makes women with dry or combination skin want to switch from their current moisturizer, and what would stop them switching.',
        'which of our three concept directions makes women with dry or combination skin want to switch from their current moisturizer, and what would stop them switching.',
      ],
      ['Learn whether the refill format reads as premium or cheap.', 'We also need to know whether the refill format reads as premium or cheap.'],
    ],
  ),
  brand: fromClient('Verdane Skincare is a mid-priced US skincare brand sold through Target, Ulta and verdane.com. HydraVeil is its best-selling line.', [
    [
      'Verdane Skincare is a mid-priced US skincare brand sold through Target, Ulta and verdane.com.',
      'Verdane Skincare is a mid-priced US skincare brand. We sell through Target, Ulta and verdane.com',
    ],
    ['HydraVeil is its best-selling line.', 'our HydraVeil line is our best seller.'],
  ]),
  category: fromClient(
    'Facial moisturizers are a crowded category. Dermatologist-backed brands win on claims, and indie brands win on texture and sustainability. Refills are growing in prestige skincare but are rare at mid-price points.',
    [
      ['Facial moisturizers are a crowded category.', 'facial moisturizers are crowded.'],
      [
        'Dermatologist-backed brands win on claims, and indie brands win on texture and sustainability.',
        'Dermatologist-backed brands win on claims, and indie brands win on texture and sustainability.',
      ],
      ['Refills are growing in prestige skincare but are rare at mid-price points.', 'Refills are growing in prestige skincare but are rare at our price point.'],
    ],
  ),
  audience: fromClient('Women aged 25–44 with dry or combination skin who use a facial moisturizer every day.', [
    [
      'Women aged 25–44 with dry or combination skin who use a facial moisturizer every day.',
      'women aged 25 to 44 with dry or combination skin who use a facial moisturizer every day.',
    ],
  ]),
  market: fromClient('United States.', [['United States.', 'Market: United States.']]),
  sampleSize: fromClient('12 completed interviews.', [['12 completed interviews.', "We'd like 12 completed interviews"]]),
  length: fromClient('45 minutes per interview.', [['45 minutes per interview.', 'about 45 minutes each.']]),
}

// ─── b) Missing brand, category and audience ────────────────────────────────

const shortEmail = `Hi Maya,

Quick brief for the next HydraVeil test.

We want to find out which of our three HydraVeil 72h concepts (Barrier Repair, Overnight Cushion and Clean Refill) people would actually switch to, and what would hold them back.

Please run it in the United States. We need 12 completed interviews of around 45 minutes.

Erin`

const missingContextSections: Record<SectionKey, ExtractedSection> = {
  objective: fromClient(
    'Find out which of the three HydraVeil 72h concepts (Barrier Repair, Overnight Cushion and Clean Refill) people would switch to, and what would hold them back.',
    [
      [
        'Find out which of the three HydraVeil 72h concepts (Barrier Repair, Overnight Cushion and Clean Refill) people would switch to, and what would hold them back.',
        'which of our three HydraVeil 72h concepts (Barrier Repair, Overnight Cushion and Clean Refill) people would actually switch to, and what would hold them back.',
      ],
    ],
  ),
  brand: {
    text: 'Verdane Skincare is a US skincare brand founded in 2014, priced in the middle of the market ($18–$32 per item). It sells through Target, Ulta Beauty and its own website. Its HydraVeil hydration line accounts for most of its reviews and press coverage.',
    source: 'AI-generated',
    aiLabel: 'Web scan synthesis',
    aiOriginal:
      'Verdane Skincare is a US skincare brand founded in 2014, priced in the middle of the market ($18–$32 per item). It sells through Target, Ulta Beauty and its own website. Its HydraVeil hydration line accounts for most of its reviews and press coverage.',
    aiAccepted: false,
    sources: [
      { title: 'About Verdane', publisher: 'verdane.example (mock)', url: 'https://verdane.example/about' },
      { title: 'Verdane brand page and HydraVeil reviews', publisher: 'Ulta Beauty (mock)', url: 'https://ulta.example/brand/verdane' },
      { title: 'Mid-price skincare brands to watch in 2026', publisher: 'Beauty Business Weekly (mock)', url: 'https://bbw.example/mid-price-skincare-2026' },
    ],
  },
  category: {
    text: 'US facial moisturizers are a crowded, mature category. Dermatologist-backed brands lead on clinical claims, while indie brands lead on texture and sustainability. Refillable packaging is growing in prestige skincare but is still rare below $35.',
    source: 'AI-generated',
    aiLabel: 'Web scan synthesis',
    aiOriginal:
      'US facial moisturizers are a crowded, mature category. Dermatologist-backed brands lead on clinical claims, while indie brands lead on texture and sustainability. Refillable packaging is growing in prestige skincare but is still rare below $35.',
    aiAccepted: false,
    sources: [
      { title: 'Facial moisturizer category snapshot, 2026', publisher: 'Retail Insights Digest (mock)', url: 'https://rid.example/facial-moisturizer-2026' },
      { title: 'Refills move from prestige into mass beauty', publisher: 'Packaging Today (mock)', url: 'https://packagingtoday.example/refills-mass-beauty' },
    ],
  },
  audience: {
    text: 'Women aged 25–44 in the US with dry or combination skin who use a facial moisturizer daily and have bought one in the last 3 months.',
    source: 'AI-generated',
    aiLabel: 'Suggested audience',
    aiOriginal: 'Women aged 25–44 in the US with dry or combination skin who use a facial moisturizer daily and have bought one in the last 3 months.',
    aiAccepted: false,
  },
  market: fromClient('United States.', [['United States.', 'Please run it in the United States.']]),
  sampleSize: fromClient('12 completed interviews.', [['12 completed interviews.', 'We need 12 completed interviews']]),
  length: fromClient('Around 45 minutes per interview.', [['Around 45 minutes per interview.', 'of around 45 minutes.']]),
}

// ─── c) Audio recording: no objective, one conflict ─────────────────────────

const callTranscript = `[00:00] Maya: Thanks for jumping on. Tell me about the HydraVeil 72h test.
[00:21] Erin: So we have three concept directions. Barrier Repair, Overnight Cushion and Clean Refill. Same gel-cream formula underneath.
[01:05] Erin: Verdane is mid-priced, we're at Target and Ulta, and HydraVeil is our biggest line.
[01:40] Erin: The category is really crowded. The derm brands own the claims, and the indie brands own texture.
[02:32] Erin: We want women about 25 to 44, dry or combination skin, using a moisturizer every day.
[03:10] Erin: It's US only. Interviews about 45 minutes.
[04:02] Erin: Let's say 12 completed interviews.
[06:45] Erin: Honestly, what we want to learn, I need to align with my director first. I'll get back to you.
[09:30] Erin: Actually, thinking about the range review, we probably need 20 interviews so we can split by skin type.
[12:40] Maya: Great, I'll draft something and send it over.`

const audioSections: Record<SectionKey, ExtractedSection> = {
  objective: missing,
  brand: fromClient('Verdane is a mid-priced brand sold at Target and Ulta. HydraVeil is its biggest line.', [
    ['Verdane is a mid-priced brand sold at Target and Ulta.', "Verdane is mid-priced, we're at Target and Ulta"],
    ['HydraVeil is its biggest line.', 'HydraVeil is our biggest line.'],
  ]),
  category: fromClient('The category is crowded. Dermatologist-backed brands own the claims, and indie brands own texture.', [
    ['The category is crowded.', 'The category is really crowded.'],
    ['Dermatologist-backed brands own the claims, and indie brands own texture.', 'The derm brands own the claims, and the indie brands own texture.'],
  ]),
  audience: fromClient('Women aged 25–44 with dry or combination skin who use a moisturizer every day.', [
    [
      'Women aged 25–44 with dry or combination skin who use a moisturizer every day.',
      'We want women about 25 to 44, dry or combination skin, using a moisturizer every day.',
    ],
  ]),
  market: fromClient('United States.', [['United States.', "It's US only."]]),
  sampleSize: fromClient('12 completed interviews (said at 04:02) or 20 completed interviews (said at 09:30).', [
    ['12 completed interviews (said at 04:02) or 20 completed interviews (said at 09:30).', "Let's say 12 completed interviews."],
  ]),
  length: fromClient('45 minutes per interview.', [['45 minutes per interview.', 'Interviews about 45 minutes.']]),
}

export const briefSamples: BriefSample[] = [
  {
    key: 'complete',
    label: 'a) Complete brief',
    description: 'Email with all seven sections. No web scan, no follow-ups.',
    previousResearch: true,
    original: {
      kind: 'text',
      label: 'Written brief (email)',
      from: client,
      receivedAt: '2026-10-06T14:12:00-04:00',
      text: completeEmail,
      textLabel: 'Email text',
    },
    extracted: completeSections,
    followUps: [],
  },
  {
    key: 'missing-context',
    label: 'b) Missing context',
    description: 'No brand, category or audience. Triggers a web scan and an audience suggestion.',
    previousResearch: false,
    original: {
      kind: 'text',
      label: 'Written brief (email)',
      from: client,
      receivedAt: '2026-10-06T14:12:00-04:00',
      text: shortEmail,
      textLabel: 'Email text',
    },
    extracted: missingContextSections,
    followUps: [],
  },
  {
    key: 'audio',
    label: 'c) Audio recording',
    description: 'Call recording with no objective and two sample sizes. Triggers transcription and follow-ups.',
    previousResearch: false,
    original: {
      kind: 'audio',
      label: 'Recorded discussion',
      fileName: 'verdane-kickoff-call.m4a',
      duration: '12:48',
      from: client,
      receivedAt: '2026-10-06T14:12:00-04:00',
      text: callTranscript,
      textLabel: 'Transcript',
    },
    extracted: audioSections,
    followUps: [
      {
        id: 'f-objective',
        kind: 'missing',
        section: 'objective',
        question: 'What should this research help Verdane decide?',
        detail: 'Erin said she needs to align with her director before confirming what to learn (06:45). I won’t write an objective without her.',
      },
      {
        id: 'f-sample',
        kind: 'conflict',
        section: 'sampleSize',
        question: 'How many completed interviews does Verdane need?',
        detail: 'Erin said 12 completed interviews at 04:02, then 20 at 09:30.',
        assumption: 'Use 20, the later figure. Erin gave it as the number needed to split results by skin type.',
        assumedText: '20 completed interviews, so results can split by skin type.',
      },
    ],
  },
]

export const sampleByKey = Object.fromEntries(briefSamples.map((s) => [s.key, s])) as Record<BriefSample['key'], BriefSample>
