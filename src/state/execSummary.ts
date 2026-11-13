// The AI draft of the executive summary, built from the codebook, the tensions and Review every time. Findings only.
// At most six sentences, in this order; a sentence is left out when its data doesn't exist:
//   1 the main reason people cancelled   2 price against flexibility (or the next reason)   3 what would have kept them
//   4 people nothing would have kept     5 one for each tension the Researcher ADDED as a tension theme   6 where the evidence is thin
// Numbers are live tokens (see renderTemplate), so they can't drift from A1 and A2. The rules below are enforced here and by the tests:
// one claim and one "n of N" per sentence (the close-to-even one may carry two), at most 25 words, no percentages, "most" only
// for more than half, and nothing implied about the people who gave no clear answer.
import type { SeedSentence } from '@/mock/report'
import { CODE_QUESTIONS, denominator, peopleOf, tensionDecisions, type Basis, type Code, type CodebookDoc } from './codebook'
import { strengthFor, type Ctx } from './reportLogic'
import { tensionsOf } from './signals'
import type { Citation } from './report'

export const MAX_SENTENCES = 6
export const MAX_WORDS = 25

const code = (id: string): Citation => ({ kind: 'code', id })
const accepted = (doc: CodebookDoc, id: string) => doc.codes.find((c) => c.id === id && c.status === 'Accepted')
const acceptedUnder = (doc: CodebookDoc, questionId: string) => doc.codes.filter((c) => c.questionId === questionId && c.status === 'Accepted')
const people = (c: Code, basis: Basis) => peopleOf(c, basis).size
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const words = (s: string) => s.trim().split(/\s+/).length

/** Codes by distinct people, most first. */
function ranked(list: Code[], basis: Basis) {
  return list.map((c) => ({ c, n: people(c, basis) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.c.name.localeCompare(b.c.name))
}

/** The plurality of a ranked list, in words that follow the "most" rule. */
function leader(list: { c: Code; n: number }[], of: number, kind: 'reason' | 'idea'): { template: string; cites: Citation[] } | undefined {
  if (!list.length) return undefined
  const top = list[0]
  const tied = list.filter((x) => x.n === top.n)
  const tok = `{n:${top.c.id}} of {of:${top.c.id}}`
  const majority = top.n * 2 > of
  if (tied.length > 1) {
    const names = tied.slice(0, 2).map((x) => `“${x.c.name}”`).join(' and ')
    return { template: kind === 'reason' ? `${names} were tied as the most often given reason for cancelling, each with ${tok} people.` : `${names} were tied as the idea picked most often, each by ${tok} people.`, cites: tied.slice(0, 2).map((x) => code(x.c.id)) }
  }
  if (kind === 'reason') {
    return { template: majority ? `Most people cancelled for one reason, “${top.c.name}”: ${tok} people.` : `The most often given reason for cancelling was “${top.c.name}”: ${tok} people.`, cites: [code(top.c.id)] }
  }
  if (list.length === 1) return { template: majority ? `Most people said ${lowerFirst(top.c.name)}: ${tok}.` : `${tok} people said ${lowerFirst(top.c.name)}.`, cites: [code(top.c.id)] }
  return { template: majority ? `Most people picked “${top.c.name}” as the idea to keep them: ${tok}.` : `The idea picked most often was “${top.c.name}”: ${tok} people.`, cites: [code(top.c.id)] }
}

/** Sentence for a tension the Researcher added as a theme, one claim, one figure. Undefined when there is nothing true to say. */
function tensionSentence(id: string, sides: { n: number; of: number }[]): string | undefined {
  const s = (i: number) => `{side:${id}:${i}:n} of {side:${id}:${i}:of}`
  switch (id) {
    case 'tn-pause-survey':
      return `${s(1)} people who picked pause answered “probably” or “definitely would not” in the locked survey.`
    case 'tn-flex-behaviour':
      return `${s(1)} people who said flexibility matters more than price showed marked hesitation as they said it.`
    case 'tn-pause-portion-face':
      return `${s(1)} people on video who picked pause showed delight or interest at first sight of Concept C.`
    case 'tn-pause-concept':
      return `${s(1)} people who chose pause showed marked hesitation at first sight of Concept A.`
    case 'tn-vet-survey':
      return `${s(1)} people who said a vet’s advice ended it named something else as their one biggest reason in the survey.`
    case 'tn-pet-segments': {
      const [cat, , dog] = sides
      const c = cat.of ? cat.n / cat.of : 0
      const d = dog.of ? dog.n / dog.of : 0
      if (c === d) return undefined
      return c > d ? `${s(0)} cat owners said flexibility matters more than price, a larger share than dog owners.` : `${s(2)} dog owners said flexibility matters more than price, a larger share than cat owners.`
    }
    default:
      return undefined
  }
}

export function execDraft({ doc, basis }: Ctx): SeedSentence[] {
  const N = basis.participants.size
  const out: SeedSentence[] = []
  const add = (id: string, template: string, cites: Citation[]) => out.push({ id, template, cites })

  // 1. The main reason people cancelled: the most often given of the approved reasons.
  const reasons = ranked(acceptedUnder(doc, 'q-cancel'), basis)
  const first = leader(reasons, N, 'reason')
  if (first) add('exec-reason', first.template, first.cites)

  // 2. Price against flexibility. Within one person of each other, it says so, gives both and says how many gave no clear answer.
  const flex = accepted(doc, 'c-flex-first')
  const price = accepted(doc, 'c-price-first')
  const f = flex ? people(flex, basis) : 0
  const p = price ? people(price, basis) : 0
  if (flex && price && f + p > 0) {
    if (Math.abs(f - p) <= 1) add('exec-second', `Flexibility and price were close to even: {n:c-flex-first} of {of:c-flex-first} chose flexibility, {n:c-price-first} of {of:c-price-first} chose price, and {none:c-flex-first,c-price-first} gave no clear answer.`, [code('c-flex-first'), code('c-price-first')])
    else {
      const top = f > p ? flex : price
      const n = Math.max(f, p)
      const tok = `{n:${top.id}} of {of:${top.id}}`
      add('exec-second', n * 2 > denominator(top, basis) ? `Most people said ${f > p ? 'flexibility matters more than a lower price' : 'a lower price matters more than flexibility'}: ${tok}.` : `The largest group said ${f > p ? 'flexibility matters more than a lower price' : 'a lower price matters more than flexibility'}: ${tok} people.`, [code(top.id)])
    }
  } else if (reasons.length > 1) {
    const next = reasons[1]
    add('exec-second', `The next most often given reason was “${next.c.name}”: {n:${next.c.id}} of {of:${next.c.id}} people.`, [code(next.c.id)])
  }

  // 3. What would have kept them: the idea picked most often.
  const keep = leader(ranked(acceptedUnder(doc, 'q-ideas'), basis), N, 'idea') ?? leader(ranked(acceptedUnder(doc, 'q-keep').filter((c) => c.id !== 'c-nothing'), basis), N, 'idea')
  if (keep) add('exec-keep', keep.template, keep.cites)

  // 4. People nothing would have kept.
  const nothing = accepted(doc, 'c-nothing')
  if (nothing && people(nothing, basis) > 0) add('exec-nothing', 'For {n:c-nothing} of {of:c-nothing} people, nothing the company could have done would have kept them.', [code('c-nothing')])

  // 6 is last, so work out whether it exists first and keep a place for it.
  const weak = CODE_QUESTIONS.filter((q) => {
    const codes = acceptedUnder(doc, q.id)
    const n = new Set(codes.flatMap((c) => [...peopleOf(c, basis)])).size
    const notAsked = q.skipped.filter((s) => basis.participants.has(s.participantId)).length
    return strengthFor(n, notAsked > 0) !== 'Strong'
  })
  let thin: SeedSentence | undefined
  if (weak.length) {
    const head = `Evidence is thin on ${weak.length} of ${CODE_QUESTIONS.length} guide questions:`
    let names = weak.map((q) => `“${q.label}”`)
    // Keep it to 25 words: name what fits, then say how many more.
    let more = 0
    const build = () => `${head} ${names.join(', ')}${more ? ` and ${more} more` : ''}.`
    while (names.length > 1 && words(build()) > MAX_WORDS) {
      names = names.slice(0, -1)
      more = weak.length - names.length
    }
    thin = { id: 'exec-thin', template: build(), cites: weak.flatMap((q) => acceptedUnder(doc, q.id).slice(0, 1).map((c) => code(c.id))) }
  }

  // 5. One sentence for each tension the Researcher added as a tension theme. Suggested, dismissed or unreviewed ones never appear.
  const decisions = tensionDecisions(doc)
  const room = Math.max(0, MAX_SENTENCES - out.length - (thin ? 1 : 0))
  tensionsOf(doc, basis)
    .filter((t) => !t.unavailable && decisions[t.id]?.status === 'Added as a tension theme')
    .flatMap((t) => {
      const text = tensionSentence(t.id, t.sides)
      return text ? [{ t, text }] : []
    })
    .slice(0, room)
    .forEach(({ t, text }) => add(`exec-tn-${t.id}`, text, [{ kind: 'tension', id: t.id }, ...t.codeIds.map(code)]))
  if (thin) out.push(thin)
  return out.slice(0, MAX_SENTENCES)
}
