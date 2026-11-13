// Team moderators: one company-level list, reused across studies. Any researcher can add someone (no admin step).
// A new person is Invited until they accept the emailed invitation (simulated: the dev button is the only way to accept).
// Studies point at a person by id and read their status live, so one acceptance counts in every study they are on.
import { useSyncExternalStore } from 'react'
import { DOMAIN_COMPANY } from '@/mock/expertise'
import { currentUser } from '@/mock/people'
import { now, uid } from './brief'

export const TEAM_STORAGE_KEY = 'pulseai-qual:team-moderators'

export type TeamPersonStatus = 'Invited' | 'Active'

export type TeamPerson = {
  id: string
  name: string
  email: string
  /** Optional. Free text, for example "Skincare" or "Concept testing". */
  tags: string[]
  status: TeamPersonStatus
  createdBy: string
  createdAt: string
  /** When the invitation was last sent. Set again by "Resend invitation". */
  invitedAt?: string
}

const SEED: TeamPerson[] = [
  { id: 'tm-dana', name: 'Dana Whitfield', email: 'dana.whitfield@verdane.com', tags: ['Skincare', 'Concept testing'], status: 'Active', createdBy: currentUser.name, createdAt: '2026-09-14T10:00:00-04:00' },
  { id: 'tm-ben', name: 'Ben Ortiz', email: 'ben.ortiz@verdane.com', tags: ['Consumer goods'], status: 'Active', createdBy: currentUser.name, createdAt: '2026-09-14T10:05:00-04:00' },
  { id: 'tm-ravi', name: 'Ravi Menon', email: 'ravi.menon@burrowpet.com', tags: ['Pet care', 'Subscriptions'], status: 'Active', createdBy: currentUser.name, createdAt: '2026-09-02T09:00:00-04:00' },
  { id: 'tm-nisha', name: 'Nisha Kapoor', email: 'nisha.kapoor@verdane.com', tags: ['Pricing'], status: 'Invited', createdBy: currentUser.name, createdAt: '2026-11-04T15:30:00-05:00', invitedAt: '2026-11-04T15:30:00-05:00' },
]

let store: TeamPerson[] = (() => {
  try {
    const raw = localStorage.getItem(TEAM_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TeamPerson[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // Storage blocked or corrupt: start from the seed.
  }
  return SEED
})()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
function commit(next: TeamPerson[]) {
  store = next
  try {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Changes just won't survive a refresh.
  }
  emit()
}

export function useTeamModerators(): TeamPerson[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => store,
  )
}

/** Read outside React, for the pure selectors that work out who counts. */
export const teamPeople = (): TeamPerson[] => store
export const getTeamPerson = (id: string | undefined): TeamPerson | undefined => (id ? store.find((p) => p.id === id) : undefined)

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const findByEmail = (email: string): TeamPerson | undefined => store.find((p) => sameEmail(p.email, email))

/** "Skincare, Pricing" to ["Skincare", "Pricing"]. Blank pieces and repeats (any case) are dropped. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const piece of text.split(/[,;\n]/)) {
    const tag = piece.trim()
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase())
      out.push(tag)
    }
  }
  return out
}

/**
 * Adds a person to the company list and sends the (simulated) invitation. An email already on the list, in any case,
 * reuses that person: nothing is created and nothing they have is overwritten.
 */
export function addTeamPerson(input: { name: string; email: string; tags: string[] }, by: string): { person: TeamPerson; existing: boolean } {
  const found = findByEmail(input.email)
  if (found) return { person: found, existing: true }
  const stamp = now()
  const person: TeamPerson = { id: uid('tm'), name: input.name.trim(), email: input.email.trim(), tags: input.tags, status: 'Invited', createdBy: by, createdAt: stamp, invitedAt: stamp }
  commit([...store, person])
  return { person, existing: false }
}

/** Dev only: stands in for the person accepting their emailed invitation. Every study they are on counts them from now. */
export function activateTeamPerson(id: string) {
  if (!store.some((p) => p.id === id && p.status === 'Invited')) return
  commit(store.map((p) => (p.id === id ? { ...p, status: 'Active' as const } : p)))
}

/** Simulated email: only the time of the last invitation changes. */
export function resendTeamInvite(id: string) {
  commit(store.map((p) => (p.id === id && p.status === 'Invited' ? { ...p, invitedAt: now() } : p)))
}

/** Dev: back to the seed. */
export function resetTeamModerators() {
  commit(SEED)
}

/** The company a team moderator works for, from their email domain. They see only that company's studies. */
export const companyOf = (p: Pick<TeamPerson, 'email'>): string => DOMAIN_COMPANY[p.email.split('@')[1]?.toLowerCase() ?? ''] ?? p.email.split('@')[1] ?? 'Unknown company'

/** A person edits their own name and expertise in their profile. The email is theirs by invitation and doesn't change. */
export function updateTeamPerson(id: string, patch: { name?: string; tags?: string[] }) {
  commit(store.map((p) => (p.id === id ? { ...p, ...(patch.name?.trim() ? { name: patch.name.trim() } : {}), ...(patch.tags ? { tags: patch.tags } : {}) } : p)))
}
