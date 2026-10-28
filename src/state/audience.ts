// Module 2 setup (R6, R7, R8): audience definition, screener and participant sourcing.
// Every operation takes an AudienceDoc and returns a new one; StudyContext stores and persists it.

import type { AudienceStatus } from '@/components/status'
import { US_STATES } from '@/mock/usStates'
import type { StudyRecord } from '@/mock/types'
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

/** A cohort is a quota segment: its participant number is its quota. */
export type Cohort = {
  id: string
  name: string
  filters: Filter[]
  /** Empty until the researcher fills it in; the brief never says how to split. */
  participants: number | null
  participantsOrigin: 'missing' | 'added'
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
  cohorts: Cohort[]
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

export type ScreenerQuestion = { id: string; text: string; type: QuestionType; options: string[]; purpose: string; origin: Origin }

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

export type Contact = { id: string; name: string; email: string; addedAt: string; invitedAt?: string }

export type PanelMember = { id: string; addedAt: string; invitedAt?: string }

export type Sourcing = {
  link: { code: string; createdAt: string; createdBy: string } | null
  contacts: Contact[]
  /** External panel. The integration is to be confirmed, so IDs are only stored here. */
  panel: { name: string; members: PanelMember[] }
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
  sourcing: Sourcing
}

export const emptySourcing = (): Sourcing => ({ link: null, contacts: [], panel: { name: '', members: [] } })

// ─── helpers ────────────────────────────────────────────────────────────────

export const invitesFor = (total: number | null, bufferPct: number) => (total ? Math.ceil(total * (1 + bufferPct / 100)) : null)

export const allocated = (def: AudienceDef) => def.cohorts.reduce((n, c) => n + (c.participants ?? 0), 0)

/** Reasons Confirm stays disabled. Empty means it can be confirmed. */
export function confirmBlockers(def: AudienceDef): string[] {
  const out: string[] = []
  if (!def.total) out.push('Enter how many completed interviews are needed')
  const unfilled = def.cohorts.filter((c) => c.participants === null)
  if (unfilled.length) out.push(`Enter the participant number for ${unfilled.map((c) => c.name || 'each cohort').join(' and ')}`)
  if (def.total && unfilled.length === 0 && allocated(def) !== def.total)
    out.push(`Cohorts add up to ${allocated(def)}, not ${def.total}`)
  if (def.cohorts.some((c) => c.filters.length === 0)) out.push('Every cohort needs at least one filter')
  if (def.cohorts.some((c) => c.filters.some((f) => (filterMeta[f.field].input === 'range' ? !f.min || !f.max : !f.value.trim()))))
    out.push('Fill in or remove empty filters')
  return out
}

/** Counts for the "Pulled from your approved brief" line. */
export function fillCounts(def: AudienceDef) {
  const filled = (def.totalOrigin === 'ai' ? 1 : 0) + def.cohorts.reduce((n, c) => n + c.filters.filter((f) => f.origin === 'ai').length, 0)
  const needInput =
    (def.total ? 0 : 1) +
    def.cohorts.filter((c) => c.participants === null).length +
    def.cohorts.reduce((n, c) => n + c.missing.length, 0) +
    (def.exclusions.length ? 0 : 1)
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
 * Reads only the approved brief. Anything the brief doesn't say stays blank and is flagged:
 * in particular the split across cohorts, which the brief never gives.
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

  // Only split into cohorts if the brief asks for a split; otherwise one cohort. Numbers are never filled.
  const skin = filters.find((f) => f.field === 'skinType')
  const splitBySkin = /split by skin type/i.test(`${sections.sampleSize.text} ${aud}`) && skin && / or /.test(skin.value)
  const cohort = (name: string, fs: Filter[]): Cohort => ({ id: uid('c'), name, filters: fs, participants: null, participantsOrigin: 'missing', missing })
  const cohorts = splitBySkin
    ? skin!.value.split(/\s+or\s+/).map((v) => {
        const value = cap(v)
        return cohort(`${value} skin`, filters.map((f) => (f.field === 'skinType' ? { ...f, id: uid('f'), value } : { ...f, id: uid('f') })))
      })
    : [cohort('All participants', filters)]

  return { total, totalOrigin: total ? 'ai' : 'missing', totalNote, bufferPct: 15, cohorts, exclusions: [] }
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
  draft: { running: 'Drafting cohorts and filters', done: 'Drafted cohorts and filters' },
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
  }
}

// Cohort and filter edits, used through editDef.

export const touch = (f: Filter): Filter => ({ ...f, origin: f.origin === 'ai' ? 'edited' : f.origin })

export function newCohort(def: AudienceDef): Cohort {
  // Starts from the first cohort's filters, keeping their origin, so the researcher only changes what differs.
  const base = def.cohorts[0]
  return {
    id: uid('c'),
    name: `Cohort ${def.cohorts.length + 1}`,
    filters: (base?.filters ?? []).map((f) => ({ ...f, id: uid('f') })),
    participants: null,
    participantsOrigin: 'missing',
    missing: base?.missing ?? [],
  }
}

export function newFilter(cohort: Cohort): Filter {
  const used = new Set(cohort.filters.map((f) => f.field))
  const field = FILTER_FIELDS.find((f) => !used.has(f)) ?? 'city'
  return { id: uid('f'), field, value: '', origin: 'added' }
}

// ─── screener ───────────────────────────────────────────────────────────────

/** AI draft of the screener from the audience. Never more than seven questions. */
export function generateQuestions(def: AudienceDef): ScreenerQuestion[] {
  const fields = new Set(def.cohorts.flatMap((c) => c.filters.map((f) => f.field)))
  const range = def.cohorts.flatMap((c) => c.filters.filter((f) => f.field === 'age')).map((f) => `${f.min}–${f.max}`)
  const qs: ScreenerQuestion[] = []
  const add = (q: Omit<ScreenerQuestion, 'id' | 'origin'>) => {
    if (qs.length < MAX_QUESTIONS) qs.push({ ...q, id: uid('q'), origin: 'ai' })
  }

  if (fields.has('age')) add({ text: 'What is your age?', type: 'number', options: [], purpose: `Checks age against each cohort (${[...new Set(range)].join(', ')}).` })
  if (fields.has('country') || fields.has('state') || fields.has('region') || fields.has('city'))
    add({ text: 'Which US state do you live in?', type: 'single', options: US_STATES, purpose: 'Checks location and places the applicant in a region.' })
  if (fields.has('zip')) add({ text: 'What is your ZIP code?', type: 'text', options: [], purpose: 'Checks the ZIP code filter.' })
  if (fields.has('gender'))
    add({ text: 'How do you describe your gender?', type: 'single', options: ['Female', 'Male', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'], purpose: 'Checks the gender filter.' })
  if (fields.has('skinType'))
    add({ text: 'How would you describe your skin type?', type: 'single', options: ['Dry', 'Combination', 'Oily', 'Normal', 'Not sure'], purpose: 'Checks the skin type filter and places the applicant in a cohort.' })
  if (fields.has('productUsage'))
    add({ text: 'How often do you use a facial moisturizer?', type: 'single', options: ['Every day', 'A few times a week', 'About once a week', 'Rarely', 'Never'], purpose: 'Checks product usage.' })
  if (fields.has('purchaseFrequency'))
    add({ text: 'When did you last buy a facial moisturizer?', type: 'single', options: ['In the last month', '1–3 months ago', '4–6 months ago', 'More than 6 months ago', 'Someone else buys it for me'], purpose: 'Checks purchase frequency.' })
  if (def.exclusions.some((e) => e.kind === 'industry'))
    add({ text: 'Do you or anyone in your household work in market research, advertising or skincare?', type: 'single', options: ['Yes', 'No'], purpose: 'Applies the “works in market research or advertising” exclusion.' })
  add({
    text: 'Which facial moisturizer brands have you used in the last 3 months?',
    type: 'multi',
    options: ['CeraVe', 'Neutrogena', 'Olay', 'La Roche-Posay', 'Cetaphil', 'Verdane', 'Other', 'None'],
    purpose: 'Checks recent product experience.',
  })
  return qs
}

export function setScreener(doc: AudienceDoc, questions: ScreenerQuestion[]): AudienceDoc {
  return { ...doc, screener: { status: 'Draft', questions, generatedAt: now(), fromAudienceVersion: doc.version } }
}

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

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

/** Parses "Name, email" lines (or bare emails). Duplicates are matched by email. */
export function parseContacts(text: string, existing: Contact[]) {
  const seen = new Set(existing.map((c) => c.email.toLowerCase()))
  const added: Contact[] = []
  const invalid: string[] = []
  const duplicates: string[] = []
  const at = now()
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      if (i === 0 && /email/i.test(line) && !EMAIL.test(line.split(/[,;\t]/).pop()!.trim())) return // CSV header
      const parts = line.split(/[,;\t]/).map((p) => p.trim())
      const email = parts.find((p) => EMAIL.test(p))
      if (!email) {
        invalid.push(line)
        return
      }
      if (seen.has(email.toLowerCase())) {
        duplicates.push(email)
        return
      }
      seen.add(email.toLowerCase())
      const name = parts.filter((p) => p !== email).join(' ').trim()
      added.push({ id: uid('ct'), name, email, addedAt: at })
    })
  return { added, invalid, duplicates }
}

export function editSourcing(doc: AudienceDoc, fn: (s: Sourcing) => Sourcing): AudienceDoc {
  return { ...doc, sourcing: fn(doc.sourcing) }
}

export function createLink(doc: AudienceDoc, by: string): AudienceDoc {
  const code = Math.random().toString(36).slice(2, 8)
  return editSourcing(doc, (s) => ({ ...s, link: { code, createdAt: now(), createdBy: by } }))
}

/** Splits pasted panel IDs on commas, spaces or new lines, dropping ones already in the list. */
export function parsePanelIds(text: string, existing: PanelMember[]) {
  const seen = new Set(existing.map((m) => m.id))
  const ids = [...new Set(text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))]
  const added = ids.filter((id) => !seen.has(id))
  return { added, duplicates: ids.length - added.length }
}

export const notInvited = (s: Sourcing) => s.contacts.filter((c) => !c.invitedAt).length + s.panel.members.filter((m) => !m.invitedAt).length
export const invitedCount = (s: Sourcing) => s.contacts.filter((c) => c.invitedAt).length + s.panel.members.filter((m) => m.invitedAt).length

/** Mock send: invites every contact and panel member not invited yet. */
export function sendInvites(doc: AudienceDoc): { doc: AudienceDoc; contacts: number; panel: number } {
  const at = now()
  const contacts = doc.sourcing.contacts.filter((c) => !c.invitedAt).length
  const panel = doc.sourcing.panel.members.filter((m) => !m.invitedAt).length
  return {
    doc: editSourcing(doc, (s) => ({
      ...s,
      contacts: s.contacts.map((c) => (c.invitedAt ? c : { ...c, invitedAt: at })),
      panel: { ...s.panel, members: s.panel.members.map((m) => (m.invitedAt ? m : { ...m, invitedAt: at })) },
    })),
    contacts,
    panel,
  }
}
