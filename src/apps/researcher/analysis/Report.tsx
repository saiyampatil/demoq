import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { controlBase } from '@/components/Field'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { WizardFooter } from '@/components/WizardFooter'
import { PageHeader } from '../../shared/PageHeader'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY, dismissTension, updateCodebook } from '@/state/codebook'
import { uid } from '@/state/brief'
import { FINDING_DRAFTS, QUESTION_IDS, type SeedSentence } from '@/mock/report'
import { execDraft } from '@/state/execSummary'
import {
  REPORT_USER,
  applyUpdate,
  approveSentence,
  copyAIToResearcher,
  deleteSentence,
  ensureReport,
  includeFinding,
  omitFinding,
  replaceAIDraft,
  syncAIDraft,
  saveSentence,
  setActive,
  isCurrentReport,
  useReport,
  updateReport,
  withdrawApproval,
  type Sentence,
  type Target,
} from '@/state/report'
import { plural, renderTemplate, reportModel } from '@/state/reportLogic'
import { AnalysisStepper } from './AnalysisStepper'
import { ExploreDrawer, type ExploreTab } from './explore/ExploreControl'
import { ExecCard, SectionRow, ThemeRows } from './report/Centre'
import { ReviewStudio } from './report/ReviewStudio'
import { CompareStudio, ComingStudio, ExcludedDialog, ReleaseStudio } from './report/OtherStudios'
import { Selected } from './report/Side'
import { Tools } from './report/Tools'
import { WsProvider, type Act, type Selection, type ToolKey, type Ws } from './report/ws'
import { useAnalysis } from './useAnalysis'

const EXPLORE_TOOLS: Partial<Record<ToolKey, ExploreTab>> = { ask: 'ask', numbers: 'numbers', highlights: 'highlights' }

/** A3: the report the client will receive, as one workspace. Everything in it comes from what was approved earlier in Analysis. */
export function Report() {
  const { studyId, study, review, me, accepted, doc, basis, stale, ready } = useAnalysis()
  const saved = useReport(studyId)
  // A report saved by an older version has a different shape. It is treated as missing and replaced in the effect below.
  const report = isCurrentReport(saved) ? saved : undefined
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [sel, setSel] = useState<Selection>(null)
  const [studio, setStudio] = useState<ToolKey | null>(null)
  const [exploreTab, setExploreTab] = useState<ExploreTab>('highlights')
  const [openSections, setOpenSections] = useState<Set<string> | null>(null)
  const [themesOpen, setThemesOpen] = useState(false)
  const [excludedOpen, setExcludedOpen] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(t)
  }, [studyId])

  const ctx = useMemo(() => (doc ? { doc, basis } : undefined), [doc, basis])
  const rendered = useCallback((list: SeedSentence[]): Sentence[] => list.map((s) => ({ id: s.id, template: s.template, cites: [...s.cites], text: ctx ? renderTemplate(s.template, ctx) : s.template })), [ctx])

  // First visit: make the report from the pre-written AI drafts, with today's numbers filled in. In an effect, never in render.
  useEffect(() => {
    if (ready && doc && ctx && !report) {
      ensureReport(studyId, doc.builtOn, QUESTION_IDS, { exec: rendered(execDraft(ctx)), findings: Object.fromEntries(Object.entries(FINDING_DRAFTS).map(([k, v]) => [k, rendered(v)])) })
    }
  }, [ready, doc, ctx, report, studyId, rendered])

  // The summary's AI draft follows the data: a tension added as a theme gains its sentence, a dismissed or restored one loses or regains it.
  const wantedExec = useMemo(() => (ctx ? rendered(execDraft(ctx)) : undefined), [ctx, rendered])
  useEffect(() => {
    // Only write when something would change: a write always stamps the report as updated, which would run this again.
    if (report && wantedExec && syncAIDraft(report, 'exec', wantedExec) !== report) updateReport(studyId, (r) => syncAIDraft(r, 'exec', wantedExec))
  }, [report, wantedExec, studyId])

  const model = useMemo(() => (report && doc ? reportModel(report, doc, basis) : undefined), [report, doc, basis])

  // Sections: the first one with something to approve is open to begin with.
  const sectionsOpen = useMemo(() => {
    if (openSections) return openSections
    const first = model?.sections.find((s) => s.findings.some((f) => f.sentences.some((x) => x.open))) ?? model?.sections[0]
    return new Set(first ? [first.id] : [])
  }, [openSections, model])
  const toggle = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev ?? sectionsOpen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const excludedSessions = useMemo(() => review.filter((x) => x.status === 'Excluded'), [review])

  const update = useCallback((fn: Parameters<typeof updateReport>[1]) => updateReport(studyId, fn), [studyId])

  const act: Act = useMemo(() => {
    const by = REPORT_USER
    const seedFor = (t: Target) => rendered(t === 'exec' ? (ctx ? execDraft(ctx) : []) : (FINDING_DRAFTS[t.questionId] ?? []))
    return {
      approve: (id, opts) => update((r) => approveSentence(r, id, { by }, opts)),
      withdraw: (id) => update((r) => withdrawApproval(r, id, { by })),
      applyUpdate: (target, id, live) => update((r) => applyUpdate(r, target, id, live, { by })),
      setActive: (target, kind) => update((r) => setActive(r, target, kind, { by })),
      startFromAI: (target) => update((r) => copyAIToResearcher(r, target, { by })),
      regenerate: (target) => {
        const key = target === 'exec' ? 'exec' : target.questionId
        setRegenerating(key)
        timer.current = window.setTimeout(() => {
          update((r) => replaceAIDraft(r, target, seedFor(target).map((s) => ({ ...s, id: uid('s') })), { by }))
          setRegenerating(null)
        }, 900)
      },
      save: (target, id, value) => update((r) => saveSentence(r, target, id, value, { by })),
      remove: (target, id) => update((r) => deleteSentence(r, target, id, { by })),
      omit: (q, why) => update((r) => omitFinding(r, q, why, { by })),
      include: (q) => update((r) => includeFinding(r, q, { by })),
      dismissTension: (t, why) => updateCodebook(studyId, (d) => dismissTension(d, t, { by }, why)),
      regenerating,
    }
  }, [update, rendered, studyId, regenerating, ctx])

  const goTo = useCallback(
    (s: Selection) => {
      setSel(s)
      if (!s || !model) return
      let el = 'exec-card'
      if (s.kind === 'sentence') {
        const f = model.findings.find((x) => x.sentences.some((i) => i.sentence.id === s.id))
        if (f) {
          const sec = model.sections.find((x) => x.findings.includes(f))
          if (sec) setOpenSections((prev) => new Set([...(prev ?? sectionsOpen), sec.id]))
          el = `sentence-${s.id}`
        } else el = `sentence-${s.id}`
      }
      window.setTimeout(() => document.getElementById(el)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    },
    [model, sectionsOpen],
  )

  if (!study) return null
  const excluded = excludedSessions.length

  const header = (
    <>
      <PageHeader
        id="A3"
        title="Report"
        titleAside={model && ready ? <StatusChip status={model.all.length === 0 ? 'Draft' : model.open.length === 0 ? 'Approved' : model.all.some((s) => !s.open) ? 'In Review' : 'Draft'} /> : undefined}
        description="The report the client will receive. Everything in it comes from what you approved in the codebook and Emotion & behaviour. Nothing reaches the client until you publish."
        actions={
          ready && doc && model ? (
            <>
              <label className="flex items-center gap-2 text-sm text-graphite">
                Lens
                <select aria-label="Lens" data-testid="lens-select" defaultValue="whole" className={controlBase + ' h-9 pr-8 text-sm text-ink'}>
                  <option value="whole">Whole study</option>
                  <option disabled>Make a lens in Tools › Lens builder</option>
                </select>
              </label>
              <Button onClick={() => setStudio('release')} data-testid="client-preview">
                Client preview
              </Button>
            </>
          ) : undefined
        }
      />
      <AnalysisStepper studyId={studyId} current="report" />
    </>
  )

  if (!ready || !doc)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={studyId === CODEBOOK_STUDY ? 'No accepted interviews yet' : 'No analysis for this study yet'}
            description={studyId === CODEBOOK_STUDY ? 'Findings are written only from sessions accepted in Review, after the codebook is built.' : 'Results Analysis is built on Pet Food Subscription Churn in this prototype.'}
            action={<Button to={studyPath(CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>}
          />
        </div>
      </div>
    )

  if (failed)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface">
          <ErrorState title="The report didn’t load" description="Your drafts and approvals are safe. Try loading it again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )

  if (!loaded || !report || !model)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5" role="status">
          <LoadingState label={`Building the report from ${plural(accepted.length, 'accepted session')}`} rows={6} />
        </div>
      </div>
    )

  // Theme videos and Showreel are their own page, opened only when clicked. Everything else opens a pop-up over the report.
  const openStudio = (k: ToolKey | null) => (k === 'theme-videos' || k === 'showreel' ? navigate(`${studyPath(studyId, screenById.A3V)}${k === 'showreel' ? '?tab=showreel' : ''}`) : setStudio(k))
  const ws: Ws = { goTo, studyId, me, doc, basis, ctx: { doc, basis }, report, model, accepted: accepted.length, excluded, sel, select: setSel, openStudio, act }
  const total = model.all.length
  const open = model.open.length
  const approved = total - open
  const exploreTool = studio ? EXPLORE_TOOLS[studio] : undefined

  return (
    <WsProvider value={ws}>
      <div className="flex flex-col gap-5">
        {header}

        {stale && (
          <Banner tone="warning" title="Review changed after the codebook was built" actions={<Button size="sm" to={studyPath(studyId, screenById.A1)}>Update the codebook</Button>}>
            The counts below follow Review. Update the codebook so they match.
          </Banner>
        )}

        <p className="text-sm text-graphite" data-testid="built-on">
          <span className="font-medium text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
          {' · '}
          {excluded > 0 ? (
            <button type="button" onClick={() => setExcludedOpen(true)} className="rounded-xs underline underline-offset-2 hover:text-ink" data-testid="excluded-open">
              {excluded} excluded left out
            </button>
          ) : (
            'none excluded'
          )}
          {study.releaseVersion && <> · {study.releaseVersion}</>}
        </p>

        {/* The right column opens only when something is selected: a sentence, a source mark or a finding. */}
        <div className={sel ? 'grid items-start gap-5 lg:grid-cols-[224px_minmax(0,1fr)_320px]' : 'grid items-start gap-5 lg:grid-cols-[224px_minmax(0,1fr)]'}>
          <div className="order-2 lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <Tools />
          </div>

          <main className="order-1 flex min-w-0 flex-col gap-3 lg:order-2" aria-label="Report" data-testid="report">
            <ExecCard />
            <div className="flex items-center justify-between pt-1">
              <h2 className="text-xs font-semibold tracking-wide text-graphite uppercase">Findings by guide section</h2>
              <button type="button" className="text-xs text-graphite underline-offset-2 hover:underline" onClick={() => setOpenSections(sectionsOpen.size === model.sections.length ? new Set() : new Set(model.sections.map((s) => s.id)))} data-testid="toggle-all-sections">
                {sectionsOpen.size === model.sections.length ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
            {model.sections.map((s) => (
              <SectionRow key={s.id} label={s.label} findings={s.findings} open={sectionsOpen.has(s.id)} onToggle={() => toggle(s.id)} />
            ))}
            <ThemeRows themes={model.themes} open={themesOpen} onToggle={() => setThemesOpen((o) => !o)} />
          </main>

          {sel && (
            <aside aria-label="Sources" className="order-3 flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
              <Selected onClose={() => setSel(null)} />
            </aside>
          )}
        </div>

        <WizardFooter
          previous={{ to: studyPath(studyId, screenById.A2), label: 'Emotion & behaviour' }}
          message={
            <span data-testid="report-status">
              {total === 0 ? 'The report has no sentences yet.' : open > 0 ? `${approved} of ${plural(total, 'sentence')} approved · ${open} to review before you can publish.` : `All ${plural(total, 'sentence')} approved and cited. Ready to publish.`}
            </span>
          }
        >
          {open > 0 ? (
            <Button variant="primary" onClick={() => setStudio('review')} data-testid="primary-action">
              Review {plural(open, 'sentence')}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setStudio('release')} data-testid="primary-action">
              Publish
            </Button>
          )}
        </WizardFooter>

        {studio === 'review' && <ReviewStudio onClose={() => setStudio(null)} onRelease={() => setStudio('release')} />}
        {studio === 'compare' && <CompareStudio onClose={() => setStudio(null)} />}
        {studio === 'release' && <ReleaseStudio onClose={() => setStudio(null)} onReview={() => setStudio('review')} stale={stale} />}
        {studio && !exploreTool && studio !== 'review' && studio !== 'compare' && studio !== 'release' && <ComingStudio tool={studio} onClose={() => setStudio(null)} />}
        <ExploreDrawer open={!!exploreTool} onClose={() => setStudio(null)} tab={exploreTool ?? exploreTab} onTab={(t) => (setExploreTab(t), setStudio(t))} doc={doc} basis={basis} me={me} studyId={studyId} />
        <ExcludedDialog open={excludedOpen} onClose={() => setExcludedOpen(false)} sessions={excludedSessions} />
      </div>
    </WsProvider>
  )
}
