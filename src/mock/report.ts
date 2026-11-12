// Pre-written PulseAI drafts for the Report (A3), used as the seed for the AI draft.
// Every sentence cites a code or theme ID from src/mock/codebook.ts, and its numbers are live tokens, not typed digits:
//   {n:ID} of {of:ID}  the people who said a code (or theme, or tension) and the people it is counted against
//   {N}                the accepted sessions the report is built on
// state/reportLogic.ts fills them in from the codebook every time, so a number can never be out of step with A1 and A2.
// Denominators are honest: "n of N", never bare percentages. Behaviour is described, never diagnosed.
import type { Citation, Sentence } from '@/state/report'
import { CODE_QUESTIONS } from './codebook'

const c = (id: string): Citation => ({ kind: 'code', id })
const t = (id: string): Citation => ({ kind: 'theme', id })

/** A seed sentence: `text` is filled in from the template when the report is made. */
export type SeedSentence = Omit<Sentence, 'text'> & { template: string }

export const EXEC_SUMMARY_AI: SeedSentence[] = [
  {
    id: 'exec-1',
    template: 'Price rises were a leading reason people cancelled: {n:c-price-rise} of {of:c-price-rise} people mentioned one, and {n:c-flex-first} of {of:c-flex-first} said flexibility mattered more to them than a lower price.',
    cites: [c('c-price-rise'), t('t-price'), c('c-flex-first')],
  },
  {
    id: 'exec-2',
    template: 'The pause idea was the retention idea most people picked: {n:c-idea-pause} of {of:c-idea-pause} chose it.',
    cites: [c('c-idea-pause')],
  },
  {
    id: 'exec-3',
    template: 'For {n:c-nothing} of {of:c-nothing} people, nothing the company could have done would have kept them. The reason to leave was outside its control.',
    cites: [c('c-nothing')],
  },
]

export const FINDING_DRAFTS: Record<string, SeedSentence[]> = {
  'q-start': [
    {
      id: 'q-start-1',
      template: 'People started the subscription so food would arrive before the bag ran empty, without a store run. {n:c-runout} of {of:c-runout} people said this.',
      cites: [c('c-runout')],
    },
    {
      id: 'q-start-2',
      template: '{n:c-ingredients} of {of:c-ingredients} people hoped for better ingredients than store brands, with real meat and a short readable ingredients list.',
      cites: [c('c-ingredients')],
    },
  ],
  'q-cancel': [
    {
      id: 'q-cancel-1',
      template: '{n:c-price-rise} of {of:c-price-rise} people cancelled after one or more price rises made the box feel poor value. The second March increase was the tipping point for several.',
      cites: [c('c-price-rise'), t('t-price')],
    },
    {
      id: 'q-cancel-2',
      template: '{n:c-pet-refused} of {of:c-pet-refused} people said their pet stopped eating the food, with boredom or refusal after a month or so.',
      cites: [c('c-pet-refused'), t('t-pet')],
    },
    {
      id: 'q-cancel-3',
      template: '{n:c-vet-diet} of {of:c-vet-diet} people cancelled after a vet recommended a different diet that the subscription does not offer.',
      cites: [c('c-vet-diet')],
    },
  ],
  'q-keep': [
    {
      id: 'q-keep-1',
      template: '{n:c-skip-pause} of {of:c-skip-pause} people said an easy skip or pause would have kept them: a pause button they could use without contacting support.',
      cites: [c('c-skip-pause')],
    },
    {
      id: 'q-keep-2',
      template: '{n:c-nothing} of {of:c-nothing} people said nothing would have kept them. Once the vet said switch, or the pet needed food the company does not make, the decision was made.',
      cites: [c('c-nothing')],
    },
  ],
  'q-schedule': [
    {
      id: 'q-schedule-1',
      template: '{n:c-schedule-clash} of the {of:c-schedule-clash} people who were asked said a fixed delivery schedule clashed with travel or a changing appetite.',
      cites: [c('c-schedule-clash')],
    },
  ],
  'q-ideas': [
    {
      id: 'q-ideas-1',
      template: '{n:c-idea-pause} of {of:c-idea-pause} people picked the pause idea as the retention idea most likely to keep them.',
      cites: [c('c-idea-pause')],
    },
  ],
  'q-flex': [
    {
      id: 'q-flex-1',
      template: '{n:c-flex-first} of {of:c-flex-first} people said flexibility matters more than price. They would pay a bit more to control deliveries, and throwing food away felt like the real cost.',
      cites: [c('c-flex-first')],
    },
    {
      id: 'q-flex-2',
      template: '{n:c-price-first} of {of:c-price-first} people said price matters more: a lower price outweighs flexibility, especially after the second price rise.',
      cites: [c('c-price-first')],
    },
  ],
  // Only one accepted code sits under this question, and not everyone was asked it, so the finding is Weak.
  'q-back': [
    {
      id: 'q-back-1',
      template: '{n:c-stable-price} of {of:c-stable-price} people who were asked said a price that is locked, or changes rarely, would bring them back.',
      cites: [c('c-stable-price')],
    },
  ],
}

export const QUESTION_IDS: string[] = CODE_QUESTIONS.map((q) => q.id)

/** The guide's sections in order, each with its questions. The report's findings are grouped the same way. */
export const REPORT_SECTIONS: { id: string; label: string; questionIds: string[] }[] = (() => {
  const out: { id: string; label: string; questionIds: string[] }[] = []
  CODE_QUESTIONS.forEach((q) => {
    const s = out.find((x) => x.label === q.section)
    if (s) s.questionIds.push(q.id)
    else out.push({ id: `sec-${out.length + 1}`, label: q.section, questionIds: [q.id] })
  })
  return out
})()
