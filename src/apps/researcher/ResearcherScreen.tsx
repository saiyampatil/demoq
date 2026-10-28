import { useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { SideDrawer } from '@/components/SideDrawer'
import { screens } from '@/routes/screens'
import { ScreenPlaceholder } from '../shared/ScreenPlaceholder'

// Phase 0: every researcher screen renders its placeholder.
// Drawer screens (R10) open over their parent with ?applicant=.
export function ResearcherScreen({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const drawer = screens.find((s) => s.drawerOf === id)
  const applicant = params.get('applicant')

  return (
    <>
      <ScreenPlaceholder id={id}>
        {drawer && (
          <Button onClick={() => setParams({ applicant: 'A-1007' })}>Open {drawer.id} {drawer.name.toLowerCase()}</Button>
        )}
      </ScreenPlaceholder>
      {drawer && (
        <SideDrawer
          open={Boolean(applicant)}
          onClose={() => setParams({})}
          title={drawer.name}
          description={`Applicant ${applicant}`}
        >
          <ScreenPlaceholder id={drawer.id} compact />
        </SideDrawer>
      )}
    </>
  )
}
