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
import { PageHeader } from '../../shared/PageHeader'
import { ExploreControl } from './explore/ExploreControl'
import { AnalysisStepper } from './AnalysisStepper'
import { ContinueBar } from './ContinueBar'
import { ThemesTab } from './themes/Themes'
import { useThemeModel, type SignalFocus } from './themes/model'
import { TensionsTab, type TensionFilter } from './TensionsTab'
import type { CodebookCtx } from './codebookCtx'
import { useAnalysis } from './useAnalysis'

const TABS = [
  { key: 'themes', label: 'Themes' },
  { key: 'tensions', label: 'Tensions' },
] as const
type Tab = (typeof TABS)[number]['key']

/** A2: how people sounded against what they said, and where that doesn't match. Read on the codes accepted in the codebook. */
export function SignalsTensions() {
  const { studyId, study, review, me, accepted, doc, basis, stale, ready } = useAnalysis()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'themes') as Tab
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
  const toReview = counts.toReview.length

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

      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-0.5 border-b border-mist bg-paper/95 px-1 py-2 backdrop-blur" data-testid="a2-header">
        <p className="text-sm text-ink tabular-nums" data-testid="insights-progress">
          {counts.decided} of {counts.total} insights decided ·{' '}
          <button type="button" onClick={() => showTensions('Suggested')} data-testid="tensions-link" className="min-h-6 cursor-pointer rounded-xs font-medium text-iris-700 hover:underline">
            {plural(t.toReview, 'tension')} to review
          </button>
        </p>
        <CoverageLine cov={cov} />
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
              {x.key === 'tensions' && t.toReview > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pending-bg px-1 text-[11px] font-semibold text-pending-fg" aria-label={`${t.toReview} to review`} data-testid="tensions-badge">
                  {t.toReview}
                </span>
              )}
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
          {tab === 'tensions' && <TensionsTab ctx={ctx} filter={filter} setFilter={setFilter} focusId={focusTension} onSeeSignals={seeThemes} onContinue={() => navigate(toReportPath)} />}
        </div>
      </div>

      <ContinueBar
        studyId={studyId}
        readiness={signalsReadiness(doc)}
        previous={{ screen: 'A1', label: 'Codebook' }}
        next={{ screen: 'A3', label: 'Continue to Report' }}
        stay="Keep working on tensions"
        lead={tab === 'themes' && toReview > 0 ? { label: `Review ${plural(toReview, 'insight')}`, onClick: reviewInsights } : undefined}
        message={
          <>
            <span data-testid="report-footer-count">{counts.decided} of {counts.total} insights decided.</span>
            {t.toReview > 0 ? <span className="ml-1.5 font-medium text-pending-fg">{plural(t.toReview, 'tension')} to review.</span> : <span className="ml-1.5 text-positive-fg">Every tension is decided.</span>}
          </>
        }
      />
    </div>
  )
}

/** What the readings are measured on, in one quiet line, so nobody reads more into them than is there. */
function CoverageLine({ cov }: { cov: ReturnType<typeof coverage> }) {
  return (
    <p className="text-xs text-graphite tabular-nums" data-testid="coverage">
      Speech read for {cov.sessions} of {cov.sessions}
      {cov.audioOnly > 0 && ` · ${cov.audioOnly} audio-only, read on speech`}
      {cov.excluded > 0 && ` · ${cov.excluded} excluded in Review are left out`}
    </p>
  )
}
