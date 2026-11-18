// The words shown for a verdict and for a theme reading, in one place. Every screen that shows them reads this map; the keys they are
// stored and computed under (Consistent, Mixed, Conflicting, Said and meant, ...) never change. Wording awaits founder approval.

import type { ReadingLabel } from './readings'
import type { FitPattern } from '@/state/emotion'

export const VERDICT_WORDS: Record<FitPattern, string> = {
  Consistent: 'Fits',
  Mixed: 'Partly fits',
  Conflicting: 'Doesn’t fit',
  'Too few to read': 'Too few to read',
  'No claim': 'Facts only',
}
export const READING_WORDS: Record<ReadingLabel, string> = {
  'Said and meant': 'Fits',
  'Partly backed': 'Partly fits',
  'Said, not backed': 'Doesn’t fit',
  'Said, but unsure': 'Unsure',
  'Split inside the theme': 'Split',
  'Too few to read': 'Too few to read',
  'Stated, not argued': 'Facts only',
}
export const verdictWord = (v: FitPattern) => VERDICT_WORDS[v]
export const readingWord = (l: ReadingLabel) => READING_WORDS[l]

/** The three buckets a person falls in, as words. */
export const BUCKET_WORDS = { against: 'Didn’t fit', unsure: 'Unsure', fit: 'Fits' } as const
