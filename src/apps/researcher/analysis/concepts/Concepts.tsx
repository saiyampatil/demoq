// A2, the Concepts tab: one row per concept, and the one panel beside it. It answers one question: did what people said, what they did, and
// what their first reaction showed point the same way?
// The table speaks the Themes table's language (name with its line under it, fixed number columns, a verdict-like Match, a Status, an outlined
// Accept on hover). The three measures are plain "n of N", the highest in each column bold. No bars, no colour scale.

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { useToast } from '@/components/Toast'
import { CONCEPTS } from '@/config/concepts'
import { acceptInsight, editInsight, leaveOutInsight, setInsightNote, undoInsight } from '@/state/codebook'
import type { Tension } from '@/state/signals'
import type { ConceptRow, conceptRows } from '@/state/concepts'
import type { CodebookCtx } from '../codebookCtx'
import { InsightStatusChip } from '../themes/Bits'
import type { Intent } from '../themes/Panels'
import { MEASURE_WORDS, MatchChip, MeasureCell, conceptNote } from './Bits'
import { ConceptPanel } from './ConceptPanel'

type Model = NonNullable<ReturnType<typeof conceptRows>>

const WITH_DID = 'grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5.5rem_6.5rem_8.25rem] items-start gap-x-3'
const NO_DID = 'grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_6.5rem_8.25rem] items-start gap-x-3'

const ref = (r: ConceptRow) => ({ id: r.key, name: `Concept ${r.name}` })

export function ConceptsTab({
  ctx,
  model,
  selected,
  setSelected,
  tensions,
  onOpenTension,
}: {
  ctx: CodebookCtx
  model: Model
  selected?: string
  setSelected: (id: string | undefined) => void
  tensions: Tension[]
  onOpenTension: (id: string) => void
}) {
  const { doc, me } = ctx
  const toast = useToast()
  const { rows, input, defs, hasChoiceTask, coverage } = model
  const [intent, setIntent] = useState<Intent>()
  const root = useRef<HTMLDivElement>(null)
  const GRID = hasChoiceTask ? WITH_DID : NO_DID
  const cur = rows.find((r) => r.id === selected)
  const greyed = rows.some((r) => r.showed.greyed)

  // The highest share in each column, so ties are both bold. Ranks come from the logic, not from here.
  const accept = (r: ConceptRow) => {
    if (!r.line) return
    const prev = doc.insights?.[r.key]
    ctx.act((d) => acceptInsight(d, ref(r), r.now, { by: me }))
    toast(`Accepted the line for “${r.name}”`, { label: 'Undo', onClick: () => ctx.act((d) => undoInsight(d, ref(r), prev, { by: me })) })
  }
  const edit = (r: ConceptRow, text: string) => {
    ctx.act((d) => editInsight(d, ref(r), r.now, text, { by: me }))
    toast(`Saved your wording for “${r.name}”`)
  }
  const leaveOut = (r: ConceptRow, why: string) => {
    const prev = doc.insights?.[r.key]
    ctx.act((d) => leaveOutInsight(d, ref(r), r.now, { by: me }, why))
    toast(`Left out “${r.name}”`, { label: 'Undo', onClick: () => ctx.act((d) => undoInsight(d, ref(r), prev, { by: me })) })
  }

  const ids = useMemo(() => rows.map((r) => `c:${r.id}`), [rows])
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return
    const row = t.closest<HTMLElement>('[data-row]')
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!row) return
      e.preventDefault()
      const next = ids[Math.min(ids.length - 1, Math.max(0, ids.indexOf(row.dataset.row ?? '') + (e.key === 'ArrowDown' ? 1 : -1)))]
      root.current?.querySelector<HTMLElement>(`[data-row="${next}"] [data-row-main]`)?.focus()
      return
    }
    const k = e.key.toLowerCase()
    if (k !== 'a' && k !== 'e' && k !== 'l') return
    const id = row?.dataset.concept ?? selected
    const r = rows.find((x) => x.id === id)
    if (!r) return
    e.preventDefault()
    setSelected(r.id)
    if (k === 'a') { if (r.decision.status !== 'Accepted' && r.decision.status !== 'Edited') accept(r) }
    else setIntent({ theme: r.key, kind: k === 'e' ? 'edit' : 'leave', n: Date.now() })
  }

  const hidden = [
    !hasChoiceTask && 'Did isn’t shown: this study had no choice task.',
    greyed && `Showed is greyed: it needs at least ${CONCEPTS.showedMinVideo} people on video.`,
  ].filter(Boolean)

  return (
    <div ref={root} onKeyDown={onKeyDown} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Concepts" data-testid="concepts-table" className="min-w-0 overflow-x-clip rounded-md border border-mist bg-surface">
        <div className="min-w-[40rem]">
          <div className={cn(GRID, 'sticky top-14 z-10 border-b border-mist bg-haze py-2 pr-3 pl-3 text-xs font-medium text-graphite')} data-testid="concept-head">
            <span className="pl-9">Concept</span>
            <span className="text-right" title={MEASURE_WORDS.said.tip}>Said</span>
            {hasChoiceTask && <span className="text-right" title={MEASURE_WORDS.did.tip}>Did</span>}
            <span className={cn('text-right', greyed && 'text-muted')} title={MEASURE_WORDS.showed.tip}>Showed</span>
            <span>Match</span>
            <span>Status</span>
          </div>
          <div className="pt-1">
            {rows.map((r) => {
              const on = selected === r.id
              const def = defs.find((d) => d.id === r.id)!
              const status = r.decision.status
              const canAccept = !!r.line && (status === 'Suggested' || status === 'Out of date' || status === 'Left out')
              const line = (status === 'Accepted' || status === 'Edited') && doc.insights?.[r.key] ? doc.insights[r.key].text : r.line ?? conceptNote(r, defs, doc)
              const why = !r.said ? 'Accept this concept’s code in the codebook to read what people said.' : undefined
              return (
                <div key={r.id} data-row={`c:${r.id}`} data-concept={r.id} data-testid="concept-row" data-selected={on ? 'true' : undefined} className={cn(GRID, 'group relative min-h-[4.5rem] border-b border-mist border-l-2 py-3 pr-3 pl-3 last:border-b-0', on ? 'border-l-iris-600 bg-iris-50' : 'border-l-transparent hover:bg-haze')}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden="true" className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-xs border border-mist-strong text-xs font-semibold text-graphite">{def.letter}</span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] leading-5 font-semibold">
                        <button type="button" data-row-main onClick={() => setSelected(r.id)} aria-current={on ? 'true' : undefined} data-testid="concept-name" className="cursor-pointer rounded-xs text-left underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline">{r.name}</button>
                      </h3>
                      <p className={cn('mt-0.5 text-xs leading-4', r.line ? 'text-graphite' : 'text-muted')} data-testid="concept-line">{line}</p>
                    </div>
                  </div>
                  <MeasureCell kind="said" m={r.said} lead={r.leads.said} why={why} />
                  {hasChoiceTask && <MeasureCell kind="did" m={r.did} lead={r.leads.did} />}
                  <MeasureCell kind="showed" m={r.showed} lead={r.leads.showed} grey={r.showed.greyed} />
                  <span className="relative z-10 -my-3 flex min-h-11 items-center"><MatchChip match={r.match} /></span>
                  <span className="relative z-10 -my-3 flex min-h-11 items-center" data-testid="status-cell"><InsightStatusChip status={status} /></span>
                  {canAccept && (
                    <Button size="sm" variant="secondary" className="absolute right-3 bottom-2.5 z-10 w-[8.25rem] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none" onClick={() => { setSelected(r.id); accept(r) }} data-testid="row-accept" aria-label={`Accept the line for ${r.name}`}>Accept</Button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="border-t border-mist px-3 py-2 text-xs text-graphite" data-testid="concepts-note">
            Said: {MEASURE_WORDS.said.short}. {hasChoiceTask && <>Did: {MEASURE_WORDS.did.short}. </>}Showed: {MEASURE_WORDS.showed.short}. Each is “n of N people” for the people who saw that concept. {hidden.join(' ')}
          </p>
        </div>
      </section>

      <div className="lg:sticky lg:top-20">
        {cur ? (
          <ConceptPanel key={cur.id} row={cur} def={defs.find((d) => d.id === cur.id)!} input={input} defs={defs} ctx={ctx} tensions={tensions} intent={intent} onAccept={() => accept(cur)} onEdit={(t) => edit(cur, t)} onLeaveOut={(w) => leaveOut(cur, w)} onNote={(t) => ctx.act((d) => setInsightNote(d, ref(cur), t, { by: me }))} onOpenTension={onOpenTension} />
        ) : (
          <div className="rounded-md border border-dashed border-mist-strong bg-surface px-5 py-8 text-center" data-testid="panel-empty">
            <p className="text-sm font-medium">Pick a concept</p>
            <p className="mt-1 text-xs text-graphite">See what people said, did and showed, and the first reactions behind it. {coverage.read} of {coverage.people} people had a first reaction read.</p>
          </div>
        )}
      </div>
    </div>
  )
}
