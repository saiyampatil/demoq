import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { screenById, studyPath } from '@/routes/screens'

/** Shown on R7 and R8 before the audience has been drafted, or for read-only dashboard studies. */
export function AudienceGate({ studyId, editable }: { studyId: string; editable: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-mist-strong bg-surface">
      {editable ? (
        <EmptyState
          title="Draft the audience first"
          description="The screener and sourcing are built from the audience definition. Open it to let the AI draft it from the approved brief."
          action={<Button to={studyPath(studyId, screenById.R6)}>Go to audience definition</Button>}
        />
      ) : (
        <EmptyState
          title="This study’s audience isn’t in the prototype"
          description="Only the Moisturizer Concept Study and studies you create have a working audience."
          action={<Button to="/researcher">Back to studies</Button>}
        />
      )}
    </div>
  )
}
