// What the Researcher adds during review, kept in the browser. The mock sessions themselves (mock/review.ts) never change.

import { useSyncExternalStore } from 'react'

export type ResearcherNote = { id: string; text: string; by: string; at: string }

export type ReviewState = {
  notes: Record<string, ResearcherNote[]>
}

const KEY = 'pulseai-qual:review-state'
const empty = (): ReviewState => ({ notes: {} })

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
