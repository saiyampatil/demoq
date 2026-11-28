import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { Modal } from '@/components/Modal'
import { EmptyState, LoadingState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { useToast } from '@/components/Toast'
import { WizardFooter } from '@/components/WizardFooter'
import { hasAnalysis } from '@/mock/studyAnalysis'
import { screenById, studyPath } from '@/routes/screens'
import { counts as codeCounts, CODEBOOK_STUDY, codeThemes } from '@/state/codebook'
import { conceptRows } from '@/state/concepts'
import { changesSince, execOf, nextVersion, type PublishedVersion } from '@/state/report'
import { questionGroupSummary, type Block, type BlockKind } from '@/state/reportBlocks'
import type { Line } from '@/state/reportLines'
import { plural } from '@/state/reportLogic'
import { themeSignals, tensionsOf } from '@/state/signals'
import { useAudioSummary } from '@/state/audioSummary'
import { clock, totalSeconds } from '@/state/audioScript'
import { PageHeader } from '../../shared/PageHeader'
import { useReportModel } from './useReportModel'
import { AnalysisTabs } from './a3/AnalysisTabs'
import { BlockCard, Collapse, type BlockActs } from './a3/BlockCard'
import { Dot } from './a3/parts'
import { SourcesDrawer } from './a3/SourcesDrawer'

const kindOf = (id: string): BlockKind => (id.startsWith('q:') ? 'question' : (id as BlockKind))
const shortName = (b: Block) => (b.kind === 'question' ? `Question ${b.number}` : b.title)

/** A published snapshot read back as blocks, so the client preview can show it with the same components. */
const fromPublished = (v: PublishedVersion): Block[] =>
  v.blocks.map((p) => ({ id: p.id, kind: kindOf(p.id), title: p.title, kicker: p.kicker, number: p.number, lines: p.lines, footnote: p.footnote, defaultOpen: kindOf(p.id) !== 'question', fingerprint: p.fingerprint, status: 'Approved' as const }))

/** A3, the report the client will receive. Everything in it comes from what was accepted in A1 and A2; nothing reaches the client until published. */
export function Report() {
  const r = useReportModel()
  const { studyId, study, accepted, ready, doc, basis, model, report, act, review, stale, inputs } = r
  const toast = useToast()
  const audio = useAudioSummary(studyId)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [groupOpen, setGroupOpen] = useState(false)
  const [sel, setSel] = useState<{ blockId: string; lineId: string } | null>(null)
  const [preview, setPreview] = useState<null | 'draft' | 'published'>(null)
  const [review2, setReview2] = useState<{ queue: string[]; total: number; done: number } | null>(null)
  const [regen, setRegen] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [exportsOpen, setExportsOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const blocks = model?.blocks ?? []
  const isOpen = useCallback((b: Block) => open[b.id] ?? true, [open])
  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])

  const goto = useCallback((id: string) => {
    if (id.startsWith('q:')) setGroupOpen(true)
    setOpen((o) => ({ ...o, [id]: true }))
    window.setTimeout(() => document.getElementById(`blk-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }, [])

  // The drawer: arrow keys move between the block's sentences, Esc closes. Not while typing.
  useEffect(() => {
    if (!sel) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === 'Escape') return setSel(null)
      if (/input|textarea|select/i.test(t.tagName) || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
      const b = byId.get(sel.blockId)
      if (!b) return
      const i = b.lines.findIndex((l) => l.id === sel.lineId)
      const next = b.lines[Math.min(b.lines.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) { e.preventDefault(); setSel({ blockId: b.id, lineId: next.id }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel, byId])

  const toA2 = useMemo(() => {
    if (!doc) return 0
    const plain = new Set(codeThemes(doc).map((t) => t.id))
    const todo = (s: string) => s === 'Suggested' || s === 'Out of date'
    const th = themeSignals(doc, basis).filter((t) => plain.has(t.id) && t.decidable && t.now?.text && todo(t.decision.status)).length
    const cr = (conceptRows(doc, basis)?.rows ?? []).filter((x) => x.now.text && todo(x.decision.status)).length
    return th + cr + tensionsOf(doc, basis).filter((t) => !t.unavailable && t.status === 'Suggested').length
  }, [doc, basis])

  if (!study) return null
  const excluded = review.filter((x) => x.status === 'Excluded').length
  const tabCounts = { codebook: doc ? codeCounts(doc).suggested : 0, signals: toA2, report: model?.counts.undecided ?? 0 }

  const published = report?.published ?? []
  const last = published.at(-1)
  const changes = report && model ? changesSince(report, blocks) : []
  const implications = report ? execOf(report).implications : ''

  const acts: BlockActs = {
    approve: (b) => { const prev = act.approve(b); toast(`Approved: ${shortName(b)}`, { label: 'Undo', onClick: () => act.undo(b.id, prev) }, 6000) },
    leaveOut: (b, reason) => { const prev = act.leaveOut(b, reason); toast(`Left out: ${shortName(b)}`, { label: 'Undo', onClick: () => act.undo(b.id, prev) }, 6000) },
    reopen: (b) => act.reopen(b.id),
    regenerate: (b) => {
      setRegen(b.id)
      timer.current = window.setTimeout(() => { setRegen(null); toast(`Regenerated: ${shortName(b)}. Your edited wording was kept.`, { label: 'Undo', onClick: () => toast('Nothing to undo: the wording did not change.') }, 6000) }, 900)
    },
    edit: act.edit, draft: act.draft, mine: act.mine, implications: act.implications, note: act.note,
  }

  const header = (
    <>
      <PageHeader
        id="A3"
        title="Report"
        titleAside={<span data-testid="report-pill" className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold', last ? 'border-positive-line bg-positive-bg text-positive-fg' : 'border-mist bg-haze text-graphite')}>{last ? `Published v${last.version}` : 'Draft'}</span>}
        description="The report the client will receive. Everything in it comes from what you accepted in the codebook and Emotion & behaviour. Nothing reaches the client until you publish."
        actions={ready && model ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setExportsOpen(true)} className="min-h-9 rounded-xs text-sm text-graphite underline-offset-2 hover:underline" data-testid="exports">Exports</button>
            <Button onClick={() => setPreview(last ? 'published' : 'draft')} className="whitespace-nowrap" data-testid="client-preview">Client preview</Button>
          </div>
        ) : undefined}
      />
      <AnalysisTabs studyId={studyId} current="report" counts={tabCounts} />
    </>
  )

  if (!ready || !doc)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={hasAnalysis(studyId) ? 'No accepted interviews yet' : 'No analysis for this study yet'}
            description={hasAnalysis(studyId) ? 'Findings are written only from sessions accepted in Review, after the codebook is built.' : 'Results Analysis is built on two finished studies in this prototype: Pet Food Subscription Churn and Ice Cream Flavour Concept Test.'}
            action={<Button to={studyPath(hasAnalysis(studyId) ? studyId : CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>}
          />
        </div>
      </div>
    )
  if (!model)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5" role="status"><LoadingState label={`Building the report from ${plural(accepted.length, 'accepted session')}`} rows={5} /></div>
      </div>
    )

  const c = model.counts
  const open1 = (b: Block, extra: Partial<React.ComponentProps<typeof BlockCard>> = {}) => (
    <BlockCard
      key={b.id}
      b={b}
      open={isOpen(b)}
      onToggle={() => setOpen((o) => ({ ...o, [b.id]: !isOpen(b) }))}
      studyId={studyId}
      acts={acts}
      selectedLine={sel?.blockId === b.id ? sel.lineId : undefined}
      onOpenLine={(l: Line) => setSel({ blockId: b.id, lineId: l.id })}
      implications={implications}
      regenerating={regen === b.id}
      reviewing={review2?.queue[0] === b.id}
      {...extra}
    />
  )

  // ── Client preview: read-only, only Approved blocks, no statuses, tags or actions ──
  if (preview) {
    const shown = preview === 'published' && last ? fromPublished(last) : blocks.filter((b) => b.status === 'Approved')
    const hidden = preview === 'draft' ? blocks.length - shown.length : 0
    const imp = preview === 'published' && last ? last.implications ?? '' : implications
    const qs = shown.filter((b) => b.kind === 'question')
    return (
      <div className="flex flex-col gap-4" data-testid="client-preview-page">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-md bg-ink px-4 py-2.5 text-sm text-white">
          <span className="font-medium">Client preview</span>
          <span className="text-white/70">Read only. This is what the client sees.</span>
          {last && (
            <span className="inline-flex rounded-sm border border-white/30 p-0.5" role="group" aria-label="Version">
              {(['draft', 'published'] as const).map((v) => <button key={v} type="button" aria-pressed={preview === v} onClick={() => setPreview(v)} className={cn('min-h-8 rounded-xs px-2', preview === v && 'bg-white text-ink')}>{v === 'draft' ? 'Draft' : `Published v${last.version}`}</button>)}
            </span>
          )}
          <Button size="sm" className="ml-auto" onClick={() => { setPreview(null); setSel(null) }} data-testid="exit-preview">Exit preview</Button>
        </div>
        {hidden > 0 && <p className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg" data-testid="hidden-note">{plural(hidden, 'block')} {hidden === 1 ? 'is' : 'are'} hidden because {hidden === 1 ? 'it is' : 'they are'} not approved.</p>}
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <h1 className="text-xl font-semibold">{study.name}</h1>
          {shown.length === 0 && <p className="text-sm text-graphite">Nothing is approved yet, so there is nothing to show the client.</p>}
          {shown.filter((b) => b.kind !== 'question' && ['exec', 'concepts'].includes(b.kind)).map((b) => open1(b, { preview: true, implications: imp }))}
          {qs.length > 0 && <h2 className="pt-2 text-xs font-semibold tracking-wide text-graphite uppercase">Findings by guide section</h2>}
          {qs.map((b) => open1(b, { preview: true }))}
          {shown.filter((b) => ['sounded', 'tensions', 'thin'].includes(b.kind)).map((b) => open1(b, { preview: true }))}
        </div>
        {sel && byId.get(sel.blockId) && <SourcesDrawer studyId={studyId} doc={doc} basis={basis} inputs={inputs} blocks={blocks} block={shown.find((b) => b.id === sel.blockId) ?? byId.get(sel.blockId)!} lineId={sel.lineId} onSelect={(id) => setSel({ blockId: sel.blockId, lineId: id })} onClose={() => setSel(null)} onGoto={() => undefined} />}
      </div>
    )
  }

  const startReview = () => {
    const queue = blocks.filter((b) => b.status === 'To review' || b.status === 'Out of date').map((b) => b.id)
    if (!queue.length) return
    setReview2({ queue, total: queue.length, done: 0 })
    goto(queue[0])
  }
  const advance = (approve: boolean) => {
    if (!review2) return
    const cur = byId.get(review2.queue[0])
    if (approve && cur) acts.approve(cur)
    const rest = review2.queue.slice(1)
    const queue = approve ? rest : [...rest, review2.queue[0]]
    if (!queue.length || (!approve && queue.length === 1 && rest.length === 0)) { setReview2(null); return }
    setReview2({ ...review2, queue, done: review2.done + (approve ? 1 : 0) })
    goto(queue[0])
  }

  const leftToDo = blocks.filter((b) => b.status === 'To review' || b.status === 'Out of date')
  const items: { b: Block; label: string }[] = blocks.map((b) => ({ b, label: b.kind === 'question' ? `${b.number}. ${model.rows[(b.number ?? 1) - 1]?.label ?? b.title}` : b.title }))
  const questions = blocks.filter((b) => b.kind === 'question')
  const head = blocks.filter((b) => b.kind === 'exec' || b.kind === 'concepts')
  const tail = blocks.filter((b) => ['sounded', 'tensions', 'thin'].includes(b.kind))
  const allOpen = blocks.every((b) => isOpen(b)) && groupOpen
  const outputs: { label: string; to: string; id: string; value: string }[] = [
    { label: 'Theme videos', to: studyPath(studyId, screenById.A3V), id: 'theme-videos', value: `${codeThemes(doc).length} themes` },
    { label: 'Showreel', to: `${studyPath(studyId, screenById.A3V)}?tab=showreel`, id: 'showreel', value: 'Open' },
    { label: 'Word cloud', to: studyPath(studyId, screenById.A3W), id: 'word-cloud', value: `${codeCounts(doc).accepted} codes` },
    { label: 'Theme map', to: studyPath(studyId, screenById.A3M), id: 'theme-map', value: `${codeThemes(doc).length} themes` },
    { label: 'Audio summary', to: studyPath(studyId, screenById.A3P), id: 'audio-summary', value: audio ? `${clock(totalSeconds(audio.lines))} · ${audio.release ? `Released v${audio.release.version}` : 'Draft'}` : 'Not started' },
  ]

  return (
    <div className="flex flex-col gap-4" data-testid="report-page">
      {header}
      <p className="text-sm text-graphite" data-testid="built-on">
        <span className="font-medium text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
        {' · '}{excluded > 0 ? `${excluded} excluded left out` : 'none excluded'}
        {study.releaseVersion && <> · {study.releaseVersion}</>}
        {' · '}{inputs.people} people ({inputs.segments.map((g) => `${g.n} ${g.noun}`).join(', ')})
      </p>
      {stale && <Banner tone="warning" title="Review changed after the codebook was built" actions={<Button size="sm" to={studyPath(studyId, screenById.A1)}>Update the codebook</Button>}>The counts below follow Review. Update the codebook so they match.</Banner>}
      {last && changes.length > 0 && (
        <Banner tone="warning" title={`Changes since version ${last.version}`} actions={<Button size="sm" variant="primary" disabled={!c.ready} onClick={() => setPublishOpen(true)} data-testid="republish">Republish as version {nextVersion(report!)}</Button>}>
          <ul className="list-disc pl-4" data-testid="changes">{changes.map((x) => <li key={x}>{x}</li>)}</ul>
        </Banner>
      )}

      <nav aria-label="Outputs" data-testid="outputs" className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <h2 className="sr-only">Outputs</h2>
        {outputs.map((o) => (
          <Link key={o.id} to={o.to} data-testid={`tool-${o.id}`} className="flex min-h-12 flex-col rounded-md border border-mist bg-surface px-3 py-2 hover:bg-haze">
            <span className="text-sm font-medium text-ink">{o.label}</span>
            <span className="text-xs text-graphite tabular-nums">{o.value}</span>
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[216px_minmax(0,1fr)]">
        <nav aria-label="In this report" data-testid="rail" className="flex flex-col gap-0.5 lg:sticky lg:top-4">
          <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-graphite uppercase">In this report</h2>
          {items.map(({ b, label }) => (
            <button key={b.id} type="button" onClick={() => goto(b.id)} data-rail={b.id} className="flex min-h-9 items-center gap-2 rounded-sm px-2 text-left text-sm text-ink hover:bg-haze">
              <Dot status={b.status} /><span className="min-w-0 flex-1 truncate">{label}</span>
            </button>
          ))}
        </nav>

        <main className="flex min-w-0 flex-col gap-3" aria-label="Report" data-testid="report">
          {blocks.length === 0 || (model.summary.empty && !model.summary.lines.length) ? null : (
            <div className="flex justify-end gap-3 text-sm">
              <button type="button" className="min-h-9 text-iris-700 hover:underline" onClick={() => { setGroupOpen(true); setOpen(Object.fromEntries(blocks.map((b) => [b.id, true]))) }} data-testid="expand-all">Expand all</button>
              <span className="text-mist-strong" aria-hidden>|</span>
              <button type="button" className="min-h-9 text-iris-700 hover:underline" onClick={() => { setGroupOpen(false); setOpen(Object.fromEntries(blocks.map((b) => [b.id, false]))) }} data-testid="collapse-all">Collapse all</button>
            </div>
          )}
          {model.summary.empty && <p className="rounded-sm border border-dashed border-mist-strong bg-surface px-4 py-3 text-sm text-graphite" data-testid="report-empty">Nothing is approved in Emotion & behaviour yet. Approve insights there to fill this report.</p>}
          {head.map((b) => open1(b))}
          {questions.length > 0 && (
            <section aria-label="Findings by guide section" data-testid="findings-group" className="flex flex-col gap-3">
              <button type="button" onClick={() => setGroupOpen((g) => !g)} aria-expanded={groupOpen} data-testid="findings-toggle" className="flex min-h-11 items-center gap-2 rounded-md border border-mist bg-surface px-4 text-left hover:bg-haze">
                <span aria-hidden className={cn('transition-transform duration-[180ms] motion-reduce:transition-none', groupOpen && 'rotate-90')}>›</span>
                <span className="text-sm font-semibold text-ink">Findings by guide section</span>
                <span className="text-sm text-graphite" data-testid="findings-summary">{questionGroupSummary(blocks)}</span>
              </button>
              <Collapse open={groupOpen}><div className="flex flex-col gap-3">{questions.map((b) => open1(b))}</div></Collapse>
            </section>
          )}
          {tail.map((b) => open1(b))}
          {!allOpen && null}
        </main>
      </div>

      <WizardFooter previous={{ to: studyPath(studyId, screenById.A2), label: 'Emotion & behaviour' }} message={<span data-testid="report-status">{c.approved} of {c.total} blocks approved{c.leftOut ? ` · ${c.leftOut} left out` : ''}</span>}>
        {c.undecided > 0 && <Button variant={c.undecided > 0 ? 'primary' : 'secondary'} onClick={startReview} data-testid="review-blocks">Review {plural(c.undecided, 'block')}</Button>}
        <Tooltip content={c.ready ? 'Freezes this report exactly as shown. Nothing is sent.' : `Still to decide: ${leftToDo.map(shortName).join(', ')}`} focusable align="right">
          <Button variant={c.ready ? 'primary' : 'secondary'} disabled={!c.ready || (last && changes.length === 0)} onClick={() => setPublishOpen(true)} data-testid="publish">Publish</Button>
        </Tooltip>
      </WizardFooter>

      {review2 && byId.get(review2.queue[0]) && (
        <div role="region" aria-label="Review blocks" data-testid="review-bar" className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md bg-ink px-4 py-2.5 text-sm text-white shadow-xl">
          <span className="tabular-nums">Block {Math.min(review2.total, review2.done + 1)} of {review2.total}</span>
          <span className="max-w-48 truncate text-white/70">{shortName(byId.get(review2.queue[0])!)}</span>
          <Button size="sm" variant="primary" onClick={() => advance(true)} data-testid="approve-next">Approve and next</Button>
          <Button size="sm" onClick={() => advance(false)} data-testid="skip">Skip</Button>
          <button type="button" onClick={() => setReview2(null)} aria-label="Stop reviewing" className="min-h-9 px-1 text-white/70 hover:text-white">×</button>
        </div>
      )}

      {sel && byId.get(sel.blockId) && <SourcesDrawer studyId={studyId} doc={doc} basis={basis} inputs={inputs} blocks={blocks} block={byId.get(sel.blockId)!} lineId={sel.lineId} onSelect={(id) => setSel({ blockId: sel.blockId, lineId: id })} onClose={() => setSel(null)} onGoto={goto} />}

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={`Publish version ${report ? nextVersion(report) : 1}`}
        description="Freezes this report exactly as shown. Nothing is sent. Sharing comes later."
        footer={<><Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { act.publish(); setPublishOpen(false); toast(`Published version ${report ? nextVersion(report) : 1}`) }} data-testid="publish-confirm">Publish</Button></>}
      >
        <p className="text-sm text-graphite">{c.approved} approved {c.approved === 1 ? 'block' : 'blocks'} go into this version{c.leftOut ? `; ${c.leftOut} left out stay out` : ''}.</p>
      </Modal>
      <Modal open={exportsOpen} onClose={() => setExportsOpen(false)} title="Exports" description="The report as a file for the client is built in a later step." footer={<Button onClick={() => setExportsOpen(false)}>Close</Button>} />
    </div>
  )
}
