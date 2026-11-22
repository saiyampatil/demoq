// In-session surveys: a title and an ordered list of questions, each with fixed wording and predefined answers (PRD 4.4).
// The types live here so the seeds, the guide state and Review can all read them without importing each other.

export type SurveyFormat = 'single' | 'multiple' | 'rating'

export const FORMAT_LABEL: Record<SurveyFormat, string> = { single: 'Single choice', multiple: 'Multiple choice', rating: 'Rating scale' }
/** How a participant is asked, in the words they'd see. */
export const FORMAT_HINT: Record<SurveyFormat, string> = { single: 'Pick one', multiple: 'Select all that apply', rating: 'Pick a number' }

export type SurveyQuestion = {
  id: string
  text: string
  format: SurveyFormat
  /** Single and multiple choice: the answers. Rating scale: '1' up to the number of points, so every format reads the same downstream. */
  options: string[]
  /** Rating scale only: what the two ends mean. */
  scale?: { low: string; high: string }
}

export type SurveyDef = { title: string; questions: SurveyQuestion[] }

/** Mock limits. Not in the PRD (docs/OPEN_QUESTIONS.md). */
export const SURVEY_LIMITS = { questions: 8, minOptions: 2, maxOptions: 8, scalePoints: [5, 7] as const }

export const ratingOptions = (points: number) => Array.from({ length: points }, (_, i) => String(i + 1))

const choice = (id: string, text: string, options: string[], format: 'single' | 'multiple' = 'single'): SurveyQuestion => ({ id, text, format, options })
const rating = (id: string, text: string, low: string, high: string, points = 5): SurveyQuestion => ({ id, text, format: 'rating', options: ratingOptions(points), scale: { low, high } })

const LIKELY = ['Definitely would not', 'Probably would not', 'Might or might not', 'Probably would', 'Definitely would']

/** A survey as a library item. The title is the item's name, and the summary is its detail line. */
export const surveySummary = (qs: SurveyQuestion[]) => `${qs.length} ${qs.length === 1 ? 'question' : 'questions'}`
export const surveyItem = (id: string, def: SurveyDef, addedAt: string, addedBy: string) => ({
  id,
  name: def.title,
  kind: 'survey' as const,
  detail: surveySummary(def.questions),
  questions: def.questions,
  active: true,
  addedAt,
  addedBy,
})

// Moisturizer Concept Study
export const SKIN_SURVEYS: Record<'reaction' | 'scent', SurveyDef> = {
  reaction: {
    title: 'Concept reaction',
    questions: [
      choice('q1', 'After seeing the concept, how likely would you be to buy it?', LIKELY),
      rating('q2', 'How appealing is this concept to you?', 'Not at all appealing', 'Very appealing'),
    ],
  },
  scent: {
    title: 'Scent preference',
    questions: [
      choice('q1', 'Which scent direction do you prefer?', ['Fragrance-free', 'Light floral', 'Fresh citrus', 'Soft musk']),
      choice('q2', 'Which others would you also consider?', ['Fragrance-free', 'Light floral', 'Fresh citrus', 'Soft musk'], 'multiple'),
    ],
  },
}

// Pet Food Subscription Churn
export const PET_SURVEYS: Record<'keep' | 'reason', SurveyDef> = {
  keep: {
    title: 'Retention idea reaction',
    questions: [
      choice('q1', 'After seeing this idea, how likely would you be to keep, or restart, a pet food subscription?', LIKELY),
      rating('q2', 'How appealing is this idea to you?', 'Not at all appealing', 'Very appealing'),
    ],
  },
  reason: {
    title: 'Why they cancelled',
    questions: [
      choice('q1', 'Which one reason mattered most when you cancelled?', ['The price went up', 'My pet stopped eating it', 'Delivery problems', 'I switched to a vet or store brand', 'Too much food piled up', 'Something else']),
      choice('q2', 'Which other reasons played a part?', ['The price went up', 'My pet stopped eating it', 'Delivery problems', 'I switched to a vet or store brand', 'Too much food piled up', 'Something else'], 'multiple'),
    ],
  },
}

// Ice Cream Flavour Concept Test
export const ICE_SURVEYS: Record<'reaction' | 'occasion', SurveyDef> = {
  reaction: {
    title: 'Flavour reaction',
    questions: [
      choice('q1', 'Thinking about the flavour you liked best of the three, how likely would you be to buy a tub when it is in stores?', LIKELY),
      rating('q2', 'How appealing is that flavour to you?', 'Not at all appealing', 'Very appealing'),
    ],
  },
  occasion: {
    title: 'When they would eat it',
    questions: [
      choice('q1', 'When would you most likely eat this ice cream?', ['After dinner at home', 'As a treat for myself', 'With the family at the weekend', 'At a party or get-together', 'On a hot day', 'Something else']),
      choice('q2', 'Which other times would you also eat it?', ['After dinner at home', 'As a treat for myself', 'With the family at the weekend', 'At a party or get-together', 'On a hot day', 'Something else'], 'multiple'),
    ],
  },
}

/** A deterministic answer for a mock respondent, so seeds read the same every time. Multiple choice picks two. */
export function mockAnswer(q: SurveyQuestion, n: number): string {
  const o = q.options
  if (q.format === 'multiple') return o.length > 2 ? [o[n % o.length], o[(n + 2) % o.length]].join('; ') : o[n % o.length]
  return o[n % o.length]
}

/**
 * What each accepted Pet Food participant locked in the two surveys. It follows what they said in the interview
 * (src/mock/codebook.ts), so a survey answer and the same person's quotes never contradict each other by accident.
 */
const PET_ANSWERS: Record<string, { keep: string; appeal: string; reason: string; others: string[] }> = {
  'P-3101': { keep: 'Might or might not', appeal: '3', reason: 'The price went up', others: ['My pet stopped eating it'] },
  'P-3102': { keep: 'Probably would not', appeal: '2', reason: 'Too much food piled up', others: ['The price went up'] },
  'P-3103': { keep: 'Probably would not', appeal: '2', reason: 'The price went up', others: ['My pet stopped eating it'] },
  'P-3104': { keep: 'Probably would', appeal: '4', reason: 'Too much food piled up', others: ['Delivery problems'] },
  'P-3105': { keep: 'Probably would', appeal: '5', reason: 'Too much food piled up', others: ['The price went up'] },
  'P-3106': { keep: 'Might or might not', appeal: '3', reason: 'The price went up', others: ['Something else'] },
  'P-3107': { keep: 'Definitely would not', appeal: '1', reason: 'I switched to a vet or store brand', others: ['The price went up'] },
  'P-3108': { keep: 'Probably would', appeal: '4', reason: 'My pet stopped eating it', others: ['Too much food piled up'] },
  'P-3109': { keep: 'Definitely would', appeal: '5', reason: 'Too much food piled up', others: ['The price went up'] },
  'P-3110': { keep: 'Probably would not', appeal: '2', reason: 'The price went up', others: ['My pet stopped eating it'] },
  'P-3111': { keep: 'Might or might not', appeal: '3', reason: 'My pet stopped eating it', others: ['Something else'] },
  'P-3113': { keep: 'Probably would not', appeal: '3', reason: 'Too much food piled up', others: ['The price went up'] },
  'P-3114': { keep: 'Might or might not', appeal: '3', reason: 'The price went up', others: ['Too much food piled up'] },
  'P-3115': { keep: 'Definitely would not', appeal: '1', reason: 'I switched to a vet or store brand', others: ['Something else'] },
  'P-3116': { keep: 'Probably would', appeal: '4', reason: 'My pet stopped eating it', others: ['Something else'] },
  'P-3117': { keep: 'Probably would not', appeal: '2', reason: 'The price went up', others: ['I switched to a vet or store brand'] },
  'P-3118': { keep: 'Might or might not', appeal: '4', reason: 'Too much food piled up', others: ['The price went up'] },
  'P-3120': { keep: 'Probably would not', appeal: '2', reason: 'The price went up', others: ['Too much food piled up'] },
  'P-3121': { keep: 'Probably would not', appeal: '3', reason: 'Too much food piled up', others: ['The price went up'] },
  'P-3122': { keep: 'Probably would', appeal: '4', reason: 'Too much food piled up', others: ['The price went up'] },
}

/**
 * What each accepted Ice Cream participant locked in the two surveys. It follows what they said in the interview
 * (src/mock/iceCream/codebook.ts), so a survey answer and the same person's quotes never contradict each other by accident.
 * `appeal` and `keep` are about the flavour they liked best; `main` and `others` are the times they would eat it.
 */
const ICE_ANSWERS: Record<string, { keep: string; appeal: string; main: string; others: string[] }> = {
  'P-4101': { keep: 'Probably would', appeal: '4', main: 'As a treat for myself', others: ['After dinner at home'] },
  'P-4102': { keep: 'Definitely would', appeal: '5', main: 'With the family at the weekend', others: ['After dinner at home'] },
  'P-4103': { keep: 'Probably would', appeal: '4', main: 'On a hot day', others: ['As a treat for myself'] },
  'P-4104': { keep: 'Definitely would', appeal: '5', main: 'With the family at the weekend', others: ['At a party or get-together'] },
  'P-4105': { keep: 'Probably would', appeal: '4', main: 'After dinner at home', others: ['With the family at the weekend'] },
  'P-4106': { keep: 'Probably would not', appeal: '3', main: 'As a treat for myself', others: ['After dinner at home'] },
  'P-4107': { keep: 'Definitely would', appeal: '5', main: 'After dinner at home', others: ['With the family at the weekend'] },
  'P-4108': { keep: 'Probably would', appeal: '4', main: 'On a hot day', others: ['At a party or get-together'] },
  'P-4109': { keep: 'Probably would', appeal: '4', main: 'With the family at the weekend', others: ['On a hot day'] },
  'P-4110': { keep: 'Probably would', appeal: '4', main: 'As a treat for myself', others: ['After dinner at home'] },
  'P-4111': { keep: 'Might or might not', appeal: '3', main: 'After dinner at home', others: ['Something else'] },
  'P-4113': { keep: 'Definitely would', appeal: '5', main: 'On a hot day', others: ['At a party or get-together'] },
  'P-4114': { keep: 'Definitely would', appeal: '5', main: 'With the family at the weekend', others: ['As a treat for myself'] },
  'P-4115': { keep: 'Probably would', appeal: '4', main: 'As a treat for myself', others: ['At a party or get-together'] },
  'P-4116': { keep: 'Might or might not', appeal: '3', main: 'At a party or get-together', others: ['On a hot day'] },
  'P-4117': { keep: 'Probably would', appeal: '4', main: 'With the family at the weekend', others: ['After dinner at home'] },
  'P-4118': { keep: 'Probably would not', appeal: '3', main: 'After dinner at home', others: ['As a treat for myself'] },
  'P-4120': { keep: 'Probably would', appeal: '4', main: 'On a hot day', others: ['As a treat for myself'] },
  'P-4121': { keep: 'Probably would not', appeal: '3', main: 'After dinner at home', others: ['With the family at the weekend'] },
  'P-4122': { keep: 'Probably would', appeal: '4', main: 'As a treat for myself', others: ['After dinner at home'] },
}

/** A participant's locked answer to one survey question. Pet Food and Ice Cream answers are authored above; other studies get a deterministic one. */
export function surveyAnswerFor(participantId: string, surveyTitle: string, q: SurveyQuestion): string {
  const a = PET_ANSWERS[participantId]
  if (a) {
    if (surveyTitle === PET_SURVEYS.keep.title) return q.id === 'q1' ? a.keep : a.appeal
    if (surveyTitle === PET_SURVEYS.reason.title) return q.id === 'q1' ? a.reason : a.others.join('; ')
  }
  const ice = ICE_ANSWERS[participantId]
  if (ice) {
    if (surveyTitle === ICE_SURVEYS.reaction.title) return q.id === 'q1' ? ice.keep : ice.appeal
    if (surveyTitle === ICE_SURVEYS.occasion.title) return q.id === 'q1' ? ice.main : ice.others.join('; ')
  }
  const num = Number(participantId.replace(/\D/g, '')) || 0
  return mockAnswer(q, num + surveyTitle.length)
}
