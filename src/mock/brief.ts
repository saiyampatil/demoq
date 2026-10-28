// Seed brief content for the Moisturizer Concept Study.
// Phase 1 (R1, R4, R5) builds the full 10-section editor on top of this.

export type SourceTag = 'Client input' | 'AI-generated' | 'Researcher edit'

/** The client's original input, kept unchanged beside the generated brief. */
export const originalInput = {
  kind: 'Written brief (email)',
  receivedAt: '2026-10-06T14:12:00-04:00',
  from: 'Erin Walsh, Verdane Skincare',
  text: `Hi Maya,

As discussed, we're getting ready to test the next HydraVeil product before we commit to packaging. Working name is HydraVeil 72h, a gel-cream moisturizer with a ceramide + squalane barrier complex. We have three directions we want to put in front of people:

A) "Barrier Repair": clinical, dermatologist-developed, 72-hour hydration claim
B) "Overnight Cushion": sensorial, sleep-mask texture, wake-up-glowing story
C) "Clean Refill": same formula, refillable glass jar, refill pods at $6 less

Main thing we need to know: which direction makes dry and combination-skin women actually want to switch from what they use now, and what would stop them. We'd also love to understand whether the refill idea reads as premium or as cheap.

Target is US women roughly 25 to 44 who moisturize daily. We'd like 12 completed interviews, ideally split by skin type. Need findings by mid-December for the January range review.

Thanks!
Erin`,
}

export const briefSections = [
  {
    key: 'researchQuestion',
    title: 'Research question',
    source: 'Client input' as SourceTag,
    body: 'Which of the three HydraVeil 72h concept directions most motivates US women with dry or combination skin to switch from their current daily moisturizer, and what are the barriers to switching?',
  },
  {
    key: 'objectives',
    title: 'Research objectives',
    source: 'Researcher edit' as SourceTag,
    body: [
      'Understand current moisturizing routines, product choices and unmet needs for dry and combination skin.',
      'Capture unprompted reactions to each concept (Barrier Repair, Overnight Cushion, Clean Refill) before any explanation.',
      'Identify which concept drives the strongest intent to switch, and why.',
      'Surface barriers to switching, including price, texture and trust in claims.',
      'Learn whether the refill format reads as premium, practical or cheap.',
    ],
  },
  {
    key: 'brandContext',
    title: 'Brand and category context',
    source: 'AI-generated' as SourceTag,
    body: 'Verdane Skincare is a mid-priced US skincare brand sold through Target, Ulta and its own site. The facial moisturizer category is crowded, with dermatologist-backed brands leading on claims and indie brands leading on texture and sustainability. Refillable formats are growing in prestige skincare but remain rare at mid-price points.',
  },
  {
    key: 'targetAudience',
    title: 'Target audience',
    source: 'Client input' as SourceTag,
    body: 'US women aged 25–44 with self-described dry or combination skin who use a facial moisturizer at least once a day.',
  },
  {
    key: 'previousResearch',
    title: 'Previous research',
    source: 'Client input' as SourceTag,
    body: 'None provided in the input.',
  },
]
