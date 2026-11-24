// What the Report's numbers mean, worked out from the codebook, the signals and Review every time: live numbers, what a citation
// points at, and how strong a finding is. Nothing here is stored. (The blocks the report is made of are in state/reportBlocks.ts.)
// Counts are distinct people, "n of N", never percentages or quote counts, and they come from the same functions as A1 and A2.
import { analysedStudies } from '@/mock/studyAnalysis'
import { questionsOf } from '@/mock/codebook'
import {
  denominator,
  excerpt,
  liveExcerpts,
  peopleOf,
  themeCodes,
  themePeople,
  WEAK_MATCH,
  type Basis,
  type Code,
  type CodebookDoc,
  type Excerpt,
  type Theme,
} from './codebook'
import { tensionHeadline, tensionsOf, type Tension } from './signals'
import type { Citation, Strength } from './report'

export type Ctx = { doc: CodebookDoc; basis: Basis }
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
/** A guide question by ID. Question IDs are unique across studies, so the study isn't needed. */
export const questionById = (id: string) => analysedStudies().flatMap((s) => questionsOf(s)).find((q) => q.id === id)
export const questionLabel = (id: string) => questionById(id)?.label ?? id

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

//   {N}                       everyone accepted
//   {n:ID} / {of:ID}          a code, theme or tension: the people, and who they are counted against
//   {none:ID,ID}              the accepted people in none of those codes: the ones with no clear answer
//   {side:TENSION:i:n|of}     one side of a tension card, by position
const TOKEN = /\{N\}|\{(n|of):([\w-]+)\}|\{none:([\w,-]+)\}|\{side:([\w-]+):(\d+):(n|of)\}/g

/** Fills the numbers into a template. A token that points at nothing shows as [?], so it can't pass for a number. */
export function renderTemplate(template: string, ctx: Ctx): string {
  return template.replace(TOKEN, (all: string, kind?: string, id?: string, none?: string, tn?: string, idx?: string, which?: string) => {
    if (all === '{N}') return String(ctx.basis.participants.size)
    if (none) {
      const people = new Set<string>()
      for (const cid of none.split(',')) {
        const code = ctx.doc.codes.find((c) => c.id === cid)
        if (!code || code.status !== 'Accepted') return '[?]'
        peopleOf(code, ctx.basis).forEach((p) => people.add(p))
      }
      return String(ctx.basis.participants.size - people.size)
    }
    if (tn) {
      const side = tensionsOf(ctx.doc, ctx.basis).find((x) => x.id === tn && !x.unavailable)?.sides[Number(idx)]
      return side ? String(which === 'n' ? side.n : side.of) : '[?]'
    }
    const v = numbersOf(id!, ctx)
    return v ? String(kind === 'n' ? v.n : v.of) : '[?]'
  })
}

export const hasTokens = (text: string) => /\{N\}|\{(n|of):[\w-]+\}|\{none:[\w,-]+\}|\{side:[\w-]+:\d+:(n|of)\}/.test(text)

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
