import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HUMAN_MODERATORS } from '@/mock/moderation'

/** The moderator whose view this is. Jordan Lee by default; in dev, "View as" switches to another moderator to see what they see. */
export type Moderator = { id: string; name: string; title: string }
export const MODERATORS: Moderator[] = HUMAN_MODERATORS.map((m) => ({ id: m.id, name: m.name, title: m.title }))

const KEY = 'pulseai-qual:moderator-view-as'
type Value = { me: Moderator; setMe: (id: string) => void }
const Ctx = createContext<Value | null>(null)

export function ModeratorProvider({ children }: { children: ReactNode }) {
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
  const value = useMemo(() => ({ me: MODERATORS.find((m) => m.id === id) ?? MODERATORS[0], setMe: setId }), [id])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useModerator(): Value {
  const v = useContext(Ctx)
  if (!v) throw new Error('useModerator outside the moderator app')
  return v
}
