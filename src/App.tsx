import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { ModeratorShell } from '@/apps/moderator/ModeratorShell'
import { ModeratorProfile } from '@/apps/moderator/Profile'
import { ModeratorSessions } from '@/apps/moderator/Sessions'
import { ObserverShell } from '@/apps/observer/ObserverShell'
import { ParticipantScreen } from '@/apps/participant/ParticipantScreen'
import { TechnicalIssue } from '@/apps/participant/TechnicalIssue'
import { ParticipantShell } from '@/apps/participant/ParticipantShell'
import { AudienceDefinition } from '@/apps/researcher/audience/AudienceDefinition'
import { ScreenerEditor } from '@/apps/researcher/audience/ScreenerEditor'
import { ScreeningDashboard } from './apps/researcher/audience/ScreeningDashboard'
import { CommandCenter } from '@/apps/researcher/fieldwork/CommandCenter'
import { SessionRecord } from '@/apps/researcher/fieldwork/SessionRecord'
import { SessionReview } from '@/apps/researcher/review/SessionReview'
import { Codebook } from '@/apps/researcher/analysis/Codebook'
import { Report } from '@/apps/researcher/analysis/Report'
import { SignalsTensions } from '@/apps/researcher/analysis/SignalsTensions'
import { ReviewQueue } from '@/apps/researcher/review/ReviewQueue'
import { LaunchReadiness } from '@/apps/researcher/launch/LaunchReadiness'
import { PreflightLaunch } from '@/apps/researcher/launch/PreflightLaunch'
import { TestRuns } from '@/apps/researcher/launch/TestRuns'
import { GuideEditor } from '@/apps/researcher/guide/GuideEditor'
import { ModeratorSetup } from '@/apps/researcher/guide/ModeratorSetup'
import { StimulusLibrary } from '@/apps/researcher/guide/StimulusLibrary'
import { PoolFinalize } from '@/apps/researcher/audience/PoolFinalize'
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
import { ToastProvider } from '@/components/Toast'
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
  R9: <ScreeningDashboard />,
  R11: <PoolFinalize />,
  R12: <ModeratorSetup />,
  R13: <StimulusLibrary />,
  R14: <GuideEditor />,
  R15: <LaunchReadiness />,
  R16: <TestRuns />,
  R17: <PreflightLaunch />,
  R18: <CommandCenter />,
  R19: <SessionRecord />,
  R21: <ReviewQueue />,
  R22: <SessionReview />,
  A1: <Codebook />,
  A2: <SignalsTensions />,
  A3: <Report />,
}

function Root() {
  return (
    <ToastProvider>
      <Outlet />
      {import.meta.env.DEV && <ClientSimulator />}
      {import.meta.env.DEV && <ScreenJump />}
    </ToastProvider>
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
            children: [{ index: true, element: <WorkspaceIndex /> }, { path: 'evidence', element: <Navigate to="../review/queue" replace /> }, ...routesFor('researcher', (id) => builtResearcher[id] ?? <ResearcherScreen id={id} />)],
          },
        ],
      },
      {
        path: '/p/:inviteId',
        element: <ParticipantShell />,
        children: [{ index: true, element: <Navigate to="welcome" replace /> }, ...routesFor('participant', (id) => (id === 'P18' ? <TechnicalIssue /> : <ParticipantScreen id={id} />))],
      },
      {
        path: '/moderator',
        element: <ModeratorShell />,
        children: [{ index: true, element: <Navigate to="sessions" replace /> }, ...routesFor('moderator', (id) => (id === 'M1' ? <ModeratorSessions /> : id === 'M4' ? <ModeratorProfile /> : <ScreenPlaceholder id={id} />))],
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
], {
  // Routes resolve under the Vite base ('/demoq/' on GitHub Pages, '/' in dev).
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

export function App() {
  return (
    <FeaturesProvider>
      <StudyProvider>
        <RouterProvider router={router} />
      </StudyProvider>
    </FeaturesProvider>
  )
}
