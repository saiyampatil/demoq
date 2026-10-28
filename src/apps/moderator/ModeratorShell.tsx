import { Outlet } from 'react-router'
import { people } from '@/mock/people'
import { TopBar, UserBadge } from '../shared/TopBar'

export function ModeratorShell() {
  const me = people.moderatorJordan
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar
        home="/moderator/sessions"
        context="Moderator"
        nav={[{ to: '/moderator/sessions', label: 'My sessions', end: true }]}
        right={<UserBadge name={me.name} title="Human moderator" />}
      />
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
