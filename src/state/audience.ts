// Module 2 setup (R6, R7, R8): audience definition, screener and participant sourcing.
// Every operation takes an AudienceDoc and returns a new one; StudyContext stores and persists it.

import type { AudienceStatus } from '@/components/status'
import { US_STATES } from '@/mock/usStates'
import type { StudyRecord } from '@/mock/types'
import type { PoolRecord, ScreeningState } from './screening'
import { AI_NAME, now, uid, type BriefDoc, type SectionKey, type SectionSnapshot } from './brief'

// ─── filters ────────────────────────────────────────────────────────────────

export type FilterField = 'gender' | 'age' | 'country' | 'state' | 'region' | 'city' | 'zip' | 'skinType' | 'productUsage' | 'purchaseFrequency'

// US wording for location: State and Region both apply (each Census region holds several states). ZIP code, not Pincode.
export const filterMeta: Record<FilterField, { label: string; input: 'select' | 'range' | 'text'; options?: string[]; placeholder?: string }> = {
  gender: { label: 'Gender', input: 'select', options: ['Female', 'Male', 'Non-binary', 'Any gender'] },
  age: { label: 'Age', input: 'range' },
  country: { label: 'Country', input: 'select', options: ['United States'] },
  state: { label: 'State', input: 'text', placeholder: 'e.g. California, Texas' },
  region: { label: 'Region', input: 'select', options: ['Northeast', 'Midwest', 'South', 'West'] },
  city: { label: 'City', input: 'text', placeholder: 'e.g. Chicago' },
  zip: { label: 'ZIP code', input: 'text', placeholder: 'e.g. 10001, 94103' },
  skinType: { label: 'Skin type', input: 'text', placeholder: 'e.g. Dry or combination' },
  productUsage: { label: 'Product usage', input: 'text', placeholder: 'e.g. Uses a facial moisturizer daily' },
  purchaseFrequency: { label: 'Purchase frequency', input: 'text', placeholder: 'e.g. Bought one in the last 3 months' },
}
export const FILTER_FIELDS = Object.keys(filterMeta) as FilterField[]

/** Where a value came from: the AI read it from the approved brief, or the researcher edited or added it. */
export type Origin = 'ai' | 'edited' | 'added'

export type Filter = { id: string; field: FilterField; value: string; min?: string; max?: string; origin: Origin }

/** The one group of people a study recruits. Its participant count is the study's target (AudienceDef.total). */
export type Cohort = {
  id: string
  /** Named from the audience definition, e.g. "Women 25–44 with dry or combination skin". The Researcher can rename it. */
  name: string
  nameOrigin: Origin
  filters: Filter[]
  /** Filters the brief didn't provide, shown as "Missing: not in brief". */
  missing: string[]
}

export type ExclusionKind = 'cooldown' | 'industry' | 'duplicate' | 'custom'
export type Exclusion = { id: string; kind: ExclusionKind; label: string; questionId?: string; answer?: string }

export const STANDARD_EXCLUSIONS: { kind: Exclude<ExclusionKind, 'custom'>; label: string }[] = [
  { kind: 'cooldown', label: 'Took part in research in the last 90 days' },
  { kind: 'industry', label: 'Works in market research or advertising' },
  { kind: 'duplicate', label: 'Duplicate applicant' },
]

export type AudienceDef = {
  /** Completed interviews needed. From the brief's sample size. */
  total: number | null
  totalOrigin: Origin | 'missing'
  /** Why the total is missing, e.g. conflicting figures in the brief. */
  totalNote?: string
  /** Over-recruitment buffer, percent. PRD recommends 10–20%. */
  bufferPct: number
  /** A study has exactly one cohort. Age and the other filters are screening rules, not segments. */
  cohort: Cohort
  exclusions: Exclusion[]
}

// ─── screener ───────────────────────────────────────────────────────────────

export const MAX_QUESTIONS = 7

export type QuestionType = 'single' | 'multi' | 'number' | 'text'
export const questionTypeLabel: Record<QuestionType, string> = {
  single: 'Single choice',
  multi: 'Multiple choice',
  number: 'Number',
  text: 'Short text',
}

export type ScreenerQuestion = {
  id: string
  text: string
  type: QuestionType
  options: string[]
  purpose: string
  origin: Origin
  /** Which audience filter or exclusion this question checks. Used by the screening rules. */
  field?: FilterField | 'industry' | 'brands'
}

export type Screener = {
  status: 'Draft' | 'Ready'
  questions: ScreenerQuestion[]
  generatedAt: string
  fromAudienceVersion: number
  accepted?: { by: string; at: string }
  /** Set when the audience changes after confirmation. */
  review?: { reason: string; at: string; audienceVersion: number; priorStatus: 'Draft' | 'Ready' }
}

// ─── sourcing ───────────────────────────────────────────────────────────────

export type SourceOption = 'manual' | 'external'
export type IdType = 'userId' | 'phone'
export type SourceTag = 'Manual' | 'External'

/** One person added to the pool. Every applicant carries the route they came through. */
export type Candidate = { id: string; value: string; idType: IdType; source: SourceTag; addedAt: string; invitedAt?: string }

export type Sourcing = {
  option: SourceOption
  /** Panel the external IDs came from. The integration is to be confirmed, so IDs are only stored here. */
  panelName: string
  candidates: Candidate[]
}

// ─── document ───────────────────────────────────────────────────────────────

export type AudienceEvent = { id: string; at: string; by: string; version: number; type: 'drafted' | 'confirmed' | 'reopened' }

export type DraftStep = 'read' | 'draft'

export type AudienceDoc = {
  studyId: string
  /** The approved brief version the draft was built from. */
  briefVersion: number
  pending: DraftStep[]
  def: AudienceDef | null
  status: AudienceStatus
  /** The version being drafted, or the last confirmed one. */
  version: number
  confirmed?: { version: number; by: string; at: string; def: AudienceDef }
  events: AudienceEvent[]
  screener: Screener | null
  /** Set when the AI is writing the screener. Confirming the audience starts it; regenerating restarts it. */
  screenerPending?: boolean
  sourcing: Sourcing
  /** Manual screening decisions and verification overrides, with who, when and why. */
  screening?: ScreeningState
  /** The confirmed pool, once R11 is confirmed. */
  pool?: PoolRecord
}

export const emptySourcing = (): Sourcing => ({ option: 'manual', panelName: '', candidates: [] })

// ─── helpers ────────────────────────────────────────────────────────────────

export const invitesFor = (total: number | null, bufferPct: number) => (total ? Math.ceil(total * (1 + bufferPct / 100)) : null)

/** "Women 25–44 with dry or combination skin": the cohort's name, read from its filters. */
export function cohortNameFrom(filters: Filter[]): string {
  const get = (f: FilterField) => filters.find((x) => x.field === f)
  const gender = get('gender')?.value
  const who = gender === 'Female' ? 'Women' : gender === 'Male' ? 'Men' : gender === 'Non-binary' ? 'Non-binary people' : 'People'
  const age = get('age')
  const range = age?.min && age?.max ? ` ${age.min}–${age.max}` : ''
  const skin = get('skinType')?.value.trim()
  const withSkin = skin ? ` with ${skin.toLowerCase()} skin` : ''
  return filters.length ? `${who}${range}${withSkin}` : 'Target audience'
}

/** Reasons Confirm stays disabled. Empty means it can be confirmed. */
export function confirmBlockers(def: AudienceDef): string[] {
  const out: string[] = []
  if (!def.total) out.push('Enter how many completed interviews are needed')
  if (def.cohort.filters.length === 0) out.push('Add at least one filter to say who qualifies')
  if (def.cohort.filters.some((f) => (filterMeta[f.field].input === 'range' ? !f.min || !f.max : !f.value.trim()))) out.push('Fill in or remove empty filters')
  return out
}

/** Counts for the "Pulled from your approved brief" line. */
export function fillCounts(def: AudienceDef) {
  const filled = (def.totalOrigin === 'ai' ? 1 : 0) + def.cohort.filters.filter((f) => f.origin === 'ai').length
  const needInput = (def.total ? 0 : 1) + def.cohort.missing.length + (def.exclusions.length ? 0 : 1)
  return { filled, needInput }
}

export function audienceSummary(doc: AudienceDoc): StudyRecord['audience'] {
  if (!doc.def) return { status: null, version: 0 }
  const c = doc.confirmed
  return {
    status: doc.status,
    version: doc.version,
    approval: doc.status === 'Confirmed' && c ? { by: c.by, at: c.at, version: c.version } : undefined,
  }
}

/** Sections of the brief version that was approved, which is the only input the AI may use. */
export function approvedBriefSections(brief: BriefDoc | undefined): { version: number; sections: Record<SectionKey, SectionSnapshot> } | undefined {
  if (!brief || brief.status !== 'Approved' || !brief.approval) return undefined
  const v = brief.versions.find((x) => x.number === brief.approval!.version)
  return v ? { version: v.number, sections: v.sections } : undefined
}

// ─── AI draft from the approved brief ───────────────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/**
 * Reads only the approved brief. Anything the brief doesn't say stays blank and is flagged.
 * A study has one cohort, whatever the brief says about "splitting": the split is not a quota.
 */
export function draftFromBrief(sections: Record<SectionKey, SectionSnapshot>): AudienceDef {
  const filters: Filter[] = []
  const missing: string[] = []
  const ai = (field: FilterField, value: string, extra: Partial<Filter> = {}) =>
    filters.push({ id: uid('f'), field, value, origin: 'ai', ...extra })

  // Total: a single figure, or blank if the brief gives none or several.
  const sizes = [...sections.sampleSize.text.matchAll(/(\d+)\s+completed interviews?/gi)].map((m) => Number(m[1]))
  const distinct = [...new Set(sizes)]
  const total = distinct.length === 1 ? distinct[0] : null
  const totalNote = distinct.length > 1 ? `The brief gives ${distinct.join(' and ')}` : undefined

  const aud = sections.audience.text
  if (!aud.trim()) missing.push('Target audience')
  else {
    if (/\b(women|female)\b/i.test(aud)) ai('gender', 'Female')
    else if (/\b(men|male)\b/i.test(aud)) ai('gender', 'Male')
    const age = aud.match(/(\d{2})\s*(?:–|-|to)\s*(\d{2})/)
    if (age) ai('age', '', { min: age[1], max: age[2] })
    const skin = aud.match(/\b(dry|oily|combination|normal|sensitive)(?:\s+or\s+(dry|oily|combination|normal|sensitive))?\s+skin/i)
    if (skin) ai('skinType', skin[2] ? `${cap(skin[1])} or ${skin[2].toLowerCase()}` : cap(skin[1]))
    if (/\buses?\b.*moisturizer.*\b(every day|daily)\b|moisturizer (every day|daily)/i.test(aud)) ai('productUsage', 'Uses a facial moisturizer daily')
    const bought = aud.match(/bought one in the last (\d+) months?/i)
    if (bought) ai('purchaseFrequency', `Bought a facial moisturizer in the last ${bought[1]} months`)
  }
  if (/united states|\bUSA?\b/i.test(sections.market.text)) ai('country', 'United States')
  else missing.push('Country (market)')

  const cohort: Cohort = { id: 'c-main', name: cohortNameFrom(filters), nameOrigin: 'ai', filters, missing }

  return { total, totalOrigin: total ? 'ai' : 'missing', totalNote, bufferPct: 15, cohort, exclusions: [] }
}

export function startDraft(studyId: string, briefVersion: number): AudienceDoc {
  return {
    studyId,
    briefVersion,
    pending: ['read', 'draft'],
    def: null,
    status: 'Draft',
    version: 1,
    events: [],
    screener: null,
    sourcing: emptySourcing(),
  }
}

export const draftStepLabel: Record<DraftStep, { running: string; done: string }> = {
  read: { running: 'Reading the approved brief', done: 'Read the approved brief' },
  draft: { running: 'Drafting the cohort and filters', done: 'Drafted the cohort and filters' },
}

export function advanceDraft(doc: AudienceDoc, sections: Record<SectionKey, SectionSnapshot>): AudienceDoc {
  const [head, ...rest] = doc.pending
  if (!head) return doc
  if (head === 'read') return { ...doc, pending: rest }
  const at = now()
  return {
    ...doc,
    pending: rest,
    def: draftFromBrief(sections),
    events: [...doc.events, { id: uid('e'), at, by: AI_NAME, version: doc.version, type: 'drafted' }],
  }
}

// ─── editing and confirming ─────────────────────────────────────────────────

/**
 * Applies an edit. Editing a confirmed audience reopens it: status back to Draft, the next version,
 * Moderator & Guide re-locks (via the study status) and the screener is flagged for review.
 */
export function editDef(doc: AudienceDoc, by: string, fn: (def: AudienceDef) => AudienceDef): AudienceDoc {
  if (!doc.def) return doc
  const def = fn(doc.def)
  if (doc.status !== 'Confirmed') return { ...doc, def }
  const at = now()
  const v = doc.version
  return {
    ...doc,
    def,
    status: 'Draft',
    version: v + 1,
    events: [...doc.events, { id: uid('e'), at, by, version: v + 1, type: 'reopened' }],
    screener: doc.screener && {
      ...doc.screener,
      status: 'Draft',
      review: { reason: `The audience changed after version ${v} was confirmed.`, at, audienceVersion: v, priorStatus: doc.screener.status },
    },
  }
}

/** Throws away edits made since the last confirmation. */
export function discardAudienceChanges(doc: AudienceDoc): AudienceDoc {
  const c = doc.confirmed
  if (!c || doc.status === 'Confirmed') return doc
  const s = doc.screener
  const restoreScreener = s?.review && s.review.audienceVersion === c.version
  return {
    ...doc,
    def: structuredClone(c.def),
    status: 'Confirmed',
    version: c.version,
    events: doc.events.filter((e) => !(e.type === 'reopened' && e.version === c.version + 1)),
    screener: s && restoreScreener ? { ...s, status: s.review!.priorStatus, review: undefined } : s,
  }
}

export function confirmAudience(doc: AudienceDoc, by: string): AudienceDoc {
  if (!doc.def || confirmBlockers(doc.def).length) return doc
  const at = now()
  return {
    ...doc,
    status: 'Confirmed',
    confirmed: { version: doc.version, by, at, def: structuredClone(doc.def) },
    events: [...doc.events, { id: uid('e'), at, by, version: doc.version, type: 'confirmed' }],
    // The AI writes the screener on confirm. An existing one is kept (and was flagged), never silently replaced.
    screenerPending: doc.screener ? doc.screenerPending : true,
  }
}

// Cohort and filter edits, used through editDef.

export const touch = (f: Filter): Filter => ({ ...f, origin: f.origin === 'ai' ? 'edited' : f.origin })

export function newFilter(cohort: Cohort): Filter {
  const used = new Set(cohort.filters.map((f) => f.field))
  const field = FILTER_FIELDS.find((f) => !used.has(f)) ?? 'city'
  return { id: uid('f'), field, value: '', origin: 'added' }
}

// ─── screener ───────────────────────────────────────────────────────────────

/** AI draft of the screener from the audience. Never more than seven questions. */
export function generateQuestions(def: AudienceDef): ScreenerQuestion[] {
  const fields = new Set(def.cohort.filters.map((f) => f.field))
  const range = def.cohort.filters.filter((f) => f.field === 'age').map((f) => `${f.min}–${f.max}`)
  const qs: ScreenerQuestion[] = []
  const add = (q: Omit<ScreenerQuestion, 'id' | 'origin'>) => {
    if (qs.length < MAX_QUESTIONS) qs.push({ ...q, id: uid('q'), origin: 'ai' })
  }

  if (fields.has('age')) add({ field: 'age', text: 'What is your age?', type: 'number', options: [], purpose: `Checks age against the audience (${range.join(', ')}).` })
  if (fields.has('country') || fields.has('state') || fields.has('region') || fields.has('city'))
    add({ field: 'state', text: 'Which US state do you live in?', type: 'single', options: US_STATES, purpose: 'Checks location and places the applicant in a region.' })
  if (fields.has('zip')) add({ field: 'zip', text: 'What is your ZIP code?', type: 'text', options: [], purpose: 'Checks the ZIP code filter.' })
  if (fields.has('gender'))
    add({ field: 'gender', text: 'How do you describe your gender?', type: 'single', options: ['Female', 'Male', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'], purpose: 'Checks the gender filter.' })
  if (fields.has('skinType'))
    add({ field: 'skinType', text: 'How would you describe your skin type?', type: 'single', options: ['Dry', 'Combination', 'Oily', 'Normal', 'Not sure'], purpose: 'Checks the skin type filter.' })
  if (fields.has('productUsage'))
    add({ field: 'productUsage', text: 'How often do you use a facial moisturizer?', type: 'single', options: ['Every day', 'A few times a week', 'About once a week', 'Rarely', 'Never'], purpose: 'Checks product usage.' })
  if (fields.has('purchaseFrequency'))
    add({ field: 'purchaseFrequency', text: 'When did you last buy a facial moisturizer?', type: 'single', options: ['In the last month', '1–3 months ago', '4–6 months ago', 'More than 6 months ago', 'Someone else buys it for me'], purpose: 'Checks purchase frequency.' })
  if (def.exclusions.some((e) => e.kind === 'industry'))
    add({ field: 'industry', text: 'Do you or anyone in your household work in market research, advertising or skincare?', type: 'single', options: ['Yes', 'No'], purpose: 'Applies the “works in market research or advertising” exclusion.' })
  add({
    field: 'brands',
    text: 'Which facial moisturizer brands have you used in the last 3 months?',
    type: 'multi',
    options: ['CeraVe', 'Neutrogena', 'Olay', 'La Roche-Posay', 'Cetaphil', 'Verdane', 'Other', 'None'],
    purpose: 'Checks recent product experience.',
  })
  return qs
}

export function setScreener(doc: AudienceDoc, questions: ScreenerQuestion[]): AudienceDoc {
  return { ...doc, screenerPending: false, screener: { status: 'Draft', questions, generatedAt: now(), fromAudienceVersion: doc.version } }
}

export const startScreener = (doc: AudienceDoc): AudienceDoc => ({ ...doc, screenerPending: true })

/** Any change to the questions puts the screener back in Draft until it's accepted again. */
export function editScreener(doc: AudienceDoc, fn: (qs: ScreenerQuestion[]) => ScreenerQuestion[]): AudienceDoc {
  if (!doc.screener) return doc
  const questions = fn(doc.screener.questions).slice(0, MAX_QUESTIONS)
  return { ...doc, screener: { ...doc.screener, questions, status: 'Draft', accepted: undefined } }
}

export function screenerBlockers(s: Screener): string[] {
  const out: string[] = []
  if (s.questions.length === 0) out.push('Add at least one question')
  if (s.questions.some((q) => !q.text.trim())) out.push('Every question needs wording')
  if (s.questions.some((q) => (q.type === 'single' || q.type === 'multi') && q.options.filter((o) => o.trim()).length < 2))
    out.push('Choice questions need at least two options')
  return out
}

export function acceptScreener(doc: AudienceDoc, by: string): AudienceDoc {
  const s = doc.screener
  if (!s || screenerBlockers(s).length) return doc
  return { ...doc, screener: { ...s, status: 'Ready', accepted: { by, at: now() }, review: undefined } }
}

// ─── sourcing ───────────────────────────────────────────────────────────────

export const idTypeLabel: Record<IdType, string> = { userId: 'User IDs', phone: 'Phone numbers' }
export const idExample: Record<IdType, string> = { userId: 'usr_48213', phone: '(415) 555-0142' }

const USER_ID = /^[A-Za-z0-9_-]{3,}$/

/** Normalizes a US phone number to 10 digits, or returns null. */
const phoneDigits = (v: string) => {
  const d = v.replace(/[\s().+-]/g, '')
  if (!/^\d+$/.test(d)) return null
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  return n.length === 10 ? n : null
}

export const formatPhone = (digits: string) => `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`

export type ParsedIds = { valid: string[]; duplicates: number; blanks: number; invalid: { line: string; reason: string }[] }

/** One entry per line. Drops blanks and duplicates (against the list and within the paste) and flags invalid lines. */
export function parseIds(text: string, idType: IdType, existing: Candidate[]): ParsedIds {
  const seen = new Set(existing.filter((c) => c.idType === idType).map((c) => c.value.toLowerCase()))
  const out: ParsedIds = { valid: [], duplicates: 0, blanks: 0, invalid: [] }
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim()
    if (!line) {
      out.blanks += 1
      return
    }
    let value: string
    if (idType === 'phone') {
      const d = phoneDigits(line)
      if (!d) return void out.invalid.push({ line, reason: 'Not a 10-digit US phone number' })
      value = formatPhone(d)
    } else {
      if (!USER_ID.test(line)) return void out.invalid.push({ line, reason: 'Use 3 or more letters, numbers, _ or -' })
      value = line
    }
    if (seen.has(value.toLowerCase())) {
      out.duplicates += 1
      return
    }
    seen.add(value.toLowerCase())
    out.valid.push(value)
  })
  // Trailing newline in a textarea is not a "blank line" worth reporting.
  if (text.endsWith('\n') || text.endsWith('\r\n')) out.blanks = Math.max(0, out.blanks - 1)
  return out
}

export function editSourcing(doc: AudienceDoc, fn: (s: Sourcing) => Sourcing): AudienceDoc {
  return { ...doc, sourcing: fn(doc.sourcing) }
}

export function addCandidates(doc: AudienceDoc, values: string[], idType: IdType, source: SourceTag): AudienceDoc {
  const at = now()
  return editSourcing(doc, (s) => ({ ...s, candidates: [...s.candidates, ...values.map((value) => ({ id: uid('cd'), value, idType, source, addedAt: at }))] }))
}

export const notInvited = (s: Sourcing) => s.candidates.filter((c) => !c.invitedAt).length
export const invitedCount = (s: Sourcing) => s.candidates.filter((c) => c.invitedAt).length
export const countBySource = (s: Sourcing, source: SourceTag) => s.candidates.filter((c) => c.source === source).length

/** Mock send: invites everyone not invited yet. Phone numbers get a text, user IDs an in-app invite. */
export function sendInvites(doc: AudienceDoc): { doc: AudienceDoc; phones: number; userIds: number } {
  const at = now()
  const open = doc.sourcing.candidates.filter((c) => !c.invitedAt)
  return {
    doc: editSourcing(doc, (s) => ({ ...s, candidates: s.candidates.map((c) => (c.invitedAt ? c : { ...c, invitedAt: at })) })),
    phones: open.filter((c) => c.idType === 'phone').length,
    userIds: open.filter((c) => c.idType === 'userId').length,
  }
}

// ─── saved documents ────────────────────────────────────────────────────────

type OldCohort = { id: string; name: string; filters: Filter[]; missing?: string[] }

/**
 * Audiences saved before a study had exactly one cohort carry a list of cohorts, each with its own number. They become
 * one cohort: the first one's filters, with the age range widened to cover the others. The total is already the target.
 */
export function migrateAudience(doc: AudienceDoc): AudienceDoc {
  const fix = (def: AudienceDef | null | undefined): AudienceDef | null | undefined => {
    const old = def as (AudienceDef & { cohorts?: OldCohort[] }) | null | undefined
    if (!old || old.cohort || !old.cohorts?.length) return def
    const [first, ...rest] = old.cohorts
    const ages = old.cohorts.flatMap((c) => c.filters.filter((f) => f.field === 'age'))
    const lo = Math.min(...ages.map((f) => Number(f.min)).filter(Number.isFinite))
    const hi = Math.max(...ages.map((f) => Number(f.max)).filter(Number.isFinite))
    const filters = first.filters.map((f) => (f.field === 'age' && rest.length && Number.isFinite(lo) && Number.isFinite(hi) ? { ...f, min: String(lo), max: String(hi) } : f))
    const { cohorts: _cohorts, ...keep } = old
    return { ...keep, cohort: { id: 'c-main', name: cohortNameFrom(filters), nameOrigin: 'ai', filters, missing: first.missing ?? [] } }
  }
  type OldPool = { at: string; by: string; members: { applicantId: string }[]; shortfalls?: { have: number; need: number }[]; shortfall?: { have: number; need: number } | null }
  const pool = doc.pool as OldPool | undefined
  const fixedPool: PoolRecord | undefined =
    pool && pool.shortfalls
      ? { at: pool.at, by: pool.by, members: pool.members.map((m) => ({ applicantId: m.applicantId })), shortfall: pool.shortfalls.length ? { have: pool.shortfalls.reduce((n, x) => n + x.have, 0), need: pool.shortfalls.reduce((n, x) => n + x.need, 0) } : null }
      : (doc.pool as PoolRecord | undefined)
  const confirmed = doc.confirmed && { ...doc.confirmed, def: fix(doc.confirmed.def) as AudienceDef }
  return { ...doc, def: fix(doc.def) ?? null, confirmed, pool: fixedPool }
}
