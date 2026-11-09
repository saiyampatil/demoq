// Pre-written PulseAI drafts for the Report (A3), used as the seed for the AI draft.
// Every sentence cites a code or theme ID from src/mock/codebook.ts. The drawer resolves each one live,
// so a wrong ID shows as "not found" there and in the browser console.
// Denominators are honest: "n of N", never bare percentages. Behaviour is described, never diagnosed.
import type { Citation, Sentence } from '@/state/report'
import { CODE_QUESTIONS } from './codebook'

const c = (id: string): Citation => ({ kind: 'code', id })
const t = (id: string): Citation => ({ kind: 'theme', id })

export const EXEC_SUMMARY_AI: Sentence[] = [
  {
    id: 'exec-1',
    text: 'Price was the most common reason people cancelled: 7 of 20 accepted sessions mentioned a price rise, and 7 of 20 said flexibility mattered more than a lower price.',
    cites: [c('c-price-rise'), t('t-price'), c('c-flex-first'), c('c-price-first')],
  },
  {
    id: 'exec-2',
    text: 'The pause idea was the retention idea most people picked: 6 of 20 accepted sessions chose it.',
    cites: [c('c-idea-pause')],
  },
  {
    id: 'exec-3',
    text: 'For 2 of 20 accepted sessions, nothing the company could have done would have kept them. The reason to leave was outside its control.',
    cites: [c('c-nothing')],
  },
]

export const FINDING_DRAFTS: Record<string, Sentence[]> = {
  'q-start': [
    {
      id: 'q-start-1',
      text: 'People started the subscription so food would arrive before the bag ran empty, without a store run. 5 of 20 accepted sessions said this.',
      cites: [c('c-runout')],
    },
    {
      id: 'q-start-2',
      text: '4 of 20 accepted sessions hoped for better ingredients than store brands, with real meat and a short readable ingredients list.',
      cites: [c('c-ingredients')],
    },
  ],
  'q-cancel': [
    {
      id: 'q-cancel-1',
      text: '7 of 20 accepted sessions cancelled after one or more price rises made the box feel poor value. The second March increase was the tipping point for several.',
      cites: [c('c-price-rise'), t('t-price')],
    },
    {
      id: 'q-cancel-2',
      text: '6 of 20 accepted sessions said their pet stopped eating the food, with boredom or refusal after a month or so.',
      cites: [c('c-pet-refused'), t('t-pet')],
    },
    {
      id: 'q-cancel-3',
      text: '3 of 20 accepted sessions cancelled after a vet recommended a different diet that the subscription does not offer.',
      cites: [c('c-vet-diet')],
    },
  ],
  'q-keep': [
    {
      id: 'q-keep-1',
      text: '7 of 20 accepted sessions said an easy skip or pause would have kept them: a pause button they could use without contacting support.',
      cites: [c('c-skip-pause')],
    },
    {
      id: 'q-keep-2',
      text: '2 of 20 accepted sessions said nothing would have kept them. Once the vet said switch, or the pet needed food the company does not make, the decision was made.',
      cites: [c('c-nothing')],
    },
  ],
  'q-schedule': [
    {
      id: 'q-schedule-1',
      text: '4 of the 14 accepted sessions that were asked said a fixed delivery schedule clashed with travel or a changing appetite.',
      cites: [c('c-schedule-clash')],
    },
  ],
  'q-ideas': [
    {
      id: 'q-ideas-1',
      text: '6 of 20 accepted sessions picked the pause idea as the retention idea most likely to keep them.',
      cites: [c('c-idea-pause')],
    },
  ],
  'q-flex': [
    {
      id: 'q-flex-1',
      text: '7 of 20 accepted sessions said flexibility matters more than price. They would pay a bit more to control deliveries, and throwing food away felt like the real cost.',
      cites: [c('c-flex-first')],
    },
    {
      id: 'q-flex-2',
      text: '6 of 20 accepted sessions said price matters more: a lower price outweighs flexibility, especially after the second price rise.',
      cites: [c('c-price-first')],
    },
  ],
  // Nothing is coded under this question yet, so there is no AI draft. The card shows it as Unanswered.
  'q-back': [],
}

export const QUESTION_IDS: string[] = CODE_QUESTIONS.map((q) => q.id)