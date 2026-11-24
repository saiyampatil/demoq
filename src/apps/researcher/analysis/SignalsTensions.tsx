import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { hasAnalysis } from '@/mock/studyAnalysis'
import { screenById, studyPath } from '@/routes/screens'
import { signalsReadiness } from '@/state/analysisProgress'
import { CODEBOOK_STUDY, updateCodebook } from '@/state/codebook'
import { coverage, plural, tensionCounts, tensionsOf } from '@/state/signals'
import { conceptRows } from '@/state/concepts'
import { PageHeader } from '../../shared/PageHeader'
import { TabBadge } from './a2/ui'
import { ExploreControl } from './explore/ExploreControl'
import { AnalysisStepper } from './AnalysisStepper'
import { ContinueBar } from './ContinueBar'
import { ConceptsTab } from './concepts/Concepts'
import { ThemesTab } from './themes/Themes'
import { useThemeModel, type SignalFocus } from './themes/model'
import { TensionsTab, type TensionFilter } from './TensionsTab'
import type { CodebookCtx } from './codebookCtx'
import { useAnalysis } from './useAnalysis'

const ALL_TABS = [
  { key: 'themes', label: 'Themes' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'tensions', label: 'Tensions' },
] as const
type Tab = (typeof ALL_TABS)[number]['key']

/** A2: how people sounded against what they said, and where that doesn't match. Read on the codes accepted in the codebook. */
export function SignalsTensions() {
  const { studyId, study, review, me, accepted, doc, basis, stale, ready } = useAnalysis()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [filter, setFilter] = useState<TensionFilter>('Suggested')
  const [focus, setFocus] = useState<SignalFocus>({})
  const [focusTension, setFocusTension] = useState<string>()
  const [reviewStart, setReviewStart] = useState(0)

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 500)
    return () => clearTimeout(t)
  }, [studyId])

  const tensions = useMemo(() => (doc ? tensionsOf(doc, basis) : []), [doc, basis])
  const model = useThemeModel(doc, basis)
  const concepts = useMemo(() => (doc ? conceptRows(doc, basis) : undefined), [doc, basis])
  // The Concepts tab only exists when the study showed concepts.
  const TABS = ALL_TABS.filter((t) => t.key !== 'concepts' || !!concepts)
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'themes') as Tab

  if (!study) return null
  const excluded = review.filter((r) => r.status === 'Excluded').length
  const go = (t: Tab) => setParams((p) => (t === 'themes' ? p.delete('tab') : p.set('tab', t), p), { replace: true })
  /** Moving between the two tabs or to a card brings the content into view, so the Researcher never has to hunt for it. */
  const toPanel = () => setTimeout(() => document.getElementById('signals-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)

  const header = (
    <>
      <PageHeader id="A2" title="Emotion & behaviour"  description="How people sounded against what they said, and where that doesn’t match. A reading is described, never used to exclude a session." actions={ready && doc && loaded && !failed ? <ExploreControl doc={doc} basis={basis} me={me} studyId={studyId} /> : undefined} />
      <AnalysisStepper studyId={studyId} current="signals" />
    </>
  )

  if (!ready || !doc || !model)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={hasAnalysis(studyId) ? 'Accept a code first' : 'No analysis for this study yet'}
            description={hasAnalysis(studyId) ? 'This is read on the codes you’ve accepted in the codebook.' : 'Results Analysis is built on the finished studies in this prototype: Pet Food Subscription Churn and Ice Cream Flavour Concept Test.'}
            action={<Button to={studyPath(hasAnalysis(studyId) ? studyId : CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>}
          />
        </div>
      </div>
    )

  if (failed)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface">
          <ErrorState title="The themes didn’t load" description="Your decisions are safe. Try loading them again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )

  if (!loaded)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5">
          <LoadingState label={`Measuring ${plural(accepted.length, 'accepted session')}`} rows={7} />
        </div>
      </div>
    )

  const ctx: CodebookCtx = { doc, basis, me, studyId, act: (fn) => updateCodebook(studyId, fn) }
  const cov = coverage(accepted, excluded)
  const t = tensionCounts(doc)
  const { counts } = model
  // One counter for the footer, the Review button and the tab badges: theme insights plus concept lines. A skipped item is still to decide.
  const conceptLines = concepts ? concepts.rows.filter((r) => r.line) : []
  const conceptsToReview = conceptLines.filter((r) => r.decision.status === 'Suggested' || r.decision.status === 'Out of date').length
  const conceptsDecided = conceptLines.filter((r) => ['Accepted', 'Edited', 'Left out'].includes(r.decision.status)).length
  const total = counts.total + conceptLines.length
  const decided = counts.decided + conceptsDecided
  const toReview = counts.toReview.length + conceptsToReview

  const showTensions = (f: TensionFilter) => {
    setFilter(f)
    go('tensions')
    toPanel()
  }
  const openTension = (id: string) => {
    setFilter('All')
    setFocusTension(id)
    go('tensions')
    toPanel()
  }
  const seeThemes = (codeId?: string) => {
    setFocus({ code: codeId })
    go('themes')
    toPanel()
  }
  const reviewInsights = () => {
    go('themes')
    setReviewStart((n) => n + 1)
  }
  const toReportPath = studyPath(studyId, screenById.A3)

  return (
    <div className="flex flex-col gap-5">
      {header}

      {stale && (
        <Banner tone="warning" title="Review changed after the codebook was built" actions={<Button size="sm" to={studyPath(studyId, screenById.A1)}>Update the codebook</Button>}>
          The signals below follow Review. Update the codebook so its counts match.
        </Banner>
      )}

      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-mist bg-paper/95 px-1 py-2 backdrop-blur" data-testid="a2-header">
        <span className="inline-flex h-6 items-center rounded-full border border-mist-strong bg-surface px-2 text-xs font-medium text-graphite tabular-nums" data-testid="people-chip">{cov.sessions} people</span>
        <CoverageLine cov={cov} concepts={concepts?.coverage} />
      </div>

      <div>
        <div role="tablist" aria-label="Themes and tensions" className="flex gap-1 border-b border-mist" onKeyDown={(e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const i = TABS.findIndex((x) => x.key === tab); const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]; go(n.key); setTimeout(() => document.getElementById(`sttab-${n.key}`)?.focus(), 0) }}>
          {TABS.map((x) => (
            <button
              key={x.key}
              role="tab"
              type="button"
              id={`sttab-${x.key}`}
              aria-selected={tab === x.key}
              tabIndex={tab === x.key ? 0 : -1}
              aria-controls="signals-panel"
              onClick={() => go(x.key)}
              className={cn('-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium', tab === x.key ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
            >
              {x.label}
              {x.key === 'themes' && <TabBadge n={counts.toReview.length} label="insights to review" testid="themes-badge" />}
              {x.key === 'concepts' && <TabBadge n={conceptsToReview} label="concept lines to decide" testid="concepts-badge" />}
              {x.key === 'tensions' && <TabBadge n={t.toReview} label="tensions to review" testid="tensions-badge" />}
            </button>
          ))}
        </div>
        <div id="signals-panel" role="tabpanel" aria-labelledby={`sttab-${tab}`} className="scroll-mt-4 pt-5">
          {tab === 'themes' && (
            <ThemesTab
              ctx={ctx}
              model={model}
              focus={focus}
              setFocus={setFocus}
              tensions={tensions}
              reviewStart={reviewStart}
              onOpenTensions={() => showTensions('Suggested')}
              onOpenTension={openTension}
            />
          )}
          {tab === 'concepts' && concepts && <ConceptsTab ctx={ctx} model={concepts} selected={focus.concept} setSelected={(id) => setFocus({ concept: id })} tensions={tensions} onOpenTension={openTension} />}
          {tab === 'tensions' && <TensionsTab ctx={ctx} filter={filter} setFilter={setFilter} focusId={focusTension} onSeeSignals={seeThemes} onContinue={() => navigate(toReportPath)} />}
        </div>
      </div>

      <ContinueBar
        studyId={studyId}
        readiness={signalsReadiness(doc)}
        previous={{ screen: 'A1', label: 'Codebook' }}
        next={{ screen: 'A3', label: 'Continue to Report' }}
        stay="Keep working on tensions"
        lead={toReview > 0 ? { label: `Review ${plural(toReview, 'insight')}`, onClick: reviewInsights } : undefined}
        message={
          <>
            <span data-testid="report-footer-count">{decided} of {total} insights decided.</span>
            {t.toReview > 0 ? (
              <button type="button" onClick={() => showTensions('Suggested')} data-testid="tensions-link" className="ml-1.5 min-h-9 cursor-pointer rounded-xs font-medium text-ink underline underline-offset-2 hover:text-iris-700">{plural(t.toReview, 'tension')} to review</button>
            ) : (
              <span className="ml-1.5 text-positive-fg">Every tension is decided.</span>
            )}
          </>
        }
      />
    </div>
  )
}

/** What the readings are measured on, in one quiet line, so nobody reads more into them than is there. */
function CoverageLine({ cov, concepts }: { cov: ReturnType<typeof coverage>; concepts?: { read: number; people: number; audioOnly: number } }) {
  return (
    <p className="text-xs text-graphite tabular-nums" data-testid="coverage">
      Speech read for {cov.sessions} of {cov.sessions}
      {cov.audioOnly > 0 && ` · ${cov.audioOnly} audio-only, read on speech`}
      {concepts && <span data-testid="concept-coverage-line"> · Faces read at concept reveals for {concepts.read} of {concepts.people} ({concepts.audioOnly} audio-only)</span>}
      {cov.excluded > 0 && ` · ${cov.excluded} excluded in Review are left out`}
    </p>
  )
}
