// What the Report means, worked out from the codebook, the signals and Review every time: live numbers, what a citation points
// at, where a sentence stands, how strong a finding is, and whether the report can be published. Nothing here is stored.
// Counts are distinct people, "n of N", never percentages or quote counts, and they come from the same functions as A1 and A2.
import { REPORT_SECTIONS } from '@/mock/report'
import {
  CODE_QUESTIONS,
  denominator,
  excerpt,
  liveExcerpts,
  peopleOf,
  themeCodes,
  themePeople,
  tensionDecisions,
  WEAK_MATCH,
  type Basis,
  type Code,
  type CodebookDoc,
  type Excerpt,
  type Theme,
} from './codebook'
import { toneSplit, topEmotions, TONES } from './emotion'
import { codeSignals, tensionHeadline, tensionsFor, tensionsOf, themeSignals, type Rollup, type Tension } from './signals'
import { citesKey, draftOf, type Approval, type Citation, type DraftKind, type ReportDoc, type Sentence, type Strength } from './report'

export type Ctx = { doc: CodebookDoc; basis: Basis }
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
export const questionLabel = (id: string) => CODE_QUESTIONS.find((q) => q.id === id)?.label ?? id

// ─── live numbers ───────────────────────────────────────────────────────────

export type Numbers = { n: number; of: number }

/** The people behind a code, a theme or a tension, and who they are counted against. Undefined when it no longer counts. */
export function numbersOf(id: string, { doc, basis }: Ctx): Numbers | undefined {
  const code = doc.codes.find((c) => c.id === id)
  if (code) return code.status === 'Accepted' ? { n: peopleOf(code, basis).size, of: denominator(code, basis) } : undefined
  const theme = doc.themes.find((t) => t.id === id)
  if (theme) {
    if (theme.tensionId) {
      const h = tensionHeadline(doc, basis, theme.tensionId)
      return h ? { n: h.n, of: h.of } : undefined
    }
    return { n: themePeople(doc, theme, basis).size, of: basis.participants.size }
  }
  const h = tensionHeadline(doc, basis, id)
  return h ? { n: h.n, of: h.of } : undefined
}

const TOKEN = /\{N\}|\{(n|of):([\w-]+)\}/g

/** Fills the numbers into a template. A token that points at nothing shows as [?], so it can't pass for a number. */
export function renderTemplate(template: string, ctx: Ctx): string {
  return template.replace(TOKEN, (_all, kind: string | undefined, id: string | undefined) => {
    if (!kind || !id) return String(ctx.basis.participants.size)
    const v = numbersOf(id, ctx)
    return v ? String(kind === 'n' ? v.n : v.of) : '[?]'
  })
}

export const hasTokens = (text: string) => /\{N\}|\{(n|of):[\w-]+\}/.test(text)

// ─── citations ──────────────────────────────────────────────────────────────

export type Resolved =
  | { kind: 'excerpt'; ex: Excerpt }
  | { kind: 'code'; code: Code; excerpts: Excerpt[]; people: number; of: number }
  | { kind: 'theme'; theme: Theme; codes: { code: Code; excerpts: Excerpt[] }[]; people: number; of: number }
  | { kind: 'tension'; tension: Tension }
  | { kind: 'broken'; why: string }

/** What a citation points at right now. A citation to something rejected, merged, dismissed or left out of Review is broken, never shown. */
export function resolveCitation(cit: Citation, { doc, basis }: Ctx): Resolved {
  switch (cit.kind) {
    case 'excerpt': {
      const ex = excerpt(cit.id)
      if (!ex) return { kind: 'broken', why: 'This quote no longer exists.' }
      if (!basis.sessions.has(ex.sessionId)) return { kind: 'broken', why: 'This quote is from a session that is not accepted in Review.' }
      return { kind: 'excerpt', ex }
    }
    case 'code': {
      const code = doc.codes.find((c) => c.id === cit.id)
      if (!code) return { kind: 'broken', why: 'This code no longer exists.' }
      if (code.status !== 'Accepted') return { kind: 'broken', why: `“${code.name}” is ${code.status.toLowerCase()} in the codebook.` }
      return { kind: 'code', code, excerpts: liveExcerpts(code, basis), people: peopleOf(code, basis).size, of: denominator(code, basis) }
    }
    case 'theme': {
      const theme = doc.themes.find((th) => th.id === cit.id)
      if (!theme) return { kind: 'broken', why: 'This theme was deleted in the codebook.' }
      const codes = themeCodes(doc, theme).map((code) => ({ code, excerpts: liveExcerpts(code, basis) }))
      if (!codes.length) return { kind: 'broken', why: `“${theme.name}” has no accepted codes left.` }
      const n = numbersOf(theme.id, { doc, basis })
      return { kind: 'theme', theme, codes, people: n?.n ?? 0, of: n?.of ?? basis.participants.size }
    }
    case 'tension': {
      const tn = tensionsOf(doc, basis).find((x) => x.id === cit.id)
      if (!tn) return { kind: 'broken', why: 'This tension no longer exists.' }
      if (tn.status === 'Dismissed') return { kind: 'broken', why: 'This tension was dismissed in Emotion & behaviour, so it never appears in the report.' }
      if (tn.status !== 'Added as a tension theme') return { kind: 'broken', why: 'This tension has not been decided in Emotion & behaviour yet.' }
      return { kind: 'tension', tension: tn }
    }
  }
}

export const citationLabel = (cit: Citation, r: Resolved): string => {
  if (r.kind === 'broken') return `${cit.kind} not available`
  if (r.kind === 'excerpt') return `Quote · ${r.ex.participantId} · ${mmss(r.ex.atSec)}`
  if (r.kind === 'code') return `Code: ${r.code.name}`
  if (r.kind === 'theme') return `Theme: ${r.theme.name}`
  return `Tension: ${r.tension.title}`
}

/** Every quote behind a citation, each a distinct session and timestamp. This is what "traces to a quote" means. */
export function quotesOf(r: Resolved): Excerpt[] {
  if (r.kind === 'excerpt') return [r.ex]
  if (r.kind === 'code') return r.excerpts
  if (r.kind === 'theme') return r.codes.flatMap((c) => c.excerpts)
  if (r.kind === 'tension') return []
  return []
}

// ─── a sentence ─────────────────────────────────────────────────────────────

export type SentenceState = 'Approved' | 'Approved without citation' | 'Needs update' | 'No citation' | 'To review'

export type SentenceInfo = {
  sentence: Sentence
  /** The wording with today's numbers. Differs from `sentence.text` when the numbers have moved. */
  live: string
  numbersChanged: boolean
  cites: { cit: Citation; resolved: Resolved }[]
  cited: boolean
  /** Only an approval of exactly this wording and these citations counts. */
  approval?: Approval
  state: SentenceState
  /** Blocks publishing. */
  open: boolean
  /** In the Researcher's own draft, with wording that is not one of PulseAI's sentences: written or changed by the Researcher. */
  edited?: boolean
}

export function sentenceInfo(s: Sentence, approvals: Record<string, Approval>, ctx: Ctx): SentenceInfo {
  const live = s.template ? renderTemplate(s.template, ctx) : s.text
  const cites = s.cites.map((cit) => ({ cit, resolved: resolveCitation(cit, ctx) }))
  // A number whose code or theme no longer counts can't be recalculated, so the sentence has lost its source: it reads as uncited.
  const cited = cites.some((x) => x.resolved.kind !== 'broken') && !live.includes('[?]')
  const a = approvals[s.id]
  const approval = a && a.text === s.text && a.cites === citesKey(s.cites) ? a : undefined
  const numbersChanged = !!s.template && live !== s.text && !live.includes('[?]') && !approval?.keptNumbers
  let state: SentenceState
  if (numbersChanged) state = 'Needs update'
  else if (approval && (cited || approval.reason)) state = cited ? 'Approved' : 'Approved without citation'
  else if (!cited) state = 'No citation'
  else state = 'To review'
  return { sentence: s, live, numbersChanged, cites, cited, approval, state, open: state !== 'Approved' && state !== 'Approved without citation' }
}

// ─── a finding ──────────────────────────────────────────────────────────────

export type Quote = { excerpt: Excerpt; codeName: string }

/** Two representative quotes: from the accepted codes with the most people, one person each, the best matches first. */
export function representativeQuotes(codes: Code[], basis: Basis, count = 2): Quote[] {
  const ranked = codes.map((code) => ({ code, people: peopleOf(code, basis).size })).sort((a, b) => b.people - a.people || a.code.name.localeCompare(b.code.name))
  const used = new Set<string>()
  const out: Quote[] = []
  for (const { code } of ranked) {
    const best = liveExcerpts(code, basis)
      .filter((e) => e.confidence >= WEAK_MATCH && !used.has(e.participantId))
      .sort((a, b) => b.confidence - a.confidence || a.participantId.localeCompare(b.participantId))[0]
    if (!best) continue
    used.add(best.participantId)
    out.push({ excerpt: best, codeName: code.name })
    if (out.length === count) break
  }
  return out
}

/** How strong a finding is, from distinct people under its accepted codes. A question some people were not asked is at most Weak. */
export const STRENGTH = { minPeople: 2, strongPeople: 5 } as const
export function strengthFor(people: number, someNotAsked: boolean): Strength {
  if (people < STRENGTH.minPeople) return 'Unanswered'
  if (people < STRENGTH.strongPeople || someNotAsked) return 'Weak'
  return 'Strong'
}

/** One A2 signal ticked for a finding, per channel. */
export type SignalLine = { channel: 'Hesitation' | 'Face' | 'Voice' | 'Words vs delivery'; text: string; /** Emotion and voice are off in the client version until cleared. */ emotionVoice: boolean }
/** What "How people sounded" shows for a finding: a theme's profile from A2, or a code's signals ticked at code level (older data). */
export type FindingSignal = { id: string; name: string; kind: 'theme' | 'code'; lines: SignalLine[] }

/** The channel lines for a theme or a code. The words-vs-delivery line is the theme's headline sentence when there is one. */
function signalLines(s: Pick<Rollup, 'pattern' | 'marked' | 'people' | 'emotions' | 'points' | 'fit'>, headline?: string): SignalLine[] {
  const lines: SignalLine[] = [{ channel: 'Hesitation', text: `${s.pattern}: marked hesitation in ${s.marked} of ${s.people} people`, emotionVoice: false }]
  const tops = topEmotions(s.emotions)
  if (tops.length && s.emotions.read >= 3) {
    const n = s.emotions.counts[tops[0]]
    const read = `Faces read for ${s.emotions.read} of ${s.people}`
    const text = n < 2 ? `${read}: no one reading stands out` : tops.length === 1 ? `${read}: ${n} read as ${tops[0].toLowerCase()}` : `${read}: ${tops.map((e) => e.toLowerCase()).join(' and ')} tie at ${n} each`
    lines.push({ channel: 'Face', text, emotionVoice: true })
  }
  const tones = toneSplit(s.points)
  const tone = TONES.reduce((best, t) => (tones.counts[t] > tones.counts[best] ? t : best), TONES[0])
  if (tones.n >= 3 && tone !== 'Even' && tones.counts[tone] * 2 >= tones.n) lines.push({ channel: 'Voice', text: `Voice mostly ${tone.toLowerCase()} for ${tones.counts[tone]} of ${tones.n}`, emotionVoice: true })
  if (headline) lines.push({ channel: 'Words vs delivery', text: headline, emotionVoice: true })
  else if (s.fit.pattern === 'Mixed' || s.fit.pattern === 'Conflicting') lines.push({ channel: 'Words vs delivery', text: `${s.fit.pattern}: delivery did not fit the words for ${s.fit.doesnt + s.fit.partly} of ${s.fit.n} people`, emotionVoice: true })
  return lines
}

export type FindingModel = {
  questionId: string
  label: string
  text: string
  section: string
  strength: Strength
  /** Distinct people under this question's accepted codes. */
  people: number
  asked: number
  notAsked: number
  codes: Code[]
  quotes: Quote[]
  signals: FindingSignal[]
  /** Tensions from A2 that touch this finding's codes, not dismissed. */
  tensions: Tension[]
  active: DraftKind
  sentences: SentenceInfo[]
  omitted?: { by: string; at: string; why: string }
  /** A sentence of this finding's other draft exists (for the switch). */
  hasMine: boolean
}

export type ThemeModel = { theme: Theme; numbers?: Numbers; fromTension: boolean; codes: Code[]; note?: string }

export type SectionModel = { id: string; label: string; findings: FindingModel[] }

export type ReportModel = {
  exec: { active: DraftKind; sentences: SentenceInfo[]; hasMine: boolean }
  sections: SectionModel[]
  findings: FindingModel[]
  themes: ThemeModel[]
  /** Every sentence of the report as it will be published: the executive summary and the active draft of every finding left in. */
  all: SentenceInfo[]
  open: SentenceInfo[]
  /** Tensions dismissed in A2: never in the report. */
  dismissedTensions: number
  tensionsToDecide: number
}

export function reportModel(report: ReportDoc, doc: CodebookDoc, basis: Basis): ReportModel {
  const ctx = { doc, basis }
  const info = (list: Sentence[]) => list.map((s) => sentenceInfo(s, report.approvals, ctx))
  /** Marks the sentences of the Researcher's own draft that PulseAI did not write, so the dot can say Edited. */
  const withEdited = (list: SentenceInfo[], t: { active: DraftKind; aiDraft: Sentence[] }) => {
    if (t.active !== 'researcher') return list
    const ai = new Set(t.aiDraft.flatMap((a) => [a.text, a.template ?? a.text]))
    return list.map((i) => ({ ...i, edited: !ai.has(i.sentence.text) && !ai.has(i.sentence.template ?? i.sentence.text) }))
  }
  const signals = codeSignals(doc, basis)
  const profiles = themeSignals(doc, basis, signals)
  const tensions = tensionsOf(doc, basis)
  const decisions = tensionDecisions(doc)

  const findings: FindingModel[] = report.findings.map((f) => {
    const q = CODE_QUESTIONS.find((x) => x.id === f.questionId)!
    const codes = doc.codes.filter((c) => c.questionId === q.id && c.status === 'Accepted')
    const people = new Set(codes.flatMap((c) => [...peopleOf(c, basis)])).size
    const notAsked = q.skipped.filter((s) => basis.participants.has(s.participantId)).length
    const codeIds = new Set(codes.map((c) => c.id))
    // The themes ticked in A2 that this question's codes belong to, then any code ticked on its own (older data).
    const tickedThemes = profiles.filter((t) => t.use && t.codes.some((c) => codeIds.has(c.code.id)))
    const ticked = signals.filter((s) => codeIds.has(s.code.id) && s.use)
    const related = new Map<string, Tension>()
    codes.forEach((c) => tensionsFor(tensions, c.id).forEach((t) => related.set(t.id, t)))
    return {
      questionId: q.id,
      label: q.label,
      text: q.text,
      section: q.section,
      strength: strengthFor(people, notAsked > 0),
      people,
      asked: basis.participants.size - notAsked,
      notAsked,
      codes,
      quotes: representativeQuotes(codes, basis),
      signals: [
        ...tickedThemes.map((t): FindingSignal => ({ id: t.id, name: t.name, kind: 'theme', lines: signalLines(t, t.headline) })),
        ...ticked.map((s): FindingSignal => ({ id: s.code.id, name: s.code.name, kind: 'code', lines: signalLines(s) })),
      ],
      tensions: [...related.values()].filter((t) => decisions[t.id]?.status !== 'Dismissed'),
      active: f.active,
      sentences: withEdited(info(draftOf(f)), f),
      omitted: f.omitted,
      hasMine: f.researcherDraft.length > 0,
    }
  })

  const exec = { active: report.execSummary.active, sentences: withEdited(info(draftOf(report.execSummary)), report.execSummary), hasMine: report.execSummary.researcherDraft.length > 0 }
  const sections = REPORT_SECTIONS.map((s) => ({ id: s.id, label: s.label, findings: s.questionIds.flatMap((id) => findings.filter((f) => f.questionId === id)) }))
  const themes: ThemeModel[] = doc.themes
    .map((theme) => {
      const codes = themeCodes(doc, theme)
      const profile = theme.tensionId ? undefined : profiles.find((p) => p.id === theme.id)
      // A code theme's note is its A2 headline, only when delivery pulled against the words or hesitation shows.
      return { theme, numbers: numbersOf(theme.id, ctx), fromTension: !!theme.tensionId, codes, note: profile?.notable ? profile.headline : undefined }
    })
    .filter((t) => t.numbers)
  const all = [...exec.sentences, ...findings.filter((f) => !f.omitted).flatMap((f) => f.sentences)]
  return {
    exec,
    sections,
    findings,
    themes,
    all,
    open: all.filter((s) => s.open),
    dismissedTensions: tensions.filter((t) => decisions[t.id]?.status === 'Dismissed').length,
    tensionsToDecide: tensions.filter((t) => !t.unavailable && t.status === 'Suggested').length,
  }
}

// ─── can it be published ────────────────────────────────────────────────────

export type Check = { key: string; label: string; detail: string; ok: boolean; /** A blocker stops publishing; an advisory only warns. */ blocks: boolean; to?: 'review' | 'A1' | 'A2' | 'Review' }

export function releaseChecks(m: ReportModel, o: { stale: boolean; excluded: number }): Check[] {
  const noCite = m.all.filter((s) => s.state === 'No citation').length
  const update = m.all.filter((s) => s.state === 'Needs update').length
  const toReview = m.all.filter((s) => s.state === 'To review').length
  const empty = m.findings.filter((f) => !f.omitted && f.sentences.length === 0)
  return [
    { key: 'approved', label: 'Every sentence approved', detail: toReview ? `${plural(toReview, 'sentence')} still to review` : `All ${m.all.length} approved`, ok: toReview === 0, blocks: true, to: 'review' },
    { key: 'cited', label: 'Every sentence cited, or a reason logged', detail: noCite ? `${plural(noCite, 'sentence')} without a citation. Add one, or approve with a reason.` : 'Every sentence traces to a quote, session and timestamp', ok: noCite === 0, blocks: true, to: 'review' },
    { key: 'numbers', label: 'Numbers up to date', detail: update ? `${plural(update, 'sentence')} with a suggested update` : 'Every number matches the codebook', ok: update === 0, blocks: true, to: 'review' },
    { key: 'empty', label: 'No empty findings', detail: empty.length ? `${empty.map((f) => f.label).join(', ')}: write it, or leave it out of the report` : 'Every finding has a sentence or is left out', ok: empty.length === 0, blocks: false },
    { key: 'tensions', label: 'Tensions decided in Emotion & behaviour', detail: m.tensionsToDecide ? `${plural(m.tensionsToDecide, 'tension')} still to decide. Undecided ones stay out of the report.` : 'Every tension has a decision', ok: m.tensionsToDecide === 0, blocks: false, to: 'A2' },
    { key: 'review', label: 'Built on the sessions accepted in Review', detail: o.stale ? 'Review changed after the codebook was built. Update the codebook so the counts match.' : `${plural(o.excluded, 'excluded session')} left out of every count`, ok: !o.stale, blocks: false, to: o.stale ? 'A1' : 'Review' },
  ]
}

export const blockers = (checks: Check[]) => checks.filter((c) => c.blocks && !c.ok)
