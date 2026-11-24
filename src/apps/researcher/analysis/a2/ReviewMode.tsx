// A2 Review mode: one insight at a time, full screen. The queue is the theme insights, then the concept lines, in table order; items with under
// three people ("Nothing to decide") are not in it, and neither are tensions. Accept and next · Edit wording · Leave out · Skip for now.
// A skipped item comes back at the end with a "Skipped" tag and counts as still to decide. Every decision goes through the same store as the
// tables (who, when, the fingerprint of the data), so Review mode and the tables always agree. Keys: A accept and next, E edit, L leave out,
// right arrow skip, left arrow previous, Esc exit.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { PlayIcon } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { FIT_LABEL, FIT_ORDER } from '@/config/delivery'
import { acceptInsight, editInsight, leaveOutInsight, setInsightNote, undoInsight } from '@/state/codebook'
import { checkConceptLine, clipsOf, type ConceptRow } from '@/state/concepts'
import { plural, segmentLabelOf, sideSummary, type Tension, type ThemeSignal } from '@/state/signals'
import { checkInsightEdit } from '@/state/speech'
import type { ConceptDef } from '@/mock/concepts'
import { mmss } from '../../review/reviewUi'
import type { CodebookCtx } from '../codebookCtx'
import { FitChip, OneFitChip, playHref } from '../SignalBits'
import { MatchChip, MEASURE_WORDS, rankDetail } from '../concepts/Bits'
import { InsightStatusChip } from '../themes/Bits'
import { approvalFor, tensionsOn } from '../themes/Panels'
import { ConceptLetter, FaceChip, FaceNotRight, PersonBar, RespondentQuote, type BarPerson } from './ui'
import type { ThemeModel } from '../themes/model'
import type { conceptRows } from '@/state/concepts'

type Concepts = NonNullable<ReturnType<typeof conceptRows>>
type Item = { key: string; kind: 'theme'; theme: ThemeSignal } | { key: string; kind: 'concept'; row: ConceptRow; def: ConceptDef }

const DECIDED = ['Accepted', 'Edited', 'Left out']
const statusOf = (i: Item) => (i.kind === 'theme' ? i.theme.decision.status : i.row.decision.status)
const undecided = (i: Item) => !DECIDED.includes(statusOf(i))
const nameOf = (i: Item) => (i.kind === 'theme' ? i.theme.name : `Concept ${i.def.letter}: ${i.row.name}`)
const figures = (s: string) => s.match(/\d+ of \d+/g) ?? []

export function ReviewMode({
  ctx,
  model,
  concepts,
  tensions,
  onExit,
  onTensions,
  onContinue,
  onOpenTension,
}: {
  ctx: CodebookCtx
  model: ThemeModel
  concepts?: Concepts
  tensions: Tension[]
  onExit: () => void
  onTensions: () => void
  onContinue: () => void
  onOpenTension: (id: string) => void
}) {
  const { doc, me } = ctx
  const toast = useToast()
  const items: Item[] = useMemo(
    () => [
      ...model.profiles.filter((p) => p.kind === 'theme' && p.decidable).map((p): Item => ({ key: p.id, kind: 'theme', theme: p })),
      ...(concepts?.rows.filter((r) => r.line).map((r): Item => ({ key: r.key, kind: 'concept', row: r, def: concepts.defs.find((d) => d.id === r.id)! })) ?? []),
    ],
    [model, concepts],
  )
  const first = Math.max(0, items.findIndex(undecided))
  const [index, setIndex] = useState(first)
  const [skipped, setSkipped] = useState<string[]>([])
  const [summary, setSummary] = useState(items.every((i) => !undecided(i)) && items.length > 0)
  const [mode, setMode] = useState<'view' | 'edit' | 'leave'>('view')
  const [text, setText] = useState('')
  const [why, setWhy] = useState('')
  const [who, setWho] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const item = items[Math.min(index, items.length - 1)]
  const left = items.filter(undecided).length
  const wasSkipped = !!item && skipped.includes(item.key) && undecided(item)

  useEffect(() => { root.current?.focus() }, [])
  useEffect(() => { setMode('view'); setWho(null) }, [index, summary])

  /** The next item to decide after `from`: ones not skipped first, then the skipped ones (in queue order), then the summary. */
  const target = (from: number, skippedNow: string[]) => {
    const rest = (pred: (i: Item) => boolean, start: number) => items.findIndex((x, i) => i >= start && undecided(x) && pred(x))
    const a = rest((x) => !skippedNow.includes(x.key), from + 1)
    if (a >= 0) return a
    const b = rest((x) => skippedNow.includes(x.key), 0)
    return b >= 0 && b !== from ? b : b === from ? -2 : -1
  }
  const advance = (from: number, skippedNow = skipped) => {
    const t = target(from, skippedNow)
    if (t >= 0) setIndex(t)
    else setSummary(true)
  }

  // ── decisions, through the same store as the tables ──
  const refOf = (i: Item) => (i.kind === 'theme' ? { id: i.theme.id, name: i.theme.name } : { id: i.row.key, name: `Concept ${i.row.name}` })
  const nowOf = (i: Item) => (i.kind === 'theme' ? i.theme.now : i.row.now)
  const computed = (i: Item) => (i.kind === 'theme' ? i.theme.insight?.sentence ?? '' : i.row.line ?? '')
  const decide = (kind: 'accept' | 'leave', i: Item, reason?: string) => {
    const prev = doc.insights?.[refOf(i).id]
    ctx.act((d) => (kind === 'accept' ? acceptInsight(d, refOf(i), nowOf(i), { by: me }) : leaveOutInsight(d, refOf(i), nowOf(i), { by: me }, reason)))
    toast(`${kind === 'accept' ? 'Accepted' : 'Left out'} “${nameOf(i)}”`, { label: 'Undo', onClick: () => ctx.act((d) => undoInsight(d, refOf(i), prev, { by: me })) })
  }
  const accept = () => { if (!item) return; decide('accept', item); setSkipped((s) => s.filter((k) => k !== item.key)); advance(index, skipped.filter((k) => k !== item.key)) }
  const leaveOut = () => { if (!item) return; decide('leave', item, why); setSkipped((s) => s.filter((k) => k !== item.key)); setMode('view'); advance(index, skipped.filter((k) => k !== item.key)) }
  const skip = () => { if (!item) return; const next = skipped.includes(item.key) ? skipped : [...skipped, item.key]; setSkipped(next); advance(index, next) }
  const previous = () => { setSummary(false); setIndex((i) => Math.max(0, (summary ? items.length : i) - 1)) }
  const startEdit = () => { if (!item) return; setText(item.kind === 'theme' && item.theme.decision.status !== 'Out of date' && doc.insights?.[item.key]?.text ? doc.insights[item.key].text : (item.kind === 'concept' && doc.insights?.[item.key]?.text && item.row.decision.status !== 'Out of date' ? doc.insights[item.key].text : computed(item))); setMode('edit') }
  const problems = (() => {
    if (mode !== 'edit' || !item) return []
    const c = computed(item)
    if (item.kind === 'theme') return checkInsightEdit(text, c)
    return [...checkInsightEdit(text, c, { figuresAllowed: 2, maxWords: 30 }), ...(checkConceptLine(text).ok ? [] : checkConceptLine(text).problems)].filter((p, i, a) => a.indexOf(p) === i)
  })()
  const saveEdit = () => {
    if (!item || problems.length) return
    ctx.act((d) => editInsight(d, refOf(item), nowOf(item), text.trim(), { by: me }))
    toast(`Saved your wording for “${nameOf(item)}”`)
    setSkipped((s) => s.filter((k) => k !== item.key))
    setMode('view')
    advance(index, skipped.filter((k) => k !== item.key))
  }

  // ── keys ──
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (e.key === 'Escape') { e.preventDefault(); if (mode !== 'view') setMode('view'); else onExit(); return }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey || summary || !item) return
    const k = e.key.toLowerCase()
    if (k === 'a') { e.preventDefault(); if (nowOf(item).text && item) accept() }
    else if (k === 'e') { e.preventDefault(); startEdit() }
    else if (k === 'l') { e.preventDefault(); setWhy(''); setMode('leave') }
    else if (e.key === 'ArrowRight') { e.preventDefault(); skip() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); previous() }
  }

  const accepted = items.filter((i) => statusOf(i) === 'Accepted').length
  const edited = items.filter((i) => statusOf(i) === 'Edited').length
  const leftOut = items.filter((i) => statusOf(i) === 'Left out').length
  const stillSkipped = items.filter((i) => skipped.includes(i.key) && undecided(i)).length
  const reportThemes = items.filter((i) => i.kind === 'theme' && ['Accepted', 'Edited'].includes(statusOf(i))).length
  const reportConcepts = items.filter((i) => i.kind === 'concept' && ['Accepted', 'Edited'].includes(statusOf(i))).length
  const tensionThemes = doc.themes.filter((t) => t.tensionId).length
  const toReviewTensions = tensions.filter((t) => t.status === 'Suggested' && !t.unavailable).length

  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Review insights" onKeyDown={onKeyDown} data-testid="review-mode" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper outline-none">
      <header className="shrink-0 border-b border-mist bg-surface">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-6 text-xs text-graphite">
          <span>Studies / <span className="font-medium text-ink">{doc.studyId === 'ice-cream-flavours' ? 'Ice Cream Flavour Concept Test · Scoop & Co' : 'Pet Food Subscription Churn'}</span></span>
          <button type="button" onClick={onExit} data-testid="exit-review" className="min-h-9 cursor-pointer rounded-xs px-2 font-medium text-ink hover:bg-haze">Exit review ✕</button>
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-6 pb-3">
          <h1 className="text-md font-semibold">Emotion & behaviour</h1>
          <span className="inline-flex h-6 items-center rounded-full border border-iris-100 bg-iris-50 px-2.5 text-xs font-medium text-iris-700 tabular-nums" data-testid="review-position">
            {summary ? 'All done' : `Reviewing insights · ${index + 1} of ${items.length}`}
          </span>
          <div className="ml-auto flex items-center gap-1.5" role="list" aria-label="Insights in this review" data-testid="review-progress">
            {items.map((i, n) => {
              const decided = !undecided(i)
              const current = !summary && n === index
              return (
                <button key={i.key} type="button" role="listitem" onClick={() => { setSummary(false); setIndex(n) }} title={`${n + 1}. ${nameOf(i)} (${statusOf(i)}${skipped.includes(i.key) && undecided(i) ? ', skipped' : ''})`} aria-current={current ? 'step' : undefined} data-testid="review-block" data-state={decided ? 'decided' : skipped.includes(i.key) ? 'skipped' : 'open'} className="group flex min-h-9 w-11 cursor-pointer items-center">
                  <span className={cn('h-2 w-full rounded-full transition-colors', decided ? 'bg-ink' : skipped.includes(i.key) ? 'bg-pending-line' : 'bg-mist-strong', current && 'bg-iris-600 ring-2 ring-iris-100')} />
                </button>
              )
            })}
            <span className="ml-2 text-xs text-graphite tabular-nums" data-testid="review-undecided">{left} undecided</span>
          </div>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {!summary && item && (
          <>
            <button type="button" onClick={previous} disabled={index === 0} aria-label="Previous insight" className="fixed top-1/2 left-4 hidden size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-mist bg-surface shadow-raised hover:bg-haze disabled:opacity-40 xl:flex">‹</button>
            <button type="button" onClick={skip} aria-label="Skip for now" className="fixed top-1/2 right-4 hidden size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-mist bg-surface shadow-raised hover:bg-haze xl:flex">›</button>
            <div key={item.key} className="a2-slide mx-auto my-6 flex w-full max-w-[900px] flex-col gap-5 rounded-md border border-mist bg-surface p-8" data-testid="review-card" data-item={item.key}>
              {item.kind === 'theme' ? <ThemeCard t={item.theme} ctx={ctx} tensions={tensions} who={who} setWho={setWho} onOpenTension={onOpenTension} skipped={wasSkipped} mode={mode} text={text} setText={setText} problems={problems} /> : <ConceptCard row={item.row} def={item.def} input={concepts!.input} defs={concepts!.defs} ctx={ctx} tensions={tensions} onOpenTension={onOpenTension} skipped={wasSkipped} mode={mode} text={text} setText={setText} problems={problems} />}
              <NoteField ctx={ctx} item={item} />
            </div>
          </>
        )}
        {summary && (
          <div className="a2-slide mx-auto my-10 flex w-full max-w-[640px] flex-col gap-5 rounded-md border border-mist bg-surface p-8" data-testid="review-summary">
            <div>
              <h2 className="text-lg font-semibold">{left === 0 ? 'All insights decided' : `${plural(left, 'insight')} still to decide`}</h2>
              <p className="mt-1 text-sm text-graphite">You have been through all {items.length} items in the queue. {left === 0 ? 'You can now review the tensions or go on to the report.' : 'The skipped ones are still undecided: go back to them, or carry on.'}</p>
            </div>
            <dl className="grid grid-cols-4 gap-2" data-testid="summary-counts">
              {([['Accepted', accepted], ['Edited', edited], ['Left out', leftOut], ['Skipped', stillSkipped]] as const).map(([l, n]) => (
                <div key={l} className="rounded-sm border border-mist px-3 py-2"><dd className="text-[24px] leading-none font-semibold tabular-nums">{n}</dd><dt className="mt-1 text-xs text-graphite">{l}</dt></div>
              ))}
            </dl>
            <p className="text-sm" data-testid="summary-report">Goes to the report: {plural(reportThemes, 'theme insight')}, {plural(reportConcepts, 'concept line')} and {plural(tensionThemes, 'tension theme')} · {plural(toReviewTensions, 'tension')} still to review.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={onExit} data-testid="back-to-table">← Back to table</Button>
              <span className="flex-1" />
              {left > 0 && <Button onClick={() => { setSummary(false); setIndex(Math.max(0, items.findIndex(undecided))) }}>Review the {left} left</Button>}
              {toReviewTensions > 0 && <Button onClick={() => { onExit(); onTensions() }} data-testid="review-tensions">Review {plural(toReviewTensions, 'tension')}</Button>}
              <Button variant="primary" onClick={onContinue} data-testid="continue-report">Continue to Report →</Button>
            </div>
          </div>
        )}
      </main>

      {!summary && item && (
        <footer className="shrink-0 border-t border-mist bg-surface">
          <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-2 px-4 py-3">
            <p className="text-sm text-graphite" data-testid="still-to-decide"><span className="font-semibold text-ink tabular-nums">{left}</span> still to decide in queue</p>
            <span className="flex-1" />
            {mode === 'leave' ? (
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2" data-testid="leave-form">
                <TextArea aria-label="Reason for leaving it out" rows={1} value={why} onChange={(e) => setWhy(e.target.value)} hint="A reason is optional." autoFocus data-testid="leave-why" className="min-w-64" />
                <Button onClick={() => setMode('view')}>Cancel</Button>
                <Button variant="primary" onClick={leaveOut} data-testid="leave-confirm">Leave out</Button>
              </div>
            ) : mode === 'edit' ? (
              <>
                <Button onClick={() => setMode('view')}>Cancel</Button>
                <Button variant="primary" disabled={problems.length > 0} onClick={saveEdit} data-testid="insight-save">Save wording</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setWhy(''); setMode('leave') }} data-testid="leave-out">Leave out</Button>
                <Button onClick={startEdit} data-testid="edit">Edit wording</Button>
                <Button variant="ghost" onClick={skip} data-testid="skip">Skip for now</Button>
                <Button variant="primary" onClick={accept} disabled={!nowOf(item).text} data-testid="accept">{statusOf(item) === 'Out of date' ? 'Re-accept and next' : DECIDED.includes(statusOf(item)) ? 'Accept again and next' : 'Accept and next'}</Button>
              </>
            )}
          </div>
          <p className="mx-auto flex max-w-[900px] flex-wrap justify-center gap-x-4 gap-y-1 border-t border-mist px-4 py-1.5 text-xs text-graphite" data-testid="shortcuts">
            {[['A', 'Accept & next'], ['E', 'Edit'], ['L', 'Leave out'], ['→', 'Skip'], ['←', 'Previous'], ['Esc', 'Exit review']].map(([k, l]) => (
              <span key={k}><kbd className="rounded-xs border border-mist-strong bg-haze px-1.5 font-sans">{k}</kbd> {l}</span>
            ))}
          </p>
        </footer>
      )}
    </div>
  )
}

function NoteField({ ctx, item }: { ctx: CodebookCtx; item: Item }) {
  const id = item.kind === 'theme' ? item.theme.id : item.row.key
  const [note, setNote] = useState(ctx.doc.insightNotes?.[id] ?? '')
  useEffect(() => setNote(ctx.doc.insightNotes?.[id] ?? ''), [id]) // eslint-disable-line react-hooks/exhaustive-deps
  return <TextArea label="Your note (kept separate from the insight line)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => ctx.act((d) => setInsightNote(d, { id, name: nameOf(item) }, note, { by: ctx.me }))} hint="Optional. It is never part of the sentence." />
}

/** The insight, its status, and (when it is Out of date) what was decided beside what the data says now. */
function Insight({ id, ctx, ai, status, was, now, edit }: { id: string; ctx: CodebookCtx; ai: string; status: string; was?: string; now?: string; edit?: React.ReactNode }) {
  const d = ctx.doc.insights?.[id]
  const shown = (status === 'Accepted' || status === 'Edited') && d ? d.text : ai
  if (edit) return <>{edit}</>
  if (status === 'Out of date')
    return (
      <div className="flex flex-col gap-3" data-testid="out-of-date">
        <p className="rounded-sm bg-pending-bg px-3 py-2 text-sm text-pending-fg">The underlying study data changed after this insight was decided.</p>
        {was === now ? (
          <p className="text-sm text-graphite" data-testid="was">A tension was added that affects this. The wording is the same: look again, then re-accept it.</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 rounded-sm border border-mist p-4"><p className="text-xs font-semibold text-graphite">Previous accepted wording</p><p className="text-[18px] leading-snug font-medium" data-testid="was">{was}</p><p className="text-xs text-graphite">{d ? `Accepted by ${d.by} · data v${d.dataVersion}` : ''}</p></div>
          <div className="ai-surface flex flex-col gap-1.5 p-4"><p className="text-xs font-semibold text-iris-700">Updated data</p><p className="text-[18px] leading-snug font-medium" data-testid="now">{now}</p></div>
        </div>
      </div>
    )
  return (
    <div className="ai-surface flex flex-col gap-2 p-5" data-testid="review-insight">
      <div className="flex items-center justify-between"><AIGeneratedTag /><span className="text-xs text-graphite">PulseAI Qual</span></div>
      <p className="text-[24px] leading-snug font-semibold text-ink" data-testid="summary-sentence">“{shown}”</p>
      {status === 'Edited' && d && <p className="text-xs text-graphite">PulseAI wrote: {d.original}</p>}
    </div>
  )
}

function EditBox({ text, setText, ai, problems }: { text: string; setText: (t: string) => void; ai: string; problems: string[] }) {
  return (
    <div className="flex flex-col gap-2" data-testid="insight-edit">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-graphite">Numbers locked: {figures(ai).map((f) => <span key={f} className="rounded-xs border border-mist-strong bg-haze px-1.5 py-0.5 font-medium text-ink tabular-nums" data-testid="locked-figure">{f}</span>)}</p>
      <TextArea label="Edit insight statement" rows={3} value={text} onChange={(e) => setText(e.target.value)} data-testid="insight-text" hint="You can change the wording. Numbers can’t be edited." />
      {problems.length > 0 && <ul className="flex flex-col gap-0.5 text-xs text-negative-fg" data-testid="insight-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
    </div>
  )
}

function Chips({ children, skipped }: { children: React.ReactNode; skipped: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-mist pb-3">
      {children}
      {skipped && <span className="inline-flex h-5 items-center rounded-full border border-pending-line bg-pending-bg px-2 text-xs font-medium text-pending-fg" data-testid="skipped-tag">Skipped</span>}
    </div>
  )
}

function ThemeCard({ t, ctx, tensions, who, setWho, onOpenTension, skipped, mode, text, setText, problems }: { t: ThemeSignal; ctx: CodebookCtx; tensions: Tension[]; who: string | null; setWho: (s: string | null) => void; onOpenTension: (id: string) => void; skipped: boolean; mode: string; text: string; setText: (t: string) => void; problems: string[] }) {
  const sum = sideSummary(t.reads)
  const mine = tensionsOn(tensions, new Set(t.codes.map((c) => c.code.id)))
  const check = t.codes.filter((c) => c.fit.pattern === 'Mixed' || c.fit.pattern === 'Conflicting')
  const status = t.decision.status
  const ai = t.insight?.sentence ?? ''
  const tone = (f: string): BarPerson['tone'] => (f === 'Matches' ? 'good' : f === 'Pulls against' ? 'warn' : 'quiet')
  return (
    <>
      <Chips skipped={skipped}>
        <span className="text-xs font-semibold tracking-wide text-graphite uppercase">Theme</span>
        <FitChip pattern={t.verdict} />
        <InsightStatusChip status={status} />
        <span className="ml-auto text-xs text-graphite tabular-nums">Said by {t.people} of {t.of} people</span>
      </Chips>
      <h2 className="text-lg font-semibold" data-testid="review-name">{t.name}</h2>
      <Insight id={t.id} ctx={ctx} ai={ai} status={status} was={t.decision.was?.text} now={t.decision.now?.text} edit={mode === 'edit' ? <EditBox text={text} setText={setText} ai={ai} problems={problems} /> : undefined} />
      <section className="flex flex-col gap-3" aria-label="Did their delivery match their words?">
        <div className="flex items-baseline justify-between"><h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Did their delivery match their words?</h3><span className="text-xs text-graphite">{[sum.described.length ? `${sum.described.length} just described it` : '', t.codes.length ? '' : ''].filter(Boolean).join(' · ')}</span></div>
        {sum.groups.map((g) => (
          <div key={g.side} className="flex flex-col gap-2 rounded-sm border border-mist p-4" data-testid="review-group">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{g.side === 'Positive' ? 'Spoke in favour' : 'Spoke against it'} · {g.points.length} {g.points.length === 1 ? 'person' : 'people'}</p>
              <button type="button" onClick={() => setWho(who === g.side ? null : g.side)} aria-expanded={who === g.side} className="min-h-9 cursor-pointer rounded-xs text-xs font-medium text-iris-700 hover:underline">Show who ›</button>
            </div>
            <PersonBar people={[...g.reads].sort((x, y) => FIT_ORDER.indexOf(x.fit as 'Matches') - FIT_ORDER.indexOf(y.fit as 'Matches')).map((r) => ({ id: r.participantId, tone: tone(r.fit as string), word: r.fit === 'Uncertain' ? 'Hesitated' : r.tone }))} label={`${g.points.length} people: ${FIT_ORDER.map((k) => `${g.tiles[k].length} ${FIT_LABEL[k]}`).join(', ')}`} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite">
              {FIT_ORDER.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 tabular-nums"><span aria-hidden="true" className={cn('size-2 rounded-full', { Matches: 'bg-positive-fg', 'Pulls against': 'bg-pending-fg', Uncertain: 'bg-tone-flat' }[k])} />{g.tiles[k].length} {FIT_LABEL[k]}</span>
              ))}
            </p>
            {who === g.side && (
              <ul className="divide-y divide-mist rounded-sm border border-mist text-xs" data-testid="review-who">
                {g.reads.map((r) => (
                  <li key={r.participantId} className="flex flex-wrap items-center gap-2 px-3 py-1.5"><span className="font-medium tabular-nums">{r.participantId}</span><span className="text-graphite">{segmentLabelOf(r.participantId)}</span><OneFitChip fit={r.fit as 'Matches'} against={[]} /><span className="text-graphite">{r.fit === 'Uncertain' ? 'Hesitated' : r.tone}</span></li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2" aria-label="Moments to watch">
        <div className="flex items-baseline justify-between"><h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Moments to watch (clearest first)</h3><span className="text-xs text-graphite">{t.moments.length} moments recorded</span></div>
        <ul className="flex flex-col gap-2.5">
          {t.moments.slice(0, 3).map((m) => {
            const read = t.reads.find((r) => r.participantId === m.participantId)
            return (
              <li key={m.participantId} className="flex flex-col gap-1.5 rounded-sm border border-mist p-4" data-testid="review-moment">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-graphite">
                  <Link to={playHref(ctx.studyId, m.sessionId, m.atSec)} aria-label={`Play ${m.participantId}`} className="inline-flex size-9 items-center justify-center rounded-full border border-mist-strong text-ink hover:bg-haze"><PlayIcon size={12} /></Link>
                  <span className="font-semibold text-ink tabular-nums">{m.participantId}</span><span>{segmentLabelOf(m.participantId)}</span><span className="tabular-nums">{mmss(m.atSec)}</span>
                  {read?.fit && read.fit !== 'Split' && <span className="ml-auto"><OneFitChip fit={read.fit} against={[]} /></span>}
                </div>
                {m.quote && <RespondentQuote>{m.quote}</RespondentQuote>}
                {m.reason && <p className="text-xs text-graphite">{m.reason}</p>}
              </li>
            )
          })}
        </ul>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="flex flex-col gap-1.5 rounded-sm border border-mist p-4" data-testid="review-tensions"><h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Tension on this theme</h3>
          {mine.length ? mine.map((x) => <button key={x.id} type="button" onClick={() => onOpenTension(x.id)} className="min-h-9 cursor-pointer rounded-xs text-left text-sm text-iris-700 hover:underline">{x.title} ›</button>) : <p className="text-sm text-graphite">No tensions on this.</p>}
        </section>
        <section className="flex flex-col gap-1.5 rounded-sm border border-mist p-4"><h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Codes to check</h3>
          {check.length ? check.map((c) => <FitChip key={c.code.id} pattern={c.fit.pattern} label={c.code.name} />) : <p className="text-sm text-graphite">None. No code is Mixed or Gap.</p>}
        </section>
      </div>
      <p className="text-xs text-graphite" data-testid="review-approval">{approvalFor(t.id, status, ctx.doc)}</p>
    </>
  )
}

function ConceptCard({ row, def, input, defs, ctx, tensions, onOpenTension, skipped, mode, text, setText, problems }: { row: ConceptRow; def: ConceptDef; input: Concepts['input']; defs: ConceptDef[]; ctx: CodebookCtx; tensions: Tension[]; onOpenTension: (id: string) => void; skipped: boolean; mode: string; text: string; setText: (t: string) => void; problems: string[] }) {
  const status = row.decision.status
  const ai = row.line ?? ''
  const { clips } = clipsOf(input, row.id, 2)
  const mine = tensionsOf2(tensions, def, row)
  const tiles = (['said', 'did', 'showed'] as const).flatMap((k) => (row[k] ? [{ k, m: row[k]! }] : []))
  const sawN = input.people.filter((p) => p.saw.includes(row.id)).length
  return (
    <>
      <Chips skipped={skipped}>
        <span className="text-xs font-semibold tracking-wide text-graphite uppercase">Concept</span>
        <MatchChip match={row.match} detail={rankDetail(row)} />
        <InsightStatusChip status={status} />
        <span className="ml-auto text-xs text-graphite tabular-nums">Seen by {row.saw} of {input.people.length} people</span>
      </Chips>
      <h2 className="flex items-center gap-2 text-lg font-semibold" data-testid="review-name"><ConceptLetter letter={def.letter} />Concept {def.letter}: {row.name}</h2>
      <Insight id={row.key} ctx={ctx} ai={ai} status={status} was={row.decision.was?.text} now={row.decision.now?.text} edit={mode === 'edit' ? <EditBox text={text} setText={setText} ai={ai} problems={problems} /> : undefined} />
      <section className="flex flex-col gap-2" aria-label="Said, did and showed">
        <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Said · Did · Showed</h3>
        <div className={cn('grid gap-2', tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {tiles.map(({ k, m }) => (
            <div key={k} className={cn('flex flex-col gap-1 rounded-sm border p-3', k === 'showed' ? 'border-face-line bg-face-bg' : 'border-mist')} data-testid={`review-fig-${k}`}>
              <p className={cn('text-[24px] leading-none font-semibold tabular-nums', k === 'showed' && 'text-face-fg')}>{m.n}<span className="ml-1 text-xs font-normal text-graphite">of {m.of} {k === 'showed' ? 'on video' : 'people'}</span></p>
              <p className="text-xs text-graphite">{MEASURE_WORDS[k].short}</p>
              <p className="text-xs font-medium">{row.ranks[k] ? `${MEASURE_WORDS[k].label} ${['', '1st', '2nd', '3rd'][row.ranks[k]!]}` : ''}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-graphite tabular-nums">Faces read at the reveal: {row.showed.of} of {sawN}{sawN - row.showed.of ? ` (${sawN - row.showed.of} audio-only or without consent)` : ''}</p>
      </section>
      <section className="flex flex-col gap-2" aria-label="First reactions">
        <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">First reactions (warmest first) · first 5 seconds after the reveal</h3>
        <ul className="flex flex-col gap-2">
          {clips.map((c) => (
            <li key={c.participantId} className="flex flex-col gap-1.5 rounded-sm border border-mist p-4" data-testid="review-clip">
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-graphite">
                <Link to={playHref(ctx.studyId, c.sessionId, c.reading.revealAtSec)} aria-label={`Play ${c.participantId}`} className="inline-flex size-9 items-center justify-center rounded-full border border-mist-strong text-ink hover:bg-haze"><PlayIcon size={12} /></Link>
                <span className="font-semibold text-ink tabular-nums">{c.participantId}</span><span>{segmentLabelOf(c.participantId)}</span><span className="tabular-nums">{mmss(c.reading.revealAtSec + c.reading.onsetSec)} ({c.reading.onsetSec.toFixed(1)} s after the reveal)</span>
                <span className="ml-auto"><FaceNotRight ctx={ctx} fixKey={`m:${row.id}:${c.participantId}`} name={`${c.participantId}, first reaction at Concept ${def.letter}`} from={c.reading.from ?? c.reading.label} who={c.participantId} /></span>
              </div>
              <p className="text-sm">Seen: {c.reading.cue.charAt(0).toLowerCase() + c.reading.cue.slice(1)}</p>
              <p><FaceChip label={c.reading.noClear ? null : c.reading.label} confidence={c.reading.confidence} corrected={c.reading.corrected} /></p>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1.5 rounded-sm border border-mist p-4" data-testid="review-tensions"><h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Related tension</h3>
        {mine.length ? mine.map((x) => <button key={x.id} type="button" onClick={() => onOpenTension(x.id)} className="min-h-9 cursor-pointer rounded-xs text-left text-sm text-iris-700 hover:underline">{x.title} ›</button>) : <p className="text-sm text-graphite">No tensions on this.</p>}
      </section>
      <p className="text-xs text-graphite" data-testid="review-approval">{approvalFor(row.key, status, ctx.doc)}</p>
      <span className="sr-only">{defs.length} concepts compared</span>
    </>
  )
}

const tensionsOf2 = (tensions: Tension[], def: ConceptDef, row: ConceptRow) => tensions.filter((t) => !t.unavailable && (t.codeIds.includes(def.codeId) || t.momentId === row.id))
