import { useState } from 'react'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { LockIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/format'
import { type ReviewSession, type StimulusStatus } from '@/mock/review'
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

/** Fixed options and a locked answer, grouped by survey. A follow-up probe is shown beneath and never changes it. */
export function SurveyResponses({ session }: { session: ReviewSession }) {
  const groups = session.survey.reduce<{ title: string; items: ReviewSession['survey'] }[]>((acc, q) => {
    const g = acc.find((x) => x.title === q.survey)
    if (g) g.items.push(q)
    else acc.push({ title: q.survey, items: [q] })
    return acc
  }, [])
  if (!groups.length) return <p className="text-sm text-graphite">No survey was run in this session.</p>
  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h3 className="text-sm font-semibold">
            {g.title} <span className="font-normal text-graphite tabular-nums">{g.items.length} {g.items.length === 1 ? 'question' : 'questions'}</span>
          </h3>
          <ol className="mt-3 flex flex-col gap-5">
            {g.items.map((q, i) => {
              const picked = q.format === 'multiple' ? q.answer.split(';').map((x) => x.trim()) : [q.answer]
              return (
                <li key={q.question}>
                  <p className="font-medium">
                    <span className="mr-1.5 text-graphite tabular-nums">{i + 1}.</span>
                    {q.question}
                  </p>
                  <p className="text-xs text-graphite">{q.format === 'multiple' ? 'Select all that apply' : q.format === 'rating' ? 'Rating scale' : 'Pick one'}</p>
                  {q.format === 'rating' ? (
                    <div className="mt-2">
                      <ul className="flex flex-wrap gap-1.5" aria-label="Scale">
                        {q.options.map((o) => (
                          <li key={o} className={cn('flex size-8 items-center justify-center rounded-sm text-sm tabular-nums', o === q.answer ? 'border border-ink bg-paper font-semibold' : 'border border-mist text-graphite')}>
                            {o}
                            {o === q.answer && <span className="sr-only"> (recorded answer)</span>}
                          </li>
                        ))}
                      </ul>
                      {q.scale && (
                        <p className="mt-1 flex max-w-xs justify-between text-xs text-graphite">
                          <span>1 = {q.scale.low}</span>
                          <span>{q.options.length} = {q.scale.high}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1" aria-label="Answer options">
                      {q.options.map((o) => {
                        const on = picked.includes(o)
                        return (
                          <li key={o} className={cn('flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm', on ? 'border border-ink bg-paper font-medium' : 'text-graphite')}>
                            <span aria-hidden="true" className={cn('flex size-3.5 items-center justify-center border-2', q.format === 'multiple' ? 'rounded-xs' : 'rounded-full', on ? 'border-ink' : 'border-mist-strong')}>
                              {on && <span className={cn('size-1.5 bg-ink', q.format === 'multiple' ? 'rounded-[1px]' : 'rounded-full')} />}
                            </span>
                            {o}
                            {on && <span className="sr-only"> (recorded answer)</span>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-graphite">
                      Recorded answer: <span className="font-medium text-ink">{picked.join(', ')}</span>, at <span className="tabular-nums">{mmss(q.answeredAtSec)}</span>
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
              )
            })}
          </ol>
        </section>
      ))}
    </div>
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
