// The rules a sentence of AI-written narration must pass, in one place. The executive summary and the audio summary both follow
// them: one claim, one "n of N", short, plain words, no percentages, "most" only above half, findings and not advice.
import { AUDIO } from '@/config/audioSummary'

export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
/** The "n of N" figures in a sentence. "4 of the 14" counts too. */
export const figures = (text: string): { n: number; of: number }[] => [...text.matchAll(/(\d+) of (?:the )?(\d+)/g)].map((m) => ({ n: Number(m[1]), of: Number(m[2]) }))

/** How a theme or code says what people said. The only wording a line may use for it (the A2 panels use the same phrases). */
export const SIDE_PHRASES = ['verbally positive about it', 'verbally negative about it', 'spoke in favour of it', 'spoke against it', 'just described what happened', 'hesitated while saying it', 'sounded flat or tense', 'looked doubtful or frustrated', 'sounded animated', 'looked pleased', 'their delivery backed it up'] as const
/** Earlier wording for the same thing. Never used again. */
export const RETIRED_SIDE_WORDING = ['argued for it', 'complained', 'complains about it', 'speaks for it', 'pulled against', 'positive words', 'negative words']

export type NarrationCheck = { ok: boolean; problems: string[] }

/**
 * Checks one narration sentence. `maxWords` is 25 for the executive summary and 28 for a spoken line. `figuresAllowed` is 1, or 2 for a
 * sentence that sets two close answers side by side. `faceBased` says it is about faces, which "reads as" and never "felt".
 */
export function checkNarration(text: string, o: { maxWords?: number; figuresAllowed?: number; faceBased?: boolean } = {}): NarrationCheck {
  const problems: string[] = []
  const maxWords = o.maxWords ?? AUDIO.maxLineWords
  if (words(text) > maxWords) problems.push(`Over ${maxWords} words`)
  if (/%|percent/i.test(text)) problems.push('Uses a percentage')
  const figs = figures(text)
  if (figs.length > (o.figuresAllowed ?? 1)) problems.push('More than one “n of N”')
  const lower = text.toLowerCase()
  if (/\b(most people|majority)\b/.test(lower) && !figs.some((f) => f.n * 2 > f.of)) problems.push('Says “most” without more than half')
  AUDIO.bannedWords.forEach((w) => new RegExp(`\\b${w}\\b`, 'i').test(text) && problems.push(`Uses “${w}”`))
  AUDIO.adviceWords.forEach((w) => new RegExp(`\\b${w}\\b`, 'i').test(text) && problems.push(`Reads as advice (“${w}”)`))
  RETIRED_SIDE_WORDING.forEach((w) => lower.includes(w) && problems.push(`Uses retired wording (“${w}”)`))
  if (/\bfelt\b/i.test(text)) problems.push('Says “felt”: a face reads as, it does not feel')
  if (o.faceBased && !/\bread as\b|\breads as\b|\bshowed\b/i.test(text)) problems.push('A face-based line says what a face read as')
  return { ok: problems.length === 0, problems }
}

// ─── spoken numbers ─────────────────────────────────────────────────────────

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
export function numberWords(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberWords(n % 100)}` : ''}`
  return String(n)
}
/** Text as it is spoken: digits become words ("9 of 20 people" is "nine of twenty people"). Display and exports keep the digits. */
export const spoken = (text: string) => text.replace(/\d+/g, (d) => numberWords(Number(d)))
/** Words as they will be spoken, for length. */
export const spokenWords = (text: string) => words(spoken(text).replace(/[–—]/g, ' '))
