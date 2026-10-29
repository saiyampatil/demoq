import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
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
import { DEFAULT_COHORT_NAMES, DEFAULT_QUEUE, loadQueue, queueOrder } from '@/state/reviewQueue'
import { PageHeader } from '../../shared/PageHeader'
import { SampleDataBanner } from '../SampleDataBanner'
import { useStudySessions } from '../useStudySessions'
import { FlagsPanel } from './FlagsPanel'
import { ScorePair } from './ScorePanel'
import { SessionDetails, SessionNotes, StimulusHistory, SurveyResponses } from './SessionPanels'
import { TranscriptView, type Focus } from './TranscriptView'
import { usePlayer, VideoPlayer } from './VideoPlayer'

const TABS = ['workspace', 'transcript', 'stimulus', 'survey', 'notes', 'details'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  workspace: 'Review workspace',
  transcript: 'Transcript',
  stimulus: 'Stimulus history',
  survey: 'Survey responses',
  notes: 'Session notes',
  details: 'Session details',
}

export function SessionReview() {
  const { sessionId = '' } = useParams()
  const { studyId, audience, review, preview } = useStudySessions()
  const [params] = useSearchParams()
  const demo = params.get('demo')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 600)
    return () => clearTimeout(t)
  }, [sessionId])

  const cohorts = audience?.def?.cohorts ?? Object.entries(DEFAULT_COHORT_NAMES).map(([id, name]) => ({ id, name }))
  const cohortName = (id: string) => cohorts.find((c) => c.id === id)?.name ?? DEFAULT_COHORT_NAMES[id] ?? id
  const all = review
  const session = all.find((s) => s.id === sessionId)

  const crumbs = (
    <>
      <Breadcrumb parent={{ to: studyPath(studyId, screenById.R21), label: 'Review queue' }} current={sessionId} />
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

  return <Loaded key={session.id} session={session} all={all} cohortName={cohortName} studyId={studyId} crumbs={crumbs} demo={demo} />
}

function Loaded({ session, all, cohortName, studyId, crumbs, demo }: { session: ReviewSession; all: ReviewSession[]; cohortName: (id: string) => string; studyId: string; crumbs: React.ReactNode; demo: string | null }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('workspace')
  const [focus, setFocus] = useState<Focus>()
  const [flagOn, setFlagOn] = useState<string>()
  const player = usePlayer(session.durationMin * 60, demo === 'videofail')
  const turns = useMemo(() => (demo === 'notranscript' ? [] : transcriptFor(session.id)), [session.id, demo])

  // Previous and Next follow the queue as it was filtered when the Researcher left it.
  const queue = loadQueue()
  const scoped = queueOrder(all, queue, cohortName)
  const list = scoped.some((s) => s.id === session.id) ? scoped : queueOrder(all, { ...DEFAULT_QUEUE, asc: queue.asc }, cohortName)
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        {crumbs}
        <PageHeader
          id="R22"
          title={session.id}
          meta={
            <>
              <StatusChip status={session.status} size="sm" />
              <span>{cohortName(session.cohortId)}</span>
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
              <VideoPlayer player={player} id={session.id} flags={session.flags} turns={turns} onJumpFlag={jumpFlag} />
              <FlagsPanel flags={session.flags} onJump={jumpFlag} highlighted={flagOn} />
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
        {tab === 'details' && (
          <Panel title="Session details">
            <SessionDetails session={session} segment={cohortName(session.cohortId)} />
          </Panel>
        )}
      </div>
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
