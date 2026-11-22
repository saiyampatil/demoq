// A3 Theme map, worked out from the codebook and A2 every time. Nothing is stored and nothing is written back. A bubble is an
// accepted theme (plus one grey bubble for accepted codes in no theme); its size is people, its colour how strong the delivery was
// among the people who could be read, and its ring A2's verdict, reused as it is.
import { VERDICT_LABEL } from '@/config/delivery'
import { strengthBandOf, THEME_MAP, type StrengthBand } from '@/config/themeMap'
import { petOf } from '@/mock/codebook'
import { analysedStudies, segmentsOf } from '@/mock/studyAnalysis'
import { excerptPoint, type Point } from '@/mock/signals'
import { faceOf } from './emotion'
import type { FitPattern, FitSplit } from './emotion'
import { liveExcerpts, peopleOf, tensionDecisions, themeCodes, themePeople, unthemed, codeThemes, type Basis, type Code, type CodebookDoc, type Excerpt } from './codebook'
import { numbersOf } from './reportLogic'
import { codeSignals, headlineOf, rollupPoints, tensionsOf, themeSignals, type Rollup } from './signals'

/** 'all', or the key of one of the study's two segments (Pet Food: Cat, Dog. Ice Cream: Parent, Adult). */
export type Segment = string
/** The choices of the Show control: everyone, then the study's two groups in the order they read on screen. */
export const segmentOptions = (studyId: string): [Segment, string][] => {
  const { first, second } = segmentsOf(studyId)
  return [['all', 'Everyone'], [first.key, first.label], [second.key, second.label]]
}
/** A group in a sentence: "cat owners", "parents", or "people" for everyone. Keys are unique across studies, so the key is enough. */
export const segmentNoun = (s: Segment) => {
  if (s === 'all') return 'people'
  for (const id of analysedStudies()) {
    const c = segmentsOf(id)
    if (c.first.key === s) return c.first.noun
    if (c.second.key === s) return c.second.noun
  }
  return 'people'
}
export const NONE_KEY = 'none'

export type Ring = 'solid' | 'dashed' | 'dotted' | 'none'
export type Bubble = {
  key: string
  name: string
  kind: 'theme' | 'none'
  codes: Code[]
  /** The people in this segment with an accepted statement here, and who they are counted against. */
  people: Set<string>
  n: number
  of: number
  /** A2's roll-up for these people, and its verdict. */
  rollup: Rollup
  verdict: FitPattern
  /** People with a delivery reading, and how many of them were strong. */
  read: number
  strong: number
  share?: number
  band?: StrengthBand
  notEnough: boolean
  ring: Ring
}

export const segmentOf = (participantId: string): string => petOf(participantId)
export { segmentLabelOf } from './signals'
const inSegment = (seg: Segment, p: string) => seg === 'all' || segmentOf(p) === seg
export const segmentSize = (basis: Basis, seg: Segment) => [...basis.participants].filter((p) => inSegment(seg, p)).length
/** "Directional. Fewer than 5 people." for a segment that small, else nothing. */
export const directionalNote = (size: number) => (size > 0 && size < THEME_MAP.segmentMinimum ? `Directional. Fewer than ${THEME_MAP.segmentMinimum} people.` : undefined)

/** One person's delivery is strong: a lively or tense voice, marked hesitation, or (only if the face flag is on) a clear non-neutral face. */
export function isStrong(p: Point, doc: CodebookDoc): boolean {
  if ((THEME_MAP.strongTones as readonly string[]).includes(p.voice.tone)) return true
  if (p.band === 'Marked hesitation') return true
  if (!THEME_MAP.faceInColour) return false
  const face = faceOf(p, doc)
  return !!face?.emotion && (THEME_MAP.strongFaces as readonly string[]).includes(face.emotion) && face.reading.confidence >= THEME_MAP.faceConfidence
}

export const ringOf = (v: FitPattern): Ring => (v === 'Consistent' ? 'solid' : v === 'Conflicting' ? 'dashed' : v === 'Mixed' ? 'dotted' : 'none')

/** The bubbles for a segment. Everyone uses A2's own theme profile; a segment applies A2's roll-up to that segment's people. */
export function bubblesOf(doc: CodebookDoc, basis: Basis, seg: Segment): Bubble[] {
  const signals = themeSignals(doc, basis, codeSignals(doc, basis))
  const of = segmentSize(basis, seg)
  const defs: { key: string; name: string; kind: 'theme' | 'none'; codes: Code[]; people: Set<string>; sig?: (typeof signals)[number] }[] = [
    ...codeThemes(doc)
      .filter((t) => themeCodes(doc, t).length > 0)
      .map((t) => ({ key: t.id, name: t.name, kind: 'theme' as const, codes: themeCodes(doc, t), people: themePeople(doc, t, basis), sig: signals.find((s) => s.id === t.id) })),
  ]
  const loose = unthemed(doc)
  if (loose.length) defs.push({ key: NONE_KEY, name: 'Not in a theme', kind: 'none', codes: loose, people: new Set(loose.flatMap((c) => [...peopleOf(c, basis)])), sig: signals.find((s) => s.id === 'none') })
  return defs.flatMap((d) => {
    const people = new Set([...d.people].filter((p) => inSegment(seg, p)))
    if (!d.sig) return []
    // Everyone: A2's profile as it is. A segment: A2's roll-up over that segment's people.
    const rollup: Rollup = seg === 'all' ? d.sig : { ...rollupPoints(d.sig.points.filter((p) => segmentOf(p.participantId) === seg), doc), strengthPoints: d.sig.strengthPoints.filter((p) => segmentOf(p.participantId) === seg) }
    const read = rollup.strengthPoints.length
    const strong = rollup.strengthPoints.filter((p) => isStrong(p, doc)).length
    const notEnough = read < THEME_MAP.minRead
    const share = notEnough ? undefined : strong / read
    const n = seg === 'all' && d.kind === 'theme' ? numbersOf(d.key, { doc, basis })!.n : people.size
    return [{ key: d.key, name: d.name, kind: d.kind, codes: d.codes, people, n, of, rollup, verdict: rollup.verdict, read, strong, share, band: share === undefined ? undefined : strengthBandOf(share), notEnough, ring: ringOf(rollup.verdict) }]
  })
}

export const bandWords = (b: Bubble) => (b.notEnough || !b.band ? 'not enough read' : `${b.band.toLowerCase()} reaction strength`)
/** The verdict in words, for a tooltip or a screen reader: "verdict Consistent". */
export const verdictWords = (v: FitPattern) => (v === 'Too few to read' ? 'too few to read' : v === 'No claim' ? 'no position' : `verdict ${VERDICT_LABEL[v]}`)
export const accessibleName = (b: Bubble, seg: Segment) => (b.kind === 'none' ? `${b.name}, ${b.n} of ${b.of} ${segmentNoun(seg)}, not grouped into a theme yet` : `${b.name}, ${b.n} of ${b.of} ${segmentNoun(seg)}, ${bandWords(b)}, ${verdictWords(b.verdict)}`)

/** Who is said by both of two sets of people: the layout's only use of it. */
export const peopleSets = (bubbles: Bubble[]) => new Map(bubbles.map((b) => [b.key, b.people]))
/** How many people said both of two themes, from the same sets the layout uses. */
export const sharedCount = (a: Bubble, b: Bubble) => [...a.people].filter((p) => b.people.has(p)).length
/** The real themes that share people with a bubble, with how many. "Not in a theme" is never one of them. */
export const sharing = (bubble: Bubble, all: Bubble[]) => all.filter((o) => o.key !== bubble.key && o.kind === 'theme' && bubble.kind === 'theme').map((o) => ({ other: o, shared: sharedCount(bubble, o) })).filter((x) => x.shared > 0)
export const sharedLabel = (n: number) => `${n} ${n === 1 ? 'person' : 'people'} in both`

// ─── tension lines ──────────────────────────────────────────────────────────

export type Line = { id: string; title: string; a: string; b: string }
/**
 * A line for each tension the Researcher added as a theme, between the two bubbles its codes sit in. A suggested or dismissed
 * tension never draws one. One whose codes sit in a single bubble has nothing to connect and is skipped (counted in `skipped`).
 */
export function tensionLines(doc: CodebookDoc, basis: Basis, bubbles: Bubble[]): { lines: Line[]; skipped: number } {
  const decisions = tensionDecisions(doc)
  const lines: Line[] = []
  let skipped = 0
  for (const t of tensionsOf(doc, basis)) {
    if (t.unavailable || decisions[t.id]?.status !== 'Added as a tension theme') continue
    const keys = [...new Set(t.codeIds.flatMap((id) => bubbles.filter((b) => b.codes.some((c) => c.id === id)).map((b) => b.key)))]
    if (keys.length >= 2) lines.push({ id: t.id, title: t.title, a: keys[0], b: keys[1] })
    else skipped++
  }
  return { lines, skipped }
}

// ─── words: the summary, the tour, the panel ────────────────────────────────

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
/** A plain-words line built only from the bubbles: the largest theme, and how many show words and delivery pulling apart. */
export function summaryOf(bubbles: Bubble[]): string {
  const themes = bubbles.filter((b) => b.kind === 'theme' && b.n > 0)
  if (!themes.length) return ''
  const top = Math.max(...themes.map((b) => b.n))
  const leaders = themes.filter((b) => b.n === top).map((b) => b.name)
  const first = leaders.length === 1 ? `${leaders[0]} is the largest theme.` : `${leaders.join(' and ')} are the largest themes.`
  const apart = themes.filter((b) => b.verdict === 'Conflicting').map((b) => b.name)
  const names = apart.length <= 2 ? apart.join(' and ') : `${apart.slice(0, -1).join(', ')} and ${apart[apart.length - 1]}`
  return apart.length > 0 ? `${first} ${names} ${plural(apart.length, 'shows', 'show')} a ${VERDICT_LABEL.Conflicting}: delivery did not match the words.` : first
}

/** What a step of the tour says about a bubble: its name, its people, and A2's fit, using only the bubble's own numbers. */
export function tourCaption(b: Bubble, seg: Segment): string {
  const fit: FitSplit = b.rollup.fit
  const tail = b.verdict === 'Consistent' ? 'Delivery matched the words.' : b.verdict === 'Conflicting' ? `${VERDICT_LABEL.Conflicting}: no match for ${fit.against} of ${fit.n} read${fit.uncertain ? `, ${fit.uncertain} hesitant` : ''}.` : b.verdict === 'Mixed' ? `${VERDICT_LABEL.Mixed}: no match for ${fit.against} of ${fit.n} read${fit.uncertain ? `, ${fit.uncertain} hesitant` : ''}.` : 'Too few read to say.'
  return `${b.name}. ${b.n} of ${b.of} ${segmentNoun(seg)}. ${tail}`
}
export const TOUR_END = 'That is every approved theme.'
/** The last step: the end, and the one place "Not in a theme" is mentioned. */
export function tourEnd(bubbles: Bubble[], seg: Segment): string {
  const none = bubbles.find((b) => b.kind === 'none' && b.n > 0)
  return none ? `${TOUR_END} ${none.n} of ${none.of} ${segmentNoun(seg)} said something not grouped yet.` : TOUR_END
}
/** The tour visits real themes largest first. "Not in a theme" is not one of them. */
export const tourOrder = (bubbles: Bubble[]) => [...bubbles].filter((b) => b.kind === 'theme' && b.n > 0).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))

export type Row = { label: string; n: number; of: number; unit: string }
/** The panel's facts, one a row, each with its own denominator, from A2's numbers for these people. No new rule. */
export function panelRows(b: Bubble): Row[] {
  const r = b.rollup
  const tones = r.tones
  return [
    { label: 'Spoke in favour', n: r.stances.Positive, of: r.people, unit: 'people read' },
    { label: 'Sounded flat or tense', n: tones.counts.Flat + tones.counts.Tense, of: tones.n, unit: 'voices read' },
    { label: 'Hesitated markedly', n: r.marked, of: r.people, unit: 'people read' },
    { label: 'Faces read', n: r.emotions.read, of: r.people, unit: 'people' },
    { label: 'Audio-only, no face', n: r.emotions.noVideo, of: r.people, unit: 'people' },
  ]
}
export const headlineShort = (v: FitPattern) => (v === 'Consistent' ? 'Delivery matched the words' : v === 'Conflicting' ? 'Delivery did not match the words' : v === 'Mixed' ? 'Delivery only partly matched the words' : v === 'No claim' ? 'Nobody took a position' : 'Too few read to say')

export const headline = (b: Bubble) => headlineOf(b.rollup)

export type Quote = { excerpt: Excerpt; code: Code; reading: string }
const TONE_WORDS: Record<string, string> = { Animated: 'Speech animated', Even: 'Speech even', Flat: 'Speech flat', Tense: 'Speech tense' }
const HESITATION_WORDS: Record<string, string> = { 'Marked hesitation': 'Marked hesitation', 'Some hesitation': 'Some hesitation', Steady: 'No hesitation' }

/** The supporting quotes of a bubble in a segment, most confident first, each with its delivery reading in plain words. */
export function quotesOf(b: Bubble, doc: CodebookDoc, basis: Basis, seg: Segment): Quote[] {
  return b.codes
    .flatMap((code) => liveExcerpts(code, basis).filter((e) => inSegment(seg, e.participantId)).map((excerpt) => ({ excerpt, code })))
    .map(({ excerpt, code }) => {
      const p = excerptPoint(excerpt.id)
      const face = p && THEME_MAP.faceInColour ? faceOf(p, doc) : undefined
      const reading = [TONE_WORDS[p.voice.tone], HESITATION_WORDS[p.band], face?.emotion ? `Face ${face.emotion.toLowerCase()}` : ''].filter(Boolean).join(' · ')
      return { excerpt, code, reading }
    })
    .sort((a, b) => b.excerpt.confidence - a.excerpt.confidence || a.excerpt.participantId.localeCompare(b.excerpt.participantId))
}
