// The one right panel of the Concepts tab, with the Themes tab's anatomy:
//   name, match and who saw it · the line · said, did and showed · coverage · first reactions, warmest first · tensions · decision · note · who decided.
// Every figure is "n of N people" with its own base. A first reaction is only ever "reads as", with what was visible.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { PlayIcon } from '@/components/icons'
import type { ConceptDef } from '@/mock/concepts'
import { CONCEPTS } from '@/config/concepts'
import { peopleBehind, clipsOf, checkConceptLine, type ConceptInput, type ConceptRow, type MeasureKey } from '@/state/concepts'
import { checkInsightEdit } from '@/state/speech'
import { segmentLabelOf, type Tension } from '@/state/signals'
import { mmss } from '../../review/reviewUi'
import type { CodebookCtx } from '../codebookCtx'
import { playHref } from '../SignalBits'
import { InsightStatusChip } from '../themes/Bits'
import { DecisionBar, H, Section, TensionLinks, approvalFor, tensionsOn, type Intent } from '../themes/Panels'
import { MEASURE_WORDS, MatchChip, conceptNote } from './Bits'

export function ConceptPanel({
  row,
  def,
  input,
  defs,
  ctx,
  tensions,
  intent,
  onAccept,
  onEdit,
  onLeaveOut,
  onNote,
  onOpenTension,
}: {
  row: ConceptRow
  def: ConceptDef
  input: ConceptInput
  defs: ConceptDef[]
  ctx: CodebookCtx
  tensions: Tension[]
  intent?: Intent
  onAccept: () => void
  onEdit: (text: string) => void
  onLeaveOut: (why: string) => void
  onNote: (text: string) => void
  onOpenTension: (id: string) => void
}) {
  const { doc } = ctx
  const status = row.decision.status
  const decision = doc.insights?.[row.key]
  const accepted = status === 'Accepted' || status === 'Edited'
  const tooFew = status === 'Nothing to decide'
  const shown = accepted && decision ? decision.text : row.line
  const [mode, setMode] = useState<'view' | 'edit' | 'leave'>('view')
  const [text, setText] = useState('')
  const [why, setWhy] = useState('')
  const [note, setNote] = useState(doc.insightNotes?.[row.key] ?? '')
  const [open, setOpen] = useState<MeasureKey | null>(null)
  const problems = mode === 'edit' && row.line ? [...checkInsightEdit(text, row.line, { figuresAllowed: 2, maxWords: 30 })] : []

  // Reset first, so a request made as the panel opens (a shortcut on another row) is not undone by it.
  useEffect(() => { setNote(doc.insightNotes?.[row.key] ?? ''); setMode('view'); setOpen(null) }, [row.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!intent || intent.theme !== row.key) return
    if (intent.kind === 'edit' && !tooFew) { setText(shown ?? ''); setMode('edit') }
    else if (intent.kind === 'leave') { setWhy(''); setMode('leave') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.n])

  const sawPeople = input.people.filter((p) => p.saw.includes(row.id))
  const audioOnly = sawPeople.filter((p) => !p.video).length
  const noConsent = sawPeople.filter((p) => p.video && !p.consent).length
  const { clips, total } = clipsOf(input, row.id)
  const mine = tensionsOn(tensions, new Set([def.codeId])).concat(tensions.filter((t) => !t.unavailable && t.momentId === row.id && !t.codeIds.includes(def.codeId)))
  const tiles: { key: MeasureKey; n: number; of: number; unit: string; grey?: boolean }[] = [
    ...(row.said ? [{ key: 'said' as const, ...row.said, unit: 'people' }] : []),
    ...(row.did ? [{ key: 'did' as const, ...row.did, unit: 'people' }] : []),
    { key: 'showed', n: row.showed.n, of: row.showed.of, unit: 'on video', grey: row.showed.greyed },
  ]
  const listed = open ? peopleBehind(input, row.id, open) : []
  const problemsAll = problems.length ? problems : mode === 'edit' && row.line && !checkConceptLine(text).ok ? checkConceptLine(text).problems : []

  return (
    <section aria-label={`Concept ${row.name}`} data-testid="concept-panel" data-concept={row.id} data-status={status} className="flex max-h-[calc(100vh-9rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto pb-6">
        <header className="flex flex-col gap-2 border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2"><MatchChip match={row.match} /></div>
          <h2 className="text-lg leading-snug font-semibold" data-testid="concept-panel-name">Concept {def.letter}: {row.name}</h2>
          <p className="text-xs text-graphite tabular-nums" data-testid="concept-panel-seen">Seen by {row.saw} of {input.people.length} people</p>
        </header>

        <Section label="Insight" testid="insight" aside={<InsightStatusChip status={status} />}>
          {mode === 'edit' ? (
            <div className="flex flex-col gap-2" data-testid="insight-edit">
              <TextArea aria-label="Insight wording" value={text} onChange={(e) => setText(e.target.value)} rows={3} data-testid="insight-text" hint="You can change the wording. The numbers are locked to PulseAI’s." />
              {problemsAll.length > 0 && <ul className="flex flex-col gap-0.5 text-xs text-negative-fg" data-testid="insight-problems">{problemsAll.map((p) => <li key={p}>{p}</li>)}</ul>}
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={problemsAll.length > 0} onClick={() => { onEdit(text.trim()); setMode('view') }} data-testid="insight-save">Save wording</Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
              </div>
            </div>
          ) : shown ? (
            <div className="flex flex-col gap-1.5">
              <AIGeneratedTag className="self-start" />
              <p className="text-[18px] leading-snug font-medium text-ink" data-testid="summary-sentence">{shown}</p>
              {status === 'Edited' && decision && <p className="text-xs text-graphite" data-testid="ai-original">PulseAI wrote: {decision.original}</p>}
              {status === 'Out of date' && (
                <div className="flex flex-col gap-0.5 rounded-sm bg-pending-bg px-3 py-2 text-xs text-pending-fg" data-testid="out-of-date">
                  <span className="font-semibold">The data changed after you decided.</span>
                  <span data-testid="was">Was: {row.decision.was?.text}</span>
                  <span data-testid="now">Now: {row.decision.now?.text}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-graphite" data-testid="summary-sentence">{conceptNote(row, defs, doc)}</p>
          )}
        </Section>

        <section aria-label="Said, did and showed" data-testid="concept-figures" className="flex flex-col gap-2 border-b border-mist px-5 py-4">
          <H>Said · Did · Showed</H>
          <dl className={cn('grid gap-2', tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')} data-testid="measure-tiles">
            {tiles.map((t) => (
              <button key={t.key} type="button" onClick={() => setOpen(open === t.key ? null : t.key)} aria-pressed={open === t.key} data-testid={`fig-${t.key}`} data-n={t.n} data-of={t.of} title={MEASURE_WORDS[t.key].tip} className={cn('min-h-11 cursor-pointer rounded-sm border px-2 py-1.5 text-left', t.grey ? 'border-dashed border-mist-strong bg-transparent' : 'border-mist bg-surface hover:bg-haze', open === t.key && 'ring-1 ring-ink')}>
                <dd className={cn('text-lg leading-none font-semibold tabular-nums', t.grey && 'text-muted')}>{t.n}</dd>
                <dt className="mt-1 text-xs text-ink">{MEASURE_WORDS[t.key].label}</dt>
                <span className="text-xs text-graphite tabular-nums">of {t.of} {t.unit}</span>
              </button>
            ))}
          </dl>
          {row.showed.greyed && <p className="text-xs text-graphite" data-testid="showed-greyed">Showed needs at least {CONCEPTS.showedMinVideo} people on video, so it is not part of the match.</p>}
          {open && (
            <ul className="divide-y divide-mist rounded-sm border border-mist" data-testid="measure-people" data-for={open}>
              {listed.length === 0 && <li className="px-2.5 py-1.5 text-xs text-graphite">Nobody.</li>}
              {listed.map((p) => (
                <li key={p.participantId} data-testid="tile-person" className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                  <span className="font-medium whitespace-nowrap tabular-nums">{p.participantId}</span>
                  <span className="text-graphite">{segmentLabelOf(p.participantId)}</span>
                  <span className="ml-auto text-right whitespace-nowrap text-graphite" data-testid="tile-reason">{p.word}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-graphite tabular-nums" data-testid="concept-coverage">
            Faces read at the reveal for {row.showed.of} of {sawPeople.length} people{audioOnly ? ` · ${audioOnly} audio-only` : ''}{noConsent ? ` · ${noConsent} without consent` : ''}
          </p>
        </section>

        <Section label="First reactions, warmest first" testid="clips-section">
          {clips.length === 0 ? (
            <p className="text-sm text-graphite" data-testid="clips-none">No first reactions could be read: nobody who saw it was on video and consented.</p>
          ) : (
            <>
              <ol className="flex flex-col divide-y divide-mist" data-testid="clips">
                {clips.map((c) => (
                  <li key={c.participantId} data-testid="clip" data-person={c.participantId} data-rank={c.rank} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-graphite">
                      <span className="w-4 tabular-nums">{c.rank}</span>
                      <span className="font-medium whitespace-nowrap text-ink tabular-nums">{c.participantId}</span>
                      <span>{segmentLabelOf(c.participantId)}</span>
                      <span className="whitespace-nowrap tabular-nums">{mmss(c.reading.revealAtSec)}</span>
                      <Link to={playHref(ctx.studyId, c.sessionId, c.reading.revealAtSec)} className="ml-auto inline-flex min-h-6 items-center gap-1 rounded-xs font-medium whitespace-nowrap text-iris-700 hover:underline" aria-label={`Play ${c.participantId} at ${mmss(c.reading.revealAtSec)}`}>
                        <PlayIcon size={11} /> Play
                      </Link>
                    </div>
                    <p className="pl-6 text-sm" data-testid="clip-reading">
                      reads as <span className="font-medium">{c.reading.label}</span> · {c.reading.intensity.toLowerCase()}
                    </p>
                    <p className="pl-6 text-xs text-graphite" data-testid="clip-cue">{c.reading.cue}, {c.reading.onsetSec.toFixed(1)} s after the reveal</p>
                    {c.warmestHere && <p className="pl-6 text-xs font-medium text-iris-700" data-testid="clip-warmest">Their warmest of the concepts they saw</p>}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-graphite tabular-nums" data-testid="clips-count">Showing {clips.length} of {total} first reactions.</p>
            </>
          )}
        </Section>

        <Section label="Tensions on this concept" testid="tensions-section">
          <TensionLinks list={mine} onOpenTension={onOpenTension} />
        </Section>

        <section aria-label="Your note" data-testid="note-section" className="flex flex-col gap-1.5 border-b border-mist px-5 py-4">
          <H>Your note</H>
          <TextArea aria-label="Your note on this concept" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onNote(note)} rows={2} data-testid="note" hint="Kept apart from the line. It is never part of the sentence." />
        </section>
      </div>
      <DecisionBar blockedTip="Needs at least two of Said, Did and Showed to write a line" status={status} tooFew={tooFew} accepted={accepted} acceptLabel="Accept" mode={mode} why={why} setWhy={setWhy} leftOutWhy={decision?.why} onAccept={onAccept} onEdit={() => { setText(shown ?? ''); setMode('edit') }} onLeave={() => { setWhy(''); setMode('leave') }} onLeaveConfirm={() => { onLeaveOut(why); setMode('view') }} onCancel={() => setMode('view')} />
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite tabular-nums" data-testid="approval-line">{approvalFor(row.key, status, doc)}</footer>
    </section>
  )
}
