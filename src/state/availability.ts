// Each moderator's own hours, edited in one-hour blocks in their own time zone, a week at a time. The weekly window in
// mock/moderation.ts is only where a week starts from: until a moderator edits, their hours are that window. After an
// edit the blocks are explicit. Standby booking (state/standby.ts) reads the same blocks, so what a moderator sets here is
// what a participant can book and what Schedule at this time checks.
import { useSyncExternalStore } from 'react'
import { availabilityFor } from '@/mock/moderation'
import { addDays, localDate, weekOf, zonedInstant } from './zone'

const KEY = 'pulseai-qual:moderator-availability'
const HOUR = 3600000

export type AvailabilityDoc = {
  /** Blocks in a week the moderator has edited, as hour starts (UTC ISO). Key: the Monday, "YYYY-MM-DD", in their zone. */
  weeks: Record<string, string[]>
  /** What a week looks like when it hasn't been edited: day (0 is Sunday) and hour. Set by "Repeat every week". */
  pattern?: [number, number][]
}
type Store = Record<string, AvailabilityDoc>

let store: Store = (() => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // Storage blocked or corrupt: start from the roster windows.
  }
  return {}
})()
let version = 0
const listeners = new Set<() => void>()
function commit(next: Store) {
  store = next
  version++
  cache.clear()
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
  listeners.forEach((l) => l())
}
/** Re-renders when anyone's hours change. */
export const useAvailabilityVersion = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )

export const zoneOf = (moderatorId: string) => availabilityFor(moderatorId).availability.timeZone

/** The hour blocks of a week, from the roster window: the starting point for anyone who hasn't edited. */
function windowBlocks(moderatorId: string, key: string): string[] {
  const { availability: a } = availabilityFor(moderatorId)
  const [y, m, d] = key.split('-').map(Number)
  const [fh] = a.from.split(':').map(Number)
  const [th] = a.to.split(':').map(Number)
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const day = addDays(y, m, d, i)
    const dow = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()
    if (!a.days.includes(dow)) continue
    for (let h = fh; h < th; h++) out.push(new Date(zonedInstant(day.y, day.m, day.d, h, 0, a.timeZone)).toISOString())
  }
  return out
}
function patternBlocks(moderatorId: string, key: string, pattern: [number, number][]): string[] {
  const tz = zoneOf(moderatorId)
  const [y, m, d] = key.split('-').map(Number)
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const day = addDays(y, m, d, i)
    const dow = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()
    pattern.filter(([pd]) => pd === dow).forEach(([, h]) => out.push(new Date(zonedInstant(day.y, day.m, day.d, h, 0, tz)).toISOString()))
  }
  return out
}

const cache = new Map<string, Set<string>>()
/** The available hour starts (UTC ISO) in a week. */
export function blocksOfWeek(moderatorId: string, key: string): Set<string> {
  const ck = `${moderatorId}|${key}`
  const hit = cache.get(ck)
  if (hit) return hit
  const doc = store[moderatorId]
  const list = doc?.weeks[key] ?? (doc?.pattern ? patternBlocks(moderatorId, key, doc.pattern) : windowBlocks(moderatorId, key))
  const set = new Set(list)
  cache.set(ck, set)
  return set
}

/** Whether the hour starting at this instant is one of the moderator's available hours. */
export function isAvailableHour(moderatorId: string, hourStartMs: number): boolean {
  const key = weekOf(zoneOf(moderatorId), hourStartMs).key
  return blocksOfWeek(moderatorId, key).has(new Date(hourStartMs).toISOString())
}

/** Whether the whole span (start to start + length) is covered by available hours. Every zone here has whole-hour offsets, so hours start on the UTC hour. */
export function isAvailableSpan(moderatorId: string, startMs: number, lengthMs: number): boolean {
  for (let t = Math.floor(startMs / HOUR) * HOUR; t < startMs + lengthMs; t += HOUR) if (!isAvailableHour(moderatorId, t)) return false
  return true
}

/** Runs of consecutive available hours on a calendar day in the moderator's zone, as [startMs, endMs]. */
export function runsOnDay(moderatorId: string, y: number, m: number, d: number): [number, number][] {
  const tz = zoneOf(moderatorId)
  const runs: [number, number][] = []
  let open: number | null = null
  for (let h = 0; h < 24; h++) {
    const t = zonedInstant(y, m, d, h, 0, tz)
    const on = isAvailableHour(moderatorId, t)
    if (on && open === null) open = t
    if (!on && open !== null) {
      runs.push([open, t])
      open = null
    }
  }
  if (open !== null) runs.push([open, zonedInstant(...(Object.values(addDays(y, m, d, 1)) as [number, number, number]), 0, 0, tz)])
  return runs
}

/** The hours in a week, per day (Monday first), and the total. */
export function weekHours(moderatorId: string, key: string): { perDay: number[]; total: number } {
  const tz = zoneOf(moderatorId)
  const [y, m, d] = key.split('-').map(Number)
  const set = blocksOfWeek(moderatorId, key)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(y, m, d, i)
    let n = 0
    for (let h = 0; h < 24; h++) if (set.has(new Date(zonedInstant(day.y, day.m, day.d, h, 0, tz)).toISOString())) n++
    return n
  })
  return { perDay, total: perDay.reduce((a, b) => a + b, 0) }
}

// ─── editing ────────────────────────────────────────────────────────────────

const ensure = (moderatorId: string, key: string): string[] => [...blocksOfWeek(moderatorId, key)]
const put = (moderatorId: string, key: string, list: string[]) => {
  const doc = store[moderatorId] ?? { weeks: {} }
  commit({ ...store, [moderatorId]: { ...doc, weeks: { ...doc.weeks, [key]: [...new Set(list)].sort() } } })
}

/** Add or remove hour blocks. Hours that have started can't change. Returns the hours that were changed. */
export function setBlocks(moderatorId: string, hours: string[], on: boolean, nowMs: number): string[] {
  const tz = zoneOf(moderatorId)
  const byWeek = new Map<string, string[]>()
  const changed: string[] = []
  for (const h of hours) {
    const ms = new Date(h).getTime()
    if (ms <= nowMs) continue
    const key = weekOf(tz, ms).key
    byWeek.set(key, [...(byWeek.get(key) ?? []), h])
    changed.push(h)
  }
  byWeek.forEach((list, key) => {
    const current = ensure(moderatorId, key)
    put(moderatorId, key, on ? [...current, ...list] : current.filter((x) => !list.includes(x)))
  })
  return changed
}

const nextKey = (key: string, weeks: number) => {
  const [y, m, d] = key.split('-').map(Number)
  const t = addDays(y, m, d, 7 * weeks)
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
}
/** Take every block off a week, except hours that have started (the caller takes booked ones out of `keep`). */
export function clearWeek(moderatorId: string, key: string, nowMs: number, keep: string[] = []) {
  put(moderatorId, key, ensure(moderatorId, key).filter((h) => new Date(h).getTime() <= nowMs || keep.includes(h)))
}
/** This week becomes last week's hours (kept: hours that have started, and booked or held ones). */
export function copyLastWeek(moderatorId: string, key: string, nowMs: number, keep: string[] = []) {
  const tz = zoneOf(moderatorId)
  const last = [...blocksOfWeek(moderatorId, nextKey(key, -1))]
  const [y, m, d] = key.split('-').map(Number)
  const [ly, lm, ld] = nextKey(key, -1).split('-').map(Number)
  const shifted = last.map((iso) => {
    const l = localDate(tz, new Date(iso).getTime())
    const hh = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit' }).format(new Date(iso)))
    const days = Math.round((Date.UTC(l.y, l.m - 1, l.d) - Date.UTC(ly, lm - 1, ld)) / 86400000)
    const day = addDays(y, m, d, days)
    return new Date(zonedInstant(day.y, day.m, day.d, hh, 0, tz)).toISOString()
  })
  const kept = ensure(moderatorId, key).filter((h) => new Date(h).getTime() <= nowMs || keep.includes(h))
  put(moderatorId, key, [...kept, ...shifted.filter((h) => new Date(h).getTime() > nowMs)])
}
/** Every week after this one follows this week's pattern, until a week is edited. */
export function repeatEveryWeek(moderatorId: string, key: string) {
  const tz = zoneOf(moderatorId)
  const pattern: [number, number][] = [...blocksOfWeek(moderatorId, key)].map((iso) => {
    const l = localDate(tz, new Date(iso).getTime())
    return [new Date(Date.UTC(l.y, l.m - 1, l.d)).getUTCDay(), Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit' }).format(new Date(iso)))]
  })
  const doc = store[moderatorId] ?? { weeks: {} }
  // Weeks after this one are dropped, so they follow the pattern; this week and earlier keep their blocks.
  const weeks = Object.fromEntries(Object.entries(doc.weeks).filter(([k]) => k <= key))
  weeks[key] = [...blocksOfWeek(moderatorId, key)].sort()
  commit({ ...store, [moderatorId]: { weeks, pattern } })
}
/** Dev and tests: put everyone back to their roster windows. */
export function resetAvailability() {
  commit({})
}
