import { Link } from 'react-router'
import { useState } from 'react'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { LockIcon } from '@/components/icons'
import { formatDateTime, formatStamp } from '@/lib/format'
import { scoreBand, type ReviewSession, type StimulusStatus } from '@/mock/review'
import { now, uid } from '@/state/brief'
import { updateReview, useReviewState } from '@/state/reviewState'
import { mmss } from './reviewUi'

const stimStyle: Record<StimulusStatus, string> = {
  Loaded: 'bg-positive-bg text-positive-fg',
  'Fallback used': 'bg-pending-bg text-pending-fg',
  Failed: 'bg-negative-bg text-negative-fg',
}

/** Each stimulus with its version and when it was shown. A click jumps the player to that moment. */
export function StimulusHistory({ session, onJump }: { session: ReviewSession; onJump: (sec: number) => void }) {
  return (
    <ul className="flex flex-col divide-y divide-mist">
      {session.stimuli.map((s) => (
        <li key={s.name} className="py-2.5 first:pt-0 last:pb-0">
          <button type="button" onClick={() => onJump(s.shownAtSec)} className="flex w-full flex-col gap-1 rounded-sm text-left hover:bg-haze" aria-label={`${s.name}, ${s.status}, shown at ${mmss(s.shownAtSec)}. Jump to it`}>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-graphite">{s.version}</span>
              <span className={cn('ml-auto rounded-xs px-1.5 py-0.5 text-xs font-medium', stimStyle[s.status])}>{s.status}</span>
            </span>
            <span className="text-sm text-graphite tabular-nums">Shown at {mmss(s.shownAtSec)}</span>
            {s.status !== 'Loaded' && <span className="text-xs text-pending-fg">This raises an “Incorrect stimulus presentation” flag on the interview quality track.</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Fixed options and a locked answer. A follow-up probe is shown beneath and never changes it. */
export function SurveyResponses({ session }: { session: ReviewSession }) {
  return (
    <ul className="flex flex-col gap-4">
      {session.survey.map((q) => (
        <li key={q.question}>
          <p className="font-medium">{q.question}</p>
          <ul className="mt-2 flex flex-col gap-1" aria-label="Answer options">
            {q.options.map((o) => (
              <li key={o} className={cn('flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm', o === q.answer ? 'border border-ink bg-paper font-medium' : 'text-graphite')}>
                <span aria-hidden="true" className={cn('flex size-3.5 items-center justify-center rounded-full border-2', o === q.answer ? 'border-ink' : 'border-mist-strong')}>
                  {o === q.answer && <span className="size-1.5 rounded-full bg-ink" />}
                </span>
                {o}
                {o === q.answer && <span className="sr-only"> (recorded answer)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-graphite">
              Recorded answer: <span className="font-medium text-ink">{q.answer}</span>, at <span className="tabular-nums">{mmss(q.answeredAtSec)}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-xs border border-mist-strong bg-haze px-1.5 py-0.5 text-xs font-medium text-graphite">
              <LockIcon size={11} /> Locked
            </span>
          </p>
          {q.probe && (
            <div className="mt-2 rounded-sm border border-dashed border-mist-strong px-3 py-2 text-sm">
              <p className="text-xs text-graphite">Follow-up probe. It doesn’t change the answer above.</p>
              <p className="mt-0.5">{q.probe.question}</p>
              <p className="font-serif text-quote text-graphite">{q.probe.answer}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Notes the AI agent wrote, kept visibly apart from the Researcher's own. */
export function SessionNotes({ session, me }: { session: ReviewSession; me: string }) {
  const rs = useReviewState()
  const mine = rs.notes[session.id] ?? []
  const [text, setText] = useState('')
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="AI-generated notes" className="ai-surface p-4">
        <header className="mb-2 flex items-center gap-2">
          <AIGeneratedTag />
          <span className="text-sm text-graphite">Written by the AI agent during the interview</span>
        </header>
        <ul className="list-disc pl-5 text-sm">
          {session.aiNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Researcher notes" className="rounded-md border border-mist p-4">
        <h3 className="text-sm font-semibold">Researcher notes</h3>
        <p className="text-xs text-graphite">Yours. Saved with your name and the time.</p>
        {mine.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {mine.map((n) => (
              <li key={n.id} className="rounded-sm bg-paper px-3 py-2 text-sm">
                <p>{n.text}</p>
                <p className="mt-0.5 text-xs text-graphite">
                  {n.by}, {formatDateTime(n.at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            updateReview((s) => ({ ...s, notes: { ...s.notes, [session.id]: [...(s.notes[session.id] ?? []), { id: uid('rn'), text: text.trim(), by: me, at: now() }] } }))
            setText('')
          }}
        >
          <TextArea label="Add a note" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="sm" className="self-start" disabled={!text.trim()}>
            Save note
          </Button>
        </form>
      </section>
    </div>
  )
}

/** Facts about the session, and the release and guide it was recorded under. */
export function SessionDetails({ session, segment, history }: { session: ReviewSession; segment: string; history?: { id: string; no: number; status: string; href: string }[] }) {
  const rows: [string, string][] = [
    ['Participant ID', session.participantId],
    ['Session', `${session.sessionNo} of ${session.sessionCount} (${session.id})`],
    ['Segment', segment],
    ['Moderator', session.moderator],
    ['Release', session.release],
    ['Guide', session.guide],
    ['Completed', formatStamp(session.completedAt)],
    ['Duration', `${session.durationMin} min`],
    ['Transcript', `${session.turnCount.toLocaleString('en-US')} turns${session.reviewed ? `, reviewed copy v${session.reviewed.version} available` : ''}`],
    ['Participant integrity', `${session.integrity}, ${scoreBand(session.integrity).toLowerCase()}`],
    ['Interview quality', `${session.quality}, ${scoreBand(session.quality).toLowerCase()}`],
    ['Flags', `${session.flags.length}`],
  ]
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-graphite">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {history && history.length > 1 && (
        <section aria-label="Respondent history">
          <h3 className="text-sm font-semibold">All sessions for {session.participantId}</h3>
          <p className="mt-0.5 text-sm text-graphite">One participant, one ID. Each time they came back it’s a new session. Only the completed one is reviewed.</p>
          <ol className="mt-2 flex flex-col divide-y divide-mist rounded-sm border border-mist">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="w-28 font-medium tabular-nums">Session {h.no} of {history.length}</span>
                <span className="flex-1 text-graphite">{h.status}</span>
                {h.id === session.id ? <span className="text-xs text-graphite">This session</span> : <Link to={h.href} className="font-medium text-iris-700 hover:underline">Open fieldwork record</Link>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
