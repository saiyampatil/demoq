import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { screenById, studyPath } from '@/routes/screens'
import { nextVersionFor, type GuideDoc, type Mode } from '@/state/guide'
import { useGuide } from './useGuide'

/** Shown on R12 to R14 when the module can't be worked on yet, or when the study isn't editable. */
export function GuideGate({ reason }: { reason: 'readonly' | 'stale' }) {
  const { studyId } = useGuide()
  return (
    <div className="rounded-md border border-dashed border-mist-strong bg-surface">
      {reason === 'readonly' ? (
        <EmptyState
          title="This study’s moderator setup isn’t in the prototype"
          description="Only the Moisturizer Concept Study and studies you create have a working Module 3."
          action={<Button to="/researcher">Back to studies</Button>}
        />
      ) : (
        <EmptyState
          title="The brief or audience has changed"
          description="Module 3 needs an approved brief and a confirmed audience that match. Check the audience against the latest approved brief, then come back."
          action={
            <Button variant="primary" to={studyPath(studyId, screenById.R6)}>
              Go to audience definition
            </Button>
          }
        />
      )}
    </div>
  )
}

/** Explains that a frozen version has moved on to a new draft, and what that means for Launch. */
export function VersionBanner({ doc }: { doc: GuideDoc }) {
  const { study } = useGuide()
  if (!doc.guide || doc.status !== 'Draft') return null
  const lastApproved = [...doc.events].reverse().find((e) => e.type === 'approved' && e.version < doc.version)
  if (!lastApproved) return null
  const paused = study?.status === 'Paused'
  return (
    <Banner tone="warning" title={`You’re editing version ${doc.version}, a draft`}>
      Version {lastApproved.version} stays in the history, but Launch is locked until version {doc.version} is approved. Sessions built from version {lastApproved.version} will be flagged as built from an older version.
      {paused && ` The study is Paused until version ${doc.version} is approved and relaunched${study?.releaseVersion ? `. ${study.releaseVersion} stays on record` : ''}.`}
    </Banner>
  )
}

/** A real "are you sure" before the guide is replaced: switching AI/human, or regenerating. */
export function ReplaceGuideModal({
  open,
  doc,
  title,
  extra,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean
  doc: GuideDoc
  title: string
  /** What else changes, e.g. surveys no longer applying. */
  extra?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const v = nextVersionFor(doc)
  const approved = doc.status === 'Approved'
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="primary" onClick={onCancel}>
            Keep current guide
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel ?? `Replace guide and create version ${v}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-base">
        <p className="font-semibold text-negative-fg">The current guide and every edit you’ve made to it will be replaced. This can’t be undone.</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            It creates <span className="font-semibold">version {v}</span> as a Draft. Version {doc.version} is kept in the history.
          </li>
          {approved && (
            <li className="font-medium text-negative-fg">
              Version {doc.version} is approved. Launch locks until version {v} is approved, and sessions built from version {doc.version} will be flagged.
            </li>
          )}
          {doc.status === 'In Review' && <li className="font-medium text-negative-fg">Version {doc.version} is with the client for review. Their feedback will no longer match the new draft.</li>}
          {doc.status === 'Draft' && doc.edits > 0 && (
            <li className="font-medium text-negative-fg">
              This draft has {doc.edits} {doc.edits === 1 ? 'edit' : 'edits'} that will be lost.
            </li>
          )}
          {extra && <li>{extra}</li>}
        </ul>
      </div>
    </Modal>
  )
}

export const modeLabel = (m: Mode) => (m === 'ai' ? 'AI moderator' : 'Human moderator')

/** Navigates and starts the draft when the setup is complete, for the "Continue" buttons. */
export function useGoTo() {
  const navigate = useNavigate()
  const { studyId } = useGuide()
  return (id: keyof typeof screenById) => navigate(studyPath(studyId, screenById[id]))
}
