// The review queue's filters, kept so R22 can scope Previous and Next to them and the back link can return to them.

import { scoreBand, type ReviewSession } from '@/mock/review'

export type QueueFilters = { status: string; track: string; flag: string; integrity: string; quality: string; moderator: string; segment: string }
export type QueueState = { filters: QueueFilters; search: string; asc: boolean; pageSize: number }

export const NO_FILTERS: QueueFilters = { status: '', track: '', flag: '', integrity: '', quality: '', moderator: '', segment: '' }
export const DEFAULT_QUEUE: QueueState = { filters: NO_FILTERS, search: '', asc: false, pageSize: 10 }

const KEY = 'pulseai-qual:review-queue'

export function loadQueue(): QueueState {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_QUEUE, ...(JSON.parse(raw) as Partial<QueueState>), filters: { ...NO_FILTERS, ...(JSON.parse(raw) as QueueState).filters } }
  } catch {
    // Storage blocked: start with no filters.
  }
  return DEFAULT_QUEUE
}

export function saveQueue(q: QueueState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(q))
  } catch {
    // The filters just won't carry over.
  }
}

/** The sessions the queue shows, in order. R21 and R22 both use this, so Previous and Next follow the same list. */
export function queueOrder(all: ReviewSession[], q: QueueState, cohortName: (id: string) => string): ReviewSession[] {
  const f = q.filters
  const band = (v: number, want: string) => !want || scoreBand(v) === want
  const text = q.search.trim().toLowerCase()
  return all
    .filter(
      (s) =>
        (!f.status || s.status === f.status) &&
        (!f.flag && !f.track ? true : s.flags.some((x) => (!f.flag || x.type === f.flag) && (!f.track || x.track === f.track))) &&
        band(s.integrity, f.integrity) &&
        band(s.quality, f.quality) &&
        (!f.moderator || s.moderatorType === f.moderator) &&
        (!f.segment || s.cohortId === f.segment) &&
        (!text || [s.id, cohortName(s.cohortId), s.moderator].some((x) => x.toLowerCase().includes(text))),
    )
    .sort((a, b) => (q.asc ? 1 : -1) * (new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()))
}

export const DEFAULT_COHORT_NAMES: Record<string, string> = { 'c-younger': 'Younger, 25–34', 'c-older': 'Older, 35–44' }
