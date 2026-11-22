// What the Report, the executive summary, the audio summary and the showreel say for Ice Cream Flavour Concept Test (Scoop & Co).
// The story is in docs/ICE_CREAM_STORY.md. Like Pet Food's, every finding cites accepted codes or themes, and its numbers are live
// tokens ({n:ID} of {of:ID}), so a number can never be out of step with A1 and A2. The AI states findings only, never advice:
// the "which flavour first" answer is the pick counts, said plainly, and the Researcher draws the conclusion.
import type { Citation } from '@/state/report'
import { registerReportPack, type SeedSentence } from '../reportPacks'

const c = (id: string): Citation => ({ kind: 'code', id })
const t = (id: string): Citation => ({ kind: 'theme', id })

export const ICE_STUDY = 'ice-cream-flavours'

const FINDINGS: Record<string, SeedSentence[]> = {
  'iq-habit': [
    {
      id: 'iq-habit-1',
      template: '{n:ic-weekly-tub} of {of:ic-weekly-tub} people buy a tub of ice cream every week, as part of the regular shop.',
      cites: [c('ic-weekly-tub')],
    },
    {
      id: 'iq-habit-2',
      template: '{n:ic-kids-decide} of {of:ic-kids-decide} people said the children at home pick the flavour.',
      cites: [c('ic-kids-decide'), t('t-family')],
    },
  ],
  'iq-choose': [
    {
      id: 'iq-choose-1',
      template: '{n:ic-stick-usual} of {of:ic-stick-usual} people said they go back to their usual flavour after trying something new, often vanilla or chocolate chip.',
      cites: [c('ic-stick-usual'), t('t-familiar')],
    },
    {
      id: 'iq-choose-2',
      template: '{n:ic-try-new} of {of:ic-try-new} people said they like to try something new now and then.',
      cites: [c('ic-try-new')],
    },
  ],
  'iq-pick': [
    {
      id: 'iq-pick-1',
      template: '{n:ic-pick-caramel} of {of:ic-pick-caramel} people would buy Salted Caramel Swirl first. No other flavour was picked by more people.',
      cites: [c('ic-pick-caramel'), t('t-familiar')],
    },
    {
      id: 'iq-pick-2',
      template: '{n:ic-pick-cookie} of {of:ic-pick-cookie} people would buy Cookie Dough Crunch first, most of them parents choosing a flavour the whole family will eat.',
      cites: [c('ic-pick-cookie'), t('t-family')],
    },
    {
      id: 'iq-pick-3',
      template: '{n:ic-pick-mango} of {of:ic-pick-mango} people would buy Mango Lassi first, the smallest group of the three.',
      cites: [c('ic-pick-mango'), t('t-tn-mango')],
    },
  ],
  'iq-stop': [
    {
      id: 'iq-stop-1',
      template: '{n:ic-kids-wont} of {of:ic-kids-wont} people said the children at home would not eat it. They were ruling out Mango Lassi.',
      cites: [c('ic-kids-wont'), t('t-family')],
    },
    {
      id: 'iq-stop-2',
      template: '{n:ic-sweet-worry} of {of:ic-sweet-worry} people worried a flavour would be too sweet.',
      cites: [c('ic-sweet-worry')],
    },
    {
      id: 'iq-stop-3',
      template: '{n:ic-nothing-stop} of {of:ic-nothing-stop} people said nothing would stop them buying it.',
      cites: [c('ic-nothing-stop')],
    },
  ],
  // Not everyone was asked what they would pay, so the finding is Weak.
  'iq-price': [
    {
      id: 'iq-price-1',
      template: '{n:ic-pay-five-six} of the {of:ic-pay-five-six} people who were asked expected to pay about five to six dollars for a tub.',
      cites: [c('ic-pay-five-six')],
    },
  ],
  // An optional question that several people were not asked, so the finding is Weak.
  'iq-when': [
    {
      id: 'iq-when-1',
      template: '{n:ic-when-weekend} of the {of:ic-when-weekend} people who were asked would eat it as a weekend treat for the family.',
      cites: [c('ic-when-weekend'), t('t-family')],
    },
  ],
  'iq-change': [
    {
      id: 'iq-change-1',
      template: '{n:ic-less-sweet} of {of:ic-less-sweet} people said they would make the flavour they liked best less sweet.',
      cites: [c('ic-less-sweet')],
    },
  ],
}

registerReportPack({
  studyId: ICE_STUDY,
  findingDrafts: FINDINGS,
  stimulusOfCode: { 'ic-pick-caramel': 'Concept A', 'ic-caramel-safe': 'Concept A', 'ic-pick-mango': 'Concept B', 'ic-mango-different': 'Concept B', 'ic-lassi-unclear': 'Concept B', 'ic-explain-lassi': 'Concept B', 'ic-pick-cookie': 'Concept C', 'ic-cookie-family': 'Concept C' },
  regenerateExample: 'More from parents, or Shorter',
  highlightExamples: ['too sweet', 'what a lassi is', 'the kids'],
  focusExample: 'start with the safe choice',
  tensions: {
    'tn-caramel-survey': {
      exec: (s) => `${s(1)} people who picked Salted Caramel Swirl answered “probably would not” or “definitely would not” in the locked survey.`,
      audio: (n, of) => `${n} of ${of} people who picked Salted Caramel Swirl answered “probably would not” or “definitely would not” in the locked survey.`,
      alts: (n, of) => [`In the locked survey, ${n} of ${of} people who picked Salted Caramel Swirl answered “probably would not” or “definitely would not”.`],
    },
    'tn-caramel-mango-face': {
      exec: (s) => `${s(1)} people on video who picked Salted Caramel Swirl showed delight or interest at first sight of Mango Lassi.`,
      audio: (n, of) => `${n} of ${of} people on video who picked Salted Caramel Swirl read as delight or interest at first sight of Mango Lassi.`,
      alts: (n, of) => [`At first sight of Mango Lassi, ${n} of ${of} people on video who picked Salted Caramel Swirl read as delight or interest.`],
      faceBased: true,
    },
    // Parents against adults without children: the share who chose Cookie Dough Crunch. Sides: [parents cookie, parents mango, adults cookie, adults mango].
    'tn-segments': {
      exec: (s, sides) => {
        const [parents, , adults] = sides
        if (!parents || !adults) return undefined
        const p = parents.of ? parents.n / parents.of : 0
        const a = adults.of ? adults.n / adults.of : 0
        if (p === a) return undefined
        return p > a ? `${s(0)} parents chose Cookie Dough Crunch first, a larger share than adults without children.` : `${s(2)} adults without children chose Cookie Dough Crunch first, a larger share than parents.`
      },
      nums: (sides) => {
        const [parents, , adults] = sides
        if (!parents || !adults || !parents.of || !adults.of || parents.n / parents.of === adults.n / adults.of) return undefined
        return parents.n / parents.of > adults.n / adults.of ? { n: parents.n, of: parents.of } : { n: adults.n, of: adults.of }
      },
      audio: (n, of, sides) => {
        const parentsLead = !!sides[0] && !!sides[2] && sides[0].of > 0 && sides[2].of > 0 && sides[0].n / sides[0].of > sides[2].n / sides[2].of
        return `${n} of ${of} ${parentsLead ? 'parents' : 'adults without children'} chose Cookie Dough Crunch first, a larger share than ${parentsLead ? 'adults without children' : 'parents'}.`
      },
    },
    'tn-mango-concept': {
      exec: (s) => `${s(1)} people who chose Mango Lassi showed marked hesitation at first sight of it.`,
      audio: (n, of) => `${n} of ${of} people who chose Mango Lassi showed marked hesitation at first sight of it.`,
      alts: (n, of) => [`At first sight of Mango Lassi, ${n} of ${of} people who chose it showed marked hesitation.`],
    },
    'tn-price-survey': {
      exec: (s) => `${s(1)} people who said a high price would stop them answered “probably would” or “definitely would” in the survey.`,
      audio: (n, of) => `${n} of ${of} people who said a high price would stop them answered “probably would” or “definitely would” in the locked survey.`,
      alts: (n, of) => [`In the locked survey, ${n} of ${of} people who said a high price would stop them answered “probably would” or “definitely would”.`],
    },
  },
})
