import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { screenById, studyPath } from '@/routes/screens'

/** Shown on R4 and R5 before intake has drafted a brief, or for read-only dashboard studies. */
export function NoBrief({ studyId, editable }: { studyId: string; editable: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-mist-strong bg-surface">
      {editable ? (
        <EmptyState
          title="No brief yet"
          description="Add the client’s brief in Brief intake. The AI drafts it here as version 1."
          action={<Button to={studyPath(studyId, screenById.R1)}>Go to brief intake</Button>}
        />
      ) : (
        <EmptyState
          title="This study’s brief isn’t in the prototype"
          description="Only the Moisturizer Concept Study and studies you create have a working brief. Open one of those from the dashboard."
          action={<Button to="/researcher">Back to studies</Button>}
        />
      )}
    </div>
  )
}
