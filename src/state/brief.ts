// Module 1 brief: data model and pure operations.
// Every operation takes a BriefDoc and returns a new one; StudyContext stores and persists it.

import type { ArtifactStatus } from '@/components/status'
import type { StudyRecord } from '@/mock/types'

export const AI_NAME = 'PulseAI'

// Seven sections, in this order. See CLAUDE.md and docs/OPEN_QUESTIONS.md #5.
export const SECTION_KEYS = ['objective', 'brand', 'category', 'audience', 'market', 'sampleSize', 'length'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const sectionMeta: Record<SectionKey, { title: string; required?: boolean; needed: string; why: string }> = {
  objective: {
    title: 'Research objective',
    required: true,
    needed: 'What decision should this research help the client make? Ask the client; the AI won’t write this for you.',
    why: 'Required. Sharing is blocked until it’s filled, and the discussion guide is built from it.',
  },
  brand: {
    title: 'Brand context',
    needed: 'A short description of the brand: its positioning, price point and where it sells.',
    why: 'Gives the moderator context for brand questions.',
  },
  category: {
    title: 'Category context',
    needed: 'The category, its main competitors and the trends that matter.',
    why: 'Helps the guide ask about alternatives and switching.',
  },
  audience: {
    title: 'Target audience',
    needed: 'Who to recruit: age, location, product use or buying behaviour.',
    why: 'Module 2 drafts the audience definition and screener from it.',
  },
  market: {
    title: 'Market',
    needed: 'The country where the interviews take place.',
    why: 'Sets where participants are recruited.',
  },
  sampleSize: {
    title: 'Sample size',
    needed: 'How many completed interviews the client needs.',
    why: 'Module 2 sets the participant count and quotas from it.',
  },
  length: {
    title: 'Length of interview',
    needed: 'The target length of each interview, in minutes.',
    why: 'The discussion guide is timed against it.',
  },
}

export type SourceTag = 'Client-provided' | 'AI-generated' | 'Missing'
export type WebSource = { title: string; publisher: string; url: string }
/** A sentence in a section and the exact text in the original input it came from. */
export type SentenceLink = { sentence: string; span: string }
export type Editor = { by: string; at: string }

export type Section = {
  text: string
  source: SourceTag
  /** What the AI produced, e.g. "Web scan synthesis". */
  aiLabel?: string
  /** The AI's original text, kept for "Compare with AI draft". */
  aiOriginal?: string
  /** AI content stays in the AI style until accepted or edited. */
  aiAccepted?: boolean
  sources?: WebSource[]
  links?: SentenceLink[]
  lastEdited: Editor
}
export type Sections = Record<SectionKey, Section>
export type ExtractedSection = Omit<Section, 'lastEdited'>
export type SectionSnapshot = { text: string; source: SourceTag; aiAccepted?: boolean }

export type FollowUpStatus = 'open' | 'answered' | 'skipped' | 'assumed'
export type FollowUp = {
  id: string
  kind: 'missing' | 'conflict'
  section: SectionKey
  question: string
  detail: string
  /** Conflicts only: the assumption the AI proposes, and the text it puts in the section. */
  assumption?: string
  assumedText?: string
  status: FollowUpStatus
  answer?: string
  resolvedBy?: string
  resolvedAt?: string
}

export type InputKind = 'text' | 'file' | 'audio' | 'voice'
export type OriginalInput = {
  kind: InputKind
  label: string
  fileName?: string
  duration?: string
  from?: string
  receivedAt: string
  /** Typed text, email text, extracted file text or transcript. Never edited. */
  text: string
  textLabel: string
}

export type IntakeStep = 'transcribe' | 'extract' | 'webscan' | 'audience' | 'questions' | 'draft'

export type ChatBody =
  | { role: 'researcher'; kind: 'text'; text: string }
  | { role: 'researcher'; kind: 'file'; fileName: string; fileType: string }
  | { role: 'researcher'; kind: 'voice'; duration: string }
  | { role: 'ai'; kind: 'step'; step: IntakeStep; detail: string; items?: string[]; sources?: WebSource[] }
  | { role: 'ai'; kind: 'text'; text: string }
  | { role: 'ai'; kind: 'followups' }
  | { role: 'ai'; kind: 'drafted' }

export type ChatMessage = { id: string; at: string } & ChatBody

export type BriefVersion = {
  number: number
  sections: Record<SectionKey, SectionSnapshot>
  savedBy: string
  savedAt: string
  note: string
}

export type ApprovalMethod = 'Client' | 'Solo'
export type BriefApproval = { by: string; at: string; version: number; method: ApprovalMethod; client?: string }

export type BriefEvent = { id: string; at: string; by: string; version: number } & (
  | { type: 'saved'; note: string }
  | { type: 'shared' }
  | { type: 'changes-requested'; client: string; feedback: string }
  | { type: 'approved'; method: ApprovalMethod; client?: string }
)

export type SampleKey = 'complete' | 'missing-context' | 'audio'

export type BriefDoc = {
  studyId: string
  sampleKey: SampleKey
  original: OriginalInput
  previousResearch: boolean
  chat: ChatMessage[]
  /** Intake steps still to run; the first one is running. */
  pending: IntakeStep[]
  extracted: Record<SectionKey, ExtractedSection>
  followUps: FollowUp[]
  intakeComplete: boolean
  /** The working copy in the editor. Differs from the latest version when there are unsaved changes. */
  draft: Sections | null
  versions: BriefVersion[]
  status: ArtifactStatus
  events: BriefEvent[]
  /** The most recent approval, kept after later edits for the record. */
  approval?: BriefApproval
}

// ─── helpers ────────────────────────────────────────────────────────────────

export const now = () => new Date().toISOString()
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
export const sectionTitle = (k: SectionKey) => sectionMeta[k].title
const listTitles = (keys: SectionKey[]) => keys.map(sectionTitle).join(', ')

/** Splits text into sentences at ., ! or ? followed by whitespace, so "verdane.com" stays whole. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?]["”’)]?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export const snap = (s: Section): SectionSnapshot => ({ text: s.text, source: s.source, aiAccepted: s.aiAccepted })
export const snapAll = (sections: Sections) =>
  Object.fromEntries(SECTION_KEYS.map((k) => [k, snap(sections[k])])) as Record<SectionKey, SectionSnapshot>
const sameSnap = (a: SectionSnapshot, b: SectionSnapshot) =>
  a.text === b.text && a.source === b.source && Boolean(a.aiAccepted) === Boolean(b.aiAccepted)

export const latestVersion = (doc: BriefDoc) => doc.versions.at(-1)

export function changedSections(before: Record<SectionKey, SectionSnapshot>, after: Record<SectionKey, SectionSnapshot>) {
  return SECTION_KEYS.filter((k) => !sameSnap(before[k], after[k]))
}

export function isDirty(doc: BriefDoc) {
  const v = latestVersion(doc)
  if (!v || !doc.draft) return false
  return changedSections(v.sections, snapAll(doc.draft)).length > 0
}

export type SectionState = 'ready' | 'review' | 'missing' | 'conflict'

export function sectionState(doc: BriefDoc, key: SectionKey): SectionState {
  const s = doc.draft?.[key]
  const conflict = doc.followUps.some((f) => f.section === key && f.kind === 'conflict' && (f.status === 'open' || f.status === 'skipped'))
  if (conflict) return 'conflict'
  if (!s || !s.text.trim()) return 'missing'
  if (s.source === 'AI-generated' && !s.aiAccepted) return 'review'
  return 'ready'
}

export function readiness(doc: BriefDoc) {
  const states = Object.fromEntries(SECTION_KEYS.map((k) => [k, sectionState(doc, k)])) as Record<SectionKey, SectionState>
  const objectiveMissing = !doc.draft?.objective.text.trim()
  const dirty = isDirty(doc)
  const blockers: string[] = []
  if (!doc.intakeComplete) blockers.push('The brief hasn’t been drafted yet')
  if (objectiveMissing) blockers.push('Research objective is empty')
  if (dirty) blockers.push('You have unsaved changes. Save a version first')
  return {
    states,
    readyCount: SECTION_KEYS.filter((k) => states[k] === 'ready').length,
    objectiveMissing,
    dirty,
    canShare: blockers.length === 0,
    blockers,
  }
}

export const approvedVersions = (doc: BriefDoc) =>
  new Set(doc.events.filter((e) => e.type === 'approved').map((e) => e.version))

/** The client's latest change request, if the brief hasn't been re-shared since. */
export function openChangeRequest(doc: BriefDoc) {
  const lastRequest = doc.events.findLastIndex((e) => e.type === 'changes-requested')
  if (lastRequest < 0) return undefined
  const sharedSince = doc.events.slice(lastRequest + 1).some((e) => e.type === 'shared' || e.type === 'approved')
  const e = doc.events[lastRequest]
  return !sharedSince && e.type === 'changes-requested' ? e : undefined
}

/** The brief's summary on the study record, which drives the stepper. */
export function briefSummary(doc: BriefDoc): StudyRecord['brief'] {
  const v = latestVersion(doc)
  if (!v) return { status: null, version: 0 }
  const a = doc.approval
  return {
    status: doc.status,
    version: v.number,
    approval:
      doc.status === 'Approved' && a
        ? { by: a.by, onBehalfOf: a.method === 'Client' && a.client ? `${a.client} (client)` : undefined, at: a.at, version: a.version }
        : undefined,
  }
}

// ─── intake ─────────────────────────────────────────────────────────────────

export type BriefSample = {
  key: SampleKey
  label: string
  description: string
  original: OriginalInput
  extracted: Record<SectionKey, ExtractedSection>
  followUps: Omit<FollowUp, 'status'>[]
  previousResearch: boolean
}

export function startIntake(studyId: string, sample: BriefSample, original: OriginalInput, first: ChatMessage): BriefDoc {
  const ex = sample.extracted
  const pending: IntakeStep[] = []
  if (original.kind === 'audio' || original.kind === 'voice') pending.push('transcribe')
  pending.push('extract')
  if (ex.brand.source === 'AI-generated' || ex.category.source === 'AI-generated') pending.push('webscan')
  if (ex.audience.source === 'AI-generated') pending.push('audience')
  if (sample.followUps.length) pending.push('questions')
  pending.push('draft')

  return {
    studyId,
    sampleKey: sample.key,
    original,
    previousResearch: sample.previousResearch,
    chat: [first],
    pending,
    extracted: structuredClone(ex),
    followUps: sample.followUps.map((f) => ({ ...f, status: 'open' })),
    intakeComplete: false,
    draft: null,
    versions: [],
    status: 'Draft',
    events: [],
  }
}

export const runningLabel: Record<IntakeStep, string> = {
  transcribe: 'Transcribing the recording',
  extract: 'Extracting brief sections',
  webscan: 'Scanning the web for brand and category context',
  audience: 'Suggesting a target audience',
  questions: 'Waiting for your answers',
  draft: 'Drafting the brief',
}

export const doneLabel: Record<IntakeStep, string> = {
  transcribe: 'Transcribed the recording',
  extract: 'Extracted brief sections',
  webscan: 'Web scan complete',
  audience: 'Suggested a target audience',
  questions: 'Questions answered',
  draft: 'Drafted the brief',
}

export const stepDelay: Record<IntakeStep, number> = {
  transcribe: 1700,
  extract: 1200,
  webscan: 1600,
  audience: 1100,
  questions: 600,
  draft: 1300,
}

function applyResolution(section: Section, f: FollowUp): Section {
  const lastEdited = { by: f.resolvedBy ?? AI_NAME, at: f.resolvedAt ?? now() }
  if (f.status === 'answered' && f.answer) return { ...section, text: f.answer, source: 'Client-provided', lastEdited }
  if (f.status === 'assumed' && f.assumedText) return { ...section, text: f.assumedText, source: 'Client-provided', lastEdited }
  return section
}

/** Runs the first pending intake step. */
export function advance(doc: BriefDoc): BriefDoc {
  const [head, ...rest] = doc.pending
  if (!head) return doc
  const at = now()
  const ai = (m: Extract<ChatBody, { role: 'ai' }>): ChatMessage => ({ id: uid('m'), at, ...m })
  const ex = doc.extracted

  switch (head) {
    case 'transcribe':
      return {
        ...doc,
        pending: rest,
        chat: [
          ...doc.chat,
          ai({
            role: 'ai',
            kind: 'step',
            step: 'transcribe',
            detail: `Transcribed ${doc.original.duration ? `${doc.original.duration} of audio` : 'the recording'}. The original recording is kept, unchanged, with the brief.`,
          }),
        ],
      }

    case 'extract': {
      const found = SECTION_KEYS.filter((k) => ex[k].source === 'Client-provided')
      const missing = SECTION_KEYS.filter((k) => ex[k].source !== 'Client-provided')
      const conflicts = doc.followUps.filter((f) => f.kind === 'conflict').map((f) => f.section)
      const items = [
        `In the input: ${listTitles(found)}`,
        missing.length ? `Not in the input: ${listTitles(missing)}` : '',
        conflicts.length ? `Conflicting details: ${listTitles(conflicts)}` : '',
        doc.previousResearch ? 'Previous research is mentioned. It stays in the original input.' : '',
      ].filter(Boolean)
      return {
        ...doc,
        pending: rest,
        chat: [...doc.chat, ai({ role: 'ai', kind: 'step', step: 'extract', detail: `Found ${found.length} of 7 sections in the input.`, items })],
      }
    }

    case 'webscan': {
      const scanned = (['brand', 'category'] as const).filter((k) => ex[k].source === 'AI-generated')
      return {
        ...doc,
        pending: rest,
        chat: [
          ...doc.chat,
          ai({
            role: 'ai',
            kind: 'step',
            step: 'webscan',
            detail: `${listTitles([...scanned])} ${scanned.length > 1 ? 'weren’t' : 'wasn’t'} in the input, so I scanned the web and wrote a synthesis for you to review.`,
            sources: scanned.flatMap((k) => ex[k].sources ?? []),
          }),
        ],
      }
    }

    case 'audience':
      return {
        ...doc,
        pending: rest,
        chat: [
          ...doc.chat,
          ai({ role: 'ai', kind: 'step', step: 'audience', detail: 'There was no target audience in the input, so I’ve suggested one for you to review.' }),
        ],
      }

    case 'questions': {
      const posted = doc.chat.some((m) => m.kind === 'followups')
      if (!posted) {
        const n = doc.followUps.length
        return {
          ...doc,
          chat: [
            ...doc.chat,
            ai({
              role: 'ai',
              kind: 'text',
              text: n === 1 ? 'One thing needs your input before I draft. I won’t guess it.' : `${n} things need your input before I draft. I won’t guess these.`,
            }),
            ai({ role: 'ai', kind: 'followups' }),
          ],
        }
      }
      if (doc.followUps.some((f) => f.status === 'open')) return doc
      return { ...doc, pending: rest }
    }

    case 'draft': {
      const draft = Object.fromEntries(
        SECTION_KEYS.map((k) => {
          let s: Section = { ...ex[k], lastEdited: { by: AI_NAME, at } }
          for (const f of doc.followUps.filter((f) => f.section === k)) s = applyResolution(s, f)
          return [k, s]
        }),
      ) as Sections
      const v1: BriefVersion = { number: 1, sections: snapAll(draft), savedBy: AI_NAME, savedAt: at, note: 'AI draft from intake' }
      const flagged = doc.followUps.filter((f) => f.status === 'skipped').length
      return {
        ...doc,
        pending: rest,
        draft,
        versions: [v1],
        status: 'Draft',
        intakeComplete: true,
        events: [...doc.events, { id: uid('e'), at, by: AI_NAME, version: 1, type: 'saved', note: v1.note }],
        chat: [
          ...doc.chat,
          ai({
            role: 'ai',
            kind: 'step',
            step: 'draft',
            detail: `Drafted the brief as version 1. AI-generated sections stay marked until you accept or edit them.${flagged ? ` ${flagged} skipped ${flagged === 1 ? 'item stays' : 'items stay'} flagged.` : ''}`,
          }),
          ai({ role: 'ai', kind: 'drafted' }),
        ],
      }
    }
  }
}

// ─── editing ────────────────────────────────────────────────────────────────

export function resolveFollowUp(doc: BriefDoc, id: string, status: Exclude<FollowUpStatus, 'open'>, by: string, answer?: string): BriefDoc {
  const at = now()
  let updated: FollowUp | undefined
  const followUps = doc.followUps.map((f) => {
    if (f.id !== id) return f
    updated = { ...f, status, answer: status === 'answered' ? answer?.trim() : f.answer, resolvedBy: by, resolvedAt: at }
    return updated
  })
  if (!updated) return doc
  const draft = doc.draft && status !== 'skipped' ? { ...doc.draft, [updated.section]: applyResolution(doc.draft[updated.section], updated) } : doc.draft
  return { ...doc, followUps, draft }
}

export function editSection(doc: BriefDoc, key: SectionKey, text: string, by: string): BriefDoc {
  if (!doc.draft) return doc
  const at = now()
  const s = doc.draft[key]
  const trimmed = text.trim()
  // Filling a missing section records it as client-provided: the researcher is entering the client's requirement.
  // See docs/OPEN_QUESTIONS.md #8.
  const source: SourceTag = !trimmed ? 'Missing' : s.source === 'Missing' ? 'Client-provided' : s.source
  const next: Section = {
    ...s,
    text: trimmed,
    source,
    aiAccepted: source === 'AI-generated' ? true : s.aiAccepted,
    lastEdited: { by, at },
  }
  const followUps = trimmed
    ? doc.followUps.map((f) =>
        f.section === key && (f.status === 'open' || f.status === 'skipped')
          ? { ...f, status: 'answered' as const, answer: trimmed, resolvedBy: by, resolvedAt: at }
          : f,
      )
    : doc.followUps
  return { ...doc, followUps, draft: { ...doc.draft, [key]: next } }
}

export function acceptAI(doc: BriefDoc, key: SectionKey, by: string): BriefDoc {
  if (!doc.draft) return doc
  return { ...doc, draft: { ...doc.draft, [key]: { ...doc.draft[key], aiAccepted: true, lastEdited: { by, at: now() } } } }
}

export function discardChanges(doc: BriefDoc): BriefDoc {
  const v = latestVersion(doc)
  if (!v || !doc.draft) return doc
  const draft = { ...doc.draft }
  for (const k of SECTION_KEYS) draft[k] = { ...draft[k], ...v.sections[k] }
  return { ...doc, draft }
}

export function saveVersion(doc: BriefDoc, by: string): BriefDoc {
  const prev = latestVersion(doc)
  if (!prev || !doc.draft) return doc
  const at = now()
  const sections = snapAll(doc.draft)
  const changed = changedSections(prev.sections, sections)
  const v: BriefVersion = {
    number: prev.number + 1,
    sections,
    savedBy: by,
    savedAt: at,
    note: changed.length ? `Edited ${listTitles(changed)}` : 'No changes',
  }
  return {
    ...doc,
    versions: [...doc.versions, v],
    status: 'Draft',
    events: [...doc.events, { id: uid('e'), at, by, version: v.number, type: 'saved', note: v.note }],
  }
}

/** Downloading the brief to send it moves a Draft to In Review. */
export function markShared(doc: BriefDoc, by: string): BriefDoc {
  const v = latestVersion(doc)
  if (!v) return doc
  return {
    ...doc,
    status: doc.status === 'Draft' ? 'In Review' : doc.status,
    events: [...doc.events, { id: uid('e'), at: now(), by, version: v.number, type: 'shared' }],
  }
}

/** Records the client's feedback and opens a new version to edit. */
export function requestChanges(doc: BriefDoc, by: string, client: string, feedback: string): BriefDoc {
  const v = latestVersion(doc)
  if (!v) return doc
  const at = now()
  const next: BriefVersion = {
    number: v.number + 1,
    sections: v.sections,
    savedBy: by,
    savedAt: at,
    note: `Reopened after ${client} requested changes to version ${v.number}`,
  }
  return {
    ...doc,
    status: 'Draft',
    versions: [...doc.versions, next],
    events: [
      ...doc.events,
      { id: uid('e'), at, by, version: v.number, type: 'changes-requested', client, feedback: feedback.trim() },
      { id: uid('e'), at, by, version: next.number, type: 'saved', note: next.note },
    ],
  }
}

export function approve(doc: BriefDoc, by: string, method: ApprovalMethod, client?: string): BriefDoc {
  const v = latestVersion(doc)
  if (!v) return doc
  const at = now()
  return {
    ...doc,
    status: 'Approved',
    approval: { by, at, version: v.number, method, client },
    events: [...doc.events, { id: uid('e'), at, by, version: v.number, type: 'approved', method, client }],
  }
}
