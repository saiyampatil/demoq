import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Breadcrumb } from '@/components/Breadcrumb'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { EmptyState, LoadingState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { formatStamp } from '@/lib/format'
import { currentUser } from '@/mock/people'
import { transcriptFor, type ReviewFlag, type ReviewSession } from '@/mock/review'
import { screenById, studyPath } from '@/routes/screens'
import { DEFAULT_QUEUE, loadQueue, queueOrder } from '@/state/reviewQueue'
import { PageHeader } from '../../shared/PageHeader'
import { resolveSession } from '@/state/fieldwork'
import { SampleDataBanner } from '../SampleDataBanner'
import { sessionText } from '../SessionTag'
import { useStudySessions } from '../useStudySessions'
import { FlagsPanel } from './FlagsPanel'
import { ScorePair } from './ScorePanel'
import { SessionNotes, StimulusHistory, SurveyResponses } from './SessionPanels'
import { ActivityPanel, DecisionBar, DismissFlagModal, type DecisionCtx } from './DecisionBar'
import { TranscriptView, type Focus } from './TranscriptView'
import { usePlayer, VideoPlayer } from './VideoPlayer'

const TABS = ['workspace', 'transcript', 'stimulus', 'survey', 'notes', 'activity'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  workspace: 'Review workspace',
  transcript: 'Transcript',
  stimulus: 'Stimulus history',
  survey: 'Survey responses',
  notes: 'Session notes',
  activity: 'Activity',
}

export function SessionReview() {
  const { sessionId = '' } = useParams()
  const { studyId, review, preview, doc, outcomes, reserve, study, update, me, target } = useStudySessions()
  const [params] = useSearchParams()
  const demo = params.get('demo')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 600)
    return () => clearTimeout(t)
  }, [sessionId])

  const all = review
  // ?demo=human shows the session as if a human moderator ran it, to see what human-led studies offer.
  const found0 = all.find((s) => s.id === sessionId)
  const session = found0 && demo === 'human' ? { ...found0, moderatorType: 'Human' as const, moderator: 'Priya Shah' } : found0
  const href = (screen: typeof screenById.R22, id: string) => studyPath(studyId, { ...screen, path: screen.path.replace(':sessionId', id) })
  if (!session && demo !== 'notfound') {
    // A participant ID (no session number) means the session of theirs that is in Review.
    const reviewable = review.find((r) => r.participantId === sessionId)
    if (reviewable) return <Navigate replace to={`${href(screenById.R22, reviewable.id)}${params.toString() ? `?${params}` : ''}`} />
    // Someone who exists but hasn't finished isn't "not found": send them to their fieldwork record.
    const found = doc ? resolveSession(doc, sessionId) : undefined
    if (found) return <Navigate replace to={`${href(screenById.R19, found.session.id)}?from=review`} />
  }

  // The codebook and Emotion & behaviour open a session with ?from= (and ?at=seconds) so the way back is that screen, not the queue.
  const from = params.get('from')
  const fromBase = from === 'codebook' || from === 'signals'
  const crumbs = (
    <>
      <Breadcrumb parent={fromBase ? { to: studyPath(studyId, from === 'signals' ? screenById.A2 : screenById.A1), label: from === 'signals' ? 'Back to Emotion & behaviour' : 'Back to Codebook' } : { to: studyPath(studyId, screenById.R21), label: 'Review queue' }} current={session ? sessionText(session.participantId, session.sessionNo, session.sessionCount) : sessionId} />
      {preview && (
        <div className="mb-4">
          <SampleDataBanner studyId={studyId} />
        </div>
      )}
    </>
  )

  if (!loaded && demo !== 'notfound')
    return (
      <div>
        {crumbs}
        <div className="rounded-md border border-mist bg-surface p-5">
          <LoadingState label="Loading the session" rows={6} />
        </div>
      </div>
    )

  if (!session)
    return (
      <div>
        {crumbs}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="Session not found" description={`There’s no session “${sessionId}” in this study’s review queue. It may have been removed, or the link is wrong.`} action={<Button to={studyPath(studyId, screenById.R21)}>Back to the review queue</Button>} />
        </div>
      </div>
    )

  const closed = !preview && (!!doc?.closed || study?.status === 'Complete')
  const paused = !preview && (study?.status === 'Paused' || !!doc?.paused || closed)
  const ctx: DecisionCtx | undefined = doc ? { session, doc, target, outcomes, reserve, me, update, paused, closed, readOnly: preview || !update } : undefined
  const at = Number(params.get('at'))
  return <Loaded key={session.id} session={session} all={all} studyId={studyId} crumbs={crumbs} demo={demo} ctx={ctx} startAt={Number.isFinite(at) && at > 0 ? at : undefined} />
}

function Loaded({ session, all, studyId, crumbs, demo, ctx, startAt }: { session: ReviewSession; all: ReviewSession[]; studyId: string; crumbs: React.ReactNode; demo: string | null; ctx?: DecisionCtx; startAt?: number }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('workspace')
  const [focus, setFocus] = useState<Focus>()
  const [flagOn, setFlagOn] = useState<string>()
  const [dismissing, setDismissing] = useState<ReviewFlag>()
  const player = usePlayer(session.durationMin * 60, demo === 'videofail')
  const turns = useMemo(() => (demo === 'notranscript' ? [] : transcriptFor(session.id)), [session.id, demo])

  // Previous and Next follow the queue as it was filtered when the Researcher left it.
  const queue = loadQueue()
  const scoped = queueOrder(all, queue)
  const list = scoped.some((s) => s.id === session.id) ? scoped : queueOrder(all, { ...DEFAULT_QUEUE, asc: queue.asc })
  const at = list.findIndex((s) => s.id === session.id)
  const go = (i: number) => navigate(studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', list[i].id) }))

  /** One click: seek the player, scroll the transcript to the turn, and mark it. */
  const jumpToTurn = (sec: number, turn: number) => {
    player.seek(sec)
    setFocus({ index: turn - 1, nonce: Date.now() })
    if (tab !== 'workspace' && tab !== 'transcript') setTab('workspace')
  }
  const jumpFlag = (f: ReviewFlag) => {
    setFlagOn(f.id)
    jumpToTurn(f.atSec, f.turn)
  }
  const jumpTime = (sec: number) => {
    const t = turns.findLast((x) => x.atSec <= sec)
    if (t) jumpToTurn(sec, t.turn)
    else player.seek(sec)
  }
  // A quote opened from the codebook lands on its moment.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || startAt === undefined) return
    started.current = true
    jumpTime(startAt)
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        {crumbs}
        <PageHeader
          id="R22"
          title={session.participantId}
          meta={
            <>
              <StatusChip status={session.status} size="sm" />
              {session.awaiting && <span className="rounded-xs border border-pending-line bg-pending-bg px-1.5 py-0.5 text-xs font-medium text-pending-fg">Waiting for {session.awaiting.to.toLowerCase()}</span>}
              {session.sessionCount > 1 && <span className="font-medium text-ink">Session {session.sessionNo} of {session.sessionCount}</span>}
              <span>{session.moderator}</span>
              <span>{session.release}</span>
              <span>{session.guide}</span>
              <span>Completed {formatStamp(session.completedAt)}</span>
              <span className="tabular-nums">{session.durationMin} min</span>
            </>
          }
          actions={
            <>
              <span className="text-sm text-graphite tabular-nums" aria-live="polite">
                {at + 1} of {list.length}
              </span>
              <Button size="sm" icon={<ChevronLeftIcon size={14} />} disabled={at <= 0} onClick={() => go(at - 1)}>
                Previous session
              </Button>
              <Button size="sm" disabled={at < 0 || at >= list.length - 1} onClick={() => go(at + 1)}>
                Next session
                <ChevronRightIcon size={14} />
              </Button>
            </>
          }
        />
      </div>

      {ctx && <DecisionBar ctx={ctx} />}

      <ScorePair session={session} />

      <div role="tablist" aria-label="Session views" className="flex flex-wrap gap-1 border-b border-mist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            id={`rtab-${t}`}
            aria-selected={tab === t}
            aria-controls="review-panel"
            onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === t ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div id="review-panel" role="tabpanel" aria-labelledby={`rtab-${tab}`} className="flex flex-col gap-6">
        {tab === 'workspace' && (
          <>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <VideoPlayer player={player} id={session.participantId} sessionLabel={sessionText(session.participantId, session.sessionNo, session.sessionCount)} flags={session.flags.filter((f) => !session.dismissed?.[f.id])} turns={turns} onJumpFlag={jumpFlag} />
              <FlagsPanel flags={session.flags} onJump={jumpFlag} highlighted={flagOn} dismissed={session.dismissed} onDismiss={ctx && !ctx.readOnly && session.status === 'Under review' ? setDismissing : undefined} />
            </div>
            <TranscriptView session={session} currentSec={player.t} focus={focus} empty={demo === 'notranscript'} onSeek={(s) => player.seek(s)} />
          </>
        )}
        {tab === 'transcript' && <TranscriptView session={session} currentSec={player.t} focus={focus} height={600} empty={demo === 'notranscript'} onSeek={(s) => player.seek(s)} />}
        {tab === 'stimulus' && (
          <Panel title="Stimulus history" note="Click a stimulus to jump to the moment it was shown.">
            <StimulusHistory session={session} onJump={jumpTime} />
          </Panel>
        )}
        {tab === 'survey' && (
          <Panel title="Survey responses">
            <SurveyResponses session={session} />
          </Panel>
        )}
        {tab === 'notes' && (
          <Panel title="Session notes">
            <SessionNotes session={session} me={currentUser.name} />
          </Panel>
        )}
        {tab === 'activity' && (
          <Panel title="Activity" note="Everything that has happened to this session in review. Entries are never edited or removed.">
            <ActivityPanel session={session} />
          </Panel>
        )}
      </div>
      {ctx && <DismissFlagModal ctx={ctx} flag={dismissing} onClose={() => setDismissing(undefined)} />}
    </div>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-md border border-mist bg-surface p-5">
      <h2 className="text-md font-semibold">{title}</h2>
      {note && <p className="mb-3 text-sm text-graphite">{note}</p>}
      <div className={note ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}
