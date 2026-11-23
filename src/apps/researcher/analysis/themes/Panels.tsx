// The one right panel of the Themes tab. A theme and a code share one anatomy:
//   name, verdict and Said by · the insight · did their delivery match their words · coverage · moments to watch · what to check
//   · tensions · the decision · a note of your own · who decided, when, on which data.
// Numbers only. No bars, no legend: the Key holds every meaning.

import { useEffect, useState } from 'react'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/Field'
import { Switch } from '@/components/Switch'
import { Tooltip } from '@/components/Tooltip'
import { verdictLabel } from '@/config/delivery'
import { formatDate } from '@/lib/format'
import { dataVersionOf, setCodeOverride, type CodebookDoc } from '@/state/codebook'
import { TOO_FEW_TIP, type PersonFit, checkInsightEdit, codeStance, insightOf, speechEvidence } from '@/state/speech'
import { textSignalsOf } from '@/state/concepts'
import { plural, themeInsight, type CodeSignal, type InsightStatus, type Tension, type ThemeSignal } from '@/state/signals'
import type { CodebookCtx } from '../codebookCtx'
import { FitChip } from '../SignalBits'
import { InsightStatusChip, Moments, SentenceWithN, StanceTag, Tiles } from './Bits'

/** Each person's one result, for the chip on their clip. */
const fitsOf = (reads: { participantId: string; fit?: PersonFit }[]) => Object.fromEntries(reads.map((r) => [r.participantId, r.fit]))

/** What a keyboard shortcut or a button asked a panel to start. `n` changes every time, so asking twice works. */
export type Intent = { theme: string; kind: 'edit' | 'leave'; n: number }

export const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-xs font-semibold text-ink">{children}</h3>
export const Section = ({ label, testid, aside, children }: { label: string; testid: string; aside?: React.ReactNode; children: React.ReactNode }) => (
  <section aria-label={label} data-testid={testid} className="flex flex-col gap-2 border-b border-mist px-5 py-4">
    <div className="flex items-center justify-between gap-2">
      <H>{label}</H>
      {aside}
    </div>
    {children}
  </section>
)

/** "Accepted by Maya Ortiz · Oct 22, 2026 · data v2", or what is true instead. */
export function approvalFor(id: string, s: InsightStatus, doc: CodebookDoc): string {
  const d = doc.insights?.[id]
  if (s === 'Nothing to decide') return d?.status === 'Left out' ? `Left out by ${d.by} · ${formatDate(d.at)} · data v${d.dataVersion}` : TOO_FEW_TIP
  if (!d || s === 'Suggested') return 'Not decided yet'
  const verb = d.status === 'Left out' ? 'Left out' : d.status === 'Edited' ? 'Edited and accepted' : 'Accepted'
  return `${verb} by ${d.by} · ${formatDate(d.at)} · data v${d.dataVersion}${s === 'Out of date' ? ' · out of date' : ''}`
}

const approvalLine = (prof: ThemeSignal, doc: CodebookDoc) => approvalFor(prof.id, prof.decision.status, doc)

/** The tensions that draw on a theme's codes: accepted first, then those still to review. Each is a link to its card. */
export function tensionsOn(tensions: Tension[], codeIds: Set<string>) {
  const mine = tensions.filter((t) => !t.unavailable && t.codeIds.some((id) => codeIds.has(id)))
  return [...mine.filter((t) => t.status === 'Added as a tension theme'), ...mine.filter((t) => t.status === 'Suggested')]
}

export function TensionLinks({ list, onOpenTension }: { list: Tension[]; onOpenTension: (id: string) => void }) {
  if (!list.length) return <p className="text-sm text-graphite" data-testid="tensions-none">No tensions on this.</p>
  return (
    <ul className="flex flex-col gap-1.5" data-testid="theme-tensions">
      {list.map((t) => (
        <li key={t.id} className="flex flex-wrap items-baseline gap-x-2">
          <button type="button" onClick={() => onOpenTension(t.id)} data-testid="tension-link" data-tension={t.id} className="min-h-6 cursor-pointer rounded-xs text-left text-sm text-iris-700 hover:underline">{t.title}</button>
          <span className="text-xs text-graphite">{t.status === 'Added as a tension theme' ? 'Accepted' : 'To review'}</span>
        </li>
      ))}
    </ul>
  )
}

/** The sticky bar at the bottom of a panel: Accept (primary), Edit and Leave out, the reason form for leaving out, and why it was left out. */
export function DecisionBar({
  status,
  tooFew,
  accepted,
  acceptLabel,
  mode,
  why,
  setWhy,
  leftOutWhy,
  onAccept,
  onEdit,
  onLeave,
  onLeaveConfirm,
  onCancel,
  blockedTip = TOO_FEW_TIP,
}: {
  status: InsightStatus
  tooFew: boolean
  accepted: boolean
  acceptLabel: string
  mode: 'view' | 'edit' | 'leave'
  why: string
  setWhy: (v: string) => void
  leftOutWhy?: string
  onAccept: () => void
  onEdit: () => void
  onLeave: () => void
  onLeaveConfirm: () => void
  onCancel: () => void
  /** Why Accept and Edit are off when there is nothing to decide. */
  blockedTip?: string
}) {
  return (
    <div aria-label="Decision" role="group" data-testid="decision" className="flex flex-col gap-3 border-t border-mist bg-surface px-5 py-3">
      <div className="flex flex-wrap items-center gap-2" data-testid="actions">
        {tooFew ? (
          <Tooltip content={blockedTip} focusable align="left">
            <Button size="sm" variant="primary" disabled data-testid="accept">{acceptLabel}</Button>
          </Tooltip>
        ) : (
          <Button size="sm" variant="primary" disabled={accepted} onClick={onAccept} data-testid="accept">{accepted ? 'Accepted' : acceptLabel}</Button>
        )}
        {tooFew ? (
          <Tooltip content={blockedTip} focusable align="left">
            <Button size="sm" disabled data-testid="edit">Edit</Button>
          </Tooltip>
        ) : (
          <Button size="sm" onClick={onEdit} data-testid="edit">Edit</Button>
        )}
        <Button size="sm" onClick={onLeave} disabled={status === 'Left out'} data-testid="leave-out">Leave out</Button>
      </div>
      {mode === 'leave' && (
        <div className="flex flex-col gap-2" data-testid="leave-form">
          <TextArea aria-label="Reason for leaving it out" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} data-testid="leave-why" autoFocus hint={tooFew ? 'A reason is needed when there is nothing to decide.' : 'A reason is optional.'} />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={tooFew && !why.trim()} onClick={onLeaveConfirm} data-testid="leave-confirm">Leave out</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      )}
      {status === 'Left out' && leftOutWhy && <p className="text-xs text-graphite" data-testid="left-out-why">Reason: {leftOutWhy}</p>}
    </div>
  )
}

// ─── a theme ────────────────────────────────────────────────────────────────

export type Review = { index: number; total: number; exit: () => void }

export function ThemePanel({
  prof,
  ctx,
  tensions,
  intent,
  review,
  onAccept,
  onEdit,
  onLeaveOut,
  onNote,
  onCode,
  onOpenTension,
}: {
  prof: ThemeSignal
  ctx: CodebookCtx
  tensions: Tension[]
  intent?: Intent
  review?: Review
  onAccept: () => void
  onEdit: (text: string) => void
  onLeaveOut: (why: string) => void
  onNote: (text: string) => void
  onCode: (id: string) => void
  onOpenTension: (id: string) => void
}) {
  const { doc } = ctx
  const ins = themeInsight(prof)
  const status = prof.decision.status
  const decision = doc.insights?.[prof.id]
  const computed = prof.insight?.sentence
  const shown = (status === 'Accepted' || status === 'Edited') && decision ? decision.text : computed
  const [mode, setMode] = useState<'view' | 'edit' | 'leave'>('view')
  const [text, setText] = useState('')
  const [why, setWhy] = useState('')
  const [note, setNote] = useState(doc.insightNotes?.[prof.id] ?? '')
  const tooFew = status === 'Nothing to decide'
  const problems = mode === 'edit' && computed ? checkInsightEdit(text, computed) : []

  // A shortcut or a button elsewhere asked for this.
  // Reset first, so a request made as the panel opens (a shortcut on another row) is not undone by it.
  useEffect(() => {
    setNote(doc.insightNotes?.[prof.id] ?? '')
    setMode('view')
  }, [prof.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!intent || intent.theme !== prof.id) return
    if (intent.kind === 'edit' && !tooFew) {
      setText(shown ?? '')
      setMode('edit')
    } else if (intent.kind === 'leave') {
      setWhy('')
      setMode('leave')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.n])

  const codeIds = new Set(prof.codes.map((c) => c.code.id))
  const accepted = status === 'Accepted' || status === 'Edited'
  const acceptLabel = review ? 'Accept and next' : 'Accept'

  return (
    <section aria-label={`Theme ${prof.name}`} data-testid="theme-panel" data-theme={prof.id} data-status={status} className="flex max-h-[calc(100vh-9rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto pb-6">
        <header className="flex flex-col gap-2 border-b border-mist px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <FitChip pattern={prof.verdict} />
            {review && (
              <span className="ml-auto text-xs text-graphite tabular-nums" data-testid="review-position">
                {review.index + 1} of {review.total} ·{' '}
                <button type="button" onClick={review.exit} data-testid="exit-review" className="min-h-6 cursor-pointer rounded-xs font-medium text-iris-700 hover:underline">Exit review</button>
              </span>
            )}
          </div>
          <h2 className="text-lg leading-snug font-semibold" data-testid="theme-panel-name">{prof.name}</h2>
          <p className="text-xs text-graphite tabular-nums" data-testid="theme-panel-said-by">Said by {prof.people} of {prof.of} people</p>
        </header>

        <Section label="Insight" testid="insight" aside={<InsightStatusChip status={status} />}>
          {tooFew ? (
            <p className="text-[18px] leading-snug text-ink" data-testid="summary-sentence">{`Only ${plural(prof.people, 'person', 'people')} said this, too few to read a pattern.`}</p>
          ) : mode === 'edit' ? (
            <div className="flex flex-col gap-2" data-testid="insight-edit">
              <TextArea aria-label="Insight wording" value={text} onChange={(e) => setText(e.target.value)} rows={3} data-testid="insight-text" hint="You can change the wording. The numbers are locked to PulseAI’s." />
              {problems.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs text-negative-fg" data-testid="insight-problems">
                  {problems.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={problems.length > 0} onClick={() => { onEdit(text.trim()); setMode('view') }} data-testid="insight-save">Save wording</Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <AIGeneratedTag className="self-start" />
              <p className="text-[18px] leading-snug font-medium text-ink" data-testid="summary-sentence">
                {status === 'Edited' && decision ? decision.text : shown ? <SentenceWithN sentence={shown} of={prof.insight?.of ?? prof.people} what="theme" /> : null}
              </p>
              {status === 'Edited' && decision && <p className="text-xs text-graphite" data-testid="ai-original">PulseAI wrote: {decision.original}</p>}
              {status === 'Out of date' && (
                <div className="flex flex-col gap-0.5 rounded-sm bg-pending-bg px-3 py-2 text-xs text-pending-fg" data-testid="out-of-date">
                  <span className="font-semibold">The data changed after you decided.</span>
                  <span data-testid="was">Was: {prof.decision.was?.text}</span>
                  <span data-testid="now">Now: {prof.decision.now?.text}</span>
                </div>
              )}
            </div>
          )}
        </Section>

        {prof.reads.some((r) => r.side) || prof.reads.length > 0 ? (
          <section aria-label="Did their delivery match their words?" data-testid="theme-figures" className="flex flex-col gap-2 border-b border-mist px-5 py-4">
            {prof.reads.some((r) => r.side) && <h3 className="text-xs font-semibold text-ink" data-testid="match-question">Did their delivery match their words?</h3>}
            <Tiles reads={prof.reads} ctx={ctx} />
            <p className="text-xs text-graphite tabular-nums" data-testid="theme-coverage">{ins.coverage || 'Everyone who said it was read on speech.'}</p>
          </section>
        ) : null}

        <Section label="Moments to watch" testid="moments-section">
          <Moments moments={prof.moments} studyId={ctx.studyId} fits={fitsOf(prof.reads)} />
        </Section>

        <Section label="Codes to check" testid="codes-to-check">
          {ins.check.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {ins.check.map((c) => (
                <li key={c.code.id}>
                  <button type="button" onClick={() => onCode(c.code.id)} data-testid="check-chip" data-code-id={c.code.id} data-verdict={c.fit.pattern} title={`${verdictLabel(c.fit.pattern)}: no match for ${c.fit.against} of ${c.fit.n}`} className="min-h-6 cursor-pointer rounded-xs focus-visible:outline-2">
                    <FitChip pattern={c.fit.pattern} label={c.code.name} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" data-testid="check-none">None. No code is Mixed or Gap.</p>
          )}
        </Section>

        <Section label="Tensions on this theme" testid="tensions-section">
          <TensionLinks list={tensionsOn(tensions, codeIds)} onOpenTension={onOpenTension} />
        </Section>

        <section aria-label="Your note" data-testid="note-section" className="flex flex-col gap-1.5 border-b border-mist px-5 py-4">
          <H>Your note</H>
          <TextArea aria-label="Your note on this theme" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onNote(note)} rows={2} data-testid="note" hint="Kept apart from the insight. It is never part of the sentence." />
        </section>
      </div>
      <DecisionBar status={status} tooFew={tooFew} accepted={accepted} acceptLabel={acceptLabel} mode={mode} why={why} setWhy={setWhy} leftOutWhy={decision?.why} onAccept={onAccept} onEdit={() => { setText(shown ?? ''); setMode('edit') }} onLeave={() => { setWhy(''); setMode('leave') }} onLeaveConfirm={() => { onLeaveOut(why); setMode('view') }} onCancel={() => setMode('view')} />
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite tabular-nums" data-testid="approval-line">{approvalLine(prof, doc)}</footer>
    </section>
  )
}

// ─── a code ─────────────────────────────────────────────────────────────────

export function CodePanel({
  s,
  theme,
  ctx,
  tensions,
  back,
  onOpenTension,
}: {
  s: CodeSignal
  theme?: ThemeSignal
  ctx: CodebookCtx
  tensions: Tension[]
  back?: { name: string; onClick: () => void }
  onOpenTension: (id: string) => void
}) {
  const { doc } = ctx
  const insight = insightOf(s.reads)
  const evidence = speechEvidence(s.reads)
  const signals = textSignalsOf(s.code, doc, ctx.basis)
  const mine = tensionsOn(tensions, new Set([s.code.id]))
  const themeAccepted = theme?.decision.status === 'Accepted' || theme?.decision.status === 'Edited'
  const override = doc.codeOverrides?.[s.code.id]
  const inReport = override ?? themeAccepted
  const [custom, setCustom] = useState(false)
  const approval = theme ? approvalLine(theme, doc) : 'This code is not in a theme yet'
  return (
    <section aria-label={`Code ${s.code.name}`} data-testid="signal-panel" data-code={s.code.id} className="flex max-h-[calc(100vh-9rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto pb-6">
        <header className="flex flex-col gap-2 border-b border-mist px-5 py-4">
          {back && (
            <button type="button" onClick={back.onClick} data-testid="back-to-theme" className="min-h-6 cursor-pointer self-start rounded-xs text-xs font-medium text-iris-700 hover:underline">← {back.name}</button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <FitChip pattern={s.readable ? s.fit.pattern : 'Too few to read'} />
            <StanceTag ctx={ctx} code={s.code} />
            {!s.decidable && <InsightStatusChip status="Nothing to decide" />}
          </div>
          <h2 className="text-lg leading-snug font-semibold" data-testid="code-panel-name">{s.code.name}</h2>
          <p className="text-xs text-graphite tabular-nums" data-testid="code-panel-said-by">Said by {s.people} of {s.of} people</p>
        </header>

        <Section label="Speech evidence" testid="speech-evidence">
          <ul className="flex flex-col divide-y divide-mist" data-testid="evidence-lines">
            {evidence.map((e) => (
              <li key={e.key} data-testid={`evidence-${e.key}`} data-n={e.n} data-of={e.of} title={e.text} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{e.label}</span>
                  <span className="font-semibold tabular-nums" data-testid="evidence-count">{e.n} of {e.of} people</span>
                </div>
                <p className="text-xs text-graphite" data-testid="evidence-baseline">{e.baseline}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section label="What the transcripts show" testid="observations">
          <ul className="flex flex-col divide-y divide-mist" data-testid="observation-lines">
            {([
              { key: 'hedged', label: 'Hedged', m: signals.hedged, baseline: 'Said with words like “maybe” or “I think”.' },
              { key: 'raised', label: 'Raised before asked', m: signals.raised, baseline: 'Brought up before the guide asked about it.' },
            ] as const).map((o) => (
              <li key={o.key} data-testid={`observation-${o.key}`} data-n={o.m.n} data-of={o.m.of} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{o.label}</span>
                  <span className="font-semibold tabular-nums" data-testid="observation-count">{o.m.n} of {o.m.of} people</span>
                </div>
                <p className="text-xs text-graphite">{o.baseline} Never part of the verdict.</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section label="Insight" testid="insight">
          {insight ? (
            <div className="flex flex-col gap-1.5">
              <AIGeneratedTag className="self-start" />
              <p className="text-[18px] leading-snug font-medium text-ink" data-testid="summary-sentence"><SentenceWithN sentence={insight.sentence} of={insight.of} what="code" /></p>
            </div>
          ) : (
            <p className="text-sm" data-testid="summary-sentence">{`Only ${plural(s.people, 'person', 'people')} said this, too few to read a pattern.`}</p>
          )}
        </Section>

        <section aria-label="Did their delivery match their words?" data-testid="code-figures" className="flex flex-col gap-2 border-b border-mist px-5 py-4">
          {s.reads.some((r) => r.side) && <h3 className="text-xs font-semibold text-ink" data-testid="match-question">Did their delivery match their words?</h3>}
          <Tiles reads={s.reads} ctx={ctx} code={s.code} />
          <p className="text-xs text-graphite tabular-nums" data-testid="code-coverage">
            {[s.reads.filter((r) => !r.side).length ? `${s.reads.filter((r) => !r.side).length} just described it` : '', s.emotions.noVideo ? `${s.emotions.noVideo} audio-only, read on speech` : ''].filter(Boolean).join(' · ') || 'Everyone who said it was read on speech.'}
          </p>
        </section>

        <Section label="Moments to watch" testid="moments-section">
          <Moments moments={s.moments} studyId={ctx.studyId} fits={fitsOf(s.reads)} />
        </Section>

        <Section label="Tensions on this code" testid="tensions-section">
          <TensionLinks list={mine} onOpenTension={onOpenTension} />
        </Section>

        <section aria-label="Customise" data-testid="customise" className="flex flex-col gap-2 border-b border-mist px-5 py-4">
          <button type="button" aria-expanded={custom} onClick={() => setCustom((c) => !c)} data-testid="customise-toggle" className="min-h-6 cursor-pointer self-start rounded-xs text-xs font-semibold hover:underline">Customise</button>
          {custom && (
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-3">
                <Switch checked={inReport} onChange={(on) => ctx.act((d) => setCodeOverride(d, s.code, on === themeAccepted ? undefined : on, { by: ctx.me }))} label={`Put the moments of ${s.code.name} in the report`} testid="code-override" />
                <span>Put this code’s moments in the report</span>
              </label>
              <p className="text-xs text-graphite" data-testid="override-note">
                {override === undefined ? `Follows its theme: ${themeAccepted ? 'accepted, so it goes in' : 'not accepted, so it stays out'}.` : `Set by you. Its theme says ${themeAccepted ? 'in' : 'out'}.`}
              </p>
            </div>
          )}
        </section>
      </div>
      <footer className="border-t border-mist bg-paper px-5 py-3 text-xs text-graphite tabular-nums" data-testid="approval-line">
        {theme ? `Theme “${theme.name}”: ${approval}` : approval} · {codeStance(doc, s.code.id) === 'Neutral' ? 'Words: just describes' : `Words: ${codeStance(doc, s.code.id) === 'Positive' ? 'for it' : 'against it'}`} · data v{dataVersionOf(doc)}
      </footer>
    </section>
  )
}

