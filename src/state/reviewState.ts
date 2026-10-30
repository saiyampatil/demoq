// What the Researcher adds during review, kept in the browser. The mock sessions themselves (mock/review.ts) never change.

import { useSyncExternalStore } from 'react'
import type { ReviewEvent } from '@/mock/review'

export type ResearcherNote = { id: string; text: string; by: string; at: string }

export type ReviewState = {
  notes: Record<string, ResearcherNote[]>
  /**
   * What the Researcher did to each session, by session ID, in order. Append-only: nothing here is ever edited or
   * removed, and a reopen adds an entry instead of erasing the decision. The seeded history comes from mock/review.ts.
   */
  events: Record<string, ReviewEvent[]>
}

const KEY = 'pulseai-qual:review-state'
const empty = (): ReviewState => ({ notes: {}, events: {} })

let state: ReviewState = (() => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...(JSON.parse(raw) as Partial<ReviewState>) }
  } catch {
    // Storage blocked or corrupt.
  }
  return empty()
})()
const listeners = new Set<() => void>()

export function updateReview(fn: (s: ReviewState) => ReviewState) {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Changes just won't survive a refresh.
  }
  listeners.forEach((l) => l())
}

export const resetReview = () => updateReview(() => empty())

export function useReviewState(): ReviewState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

type NewEvent = ReviewEvent extends infer E ? (E extends ReviewEvent ? Omit<E, 'id' | 'at'> : never) : never

const MINUTE = 60000

/**
 * Appends one entry to a session's history. `floor` is the latest time already on the fieldwork clock, so the entry
 * is stamped after everything that came before it, here and in the activity feed.
 */
export function addReviewEvent(sessionId: string, e: NewEvent, floor: string): ReviewEvent {
  let made!: ReviewEvent
  updateReview((st) => {
    const mine = st.events[sessionId] ?? []
    const latest = Math.max(new Date(floor).getTime(), ...mine.map((x) => new Date(x.at).getTime()))
    made = { ...e, id: `rv-${Math.random().toString(36).slice(2, 9)}`, at: new Date(latest + MINUTE).toISOString() } as ReviewEvent
    return { ...st, events: { ...st.events, [sessionId]: [...mine, made] } }
  })
  return made
}
