import { useState } from 'react'
import { Button } from '@/components/Button'
import { controlBase } from '@/components/Field'
import { sample } from '@/routes/screens'
import { addWait, assignedJoins, isOfferedTo, liveOfferAnswered, liveOfferExpired, moderatorName, participantAsksLive, endSession, fieldworkNow, handledBySystem, moderatorAnswers, needsResearcher, openLink, participantBooks, participantEnds, participantRequests, recoverSystem, resolveSession, simulateTurn, standbySlots, type EndReason, type FieldworkDoc } from '@/state/fieldwork'
import { SELF_SERVICE } from '@/state/selfService'

/**
 * Dev-only. Stands in for the participant app until it is built: with a session page open, the controls here act on that
 * session. It lives in the Screen jump panel so nothing dev-only shows on the page itself.
 */
export function SessionSimulator({ doc, sessionId, paused, update }: { doc: FieldworkDoc; sessionId: string; paused: boolean; update: (fn: (d: FieldworkDoc) => FieldworkDoc) => void }) {
  const [simulated, setSimulated] = useState<string>()
  const [problem, setProblem] = useState<string>(SELF_SERVICE[0].type)
  const [reason, setReason] = useState<EndReason>('Can’t wait')
  const s = resolveSession(doc, sessionId)?.session
  if (!s) return null
  const booking = standbySlots(doc, fieldworkNow(doc))
  /** The first moderator still holding the offer, for the dev buttons. */
  const firstOffered = (x: NonNullable<typeof s>) => x.escalation?.live?.offeredTo.find((id) => isOfferedTo(x, id)) ?? ''

  const act = (fn: (d: FieldworkDoc) => FieldworkDoc, message: string) => {
    update(fn)
    setSimulated(message)
  }
  const any =
    s.status === 'Not started' || s.status === 'Booked' || s.status === 'Incomplete (resumable)' || s.status === 'Active' || s.escalation || s.issues.some((x) => x.status === 'Open' && handledBySystem(x.type))

  return (
    <section className="border-b border-mist px-4 py-3" aria-label="This session">
      <h3 className="text-sm font-semibold">This session: {s.participantId}, session {s.no}</h3>
      <p className="text-xs text-graphite">Stands in for the participant app until it is built. Use it to see what a pause does.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(s.status === 'Not started' || s.status === 'Booked' || s.status === 'Incomplete (resumable)') && (
          <Button
            size="sm"
            onClick={() => {
              const out = openLink(doc, s.id, paused)
              update((d) => openLink(d, s.id, paused).doc)
              setSimulated(out.result === 'unavailable' ? 'This study is temporarily unavailable' : out.result === 'opened' ? 'Link opened' : out.result === 'started' ? 'Interview started' : undefined)
            }}
          >
            {s.status === 'Incomplete (resumable)' || s.carried ? 'Simulate: participant resumes' : 'Simulate: participant opens their link'}
          </Button>
        )}
        {s.issues.some((x) => x.status === 'Open' && handledBySystem(x.type)) && (
          <Button size="sm" data-testid="simulate-recover" onClick={() => act((d) => recoverSystem(d, s.id), 'PulseAI recovered. What it was handling is resolved.')}>
            Simulate: PulseAI recovers
          </Button>
        )}
        {s.status === 'Active' && (
          <span className="flex flex-wrap items-center gap-2">
            <select value={problem} onChange={(e) => setProblem(e.target.value)} aria-label="Problem to simulate" className={`${controlBase} h-8 pr-7 text-sm`}>
              {SELF_SERVICE.map((x) => (
                <option key={x.type}>{x.type}</option>
              ))}
            </select>
            <Button size="sm" to={`/p/${sample.inviteId}/technical-issue?session=${s.id}&issue=${encodeURIComponent(problem)}`}>
              Simulate: the participant hits a problem
            </Button>
          </span>
        )}
        {s.status === 'Active' && !s.escalation && (
          <>
            <span className="basis-full text-xs text-graphite">The participant taps Talk to a person, then chooses:</span>
            <Button
              size="sm"
              data-testid="sim-books"
              disabled={booking.length === 0}
              onClick={() => act((d) => participantBooks(d, s.id), 'The participant booked the first free standby time. The session is Booked for it, and no answer is needed.')}
            >
              Books a free time
            </Button>
            <Button size="sm" data-testid="sim-requests" disabled={!doc.plan.escalation?.offered} onClick={() => act((d) => participantRequests(d, s.id), 'The participant asked for a time that suits them. It waits for the standby moderator’s answer.')}>
              Asks for a time
            </Button>
            <Button size="sm" data-testid="sim-asks-live" disabled={!doc.plan.escalation?.offered} onClick={() => act((d) => participantAsksLive(d, s.id), 'The participant asked for a person. It is offered to the standby moderators one at a time, with 60 seconds each.')}>
              Asks live (offered to moderators first)
            </Button>
            <span className="flex items-center gap-2">
              <select value={reason} onChange={(e) => setReason(e.target.value as EndReason)} aria-label="Why they end" className={`${controlBase} h-8 pr-7 text-sm`}>
                {(['Can’t wait', 'Uncomfortable', 'Something else'] as const).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <Button size="sm" data-testid="sim-ends" onClick={() => act((d) => participantEnds(d, s.id, reason), 'The participant chose to end the interview. The session is Withdrawn.')}>
                Ends the interview
              </Button>
            </span>
            {booking.length === 0 && <span className="basis-full text-xs text-graphite">{doc.plan.escalation?.offered ? 'No standby time is free this week.' : 'No standby moderator is set up, so a participant isn’t offered a human.'}</span>}
          </>
        )}
        {s.escalation?.status === 'Offering live' && s.escalation.live && (
          <>
            <span className="basis-full text-xs text-graphite">Offered at once to {s.escalation.live.offeredTo.map(moderatorName).join(' and ')}, with one {60}-second timer. The first to accept takes it. If nobody does, the AI asks the participant for a time and a request is raised.</span>
            <Button size="sm" data-testid="sim-live-accepts" onClick={() => act((d) => liveOfferAnswered(d, s.id, firstOffered(s), 'Accepted'), `${moderatorName(firstOffered(s))} accepted first and joined. The offer is gone for the others.`)}>
              First offered moderator accepts
            </Button>
            <Button size="sm" data-testid="sim-live-declines" onClick={() => act((d) => liveOfferAnswered(d, s.id, firstOffered(s), 'Declined'), `${moderatorName(firstOffered(s))} declined. The others can still accept.`)}>
              First offered moderator declines
            </Button>
            <Button size="sm" data-testid="sim-live-timeout" onClick={() => act((d) => liveOfferExpired(d, s.id), 'The 60 seconds ran out and nobody accepted. The AI asked for a time and a request was raised.')}>
              Timer runs out
            </Button>
          </>
        )}
        {s.escalation?.status === 'Time requested' && (
          <>
            <Button size="sm" data-testid="sim-mod-accepts" onClick={() => act((d) => moderatorAnswers(d, s.id, 'Accepted'), 'The moderator accepted and confirmed a time.')}>
              Moderator accepts
            </Button>
            <Button size="sm" data-testid="sim-mod-declines" onClick={() => act((d) => moderatorAnswers(d, s.id, 'Declined'), 'The moderator couldn’t do those times. It is waiting for the Researcher.')}>
              Moderator declines
            </Button>
          </>
        )}
        {s.escalation && needsResearcher(s.escalation) && (
          <Button size="sm" data-testid="sim-23h" onClick={() => act((d) => addWait(d, s.id, 23), 'Added 23 hours to the wait.')}>
            Simulate: 23 h waiting
          </Button>
        )}
        {s.escalation?.status === 'Assigned' && (
          <Button size="sm" data-testid="sim-assigned-joins" onClick={() => act((d) => assignedJoins(d, s.id), 'The assigned moderator joined.')}>
            Simulate: assigned moderator joins
          </Button>
        )}
        {s.status === 'Active' && (
          <Button size="sm" data-testid="simulate-complete" onClick={() => act((d) => endSession(d, s.id, 'Dev', 'Completed'), 'The session completed. It is Under review and in the Review queue now, with no scores yet.')}>
            Simulate: session completes
          </Button>
        )}
        {s.status === 'Active' && (
          <Button size="sm" onClick={() => act((d) => simulateTurn(d, s.id), 'The participant answered the next question. A running session carries on, paused or not.')}>
            Simulate: running session takes its next turn
          </Button>
        )}
        {!any && <p className="text-xs text-graphite">Nothing to simulate for a session in this state.</p>}
      </div>
      {simulated && (
        <p role="status" data-testid="simulated" className="mt-2 rounded-sm border border-mist bg-paper px-3 py-1.5 text-sm">
          {simulated}
        </p>
      )}
    </section>
  )
}
