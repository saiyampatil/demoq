// The one right panel of the Concepts tab, with the Themes tab's anatomy:
//   name, match and who saw it · the line · said, did and showed (each a tile with its own bar) · coverage · first reactions, warmest first
//   (a thumbnail that plays the reveal in place, what was seen, what it reads as, "Not right?") · related tension · note · the decision.
// "Show who" and "Compare people" replace the panel's content, with a link back: never a third column.
// Every figure is "n of N people" with its own base. A first reaction is only ever "reads as", with what was visible first.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { ClipPlayer } from '@/components/ClipPlayer'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import type { ConceptDef } from '@/mock/concepts'
import { CONCEPTS } from '@/config/concepts'
import { peopleBehind, clipsOf, checkConceptLine, warmest, type ConceptInput, type ConceptRow, type MeasureKey } from '@/state/concepts'
import { checkInsightEdit } from '@/state/speech'
import { segmentLabelOf, type Tension } from '@/state/signals'
import { mmss } from '../../review/reviewUi'
import { BackLink, ConceptLetter, FaceChip, FaceNotRight, PeopleList, PersonBar, RevealThumb, type BarPerson } from '../a2/ui'
import type { CodebookCtx } from '../codebookCtx'
import { playHref } from '../SignalBits'
import { InsightStatusChip } from '../themes/Bits'
import { DecisionBar, H, Section, TensionLinks, approvalFor, tensionsOn, type Intent } from '../themes/Panels'
import { MEASURE_WORDS, MatchChip, conceptNote, rankDetail } from './Bits'

type Who = { title: string; rows: { id: string; segment: string; word: string }[] }

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
  const [who, setWho] = useState<Who | null>(null)
  const [compare, setCompare] = useState<'differ' | 'all' | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const problems = mode === 'edit' && row.line ? [...checkInsightEdit(text, row.line, { figuresAllowed: 2, maxWords: 30 })] : []

  // Reset first, so a request made as the panel opens (a shortcut on another row) is not undone by it.
  useEffect(() => { setNote(doc.insightNotes?.[row.key] ?? ''); setMode('view'); setWho(null); setCompare(null); setPlaying(null); setShowAll(false) }, [row.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!intent || intent.theme !== row.key) return
    if (intent.kind === 'edit' && !tooFew) { setText(shown ?? ''); setMode('edit') }
    else if (intent.kind === 'leave') { setWhy(''); setMode('leave') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.n])

  const sawPeople = input.people.filter((p) => p.saw.includes(row.id))
  const audioOnly = sawPeople.filter((p) => !p.video).length
  const noConsent = sawPeople.filter((p) => p.video && !p.consent).length
  const { clips, total } = clipsOf(input, row.id, showAll ? 999 : CONCEPTS.clips)
  const mine = tensionsOn(tensions, new Set([def.codeId])).concat(tensions.filter((t) => !t.unavailable && t.momentId === row.id && !t.codeIds.includes(def.codeId)))
  const tiles: { key: MeasureKey; n: number; of: number; unit: string; grey?: boolean }[] = [
    ...(row.said ? [{ key: 'said' as const, ...row.said, unit: 'people' }] : []),
    ...(row.did ? [{ key: 'did' as const, ...row.did, unit: 'people' }] : []),
    { key: 'showed', n: row.showed.n, of: row.showed.of, unit: 'on video', grey: row.showed.greyed },
  ]
  const problemsAll = problems.length ? problems : mode === 'edit' && row.line && !checkConceptLine(text).ok ? checkConceptLine(text).problems : []
  const letterOf = (id?: string | null) => defs.find((d) => d.id === id)?.letter

  const barFor = (key: MeasureKey): BarPerson[] => {
    const base = key === 'showed' ? sawPeople.filter((p) => p.video && p.consent) : sawPeople
    const counted = new Set(peopleBehind(input, row.id, key).map((x) => x.participantId))
    return base.map((p) => ({ id: p.participantId, tone: counted.has(p.participantId) ? (key === 'showed' ? 'face' : 'good') : 'none' }))
  }
  const openWho = (key: MeasureKey) => setWho({ title: `${MEASURE_WORDS[key].label}: ${MEASURE_WORDS[key].short}`, rows: peopleBehind(input, row.id, key).map((p) => ({ id: p.participantId, segment: segmentLabelOf(p.participantId), word: p.word })) })

  // Compare people: what each person said, did and showed, for every concept. The ones whose three do not agree are the "differ" list.
  const everyone = useMemo(
    () => input.people.map((p) => ({ id: p.participantId, said: p.said, did: p.did, showed: warmest(p), video: p.video && p.consent })),
    [input],
  )
  const differs = (r: (typeof everyone)[number]) => new Set([r.said, r.did, r.showed].filter(Boolean)).size > 1
  const differing = everyone.filter(differs)

  const inner = compare ? (
    <div className="a2-slide flex flex-col gap-3 px-5 py-4" data-testid="compare-people">
      <BackLink onClick={() => setCompare(null)}>Concept {def.letter}: {row.name}</BackLink>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Compare people</h3>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-graphite">
          Who said, did and showed what:
          {defs.map((d) => <span key={d.id} className="inline-flex items-center gap-1"><ConceptLetter letter={d.letter} className="size-5" />{d.name}</span>)}
        </p>
      </div>
      <div role="group" aria-label="Which people" className="inline-flex self-start rounded-sm border border-mist-strong bg-haze p-0.5">
        {([['differ', `Differ (${differing.length})`], ['all', `All ${everyone.length}`]] as const).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={compare === k} onClick={() => setCompare(k)} data-testid={`compare-${k}`} className={cn('min-h-8 cursor-pointer rounded-xs px-3 text-xs', compare === k ? 'bg-surface font-semibold shadow-raised' : 'text-graphite hover:text-ink')}>{label}</button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_3rem_3rem_4rem_4.5rem] items-center gap-x-2 border-b border-mist pb-1 text-xs font-medium text-graphite">
        <span>Person</span><span className="text-center">Said</span><span className="text-center">Did</span><span className="text-center">Showed</span><span>Match</span>
      </div>
      <ul className="flex flex-col divide-y divide-mist" data-testid="compare-rows">
        {(compare === 'all' ? everyone : differing).map((r) => (
          <li key={r.id} data-testid="compare-row" className="grid min-h-9 grid-cols-[minmax(0,1fr)_3rem_3rem_4rem_4.5rem] items-center gap-x-2 text-xs">
            <span><span className="font-medium tabular-nums">{r.id}</span> <span className="text-graphite">{segmentLabelOf(r.id)}</span></span>
            <span className="text-center">{r.said ? <ConceptLetter letter={letterOf(r.said)!} className="size-5" /> : '—'}</span>
            <span className="text-center">{r.did ? <ConceptLetter letter={letterOf(r.did)!} className="size-5" /> : '—'}</span>
            <span className="text-center">{r.showed ? <ConceptLetter letter={letterOf(r.showed)!} className="size-5" /> : <span className="text-muted">{r.video ? 'None' : 'Not read'}</span>}</span>
            <span className={differs(r) ? 'font-medium text-pending-fg' : 'text-graphite'}>{differs(r) ? 'Differs' : 'Agrees'}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-graphite tabular-nums" data-testid="compare-count">{differing.length} of {everyone.length} people differ.</p>
    </div>
  ) : who ? (
    <div className="a2-slide flex flex-col gap-3 px-5 py-4" data-testid="who-panel">
      <BackLink onClick={() => setWho(null)}>Concept {def.letter}: {row.name}</BackLink>
      <h3 className="text-sm font-semibold" data-testid="who-title">{who.title}</h3>
      <PeopleList rows={who.rows} />
    </div>
  ) : null

  return (
    <section aria-label={`Concept ${row.name}`} data-testid="concept-panel" data-concept={row.id} data-status={status} className="flex max-h-[calc(100vh-9rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto pb-6">
        {inner}
        <div className={inner ? 'hidden' : undefined}>
          <header className="flex flex-col gap-2 border-b border-mist px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <MatchChip match={row.match} detail={rankDetail(row)} />
              {rankDetail(row) && <span className="text-xs text-graphite" data-testid="rank-detail">{rankDetail(row)}</span>}
            </div>
            <h2 className="flex items-center gap-2 text-lg leading-snug font-semibold" data-testid="concept-panel-name"><ConceptLetter letter={def.letter} />Concept {def.letter}: {row.name}</h2>
            <p className="text-xs text-graphite tabular-nums" data-testid="concept-panel-seen">Seen by {row.saw} of {input.people.length} people</p>
          </header>

          <Section label="Insight" testid="insight" aside={<InsightStatusChip status={status} />}>
            {mode === 'edit' ? (
              <div className="flex flex-col gap-2" data-testid="insight-edit">
                <TextArea aria-label="Insight wording" value={text} onChange={(e) => setText(e.target.value)} rows={3} data-testid="insight-text" hint="You can change the wording. Numbers can’t be edited." />
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
                    {row.decision.was?.text === row.decision.now?.text ? (
                      <span data-testid="was">A tension was added that affects this. The line is the same: look again, then accept it.</span>
                    ) : (
                      <>
                        <span data-testid="was">Was: {row.decision.was?.text}</span>
                        <span data-testid="now">Now: {row.decision.now?.text}</span>
                      </>
                    )}
                  </div>
                )}
                {mine.filter((t) => t.status === 'Added as a tension theme').map((t) => (
                  <p key={t.id} className="text-xs text-graphite" data-testid="related-tension">Related tension: <button type="button" onClick={() => onOpenTension(t.id)} className="min-h-9 cursor-pointer rounded-xs font-medium text-iris-700 hover:underline">{t.title} ›</button></p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-graphite" data-testid="summary-sentence">{conceptNote(row, defs, doc)}</p>
            )}
          </Section>

          <section aria-label="Said, did and showed" data-testid="concept-figures" className="flex flex-col gap-2 border-b border-mist px-5 py-4">
            <H>Said · Did · Showed</H>
            <dl className={cn('grid gap-2', tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')} data-testid="measure-tiles">
              {tiles.map((t) => (
                <button key={t.key} type="button" onClick={() => openWho(t.key)} data-testid={`fig-${t.key}`} data-n={t.n} data-of={t.of} title={MEASURE_WORDS[t.key].tip} className={cn('flex min-h-24 cursor-pointer flex-col gap-1.5 rounded-sm border px-2.5 py-2 text-left', t.key === 'showed' ? 'border-face-line bg-face-bg' : 'border-mist bg-surface hover:bg-haze', t.grey && 'border-dashed')}>
                  <dd className={cn('text-[24px] leading-none font-semibold tabular-nums', t.grey ? 'text-muted' : t.key === 'showed' ? 'text-face-fg' : 'text-ink')}>{t.n}</dd>
                  <dt className="text-xs text-ink">{MEASURE_WORDS[t.key].label}</dt>
                  <span className="text-xs text-graphite tabular-nums">of {t.of} {t.unit}</span>
                  <PersonBar people={barFor(t.key)} label={`${t.n} of ${t.of} ${t.unit}`} className="mt-auto" />
                </button>
              ))}
            </dl>
            {row.showed.greyed && <p className="text-xs text-graphite" data-testid="showed-greyed">Showed needs at least {CONCEPTS.showedMinVideo} people on video, so it is not part of the match.</p>}
            <p className="text-xs text-graphite tabular-nums" data-testid="concept-coverage">
              Faces read at the reveal for {row.showed.of} of {sawPeople.length} people{audioOnly ? ` · ${audioOnly} audio-only` : ''}{noConsent ? ` · ${noConsent} without consent` : ''}
            </p>
            <Button size="sm" onClick={() => setCompare('differ')} className="self-start" data-testid="open-compare">Compare people ({input.people.length})</Button>
          </section>

          <Section label="First reactions, warmest first" testid="clips-section" aside={<span className="text-xs text-graphite">First 5 seconds after the reveal</span>}>
            {clips.length === 0 ? (
              <p className="text-sm text-graphite" data-testid="clips-none">No first reactions could be read: nobody who saw it was on video and consented.</p>
            ) : (
              <>
                <ol className="flex flex-col divide-y divide-mist" data-testid="clips">
                  {clips.map((c) => {
                    const open = playing === c.participantId
                    const r = c.reading
                    return (
                      <li key={c.participantId} data-testid="clip" data-person={c.participantId} data-rank={c.rank} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <RevealThumb letter={def.letter} name={row.name} playing={open} onClick={() => setPlaying(open ? null : c.participantId)} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-graphite">
                              <span className="font-medium text-ink tabular-nums">{c.participantId}</span>
                              <span>{segmentLabelOf(c.participantId)}</span>
                              <span className="tabular-nums" data-testid="clip-time">{mmss(r.revealAtSec + r.onsetSec)}</span>
                              <span className="ml-auto"><FaceNotRight ctx={ctx} fixKey={`m:${row.id}:${c.participantId}`} name={`${c.participantId}, first reaction at Concept ${def.letter}`} from={r.from ?? r.label} who={c.participantId} /></span>
                            </div>
                            <p className="text-sm" data-testid="clip-cue">Seen: {r.cue.charAt(0).toLowerCase() + r.cue.slice(1)}</p>
                            <p data-testid="clip-reading"><FaceChip label={r.noClear ? null : r.label} confidence={r.confidence} corrected={r.corrected} /></p>
                            <p className="text-xs text-graphite" data-testid="clip-when">{c.warmestHere ? 'Warmest of the concepts they saw · ' : ''}{r.onsetSec.toFixed(1)} s after the reveal</p>
                          </div>
                        </div>
                        {open && (
                          <ClipPlayer
                            className="a2-slide"
                            label={`${c.participantId} · Concept ${def.letter} reveal`}
                            startSec={Math.max(0, Math.round(r.revealAtSec) - 2)}
                            lengthSec={10}
                            markerSec={2}
                            markerLabel="The reveal"
                            captionBar={
                              <span className="flex flex-wrap items-center gap-2">
                                <span>Seen: {r.cue.charAt(0).toLowerCase() + r.cue.slice(1)}</span>
                                <FaceChip label={r.noClear ? null : r.label} confidence={r.confidence} corrected={r.corrected} />
                                <Link to={playHref(ctx.studyId, c.sessionId, r.revealAtSec)} className="ml-auto font-medium text-iris-700 hover:underline">Open the session</Link>
                              </span>
                            }
                          />
                        )}
                      </li>
                    )
                  })}
                </ol>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-graphite tabular-nums" data-testid="clips-count">Showing {clips.length} of {total} first reactions.</p>
                  {total > CONCEPTS.clips && (
                    <button type="button" onClick={() => setShowAll((a) => !a)} data-testid="show-all-clips" className="min-h-9 cursor-pointer rounded-xs text-xs font-medium text-iris-700 hover:underline">{showAll ? 'Show fewer' : `Show all ${total}`}</button>
                  )}
                </div>
              </>
            )}
          </Section>

          <Section label="Related tension" testid="tensions-section">
            <TensionLinks list={mine} onOpenTension={onOpenTension} />
          </Section>

          <section aria-label="Your note" data-testid="note-section" className="flex flex-col gap-1.5 border-b border-mist px-5 py-4">
            <H>Your note</H>
            <TextArea aria-label="Your note on this concept" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onNote(note)} rows={2} data-testid="note" hint="Kept apart from the line. It is never part of the sentence." />
          </section>
        </div>
      </div>
      <DecisionBar blockedTip="Needs at least two of Said, Did and Showed to write a line" status={status} tooFew={tooFew} accepted={accepted} acceptLabel="Accept" mode={mode} why={why} setWhy={setWhy} leftOutWhy={decision?.why} onAccept={onAccept} onEdit={() => { setText(shown ?? ''); setMode('edit') }} onLeave={() => { setWhy(''); setMode('leave') }} onLeaveConfirm={() => { onLeaveOut(why); setMode('view') }} onCancel={() => setMode('view')} />
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite tabular-nums" data-testid="approval-line">{approvalFor(row.key, status, doc)}</footer>
    </section>
  )
}
