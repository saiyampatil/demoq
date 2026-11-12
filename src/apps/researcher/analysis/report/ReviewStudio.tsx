import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { DiffText } from '@/components/DiffText'
import { Studio } from '@/components/Studio'
import { targetOf as targetFor, type Ws } from './ws'
import type { SentenceInfo } from '@/state/reportLogic'
import type { Target } from '@/state/report'
import { plural } from '@/state/reportLogic'
import { CitationBlock } from './Side'
import { LABEL, MINI, MINI_ON, NumberText, StateChip, useWs } from './ws'

type Item = { info: SentenceInfo; group: string; target: Target }

/**
 * Review mode: read every sentence of the report once, with its sources beside it, and approve it or not. Approval is of the exact
 * wording and citations, so nothing the Researcher hasn't read can be published.
 */
export function ReviewStudio({ onClose, onRelease }: { onClose: () => void; onRelease: () => void }) {
  const ws: Ws = useWs()
  const { model, act, goTo } = ws
  const items: Item[] = useMemo(
    () => [
      ...model.exec.sentences.map((info) => ({ info, group: 'Executive summary', target: 'exec' as Target })),
      ...model.findings.filter((f) => !f.omitted).flatMap((f) => f.sentences.map((info) => ({ info, group: f.label, target: targetFor(f.questionId) }))),
    ],
    [model],
  )
  // The queue is what was open when the studio opened, so approving a sentence doesn't make it jump out from under the reader.
  const [startOpen] = useState(() => new Set(items.filter((i) => i.info.open).map((i) => i.info.sentence.id)))
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? items : items.filter((i) => startOpen.has(i.info.sentence.id) || i.info.open)
  const [cur, setCur] = useState<string | undefined>(list[0]?.info.sentence.id)
  const idx = Math.max(0, list.findIndex((i) => i.info.sentence.id === cur))
  const item = list[idx]
  const [asking, setAsking] = useState<'reason' | 'keep' | null>(null)
  const [why, setWhy] = useState('')

  const total = items.length
  const approved = items.filter((i) => !i.info.open).length
  const done = model.open.length === 0

  const move = (to: number) => {
    const next = list[Math.min(list.length - 1, Math.max(0, to))]
    if (next) {
      setCur(next.info.sentence.id)
      setAsking(null)
      setWhy('')
    }
  }
  const advance = () => {
    // The next one still open after this, wrapping to the start.
    const after = [...list.slice(idx + 1), ...list.slice(0, idx)].find((i) => i.info.open)
    if (after) move(list.indexOf(after))
  }
  const approve = (opts?: Parameters<typeof act.approve>[1]) => {
    if (!item) return
    act.approve(item.info.sentence.id, opts)
    setAsking(null)
    setWhy('')
    advance()
  }

  // Keys: arrows move, A approves. Only when the reader isn't typing.
  const keys = useRef({ move, approve, item, idx })
  useEffect(() => {
    keys.current = { move, approve, item, idx }
  })
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = keys.current
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') k.move(k.idx + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') k.move(k.idx - 1)
      else if ((e.key === 'a' || e.key === 'A') && k.item?.info.state === 'To review') k.approve()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', on)
    return () => document.removeEventListener('keydown', on)
  }, [])

  const info = item?.info

  return (
    <Studio
      open
      id="review"
      onClose={onClose}
      title="Approve sentences"
      description={`Read each sentence with its sources. ${approved} of ${plural(total, 'sentence')} approved.`}
      footer={
        <>
          <span className="mr-auto text-xs text-graphite">← → move · A approves a cited sentence</span>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {done && (
            <Button variant="primary" onClick={onRelease} data-testid="open-release">
              Open Publish
            </Button>
          )}
        </>
      }
    >
      <div className="grid min-h-full md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-mist bg-paper md:border-r md:border-b-0" aria-label="Sentences">
          <div className="flex items-center justify-between gap-2 border-b border-mist px-4 py-2.5">
            <span className="text-xs font-medium text-graphite" data-testid="review-progress">
              {approved} of {total} approved
            </span>
            <button type="button" className={MINI} aria-pressed={showAll} onClick={() => setShowAll((a) => !a)} data-testid="show-all">
              {showAll ? 'Only to review' : 'Show all'}
            </button>
          </div>
          <ul>
            {list.map((i) => {
              const on = i.info.sentence.id === item?.info.sentence.id
              return (
                <li key={i.info.sentence.id}>
                  <button type="button" onClick={() => move(list.indexOf(i))} aria-current={on} data-testid="queue-item" data-state={i.info.state} className={cn('flex w-full flex-col gap-0.5 border-b border-mist px-4 py-2.5 text-left hover:bg-haze', on && 'bg-surface shadow-[inset_3px_0_0_var(--color-ink)]')}>
                    <span className="text-xs text-graphite">{i.group}</span>
                    <span className="line-clamp-2 text-sm text-ink">{i.info.sentence.text}</span>
                    <span className="text-xs text-graphite">{i.info.state}</span>
                  </button>
                </li>
              )
            })}
            {list.length === 0 && <li className="px-4 py-6 text-sm text-graphite">Nothing to show.</li>}
          </ul>
        </aside>

        <div className="flex flex-col gap-5 p-6">
          {done && (
            <p role="status" className="rounded-sm border border-positive-line bg-positive-bg px-3 py-2 text-sm text-positive-fg" data-testid="all-approved">
              Every sentence is approved and cited. The report is ready to publish.
            </p>
          )}
          {!info ? (
            <p className="text-sm text-graphite">There are no sentences in the report yet.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-graphite">
                  {item.group} · sentence {idx + 1} of {list.length}
                </p>
                <p className="max-w-prose text-lg leading-snug text-ink" data-testid="review-sentence">
                  <NumberText text={info.sentence.text} />
                </p>
                <div>
                  <StateChip state={info.state} />
                </div>
                {info.approval && (
                  <p className="text-xs text-graphite">
                    Approved by {info.approval.by} for report version {info.approval.version}.
                  </p>
                )}
              </div>

              {info.numbersChanged && (
                <div className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2.5 text-sm" data-testid="review-update">
                  <p className="font-medium text-ink">Suggested update: the numbers changed in the codebook</p>
                  <p className="mt-1 leading-snug text-ink">
                    <DiffText before={info.sentence.text} after={info.live} />
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" className={MINI_ON} data-testid="review-apply-update" onClick={() => act.applyUpdate(item.target, info.sentence.id, info.live)}>
                      Update the numbers
                    </button>
                    <button type="button" className={MINI} onClick={() => setAsking('keep')}>
                      Keep as written…
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2" data-testid="review-actions">
                {info.state === 'To review' && (
                  <Button variant="primary" onClick={() => approve()} data-testid="review-approve">
                    Approve
                  </Button>
                )}
                {info.state === 'No citation' && (
                  <Button variant="primary" onClick={() => setAsking('reason')} data-testid="review-approve-reason">
                    Approve with a reason…
                  </Button>
                )}
                {(info.state === 'Approved' || info.state === 'Approved without citation') && <Button onClick={() => act.withdraw(info.sentence.id)}>Withdraw approval</Button>}
                <Button
                  onClick={() => {
                    goTo({ kind: 'sentence', id: info.sentence.id })
                    onClose()
                  }}
                >
                  Edit in the report
                </Button>
                <Button variant="ghost" onClick={() => move(idx + 1)} disabled={idx >= list.length - 1}>
                  Next
                </Button>
              </div>

              {asking && (
                <div className="flex flex-wrap items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2" data-testid="reason-field">
                  <input value={why} onChange={(e) => setWhy(e.target.value)} aria-label={asking === 'reason' ? 'Why approve without a citation' : 'Why keep the wording'} placeholder={asking === 'reason' ? 'Why does this need no citation?' : 'Why keep the old numbers?'} autoFocus className="min-w-48 flex-1 rounded-sm border border-mist bg-surface px-2 py-1 text-sm text-ink" />
                  <button type="button" className={MINI_ON} disabled={!why.trim()} onClick={() => (asking === 'reason' ? approve({ reason: why.trim() }) : approve({ keptNumbers: { why: why.trim(), live: info.live } }))}>
                    {asking === 'reason' ? 'Approve' : 'Keep and approve'}
                  </button>
                  <button type="button" className={MINI} onClick={() => setAsking(null)}>
                    Cancel
                  </button>
                </div>
              )}

              <div>
                <p className={LABEL}>Built on</p>
                {info.cites.length === 0 ? (
                  <p className="mt-1 text-sm text-negative-fg">No citation. Add one in the report, or approve with a reason.</p>
                ) : (
                  <ul className="mt-2 flex max-w-2xl flex-col gap-4">
                    {info.cites.map(({ cit, resolved }) => (
                      <CitationBlock key={`${cit.kind}:${cit.id}`} r={resolved} label={cit.kind} />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Studio>
  )
}
