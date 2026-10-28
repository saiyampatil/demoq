import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, controlClass } from '@/components/Field'
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import {
  acceptScreener,
  editScreener,
  MAX_QUESTIONS,
  questionTypeLabel,
  screenerBlockers,
  startScreener,
  type QuestionType,
  type ScreenerQuestion,
} from '@/state/audience'
import { uid } from '@/state/brief'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { OriginTag } from './OriginTag'
import { useAudience } from './useAudience'

const input = cn(controlClass, 'h-9')

export function ScreenerEditor() {
  const { studyId, audience, editable, me, update } = useAudience()
  const navigate = useNavigate()
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  if (!editable || !audience?.def) return <AudienceGate studyId={studyId} editable={editable} />

  const s = audience.screener
  const header = (meta?: ReactNode) => (
    <PageHeader id="R7" title="Screener editor" description="The questions applicants answer before they’re screened. Seven at most." meta={meta} />
  )

  if (!s || audience.screenerPending) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          {audience.screenerPending ? (
            <div className="flex items-center gap-2 px-6 py-10 text-graphite" role="status">
              <Spinner /> Writing screener questions from the audience…
            </div>
          ) : (
            <EmptyState
              title="The screener is written when you confirm the audience"
              description="The AI turns the confirmed filters and exclusions into up to seven questions. You then edit and accept them here."
              action={
                <Button variant="primary" to={studyPath(studyId, screenById.R6)}>
                  Go to audience definition
                </Button>
              }
            />
          )}
        </div>
        <WizardFooter previous={{ to: studyPath(studyId, screenById.R6), label: 'Audience' }} />
      </div>
    )
  }

  const edit = (fn: (qs: ScreenerQuestion[]) => ScreenerQuestion[]) => update((d) => editScreener(d, fn))
  const editQuestion = (id: string, fn: (q: ScreenerQuestion) => ScreenerQuestion) =>
    edit((qs) => qs.map((q) => (q.id === id ? { ...fn(q), origin: q.origin === 'ai' ? 'edited' : q.origin } : q)))
  const move = (from: number, to: number) =>
    edit((qs) => {
      const next = [...qs]
      const [q] = next.splice(from, 1)
      next.splice(to, 0, q)
      return next
    })
  const full = s.questions.length >= MAX_QUESTIONS
  const blockers = screenerBlockers(s)

  return (
    <div className="flex flex-col gap-6">
      {header(
        <>
          <span className="font-medium text-ink tabular-nums">
            {s.questions.length} of {MAX_QUESTIONS} questions
          </span>
          {s.status === 'Ready' && s.accepted ? (
            <span className="flex items-center gap-1 text-positive-fg">
              <CheckIcon size={14} /> Accepted by {s.accepted.by}, <span className="tabular-nums">{formatDateTime(s.accepted.at)}</span>
            </span>
          ) : (
            <span>Draft, not accepted yet</span>
          )}
          <span>Built from audience version {s.fromAudienceVersion}</span>
        </>,
      )}

      {s.review && (
        <Banner tone="warning" title="Flagged for review">
          {s.review.reason} Check the questions still match the audience, then accept the screener again.
        </Banner>
      )}
      {audience.status !== 'Confirmed' && !s.review && (
        <Banner tone="info" title="The audience isn’t confirmed yet">
          Sourcing opens once the audience is confirmed and the screener is accepted.
        </Banner>
      )}

      <ol className="flex flex-col gap-4">
        {s.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            count={s.questions.length}
            onChange={(fn) => editQuestion(q.id, fn)}
            onMove={(to) => move(i, to)}
            onRemove={() => edit((qs) => qs.filter((x) => x.id !== q.id))}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon={<PlusIcon />}
          disabled={full}
          onClick={() => edit((qs) => [...qs, { id: uid('q'), text: '', type: 'single', options: ['', ''], purpose: 'Added by the researcher.', origin: 'added' }])}
        >
          Add question
        </Button>
        {full && <p className="text-sm text-graphite">A screener can have at most {MAX_QUESTIONS} questions. Remove one to add another.</p>}
      </div>

      <WizardFooter
        previous={{ to: studyPath(studyId, screenById.R6), label: 'Audience' }}
        message={
          confirmRegenerate ? (
            <span className="flex flex-wrap items-center gap-2">
              Replace all {s.questions.length} questions with a fresh AI draft? Your edits are lost.
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  update(startScreener)
                  setConfirmRegenerate(false)
                }}
              >
                Regenerate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRegenerate(false)}>
                Keep my questions
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRegenerate(true)}>
              Regenerate from audience
            </Button>
          )
        }
      >
        {s.status === 'Ready' ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R8)}>
            Continue to sourcing
          </Button>
        ) : blockers.length ? (
          <Tooltip focusable content={`${blockers.join('. ')}.`}>
            <Button variant="primary" disabled>
              Accept and continue
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              update((d) => acceptScreener(d, me))
              navigate(studyPath(studyId, screenById.R8))
            }}
          >
            Accept and continue
          </Button>
        )}
      </WizardFooter>
    </div>
  )
}

const LONG_LIST = 8

function QuestionCard({
  question: q,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  question: ScreenerQuestion
  index: number
  count: number
  onChange: (fn: (q: ScreenerQuestion) => ScreenerQuestion) => void
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const choice = q.type === 'single' || q.type === 'multi'
  const long = q.options.length > LONG_LIST
  const shown = long && !showAll ? q.options.slice(0, LONG_LIST) : q.options

  return (
    <li className={cn('rounded-md bg-surface p-4', q.origin === 'ai' ? 'ai-surface' : 'border border-mist')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white tabular-nums">{index + 1}</span>
        {q.origin === 'ai' ? <AIGeneratedTag /> : <OriginTag origin={q.origin} />}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move question ${index + 1} up`}>
          Move up
        </Button>
        <Button size="sm" variant="ghost" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Move question ${index + 1} down`}>
          Move down
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove question ${index + 1}`}>
          Remove
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs text-graphite">Question</span>
          <input value={q.text} placeholder="Write the question" onChange={(e) => onChange((x) => ({ ...x, text: e.target.value }))} className={cn(input, 'bg-surface')} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-graphite">Answer type</span>
          <select
            value={q.type}
            onChange={(e) => {
              const type = e.target.value as QuestionType
              onChange((x) => ({ ...x, type, options: type === 'single' || type === 'multi' ? (x.options.length ? x.options : ['', '']) : [] }))
            }}
            className={cn(controlBase, 'h-9 bg-surface pr-7')}
          >
            {(Object.keys(questionTypeLabel) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {questionTypeLabel[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {choice && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-graphite">Options ({q.options.length})</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {shown.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Option ${i + 1}`}
                  value={o}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => onChange((x) => ({ ...x, options: x.options.map((y, j) => (j === i ? e.target.value : y)) }))}
                  className={cn(controlClass, 'h-8 bg-surface text-sm')}
                />
                <button
                  type="button"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => onChange((x) => ({ ...x, options: x.options.filter((_, j) => j !== i) }))}
                  className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink"
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {long && (
              <Button size="sm" variant="ghost" onClick={() => setShowAll((x) => !x)}>
                {showAll ? 'Show fewer' : `Show all ${q.options.length}`}
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={() => onChange((x) => ({ ...x, options: [...x.options, ''] }))}>
              Add option
            </Button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-graphite">{q.purpose}</p>
    </li>
  )
}
