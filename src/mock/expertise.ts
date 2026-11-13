// The one list of expertise tags. The Researcher's "Add new" pop-up suggests from it and a moderator picks from it in their
// profile, so the two can never drift into different spellings.
export const EXPERTISE_TAGS = [
  'Skincare',
  'Beauty and personal care',
  'Concept testing',
  'Consumer goods',
  'Pricing',
  'Pet care',
  'Subscriptions',
  'Wellness',
  'Packaging',
  'Automotive',
  'Spanish-language research',
  'Hindi-language research',
  'Gen Z and lifestyle',
] as const

/** What the PulseAI roster moderators are known for. A mock: in the product it comes from their profile. */
export const ROSTER_EXPERTISE: Record<string, string[]> = {
  'u-jordan': ['Beauty and personal care', 'Skincare'],
  'u-priya': ['Consumer goods', 'Hindi-language research'],
  'u-sam': ['Beauty and personal care', 'Spanish-language research'],
  'u-elena': ['Concept testing'],
  'u-marta': ['Spanish-language research'],
}

/**
 * Which client company an email domain belongs to. A team moderator works for one company and sees only that company's
 * studies. A mock: in the product it comes from the invitation.
 */
export const DOMAIN_COMPANY: Record<string, string> = { 'verdane.com': 'Verdane Skincare', 'burrowpet.com': 'Burrow Pet' }
