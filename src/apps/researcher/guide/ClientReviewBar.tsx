import { useState } from 'react'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { formatStamp } from '@/lib/format'
import { downloadGuide } from './download'
import { clientApprovedVersion, recordChangesRequested, recordClientApproved, shareGuide, studyHasClient, type GuideDoc } from '@/state/guide'

type Props = { doc: GuideDoc; studyName: string; client: string; me: string; update: (fn: (d: GuideDoc) => GuideDoc) => void }

/**
 * Step 5 and 6 of Module 3, above the guide: share with the client, record their decision, then approve (the button
 * is in the footer). A study with no client skips straight to approval, and says so.
 */
export function ClientReviewBar({ doc, studyName, client, me, update }: Props) {
  const hasClient = studyHasClient(client)
  const [asking, setAsking] = useState(false)
  const [feedback, setFeedback] = useState('')

  const download = () => downloadGuide(doc, studyName)

  const shared = [...doc.events].reverse().find((e) => e.type === 'shared' && e.version === doc.version)
  const clientEvent = [...doc.events].reverse().find((e) => e.type === 'client-approved' && e.version === doc.version)
  const changes = [...doc.events].reverse().find((e) => e.type === 'changes-requested' && e.version === doc.version - 1)
  const approved = doc.status === 'Approved' && doc.approved

  return (
    <section aria-label="Client review" className="rounded-md border border-mist bg-surface px-5 py-4">
      <div className="flex flex-col gap-3">
        {changes && doc.status === 'Draft' && (
          <div className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm">
            <p className="font-medium text-pending-fg">Changes requested by {changes.note?.replace('Requested by ', '') ?? client} on version {changes.version}</p>
            <p className="mt-0.5">“{changes.feedback}”</p>
            <p className="mt-0.5 text-xs text-graphite">Recorded by {changes.by}, {formatStamp(changes.at)}. Edit this version to address it.</p>
          </div>
        )}

        {approved ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckIcon className="text-positive-fg" />
            <span>
              <span className="font-medium">Approved by {doc.approved!.by}, {formatStamp(doc.approved!.at)}, version {doc.approved!.version}</span>
              {doc.approved!.onBehalfOf && <span className="text-graphite">. Client approval recorded for {doc.approved!.onBehalfOf}.</span>}
            </span>
          </p>
        ) : !hasClient ? (
          <p className="text-sm">
            <span className="font-medium">No client on this study.</span> You can approve directly. There is no client review step.
          </p>
        ) : doc.status === 'Draft' ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => {
                download()
                update((d) => shareGuide(d, me))
              }}
            >
              Download and share with client
            </Button>
            <p className="min-w-0 flex-1 basis-60 text-sm text-graphite">
              Downloads version {doc.version} as a PDF to email to {client}, and sets it to In Review. A client approval is needed before you can approve it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              <span className="font-medium">In Review.</span>{' '}
              {shared && (
                <>
                  Downloaded {formatStamp(shared.at)} as version {shared.version} by {shared.by}.
                </>
              )}{' '}
              {!clientApprovedVersion(doc) && <span className="text-graphite">Record what {client} decided.</span>}
            </p>
            {clientEvent ? (
              <p className="flex items-center gap-2 text-sm text-positive-fg">
                <CheckIcon size={14} /> Client approved version {clientEvent.version}. Recorded by {clientEvent.by}, {formatStamp(clientEvent.at)}. You can approve it now.
              </p>
            ) : asking ? (
              <form
                className="flex flex-col gap-2 rounded-sm border border-mist bg-paper p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!feedback.trim()) return
                  update((d) => recordChangesRequested(d, me, client, feedback))
                  setFeedback('')
                  setAsking(false)
                }}
              >
                <TextArea label="The client’s feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} hint={`Saving creates version ${doc.version + 1} as a draft and keeps this feedback with it.`} />
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={!feedback.trim()}>
                    Save feedback and create version {doc.version + 1}
                  </Button>
                  <Button variant="ghost" onClick={() => setAsking(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setAsking(true)}>Changes requested</Button>
                <Button onClick={() => update((d) => recordClientApproved(d, me, client))}>Client approved</Button>
                <Button variant="ghost" onClick={download}>
                  Download again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
