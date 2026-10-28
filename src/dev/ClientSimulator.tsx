import { useEffect, useState } from 'react'
import { matchPath, useLocation } from 'react-router'
import { Button } from '@/components/Button'
import { StatusChip } from '@/components/StatusChip'
import { clientRespond, openRequest, type ClientAction } from '@/state/brief'
import { useStudies } from '@/state/StudyContext'

// Dev-only stand-in for the client's review page, which is built separately.
// It sits along the bottom edge so the tracker, stepper and dashboard stay visible while you act as the client,
// and it calls the same function the real page will call.
export function ClientSimulator() {
  const { pathname } = useLocation()
  const { getBrief, updateBrief } = useStudies()
  const [note, setNote] = useState('')
  const [result, setResult] = useState<string>()

  const studyId = matchPath('/researcher/studies/:studyId/*', pathname)?.params.studyId
  const doc = getBrief(studyId)
  const request = doc ? openRequest(doc) : undefined

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => setResult(undefined), 10000)
    return () => clearTimeout(t)
  }, [result])

  if (!studyId || (!request && !result)) return null

  const act = (email: string, action: ClientAction, message: string) => {
    updateBrief(studyId, (d) => clientRespond(d, email, action))
    setResult(message)
  }

  return (
    <>
      <div aria-hidden="true" className="h-36" />
      <section
        aria-label="Simulate client response"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-iris-300 bg-iris-50 px-4 py-3 pr-32 shadow-overlay"
      >
        {result && (
          <p role="status" className="mb-2 flex items-center gap-3 text-sm font-medium">
            {result}
            <button type="button" onClick={() => setResult(undefined)} className="rounded-xs text-xs font-normal text-graphite underline">
              Dismiss
            </button>
          </p>
        )}
        {request && (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div className="w-52 shrink-0">
              <h2 className="text-sm font-semibold">
                Simulate client response <span className="ml-1 rounded-xs bg-surface px-1.5 text-xs font-normal whitespace-nowrap text-graphite">Dev only</span>
              </h2>
              <p className="text-xs text-graphite">Version {request.version} is out for approval. Act as the client; watch the page above.</p>
            </div>
            <label className="flex w-56 shrink-0 flex-col gap-1">
              <span className="text-xs text-graphite">Reason or comment (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Used for Comment and Decline"
                className="h-8 rounded-sm border border-mist-strong bg-surface px-2 text-sm placeholder:text-muted focus:border-iris-600"
              />
            </label>
            <ul className="flex min-w-0 flex-1 flex-col gap-2">
              {request.recipients.map((r) => (
                <li key={r.email} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="w-48 truncate text-sm" title={r.email}>
                    {r.email}
                  </span>
                  <StatusChip status={r.state} size="sm" />
                  <Button size="sm" onClick={() => act(r.email, { type: 'view' }, `${r.email} opened the review link.`)}>
                    Viewed
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => act(r.email, { type: 'comment', text: note || 'Can we add the launch date to the brief?' }, `${r.email} commented. The status hasn’t changed.`)}
                  >
                    Comment
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => act(r.email, { type: 'approve' }, `${r.email} approved version ${request.version}. The brief is Approved and Audience is unlocked.`)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      act(
                        r.email,
                        { type: 'decline', reason: note || 'The audience wording needs another pass.' },
                        `${r.email} declined version ${request.version}. The brief is back in Draft as version ${request.version + 1}.`,
                      )
                    }
                  >
                    Decline
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  )
}
