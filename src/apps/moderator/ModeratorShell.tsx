import { Outlet } from 'react-router'
import { controlBase } from '@/components/Field'
import { TopBar, UserBadge } from '../shared/TopBar'
import { MODERATORS, ModeratorProvider, useModerator } from './useModerator'

function Shell() {
  const { me, setMe } = useModerator()
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar
        home="/moderator/sessions"
        context="Moderator"
        nav={[{ to: '/moderator/sessions', label: 'My sessions', end: true }]}
        right={
          <>
            {import.meta.env.DEV && (
              <label className="flex items-center gap-2 text-xs text-graphite">
                Dev: view as
                <select value={me.id} onChange={(e) => setMe(e.target.value)} aria-label="View as" data-testid="view-as" className={`${controlBase} h-8 pr-7 text-sm text-ink`}>
                  {MODERATORS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <UserBadge name={me.name} title="Human moderator" />
          </>
        }
      />
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export function ModeratorShell() {
  return (
    <ModeratorProvider>
      <Shell />
    </ModeratorProvider>
  )
}
