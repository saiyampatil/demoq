import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { ClipPlayer } from '@/components/ClipPlayer'
import { cn } from '@/components/cn'
import { PlayIcon, SparkIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { formatStamp } from '@/lib/format'
import { petOf } from '@/mock/codebook'
import { findReviewRecord, transcriptFor } from '@/mock/review'
import { screenById, studyPath } from '@/routes/screens'
import {
  acceptCodes,
  addCandidate,
  band,
  denominator,
  editDefinition,
  excerpt,
  liveExcerpts,
  peopleOf,
  petSplit,
  questionOf,
  restoreCode,
  similarCodes,
  skipCandidate,
  WEAK_MATCH,
  type Code,
  type Excerpt,
} from '@/state/codebook'
import { mmss } from '../review/reviewUi'
import { MergeDialog, ReasonDialog, RenameDialog } from './CodeDialogs'
import type { CodebookCtx } from './codebookCtx'
import { rejectCode, removeQuote } from '@/state/codebook'

type Dialog = { kind: 'rename' } | { kind: 'merge'; into?: string } | { kind: 'reject' } | { kind: 'remove'; excerptId: string }

/** One code, everything needed to decide on it: what it means, who said it, the evidence, and its history. */
export function CodeDetail({ ctx, code: c, onDecided, onOpen }: { ctx: CodebookCtx; code: Code; onDecided: () => void; onOpen: (id: string) => void }) {
  const { doc, basis, me } = ctx
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog>()
  const [editing, setEditing] = useState(false)
  const [definition, setDefinition] = useState(c.definition)

  const quotes = useMemo(() => liveExcerpts(c, basis).sort((a, b) => b.confidence - a.confidence), [c, basis])
  const people = peopleOf(c, basis)
  const N = denominator(c, basis)
  const split = petSplit(people)
  const similar = c.status === 'Suggested' || c.status === 'Accepted' ? similarCodes(doc, c, basis) : []
  const pending = (doc.pending[c.id] ?? []).map(excerpt).filter((e) => basis.sessions.has(e.sessionId))
  const history = doc.log.filter((l) => l.target.kind === 'code' && l.target.id === c.id).slice(0, 3)
  const q = questionOf(c.questionId)
  const target = c.mergedInto ? doc.codes.find((x) => x.id === c.mergedInto) : undefined
  const open = c.status === 'Suggested' || c.status === 'Accepted'
  const conf = band(c.confidence)

  return (
    <section aria-label={`Code: ${c.name}`} data-testid="code-detail" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-mist px-5 pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={c.status} size="sm" />
            {c.status === 'Suggested' && <AIGeneratedTag />}
            <span className="ml-auto text-xs text-graphite">{c.isNew ? 'New code' : 'From the guide'}</span>
          </div>
          <h2 className="mt-2.5 text-lg leading-snug font-semibold">{c.name}</h2>
          <p className="mt-0.5 text-xs text-graphite">
            {c.isNew ? 'Came up under' : 'Answers'}: {q.label}
          </p>

          {editing ? (
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!definition.trim()) return
                ctx.act((d) => editDefinition(d, c.id, definition, { by: me }))
                setEditing(false)
                toast('Definition saved')
              }}
            >
              <label className="sr-only" htmlFor="def-edit">
                Definition
              </label>
              <textarea id="def-edit" value={definition} onChange={(e) => setDefinition(e.target.value)} rows={3} className="w-full resize-y rounded-sm border border-mist-strong px-3 py-2 text-sm focus:border-iris-600" />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" type="submit" disabled={!definition.trim() || definition.trim() === c.definition}>
                  Save definition
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDefinition(c.definition)
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-3 flex items-start gap-2">
              <p className="flex-1 text-sm text-ink">{c.definition}</p>
              {open && (
                <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-xs px-1.5 py-0.5 text-xs font-medium text-iris-700 hover:bg-iris-50">
                  Edit
                </button>
              )}
            </div>
          )}
        </header>

        {c.status !== 'Merged' && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 border-b border-mist px-5 py-4 text-sm">
            <div>
              <dt className="text-xs text-graphite">Said by</dt>
              <dd className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular-nums">{people.size}</span>
                <span className="text-graphite tabular-nums">of {N}</span>
                {N < basis.participants.size && <span className="text-xs text-graphite">(asked {N})</span>}
              </dd>
              {people.size > 0 && (
                <div className="mt-2.5">
                  <div className="flex h-1.5 max-w-56 overflow-hidden rounded-full bg-haze" aria-hidden="true">
                    <span className="bg-ink" style={{ width: `${(split.Dog / people.size) * 100}%` }} />
                    <span className="bg-iris-300" style={{ width: `${(split.Cat / people.size) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap text-graphite tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden="true" className="size-2 rounded-full bg-ink" />
                      {split.Dog} dog {split.Dog === 1 ? 'owner' : 'owners'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden="true" className="size-2 rounded-full bg-iris-300" />
                      {split.Cat} cat {split.Cat === 1 ? 'owner' : 'owners'}
                    </span>
                    <span className="text-muted" title="Too few people to compare groups with confidence">
                      Directional
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div>
              <dt className="text-xs text-graphite">Confidence</dt>
              <dd className={cn('mt-0.5 font-medium', conf === 'Low' && 'text-pending-fg')} title={`PulseAI’s score: ${c.confidence.toFixed(2)}`}>
                {conf}
              </dd>
            </div>
          </dl>
        )}

        {c.decided && (
          <p className="border-b border-mist px-5 py-3 text-sm text-graphite">
            {c.status === 'Merged' && target ? (
              <>
                Merged into{' '}
                <button type="button" className="font-medium text-iris-700 hover:underline" onClick={() => onOpen(target.id)}>
                  {target.name}
                </button>{' '}
                by {c.decided.by}, {formatStamp(c.decided.at)}. Its quotes moved there.
              </>
            ) : (
              <>
                {c.status} by {c.decided.by}, {formatStamp(c.decided.at)}.
              </>
            )}
            {c.decided.why && <span className="mt-1 block text-ink">“{c.decided.why}”</span>}
          </p>
        )}

        {pending.length > 0 && (
          <section aria-label="More excerpts that may fit" className="ai-surface mx-5 mt-4 p-3.5" data-testid="consistency-tray">
            <p className="flex items-center gap-1.5 text-sm font-medium text-iris-700">
              <SparkIcon size={13} />
              {pending.length} more {pending.length === 1 ? 'excerpt' : 'excerpts'} in other sessions may fit
            </p>
            <p className="mt-0.5 text-xs text-graphite">PulseAI searched the other transcripts after your change. Add the ones that belong.</p>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {pending.map((e) => (
                <li key={e.id} className="rounded-sm bg-surface p-2.5">
                  <p className="font-serif text-sm text-ink">“{e.text}”</p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-graphite">
                    <span className="tabular-nums">
                      {e.participantId} · {mmss(e.atSec)}
                    </span>
                    <span className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => ctx.act((d) => skipCandidate(d, c.id, e.id))}
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        ctx.act((d) => addCandidate(d, c.id, e.id, { by: me }))
                        toast(`Added ${e.participantId}’s quote`)
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {c.status !== 'Merged' && (
          <section aria-label="Quotes" className="px-5 py-4">
            <h3 className="text-sm font-semibold">
              Quotes <span className="font-normal text-graphite tabular-nums">{quotes.length}</span>
            </h3>
            {quotes.length === 0 ? (
              <p className="mt-2 text-sm text-graphite">No quotes from accepted sessions.</p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-mist">
                {quotes.map((e) => (
                  <QuoteItem key={e.id} e={e} studyId={ctx.studyId} canRemove={open && quotes.length > 1} onRemove={() => setDialog({ kind: 'remove', excerptId: e.id })} />
                ))}
              </ul>
            )}
          </section>
        )}

        {similar.length > 0 && (
          <section aria-label="Similar codes" className="border-t border-mist px-5 py-4">
            <h3 className="text-sm font-semibold">Often said by the same people</h3>
            <p className="text-xs text-graphite">Possibly the same idea. Merge them if so.</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {similar.map((s) => (
                <li key={s.code.id} className="flex items-center gap-2 text-sm">
                  <button type="button" onClick={() => onOpen(s.code.id)} className="min-w-0 flex-1 truncate text-left font-medium text-iris-700 hover:underline">
                    {s.code.name}
                  </button>
                  <span className="text-xs text-graphite tabular-nums">{s.shared} people in common</span>
                  <Button size="sm" onClick={() => setDialog({ kind: 'merge', into: s.code.id })}>
                    Merge
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {history.length > 0 && (
          <section aria-label="Recent changes" className="border-t border-mist px-5 py-4">
            <h3 className="text-sm font-semibold">Recent changes</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-xs text-graphite">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="font-medium text-ink">{h.action}</span>
                  {h.detail && <> · {h.detail}</>} · {h.by}, {formatStamp(h.at)}
                  {h.why && <span className="block text-ink">Why: {h.why}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-mist bg-paper px-5 py-3">
        {c.status === 'Suggested' && (
          <Button
            variant="primary"
            data-testid="accept-code"
            onClick={() => {
              ctx.act((d) => acceptCodes(d, [c.id], { by: me }))
              toast(`Accepted “${c.name}”`)
              onDecided()
            }}
          >
            Accept
          </Button>
        )}
        {open && (
          <>
            <Button size="sm" onClick={() => setDialog({ kind: 'rename' })}>
              Rename
            </Button>
            <Button size="sm" onClick={() => setDialog({ kind: 'merge' })}>
              Merge
            </Button>
            <span className="flex-1" />
            <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'reject' })}>
              Reject
            </Button>
          </>
        )}
        {c.status === 'Rejected' && (
          <Button
            onClick={() => {
              ctx.act((d) => restoreCode(d, c.id, { by: me }))
              toast(`“${c.name}” is back in To review`)
            }}
          >
            Restore to To review
          </Button>
        )}
        {c.status === 'Merged' && target && <Button onClick={() => onOpen(target.id)}>Open “{target.name}”</Button>}
      </footer>

      <RenameDialog ctx={ctx} code={c} open={dialog?.kind === 'rename'} onClose={() => setDialog(undefined)} />
      <MergeDialog ctx={ctx} code={c} open={dialog?.kind === 'merge'} into={dialog?.kind === 'merge' ? dialog.into : undefined} onClose={() => setDialog(undefined)} onMerged={(id) => onOpen(id)} />
      <ReasonDialog
        open={dialog?.kind === 'reject'}
        title={`Reject “${c.name}”?`}
        description="It leaves the counts and any theme. It stays in the codebook as Rejected, and you can restore it."
        confirm="Reject code"
        danger
        onClose={() => setDialog(undefined)}
        onConfirm={(why) => {
          ctx.act((d) => rejectCode(d, c.id, { by: me }, why))
          toast(`Rejected “${c.name}”`)
          setDialog(undefined)
          onDecided()
        }}
      />
      <ReasonDialog
        open={dialog?.kind === 'remove'}
        title="Remove this quote from the code?"
        description={dialog?.kind === 'remove' ? `“${excerpt(dialog.excerptId).text}” (${excerpt(dialog.excerptId).participantId}). It stays in the transcript and won’t be suggested for this code again.` : undefined}
        confirm="Remove quote"
        onClose={() => setDialog(undefined)}
        onConfirm={(why) => {
          if (dialog?.kind !== 'remove') return
          ctx.act((d) => removeQuote(d, c.id, dialog.excerptId, { by: me }, why))
          toast('Quote removed')
          setDialog(undefined)
        }}
      />
    </section>
  )
}

/** A quote, who said it and when. Context shows the question it answered; Play opens the session at that moment. */
function QuoteItem({ e, studyId, canRemove, onRemove }: { e: Excerpt; studyId: string; canRemove: boolean; onRemove: () => void }) {
  const [context, setContext] = useState(false)
  const [playing, setPlaying] = useState(false)
  const turns = useMemo(() => (context ? transcriptFor(e.sessionId, 'reviewed') : []), [context, e.sessionId])
  const asked = turns[e.turnIndex - 1]
  const href = `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', e.sessionId) })}?from=codebook&at=${e.atSec}`
  const weak = e.confidence < WEAK_MATCH
  return (
    <li className="py-3 first:pt-1 last:pb-0" data-testid="quote">
      {context && asked && <p className="mb-1.5 text-xs text-graphite">Asked: {asked.text}</p>}
      <p className="font-serif text-quote leading-snug text-ink">“{e.text}”</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite">
        <span className="tabular-nums">
          <span className="font-medium text-ink">{e.participantId}</span> · {petOf(e.participantId)} · {mmss(e.atSec)}
        </span>
        {e.corrected && <span className="rounded-xs border border-mist-strong px-1 text-[11px]">Corrected transcript</span>}
        {weak && (
          <span className="rounded-xs border border-pending-line bg-pending-bg px-1 text-[11px] font-medium text-pending-fg" title={`PulseAI’s match score: ${e.confidence.toFixed(2)}`}>
            Weak match
          </span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => setContext((x) => !x)} aria-expanded={context} className="rounded-xs px-1 font-medium hover:bg-haze hover:text-ink">
          {context ? 'Hide question' : 'Question'}
        </button>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-expanded={playing} data-testid="quote-play" className="inline-flex items-center gap-1 rounded-xs px-1 font-medium text-iris-700 hover:bg-iris-50" aria-label={`${playing ? 'Hide clip of' : 'Play'} ${e.participantId} at ${mmss(e.atSec)}`}>
          <PlayIcon size={11} /> {playing ? 'Hide clip' : 'Play'}
        </button>
        <Link to={href} className="rounded-xs px-1 font-medium hover:bg-haze hover:text-ink" data-testid="quote-open-session">
          Open session
        </Link>
        {canRemove && (
          <button type="button" onClick={onRemove} className="rounded-xs px-1 font-medium hover:bg-haze hover:text-negative-fg">
            Remove
          </button>
        )}
      </div>
      {playing && <ClipPlayer className="mt-2" label={`${e.participantId} · ${petOf(e.participantId)}`} startSec={e.atSec} caption={e.text} audioOnly={findReviewRecord(e.sessionId)?.media === 'Audio only'} />}
    </li>
  )
}
