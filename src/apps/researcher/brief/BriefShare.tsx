import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea, TextField } from '@/components/Field'
import { PrinterIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { formatDateTime } from '@/lib/format'
import { MOISTURIZER_ID } from '@/mock/moisturizerStudy'
import { people } from '@/mock/people'
import { screenById, studyPath } from '@/routes/screens'
import { approve, latestVersion, markShared, readiness, requestChanges } from '@/state/brief'
import { useFeature } from '@/state/features'
import { PageHeader } from '../../shared/PageHeader'
import { ApprovalTimeline } from './ApprovalTimeline'
import { AssumptionLedger } from './AssumptionLedger'
import { BriefDocument } from './BriefDocument'
import { NoBrief } from './NoBrief'
import { useBrief } from './useBrief'

export function BriefShare() {
  const { studyId, study, doc, editable, me, update } = useBrief()
  const navigate = useNavigate()
  const showLedger = useFeature('assumptionLedger')

  if (!study || !doc?.intakeComplete) return <NoBrief studyId={studyId} editable={editable} />

  const latest = latestVersion(doc)!
  const ready = readiness(doc)

  const download = () => {
    if (!ready.canShare) return
    window.print()
    update((d) => markShared(d, me))
  }

  const downloadButton = (
    <Button variant={doc.status === 'Draft' ? 'primary' : 'secondary'} icon={<PrinterIcon />} disabled={!ready.canShare} onClick={download}>
      Download PDF
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R5"
        title="Share brief and record decision"
        description="Download the brief, email it to the client, then record what they decided."
        meta={
          <>
            <span className="font-medium text-ink tabular-nums">Version {latest.number}</span>
            <StatusChip status={doc.status} size="sm" />
          </>
        }
        actions={
          <>
            <Button variant="ghost" to={studyPath(studyId, screenById.R4)}>
              Back to editor
            </Button>
            {ready.canShare ? (
              downloadButton
            ) : (
              <Tooltip focusable content={`You can’t share yet: ${ready.blockers.join('. ')}.`}>
                {downloadButton}
              </Tooltip>
            )}
          </>
        }
      />

      {!ready.canShare && (
        <Banner
          tone="warning"
          title="This brief can’t be shared yet"
          actions={
            <Button size="sm" to={studyPath(studyId, screenById.R4)}>
              Go to brief editor
            </Button>
          }
        >
          {ready.blockers.join('. ')}.
        </Banner>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <BriefDocument study={study} doc={doc} version={latest} />

        <aside className="flex flex-col gap-4">
          {doc.status === 'Approved' && doc.approval ? (
            <Card>
              <Banner tone="success" title={`Version ${doc.approval.version} is approved`} className="-m-1">
                {doc.approval.method === 'Client' ? `Approved by client (${doc.approval.client}). ` : 'Approved directly (solo). '}
                Recorded by {doc.approval.by}, {formatDateTime(doc.approval.at)}.
              </Banner>
              <p className="mt-4 text-sm text-graphite">The Audience step is unlocked. Editing the brief creates a new version that needs approval again.</p>
              <Button className="mt-3 w-full" variant="primary" to={studyPath(studyId, screenById.R6)}>
                Continue to Audience
              </Button>
            </Card>
          ) : doc.status === 'In Review' ? (
            <ClientDecision
              version={latest.number}
              defaultClient={studyId === MOISTURIZER_ID ? people.client.name : ''}
              onApprove={(client) => update((d) => approve(d, me, 'Client', client))}
              onChanges={(client, feedback) => {
                update((d) => requestChanges(d, me, client, feedback))
                navigate(studyPath(studyId, screenById.R4))
              }}
            />
          ) : (
            <Card title="Send it to the client">
              <p className="text-sm text-graphite">
                Download the PDF and email it to the client yourself. Downloading marks version {latest.number} as In Review, and you can then record their decision here.
              </p>
            </Card>
          )}

          {doc.status !== 'Approved' && <SoloApproval version={latest.number} disabled={!ready.canShare} onApprove={() => update((d) => approve(d, me, 'Solo'))} />}

          {showLedger && <AssumptionLedger doc={doc} compact />}
          <ApprovalTimeline doc={doc} />
        </aside>
      </div>
    </div>
  )
}

function ClientDecision({
  version,
  defaultClient,
  onApprove,
  onChanges,
}: {
  version: number
  defaultClient: string
  onApprove: (client: string) => void
  onChanges: (client: string, feedback: string) => void
}) {
  const [decision, setDecision] = useState<'approved' | 'changes'>('approved')
  const [client, setClient] = useState(defaultClient)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const clientError = submitted && !client.trim() ? 'Enter the name of the client who decided.' : undefined
  const feedbackError = submitted && decision === 'changes' && !feedback.trim() ? 'Enter the client’s feedback so you can act on it.' : undefined

  return (
    <Card title="Record client decision" description={`What did the client decide about version ${version}?`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(true)
          if (!client.trim() || (decision === 'changes' && !feedback.trim())) return
          if (decision === 'approved') onApprove(client.trim())
          else onChanges(client.trim(), feedback)
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Client decision</legend>
          {(
            [
              ['approved', 'Client approved', `Version ${version} becomes Approved and the Audience step unlocks.`],
              ['changes', 'Changes requested', `Opens version ${version + 1} in the editor with the client’s feedback.`],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={cn('flex cursor-pointer gap-2.5 rounded-sm border px-3 py-2.5', decision === value ? 'border-ink bg-paper' : 'border-mist hover:border-mist-strong')}
            >
              <input type="radio" name="decision" className="mt-1 accent-[var(--color-iris-600)]" checked={decision === value} onChange={() => setDecision(value)} />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-graphite">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <TextField label="Client name" value={client} onChange={(e) => setClient(e.target.value)} error={clientError} />
        {decision === 'changes' && (
          <TextArea label="Client feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} error={feedbackError} placeholder="Paste or summarise what the client asked to change" />
        )}
        <Button type="submit" variant="primary">
          {decision === 'approved' ? `Record approval of version ${version}` : 'Record changes and reopen'}
        </Button>
      </form>
    </Card>
  )
}

function SoloApproval({ version, disabled, onApprove }: { version: number; disabled: boolean; onApprove: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <Card title="No separate client? Approve directly">
      <p className="text-sm text-graphite">Approve version {version} yourself. It’s recorded with your name, the time and the version, marked as a solo approval.</p>
      {confirming ? (
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={onApprove}>
            Approve version {version}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button className="mt-3" size="sm" disabled={disabled} onClick={() => setConfirming(true)}>
          Approve directly
        </Button>
      )}
    </Card>
  )
}
