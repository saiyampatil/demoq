// How a verdict looks, in one place. A theme's reading is a filled chip; a code's verdict is a dot and text; a person's result is a dot.
// The same six tones at every level, never the same style at two levels: Fits teal, Partly fits amber, Doesn't fit rust, Unsure indigo,
// Split purple, and Too few to read or Facts only grey and dashed.

import type { ReadingLabel } from '@/config/readings'
import type { FitPattern } from '@/state/emotion'
import type { Bucket } from '@/state/signals'

export type Tone = 'fits' | 'partly' | 'doesnt' | 'unsure' | 'split' | 'none'

export const toneOfVerdict = (v: FitPattern): Tone => ({ Consistent: 'fits', Mixed: 'partly', Conflicting: 'doesnt', 'Too few to read': 'none', 'No claim': 'none' } as const)[v]
export const toneOfReading = (l: ReadingLabel): Tone =>
  ({ 'Said and meant': 'fits', 'Partly backed': 'partly', 'Said, not backed': 'doesnt', 'Said, but unsure': 'unsure', 'Split inside the theme': 'split', 'Too few to read': 'none', 'Stated, not argued': 'none' } as const)[l]
export const toneOfBucket = (b: Bucket): Tone => ({ against: 'doesnt', unsure: 'unsure', fit: 'fits' } as const)[b]

export const DOT: Record<Tone, string> = {
  fits: 'bg-emo-delight',
  partly: 'bg-emo-surprise',
  doesnt: 'bg-emo-doubt',
  unsure: 'bg-iris-600',
  split: 'bg-split-fg',
  none: 'border border-dashed border-mist-strong bg-surface',
}
export const TEXT: Record<Tone, string> = {
  fits: 'text-emo-warm-fg',
  partly: 'text-pending-fg',
  doesnt: 'text-emo-cold-fg',
  unsure: 'text-iris-700',
  split: 'text-split-fg',
  none: 'text-muted',
}
export const FILLED: Record<Tone, string> = {
  fits: 'border-emo-delight bg-emo-delight text-white',
  partly: 'border-emo-surprise bg-emo-surprise text-ink',
  doesnt: 'border-emo-doubt bg-emo-doubt text-white',
  unsure: 'border-iris-600 bg-iris-600 text-white',
  split: 'border-split-fg bg-split-fg text-white',
  none: 'border-dashed border-mist-strong bg-surface text-muted',
}
