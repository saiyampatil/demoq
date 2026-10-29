import { Outlet } from 'react-router'
import { people } from '@/mock/people'
import { TopBar, UserBadge } from '../shared/TopBar'

export function ObserverShell() {
  const me = people.client
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar
        home="/observer/sessions/P-2042"
        context="Backroom, view only"
        right={<UserBadge name={me.name} title={me.organization} />}
      />
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
