import type { AudienceDoc } from '@/state/audience'
import type { FieldworkDoc, Outcomes, ReserveCandidate } from '@/state/fieldwork'
import { Button } from '@/components/Button'
import { formatSlot } from '@/lib/format'
import { EmptyState } from '@/components/States'
import { screenById, studyPath } from '@/routes/screens'

export const slotText = (iso: string | null) => (iso ? formatSlot(iso) : '—')

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
  /** Review status by session: what separates confirmed progress (Accepted) from pending (Under review). */
  outcomes: Outcomes
  /** Reserve people who can be invited now, first in first out. */
  reserve: ReserveCandidate[]
  /** The study is paused: nothing that sends an invitation or a link can run. */
  paused: boolean
  /** Sessions awaiting review, for the link to the queue. */
  awaiting: number
  /** Finished interviews, decided or not: with `awaiting`, whether review is complete. */
  reviewTotal: number
  /** Clarifications waiting on a reply, by who they are waiting for. */
  waiting: { participant: number; moderator: number }
  /** Fieldwork is closed: the study is Complete and nothing more can be sent. */
  closed: boolean
}

/** The participants a change to the doc added, for "P-2070 invited" confirmations. */
export const invitedIds = (before: FieldworkDoc, after: FieldworkDoc) => after.sessions.filter((s) => !before.sessions.some((x) => x.id === s.id)).map((s) => s.participantId)
export const invitedMessage = (ids: string[]) => (ids.length === 1 ? `${ids[0]} invited` : `${ids.length} people invited`)

export const sessionPath = (id: string) => `fieldwork/sessions/${id}`
