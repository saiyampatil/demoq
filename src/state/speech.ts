// How people sounded against what they said (Results Analysis, A2). The one module the verdicts, insight sentences, "What stood out"
// lines and "Moments to watch" come from, so no screen can disagree with another.
//
// The rules:
// - Speech only: tone and certainty, each against the person's own baseline. Read for everyone, audio-only included.
//   Face readings play no part in any verdict, row or count. They are stored and not used here.
// - A person's position at a quote is what their words claim (for it, against it, or just described), from the code's stance
//   (AI-suggested, and the Researcher can correct it for a code or for one person).
//   For it: a Flat or Tense voice is No match. Against it: an Animated voice is No match. Marked hesitation with nothing
//   else off is Hesitant, never No match. Otherwise Matched.
// - A person counts once per theme or code. With several positions, more than half No match is No match, more than half
//   Matched is Matched. Otherwise, with nothing contradicting, they are Hesitant; with some positions contradicting and no side
//   ahead, they are Split across codes: in the base, never Matched, No match or Hesitant. Exactly half is never "more than half".
// - A row's verdict is the same rule over the people with a position. Thresholds are in src/config/delivery.ts.

import { DELIVERY, VERDICT_LABEL } from '@/config/delivery'
import { VOICE_RULES, stanceOf, type Stance, type Tone } from '@/mock/emotion'
import { SIGNAL_RULES, bandRank, signsOf, type Point } from '@/mock/signals'
import type { CodebookDoc, InsightDecision, InsightSnap } from './codebook'
import { hash } from './hash'
import { checkNarration, figures } from './narration'

export type Fit = 'Matches' | 'Pulls against' | 'Uncertain'
/** A person's one result. "Split" is only for a person whose positions across codes point both ways and neither side is ahead. */
export type PersonFit = Fit | 'Split'
export type Side = 'Positive' | 'Negative'
/** Delivery has one channel now. Kept as a type so a result still says where a "no match" came from. */
export type Channel = 'Speech'
export type FitResult = { fit?: Fit; against: Channel[] }

const FIT_RANK: Record<Fit, number> = { Matches: 1, Uncertain: 2, 'Pulls against': 3 }
/** More than half. Exactly half is never more than half. */
const more = (k: number, n: number) => n > 0 && k / n > DELIVERY.majority

// ─── what the words claim ───────────────────────────────────────────────────

/** A person's stance at a code: the Researcher's correction for them, else for the code, else PulseAI's own. */
export function stanceFor(doc: Pick<CodebookDoc, 'stanceFixes'> | undefined, codeId: string | undefined, participantId: string, fallback?: Stance): Stance {
  if (!codeId) return fallback ?? 'Neutral'
  const f = doc?.stanceFixes
  return f?.[`person:${codeId}|${participantId}`]?.to ?? f?.[`code:${codeId}`]?.to ?? stanceOf(codeId)
}
/** What a code's words claim as it stands: the Researcher's correction for the code, else PulseAI's own. */
export const codeStance = (doc: Pick<CodebookDoc, 'stanceFixes'> | undefined, codeId: string): Stance => doc?.stanceFixes?.[`code:${codeId}`]?.to ?? stanceOf(codeId)
/** PulseAI's own stance for a code, before any correction. */
export const aiStance = (codeId: string): Stance => stanceOf(codeId)
/** The same point with the stance as it stands now, so every later reading uses the corrected words. */
export const withStance = (p: Point, doc: Pick<CodebookDoc, 'stanceFixes'> | undefined): Point => {
  const stance = stanceFor(doc, p.codeId, p.participantId, p.stance)
  return stance === p.stance ? p : { ...p, stance }
}

// ─── one position ───────────────────────────────────────────────────────────

/** Whether the tone is the kind that does not match what these words claim. Hesitation is never used here. */
export const speechAgainst = (p: Point, stance: Stance | undefined = p.stance): boolean =>
  (stance === 'Positive' || stance === 'Negative') && (stance === 'Positive' ? DELIVERY.positive.tones : DELIVERY.negative.tones).some((t) => t === p.voice.tone)

/** One quote against its words. Only speech is read. The second argument is ignored: faces never reach a verdict. */
export function fitOf(p: Point, _face?: unknown): FitResult {
  void _face
  if (!p.stance || p.stance === 'Neutral') return { against: [] }
  const against: Channel[] = speechAgainst(p) ? ['Speech'] : []
  return { fit: against.length ? 'Pulls against' : p.band === 'Marked hesitation' ? 'Uncertain' : 'Matches', against }
}

export type Position = { point: Point; stance: Side; fit: Fit }

// ─── one person ─────────────────────────────────────────────────────────────

export type PersonRead = {
  participantId: string
  /** The quotes where their words took a side. Empty when they just described it. */
  positions: Position[]
  /** Every quote of theirs in this theme or code, including the ones that just describe. */
  all: Point[]
  /** Which side they spoke on (the larger number of positions; a tie takes their earliest). Absent when they just described it. */
  side?: Side
  /** Did their delivery match, once for the person. Absent when they just described it. */
  fit?: PersonFit
  /** More than half of their positions showed marked hesitation. */
  hesitated: boolean
  /** More than half of their positions sounded wrong for their words: flat or tense for it, animated against. */
  offTone: boolean
  /** The quote that stands for them: where delivery matched least, then where they hesitated most. Play opens it. */
  point: Point
  tone: Tone
}

const byTime = (a: Point, b: Point) => a.atSec - b.atSec

/** Everyone's reading once, from every quote of theirs. `points` are all the quotes, not one per person. */
export function readPeople(points: Point[], doc?: Pick<CodebookDoc, 'stanceFixes'>): PersonRead[] {
  const by = new Map<string, Point[]>()
  points.map((p) => withStance(p, doc)).forEach((p) => by.set(p.participantId, [...(by.get(p.participantId) ?? []), p]))
  const reads = [...by.entries()].map(([participantId, all]): PersonRead => {
    all.sort(byTime)
    const positions: Position[] = all.flatMap((p) => {
      const r = fitOf(p)
      return r.fit && (p.stance === 'Positive' || p.stance === 'Negative') ? [{ point: p, stance: p.stance, fit: r.fit }] : []
    })
    const n = positions.length
    const count = (f: Fit) => positions.filter((x) => x.fit === f).length
    const pos = positions.filter((x) => x.stance === 'Positive').length
    const side: Side | undefined = !n ? undefined : pos * 2 > n ? 'Positive' : pos * 2 < n ? 'Negative' : positions[0].stance
    // Neither side ahead: with nothing contradicting, hesitation is what is left (Hesitant); with something contradicting, they split.
    const fit: PersonFit | undefined = !n ? undefined : more(count('Pulls against'), n) ? 'Pulls against' : more(count('Matches'), n) ? 'Matches' : count('Pulls against') === 0 ? 'Uncertain' : 'Split'
    // The quote that stands for them: delivery matched least, then hesitated most, then earliest.
    const rankOf = (p: Point) => (n ? FIT_RANK[fitOf(p).fit ?? 'Matches'] : 0)
    const clearest = [...(n ? positions.map((x) => x.point) : all)].sort((a, b) => rankOf(b) - rankOf(a) || bandRank(b.band) - bandRank(a.band) || a.atSec - b.atSec)[0]
    return {
      participantId,
      positions,
      all,
      side,
      fit,
      hesitated: more(positions.filter((x) => x.point.band === 'Marked hesitation').length, n),
      offTone: more(positions.filter((x) => speechAgainst(x.point, x.stance)).length, n),
      point: clearest,
      tone: clearest.voice.tone,
    }
  })
  const rank = (r: PersonRead) => (r.fit ? FIT_RANK[r.fit === 'Split' ? 'Uncertain' : r.fit] : 0)
  return reads.sort((a, b) => rank(b) - rank(a) || bandRank(b.point.band) - bandRank(a.point.band) || a.participantId.localeCompare(b.participantId))
}

// ─── a verdict ──────────────────────────────────────────────────────────────

export type FitPattern = 'Consistent' | 'Mixed' | 'Conflicting' | 'Too few to read' | 'No claim'
/**
 * `fits` is the Matched people, `uncertain` the Hesitant, `against` the No match, `split` the people split across codes;
 * `n` is everyone with a position, split people included, so they can only make a verdict Mixed, never Consistent or Gap.
 */
export type FitSplit = { fits: number; uncertain: number; against: number; split: number; n: number; pattern: FitPattern }
/** The rule for a verdict, from config. */
export const FIT_RULE = { min: DELIVERY.minPeople, majority: DELIVERY.majority }

export function fitSplitOf(reads: PersonRead[]): FitSplit {
  const claim = reads.filter((r) => r.fit)
  const n = claim.length
  const against = claim.filter((r) => r.fit === 'Pulls against').length
  const uncertain = claim.filter((r) => r.fit === 'Uncertain').length
  const split = claim.filter((r) => r.fit === 'Split').length
  const matches = n - against - uncertain - split
  const pattern: FitPattern = reads.length < FIT_RULE.min ? 'Too few to read' : !n ? 'No claim' : n < FIT_RULE.min ? 'Too few to read' : more(against, n) ? 'Conflicting' : more(matches, n) ? 'Consistent' : 'Mixed'
  return { fits: matches, uncertain, against, split, n, pattern }
}
/** The verdict over a set of quotes, from everyone's one reading. */
export const fitSplit = (points: Point[], doc?: Pick<CodebookDoc, 'stanceFixes'>): FitSplit => fitSplitOf(readPeople(points, doc))

// ─── the insight sentence ───────────────────────────────────────────────────

export type Insight = {
  sentence: string
  /** The N in "n of N": everyone who raised the theme. */
  of: number
  /** In favour, against, and just described. */
  positive: number
  negative: number
  described: number
  shape: 'positive' | 'negative' | 'split' | 'none'
  /** People on the leading side, and how many of them hesitated and sounded off. Only for the two sides with more than half. */
  lead?: { side: Side; n: number; hesitated: number; off: number; either: number }
}

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

/**
 * What people said and how they sounded, in one sentence, from one person-by-person count. One base per sentence ("n of N"),
 * no percentages, "most" never used. A clause needs at least three people, otherwise it is left out. Null under three people.
 */
export function insightOf(reads: PersonRead[]): Insight | null {
  const N = reads.length
  if (N < DELIVERY.minPeople) return null
  const pos = reads.filter((r) => r.side === 'Positive')
  const neg = reads.filter((r) => r.side === 'Negative')
  const described = N - pos.length - neg.length
  const base = { of: N, positive: pos.length, negative: neg.length, described }
  const min = DELIVERY.clauseMin
  if (!pos.length && !neg.length) return { ...base, shape: 'none', sentence: `Nobody took a side. All ${N} people just described what happened.` }
  if (more(pos.length, N) || more(neg.length, N)) {
    const side: Side = more(pos.length, N) ? 'Positive' : 'Negative'
    const group = side === 'Positive' ? pos : neg
    const n = group.length
    const hesitated = group.filter((r) => r.hesitated).length
    const off = group.filter((r) => r.offTone).length
    const either = group.filter((r) => r.hesitated || r.offTone).length
    const lead = { side, n, hesitated, off, either }
    if (side === 'Positive') {
      const clauses = [hesitated >= min && `${hesitated} of those ${n} hesitated`, off >= min && `${off} sounded flat or tense`].filter((x): x is string => !!x)
      // The second clause shares the first one's base; with only the second, it names its own.
      const text = clauses.length === 2 ? `${clauses[0]} and ${clauses[1]}` : clauses.length === 1 ? (off >= min ? `${off} of those ${n} sounded flat or tense` : clauses[0]) : ''
      return { ...base, shape: 'positive', lead, sentence: `${n} of ${N} people were verbally positive about it${text ? `, but ${text}` : ', and their delivery backed it up'}.` }
    }
    const text = either >= min ? `${either} of those ${n} sounded animated or hesitated` : ''
    return { ...base, shape: 'negative', lead, sentence: `${n} of ${N} people were verbally negative about it${text ? `, and ${text}` : ', and their delivery backed it up'}.` }
  }
  const sentence = pos.length && neg.length ? `${people(pos.length)} spoke in favour of it and ${neg.length} spoke against it.` : `${people(pos.length || neg.length)} spoke ${pos.length ? 'in favour of' : 'against'} it.`
  return { ...base, shape: 'split', sentence }
}

// ─── what stood out, per code ───────────────────────────────────────────────

export type CodeStandoutKey = 'hesitated' | 'flatTense' | 'animated' | 'even'
export type CodeStandout = { key: CodeStandoutKey; label: string; n: number; of: number; text: string }
const STANDOUT_LABEL: Record<CodeStandoutKey, string> = { hesitated: 'Hesitated', flatTense: 'Flat or tense', animated: 'Animated', even: 'Even' }

/**
 * A code's strongest speech pattern: Hesitated, Flat or tense, Animated, or Even, with "n of N". Shown only when at least three
 * people share it, otherwise nothing (a dash). A pattern that stands out comes before Even, which is where people sit by default.
 */
export function standoutOf(reads: PersonRead[]): CodeStandout | null {
  const N = reads.length
  const count: Record<CodeStandoutKey, number> = {
    hesitated: reads.filter((r) => (r.positions.length ? r.hesitated : r.point.band === 'Marked hesitation')).length,
    flatTense: reads.filter((r) => r.tone === 'Flat' || r.tone === 'Tense').length,
    animated: reads.filter((r) => r.tone === 'Animated').length,
    even: reads.filter((r) => r.tone === 'Even').length,
  }
  const order: CodeStandoutKey[] = ['hesitated', 'flatTense', 'animated', 'even']
  const notable = order.slice(0, 3).filter((k) => count[k] >= DELIVERY.clauseMin).sort((a, b) => count[b] - count[a])[0]
  const key = notable ?? (count.even >= DELIVERY.clauseMin ? 'even' : undefined)
  if (!key) return null
  return { key, label: STANDOUT_LABEL[key], n: count[key], of: N, text: `${STANDOUT_LABEL[key]} ${count[key]} of ${N}` }
}

/** The label on a code row: "Sounded animated · 4 of 9", "Hesitated · 3 of 5". Same pattern and numbers as `text`, in words. */
export const standoutLabel = (x: CodeStandout): string =>
  `${{ hesitated: 'Hesitated', flatTense: 'Sounded flat or tense', animated: 'Sounded animated', even: 'Sounded even' }[x.key]} · ${x.n} of ${x.of}`

// ─── moments to watch ───────────────────────────────────────────────────────

export type MomentToWatch = { participantId: string; sessionId: string; atSec: number; quote?: string; /** The measured reason, in numbers. */ reason: string; score: number; contradicts: boolean; point: Point }

const cap = (x: number, c: number) => Math.min(c, x)
/** How far a quote is from this person's own baseline, plus a bonus when it contradicts their words. */
export function momentScore(p: Point, contradicts: boolean): number {
  const k = DELIVERY.momentScore
  const delay = cap(p.facts.delaySec / (SIGNAL_RULES.delayRatio * p.usual), k.delayCap)
  const pause = cap(p.facts.pauseSec / SIGNAL_RULES.pauseSec, k.pauseCap)
  const fillers = cap(p.facts.fillers / SIGNAL_RULES.fillers, k.fillersCap)
  const tone = k.toneWeight * (Math.abs(p.voice.pitch / p.voice.usualPitch - 1) + Math.abs(p.voice.pace / p.voice.usualPace - 1))
  return Math.round((delay + pause + fillers + tone + (contradicts ? k.contradictBonus : 0)) * 100) / 100
}

/** One measure that crossed its limit at a quote: the sentence that says so, and the numbers that sentence prints. */
export type Fired = { key: 'delay' | 'pause' | 'fillers' | 'pace' | 'pitch' | 'loudness'; text: string; numbers: number[] }

/**
 * The measures that crossed a limit at this quote, and only those. Nothing is printed that did not fire.
 *   Hesitation: delay, pause, fillers or restarts, each only when it is a sign (src/mock/signals.ts SIGNAL_RULES).
 *   Tone (src/mock/emotion.ts VOICE_RULES): pitch range (how much the voice rises and falls) and loudness against their usual, whichever
 *   crossed its limit; pace only when pace itself crossed a limit (a tense voice is a quick one).
 */
export function firedMeasures(p: Point): Fired[] {
  const out: Fired[] = []
  const signs = signsOf(p.facts, p.usual)
  if (signs.includes('delay')) out.push({ key: 'delay', text: `Answered ${p.facts.delaySec.toFixed(1)} s after the question. Usual: ${p.usual.toFixed(1)} s.`, numbers: [p.facts.delaySec, p.usual] })
  if (signs.includes('pause')) out.push({ key: 'pause', text: `Paused ${p.facts.pauseSec.toFixed(1)} s mid-answer.`, numbers: [p.facts.pauseSec] })
  if (signs.includes('fillers')) out.push({ key: 'fillers', text: `${p.facts.fillers} fillers or restarts.`, numbers: [p.facts.fillers] })
  const v = p.voice
  const pitchR = v.pitch / v.usualPitch
  const paceR = v.pace / v.usualPace
  if (v.tone === 'Tense' && paceR >= VOICE_RULES.tensePace) out.push({ key: 'pace', text: `Spoke faster than usual: ${v.pace} words a minute vs their usual ${v.usualPace}.`, numbers: [v.pace, v.usualPace] })
  if ((v.tone === 'Tense' && pitchR <= VOICE_RULES.tensePitch) || (v.tone === 'Flat' && pitchR <= VOICE_RULES.flatPitch)) out.push({ key: 'pitch', text: `Voice varied less than usual: pitch range ${v.pitch} vs their usual ${v.usualPitch}.`, numbers: [v.pitch, v.usualPitch] })
  if (v.tone === 'Animated' && pitchR >= VOICE_RULES.animatedPitch) out.push({ key: 'pitch', text: `Voice varied more than usual: pitch range ${v.pitch} vs their usual ${v.usualPitch}.`, numbers: [v.pitch, v.usualPitch] })
  if (v.tone === 'Flat' && v.loudness <= VOICE_RULES.flatLoudness) out.push({ key: 'loudness', text: `Quieter than usual by ${Math.abs(v.loudness)} dB.`, numbers: [Math.abs(v.loudness)] })
  return out
}

/** Why this quote is worth playing, in the numbers that crossed a limit. Empty when nothing did: then no reason line is shown. */
export const measuredReason = (p: Point): string => firedMeasures(p).map((f) => f.text).join(' ')

/** The clips most worth playing, one per person, the clearest first. Each carries the measured reason. */
export function momentsToWatch(reads: PersonRead[], max: number): MomentToWatch[] {
  return reads
    .map((r): MomentToWatch => {
      const scored = r.all.map((p) => {
        const contradicts = fitOf(p).fit === 'Pulls against'
        return { p, contradicts, score: momentScore(p, contradicts) }
      })
      const best = scored.sort((a, b) => b.score - a.score || a.p.atSec - b.p.atSec)[0]
      return { participantId: r.participantId, sessionId: best.p.sessionId, atSec: best.p.atSec, quote: best.p.excerpt?.text, reason: measuredReason(best.p), score: best.score, contradicts: best.contradicts, point: best.p }
    })
    .sort((a, b) => b.score - a.score || a.participantId.localeCompare(b.participantId))
    .slice(0, max)
}

// ─── decisions on an insight ────────────────────────────────────────────────

export type InsightStatus = 'Suggested' | 'Accepted' | 'Edited' | 'Left out' | 'Out of date' | 'Nothing to decide'
/** What a theme's insight is made from right now, for a decision to be compared against later. */
export type InsightNow = { text: string; fingerprint: string; snap: InsightSnap }

/** Fingerprints the reading: the codes, each person's one reading, and the sentence. Editing the wording never changes it. */
export function insightNow(codeIds: string[], reads: PersonRead[], insight: Insight | null, verdict: FitPattern): InsightNow {
  const text = insight?.sentence ?? ''
  const rows = reads.map((r) => [r.participantId, r.side ?? '-', r.fit ?? '-', r.hesitated ? 1 : 0, r.offTone ? 1 : 0]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const n = insight?.lead?.n ?? (insight ? insight.positive + insight.negative : 0)
  return { text, fingerprint: hash(JSON.stringify({ c: [...codeIds].sort(), r: rows, t: text })), snap: { n, of: reads.length, verdict: VERDICT_LABEL[verdict], text } }
}

/** Where a decision stands: Out of date when what it was made from has moved since it was accepted or edited. A left-out insight stays left out. Under 3 people: Nothing to decide. */
export function insightStatus(decision: InsightDecision | undefined, now: InsightNow): { status: InsightStatus; was?: InsightSnap; now?: InsightSnap } {
  if (decision?.status === 'Left out') return { status: 'Left out' }
  // Too few people to read a pattern: nothing to accept. It can still be left out, with a reason.
  if (!now.text) return { status: 'Nothing to decide' }
  if (!decision) return { status: 'Suggested' }
  if (decision.fingerprint !== now.fingerprint) return { status: 'Out of date', was: decision.snap, now: now.snap }
  return { status: decision.status }
}

/**
 * An edit changes the wording only. The numbers are locked to the computed sentence, and the wording must pass the same rules as
 * every narrated line (one base, no percentages, plain words). Returns what is wrong, or nothing.
 */
export function checkInsightEdit(text: string, computed: string): string[] {
  const digits = (t: string) => (t.match(/\d+/g) ?? []).sort().join(',')
  const problems: string[] = []
  if (!text.trim()) return ['Write a sentence']
  if (digits(text) !== digits(computed)) problems.push('The numbers are locked. Change the wording, not the figures')
  problems.push(...checkNarration(text).problems)
  const f = figures(text)
  if (f.length === 0 && /\d/.test(computed) && figures(computed).length > 0) problems.push('Keep the “n of N” figure')
  return problems
}

/** Why Accept is off when there are too few people. */
export const TOO_FEW_TIP = 'Too few people to read a pattern'

// ─── speech evidence, for a code's panel ────────────────────────────────────

const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b)
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0
}
const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1)

/**
 * What was measured for the people who said a code, in plain lines, the delay against their own usual first. Numbers only, each with its base.
 * Each person counts once (the quote that stands for them), so these lines use the same people as the tiles.
 */
export type EvidenceRow = {
  key: 'delay' | 'pause' | 'fillers' | 'tone'
  /** Label on the left. */
  label: string
  /** The bold "n of N people" on the right. */
  n: number
  of: number
  /** One small grey line: what it is measured against. */
  baseline: string
  /** The same row as one sentence. */
  text: string
}

export function speechEvidence(reads: PersonRead[]): EvidenceRow[] {
  const pts = reads.map((r) => r.point)
  const N = pts.length
  if (!N) return []
  const slow = pts.filter((p) => signsOf(p.facts, p.usual).includes('delay')).length
  const paused = pts.filter((p) => p.facts.pauseSec >= SIGNAL_RULES.pauseSec).length
  const fillers = pts.filter((p) => p.facts.fillers >= SIGNAL_RULES.fillers).length
  const flatTense = pts.filter((p) => p.voice.tone === 'Flat' || p.voice.tone === 'Tense').length
  const animated = pts.filter((p) => p.voice.tone === 'Animated').length
  const medDelay = one(median(pts.map((p) => p.facts.delaySec)))
  const medUsual = one(median(pts.map((p) => p.usual)))
  const longest = one(Math.max(...pts.map((p) => p.facts.pauseSec)))
  return [
    { key: 'delay', label: 'Delay', n: slow, of: N, baseline: `Started a median ${medDelay} s after the question. Their usual: ${medUsual} s.`, text: `Answers started a median ${medDelay} s after the question. Their usual: ${medUsual} s. ${slow} of ${N} started well after their usual.` },
    { key: 'pause', label: 'Pauses', n: paused, of: N, baseline: `${SIGNAL_RULES.pauseSec} s or longer counts. The longest was ${longest} s.`, text: `${paused} of ${N} paused ${SIGNAL_RULES.pauseSec} s or longer mid-answer. The longest pause was ${longest} s.` },
    { key: 'fillers', label: 'Fillers or restarts', n: fillers, of: N, baseline: `${SIGNAL_RULES.fillers} or more counts.`, text: `${fillers} of ${N} used ${SIGNAL_RULES.fillers} or more fillers or restarts.` },
    { key: 'tone', label: 'Tone', n: flatTense, of: N, baseline: `Flat or tense against their own usual. ${animated} sounded animated, ${N - flatTense - animated} even.`, text: `Tone against their own usual: ${flatTense} flat or tense, ${animated} animated, ${N - flatTense - animated} even.` },
  ]
}
