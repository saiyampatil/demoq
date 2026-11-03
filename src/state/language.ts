// The study language. One value, owned by the brief's Market section: nothing else stores a copy of it.

import { COUNTRY_MONEY } from '@/mock/currencies'
import { MARKET_LANGUAGE } from '@/mock/moderation'
import { approvedBriefSections } from './audience'
import type { BriefDoc } from './brief'

const ALIASES: [RegExp, string][] = [
  [/\b(usa?|u\.s\.a?\.?)\b/i, 'United States'],
  [/\b(uk|u\.k\.|britain|england)\b/i, 'United Kingdom'],
]

/** The country a Market section names, or null when it names none we know. */
export function marketCountry(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const named = Object.keys(COUNTRY_MONEY).find((c) => new RegExp(`\\b${c}\\b`, 'i').test(t))
  return named ?? ALIASES.find(([re]) => re.test(t))?.[1] ?? null
}

/** The language interviews run in, read from the approved brief's Market section. Null until the market gives one. */
export function studyLanguage(brief: BriefDoc | undefined): string | null {
  const text = approvedBriefSections(brief)?.sections.market.text ?? ''
  const country = marketCountry(text)
  return (country && MARKET_LANGUAGE[country]) || null
}

export const NO_LANGUAGE = 'Add your market in the brief'
