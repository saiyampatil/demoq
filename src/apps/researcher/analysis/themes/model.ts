import { useMemo } from 'react'
import type { Basis, CodebookDoc } from '@/state/codebook'
import { codeSignals, insightCounts, themeSignals } from '@/state/signals'

/** Everything the Themes tab and the page around it read, worked out once: the code readings, the themes, and how the insights stand. */
export function useThemeModel(doc: CodebookDoc | undefined, basis: Basis) {
  return useMemo(() => {
    if (!doc) return undefined
    const signals = codeSignals(doc, basis)
    const profiles = themeSignals(doc, basis, signals)
    return { signals, profiles, counts: insightCounts(profiles) }
  }, [doc, basis])
}
export type ThemeModel = NonNullable<ReturnType<typeof useThemeModel>>

/** What the Themes tab is showing: kept by the page, so a tension can open a code. */
export type SignalFocus = {
  /** The code open in the panel. */
  code?: string
  /** The theme open in the panel (instead of a code). */
  theme?: string
  /** The concept open in the Concepts tab. */
  concept?: string
}
