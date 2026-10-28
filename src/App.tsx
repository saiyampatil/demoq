import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { ModeratorShell } from '@/apps/moderator/ModeratorShell'
import { ObserverShell } from '@/apps/observer/ObserverShell'
import { ParticipantScreen } from '@/apps/participant/ParticipantScreen'
import { ParticipantShell } from '@/apps/participant/ParticipantShell'
import { AudienceDefinition } from '@/apps/researcher/audience/AudienceDefinition'
import { ScreenerEditor } from '@/apps/researcher/audience/ScreenerEditor'
import { Sourcing } from '@/apps/researcher/audience/Sourcing'
import { BriefEditor } from '@/apps/researcher/brief/BriefEditor'
import { BriefIntake } from '@/apps/researcher/brief/BriefIntake'
import { BriefShare } from '@/apps/researcher/brief/BriefShare'
import { ResearcherScreen } from '@/apps/researcher/ResearcherScreen'
import { ResearcherShell } from '@/apps/researcher/ResearcherShell'
import { StudiesDashboard } from '@/apps/researcher/StudiesDashboard'
import { StudyWorkspace, WorkspaceIndex } from '@/apps/researcher/StudyWorkspace'
import { ScreenPlaceholder } from '@/apps/shared/ScreenPlaceholder'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { DesignPage } from '@/design/DesignPage'
import { ClientSimulator } from '@/dev/ClientSimulator'
import { ScreenJump } from '@/dev/ScreenJump'
import { sample, screens, type AppKey } from '@/routes/screens'
import { FeaturesProvider } from '@/state/features'
import { StudyProvider } from '@/state/StudyContext'

const routesFor = (app: AppKey, render: (id: string) => ReactNode) =>
  screens
    .filter((s) => s.app === app && s.id !== 'R0' && !s.drawerOf)
    .map((s) => ({ path: s.path, element: render(s.id) }))

// Screens built so far. Everything else renders its placeholder.
const builtResearcher: Record<string, ReactNode> = {
  R1: <BriefIntake />,
  R4: <BriefEditor />,
  R5: <BriefShare />,
  R6: <AudienceDefinition />,
  R7: <ScreenerEditor />,
  R8: <Sourcing />,
}

function Root() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && <ClientSimulator />}
      {import.meta.env.DEV && <ScreenJump />}
    </>
  )
}

function NotFound() {
  return (
    <main className="mx-auto max-w-content px-4 py-16">
      <EmptyState
        title="This page doesn’t exist"
        description="The link may be out of date. Go back to your studies, or use Screen jump to find a screen by ID."
        action={<Button to="/researcher">Go to studies</Button>}
      />
    </main>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Navigate to="/researcher" replace /> },
      {
        path: '/researcher',
        element: <ResearcherShell />,
        children: [
          { index: true, element: <StudiesDashboard /> },
          {
            path: 'studies/:studyId',
            element: <StudyWorkspace />,
            children: [{ index: true, element: <WorkspaceIndex /> }, ...routesFor('researcher', (id) => builtResearcher[id] ?? <ResearcherScreen id={id} />)],
          },
        ],
      },
      {
        path: '/p/:inviteId',
        element: <ParticipantShell />,
        children: [{ index: true, element: <Navigate to="welcome" replace /> }, ...routesFor('participant', (id) => <ParticipantScreen id={id} />)],
      },
      {
        path: '/moderator',
        element: <ModeratorShell />,
        children: [{ index: true, element: <Navigate to="sessions" replace /> }, ...routesFor('moderator', (id) => <ScreenPlaceholder id={id} />)],
      },
      {
        path: '/observer',
        element: <ObserverShell />,
        children: [
          { index: true, element: <Navigate to={`sessions/${sample.sessionId}`} replace /> },
          ...routesFor('observer', (id) => <ScreenPlaceholder id={id} />),
        ],
      },
      { path: '/design', element: <DesignPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export function App() {
  return (
    <FeaturesProvider>
      <StudyProvider>
        <RouterProvider router={router} />
      </StudyProvider>
    </FeaturesProvider>
  )
}
