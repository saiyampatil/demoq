import type { AudienceDoc } from '@/state/audience'
import type { FieldworkDoc } from '@/state/fieldwork'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { screenById, studyPath } from '@/routes/screens'

export const slotText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '—'

export function FieldworkGate({ studyId, editable }: { studyId: string; editable: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-mist-strong bg-surface">
      {editable ? (
        <EmptyState
          title="Fieldwork opens after launch"
          description="There are no sessions until the study is Live. Authorize the launch to start fieldwork."
          action={
            <Button variant="primary" to={studyPath(studyId, screenById.R17)}>
              Go to launch
            </Button>
          }
        />
      ) : (
        <EmptyState title="This study’s fieldwork isn’t in the prototype" description="Only the Moisturizer Concept Study and studies you create have fieldwork." action={<Button to="/researcher">Back to studies</Button>} />
      )}
    </div>
  )
}


export type FWProps = {
  doc: FieldworkDoc
  audience: AudienceDoc | undefined
  /** Completed interviews the study needs. */
  target: number
  studyId: string
  me: string
  update: (fn: (d: FieldworkDoc) => FieldworkDoc) => void
  goTab: (tab: string) => void
  /** Example data for a study that hasn't launched: nothing can be changed. */
  readOnly?: boolean
  /** Sessions excluded in Review: still listed, but out of quotas and pace. */
  excluded: ReadonlySet<string>
}

export const sessionPath = (id: string) => `fieldwork/sessions/${id}`
