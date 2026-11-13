import { useParams } from 'react-router'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { participantName } from '@/mock/participants'
import { availabilityFor } from '@/mock/moderation'
import { moderatorName } from '@/state/fieldwork'
import { formatIn } from '@/state/standby'
import { briefAccess } from '@/state/requests'
import { useStudies } from '@/state/StudyContext'
import { SessionBrief } from './SessionBrief'
import { useModeratorData } from './Sessions'

/** M5. A moderator's read-only brief for one session, built to be read on a phone or printed. It opens only for a session that is theirs, or a request they can see. */
export function BriefPage() {
  const { sessionId } = useParams()
  const data = useModeratorData()
  const { getGuide, getBrief } = useStudies()
  const found = briefAccess(data.all, data.me.id, sessionId ?? '', data.studyName, data.language)
  const zone = availabilityFor(data.me.id).availability.timeZone
  const s = found?.session
  const when = s?.slot ?? s?.escalation?.request?.suggested
  return (
    <div id="brief-root" className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
      <div className="flex items-center gap-3 print:hidden">
        <Button size="sm" to="/moderator/sessions" data-testid="brief-back">
          ‹ My sessions
        </Button>
        <span className="flex-1" />
        {found && (
          <Button size="sm" variant="primary" data-testid="download-brief" onClick={() => window.print()}>
            Download brief
          </Button>
        )}
      </div>
      {!found || !s ? (
        <EmptyState title="This brief isn’t available" description="You can open the brief for your own sessions, and for requests you can see." />
      ) : (
        <>
          <div data-testid="brief-title">
            <h1 className="text-xl font-semibold">Session brief</h1>
            <p className="text-sm text-graphite">
              {data.studyName(found.doc.studyId)} · {participantName(s.participantId)} · {s.participantId}
            </p>
          </div>
          <SessionBrief
            doc={found.doc}
            session={s}
            guide={getGuide(found.doc.studyId)}
            brief={getBrief(found.doc.studyId)}
            moderator={s.moderatorId ? moderatorName(s.moderatorId) : data.me.name}
            whenText={when ? `${s.slot ? 'Session' : 'Suggested time'}: ${formatIn(when, zone)}` : 'Time to be agreed'}
          />
        </>
      )}
    </div>
  )
}
