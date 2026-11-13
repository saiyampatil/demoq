// Mock clips for A3's Theme videos and Showreel. There is no real video: a clip is a quote with a time and a few readings, made
// from what is already approved. Only accepted themes, their accepted codes and accepted sessions can produce one, so an
// excluded session never does. Nothing here is stored; scores and lengths are worked out each time.
//
// The prototype's quotes have a start time, a participant and a match score. Where the rest comes from is mock, logged in
// docs/OPEN_QUESTIONS.md: the end time follows the length of the quote, emotion strength and the stimulus are made up
// deterministically from the quote, and "audio only" is the participant's real recording type.
import { hasVideo } from './emotion'
import { petOf } from './codebook'
import { liveExcerpts, themeCodes, type Basis, type Code, type CodebookDoc, type Excerpt, type Theme } from '@/state/codebook'

export type Strength = 'High' | 'Medium' | 'Low'
export type Clarity = 'Clear' | 'Fair'
export type Stimulus = 'Concept A' | 'Concept B' | 'Concept C' | 'None'
export type Clip = {
  id: string
  sessionId: string
  participantId: string
  theme: string
  code: string
  /** Seconds into the session. */
  start: number
  end: number
  quote: string
  stimulus: Stimulus
  emotionStrength: Strength
  clarity: Clarity
  /** 0 to 1: how well the quote fits the code. */
  confidence: number
  mode: 'video' | 'audio-only'
}

export const MIN_CLIPS = 4
export const MAX_CLIPS = 8
export const MIN_CLIP_SEC = 6
export const MAX_CLIP_SEC = 15
/** The brief's length for a theme video. A warning, never a block. */
export const BRIEF_RANGE = { min: 45, max: 90 }

const STIMULUS_OF_CODE: Record<string, Stimulus> = { 'c-idea-pause': 'Concept A', 'c-idea-swap': 'Concept B', 'c-idea-portion': 'Concept C' }
const STRENGTHS: Strength[] = ['High', 'Medium', 'Low']
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

export const clipLength = (c: Pick<Clip, 'start' | 'end'>) => c.end - c.start

function clipOf(e: Excerpt, theme: Theme, code: Code): Clip {
  const words = e.text.trim().split(/\s+/).length
  const length = Math.min(MAX_CLIP_SEC, Math.max(MIN_CLIP_SEC, 5 + Math.round(words / 2.5)))
  return {
    id: `clip-${e.id}`,
    sessionId: e.sessionId,
    participantId: e.participantId,
    theme: theme.name,
    code: code.name,
    start: e.atSec,
    end: e.atSec + length,
    quote: e.text,
    stimulus: STIMULUS_OF_CODE[code.id] ?? 'None',
    emotionStrength: STRENGTHS[hash(e.id) % 3],
    clarity: e.confidence >= 0.8 ? 'Clear' : 'Fair',
    confidence: e.confidence,
    mode: hasVideo(e.participantId) ? 'video' : 'audio-only',
  }
}

/**
 * Every clip a theme can have: its accepted codes' quotes from accepted sessions, each once. A quote cited by two codes in the
 * theme is one clip. Sorted by score, best first.
 */
export function clipsOfTheme(doc: CodebookDoc, theme: Theme, basis: Basis): Clip[] {
  const seen = new Set<string>()
  const out: Clip[] = []
  for (const code of themeCodes(doc, theme)) {
    for (const e of liveExcerpts(code, basis)) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(clipOf(e, theme, code))
    }
  }
  return rank(out)
}

const STRENGTH_VALUE: Record<Strength, number> = { High: 1, Medium: 0.6, Low: 0.3 }
const CLARITY_VALUE: Record<Clarity, number> = { Clear: 1, Fair: 0.6 }

/** One score from confidence, emotion strength and clarity. Computed every time, never stored. */
export const scoreOf = (c: Clip) => Math.round((0.5 * c.confidence + 0.3 * STRENGTH_VALUE[c.emotionStrength] + 0.2 * CLARITY_VALUE[c.clarity]) * 1000) / 1000

export const rank = (clips: Clip[]) => [...clips].sort((a, b) => scoreOf(b) - scoreOf(a) || a.participantId.localeCompare(b.participantId) || a.start - b.start)

/**
 * The automatic pick: the best 4 to 8 by score, one clip a person first so the video isn't one voice. Only if that leaves fewer
 * than four does a person get a second clip. `variant` shifts the starting point, so a regenerated version differs from the last;
 * `instruction` nudges it (a pet, "shorter"). Returns [] when fewer than four clips exist.
 */
export function autoPick(clips: Clip[], variant = 0, instruction = ''): Clip[] {
  if (clips.length < MIN_CLIPS) return []
  const text = instruction.toLowerCase()
  let ordered = rank(clips)
  if (/\bdog\b/.test(text)) ordered = [...ordered].sort((a, b) => Number(petOf(b.participantId) === 'Dog') - Number(petOf(a.participantId) === 'Dog'))
  else if (/\bcat\b/.test(text)) ordered = [...ordered].sort((a, b) => Number(petOf(b.participantId) === 'Cat') - Number(petOf(a.participantId) === 'Cat'))
  if (/short/.test(text)) ordered = [...ordered].sort((a, b) => clipLength(a) - clipLength(b))
  // One per person first.
  const firsts: Clip[] = []
  const seen = new Set<string>()
  for (const c of ordered) if (!seen.has(c.participantId)) (seen.add(c.participantId), firsts.push(c))
  const rest = ordered.filter((c) => !firsts.includes(c))
  const pool = firsts.length >= MIN_CLIPS ? firsts : [...firsts, ...rest]
  const size = Math.min(MAX_CLIPS, /short/.test(text) ? MIN_CLIPS + 1 : 6, pool.length)
  // A regenerated version starts further down the list, wrapping round.
  const offset = pool.length > size ? (variant * 2) % (pool.length - size + 1) : 0
  return pool.slice(offset, offset + size)
}

/** A short plain-words line about a theme, for the header. Marked AI-generated where it is shown. */
export function summaryOf(doc: CodebookDoc, theme: Theme, basis: Basis, n: number, of: number): string {
  const codes = themeCodes(doc, theme).map((c) => ({ name: c.name, n: new Set(liveExcerpts(c, basis).map((e) => e.participantId)).size })).sort((a, b) => b.n - a.n)
  if (!codes.length) return `${n} of ${of} people.`
  const top = codes[0]
  return codes.length > 1 ? `${n} of ${of} people. Most often “${top.name}” (${top.n} of ${of}), then “${codes[1].name}” (${codes[1].n} of ${of}).` : `${n} of ${of} people, all about “${top.name}”.`
}
