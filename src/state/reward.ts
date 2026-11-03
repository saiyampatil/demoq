// The participant reward (R8). One stored value, used everywhere a participant or a Researcher reads about it:
// the screener invitation, the entry screen, the booking confirmation, the closing screen and the launch checks.

import { COUNTRY_MONEY, CURRENCIES } from '@/mock/currencies'
import type { AudienceDoc } from './audience'
import { now, uid } from './brief'

export type RewardType = 'Gift card' | 'Cash transfer' | 'Store credit'
export const REWARD_TYPES: RewardType[] = ['Gift card', 'Cash transfer', 'Store credit']
export type PaidWhen = 'After the full interview' | 'After any completed session'
export const PAID_WHEN: PaidWhen[] = ['After the full interview', 'After any completed session']

export type RewardChange = { id: string; at: string; by: string; text: string }

export type Reward = {
  /** false = "No reward", for internal or volunteer studies. Every participant text then leaves the reward line out. */
  offered: boolean
  noRewardReason: string
  /** In the currency's own units, e.g. 40 for $40.00. */
  amount: number | null
  currency: string
  type: RewardType
  paidWhen: PaidWhen
  /** The length participants are promised, in minutes. */
  promisedMin: number | null
  /** Set once the Researcher has saved it. A reward that was never saved is not complete. */
  savedAt?: string
  log: RewardChange[]
}

export const studyCountry = (a: Pick<AudienceDoc, 'def'> | undefined) => a?.def?.cohort.filters.find((f) => f.field === 'country')?.value || 'United States'
export const moneyOf = (country: string) => COUNTRY_MONEY[country] ?? COUNTRY_MONEY['United States']

export const emptyReward = (country: string, promisedMin: number | null): Reward => ({
  offered: true,
  noRewardReason: '',
  amount: null,
  currency: moneyOf(country).currency,
  type: 'Gift card',
  paidWhen: 'After the full interview',
  promisedMin,
  log: [],
})

/** A saved reward for the seed studies, whose invitations went out before this setting existed. */
export const seedReward = (country: string, amount: number, promisedMin: number, by: string, at: string): Reward => ({
  ...emptyReward(country, promisedMin),
  amount,
  savedAt: at,
  log: [{ id: uid('rw'), at, by, text: `Reward set to ${formatMoney(amount, moneyOf(country).currency, moneyOf(country).locale)}, gift card, paid after the full interview.` }],
})

/** The brief's target length, read from its text ("20 minutes"). */
export const minutesFromText = (text: string | undefined) => {
  const m = text?.match(/(\d{1,3})\s*(?:-|to|–)?\s*(?:\d{1,3})?\s*min/i) ?? text?.match(/(\d{1,3})/)
  return m ? Number(m[1]) : null
}

/** The reward an audience has: its own, or the seed reward for a study whose invitations went out before rewards existed. */
export function rewardOf(a: AudienceDoc | undefined, promisedHint: number | null = null): Reward {
  const country = studyCountry(a)
  if (a?.reward) return a.reward
  const sent = !!a?.sourcing.candidates.some((c) => c.invitedAt)
  return sent ? seedReward(country, 40, promisedHint ?? 20, 'Maya Ortiz', '2026-10-18T09:00:00-04:00') : emptyReward(country, promisedHint)
}

// ─── money ──────────────────────────────────────────────────────────────────

export const currencyName = (code: string) => CURRENCIES.find((c) => c.code === code)?.name ?? code

export function decimalsOf(currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function symbolOf(currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

export function formatMoney(amount: number, currency: string, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

// ─── what participants read ─────────────────────────────────────────────────

const localeOf = (country: string) => moneyOf(country).locale

/** "$40.00", in the currency and the locale of the study's country. */
export const rewardAmount = (r: Reward, country: string) => (r.offered && r.amount ? formatMoney(r.amount, r.currency, localeOf(country)) : null)

/**
 * "Earn a $40.00 gift card, paid after you complete the full interview (about 20 minutes)."
 * null when there is no reward or it isn't complete, so the copy around it leaves the line out.
 */
export function rewardLine(r: Reward, country: string): string | null {
  const money = rewardAmount(r, country)
  if (!money) return null
  const what = r.type === 'Store credit' ? `${money} in store credit` : `a ${money} ${r.type.toLowerCase()}`
  const when = r.paidWhen === 'After the full interview' ? 'after you complete the full interview' : 'after any session you complete'
  return `Earn ${what}, paid ${when}${r.promisedMin ? ` (about ${r.promisedMin} minutes)` : ''}.`
}

/** The screener invitation: "Earn up to $40.00 if you are selected." */
export const rewardInviteLine = (r: Reward, country: string) => {
  const money = rewardAmount(r, country)
  return money ? `Earn up to ${money} if you are selected.` : null
}

/** The closing screen: "Your $40.00 gift card will be sent by email." */
export function rewardClosingLine(r: Reward, country: string) {
  const money = rewardAmount(r, country)
  if (!money) return null
  return r.type === 'Store credit' ? `Your ${money} in store credit will be added to your account.` : `Your ${money} ${r.type.toLowerCase()} will be sent to you.`
}

/** The line in the booking confirmation and the entry screen. Same words as rewardLine. */
export const rewardEntryLine = rewardLine

// ─── rules ──────────────────────────────────────────────────────────────────

export const invitationsSent = (a: AudienceDoc | undefined) => !!a?.sourcing.candidates.some((c) => c.invitedAt)

/** Why a field can't change, or undefined while it can. */
export function rewardLocks(a: AudienceDoc | undefined) {
  const sent = invitationsSent(a)
  const why = 'Invitations have already been sent, so this can’t change.'
  return { sent, currency: sent ? why : undefined, type: sent ? why : undefined, offered: sent ? 'Invitations have already been sent, so the reward can’t be removed.' : undefined, amount: sent ? 'Invitations have already been sent, so the amount can only go up.' : undefined }
}

/** What is wrong with a reward as it is typed, for the Save button. */
export function rewardProblems(draft: Reward, saved: Reward, a: AudienceDoc | undefined): string[] {
  const out: string[] = []
  const locks = rewardLocks(a)
  if (!draft.offered) {
    if (!draft.noRewardReason.trim()) out.push('Say why there is no reward')
    if (locks.sent && saved.offered && saved.savedAt) out.push(locks.offered!)
    return out
  }
  if (draft.amount === null || !(draft.amount >= 1)) out.push('Enter an amount of at least 1')
  else {
    const d = decimalsOf(draft.currency)
    if (Math.round(draft.amount * 10 ** d) / 10 ** d !== draft.amount) out.push(`${draft.currency} takes ${d === 0 ? 'whole amounts' : `${d} decimals at most`}`)
    if (locks.sent && saved.offered && saved.amount !== null && draft.amount < saved.amount) out.push(`The amount can only go up. It is ${formatMoney(saved.amount, saved.currency)} now`)
  }
  if (locks.sent && saved.savedAt && saved.offered) {
    if (draft.currency !== saved.currency) out.push('The currency is locked once invitations are sent')
    if (draft.type !== saved.type) out.push('The reward type is locked once invitations are sent')
  }
  if (!draft.promisedMin || draft.promisedMin < 1) out.push('Enter the promised length in minutes')
  return out
}

/** A reward is complete when it was saved, offered with an amount or declined with a reason. */
export const rewardComplete = (r: Reward) => !!r.savedAt && (r.offered ? !!r.amount && r.amount >= 1 && !!r.currency && !!r.promisedMin : !!r.noRewardReason.trim())

export function saveReward(doc: AudienceDoc, draft: Reward, by: string, hint: number | null): AudienceDoc {
  const prev = rewardOf(doc, hint)
  const country = studyCountry(doc)
  const money = (x: Reward) => (x.amount === null ? 'no amount' : formatMoney(x.amount, x.currency, localeOf(country)))
  const changes: string[] = []
  if (!prev.savedAt) changes.push(draft.offered ? `Reward set to ${money(draft)}, ${draft.type.toLowerCase()}, paid ${draft.paidWhen.toLowerCase()}, ${draft.promisedMin} min.` : `No reward. Reason: ${draft.noRewardReason.trim()}`)
  else {
    if (draft.offered !== prev.offered) changes.push(draft.offered ? 'Reward turned on' : `Reward turned off. Reason: ${draft.noRewardReason.trim()}`)
    if (draft.offered && prev.offered) {
      if (draft.amount !== prev.amount || draft.currency !== prev.currency) changes.push(`Amount changed from ${money(prev)} to ${money(draft)}`)
      if (draft.type !== prev.type) changes.push(`Reward type changed from ${prev.type.toLowerCase()} to ${draft.type.toLowerCase()}`)
      if (draft.paidWhen !== prev.paidWhen) changes.push(`Paid when changed to ${draft.paidWhen.toLowerCase()}`)
      if (draft.promisedMin !== prev.promisedMin) changes.push(`Promised length changed from ${prev.promisedMin} to ${draft.promisedMin} min`)
    }
  }
  if (!changes.length) return doc
  const at = now()
  return { ...doc, reward: { ...draft, savedAt: at, log: [...prev.log, ...changes.map((text) => ({ id: uid('rw'), at, by, text }))] } }
}

/** The warning on the launch screen: the promised length against the guide's target. */
export function lengthMismatch(promisedMin: number | null, guideMin: number | null) {
  if (!promisedMin || !guideMin) return null
  return Math.abs(guideMin - promisedMin) / promisedMin > 0.2 ? `Promised ${promisedMin} min, guide is ${guideMin} min.` : null
}
