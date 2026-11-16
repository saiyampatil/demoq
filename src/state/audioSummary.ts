// A3 Audio summary: the script as the Researcher has made it, kept in the browser per study. Only the lines are stored (with their
// state, audio status, history and the fingerprint of what they were written from), plus the voices, the target length, the release
// and the log. Lengths, start times and out-of-date marks are worked out every time (state/audioScript.ts). Nothing here writes to
// the codebook, the report, the showreel, the word cloud or the theme map.
import { useSyncExternalStore } from 'react'
import { AUDIO, type NarratorVoice, type QuoteVoice } from '@/config/audioSummary'
import { now, uid } from './brief'
import { excerpt } from './codebook'
import { buildDraft, checkEdit, chaptersOf, currentOf, fingerprintOf, leftOutOf, segmentLabel, staleOf, totalSeconds, type Cite, type Ctx, type Draft, type Line, type SourceRef } from './audioScript'
import { figures, spoken } from './narration'

export const AUDIO_STORAGE_KEY = 'pulseai-qual:audio-summary'

export type LogEntry = { id: string; at: string; by: string; action: string; detail?: string }
export type Release = { version: number; at: string; by: string; lines: number; seconds: number; /** What the script was when it was released. */ signature: string }
export type AudioDoc = {
  studyId: string
  lines: Line[]
  target: number
  voice: { narrator: NarratorVoice; quote: QuoteVoice }
  release?: Release
  releases: number
  log: LogEntry[]
  writtenAt: string
  /** Lines the Researcher has starred, to come back to or lift into a deck. */
  marks?: string[]
}

// ─── the store ──────────────────────────────────────────────────────────────

type Store = Record<string, AudioDoc>
let store: Store = (() => {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // Storage blocked or corrupt.
  }
  return {}
})()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
function save() {
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
}
export function useAudioSummary(studyId: string): AudioDoc | undefined {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store[studyId],
  )
}
/** Writes the first draft the first time. Call from an effect. */
export function ensureAudio(studyId: string, ctx: Ctx, by: string) {
  if (store[studyId]) return
  store = { ...store, [studyId]: newDoc(studyId, buildDraft(ctx, AUDIO.defaultTarget), AUDIO.defaultTarget, by) }
  save()
  emit()
}
export function updateAudio(studyId: string, fn: (d: AudioDoc) => AudioDoc) {
  const before = store[studyId]
  if (!before) return
  const after = fn(before)
  if (after === before) return
  store = { ...store, [studyId]: after }
  save()
  emit()
}
export function resetAudio() {
  store = {}
  save()
  emit()
}

// ─── the document ───────────────────────────────────────────────────────────

const log = (d: AudioDoc, by: string, action: string, detail?: string): AudioDoc => ({ ...d, log: [{ id: uid('au'), at: now(), by, action, ...(detail ? { detail } : {}) }, ...d.log] })
const mapLine = (d: AudioDoc, id: string, fn: (l: Line) => Line): AudioDoc => ({ ...d, lines: d.lines.map((l) => (l.id === id ? fn(l) : l)) })
const hist = (l: Line, by: string, action: string, previous?: string): Line => ({ ...l, history: [...l.history, { at: now(), by, action, ...(previous !== undefined ? { previous } : {}) }] })
const find = (d: AudioDoc, id: string) => d.lines.find((l) => l.id === id)

export function newDoc(studyId: string, draft: Draft, target: number, by: string): AudioDoc {
  const stamp = now()
  const lines = draft.lines.map((l) => hist(l, 'PulseAI', 'Written'))
  return log({ studyId, lines, target, voice: { narrator: AUDIO.narratorVoices[0], quote: AUDIO.quoteVoices[0] }, releases: 0, log: [], writtenAt: stamp }, by, 'Wrote the draft', `${lines.length} lines for ${target} minutes`)
}

/** Star or unstar a line. A convenience for the Researcher: it changes nothing in the script. */
export const toggleMark = (d: AudioDoc, id: string): AudioDoc => (find(d, id) ? { ...d, marks: (d.marks ?? []).includes(id) ? (d.marks ?? []).filter((x) => x !== id) : [...(d.marks ?? []), id] } : d)

// ─── approval ───────────────────────────────────────────────────────────────

/** Why a line can't be approved, or null. A claim must be cited, its numbers must match, and it must not be out of date. */
export function approvalProblem(l: Line, ctx: Ctx): string | null {
  if (l.removed) return 'It was removed'
  if (l.type === 'narration' || (l.type === 'note' && figures(l.text).length)) {
    if (!l.cites.length) return 'It has no source'
    const c = checkEdit(l.text, l.type, l.source, l.cites, ctx)
    if (c.problems.length) return c.problems[0]
  }
  if (isOutOfDate(l, ctx)) return 'The analysis changed since it was written'
  return null
}
export function approve(d: AudioDoc, id: string, by: string, ctx: Ctx): AudioDoc {
  const l = find(d, id)
  if (!l || l.state === 'Approved' || approvalProblem(l, ctx)) return d
  return log(mapLine(d, id, (x) => hist({ ...x, state: 'Approved' }, by, 'Approved')), by, 'Approved a line', l.text)
}
export const unapprove = (d: AudioDoc, id: string, by: string): AudioDoc => mapLine(d, id, (x) => (x.locked || x.state !== 'Approved' ? x : hist({ ...x, state: x.edited ? 'Edited' : 'Not approved' }, by, 'Withdrew approval')))

// ─── editing ────────────────────────────────────────────────────────────────

export type EditResult = { doc: AudioDoc; problems: string[] }
/**
 * Saves new wording. A narration line with a numbers mismatch or no source, or a note with a count and no matching source, is not saved
 * and says why. A saved line is Edited, needs audio, and is no longer approved.
 */
export function editLine(d: AudioDoc, id: string, text: string, by: string, ctx: Ctx, source?: SourceRef, cites?: Cite[]): EditResult {
  const l = find(d, id)
  if (!l || l.locked || l.type === 'quote' || l.removed) return { doc: d, problems: ['This line can’t be edited'] }
  const src = source ?? l.source
  const useCites = cites ?? l.cites
  const check = checkEdit(text, l.type, src, useCites, ctx)
  if (check.problems.length) return { doc: d, problems: check.problems }
  const cur = currentOf(src, useCites, ctx)
  const next = mapLine(d, id, (x) => hist({ ...x, text, source: src, cites: useCites, edited: true, state: 'Edited', audio: 'Needs audio', fingerprint: fingerprintOf(cur, useCites), snap: cur.snap, keptAs: undefined }, by, 'Edited', x.text))
  return { doc: log(next, by, 'Edited a line', text), problems: [] }
}
/** Back to the AI's own wording for a line. */
export const backToAI = (d: AudioDoc, id: string, by: string): AudioDoc => {
  const l = find(d, id)
  return !l || !l.aiText || l.locked || l.text === l.aiText ? d : log(mapLine(d, id, (x) => hist({ ...x, text: x.aiText!, edited: false, state: 'Not approved', audio: 'Needs audio' }, by, 'Back to AI draft', x.text)), by, 'Went back to the AI draft', l.aiText)
}
/** Another wording of the same claim from the same source. The one it replaces stays in History. Mock: one of the prebuilt phrasings. */
export function rewrite(d: AudioDoc, id: string, instruction: string, by: string): AudioDoc {
  const l = find(d, id)
  if (!l || l.type !== 'narration' || l.locked || !l.alts?.length) return d
  const options = [l.aiText ?? l.text, ...l.alts].filter((t) => t !== l.text)
  // "Shorter" or "Plainer" takes the shortest of the other wordings; otherwise they are taken in turn.
  const next = /short|plain/i.test(instruction) ? [...options].sort((a, b) => a.length - b.length)[0] : options[l.history.filter((h) => h.action === 'Rewritten').length % options.length]
  return log(mapLine(d, id, (x) => hist({ ...x, text: next, state: 'Not approved', audio: 'Needs audio', edited: x.edited }, by, instruction.trim() ? `Rewritten (${instruction.trim()})` : 'Rewritten', x.text)), by, 'Rewrote a line', next)
}

// ─── removing, restoring, adding ────────────────────────────────────────────

export const removeLine = (d: AudioDoc, id: string, by: string): AudioDoc => {
  const l = find(d, id)
  return !l || l.locked || l.removed ? d : log(mapLine(d, id, (x) => hist({ ...x, removed: { by, at: now() }, state: x.state === 'Approved' ? 'Not approved' : x.state }, by, 'Removed')), by, 'Removed a line', l.text)
}
export const restoreLine = (d: AudioDoc, id: string, by: string): AudioDoc => {
  const l = find(d, id)
  return !l || !l.removed ? d : log(mapLine(d, id, (x) => hist({ ...x, removed: undefined, audio: 'Needs audio' }, by, 'Restored')), by, 'Restored a line', l.text)
}
/** A note from the Researcher. Not a data claim unless it carries a count, and then it must link a source that matches. */
export function addNote(d: AudioDoc, chapter: string, text: string, by: string, ctx: Ctx, source?: SourceRef, cites: Cite[] = []): EditResult {
  const check = checkEdit(text, 'note', source, cites, ctx)
  if (check.problems.length || !text.trim()) return { doc: d, problems: check.problems.length ? check.problems : ['Write something'] }
  const cur = currentOf(source, cites, ctx)
  const line: Line = { id: uid('ln'), chapter, type: 'note', text, source, cites, state: 'Not approved', edited: true, audio: 'Needs audio', fingerprint: fingerprintOf(cur, cites), snap: cur.snap, author: by, history: [{ at: now(), by, action: 'Added' }] }
  // After the last line of the chapter.
  const at = d.lines.map((l) => l.chapter).lastIndexOf(chapter)
  const lines = at < 0 ? [...d.lines, line] : [...d.lines.slice(0, at + 1), line, ...d.lines.slice(at + 1)]
  return { doc: log({ ...d, lines }, by, 'Added a note', text), problems: [] }
}
/** A quote picked from the transcripts: the respondent's own words, never edited. */
export function addQuote(d: AudioDoc, chapter: string, cite: Cite, by: string, ctx: Ctx, source?: SourceRef): AudioDoc {
  const e = excerpt(cite.excerptId)
  if (!e || !ctx.basis.sessions.has(cite.sessionId)) return d
  return addQuoteText(d, chapter, cite, e.text, by, ctx, source)
}
/** The same for a segment found by search, which is a turn of a transcript and not a coded quote. */
export function addQuoteText(d: AudioDoc, chapter: string, cite: Cite, text: string, by: string, ctx: Ctx, source?: SourceRef): AudioDoc {
  if (!ctx.basis.sessions.has(cite.sessionId) || d.lines.some((l) => l.type === 'quote' && !l.removed && l.cites[0]?.sessionId === cite.sessionId && l.cites[0]?.turnIndex === cite.turnIndex)) return d
  const cur = currentOf(source, [cite], ctx)
  const line: Line = { id: uid('ln'), chapter, type: 'quote', text, source, cites: [cite], state: 'Not approved', edited: true, audio: 'Needs audio', fingerprint: fingerprintOf(cur, [cite]), snap: cur.snap, author: by, history: [{ at: now(), by, action: 'Added' }] }
  const at = d.lines.map((l) => l.chapter).lastIndexOf(chapter)
  const lines = at < 0 ? [...d.lines, line] : [...d.lines.slice(0, at + 1), line, ...d.lines.slice(at + 1)]
  return log({ ...d, lines }, by, 'Added a quote', `${cite.participantId}: ${text}`)
}
/** Another quote in place of one: the same slot, a different person's words. */
export function replaceQuote(d: AudioDoc, id: string, cite: Cite, text: string, by: string, ctx: Ctx): AudioDoc {
  const l = find(d, id)
  if (!l || l.type !== 'quote' || !ctx.basis.sessions.has(cite.sessionId)) return d
  const cur = currentOf(l.source, [cite], ctx)
  return log(mapLine(d, id, (x) => hist({ ...x, text, cites: [cite], edited: true, state: 'Not approved', audio: 'Needs audio', fingerprint: fingerprintOf(cur, [cite]), snap: cur.snap, keptAs: undefined }, by, 'Quote replaced', x.text)), by, 'Replaced a quote', text)
}

// ─── voices and audio ───────────────────────────────────────────────────────

/** Changing the narrator or the quote voice marks every line that voice reads "Needs audio". Nothing else changes. */
export function setVoice(d: AudioDoc, which: 'narrator' | 'quote', voice: string, by: string): AudioDoc {
  if (d.voice[which] === voice) return d
  const reads = (l: Line) => (which === 'quote' ? l.type === 'quote' : l.type !== 'quote')
  return log({ ...d, voice: { ...d.voice, [which]: voice }, lines: d.lines.map((l) => (reads(l) && !l.removed ? hist({ ...l, audio: 'Needs audio' }, by, `Voice changed to ${voice}`) : l)) }, by, `Changed the ${which} voice`, voice)
}
export const needsAudio = (d: AudioDoc) => d.lines.filter((l) => !l.removed && l.audio === 'Needs audio')
/** Audio is made only for lines that need it. Returns how many. */
export function regenerateAudio(d: AudioDoc, ids: string[] | undefined, by: string): { doc: AudioDoc; made: number } {
  const want = new Set((ids ?? needsAudio(d).map((l) => l.id)).filter((id) => find(d, id)?.audio === 'Needs audio'))
  if (!want.size) return { doc: d, made: 0 }
  return { doc: log({ ...d, lines: d.lines.map((l) => (want.has(l.id) ? hist({ ...l, audio: 'Current' }, by, 'Audio regenerated') : l)) }, by, 'Regenerated audio', `${want.size} lines`), made: want.size }
}

// ─── rebuild and start over ─────────────────────────────────────────────────

/** Edits the Researcher would lose by starting over: edited lines, their own notes and quotes, and lines they removed. */
export const editsLost = (d: AudioDoc) => d.lines.filter((l) => l.edited || l.type === 'note' || !!l.removed || (l.type === 'quote' && !l.key)).length
const kept = (l: Line) => l.state === 'Approved' || l.state === 'Edited' || !!l.edited || l.type === 'note' || !!l.removed || !l.key

/**
 * Rebuild for a target length. Every line that is Approved, Edited, a note or removed is kept as it is; only Not-approved AI lines are replaced
 * (and AI lines no longer in the draft are dropped). A removed AI line stays removed.
 */
export function rebuild(d: AudioDoc, draft: Draft, target: number, by: string): AudioDoc {
  const keep = d.lines.filter(kept)
  const keptKeys = new Set(keep.map((l) => l.key).filter(Boolean))
  const fresh = draft.lines.filter((l) => !keptKeys.has(l.key)).map((l) => hist(l, 'PulseAI', 'Written'))
  // Fresh and kept lines in the order of the draft; notes and anything not in the draft stay where they were.
  const order = new Map(draft.lines.map((l, i) => [l.key, i]))
  const all = [...keep, ...fresh]
  const pos = (l: Line) => (l.key && order.has(l.key) ? order.get(l.key)! : Number.POSITIVE_INFINITY)
  const chapters = chaptersOf(all)
  const sorted = chapters.flatMap((c) => all.filter((l) => l.chapter === c).sort((a, b) => pos(a) - pos(b) || all.indexOf(a) - all.indexOf(b)))
  return log({ ...d, lines: sorted, target, writtenAt: now() }, by, 'Rebuilt the draft', `${target} minutes, ${fresh.length} lines replaced`)
}
export function startOver(d: AudioDoc, draft: Draft, target: number, by: string): AudioDoc {
  return log({ ...d, lines: draft.lines.map((l) => hist(l, 'PulseAI', 'Written')), target, writtenAt: now() }, by, 'Started over', `${editsLost(d)} edits discarded`)
}
/** An approved theme or tension not yet in the episode, added with its lines from the same rules. */
export function addToEpisode(d: AudioDoc, draft: Draft, kind: 'theme' | 'tension', id: string, by: string): AudioDoc {
  const mine = draft.lines.filter((l) => (kind === 'theme' ? l.chapter === `theme:${id}` : l.chapter === 'tensions' && l.source?.id === id)).filter((l) => !d.lines.some((x) => x.key === l.key))
  if (!mine.length) return d
  const at = kind === 'theme' ? d.lines.map((l) => l.chapter).filter((c) => c.startsWith('theme:')).length && d.lines.map((l) => l.chapter.startsWith('theme:')).lastIndexOf(true) : d.lines.map((l) => l.chapter).lastIndexOf('headline')
  const lines = [...d.lines.slice(0, at + 1), ...mine.map((l) => hist(l, 'PulseAI', 'Added to the episode')), ...d.lines.slice(at + 1)]
  return log({ ...d, lines }, by, 'Added to the episode', id)
}

// ─── the analysis changed ───────────────────────────────────────────────────

export const isOutOfDate = (l: Line, ctx: Ctx) => {
  const s = staleOf(l, ctx)
  if (s.state === 'current') return false
  if (s.state === 'changed') {
    const cur = currentOf(l.source, l.cites, ctx)
    return l.keptAs !== fingerprintOf(cur, l.cites)
  }
  return true
}
/** AI line: written again from today's data, in place. It is no longer approved and needs audio. */
export function updateLine(d: AudioDoc, id: string, draft: Draft, by: string): AudioDoc {
  const l = find(d, id)
  const fresh = l?.key ? draft.lines.find((x) => x.key === l.key) : undefined
  if (!l || !fresh) return d
  return log(mapLine(d, id, (x) => hist({ ...fresh, id: x.id, history: x.history, state: 'Not approved', audio: 'Needs audio', removed: undefined }, by, 'Updated from the new data', x.text)), by, 'Updated a line', fresh.text)
}
/** An edited line: the Researcher chooses to keep their text (against the new data) or take the new AI text. */
export function chooseUpdate(d: AudioDoc, id: string, take: 'mine' | 'new', draft: Draft, by: string, ctx: Ctx): AudioDoc {
  return take === 'new' ? updateLine(d, id, draft, by) : keepAsIs(d, id, by, ctx)
}
/** Acknowledge a change and keep the line. It stays flagged in the export. */
export function keepAsIs(d: AudioDoc, id: string, by: string, ctx: Ctx): AudioDoc {
  const l = find(d, id)
  if (!l) return d
  const cur = currentOf(l.source, l.cites, ctx)
  return log(mapLine(d, id, (x) => hist({ ...x, keptAs: fingerprintOf(cur, x.cites) }, by, 'Kept as it is after the analysis changed')), by, 'Kept a changed line', l.text)
}

// ─── status, release ────────────────────────────────────────────────────────

export type Status = { lines: number; claims: number; cited: number; approved: number; needsAudio: number; outOfDate: number; seconds: number }
export function statusOf(d: AudioDoc, ctx: Ctx): Status {
  const live = d.lines.filter((l) => !l.removed)
  const claims = live.filter((l) => l.type === 'narration' || (l.type === 'note' && figures(l.text).length > 0))
  return {
    lines: live.length,
    claims: claims.length,
    cited: claims.filter((l) => l.cites.length > 0).length,
    approved: live.filter((l) => l.state === 'Approved').length,
    needsAudio: live.filter((l) => l.audio === 'Needs audio').length,
    outOfDate: live.filter((l) => isOutOfDate(l, ctx)).length,
    seconds: totalSeconds(d.lines),
  }
}
export const signatureOf = (d: AudioDoc) => d.lines.filter((l) => !l.removed).map((l) => `${l.id}:${l.text}:${l.state}`).join('|') + `|${d.voice.narrator}|${d.voice.quote}`

/** What stops "Approve and release": every claim approved and cited, nothing out of date, no audio to produce. A length outside the brief only warns. */
export function releaseProblems(d: AudioDoc, ctx: Ctx): string[] {
  const live = d.lines.filter((l) => !l.removed)
  const claims = live.filter((l) => l.type === 'narration' || (l.type === 'note' && figures(l.text).length > 0))
  const out: string[] = []
  const unapproved = claims.filter((l) => l.state !== 'Approved').length
  const uncited = claims.filter((l) => !l.cites.length).length
  if (unapproved) out.push(`${unapproved} ${unapproved === 1 ? 'claim is' : 'claims are'} not approved`)
  if (uncited) out.push(`${uncited} ${uncited === 1 ? 'claim has' : 'claims have'} no source`)
  const stale = live.filter((l) => isOutOfDate(l, ctx)).length
  if (stale) out.push(`${stale} ${stale === 1 ? 'line is' : 'lines are'} out of date`)
  const audio = live.filter((l) => l.audio === 'Needs audio').length
  if (audio) out.push(`${audio} ${audio === 1 ? 'line needs' : 'lines need'} audio`)
  return out
}
export function release(d: AudioDoc, by: string, ctx: Ctx): AudioDoc {
  if (releaseProblems(d, ctx).length) return d
  const version = d.releases + 1
  return log({ ...d, releases: version, release: { version, at: now(), by, lines: d.lines.filter((l) => !l.removed).length, seconds: totalSeconds(d.lines), signature: signatureOf(d) } }, by, `Released v${version}`, `${d.lines.filter((l) => !l.removed).length} lines`)
}
export const changedSinceRelease = (d: AudioDoc) => !!d.release && d.release.signature !== signatureOf(d)

export { leftOutOf, segmentLabel, spoken }
