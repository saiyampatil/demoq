// A3 Theme videos and Showreel: which clips are in each theme's video, the versions the Researcher keeps, and which one is the
// Default. Only the versions and the Default are stored. The clips themselves, their scores and every total length are worked
// out from the accepted data each time (mock/showreel.ts), so a clip from a session that is no longer accepted just drops out.
import { useSyncExternalStore } from 'react'
import { now, uid } from './brief'
import { autoPick, clipLength, MAX_CLIPS, MIN_CLIPS, type Clip } from '@/mock/showreel'

export const SHOWREEL_STORAGE_KEY = 'pulseai-qual:showreel'
export const MAX_VERSIONS = 3

export type Version = {
  id: string
  /** The label: v1, v2, v3. A deleted number is reused. */
  n: number
  /** The clips, in video order. */
  clipIds: string[]
  captions: boolean
  /** What the Researcher asked for when regenerating, if anything. */
  instruction?: string
  /** A mock: the new version is another automatic pick from the ranked list. */
  simulated: boolean
  createdAt: string
}
export type ThemeVideo = { versions: Version[]; defaultId?: string }
export type ShowreelDoc = {
  studyId: string
  themes: Record<string, ThemeVideo>
  /** Showreel order, by theme ID. Themes not listed follow in the codebook's order. */
  order: string[]
  /** Left out of the showreel by the Researcher. */
  leftOut: string[]
}

type Store = Record<string, ShowreelDoc>
let store: Store = (() => {
  try {
    const raw = localStorage.getItem(SHOWREEL_STORAGE_KEY)
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
    localStorage.setItem(SHOWREEL_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
}
const blank = (studyId: string): ShowreelDoc => ({ studyId, themes: {}, order: [], leftOut: [] })

export function useShowreel(studyId: string): ShowreelDoc {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store[studyId] ?? EMPTY(studyId),
  )
}
const empties: Record<string, ShowreelDoc> = {}
const EMPTY = (studyId: string) => (empties[studyId] ??= blank(studyId))

export function updateShowreel(studyId: string, fn: (d: ShowreelDoc) => ShowreelDoc) {
  store = { ...store, [studyId]: fn(store[studyId] ?? blank(studyId)) }
  save()
  emit()
}

/** Forgets everything saved. Used by tests. */
export function resetShowreel() {
  store = {}
  save()
  emit()
}

// ─── versions ───────────────────────────────────────────────────────────────

const theme = (d: ShowreelDoc, id: string): ThemeVideo => d.themes[id] ?? { versions: [] }
const setTheme = (d: ShowreelDoc, id: string, t: ThemeVideo): ShowreelDoc => ({ ...d, themes: { ...d.themes, [id]: t } })
const mapVersion = (d: ShowreelDoc, themeId: string, versionId: string, fn: (v: Version) => Version): ShowreelDoc => {
  const t = theme(d, themeId)
  return setTheme(d, themeId, { ...t, versions: t.versions.map((v) => (v.id === versionId ? fn(v) : v)) })
}

export const versionsOf = (d: ShowreelDoc, themeId: string) => theme(d, themeId).versions
export const defaultOf = (d: ShowreelDoc, themeId: string) => {
  const t = theme(d, themeId)
  return t.versions.find((v) => v.id === t.defaultId)
}

/** The first version of a theme, an automatic pick. It is not the Default until the Researcher says so. */
export function firstVersion(d: ShowreelDoc, themeId: string, eligible: Clip[]): ShowreelDoc {
  if (theme(d, themeId).versions.length || eligible.length < MIN_CLIPS) return d
  const v: Version = { id: uid('sv'), n: 1, clipIds: autoPick(eligible).map((c) => c.id), captions: true, simulated: false, createdAt: now() }
  return setTheme(d, themeId, { versions: [v] })
}

/** Why a new version can't be made, or null when it can. At most three. */
export const cantRegenerate = (d: ShowreelDoc, themeId: string, eligible: Clip[]): string | null =>
  eligible.length < MIN_CLIPS ? 'Not enough clips yet.' : theme(d, themeId).versions.length >= MAX_VERSIONS ? 'Delete a version to make a new one.' : null

export function newVersion(d: ShowreelDoc, themeId: string, eligible: Clip[], instruction: string): ShowreelDoc {
  if (cantRegenerate(d, themeId, eligible)) return d
  const t = theme(d, themeId)
  const used = new Set(t.versions.map((v) => v.n))
  const n = [1, 2, 3].find((x) => !used.has(x))!
  const v: Version = { id: uid('sv'), n, clipIds: autoPick(eligible, t.versions.length, instruction).map((c) => c.id), captions: true, ...(instruction.trim() ? { instruction: instruction.trim() } : {}), simulated: true, createdAt: now() }
  return setTheme(d, themeId, { ...t, versions: [...t.versions, v].sort((a, b) => a.n - b.n) })
}

/** The Default can't be deleted while it is the Default: set another one first. */
export const cantDelete = (d: ShowreelDoc, themeId: string, versionId: string): string | null => (theme(d, themeId).defaultId === versionId ? 'Set another version as the default first.' : null)

export function deleteVersion(d: ShowreelDoc, themeId: string, versionId: string): ShowreelDoc {
  if (cantDelete(d, themeId, versionId)) return d
  const t = theme(d, themeId)
  return setTheme(d, themeId, { ...t, versions: t.versions.filter((v) => v.id !== versionId) })
}

export const setDefault = (d: ShowreelDoc, themeId: string, versionId: string): ShowreelDoc => setTheme(d, themeId, { ...theme(d, themeId), defaultId: versionId })
export const setCaptions = (d: ShowreelDoc, themeId: string, versionId: string, on: boolean) => mapVersion(d, themeId, versionId, (v) => ({ ...v, captions: on }))

// ─── editing a version's clips ──────────────────────────────────────────────

export const removeClip = (d: ShowreelDoc, themeId: string, versionId: string, clipId: string) => mapVersion(d, themeId, versionId, (v) => ({ ...v, clipIds: v.clipIds.filter((c) => c !== clipId) }))

export function moveClip(d: ShowreelDoc, themeId: string, versionId: string, from: number, to: number) {
  return mapVersion(d, themeId, versionId, (v) => {
    if (to < 0 || to >= v.clipIds.length || from === to) return v
    const next = [...v.clipIds]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    return { ...v, clipIds: next }
  })
}

/** Puts `clipId` in place of `oldId`, in the same position. A clip already in the video is never added a second time. */
export const replaceClip = (d: ShowreelDoc, themeId: string, versionId: string, oldId: string, clipId: string) =>
  mapVersion(d, themeId, versionId, (v) => (v.clipIds.includes(clipId) ? v : { ...v, clipIds: v.clipIds.map((c) => (c === oldId ? clipId : c)) }))

export const addClip = (d: ShowreelDoc, themeId: string, versionId: string, clipId: string) =>
  mapVersion(d, themeId, versionId, (v) => (v.clipIds.includes(clipId) || v.clipIds.length >= MAX_CLIPS ? v : { ...v, clipIds: [...v.clipIds, clipId] }))

// ─── the showreel ───────────────────────────────────────────────────────────

/** Themes in the Researcher's order: the saved order first, then any others as the codebook has them. */
export function orderedThemes(d: ShowreelDoc, themeIds: string[]): string[] {
  const known = d.order.filter((id) => themeIds.includes(id))
  return [...known, ...themeIds.filter((id) => !known.includes(id))]
}

export function moveTheme(d: ShowreelDoc, themeIds: string[], from: number, to: number): ShowreelDoc {
  const list = orderedThemes(d, themeIds)
  if (to < 0 || to >= list.length || from === to) return d
  const [x] = list.splice(from, 1)
  list.splice(to, 0, x)
  return { ...d, order: list }
}

export const toggleLeftOut = (d: ShowreelDoc, themeId: string): ShowreelDoc => ({ ...d, leftOut: d.leftOut.includes(themeId) ? d.leftOut.filter((x) => x !== themeId) : [...d.leftOut, themeId] })

/** What a version plays: its clips that still exist, in order. A clip whose session is no longer accepted is dropped. */
export const clipsOfVersion = (v: Version | undefined, byId: Map<string, Clip>): Clip[] => (v ? v.clipIds.map((id) => byId.get(id)).filter((c): c is Clip => !!c) : [])
export const totalSeconds = (clips: Clip[]) => clips.reduce((n, c) => n + clipLength(c), 0)

/** The showreel's sections: each included theme that has a Default, in the Researcher's order. Default versions only. */
export function reelSections<T extends { id: string }>(d: ShowreelDoc, themes: T[], clipsFor: (themeId: string) => Map<string, Clip>): { theme: T; version: Version; clips: Clip[] }[] {
  return orderedThemes(d, themes.map((t) => t.id)).flatMap((id) => {
    const t = themes.find((x) => x.id === id)!
    const v = defaultOf(d, id)
    if (!v || d.leftOut.includes(id)) return []
    const clips = clipsOfVersion(v, clipsFor(id))
    return clips.length ? [{ theme: t, version: v, clips }] : []
  })
}
