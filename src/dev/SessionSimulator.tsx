import { useState } from 'react'
import { Button } from '@/components/Button'
import { controlBase } from '@/components/Field'
import { sample } from '@/routes/screens'
import { addWait, allDeclined, assignedJoins, endSession, handledBySystem, openLink, participantBooks, participantEnds, recoverSystem, requestEscalation, resolveSession, simulateTurn, standbyAccepts, type FieldworkDoc } from '@/state/fieldwork'
import { SELF_SERVICE } from '@/state/selfService'

/**
 * Dev-only. Stands in for the participant app until it is built: with a session page open, the controls here act on that
 * session. It lives in the Screen jump panel so nothing dev-only shows on the page itself.
 */
export function SessionSimulator({ doc, sessionId, paused, update }: { doc: FieldworkDoc; sessionId: string; paused: boolean; update: (fn: (d: FieldworkDoc) => FieldworkDoc) => void }) {
  const [simulated, setSimulated] = useState<string>()
  const [problem, setProblem] = useState<string>(SELF_SERVICE[0].type)
  const s = resolveSession(doc, sessionId)?.session
  if (!s) return null

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
          <Button size="sm" data-testid="sim-escalate" onClick={() => act((d) => requestEscalation(d, s.id), 'The participant asked for a human. A standby moderator was offered the session.')}>
            Simulate: participant asks for a human
          </Button>
        )}
        {s.escalation?.status === 'Offering' && (
          <>
            <Button size="sm" data-testid="sim-accepted" onClick={() => act((d) => standbyAccepts(d, s.id), 'The standby moderator accepted and joined. It never reached the Researcher.')}>
              Simulate: escalation accepted by standby
            </Button>
            <Button size="sm" data-testid="sim-declined" onClick={() => act((d) => allDeclined(d, s.id), 'Every standby moderator declined or timed out. It is waiting for the Researcher.')}>
              Simulate: all declined
            </Button>
          </>
        )}
        {(s.escalation?.status === 'Offering' || s.escalation?.status === 'Waiting for moderator') && (
          <>
            <Button size="sm" data-testid="sim-ends" onClick={() => act((d) => participantEnds(d, s.id), 'The participant chose to end the interview. The session is Withdrawn.')}>
              Simulate: participant ends the interview
            </Button>
            <Button size="sm" data-testid="sim-books" onClick={() => act((d) => participantBooks(d, s.id), 'The participant booked a human follow-up. The session is Booked.')}>
              Simulate: participant books a follow-up
            </Button>
          </>
        )}
        {s.escalation?.status === 'Waiting for moderator' && (
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
