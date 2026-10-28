import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { screenById } from '@/routes/screens'
import { ScreenTag } from '../shared/ScreenTag'

// Phase 0 placeholder, laid out the way participant screens will be:
// one task per screen, primary action pinned to the bottom.
export function ParticipantScreen({ id }: { id: string }) {
  const screen = screenById[id]
  return (
    <>
      <main className="flex-1 px-4 py-6">
        <ScreenTag id={screen.id} />
        <h1 className="mt-3 text-lg font-semibold">{screen.name}</h1>
        <p className="mt-1 text-sm text-graphite">
          Module {screen.module}, built in Phase {screen.phase}
        </p>
        <div className="mt-6 rounded-md border border-dashed border-mist-strong">
          <EmptyState
            className="px-4 py-8"
            title="This screen is a placeholder"
            description="It reserves the route and the 375px layout until its phase is built."
          />
        </div>
      </main>
      <footer className="sticky bottom-0 border-t border-mist bg-surface px-4 py-3">
        <Button variant="primary" className="h-11 w-full" disabled>
          Continue
        </Button>
      </footer>
    </>
  )
}
