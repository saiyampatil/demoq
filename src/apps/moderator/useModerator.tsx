import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ROSTER_EXPERTISE } from '@/mock/expertise'
import { HUMAN_MODERATORS, availabilityFor } from '@/mock/moderation'
import { profileEdit, useModeratorProfiles } from '@/state/moderatorProfiles'
import { companyOf, useTeamModerators } from '@/state/teamModerators'

/**
 * The moderator whose view this is. A PulseAI moderator works across clients. A team moderator belongs to one company
 * and sees only its studies. An invited one hasn't accepted yet and sees only the invitation.
 */
export type Moderator = { id: string; name: string; title: string; kind: 'pulseai' | 'team' | 'invited'; company?: string; email: string; timeZone: string; tags: string[] }

const emailOf = (name: string) => `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@pulseai.example`

/** Everyone who can use the Moderator app: the PulseAI roster, then the company's team list. Edits to a profile show at once. */
export function useModerators(): Moderator[] {
  const team = useTeamModerators()
  const profiles = useModeratorProfiles()
  return useMemo(
    () => [
      ...HUMAN_MODERATORS.map((m): Moderator => ({ id: m.id, name: profileEdit(m.id)?.name ?? m.name, title: m.title, kind: 'pulseai', email: emailOf(m.name), timeZone: availabilityFor(m.id).availability.timeZone, tags: profileEdit(m.id)?.tags ?? ROSTER_EXPERTISE[m.id] ?? [] })),
      ...team.map((p): Moderator => ({ id: p.id, name: p.name, title: 'Team moderator', kind: p.status === 'Active' ? 'team' : 'invited', company: companyOf(p), email: p.email, timeZone: availabilityFor(p.id).availability.timeZone, tags: p.tags })),
    ],
    [team, profiles],
  )
}

const KEY = 'pulseai-qual:moderator-view-as'
type Value = { me: Moderator; setMe: (id: string) => void; moderators: Moderator[] }
const Ctx = createContext<Value | null>(null)

export function ModeratorProvider({ children }: { children: ReactNode }) {
  const moderators = useModerators()
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? 'u-jordan'
    } catch {
      return 'u-jordan'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, id)
    } catch {
      // The choice resets on refresh.
    }
  }, [id])
  const value = useMemo(() => ({ me: moderators.find((m) => m.id === id) ?? moderators[0], setMe: setId, moderators }), [id, moderators])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useModerator(): Value {
  const v = useContext(Ctx)
  if (!v) throw new Error('useModerator outside the moderator app')
  return v
}
