// Module 4.1 (R15, R16, R17): entry contract, study plan compile, test runs, preflight and the release lock.
// Everything the researcher sees is computed live from the brief, audience, guide and the LaunchDoc below,
// so a fix in an earlier module shows up the next time a launch screen renders.

import { surveysOf, acceptedOf, acceptedStandby, agentName, allQuestions, configBlockers, coverage, humanNames, languageMismatches, moderatorKey, pendingOf, standbyOf, totalMinutes, windowWeeks, type GuideDoc, type Question } from './guide'
import { openSlots } from './standby'
import { STANDBY_SLOT_MIN } from '@/mock/moderation'
import type { AudienceDoc } from './audience'
import { now, uid } from './brief'
import { lengthMismatch, rewardComplete, rewardLine, rewardOf, studyCountry } from './reward'
import type { StudyRecord } from '@/mock/types'

// ─── setup (values no earlier module owns; R23 takes these over in Phase 9) ──

/** Device profiles supported at launch. Open question: which ones a study really supports. */
export const DEVICES = ['Mobile', 'Desktop'] as const
export type Device = (typeof DEVICES)[number]

export const EXTRA_LANGUAGES = ['Spanish (US)', 'French (Canada)']

export type ConsentWording = { text: string; approved: boolean; by?: string; at?: string; origin: 'researcher' | 'ai' }
export type LaunchLink = { id: string; label: string; url: string; ok: boolean }

export type Setup = {
  /** Languages beyond the one chosen in R12. */
  extraLanguages: string[]
  consent: Record<string, ConsentWording>
  fieldwork: { start: string; end: string } | null
  /** Whether the guide has been translated, per extra language. */
  translated: Record<string, boolean>
  links: LaunchLink[]
}

export function consentTemplate(language: string, client: string): string {
  if (language.startsWith('Spanish'))
    return `Acepto participar en este estudio de investigación para ${client}. Mi video, mi audio y mis respuestas se grabarán y se usarán solo para investigación. Puedo detener la entrevista en cualquier momento. Tengo 18 años o más.`
  return `I agree to take part in this research study for ${client}. My video, audio and answers will be recorded and used only for research. I can stop at any time. I am 18 or older.`
}

export const defaultLinks = (): LaunchLink[] => [
  { id: 'l-privacy', label: 'Consent and privacy notice', url: 'https://verdane.example/privacy', ok: true },
  { id: 'l-incentive', label: 'Incentive terms', url: 'https://verdane.example/incentive-terms', ok: true },
  { id: 'l-support', label: 'Participant support page', url: 'https://verdane.example/support', ok: true },
]

// ─── runs ───────────────────────────────────────────────────────────────────

export type RunStatus = 'Not run' | 'In progress' | 'Completed' | 'Issues found'
export type IssueCategory = 'Media rendering' | 'Translations' | 'Links' | 'Consent language' | 'Question coverage'
export const ISSUE_CATEGORIES: IssueCategory[] = ['Media rendering', 'Translations', 'Links', 'Consent language', 'Question coverage']

export type RunIssue = { id: string; category: IssueCategory; text: string; at: string; by: string }
export type RunReport = {
  mandatoryCovered: number
  mandatoryTotal: number
  durationMin: number
  targetMin: number
  stimuli: { name: string; ok: boolean }[]
  surveysCompleted: number
  surveysTotal: number
  note: string
  issues: RunIssue[]
}
/**
 * Set when the Researcher marked a run complete although its report showed problems. The report is information; the
 * decision is theirs. It records who, when and how many problems were showing.
 */
export type Acknowledged = { by: string; at: string; problems: number }
export type Run = { status: RunStatus; guideVersion: number; at?: string; report?: RunReport; acknowledged?: Acknowledged }

export const runKey = (language: string, device: Device) => `${language}|${device}`

export type Override = { reason: string; by: string; at: string; signature: string }

export type Release = {
  number: number
  version: string
  by: string
  at: string
  guideVersion: number
  moderator: string
  language: string
  stimuli: { id: string; name: string }[]
  planSignature: string
}

export type LaunchDoc = {
  studyId: string
  setup: Setup
  runs: Record<string, Run>
  overrides: Partial<Record<CheckId, Override>>
  compiled?: { guideVersion: number; signature: string; at: string }
  release?: Release
  releases: Release[]
}

export const emptyLaunchDoc = (studyId: string): LaunchDoc => ({
  studyId,
  setup: { extraLanguages: [], consent: {}, fieldwork: null, translated: {}, links: defaultLinks() },
  runs: {},
  overrides: {},
  releases: [],
})

export const editSetup = (doc: LaunchDoc, fn: (s: Setup) => Setup): LaunchDoc => ({ ...doc, setup: fn(doc.setup) })

// ─── inputs ─────────────────────────────────────────────────────────────────

/** `language` is the study language, read from the brief's market. Null until the brief gives one. */
export type Inputs = { study: StudyRecord; audience?: AudienceDoc; guide?: GuideDoc; launch?: LaunchDoc; language: string | null }

/** The study language first, then the extra languages added in the setup drawer. */
export const supportedLanguages = (language: string | null, l?: LaunchDoc) => [...(language ? [language] : []), ...(l?.setup.extraLanguages ?? []).filter((x) => x !== language)]


// ─── compile ────────────────────────────────────────────────────────────────

export type PlanItem = {
  id: string
  n: number
  text: string
  core: boolean
  probes: number
  banned: number
  maxFollowUps: number | null
  stimulus?: string
  survey?: string
  branch?: string
}
export type PlanSection = { title: string; minutes: number; items: PlanItem[] }
export type StudyPlan = {
  guideVersion: number
  mode: 'ai' | 'human'
  moderator: string
  language: string
  durationMin: number
  sections: PlanSection[]
  wrapUp: string[]
  mandatoryCount: number
  surveyCount: number
  /** Whether a participant in an AI-led interview can ask to talk to a person, and who they can book. Absent in plans compiled before standby moderators existed. */
  escalation?: { offered: boolean; slotMinutes: number; moderators: { id: string; name: string }[] }
  signature: string
}
export type CompileError = { text: string; questionId?: string }
export type CompileResult = { state: 'waiting'; reason: string } | { state: 'failed'; errors: CompileError[] } | { state: 'ok'; plan: StudyPlan }

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export const moderatorLabel = (g: GuideDoc) =>
  g.moderator.mode === 'ai'
    ? `${agentName(g.moderator.agentId) ?? 'AI agent'}, ${g.moderator.style ?? 'style not set'} style`
    : humanNames(g.moderator).join(', ') || 'No moderator assigned'

/** Turns the approved guide into the plan the interview runs from. Pure, so it recompiles whenever the guide changes. */
export function compileStudyPlan(g: GuideDoc | undefined, language: string | null): CompileResult {
  if (!g?.guide) return { state: 'waiting', reason: 'There is no guide yet.' }
  if (!language) return { state: 'waiting', reason: 'The study language isn’t set. Add your market in the brief.' }
  if (g.status !== 'Approved') return { state: 'waiting', reason: `Guide version ${g.version} is ${g.status === 'Draft' ? 'a Draft' : 'In Review'}. Only an approved guide is compiled.` }
  const guide = g.guide
  const qs = allQuestions(guide)
  const num = (id: string) => qs.findIndex((q) => q.id === id) + 1
  const errors: CompileError[] = []
  if (qs.length === 0) errors.push({ text: 'The guide has no questions.' })
  qs.forEach((q) => {
    const n = num(q.id)
    if (q.mandatory && !q.text.trim()) errors.push({ text: `Q${n} is mandatory but has no wording.`, questionId: q.id })
    if (q.stimulusId) {
      const s = g.stimuli.items.find((x) => x.id === q.stimulusId)
      if (!s) errors.push({ text: `Q${n} shows a stimulus that is no longer in the library.`, questionId: q.id })
      else if (!s.active) errors.push({ text: `Q${n} shows “${s.name}”, which was deselected and is not in the active set.`, questionId: q.id })
    }
    if (q.surveyId && (g.moderator.mode !== 'ai' || !surveysOf(g).some((s) => s.id === q.surveyId)))
      errors.push({ text: `Q${n} runs a survey that is not part of the moderator setup.`, questionId: q.id })
    if (q.branch && (!qs.some((x) => x.id === q.branch!.ifQuestionId) || !qs.some((x) => x.id === q.branch!.targetId)))
      errors.push({ text: `Q${n} has a branching rule that points at a question that no longer exists.`, questionId: q.id })
  })
  if (errors.length) return { state: 'failed', errors }

  const item = (q: Question): PlanItem => ({
    id: q.id,
    n: num(q.id),
    text: q.text,
    core: q.mandatory,
    probes: q.probes.filter((p) => p.trim()).length,
    banned: q.banned.filter((p) => p.trim()).length,
    maxFollowUps: q.maxFollowUps,
    stimulus: q.stimulusId ? g.stimuli.items.find((s) => s.id === q.stimulusId)?.name : undefined,
    survey: q.surveyId ? surveysOf(g).find((s) => s.id === q.surveyId)?.title : undefined,
    branch: q.branch ? `If the answer to Q${num(q.branch.ifQuestionId)} is “${q.branch.answer || '…'}”, ${q.branch.action === 'skip-to' ? 'skip to' : 'branch to'} Q${num(q.branch.targetId)}` : undefined,
  })
  const body = {
    guideVersion: g.version,
    mode: g.moderator.mode ?? 'ai',
    moderator: moderatorLabel(g),
    language,
    durationMin: g.moderator.durationMin,
    sections: guide.sections.map((s) => ({ title: s.title, minutes: s.minutes, items: s.questions.map(item) })),
    wrapUp: guide.wrapUp.filter((w) => w.trim()),
    mandatoryCount: qs.filter((q) => q.mandatory).length,
    surveyCount: new Set(qs.map((q) => q.surveyId).filter(Boolean)).size,
    escalation: {
      offered: g.moderator.mode === 'ai' && acceptedStandby(g.moderator).length > 0,
      slotMinutes: STANDBY_SLOT_MIN,
      moderators: g.moderator.mode === 'ai' ? acceptedStandby(g.moderator).map((t) => ({ id: moderatorKey(t), name: t.name })) : [],
    },
  }
  return { state: 'ok', plan: { ...body, signature: hash(JSON.stringify(body)) } }
}

// ─── entry contract (R15) ───────────────────────────────────────────────────

export type RowOwner = 'R8' | 'R11' | 'R12' | 'R13' | 'R14' | 'setup'
/** `warn` is an amber note on a row that still passes: it doesn't block, but the Researcher should read it. */
export type Row = { id: string; label: string; value: string; ok: boolean; owner: RowOwner; hint?: string; warn?: string }

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export { fmtDay }

export function entryContract(i: Inputs): Row[] {
  const g = i.guide
  const rows: Row[] = []

  const approved = g?.status === 'Approved' && !!g.approved
  rows.push({
    id: 'guide',
    label: 'Approved guide',
    owner: 'R14',
    ok: approved,
    value: approved
      ? `Version ${g!.approved!.version}, approved by ${g!.approved!.by}, ${fmtDay(g!.approved!.at.slice(0, 10))}`
      : g?.guide
        ? `Version ${g.version} is ${g.status === 'Draft' ? 'a Draft' : 'In Review'}`
        : 'No guide yet',
    hint: approved ? undefined : 'Approve the guide first.',
  })

  const blockers = g ? configBlockers(g.moderator, i.language) : ['Set up the moderator']
  const human = g?.moderator.mode === 'human'
  // A human-led study can't launch until somebody has accepted. Short cover or invitations still pending only warn.
  const noAccepted = human && !!g && blockers.length === 0 && acceptedOf(g.moderator).length === 0
  const cover = human && g ? coverage(g.moderator, i.audience?.def?.total ?? null, windowWeeks(i.launch?.setup.fieldwork)) : undefined
  const pending = human && g ? pendingOf(g.moderator).length : 0
  const mismatch = human && g ? languageMismatches(g.moderator, i.language) : []
  const warns = [
    cover?.short ? `Added moderators have ${cover.available} hours. About ${cover.needed} are needed.` : '',
    pending ? `${pending} ${pending === 1 ? 'invitation is' : 'invitations are'} still pending, so ${pending === 1 ? 'that person doesn’t' : 'those people don’t'} count yet.` : '',
    mismatch.length ? `${mismatch.map((x) => x.name).join(', ')} ${mismatch.length === 1 ? 'doesn’t' : 'don’t'} speak ${i.language}.` : '',
  ].filter(Boolean)
  rows.push({
    id: 'moderator',
    label: 'Moderator',
    owner: 'R12',
    ok: !!g && blockers.length === 0 && !noAccepted,
    value:
      g && blockers.length === 0
        ? g.moderator.mode === 'ai'
          ? `AI: ${moderatorLabel(g)}, ${i.language}, ${g.moderator.durationMin} min`
          : noAccepted
            ? 'No moderator counts yet. Invited people count once they accept.'
            : `Human: ${moderatorLabel(g)}, ${g.moderator.durationMin} min`
        : `Missing: ${blockers.join(', ').toLowerCase()}`,
    warn: !noAccepted && warns.length ? warns.join(' ') : undefined,
  })

  // AI-led only. Optional, so it never blocks: it says whether a participant can ask for a human, and who they would book.
  if (g?.moderator.mode === 'ai') {
    const on = acceptedStandby(g.moderator)
    const waiting = standbyOf(g.moderator).filter((t) => t.status === 'Requested' || t.status === 'Invited').length
    const times = on.length ? openSlots(on.map((t) => ({ id: moderatorKey(t), name: t.name })), now()).length : 0
    rows.push({
      id: 'standby',
      label: 'Human standby',
      owner: 'R12',
      ok: true,
      value: on.length
        ? `${on.map((t) => t.name).join(', ')} on standby, ${times} open ${times === 1 ? 'time' : 'times'} in the next 7 days`
        : waiting
          ? `Not offered yet, ${waiting} ${waiting === 1 ? 'invitation' : 'invitations'} waiting to be accepted`
          : 'Not offered. Participants can’t ask for a human.',
      warn: on.length && times === 0 ? 'No open times this week, so a participant who asks for a human can only request a time.' : undefined,
    })
  }

  const def = i.audience?.def
  const pool = i.audience?.pool
  const targetOk = !!def && !!def.total
  const short = pool && def?.total ? Math.max(0, def.total - pool.members.length) : 0
  rows.push({
    id: 'pool',
    label: 'Qualified pool and target',
    owner: 'R11',
    ok: !!pool && targetOk,
    value: !pool ? 'The pool isn’t finalized' : !targetOk ? 'The number of participants needed isn’t set' : `${pool.members.length} of ${def!.total} in the pool, ${pool.reserve?.length ?? 0} in the reserve`,
    // Finalized below the target: the row passes but is amber, with the shortfall and the reason given.
    warn: pool && targetOk && short > 0 ? `${short} short of the target${pool.reason ? `: “${pool.reason.replace(/\.$/, '')}”` : '.'}` : undefined,
  })

  const reward = rewardOf(i.audience, g?.moderator.durationMin ?? null)
  const rewardText = reward.offered ? rewardLine(reward, studyCountry(i.audience)) : 'No reward. Participant copy leaves the reward line out.'
  rows.push({
    id: 'reward',
    label: 'Participant reward',
    owner: 'R8',
    ok: rewardComplete(reward),
    value: rewardComplete(reward) ? (rewardText ?? 'No reward') : 'The reward isn’t set',
    warn: reward.offered && rewardComplete(reward) ? (lengthMismatch(reward.promisedMin, g?.moderator.durationMin ?? null) ?? undefined) : undefined,
  })

  const fw = i.launch?.setup.fieldwork
  rows.push({
    id: 'fieldwork',
    label: 'Fieldwork window',
    owner: 'setup',
    ok: !!fw && fw.end >= fw.start && !!fw.start,
    value: fw ? (fw.end >= fw.start ? `${fmtDay(fw.start)} – ${fmtDay(fw.end)}` : 'The end date is before the start date') : 'Not set',
  })

  // Only the approval status is shown here, never the wording. The wording is edited in the study setup drawer.
  const langs = supportedLanguages(i.language, i.launch)
  const consent = i.launch?.setup.consent ?? {}
  const missing = langs.filter((l) => !consent[l]?.approved)
  rows.push({
    id: 'consent',
    label: 'Consent',
    owner: 'setup',
    ok: !!i.launch && missing.length === 0,
    value: missing.length ? `Not approved: ${missing.join(', ')}` : `Approved for ${langs.join(', ')}`,
  })
  return rows
}

// ─── test runs (R16) ────────────────────────────────────────────────────────

/** A run only counts for the guide version it ran against. */
export function runFor(l: LaunchDoc | undefined, language: string, device: Device, guideVersion: number): Run {
  const r = l?.runs[runKey(language, device)]
  return r && r.guideVersion === guideVersion ? r : { status: 'Not run', guideVersion }
}

/**
 * What a matrix cell shows. A run is tied to the guide version it ran against: when the guide has moved on, the cell
 * reads "Out of date" (and says which version it ran on) and needs another run. It doesn't count as finished.
 */
export type CellState = { kind: 'not-run' | 'in-progress' | 'completed' | 'issues' | 'out-of-date'; run?: Run; ranOn?: number }

export function cellState(l: LaunchDoc | undefined, language: string, device: Device, guideVersion: number): CellState {
  const r = l?.runs[runKey(language, device)]
  if (!r || r.status === 'Not run') return { kind: 'not-run' }
  if (r.guideVersion !== guideVersion) return r.status === 'Completed' || r.status === 'Issues found' ? { kind: 'out-of-date', run: r, ranOn: r.guideVersion } : { kind: 'not-run' }
  return { kind: r.status === 'Completed' ? 'completed' : r.status === 'Issues found' ? 'issues' : 'in-progress', run: r }
}

export function runProgress(l: LaunchDoc | undefined, languages: string[], guideVersion: number) {
  const runs = languages.flatMap((lang) => DEVICES.map((d) => runFor(l, lang, d, guideVersion)))
  const finished = runs.filter((r) => r.status === 'Completed' || r.status === 'Issues found')
  return { total: runs.length, finished: finished.length, issues: runs.filter((r) => r.status === 'Issues found').length, all: finished.length === runs.length && runs.length > 0 }
}

export function setRun(doc: LaunchDoc, key: string, run: Run): LaunchDoc {
  return { ...doc, runs: { ...doc.runs, [key]: run } }
}

/** What a simulated run finds, worked out from the real plan and setup. */
export function buildRunReport(i: Inputs & { plan: StudyPlan }, language: string, device: Device): RunReport {
  const g = i.guide!
  const issues: RunIssue[] = []
  const issue = (category: IssueCategory, text: string) => issues.push({ id: uid('ri'), category, text, at: now(), by: 'Test run' })
  const used = new Set(i.plan.sections.flatMap((s) => s.items.map((x) => x.stimulus)).filter(Boolean))
  const stimuli = g.stimuli.items.filter((s) => s.active && used.has(s.name)).map((s) => ({ name: s.name, ok: s.renderOk !== false }))
  stimuli.filter((s) => !s.ok).forEach((s) => issue('Media rendering', `“${s.name}” failed to load on ${device}.`))
  if (language !== i.language && !i.launch?.setup.translated[language]) issue('Translations', `The guide has no ${language} text. Participants would see English.`)
  if (!i.launch?.setup.consent[language]?.approved) issue('Consent language', `No approved consent wording for ${language}.`)
  i.launch?.setup.links.filter((l) => !l.ok).forEach((l) => issue('Links', `“${l.label}” does not open.`))
  // Mobile screens run a little longer, which the duration line shows.
  const durationMin = i.plan.durationMin + (device === 'Mobile' ? 0 : 1)
  return {
    mandatoryCovered: i.plan.mandatoryCount,
    mandatoryTotal: i.plan.mandatoryCount,
    durationMin: Math.min(durationMin, totalMinutes(g.guide!)),
    targetMin: i.plan.durationMin,
    stimuli,
    surveysCompleted: i.plan.surveyCount,
    surveysTotal: i.plan.surveyCount,
    note: '',
    issues,
  }
}

/** The Researcher's verdict on a run: Mark complete, or Report an issue. Only then does the matrix change. */
export function recordRun(doc: LaunchDoc, key: string, guideVersion: number, report: RunReport, outcome: 'Completed' | 'Issues found', acknowledged?: Acknowledged): LaunchDoc {
  return setRun(doc, key, { status: outcome, guideVersion, at: now(), report, ...(acknowledged ? { acknowledged } : {}) })
}

/** An issue the Researcher reports against a run. The note is optional; the category is what feeds the preflight check. */
export function makeRunIssue(category: IssueCategory, note: string, by: string): RunIssue {
  return { id: uid('ri'), category, text: note.trim() || `${category} problem reported during the test run.`, at: now(), by }
}

export function finishRun(doc: LaunchDoc, key: string, guideVersion: number, report: RunReport): LaunchDoc {
  return setRun(doc, key, { status: report.issues.length ? 'Issues found' : 'Completed', guideVersion, at: now(), report })
}

export function addRunIssue(doc: LaunchDoc, key: string, by: string, category: IssueCategory, text: string): LaunchDoc {
  const r = doc.runs[key]
  if (!r?.report) return doc
  const issue: RunIssue = { id: uid('ri'), category, text: text.trim(), at: now(), by }
  return setRun(doc, key, { ...r, status: 'Issues found', report: { ...r.report, issues: [...r.report.issues, issue] } })
}

export const setRunNote = (doc: LaunchDoc, key: string, note: string): LaunchDoc => {
  const r = doc.runs[key]
  return r?.report ? setRun(doc, key, { ...r, report: { ...r.report, note } }) : doc
}

// ─── preflight (R17) ────────────────────────────────────────────────────────

export type CheckId = 'media' | 'translations' | 'links' | 'quota' | 'consent' | 'coverage'
export type CheckOwner = 'R6' | 'R13' | 'R14' | 'R15' | 'setup'
export type Check = {
  id: CheckId
  label: string
  critical: boolean
  status: 'pass' | 'fail' | 'overridden'
  detail: string
  owner: CheckOwner
  override?: Override
  signature: string
  /** What the failure is. A "Fix" goes to this screen or the setup drawer. */
  fixLabel: string
}

const categoryCheck: Record<IssueCategory, CheckId> = {
  'Media rendering': 'media',
  Translations: 'translations',
  Links: 'links',
  'Consent language': 'consent',
  'Question coverage': 'coverage',
}

export function preflight(i: Inputs & { compile: CompileResult }): Check[] {
  const g = i.guide
  const version = g?.version ?? 0
  const langs = supportedLanguages(i.language, i.launch)
  // Issues found by test runs against this guide version feed the matching check.
  const fromRuns = (id: CheckId) =>
    langs.flatMap((lang) =>
      DEVICES.flatMap((d) => {
        const r = runFor(i.launch, lang, d, version)
        return (r.report?.issues ?? []).filter((x) => categoryCheck[x.category] === id).map((x) => `${x.text} (test run: ${lang}, ${d})`)
      }),
    )
  const uniq = (xs: string[]) => [...new Set(xs)]
  const make = (id: CheckId, label: string, critical: boolean, problems: string[], pass: string, owner: CheckOwner, fixLabel: string): Check => {
    const detail = problems.length ? uniq(problems).join(' ') : pass
    const signature = `${id}|${detail}`
    const o = i.launch?.overrides[id]
    const overridden = !critical && problems.length > 0 && !!o && o.signature === signature
    return { id, label, critical, status: problems.length ? (overridden ? 'overridden' : 'fail') : 'pass', detail, owner, override: overridden ? o : undefined, signature, fixLabel }
  }

  const active = g?.stimuli.items.filter((s) => s.active) ?? []
  // A file that is known not to render explains the test-run findings too, so they aren't listed twice.
  const brokenFiles = active.filter((s) => s.renderOk === false).map((s) => `“${s.name}” does not render.`)
  const mediaProblems = brokenFiles.length ? brokenFiles : fromRuns('media')

  const extra = langs.slice(1)
  const transProblems = [...extra.filter((l) => !i.launch?.setup.translated[l]).map((l) => `The guide isn’t translated into ${l}.`), ...fromRuns('translations')]

  const linkProblems = [...(i.launch?.setup.links ?? []).filter((l) => !l.ok).map((l) => `“${l.label}” does not open.`), ...fromRuns('links')]

  const def = i.audience?.def
  const targetOk = !!def && !!def.total
  const quotaProblems = targetOk ? [] : [def ? 'The number of participants needed isn’t set.' : 'The audience isn’t confirmed.']

  const consentProblems = [...langs.filter((l) => !i.launch?.setup.consent[l]?.approved).map((l) => `No approved consent wording for ${l}.`), ...fromRuns('consent')]

  const mandatory = g?.guide ? allQuestions(g.guide).filter((q) => q.mandatory).length : 0
  const coverageProblems =
    i.compile.state === 'ok'
      ? i.compile.plan.mandatoryCount === mandatory
        ? []
        : [`${mandatory - i.compile.plan.mandatoryCount} mandatory question(s) are missing from the plan.`]
      : i.compile.state === 'failed'
        ? ['The plan didn’t compile, so mandatory questions can’t be confirmed.']
        : ['There is no compiled plan yet.']
  coverageProblems.push(...fromRuns('coverage'))

  return [
    make('media', 'Media rendering', false, mediaProblems, `All ${active.length} active ${active.length === 1 ? 'stimulus renders' : 'stimuli render'}.`, mediaProblems.some((p) => p.includes('test run')) && !active.some((s) => s.renderOk === false) ? 'R15' : 'R13', mediaProblems.some((p) => p.includes('test run')) && !active.some((s) => s.renderOk === false) ? 'Open test runs' : 'Replace the file'),
    make('translations', 'Translations', false, transProblems, extra.length ? `Translated into ${extra.join(', ')}.` : 'One language, nothing to translate.', 'setup', 'Open study setup'),
    make('links', 'Links', false, linkProblems, `All ${i.launch?.setup.links.length ?? 0} links open.`, 'setup', 'Open study setup'),
    make('quota', 'Participant target', false, quotaProblems, `${def?.total ?? 0} completed interviews needed.`, 'R6', 'Open audience'),
    make('consent', 'Consent language', true, consentProblems, `Approved consent wording for ${langs.join(', ')}.`, 'setup', 'Open study setup'),
    make('coverage', 'Question coverage', true, coverageProblems, mandatory ? `All ${mandatory} mandatory questions are in the plan.` : 'No mandatory questions.', 'R14', 'Open guide'),
  ]
}

export function overrideCheck(doc: LaunchDoc, check: Check, by: string, reason: string): LaunchDoc {
  if (check.critical) return doc
  return { ...doc, overrides: { ...doc.overrides, [check.id]: { reason: reason.trim(), by, at: now(), signature: check.signature } } }
}

// ─── readiness and authorization ────────────────────────────────────────────

export type Readiness = {
  rows: Row[]
  entryOk: boolean
  compile: CompileResult
  checks: Check[]
  progress: ReturnType<typeof runProgress>
  preflightOk: boolean
  /** Status the study shows: Ready to Launch needs the contract, a compiled plan and a passed or overridden preflight. */
  ready: boolean
}

export function readiness(i: Inputs): Readiness {
  const rows = entryContract(i)
  const compile = compileStudyPlan(i.guide, i.language)
  const checks = preflight({ ...i, compile })
  const entryOk = rows.every((r) => r.ok)
  const preflightOk = checks.every((c) => c.status !== 'fail')
  return {
    rows,
    entryOk,
    compile,
    checks,
    progress: runProgress(i.launch, supportedLanguages(i.language, i.launch), i.guide?.version ?? 0),
    preflightOk,
    ready: entryOk && compile.state === 'ok' && preflightOk,
  }
}

export function authorizeBlockers(r: Readiness): string[] {
  const out: string[] = []
  if (!r.entryOk) out.push('Complete the entry contract')
  if (r.compile.state !== 'ok') out.push('The study plan has to compile')
  if (!r.progress.all) out.push(r.progress.finished === 0 ? 'A test run must be completed' : `Run every test combination (${r.progress.finished} of ${r.progress.total})`)
  const crit = r.checks.filter((c) => c.critical && c.status === 'fail')
  if (crit.length) out.push(`Fix ${crit.map((c) => c.label.toLowerCase()).join(' and ')} (critical)`)
  const non = r.checks.filter((c) => !c.critical && c.status === 'fail')
  if (non.length) out.push(`Fix or override ${non.map((c) => c.label.toLowerCase()).join(', ')}`)
  return out
}

/** Locks guide, moderator and active stimuli under the next release number. */
export function authorizeLaunch(doc: LaunchDoc, i: Inputs & { plan: StudyPlan }, by: string): LaunchDoc {
  const g = i.guide!
  const number = doc.releases.length + 1
  const release: Release = {
    number,
    version: releaseLabel(number),
    by,
    at: now(),
    guideVersion: g.version,
    moderator: moderatorLabel(g),
    language: i.plan.language,
    stimuli: g.stimuli.items.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name })),
    planSignature: i.plan.signature,
  }
  return { ...doc, release, releases: [...doc.releases, release] }
}

/** Release versions read "Release v1.0". Artifact versions (Brief v2, Guide v3) are a separate scheme. */
export const releaseLabel = (n: number) => `Release v${n}.0`

export const launched = (s: StudyRecord) => ['Live', 'Paused', 'Terminated', 'Complete'].includes(s.status)
