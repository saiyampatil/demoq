// What a PulseAI moderator has changed in their own profile: their name and expertise. A team moderator's live on the
// team list instead (state/teamModerators.ts), so there is one place for each person.
import { useSyncExternalStore } from 'react'

const KEY = 'pulseai-qual:moderator-profiles'
export type ProfileEdit = { name?: string; tags?: string[] }
let store: Record<string, ProfileEdit> = (() => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Record<string, ProfileEdit>
  } catch {
    // Start from nothing edited.
  }
  return {}
})()
const listeners = new Set<() => void>()
function commit(next: Record<string, ProfileEdit>) {
  store = next
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
  listeners.forEach((l) => l())
}
export const useModeratorProfiles = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store,
  )
export const profileEdit = (id: string): ProfileEdit | undefined => store[id]
export const editProfile = (id: string, patch: ProfileEdit) => commit({ ...store, [id]: { ...store[id], ...(patch.name?.trim() ? { name: patch.name.trim() } : {}), ...(patch.tags ? { tags: patch.tags } : {}) } })
