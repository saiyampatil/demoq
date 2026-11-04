// Mock "emerging patterns" for the Fieldwork Overview. Pre-written, tied to what the seeded interviews say (the quotes
// are lines from them). The people behind each pattern are picked from the study's finished interviews when it is shown,
// so "View N" always opens real sessions. There is no model behind this: it is always shown as AI-generated.

import { MOISTURIZER_ID } from './moisturizerStudy'
import { PET_ID } from './petFood'

export type Pattern = {
  id: string
  title: string
  summary: string
  /** A line from one of the interviews. */
  quote: string
  /** Share of finished interviews it was seen in, so the count follows the number of interviews. */
  share: number
  /** Where in the list of finished interviews the group starts, so different patterns involve different people. */
  from: number
}

const PATTERNS: Record<string, Pattern[]> = {
  [MOISTURIZER_ID]: [
    {
      id: 'refill',
      title: 'The refillable jar is liked, with a condition',
      summary: 'Most people who mention refills like the idea, but say it has to feel as good as the jar.',
      quote: 'The refill idea is nice, but it would have to feel as good as the jar.',
      share: 0.58,
      from: 0,
    },
    {
      id: 'claim',
      title: 'The 72-hour claim is met with doubt',
      summary: 'They have heard claims like it before and want proof it lasts all day.',
      quote: 'I’d try it if it really lasts all day. I’ve heard that claim before, though.',
      share: 0.5,
      from: 3,
    },
    {
      id: 'price',
      title: 'Price decides it for some',
      summary: 'Compared with what they use now, price is what tips the choice.',
      quote: 'Honestly the price would decide it for me.',
      share: 0.33,
      from: 6,
    },
    {
      id: 'texture',
      title: 'A light texture matters more than the claims',
      summary: 'Gel-cream users care how it feels by midday more than what the pack promises.',
      quote: 'Mostly a gel-cream, morning and night. It’s lightweight, which I like.',
      share: 0.25,
      from: 1,
    },
  ],
  [PET_ID]: [
    {
      id: 'price-rise',
      title: 'The price rise was the trigger',
      summary: 'Most people started looking around after the price went up.',
      quote: 'The price went up twice in six months, and that was when I started looking around.',
      share: 0.45,
      from: 0,
    },
    {
      id: 'skipping',
      title: 'Skipping a box was too hard',
      summary: 'People would have stayed if pausing had been easy.',
      quote: 'I’d have stayed if I could have skipped a box without a fight.',
      share: 0.35,
      from: 4,
    },
    {
      id: 'fussy',
      title: 'Pets got bored of the recipe',
      summary: 'Swapping recipes felt like a hassle, so they left instead.',
      quote: 'Biscuit got bored of the chicken after a few weeks, and the swap was a hassle.',
      share: 0.25,
      from: 8,
    },
  ],
}

/** The patterns for a study, each with the finished interviews it was seen in. Empty for a study with none. */
export function emergingPatterns(studyId: string, people: string[]) {
  const total = people.length
  return (PATTERNS[studyId] ?? []).map((p) => {
    const n = Math.min(total, Math.max(1, Math.round(p.share * total)))
    const ids = Array.from({ length: n }, (_, i) => people[(p.from + i) % total])
    return { ...p, people: ids }
  })
}
