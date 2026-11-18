// The audio summary's script: what the lines are, where they come from, how long they take to say, and whether the analysis has
// moved under them. All of it is worked out from the codebook, the tensions and Review every time. Only the lines the Researcher has
// kept or changed are stored (state/audioSummary.ts); lengths, start times and out-of-date marks never are.
import { AUDIO } from '@/config/audioSummary'
import { clipsOfTheme } from '@/mock/showreel'
import { petOf } from '@/mock/codebook'
import { CODE_QUESTIONS, codeThemes, excerpt, liveExcerpts, peopleOf, tensionDecisions, themeCodes, themePeople, type Basis, type Code, type CodebookDoc, type Excerpt, type Theme } from './codebook'
import { execDraft } from './execSummary'
import { checkNarration, figures, spokenWords } from './narration'
import { numbersOf, renderTemplate, strengthFor } from './reportLogic'
import { tensionsOf, type Tension } from './signals'

export type LineType = 'narration' | 'quote' | 'note' | 'frame' | 'signpost'
export type LineState = 'Not approved' | 'Approved' | 'Edited'
export type AudioStatus = 'Current' | 'Needs audio'
/** An exact respondent turn. */
export type Cite = { excerptId: string; sessionId: string; participantId: string; turnIndex: number; atSec: number }
/** `pair` is two themes set side by side (id "a|b"); `pairNone` is how many people are in neither. */
export type SourceRef = { kind: 'theme' | 'code' | 'tension' | 'thin' | 'study' | 'pair' | 'pairNone'; id: string }
export type Snap = { n?: number; of?: number; n2?: number; of2?: number; label?: string }
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

export const hash = (s: string) => [...s].reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 7).toString(36)
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
  // A quote from the transcripts (found by search) has no coded excerpt; it is live while its session is accepted.
  const live = cites.every((c) => ctx.basis.sessions.has(c.sessionId) && (c.excerptId.startsWith('turn:') || !!excerpt(c.excerptId)))
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
  if (source.kind === 'pair' || source.kind === 'pairNone') {
    const [a, b] = source.id.split('|')
    const na = numbersOf(a, ctx)
    const nb = numbersOf(b, ctx)
    const ta = ctx.doc.themes.find((t) => t.id === a)
    const tb = ctx.doc.themes.find((t) => t.id === b)
    if (!na || !nb || !ta || !tb) return { gone: 'One of these themes no longer exists', snap: {} }
    if (source.kind === 'pair') return base({ n: na.n, of: na.of, n2: nb.n, of2: nb.of })
    const either = new Set([...themePeople(ctx.doc, ta, ctx.basis), ...themePeople(ctx.doc, tb, ctx.basis)])
    return base({ n: ctx.basis.participants.size - either.size, of: ctx.basis.participants.size })
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
  if (s.kind === 'pair') return `${n} of ${of} and ${cur.snap.n2} of ${cur.snap.of2} accepted people have an approved code under these two leading themes, which are within one person of each other.`
  if (s.kind === 'pairNone') return `${n} of ${of} accepted people are in neither of the two leading themes.`
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
  return figs.map((f, i) => {
    const shown = `${f.n} of ${f.of}`
    const n = i === 1 ? cur?.snap.n2 : cur?.snap.n
    const of = i === 1 ? cur?.snap.of2 : cur?.snap.of
    if (!cur || cur.gone || n === undefined) return { text: shown, ok: false }
    const expected = of !== undefined ? `${n} of ${of}` : undefined
    return { text: shown, expected, ok: expected === shown }
  })
}

export type EditCheck = { problems: string[]; numbers: NumberCheck[]; seconds: number; cited: boolean }
/** The live checks under an editor. Any problem blocks Save for narration; a note with a count must link a source that matches it. */
export function checkEdit(text: string, type: LineType, source: SourceRef | undefined, cites: Cite[], ctx: Ctx): EditCheck {
  const numbers = numbersCheck(text, source, cites, ctx)
  const problems: string[] = []
  if (type === 'narration') {
    problems.push(...checkNarration(text, { figuresAllowed: source?.kind === 'pair' ? 2 : 1 }).problems)
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
const narr = (o: Omit<Line, 'id' | 'type' | 'state' | 'audio' | 'history' | 'fingerprint' | 'cites'> & { cites: Cite[]; faceBased?: boolean; figuresAllowed?: number }, ctx: Ctx): Line[] => {
  const { faceBased, figuresAllowed, alts, ...rest } = o
  const rules = { faceBased, figuresAllowed }
  if (!o.cites.length || !checkNarration(o.text, rules).ok) return []
  // Only wordings that pass the rules, and that still say the same figures, are offered for Rewrite.
  const same = figures(o.text).map((f) => `${f.n} of ${f.of}`).join()
  const good = (alts ?? []).filter((a) => a !== o.text && checkNarration(a, rules).ok && figures(a).map((f) => `${f.n} of ${f.of}`).join() === same)
  return [mkLine({ ...rest, type: 'narration', alts: good }, ctx)]
}

/** A line that only points the listener to what comes next. Fixed wording, no number and no claim. */
export const SIGNPOST_MAX_WORDS = 12
const signpost = (chapter: string, text: string, ctx: Ctx): Line[] =>
  /\d/.test(text) || text.trim().split(/\s+/).length > SIGNPOST_MAX_WORDS ? [] : [mkLine({ key: `signpost:${chapter}`, chapter, type: 'signpost', text, state: 'Approved' }, ctx)]
const SIGNPOSTS: Record<string, (name: string) => string> = {
  headline: () => 'First, the headline.',
  theme: (name) => `Next, ${name.charAt(0).toLowerCase()}${name.slice(1)}.`,
  tensions: () => 'Now, where the picture splits.',
  thin: () => 'Finally, where the evidence is thin.',
  close: () => 'That brings us to the end.',
}

export type Draft = { lines: Line[]; leftOut: LeftOut[] }
export type LeftOut = { kind: 'theme' | 'tension'; id: string; name: string; why: 'time' | 'new' }

/**
 * The AI draft for a target length. Chapters in order; a chapter with no data is left out. Each starts with a signpost. The headline is made
 * of themes (codes appear only inside their theme's chapter). A theme chapter has a line for each accepted code and then two quotes (three
 * for the two largest). Themes go in largest first while they fit the target; the rest are listed as left out. Quotes are verbatim, one a
 * person across the episode. Nothing is added to fill time.
 */
export function buildDraft(ctx: Ctx, targetMin: number, include: string[] = [], emphasis: string[] = []): Draft {
  const { doc, basis } = ctx
  const N = basis.sessions.size
  const people = basis.participants.size
  const lines: Line[] = []
  const used = new Set<string>()
  const targetSec = targetMin * 60

  lines.push(mkLine({ key: 'frame-open', chapter: 'about', type: 'frame', locked: true, state: 'Approved', source: { kind: 'study', id: 'study' }, text: `This is an AI-generated summary of the study. It uses ${N} accepted sessions. What people said is read by a second voice.` }, ctx))

  const themes = codeThemes(doc)
    .map((t) => ({ t, nums: numbersOf(t.id, ctx), codes: themeCodes(doc, t) }))
    .filter((x) => x.nums && x.nums.n > 0 && x.codes.length)
    .sort((a, b) => b.nums!.n - a.nums!.n || a.t.name.localeCompare(b.t.name))
    // The Researcher's focus may bring themes to the front. It changes the order, never what is said.
    .sort((a, b) => Number(emphasis.includes(b.t.id)) - Number(emphasis.includes(a.t.id)))

  // Theme chapters first, so the headline and the length rule only deal with the themes that are in.
  type Chap = { theme: Theme; nums: { n: number; of: number }; codes: Code[]; lines: Line[]; quotes: Line[] }
  const chapters: Chap[] = themes.map(({ t, nums, codes }) => {
    const key = `theme:${t.id}`
    const ranked = codes.map((c) => ({ c, n: numbersOf(c.id, ctx)! })).filter((x) => x.n && x.n.n > 0).sort((a, b) => b.n.n - a.n.n || a.c.name.localeCompare(b.c.name))
    const ls = [
      ...signpost(key, SIGNPOSTS.theme(t.name), ctx),
      ...ranked.flatMap(({ c, n }) =>
        narr({ key: `${key}:${c.id}`, chapter: key, text: `“${c.name}” came up for ${n.n} of ${n.of} people.`, source: { kind: 'code', id: c.id }, cites: citesOf([c], ctx), alts: [`${n.n} of ${n.of} people gave “${c.name}” as a reason.`, `“${c.name}” was raised by ${n.n} of ${n.of} people.`] }, ctx),
      ),
    ]
    return { theme: t, nums: nums!, codes, lines: ls, quotes: [] }
  })
  const quoteLine = (theme: Theme, key: string, chapter: string, id: string, text: string): Line =>
    mkLine({ key, chapter, type: 'quote', text, source: { kind: theme.tensionId ? 'tension' : 'theme', id: theme.tensionId ?? theme.id }, cites: [citeOf(excerpt(id))] }, ctx)
  const pick = (theme: Theme, taken: Set<string>) => clipsOfTheme(doc, theme, basis).find((c) => !taken.has(c.participantId) && !!excerpt(c.id.slice(5)))
  const takeQuotes = (c: Chap, count: number) => {
    const key = `theme:${c.theme.id}`
    while (c.quotes.length < count) {
      const clip = pick(c.theme, used)
      if (!clip) return
      used.add(clip.participantId)
      c.quotes.push(quoteLine(c.theme, `${key}:q${c.quotes.length + 1}`, key, clip.id.slice(5), clip.quote))
    }
  }
  chapters.forEach((c, i) => takeQuotes(c, i < AUDIO.largestCount ? AUDIO.quotesForLargest : AUDIO.quotesPerTheme))

  // Approved tensions: a line for each, a quote for the words side and one for the delivery side.
  const tensions = tensionsOf(doc, basis).filter((t) => !t.unavailable && tensionDecisions(doc)[t.id]?.status === 'Added as a tension theme')
  const tensionLines: Line[] = []
  const tensionLeftOut: LeftOut[] = []
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
  void tensionLines

  // The length rule: a theme beyond the target length is left out, smallest first.
  const leftOut: LeftOut[] = [...tensionLeftOut]
  const thin = thinText(ctx)
  const thinLines = thin ? narr({ key: 'thin', chapter: 'thin', text: thin, source: { kind: 'thin', id: 'thin' }, cites: citesOf(weakQuestionCodes(ctx), ctx), alts: figures(thin)[0] ? [`${figures(thin)[0].n} of ${figures(thin)[0].of} guide questions have thin evidence: ${thin.slice(thin.indexOf(':') + 1).trim()}`] : [] }, ctx) : []
  const closeLines = [...signpost('close', SIGNPOSTS.close(''), ctx), mkLine({ key: 'frame-close', chapter: 'close', type: 'frame', locked: true, state: 'Approved', source: { kind: 'study', id: 'study' }, text: `That is the summary of ${ctx.studyName}, ${ctx.release}.` }, ctx)]
  const fixed = () => [...lines, ...thinLines, ...closeLines, ...tensionLines]
  const size = () => totalSeconds([...fixed(), ...chapters.flatMap((c) => [...c.lines, ...c.quotes])])
  while (chapters.length > 1 && (chapters.length > AUDIO.maxThemes || size() > targetSec * 1.15)) {
    const drop = [...chapters].reverse().find((c) => !include.includes(c.theme.id))
    if (!drop) break
    chapters.splice(chapters.indexOf(drop), 1)
    drop.quotes.forEach((q) => used.delete(q.cites[0].participantId))
    leftOut.push({ kind: 'theme', id: drop.theme.id, name: drop.theme.name, why: 'time' })
  }
  themes.filter((x) => !chapters.some((c) => c.theme.id === x.t.id) && !leftOut.some((l) => l.id === x.t.id)).forEach((x) => leftOut.push({ kind: 'theme', id: x.t.id, name: x.t.name, why: 'time' }))

  // The headline: the themes that are in, with their counts. The two leading themes within one person of each other are said together.
  const head: Line[] = [...signpost('headline', SIGNPOSTS.headline(''), ctx)]
  const [a, b] = chapters
  const close = a && b && Math.abs(a.nums.n - b.nums.n) <= 1
  if (close) {
    const either = new Set([...themePeople(doc, a.theme, basis), ...themePeople(doc, b.theme, basis)])
    const pairCites = [...citesOf(a.codes, ctx, 2), ...citesOf(b.codes, ctx, 2)]
    head.push(
      ...narr({ key: 'headline-close', chapter: 'headline', text: `${a.theme.name} and ${b.theme.name} were close to even: ${a.nums.n} of ${a.nums.of} people and ${b.nums.n} of ${b.nums.of} people.`, source: { kind: 'pair', id: `${a.theme.id}|${b.theme.id}` }, cites: pairCites, figuresAllowed: 2 }, ctx),
      ...narr({ key: 'headline-none', chapter: 'headline', text: `${people - either.size} of ${people} people gave no clear answer to either.`, source: { kind: 'pairNone', id: `${a.theme.id}|${b.theme.id}` }, cites: pairCites }, ctx),
    )
  }
  chapters.slice(close ? 2 : 0).forEach((c) => head.push(...narr({ key: `headline:${c.theme.id}`, chapter: 'headline', text: `${c.theme.name}: ${c.nums.n} of ${c.nums.of} people.`, source: { kind: 'theme', id: c.theme.id }, cites: citesOf(c.codes, ctx), alts: [`${c.nums.n} of ${c.nums.of} people raised ${c.theme.name}.`] }, ctx)))
  if (!close) void 0
  lines.push(...(head.length > 1 ? head : []))

  // A second look at the leading themes' time: more quotes only while there is room, never to fill.
  chapters.forEach((c) => lines.push(...c.lines, ...c.quotes))

  // The tension chapter: the line, then a quote for the words and one for the delivery.
  if (tensionLines.length) {
    lines.push(...signpost('tensions', SIGNPOSTS.tensions(''), ctx))
    for (const t of tensions) {
      const theme = doc.themes.find((x) => x.tensionId === t.id)
      const mine = tensionLines.filter((l) => l.source?.id === t.id)
      if (!theme || !mine.length) continue
      lines.push(...mine)
      const clipFolk = new Set(t.clips.map((c) => c.participantId))
      // The delivery side: a person from the second row. The words side: someone who said it, not in that row.
      const delivery = t.clips.find((c) => !used.has(c.participantId) && themeCodes(doc, theme).some((code) => liveExcerpts(code, basis).some((e) => e.participantId === c.participantId)))
      if (delivery) {
        const e = themeCodes(doc, theme).flatMap((code) => liveExcerpts(code, basis)).filter((x) => x.participantId === delivery.participantId).sort((x, y) => y.confidence - x.confidence)[0]
        used.add(delivery.participantId)
        lines.push(quoteLine(theme, `tension:${t.id}:q2`, 'tensions', e.id, e.text))
      }
      const words = clipsOfTheme(doc, theme, basis).find((c) => !used.has(c.participantId) && !clipFolk.has(c.participantId) && !!excerpt(c.id.slice(5))) ?? clipsOfTheme(doc, theme, basis).find((c) => !used.has(c.participantId) && !!excerpt(c.id.slice(5)))
      if (words) {
        used.add(words.participantId)
        lines.splice(lines.findIndex((l) => l.key === `tension:${t.id}:q2`) >= 0 ? lines.findIndex((l) => l.key === `tension:${t.id}:q2`) : lines.length, 0, quoteLine(theme, `tension:${t.id}:q1`, 'tensions', words.id.slice(5), words.quote))
      }
    }
  }
  if (thinLines.length) lines.push(...signpost('thin', SIGNPOSTS.thin(''), ctx), ...thinLines)
  lines.push(...closeLines)
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

// ─── what a line can be linked to, and what the focus box may do ────────────

export type SourceOption = { ref: SourceRef; label: string }
/** Everything a Researcher's note can cite: approved themes, accepted codes, and approved tensions. */
export function sourceOptions(ctx: Ctx): SourceOption[] {
  const themes = codeThemes(ctx.doc).filter((t) => themeCodes(ctx.doc, t).length > 0)
  const tensions = tensionsOf(ctx.doc, ctx.basis).filter((t) => !t.unavailable && tensionDecisions(ctx.doc)[t.id]?.status === 'Added as a tension theme')
  return [
    ...themes.map((t): SourceOption => ({ ref: { kind: 'theme', id: t.id }, label: `Theme: ${t.name}` })),
    ...themes.flatMap((t) => themeCodes(ctx.doc, t).map((c): SourceOption => ({ ref: { kind: 'code', id: c.id }, label: `Code: ${c.name}` }))),
    ...tensions.map((t): SourceOption => ({ ref: { kind: 'tension', id: t.id }, label: `Tension: ${t.title}` })),
  ]
}
/** The exact turns behind a source: the best few quotes of its accepted codes, from accepted sessions. */
export function citesFor(ref: SourceRef, ctx: Ctx): Cite[] {
  const codes =
    ref.kind === 'code'
      ? ctx.doc.codes.filter((c) => c.id === ref.id && c.status === 'Accepted')
      : ref.kind === 'theme'
        ? (() => {
            const t = ctx.doc.themes.find((x) => x.id === ref.id)
            return t ? themeCodes(ctx.doc, t) : []
          })()
        : ref.kind === 'tension'
          ? (() => {
              const t = ctx.doc.themes.find((x) => x.tensionId === ref.id)
              return t ? themeCodes(ctx.doc, t) : []
            })()
          : []
  return citesOf(codes, ctx)
}

export const FOCUS_REFUSAL = 'I can change emphasis and order, not add advice or new findings'
export type FocusPlan = { ok: boolean; first: string[]; message?: string }
/**
 * What the focus box may do: bring approved themes to the front. It may not add a claim, a number, advice, or a theme nobody approved,
 * so anything else is refused with one line. Text that names no approved theme changes nothing.
 */
export function focusPlan(focus: string, ctx: Ctx): FocusPlan {
  const text = focus.trim().toLowerCase()
  if (!text) return { ok: true, first: [] }
  if (/\d|%|percent/.test(text) || AUDIO.adviceWords.some((w) => text.includes(w)) || /\b(add|new|suggest|improve|launch|offer|fix|invent|include)\b/.test(text)) return { ok: false, first: [], message: FOCUS_REFUSAL }
  const themes = codeThemes(ctx.doc).filter((t) => themeCodes(ctx.doc, t).length > 0)
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !['that', 'this', 'with', 'what', 'from', 'they'].includes(w))
  const first = themes.filter((t) => words(t.name).some((w) => text.includes(w)) || themeCodes(ctx.doc, t).some((c) => words(c.name).some((w) => text.includes(w)))).map((t) => t.id)
  return first.length ? { ok: true, first } : { ok: false, first: [], message: FOCUS_REFUSAL }
}
