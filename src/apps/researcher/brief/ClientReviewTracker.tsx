import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { StatusChip } from '@/components/StatusChip'
import { formatDateTime } from '@/lib/format'
import type { ReviewRequest } from '@/state/brief'

type ClientReviewTrackerProps = {
  request: ReviewRequest
  onResend: (email: string) => void
  onCancel: () => void
}

// What the researcher sees while an emailed request is out: who has the link, what they did, what they said.
export function ClientReviewTracker({ request, onResend, onCancel }: ClientReviewTrackerProps) {
  const [confirming, setConfirming] = useState(false)
  const [resent, setResent] = useState<string>()

  return (
    <Card
      title="Client review"
      description={`Version ${request.version} emailed ${formatDateTime(request.sentAt)} by ${request.sentBy}. Waiting for a decision.`}
      flush
    >
      <ul>
        {request.recipients.map((r) => (
          <li key={r.email} className="border-b border-mist px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-medium break-all">{r.email}</p>
              <StatusChip status={r.state} size="sm" />
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-xs text-graphite tabular-nums">
                {resent === r.email ? 'Link sent again just now' : r.respondedAt ? `${r.state} ${formatDateTime(r.respondedAt)}` : `Sent ${formatDateTime(r.lastSentAt)}`}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onResend(r.email)
                  setResent(r.email)
                }}
              >
                Resend
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-b border-mist px-5 py-3">
        <h3 className="text-sm font-semibold">Comments ({request.comments.length})</h3>
        {request.comments.length === 0 ? (
          <p className="mt-1 text-sm text-graphite">No comments yet. Comments don’t change the status.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {request.comments.map((c) => (
              <li key={c.id}>
                <p className="text-sm">“{c.text}”</p>
                <p className="text-xs text-graphite">
                  {c.by}, <span className="tabular-nums">{formatDateTime(c.at)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        {confirming ? (
          <>
            <span className="text-sm">Cancel this request? The brief goes back to Draft.</span>
            <Button size="sm" variant="danger" onClick={onCancel}>
              Cancel request
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep waiting
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Cancel request
          </Button>
        )}
      </div>
    </Card>
  )
}
