import { useParams } from 'react-router'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { useStudies } from '@/state/StudyContext'
import { briefAccess } from '@/state/requests'
import { participantName } from '@/mock/participants'
import { SessionBrief } from './SessionBrief'
import { useModeratorData } from './Sessions'

/** M5. A moderator's read-only brief for one session. It opens only for a session that is theirs, or a request they can see. */
export function BriefPage() {
  const { sessionId } = useParams()
  const data = useModeratorData()
  const { getGuide, getBrief } = useStudies()
  const found = briefAccess(data.all, data.me.id, sessionId ?? '', data.studyName, data.language)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-6">
      <div className="flex items-center gap-3">
        <Button size="sm" to="/moderator/sessions" data-testid="brief-back">
          ‹ My sessions
        </Button>
      </div>
      {!found ? (
        <EmptyState title="This brief isn’t available" description="You can open the brief for your own sessions, and for requests you can see." />
      ) : (
        <>
          <header>
            <h1 className="text-xl font-semibold">Session brief</h1>
            <p className="text-sm text-graphite">
              {participantName(found.session.participantId)} · {found.session.participantId} · {data.studyName(found.doc.studyId)}
            </p>
          </header>
          <SessionBrief doc={found.doc} session={found.session} guide={getGuide(found.doc.studyId)} brief={getBrief(found.doc.studyId)} />
        </>
      )}
    </div>
  )
}
