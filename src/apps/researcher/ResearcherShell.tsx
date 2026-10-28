import { Outlet } from 'react-router'
import { currentUser } from '@/mock/people'
import { TopBar, UserBadge } from '../shared/TopBar'

export function ResearcherShell() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar
        home="/researcher"
        nav={[{ to: '/researcher', label: 'Studies' }]}
        right={<UserBadge name={currentUser.name} title={currentUser.title} />}
      />
      <Outlet />
    </div>
  )
}
