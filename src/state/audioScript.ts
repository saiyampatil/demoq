// The audio summary's script: what the lines are, where they come from, how long they take to say, and whether the analysis has
// moved under them. All of it is worked out from the codebook, the tensions and Review every time. Only the lines the Researcher has
// kept or changed are stored (state/audioSummary.ts); lengths, start times and out-of-date marks never are.
import { AUDIO } from '@/config/audioSummary'
import { clipsOfTheme } from '@/mock/showreel'
import { petOf } from '@/mock/codebook'
import { CODE_QUESTIONS, codeThemes, excerpt, liveExcerpts, peopleOf, tensionDecisions, themeCodes, type Basis, type Code, type CodebookDoc, type Excerpt, type Theme } from './codebook'
import { execDraft } from './execSummary'
import { checkNarration, figures, spokenWords } from './narration'
import { numbersOf, renderTemplate, strengthFor } from './reportLogic'
import { tensionsOf, type Tension } from './signals'

export type LineType = 'narration' | 'quote' | 'note' | 'frame'
export type LineState = 'Not approved' | 'Approved' | 'Edited'
export type AudioStatus = 'Current' | 'Needs audio'
/** An exact respondent turn. */
export type Cite = { excerptId: string; sessionId: string; participantId: string; turnIndex: number; atSec: number }
export type SourceRef = { kind: 'theme' | 'code' | 'tension' | 'thin' | 'study'; id: string }
export type Snap = { n?: number; of?: number; label?: string }
export type HistoryEntry = { at: string; by: string; action: string; previous?: string }

export type Line = {
  id: string
  /** The same for the same slot every time the draft is built, so a rebuild and a removal can find it again. Researcher's notes have none. */
  key?: string
  chapter: string
  type: LineType
  text: string
  source?: SourceRef
  cites: Cite[]
  state: LineState
  /** The Researcher has changed the wording. The line stays Edited until approved, and keeps the tag after. */
  edited?: boolean
  audio: AudioStatus
  /** What the line was written from, so a change underneath can be seen. */
  fingerprint: string
  snap?: Snap
  locked?: boolean
  /** The AI's own wording, for "Back to AI draft". */
  aiText?: string
  history: HistoryEntry[]
  author?: string
  removed?: { by: string; at: string }
  /** The line was flagged as changed and the Researcher chose to keep it. It stays flagged in the export. */
  keptAs?: string
  /** Other wordings of the same claim from the same source, all passing the narration rules, for Rewrite. */
  alts?: string[]
}

export type Ctx = { doc: CodebookDoc; basis: Basis; studyName: string; release: string }

// ─── chapters ───────────────────────────────────────────────────────────────

export const CHAPTER_ORDER = ['about', 'headline', 'theme', 'tensions', 'thin', 'close']
export const chapterTitle = (key: string, ctx?: Ctx) =>
  key === 'about' ? 'About this recording' : key === 'headline' ? 'The headline' : key === 'tensions' ? 'Where the picture splits' : key === 'thin' ? 'Where the evidence is thin' : key === 'close' ? 'Close' : key.startsWith('theme:') ? (ctx?.doc.themes.find((t) => `theme:${t.id}` === key)?.name ?? 'A theme') : key
/** Chapters in the order they are spoken: the fixed ones in place, theme chapters as their lines appear. */
export function chaptersOf(lines: Line[]): string[] {
  const seen = [...new Set(lines.map((l) => l.chapter))]
  const rank = (k: string) => CHAPTER_ORDER.indexOf(k.startsWith('theme:') ? 'theme' : k)
  return seen.sort((a, b) => rank(a) - rank(b) || seen.indexOf(a) - seen.indexOf(b))
}

// ─── length ─────────────────────────────────────────────────────────────────

/** Seconds a line takes to say: its spoken words at the configured rate, plus the pause after it. */
export const lineSeconds = (text: string) => spokenWords(text) / (AUDIO.wordsPerMinute / 60) + AUDIO.pauseSec
export type Timed = Line & { start: number; seconds: number }
/** The lines still in the script with their start times and lengths. Computed, never stored. */
export function timeline(lines: Line[]): Timed[] {
  let t = 0
  return chaptersOf(lines).flatMap((c) => lines.filter((l) => l.chapter === c && !l.removed)).map((l) => {
    const seconds = lineSeconds(l.text)
    const out = { ...l, start: t, seconds }
    t += seconds
    return out
  })
}
export const totalSeconds = (lines: Line[]) => lines.filter((l) => !l.removed).reduce((n, l) => n + lineSeconds(l.text), 0)
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
export const outsideBrief = (sec: number) => sec < AUDIO.range.min * 60 || sec > AUDIO.range.max * 60

// ─── sources and fingerprints ───────────────────────────────────────────────

const hash = (s: string) => [...s].reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 7).toString(36)
export const segmentLabel = (participantId: string) => `${petOf(participantId)} owner`
const citeOf = (e: Excerpt): Cite => ({ excerptId: e.id, sessionId: e.sessionId, participantId: e.participantId, turnIndex: e.turnIndex, atSec: e.atSec })

/** The tension's numbers as its sentence states them. */
function tensionNums(t: Tension): { n: number; of: number } | undefined {
  if (t.id === 'tn-pet-segments') {
    const [cat, , dog] = t.sides
    if (!cat || !dog) return undefined
    return cat.of && dog.of && cat.n / cat.of !== dog.n / dog.of ? (cat.n / cat.of > dog.n / dog.of ? { n: cat.n, of: cat.of } : { n: dog.n, of: dog.of }) : undefined
  }
  const side = t.sides[1]
  return side ? { n: side.n, of: side.of } : undefined
}

export type Current = { gone?: string; snap: Snap }
/** What a line's source says now. `gone` is why it can no longer be shown. */
export function currentOf(source: SourceRef | undefined, cites: Cite[], ctx: Ctx): Current {
  const live = cites.every((c) => ctx.basis.sessions.has(c.sessionId) && !!excerpt(c.excerptId))
  const base = (snap: Snap): Current => ({ snap: { ...snap, label: live ? snap.label : `${snap.label ?? ''} (a cited quote is no longer in the analysis)`.trim() } })
  if (!source) return { snap: {} }
  if (source.kind === 'study') return { snap: { n: ctx.basis.sessions.size, label: `${ctx.studyName}, ${ctx.release}` } }
  if (source.kind === 'theme') {
    const theme = ctx.doc.themes.find((t) => t.id === source.id)
    const nums = numbersOf(source.id, ctx)
    if (!theme || !nums || !themeCodes(ctx.doc, theme).length) return { gone: theme ? 'This theme has no approved codes left' : 'This theme no longer exists', snap: {} }
    return base({ n: nums.n, of: nums.of })
  }
  if (source.kind === 'code') {
    const code = ctx.doc.codes.find((c) => c.id === source.id)
    const nums = numbersOf(source.id, ctx)
    if (!code || code.status !== 'Accepted' || !nums) return { gone: code ? `“${code.name}” is ${code.status.toLowerCase()} in the codebook` : 'This code no longer exists', snap: {} }
    return base({ n: nums.n, of: nums.of })
  }
  if (source.kind === 'tension') {
    const t = tensionsOf(ctx.doc, ctx.basis).find((x) => x.id === source.id)
    const status = tensionDecisions(ctx.doc)[source.id]?.status
    if (!t || t.unavailable) return { gone: 'This tension is no longer available', snap: {} }
    if (status !== 'Added as a tension theme') return { gone: status === 'Dismissed' ? 'This tension was dismissed' : 'This tension is no longer approved', snap: {} }
    return base(tensionNums(t) ?? {})
  }
  // The evidence line: the number of weak or unanswered questions, from the executive summary's own source.
  const thin = thinText(ctx)
  if (!thin) return { gone: 'No guide question is thin any more', snap: {} }
  const fig = figures(thin)[0]
  return base({ n: fig?.n, of: fig?.of, label: thin })
}
export const fingerprintOf = (cur: Current, cites: Cite[]) => hash(JSON.stringify({ s: cur.snap, g: cur.gone ?? '', c: cites.map((c) => c.excerptId) }))

export type Stale = { state: 'current' | 'changed' | 'gone'; why?: string; was?: Snap; now?: Snap }
/** Whether the analysis has moved since a line was written. A removed line is never stale. Researcher's notes have no source and are never stale. */
export function staleOf(line: Line, ctx: Ctx): Stale {
  if (line.removed || !line.source || line.type === 'note') return { state: 'current' }
  const cur = currentOf(line.source, line.cites, ctx)
  if (cur.gone) return { state: 'gone', why: cur.gone }
  if (fingerprintOf(cur, line.cites) === line.fingerprint) return { state: 'current' }
  const was = line.snap
  const now = cur.snap
  const numbers = was?.n !== undefined && now.n !== undefined && (was.n !== now.n || was.of !== now.of)
  return { state: 'changed', was, now, why: numbers ? `Was ${was!.n}${was!.of !== undefined ? ` of ${was!.of}` : ''}, now ${now.n}${now.of !== undefined ? ` of ${now.of}` : ''}` : 'A source it uses has changed' }
}

/** The one sentence saying why a line says what it says, from the data. */
export function ruleOf(line: Line, ctx: Ctx): string {
  const cur = currentOf(line.source, line.cites, ctx)
  if (!line.source) return 'A note from the Researcher. It is not a data claim unless it links a source.'
  if (cur.gone) return cur.gone
  const { n, of } = cur.snap
  const s = line.source
  if (s.kind === 'theme') return `${n} of ${of} accepted people have an approved code under this theme.`
  if (s.kind === 'code') return `${n} of ${of} accepted people were coded with “${ctx.doc.codes.find((c) => c.id === s.id)?.name}”, an approved code.`
  if (s.kind === 'tension') return `This tension was approved as a theme. ${n} of ${of} people are in the group its sentence describes.`
  if (s.kind === 'thin') return `${n} of ${of} guide questions have too few accepted people, or some were not asked.`
  return `The recording uses ${n} accepted sessions. Excluded sessions are left out.`
}

// ─── numbers in a line ──────────────────────────────────────────────────────

export type NumberCheck = { text: string; expected?: string; ok: boolean }
/** Each "n of N" in a line against what its source says now. A line with a figure and no source cannot be confirmed. */
export function numbersCheck(text: string, source: SourceRef | undefined, cites: Cite[], ctx: Ctx): NumberCheck[] {
  const figs = figures(text)
  if (!figs.length) return []
  const cur = source ? currentOf(source, cites, ctx) : undefined
  return figs.map((f) => {
    const shown = `${f.n} of ${f.of}`
    if (!cur || cur.gone || cur.snap.n === undefined) return { text: shown, ok: false }
    const expected = cur.snap.of !== undefined ? `${cur.snap.n} of ${cur.snap.of}` : undefined
    return { text: shown, expected, ok: expected === shown }
  })
}

export type EditCheck = { problems: string[]; numbers: NumberCheck[]; seconds: number; cited: boolean }
/** The live checks under an editor. Any problem blocks Save for narration; a note with a count must link a source that matches it. */
export function checkEdit(text: string, type: LineType, source: SourceRef | undefined, cites: Cite[], ctx: Ctx): EditCheck {
  const numbers = numbersCheck(text, source, cites, ctx)
  const problems: string[] = []
  if (type === 'narration') {
    problems.push(...checkNarration(text).problems)
    if (!cites.length) problems.push('Add a source')
  }
  numbers.forEach((n) => !n.ok && problems.push(n.expected ? `Says ${n.text}. The data says ${n.expected}` : `${n.text} needs a source that matches it`))
  return { problems, numbers, seconds: lineSeconds(text), cited: cites.length > 0 }
}

// ─── the thin-evidence sentence (the executive summary's own) ───────────────

export function thinText(ctx: Ctx): string | undefined {
  const s = execDraft({ doc: ctx.doc, basis: ctx.basis }).find((x) => x.id === 'exec-thin')
  return s ? renderTemplate(s.template, ctx) : undefined
}
const weakQuestionCodes = (ctx: Ctx): Code[] =>
  CODE_QUESTIONS.flatMap((q) => {
    const codes = ctx.doc.codes.filter((c) => c.questionId === q.id && c.status === 'Accepted')
    const n = new Set(codes.flatMap((c) => [...peopleOf(c, ctx.basis)])).size
    const notAsked = q.skipped.filter((s) => ctx.basis.participants.has(s.participantId)).length
    return strengthFor(n, notAsked > 0) !== 'Strong' ? codes.slice(0, 1) : []
  })

// ─── the draft ──────────────────────────────────────────────────────────────

const mkLine = (o: Omit<Line, 'id' | 'state' | 'audio' | 'history' | 'fingerprint' | 'cites'> & { cites?: Cite[]; state?: LineState }, ctx: Ctx): Line => {
  const cites = o.cites ?? []
  const cur = currentOf(o.source, cites, ctx)
  return { ...o, id: o.key!, cites, state: o.state ?? 'Not approved', audio: 'Current', fingerprint: fingerprintOf(cur, cites), snap: cur.snap, aiText: o.text, history: [] }
}
/** The best few quotes behind a set of codes, one a person, most confident first. */
const citesOf = (codes: Code[], ctx: Ctx, max = 3): Cite[] => {
  const seen = new Set<string>()
  return codes
    .flatMap((c) => liveExcerpts(c, ctx.basis))
    .sort((a, b) => b.confidence - a.confidence || a.participantId.localeCompare(b.participantId))
    .filter((e) => !seen.has(e.participantId) && !!seen.add(e.participantId))
    .slice(0, max)
    .map(citeOf)
}
const TENSION_TEXT: Record<string, (n: number, of: number) => string> = {
  'tn-pause-survey': (n, of) => `${n} of ${of} people who picked pause answered “probably” or “definitely would not” in the locked survey.`,
  'tn-flex-behaviour': (n, of) => `${n} of ${of} people who said flexibility matters more than price showed marked hesitation as they said it.`,
  'tn-pause-portion-face': (n, of) => `${n} of ${of} people on video who picked pause read as delight or interest at first sight of Concept C.`,
  'tn-pause-concept': (n, of) => `${n} of ${of} people who chose pause showed marked hesitation at first sight of Concept A.`,
  'tn-vet-survey': (n, of) => `${n} of ${of} people who said a vet’s advice ended it named something else as their one biggest reason in the survey.`,
}

const TENSION_ALTS: Record<string, (n: number, of: number) => string[]> = {
  'tn-pause-survey': (n, of) => [`In the locked survey, ${n} of ${of} people who picked pause answered “probably” or “definitely would not”.`],
  'tn-flex-behaviour': (n, of) => [`${n} of ${of} people who put flexibility ahead of price showed marked hesitation as they said it.`],
  'tn-pause-portion-face': (n, of) => [`At first sight of Concept C, ${n} of ${of} people on video who picked pause read as delight or interest.`],
  'tn-pause-concept': (n, of) => [`At first sight of Concept A, ${n} of ${of} people who chose pause showed marked hesitation.`],
  'tn-vet-survey': (n, of) => [`In the survey, ${n} of ${of} people who said a vet’s advice ended it named something else as their one biggest reason.`],
}

/** A narration line that passes the rules, or nothing. A sentence that breaks one is never used. */
const narr = (o: Omit<Line, 'id' | 'type' | 'state' | 'audio' | 'history' | 'fingerprint' | 'cites'> & { cites: Cite[]; faceBased?: boolean }, ctx: Ctx): Line[] => {
  const { faceBased, alts, ...rest } = o
  if (!o.cites.length || !checkNarration(o.text, { faceBased }).ok) return []
  // Only wordings that pass the rules, and that still say the same figure, are offered for Rewrite.
  const same = figures(o.text).map((f) => `${f.n} of ${f.of}`).join()
  const good = (alts ?? []).filter((a) => a !== o.text && checkNarration(a, { faceBased }).ok && figures(a).map((f) => `${f.n} of ${f.of}`).join() === same)
  return [mkLine({ ...rest, type: 'narration', alts: good }, ctx)]
}

export type Draft = { lines: Line[]; leftOut: LeftOut[] }
export type LeftOut = { kind: 'theme' | 'tension'; id: string; name: string; why: 'time' | 'new' }

/**
 * The AI draft for a target length. Chapters in order; a chapter with no data is left out. Themes go in largest first while they fit the
 * target, the rest are listed as left out. Quotes are verbatim, one a person across the episode. Every narration line is cited to exact
 * turns and passes the narration rules.
 */
export function buildDraft(ctx: Ctx, targetMin: number, include: string[] = []): Draft {
  const { doc, basis } = ctx
  const N = basis.sessions.size
  const lines: Line[] = []
  const used = new Set<string>()
  const targetSec = targetMin * 60

  lines.push(
    mkLine({ key: 'frame-open', chapter: 'about', type: 'frame', locked: true, state: 'Approved', source: { kind: 'study', id: 'study' }, text: `This is an AI-generated summary of the study. It uses ${N} accepted sessions. What people said is read by a second voice.` }, ctx),
  )

  // The headline: the study's own leading findings, from the executive summary's sentences and the two answers it sets side by side.
  const exec = execDraft({ doc, basis })
  const execLine = (id: string, key: string, codeId: string) => {
    const s = exec.find((x) => x.id === id)
    const code = doc.codes.find((c) => c.id === codeId)!
    const nums = numbersOf(codeId, ctx)
    const fig = nums ? `${nums.n} of ${nums.of}` : ''
    const alts = id === 'exec-reason' ? [`${fig} people gave “${code.name}” as their reason for cancelling.`] : id === 'exec-nothing' ? [`${fig} people said nothing the company could have done would have kept them.`] : [`${fig} people said ${code.name.charAt(0).toLowerCase()}${code.name.slice(1)}.`]
    return s ? narr({ key, chapter: 'headline', text: renderTemplate(s.template, ctx), source: { kind: 'code', id: codeId }, cites: citesOf([code], ctx), alts }, ctx) : []
  }
  const topReason = exec.find((x) => x.id === 'exec-reason')?.cites[0]?.id
  if (topReason) lines.push(...execLine('exec-reason', 'headline-reason', topReason))
  const flex = doc.codes.find((c) => c.id === 'c-flex-first' && c.status === 'Accepted')
  const price = doc.codes.find((c) => c.id === 'c-price-first' && c.status === 'Accepted')
  for (const [code, text] of [[flex, 'said flexibility matters more than price'], [price, 'said price matters more than flexibility']] as const) {
    const nums = code && numbersOf(code.id, ctx)
    if (code && nums && nums.n > 0) lines.push(...narr({ key: `headline-${code.id}`, chapter: 'headline', text: `${nums.n} of ${nums.of} people ${text}.`, source: { kind: 'code', id: code.id }, cites: citesOf([code], ctx), alts: [code.id === 'c-flex-first' ? `Flexibility mattered more than price to ${nums.n} of ${nums.of} people.` : `Price mattered more than flexibility to ${nums.n} of ${nums.of} people.`] }, ctx))
  }
  const keepCode = exec.find((x) => x.id === 'exec-keep')?.cites[0]?.id
  if (keepCode) lines.push(...execLine('exec-keep', 'headline-keep', keepCode))
  if (exec.some((x) => x.id === 'exec-nothing')) lines.push(...execLine('exec-nothing', 'headline-nothing', 'c-nothing'))

  // Fixed chapters first (they always fit), so the themes are given the time that is left.
  const tail: Line[] = []
  const tensions = tensionsOf(doc, basis).filter((t) => !t.unavailable && tensionDecisions(doc)[t.id]?.status === 'Added as a tension theme')
  const tensionLeftOut: LeftOut[] = []
  const tensionLines: Line[] = []
  for (const t of tensions) {
    const nums = tensionNums(t)
    const make = TENSION_TEXT[t.id]
    const theme = doc.themes.find((x) => x.tensionId === t.id)
    if (!nums || !make || !theme) continue
    const codes = themeCodes(doc, theme)
    const cat = t.sides[0]
    const dog = t.sides[2]
    const group = t.id === 'tn-pet-segments' && cat && dog ? (cat.n / cat.of > dog.n / dog.of ? 'cat owners' : 'dog owners') : ''
    const text = t.id === 'tn-pet-segments' ? `${nums.n} of ${nums.of} ${group} said flexibility matters more than price.` : make(nums.n, nums.of)
    const got = narr({ key: `tension:${t.id}:n`, chapter: 'tensions', text, source: { kind: 'tension', id: t.id }, cites: citesOf(codes, ctx), faceBased: t.id === 'tn-pause-portion-face', alts: TENSION_ALTS[t.id]?.(nums.n, nums.of) }, ctx)
    tensionLines.push(...got)
    if (!got.length) tensionLeftOut.push({ kind: 'tension', id: t.id, name: t.title, why: 'time' })
  }
  const thin = thinText(ctx)
  const thinFig = thin ? figures(thin)[0] : undefined
  const thinNames = thin ? thin.slice(thin.indexOf(':') + 1).trim() : ''
  if (thin) tail.push(...narr({ key: 'thin', chapter: 'thin', text: thin, source: { kind: 'thin', id: 'thin' }, cites: citesOf(weakQuestionCodes(ctx), ctx), alts: thinFig ? [`${thinFig.n} of ${thinFig.of} guide questions have thin evidence: ${thinNames}`] : [] }, ctx))
  tail.push(mkLine({ key: 'frame-close', chapter: 'close', type: 'frame', locked: true, state: 'Approved', source: { kind: 'study', id: 'study' }, text: `That is the summary of ${ctx.studyName}, ${ctx.release}.` }, ctx))

  // Themes, largest first.
  const themes = codeThemes(doc)
    .map((t) => ({ t, nums: numbersOf(t.id, ctx), codes: themeCodes(doc, t) }))
    .filter((x) => x.nums && x.nums.n > 0 && x.codes.length)
    .sort((a, b) => b.nums!.n - a.nums!.n || a.t.name.localeCompare(b.t.name))
  const chapters: { theme: Theme; lines: Line[]; quotes: Line[] }[] = []
  const leftOut: LeftOut[] = [...tensionLeftOut]
  const quoteLine = (theme: Theme, key: string, chapter: string, cl: ReturnType<typeof clipsOfTheme>[number]): Line =>
    mkLine({ key, chapter, type: 'quote', text: cl.quote, source: { kind: theme.tensionId ? 'tension' : 'theme', id: theme.tensionId ?? theme.id }, cites: [citeOf(excerpt(cl.id.slice(5)))] }, ctx)
  const pick = (theme: Theme, taken: Set<string>) => clipsOfTheme(doc, theme, basis).find((c) => !taken.has(c.participantId) && !!excerpt(c.id.slice(5)))
  for (const { t, nums, codes } of themes) {
    const key = `theme:${t.id}`
    const ls = [
      ...narr({ key: `${key}:n`, chapter: key, text: `${t.name} came up for ${nums!.n} of ${nums!.of} people.`, source: { kind: 'theme', id: t.id }, cites: citesOf(codes, ctx), alts: [`${nums!.n} of ${nums!.of} people raised ${t.name}.`, `${t.name} was raised by ${nums!.n} of ${nums!.of} people.`] }, ctx),
    ]
    const top = [...codes].map((c) => ({ c, n: peopleOf(c, basis).size })).sort((a, b) => b.n - a.n || a.c.name.localeCompare(b.c.name))[0]
    if (codes.length > 1 && top) {
      const cn = numbersOf(top.c.id, ctx)!
      ls.push(...narr({ key: `${key}:code`, chapter: key, text: `“${top.c.name}” was the most common reason inside it, for ${cn.n} of ${cn.of} people.`, source: { kind: 'code', id: top.c.id }, cites: citesOf([top.c], ctx), alts: [`${cn.n} of ${cn.of} people gave “${top.c.name}” as a reason.`, `Inside it, “${top.c.name}” came up for ${cn.n} of ${cn.of} people.`] }, ctx))
    }
    chapters.push({ theme: t, lines: ls, quotes: [] })
  }
  // Quotes: one for each theme first, then a second for the largest while there is time. One quote a person.
  const take = (c: (typeof chapters)[number], count: number) => {
    const key = `theme:${c.theme.id}`
    while (c.quotes.length < count) {
      const clip = pick(c.theme, used)
      if (!clip) return
      used.add(clip.participantId)
      c.quotes.push(quoteLine(c.theme, `${key}:q${c.quotes.length + 1}`, key, clip))
    }
  }
  const size = () => totalSeconds([...lines, ...chapters.flatMap((c) => [...c.lines, ...c.quotes]), ...tensionLines, ...tail])
  chapters.forEach((c) => take(c, AUDIO.quotesPerTheme))
  // A theme beyond the target length is left out, smallest first.
  const kept = [...chapters]
  while (kept.length > 1 && (kept.length > AUDIO.maxThemes || size() > targetSec * 1.15)) {
    const drop = [...kept].reverse().find((c) => !include.includes(c.theme.id))
    if (!drop) break
    kept.splice(kept.indexOf(drop), 1)
    drop.quotes.forEach((q) => used.delete(q.cites[0].participantId))
    drop.quotes = []
    chapters.splice(chapters.indexOf(drop), 1)
    leftOut.push({ kind: 'theme', id: drop.theme.id, name: drop.theme.name, why: 'time' })
  }
  themes.filter((x) => !chapters.some((c) => c.theme.id === x.t.id) && !leftOut.some((l) => l.id === x.t.id)).forEach((x) => leftOut.push({ kind: 'theme', id: x.t.id, name: x.t.name, why: 'time' }))
  chapters.slice(0, AUDIO.largestCount).forEach((c) => size() < targetSec && take(c, AUDIO.quotesForLargest))
  chapters.forEach((c) => lines.push(...c.lines, ...c.quotes))

  // Tension quotes: one for each approved tension theme, a person not yet heard.
  for (const t of tensions) {
    const theme = doc.themes.find((x) => x.tensionId === t.id)
    const clip = theme && pick(theme, used)
    if (theme && clip && tensionLines.some((l) => l.source?.id === t.id)) {
      used.add(clip.participantId)
      tensionLines.push(quoteLine(theme, `tension:${t.id}:q`, 'tensions', clip))
    }
  }
  lines.push(...tensionLines, ...tail)
  return { lines, leftOut }
}

/** The approved themes and tensions not in a script, and why: not enough time at this length, or new since it was written. */
export function leftOutOf(lines: Line[], ctx: Ctx, written: boolean): LeftOut[] {
  const have = new Set(lines.flatMap((l) => (l.source && (l.source.kind === 'theme' || l.source.kind === 'tension') && !l.removed ? [`${l.source.kind}:${l.source.id}`] : [])))
  const themes = codeThemes(ctx.doc).filter((t) => themeCodes(ctx.doc, t).length > 0 && (numbersOf(t.id, ctx)?.n ?? 0) > 0)
  const tensions = tensionsOf(ctx.doc, ctx.basis).filter((t) => !t.unavailable && tensionDecisions(ctx.doc)[t.id]?.status === 'Added as a tension theme' && ctx.doc.themes.some((x) => x.tensionId === t.id) && TENSION_TEXT[t.id])
  return [
    ...themes.filter((t) => !have.has(`theme:${t.id}`)).map((t): LeftOut => ({ kind: 'theme', id: t.id, name: t.name, why: written ? 'new' : 'time' })),
    ...tensions.filter((t) => !have.has(`tension:${t.id}`)).map((t): LeftOut => ({ kind: 'tension', id: t.id, name: t.title, why: written ? 'new' : 'time' })),
  ]
}
