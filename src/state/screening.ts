// Mock screening results for R9 / R10. Everyone who was invited is simulated as having accepted
// and answered the screener, so the dashboard has something to show. Nothing here is persisted.

import type { ScreenerQuestion, AudienceDoc, SourceTag } from './audience'

export type ScreeningOutcome = 'Eligible' | 'Ineligible' | 'Needs Review' | 'Reserve'
export type VerificationStatus = 'Not started' | 'Pending' | 'Passed' | 'Failed'

export type Applicant = {
  id: string
  contact: string
  source: SourceTag
  cohort: string | null
  outcome: ScreeningOutcome
  /** Why the outcome was reached. Researcher-only, never shown to the participant. */
  reason: string
  verification: VerificationStatus
  submittedAt: string
  answers: { question: string; answer: string }[]
  lastResearch: string | null
}

const pick = <T,>(xs: T[], n: number) => xs[n % xs.length]

function answerFor(q: ScreenerQuestion, i: number, age: number): string {
  if (q.type === 'number') return String(age)
  if (q.type === 'text') return pick(['10001', '60614', '94110', '30303', '78704', '02139'], i)
  const opts = q.options.filter(Boolean)
  if (!opts.length) return '—'
  if (q.type === 'multi') return [pick(opts, i), pick(opts, i + 3)].filter((v, n, a) => a.indexOf(v) === n).join(', ')
  return pick(opts, i * 3 + 1)
}

export function mockApplicants(doc: AudienceDoc): Applicant[] {
  const def = doc.def
  const questions = doc.screener?.questions ?? []
  const invited = doc.sourcing.candidates.filter((c) => c.invitedAt)
  // A fifth of the invitees haven't answered yet, so they aren't applicants.
  const responded = invited.filter((_, i) => i % 5 !== 4)
  const filled = new Map<string, number>()

  return responded.map((c, i) => {
    const cohort = def?.cohorts.length ? pick(def.cohorts, i) : undefined
    const age = 25 + ((i * 7) % 20)
    let outcome: ScreeningOutcome = 'Eligible'
    let reason = 'Meets every filter for the cohort.'
    let lastResearch: string | null = null
    if (i % 13 === 7) {
      outcome = 'Ineligible'
      reason = 'Took part in research in the last 90 days.'
      lastResearch = '34 days ago'
    } else if (i % 11 === 3) {
      outcome = 'Ineligible'
      reason = 'Works in market research or advertising.'
    } else if (i % 9 === 5) {
      outcome = 'Needs Review'
      reason = 'ZIP code does not match the state given.'
    } else if (cohort) {
      const n = filled.get(cohort.id) ?? 0
      if (n >= (cohort.participants ?? Infinity)) {
        outcome = 'Reserve'
        reason = `Eligible, but the ${cohort.name} cohort is full.`
      } else filled.set(cohort.id, n + 1)
    }
    const verification: VerificationStatus =
      outcome === 'Ineligible' ? 'Not started' : outcome === 'Needs Review' ? 'Pending' : i % 17 === 4 ? 'Failed' : i % 7 === 2 ? 'Pending' : 'Passed'
    return {
      id: `A-${1001 + i}`,
      contact: c.value,
      source: c.source,
      cohort: outcome === 'Ineligible' ? null : (cohort?.name ?? null),
      outcome,
      reason,
      verification,
      submittedAt: `2026-10-${String(20 + (i % 9)).padStart(2, '0')}T${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}:00-04:00`,
      answers: questions.map((q) => ({ question: q.text, answer: answerFor(q, i, age) })),
      lastResearch,
    }
  })
}

export function cohortFill(applicants: Applicant[], doc: AudienceDoc) {
  return (doc.def?.cohorts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    target: c.participants,
    eligible: applicants.filter((a) => a.cohort === c.name && a.outcome === 'Eligible').length,
    reserve: applicants.filter((a) => a.cohort === c.name && a.outcome === 'Reserve').length,
  }))
}
