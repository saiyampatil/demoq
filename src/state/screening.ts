// Screening rule engine for R9 / R10 / R11, on mock data.
// Every invitee who "answered" gets a mock profile. The outcome is then worked out from the answers
// against the audience's filters and exclusions, never from the position in the list.
// Only the researcher's manual decisions are stored (AudienceDoc.screening.log).

import { US_STATES } from '@/mock/usStates'
import type { AudienceDoc, Candidate, Cohort, Exclusion, Filter, FilterField, ScreenerQuestion, SourceTag } from './audience'
import { now, uid } from './brief'

export type ScreeningOutcome = 'Eligible' | 'Ineligible' | 'Needs Review' | 'Reserve'
export type VerificationStatus = 'Not started' | 'Pending' | 'Passed' | 'Failed'

// ─── activity log ───────────────────────────────────────────────────────────

export type ScreeningEntry = {
  id: string
  applicantId: string
  at: string
  by: string
  kind: 'outcome' | 'verification'
  from: string
  to: string
  reason: string
  /** A Reserve applicant promoted to replace someone: skips the target-full rule. */
  replacement?: boolean
}

export type ScreeningState = { log: ScreeningEntry[] }

export type PoolRecord = {
  at: string
  by: string
  members: { applicantId: string }[]
  /** Set when the confirmed pool is smaller than the study's target. */
  shortfall: { have: number; need: number } | null
}

export function addEntry(doc: AudienceDoc, entry: Omit<ScreeningEntry, 'id' | 'at'>): AudienceDoc {
  const e: ScreeningEntry = { ...entry, id: uid('sl'), at: now() }
  return { ...doc, screening: { log: [...(doc.screening?.log ?? []), e] } }
}

export function confirmPool(doc: AudienceDoc, by: string, members: PoolRecord['members'], shortfall: PoolRecord['shortfall']): AudienceDoc {
  return { ...doc, pool: { at: now(), by, members, shortfall } }
}

// ─── location helpers (mock) ────────────────────────────────────────────────

const REGIONS: Record<string, string[]> = {
  Northeast: ['Connecticut', 'Maine', 'Massachusetts', 'New Hampshire', 'Rhode Island', 'Vermont', 'New Jersey', 'New York', 'Pennsylvania'],
  Midwest: ['Illinois', 'Indiana', 'Michigan', 'Ohio', 'Wisconsin', 'Iowa', 'Kansas', 'Minnesota', 'Missouri', 'Nebraska', 'North Dakota', 'South Dakota'],
  South: ['Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Maryland', 'North Carolina', 'South Carolina', 'Virginia', 'West Virginia', 'Alabama', 'Kentucky', 'Mississippi', 'Tennessee', 'Arkansas', 'Louisiana', 'Oklahoma', 'Texas'],
  West: ['Arizona', 'Colorado', 'Idaho', 'Montana', 'Nevada', 'New Mexico', 'Utah', 'Wyoming', 'Alaska', 'California', 'Hawaii', 'Oregon', 'Washington'],
}
export const regionOf = (state: string) => Object.keys(REGIONS).find((r) => REGIONS[r].includes(state))

// First three digits of a ZIP code to a state. Approximate, enough for mock data.
const ZIP3: [number, number, string][] = [
  [10, 27, 'Massachusetts'], [28, 29, 'Rhode Island'], [30, 38, 'New Hampshire'], [39, 49, 'Maine'], [50, 59, 'Vermont'],
  [60, 69, 'Connecticut'], [70, 89, 'New Jersey'], [100, 149, 'New York'], [150, 196, 'Pennsylvania'], [197, 199, 'Delaware'],
  [200, 205, 'District of Columbia'], [206, 219, 'Maryland'], [220, 246, 'Virginia'], [247, 268, 'West Virginia'],
  [270, 289, 'North Carolina'], [290, 299, 'South Carolina'], [300, 319, 'Georgia'], [320, 349, 'Florida'], [350, 369, 'Alabama'],
  [370, 385, 'Tennessee'], [386, 397, 'Mississippi'], [400, 427, 'Kentucky'], [430, 458, 'Ohio'], [460, 479, 'Indiana'],
  [480, 499, 'Michigan'], [500, 528, 'Iowa'], [530, 549, 'Wisconsin'], [550, 567, 'Minnesota'], [570, 577, 'South Dakota'],
  [580, 588, 'North Dakota'], [590, 599, 'Montana'], [600, 629, 'Illinois'], [630, 658, 'Missouri'], [660, 679, 'Kansas'],
  [680, 693, 'Nebraska'], [700, 714, 'Louisiana'], [716, 729, 'Arkansas'], [730, 749, 'Oklahoma'], [750, 799, 'Texas'],
  [800, 816, 'Colorado'], [820, 831, 'Wyoming'], [832, 838, 'Idaho'], [840, 847, 'Utah'], [850, 865, 'Arizona'],
  [870, 884, 'New Mexico'], [889, 898, 'Nevada'], [900, 961, 'California'], [967, 968, 'Hawaii'], [970, 979, 'Oregon'],
  [980, 994, 'Washington'], [995, 999, 'Alaska'],
]

/** The state a ZIP code is in, or null when it isn't a 5-digit code that resolves. */
export function zipState(zip: string): string | null {
  if (!/^\d{5}$/.test(zip.trim())) return null
  const p = Number(zip.trim().slice(0, 3))
  return ZIP3.find(([lo, hi]) => p >= lo && p <= hi)?.[2] ?? null
}
const sampleZip = (state: string) => {
  const r = ZIP3.find((x) => x[2] === state)
  return r ? `${String(r[0]).padStart(3, '0')}01` : '00000'
}

// ─── which question checks which filter ─────────────────────────────────────

export type QField = FilterField | 'industry' | 'brands'

/** Reads the question's tag, or works it out from the wording for screeners saved before tags existed. */
export function questionField(q: ScreenerQuestion): QField | undefined {
  if (q.field) return q.field
  const t = q.text.toLowerCase()
  if (q.type === 'number' && t.includes('age')) return 'age'
  if (t.includes('which us state')) return 'state'
  if (t.includes('zip')) return 'zip'
  if (t.includes('gender')) return 'gender'
  if (t.includes('skin type')) return 'skinType'
  if (t.includes('how often do you use')) return 'productUsage'
  if (t.includes('last buy')) return 'purchaseFrequency'
  if (t.includes('market research')) return 'industry'
  if (t.includes('brands')) return 'brands'
  return undefined
}

/** The answers a filter accepts, or null when the filter's wording can't be mapped to the question's options. */
function acceptedFor(field: FilterField, value: string, options: string[]): string[] | null {
  const v = value.toLowerCase()
  if (field === 'skinType') {
    const hit = options.filter((o) => v.includes(o.toLowerCase()) && o !== 'Not sure')
    return hit.length ? hit : null
  }
  if (field === 'productUsage') {
    if (/daily|every day/.test(v)) return ['Every day']
    if (/week/.test(v)) return ['Every day', 'A few times a week', 'About once a week']
    return null
  }
  if (field === 'purchaseFrequency') {
    const m = v.match(/last (\d+) months?/)
    if (/last month/.test(v)) return ['In the last month']
    if (!m) return null
    const n = Number(m[1])
    return ['In the last month', ...(n >= 3 ? ['1–3 months ago'] : []), ...(n >= 6 ? ['4–6 months ago'] : [])]
  }
  return null
}

// ─── mock profiles ──────────────────────────────────────────────────────────

type Persona = 'match' | 'male' | 'ageOut' | 'blank' | 'zipMismatch' | 'zipBad' | 'never' | 'otherUsage' | 'selfDescribe' | 'cooldown' | 'industry'

// Half qualify. The rest each break one rule, so every outcome shows up.
const PERSONAS: Persona[] = [
  'match', 'match', 'match', 'male', 'match', 'ageOut', 'match', 'blank', 'match', 'zipMismatch', 'never', 'match',
  'cooldown', 'industry', 'match', 'zipBad', 'selfDescribe', 'match', 'otherUsage',
]
const HOME_STATES = ['New York', 'Illinois', 'California', 'Georgia', 'Texas', 'Massachusetts', 'Florida', 'Washington', 'Colorado', 'Alaska']
const pick = <T,>(xs: T[], n: number) => xs[((n % xs.length) + xs.length) % xs.length]

function buildAnswers(questions: ScreenerQuestion[], cohort: Cohort | undefined, persona: Persona, i: number): Record<string, string> {
  const filt = (f: FilterField) => cohort?.filters.find((x) => x.field === f)
  const qOf = (f: QField) => questions.find((q) => questionField(q) === f)
  const out: Record<string, string> = {}

  const g = filt('gender')?.value
  const gender = g && g !== 'Any gender' ? g : pick(['Female', 'Male'], i)
  const af = filt('age')
  const lo = Number(af?.min) || 25
  const hi = Number(af?.max) || lo + 14
  const age = lo + (i % (hi - lo + 1))
  const stF = filt('state')?.value.split(',').map((s) => s.trim()).filter(Boolean)
  const regF = filt('region')?.value
  const homes = stF?.length ? stF : regF && REGIONS[regF] ? REGIONS[regF] : HOME_STATES
  const state = pick(homes, i)
  const sq = qOf('skinType')
  const acc = (f: FilterField, q?: ScreenerQuestion) => {
    const f0 = filt(f)
    const a = q && f0 ? acceptedFor(f, f0.value, q.options) : null
    return a?.length ? pick(a, i) : (q?.options[0] ?? '')
  }

  const v: Record<string, string> = {
    age: String(age),
    state,
    zip: sampleZip(state),
    gender,
    skinType: acc('skinType', sq),
    productUsage: acc('productUsage', qOf('productUsage')),
    purchaseFrequency: acc('purchaseFrequency', qOf('purchaseFrequency')),
    industry: 'No',
    brands: pick(qOf('brands')?.options.filter((o) => o !== 'None') ?? [''], i),
  }

  if (persona === 'male') v.gender = gender === 'Female' ? 'Male' : 'Female'
  if (persona === 'ageOut') v.age = String(hi + 17)
  if (persona === 'blank') v.skinType = ''
  if (persona === 'zipMismatch') v.zip = sampleZip(pick(HOME_STATES.filter((s) => s !== state), i))
  if (persona === 'zipBad') v.zip = pick(['00000', '9411', 'ABCDE'], i)
  if (persona === 'never') v.productUsage = 'Never'
  if (persona === 'otherUsage') v.productUsage = 'Other: only in winter'
  if (persona === 'selfDescribe') v.gender = 'Prefer to self-describe'
  if (persona === 'industry') v.industry = 'Yes'

  questions.forEach((q) => {
    const f = questionField(q)
    if (f && f in v) out[q.id] = v[f]
    else out[q.id] = q.options.find(Boolean) ?? 'Yes'
  })
  return out
}

// ─── evaluation ─────────────────────────────────────────────────────────────

export type CheckResult = 'pass' | 'fail' | 'unclear' | 'skip'
export type RuleCheck = { rule: string; detail: string; result: CheckResult }
export type RuleGroup = { title: string; checks: RuleCheck[] }

type Ans = { q: ScreenerQuestion; value: string }

function checkFilter(f: Filter, get: (field: QField) => Ans | undefined): RuleCheck {
  const label = f.field === 'zip' ? 'ZIP code' : f.field === 'skinType' ? 'Skin type' : f.field === 'productUsage' ? 'Product usage' : f.field === 'purchaseFrequency' ? 'Purchase frequency' : f.field[0].toUpperCase() + f.field.slice(1)
  const skip = (detail: string): RuleCheck => ({ rule: label, detail, result: 'skip' })
  const make = (result: CheckResult, detail: string): RuleCheck => ({ rule: label, detail, result })

  // Country, region and city come from the state answer; there's no city question.
  const src: QField = f.field === 'country' || f.field === 'region' ? 'state' : f.field === 'city' ? 'zip' : f.field
  if (f.field === 'city') return skip('The screener doesn’t ask for a city, so this isn’t checked')
  const a = get(src)
  if (!a) return skip('Not asked in the screener, so this isn’t checked')
  const val = a.value.trim()
  if (!val) return make('unclear', 'No answer given')

  switch (f.field) {
    case 'gender': {
      if (!f.value || f.value === 'Any gender') return make('pass', `Answered ${val}; any gender qualifies`)
      if (val === f.value) return make('pass', `Answered ${val}, needs ${f.value}`)
      if (['Female', 'Male', 'Non-binary'].includes(val)) return make('fail', `Answered ${val}, needs ${f.value}`)
      return make('unclear', `“${val}” doesn’t map to a gender option, needs ${f.value}`)
    }
    case 'age': {
      if (!/^\d{1,3}$/.test(val)) return make('unclear', `“${val}” isn’t a valid age`)
      const n = Number(val)
      const lo = f.min ? Number(f.min) : 18
      const hi = f.max ? Number(f.max) : Infinity
      if (n < 18) return make('fail', `Age ${n} is under 18`)
      return n >= lo && n <= hi ? make('pass', `Age ${n} is within ${f.min || 18}–${f.max || 'up'}`) : make('fail', `Age ${n} is outside ${f.min || 18}–${f.max || 'up'}`)
    }
    case 'country':
      if (f.value && f.value !== 'United States') return skip('Only the United States is supported')
      return US_STATES.includes(val) ? make('pass', `${val} is in the United States`) : make('unclear', `“${val}” isn’t a US state`)
    case 'state': {
      const list = f.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      if (!list.length) return skip('No state set on this filter')
      return list.includes(val.toLowerCase()) ? make('pass', `Lives in ${val}`) : make('fail', `Lives in ${val}, needs ${f.value}`)
    }
    case 'region': {
      const r = regionOf(val)
      if (!r) return make('unclear', `Can’t place “${val}” in a region`)
      return !f.value || r === f.value ? make('pass', `${val} is in the ${r}`) : make('fail', `${val} is in the ${r}, needs ${f.value}`)
    }
    case 'zip': {
      const list = f.value.split(/[,\s]+/).filter(Boolean)
      if (!list.length) return skip('No ZIP codes set on this filter')
      if (!/^\d{5}$/.test(val)) return make('unclear', `“${val}” isn’t a 5-digit ZIP code`)
      return list.some((z) => val.startsWith(z)) ? make('pass', `ZIP ${val} is in the list`) : make('fail', `ZIP ${val} is not in ${f.value}`)
    }
    default: {
      const acc = acceptedFor(f.field, f.value, a.q.options)
      if (!acc) return skip('This filter’s wording can’t be checked automatically')
      if (!a.q.options.includes(val)) return make('unclear', `“${val}” isn’t one of the answer options`)
      if (val === 'Not sure') return make('unclear', 'Answered “Not sure”')
      return acc.includes(val) ? make('pass', `Answered “${val}”`) : make('fail', `Answered “${val}”, needs ${acc.join(' or ')}`)
    }
  }
}

function checkExclusion(e: Exclusion, get: (field: QField) => Ans | undefined, lastResearch: string | null, answers: Record<string, string>, questions: ScreenerQuestion[]): RuleCheck {
  if (e.kind === 'cooldown')
    return lastResearch
      ? { rule: e.label, detail: `Last took part ${lastResearch} (panel history, mock)`, result: 'fail' }
      : { rule: e.label, detail: 'No research in the last 90 days (panel history, mock)', result: 'pass' }
  if (e.kind === 'industry') {
    const a = get('industry')
    if (!a) return { rule: e.label, detail: 'Not asked in the screener, so this isn’t checked', result: 'skip' }
    const v = a.value.trim()
    if (!v) return { rule: e.label, detail: 'No answer given', result: 'unclear' }
    return v === 'Yes' ? { rule: e.label, detail: 'Answered Yes', result: 'fail' } : { rule: e.label, detail: 'Answered No', result: 'pass' }
  }
  if (e.kind === 'custom' && e.questionId) {
    const q = questions.find((x) => x.id === e.questionId)
    const v = (answers[e.questionId] ?? '').trim()
    if (!q) return { rule: e.label, detail: 'The question was removed from the screener', result: 'skip' }
    if (!v) return { rule: e.label, detail: 'No answer given', result: 'unclear' }
    return v === e.answer ? { rule: e.label, detail: `Answered “${v}”`, result: 'fail' } : { rule: e.label, detail: `Answered “${v}”`, result: 'pass' }
  }
  return { rule: e.label, detail: 'Not checked in the prototype (matched by invite reference)', result: 'skip' }
}

export type Evaluation = { outcome: ScreeningOutcome; groups: RuleGroup[]; reason: string }

export function evaluate(doc: AudienceDoc, answers: Record<string, string>, lastResearch: string | null): Evaluation {
  const def = doc.def!
  const questions = doc.screener?.questions ?? []
  const get = (field: QField): Ans | undefined => {
    const q = questions.find((x) => questionField(x) === field)
    return q ? { q, value: answers[q.id] ?? '' } : undefined
  }

  // Applicant-level checks: complete answers, and a ZIP code that agrees with the state.
  const consistency: RuleCheck[] = []
  questions.forEach((q, n) => {
    if (!(answers[q.id] ?? '').trim()) consistency.push({ rule: `Question ${n + 1}`, detail: `No answer to “${q.text}”`, result: 'unclear' })
  })
  const z = get('zip')
  const st = get('state')
  if (z && z.value.trim()) {
    const zs = zipState(z.value)
    if (!zs) consistency.push({ rule: 'ZIP code', detail: `“${z.value}” doesn’t resolve to a state`, result: 'unclear' })
    else if (st && st.value.trim() && zs !== st.value) consistency.push({ rule: 'ZIP code', detail: `ZIP ${z.value} is in ${zs}, but they answered ${st.value}`, result: 'unclear' })
    else consistency.push({ rule: 'ZIP code', detail: `ZIP ${z.value} is in ${zs}`, result: 'pass' })
  }

  const exclusions = def.exclusions.map((e) => checkExclusion(e, get, lastResearch, answers, questions))
  const checks = def.cohort.filters.map((f) => checkFilter(f, get))
  const fails = checks.filter((x) => x.result === 'fail').length
  const unclear = checks.filter((x) => x.result === 'unclear').length

  const groups: RuleGroup[] = [{ title: 'Audience filters', checks }]
  if (consistency.length) groups.push({ title: 'Answers', checks: consistency })
  if (exclusions.length) groups.push({ title: 'Exclusions', checks: exclusions })

  const firstOf = (r: CheckResult) => [...checks, ...consistency, ...exclusions].find((x) => x.result === r)
  const text = (c?: RuleCheck) => (c ? `${c.rule}: ${c.detail}` : '')
  const excludedHard = exclusions.some((x) => x.result === 'fail')
  const unclearAny = consistency.some((x) => x.result === 'unclear') || exclusions.some((x) => x.result === 'unclear')

  if (excludedHard) return { outcome: 'Ineligible', groups, reason: text(exclusions.find((x) => x.result === 'fail')) }
  if (fails > 0) return { outcome: 'Ineligible', groups, reason: text(checks.find((x) => x.result === 'fail')) }
  if (unclear > 0 || unclearAny) return { outcome: 'Needs Review', groups, reason: text(firstOf('unclear')) }
  return { outcome: 'Eligible', groups, reason: 'Meets every filter and no exclusion applies.' }
}

// ─── applicants ─────────────────────────────────────────────────────────────

export type Applicant = {
  id: string
  contact: string
  source: SourceTag
  autoOutcome: ScreeningOutcome
  outcome: ScreeningOutcome
  /** Set when the target was already met, or the applicant arrived after launch, so an eligible applicant became Reserve. */
  note?: string
  /** Screened after launch: a top-up applicant. */
  afterLaunch: boolean
  /** The audience version they were screened under. */
  screenedUnder?: number
  groups: RuleGroup[]
  reason: string
  verification: VerificationStatus
  autoVerification: VerificationStatus
  /** null = not reviewed yet. */
  checks: { consent: boolean | null; language: boolean | null; human: boolean | null }
  submittedAt: string
  answers: { question: string; answer: string }[]
  lastResearch: string | null
  proof: { file: string; uploadedAt: string } | null
  log: ScreeningEntry[]
  outcomeEdited: boolean
  verificationEdited: boolean
}

/** How an invite reference reads in the tables: the user ID, or a masked phone number. */
export function inviteRef(c: Pick<Candidate, 'value' | 'idType'>) {
  if (c.idType === 'phone') {
    const m = c.value.match(/^\((\d{3})\) \d{3}-(\d{4})$/)
    return m ? `Phone · (${m[1]}) ••• ${m[2]}` : `Phone · ${c.value}`
  }
  return `User ID · ${c.value}`
}

export function mockApplicants(doc: AudienceDoc): Applicant[] {
  const def = doc.def
  if (!def || !doc.screener) return []
  const questions = doc.screener.questions
  const log = doc.screening?.log ?? []
  // Applicant numbers follow the invite order, so they stay put as more people are added.
  const invited = doc.sourcing.candidates.filter((c) => c.invitedAt)
  const entries = invited.map((c, idx) => ({ c, idx })).filter(({ idx }) => idx % 5 !== 4) // one in five hasn't answered yet

  const base = entries.map(({ c, idx }, n) => {
    const persona = PERSONAS[idx % PERSONAS.length]
    const answers = buildAnswers(questions, def.cohort, persona, idx)
    const lastResearch = persona === 'cooldown' ? '34 days ago' : null
    const ev = evaluate(doc, answers, lastResearch)
    return { c, idx, n, answers, lastResearch, ev }
  })

  // Manual decisions, newest wins.
  const lastOf = (id: string, kind: ScreeningEntry['kind']) => [...log].reverse().find((e) => e.applicantId === id && e.kind === kind)

  // Slots go out in applicant order, up to the target. Eligible people beyond it go to Reserve.
  // Only Eligible applicants take a slot: an Ineligible or Needs Review applicant never does.
  let filled = 0
  const room = () => filled < (def.total ?? Infinity)

  return base.map(({ c, idx, answers, lastResearch, ev }) => {
    const id = `A-${1001 + idx}`
    const manual = lastOf(id, 'outcome')
    const vManual = lastOf(id, 'verification')
    const auto = ev.outcome
    let outcome: ScreeningOutcome = auto
    let note: string | undefined

    if (manual) outcome = manual.to as ScreeningOutcome
    if (outcome === 'Eligible' && c.afterLaunch && !manual?.replacement) {
      // Someone screened after launch never goes straight into an interview: they wait in the reserve to be invited.
      outcome = 'Reserve'
      note = 'Screened after the study launched, so this eligible applicant is in the reserve. Invite them from Fieldwork.'
    } else if (outcome === 'Eligible' && !manual?.replacement) {
      if (room()) filled += 1
      else {
        outcome = 'Reserve'
        note = `The study’s target of ${def.total} is already met, so this eligible applicant is in Reserve.`
      }
    } else if (outcome === 'Eligible') filled += 1

    // Verification starts from the screening result and the profile; an override replaces it.
    const autoV: VerificationStatus =
      auto === 'Ineligible' ? 'Not started' : auto === 'Needs Review' ? 'Pending' : idx % 10 === 7 ? 'Failed' : idx % 6 === 2 ? 'Pending' : 'Passed'
    const verification = (vManual?.to as VerificationStatus | undefined) ?? autoV
    const done = autoV === 'Passed' || autoV === 'Failed'
    const failedCheck = idx % 2 ? 'language' : 'human'
    const checks = {
      consent: done ? true : null,
      language: done ? !(autoV === 'Failed' && failedCheck === 'language') : null,
      human: done ? !(autoV === 'Failed' && failedCheck === 'human') : null,
    }

    const ownLog = log.filter((e) => e.applicantId === id)
    return {
      id,
      contact: inviteRef(c),
      source: c.source,
      afterLaunch: !!c.afterLaunch,
      screenedUnder: c.screenedUnder,
      autoOutcome: auto,
      outcome,
      note,
      groups: ev.groups,
      reason: ev.reason,
      verification,
      autoVerification: autoV,
      checks,
      submittedAt: `2026-10-${String(20 + (idx % 9)).padStart(2, '0')}T${String(9 + (idx % 8)).padStart(2, '0')}:${String((idx * 17) % 60).padStart(2, '0')}:00-04:00`,
      answers: questions.map((q) => ({ question: q.text, answer: answers[q.id] || '' })),
      lastResearch,
      proof: autoV === 'Not started' || autoV === 'Pending' ? null : { file: `receipt-${id.toLowerCase()}.jpg`, uploadedAt: `2026-10-${String(20 + (idx % 9)).padStart(2, '0')}` },
      log: ownLog,
      outcomeEdited: !!manual,
      verificationEdited: !!vManual,
    }
  })
}

/** Eligible applicants against the study's target, with the reserve beside it. One cohort, one bar. */
export function targetFill(applicants: Applicant[], doc: AudienceDoc) {
  return {
    target: doc.def?.total ?? null,
    eligible: applicants.filter((a) => a.outcome === 'Eligible').length,
    reserve: applicants.filter((a) => a.outcome === 'Reserve').length,
  }
}

// ─── pool (R11) ─────────────────────────────────────────────────────────────

export const inPool = (a: Applicant) => a.outcome === 'Eligible' && a.verification === 'Passed'

export function poolView(applicants: Applicant[], doc: AudienceDoc) {
  return {
    members: applicants.filter(inPool),
    reserve: applicants.filter((a) => a.outcome === 'Reserve' && a.verification === 'Passed'),
    waiting: applicants.filter((a) => a.outcome === 'Eligible' && a.verification !== 'Passed'),
    need: doc.def?.total ?? 0,
  }
}
