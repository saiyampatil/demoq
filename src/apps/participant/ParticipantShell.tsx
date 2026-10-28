import { Outlet } from 'react-router'
import { PulseMark } from '@/components/icons'

// Mobile-first: a 375px column. On wider screens it stays a centred column.
export function ParticipantShell() {
  return (
    <div className="min-h-screen bg-haze">
      <div className="mx-auto flex min-h-screen w-full max-w-mobile flex-col bg-surface sm:border-x sm:border-mist">
        <header className="flex h-14 items-center gap-2 border-b border-mist px-4">
          <PulseMark size={20} />
          <span className="text-sm font-medium">Research interview</span>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
