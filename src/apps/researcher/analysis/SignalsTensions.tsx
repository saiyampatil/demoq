import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import { signalsReadiness } from '@/state/analysisProgress'
import { CODEBOOK_STUDY, updateCodebook } from '@/state/codebook'
import { codeSignals, coverage, plural, tensionCounts, tensionsOf } from '@/state/signals'
import { PageHeader } from '../../shared/PageHeader'
import { AnalysisStepper } from './AnalysisStepper'
import { ContinueBar } from './ContinueBar'
import { SignalsTab, type SignalFocus } from './SignalsTab'
import { TensionsTab, type TensionFilter } from './TensionsTab'
import type { CodebookCtx } from './codebookCtx'
import { useAnalysis } from './useAnalysis'

const TABS = [
  { key: 'signals', label: 'Signals' },
  { key: 'tensions', label: 'Tensions' },
] as const
type Tab = (typeof TABS)[number]['key']

/** A2: how they reacted (face, voice, hesitation), and where that doesn't match what they said. Read on the codes accepted in the codebook. */
export function SignalsTensions() {
  const { studyId, study, review, me, accepted, doc, basis, stale, ready } = useAnalysis()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'signals') as Tab
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [filter, setFilter] = useState<TensionFilter>('Suggested')
  const [focus, setFocus] = useState<SignalFocus>({ view: 'code' })
  const [focusTension, setFocusTension] = useState<string>()

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 500)
    return () => clearTimeout(t)
  }, [studyId])

  const tensions = useMemo(() => (doc ? tensionsOf(doc, basis) : []), [doc, basis])

  if (!study) return null
  const excluded = review.filter((r) => r.status === 'Excluded').length
  const go = (t: Tab) => setParams((p) => (t === 'signals' ? p.delete('tab') : p.set('tab', t), p), { replace: true })
  /** Moving between the two tabs or to a card brings the content into view, so the Researcher never has to hunt for it. */
  const toPanel = () => setTimeout(() => document.getElementById('signals-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)

  const header = (
    <>
      <PageHeader id="A2" title="Emotion & behaviour" description="How people reacted, and where that doesn’t match what they said. Faces, voices and hesitation are described, never used to exclude a session, and a reading you think is wrong can be corrected." />
      <AnalysisStepper studyId={studyId} current="signals" />
    </>
  )

  if (!ready || !doc)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={studyId === CODEBOOK_STUDY ? 'Accept a code first' : 'No analysis for this study yet'}
            description={studyId === CODEBOOK_STUDY ? 'Signals are measured on the codes you’ve accepted in the codebook.' : 'Results Analysis is built on Pet Food Subscription Churn in this prototype.'}
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
          <ErrorState title="The signals didn’t load" description="Your decisions are safe. Try loading them again." onRetry={() => setFailed(false)} />
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
  const used = codeSignals(doc, basis).filter((s) => s.use).length

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
  const seeSignals = (codeId?: string, momentId?: string) => {
    setFocus(momentId ? { view: 'moment', moment: momentId } : { view: 'code', code: codeId })
    go('signals')
    toPanel()
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

      <div className="flex flex-col gap-2">
        <Progress t={t} tab={tab} filter={filter} onPick={showTensions} />
        <CoverageLine cov={cov} />
      </div>

      <div>
        <div role="tablist" aria-label="Signals and tensions" className="flex gap-1 border-b border-mist">
          {TABS.map((x) => (
            <button
              key={x.key}
              role="tab"
              type="button"
              id={`sttab-${x.key}`}
              aria-selected={tab === x.key}
              aria-controls="signals-panel"
              onClick={() => go(x.key)}
              className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium', tab === x.key ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
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
          {tab === 'signals' && (
            <SignalsTab
              ctx={ctx}
              focus={focus}
              setFocus={setFocus}
              tensions={tensions}
              onOpenTensions={() => showTensions('Suggested')}
              onOpenTension={openTension}
            />
          )}
          {tab === 'tensions' && <TensionsTab ctx={ctx} filter={filter} setFilter={setFilter} focusId={focusTension} onSeeSignals={seeSignals} onContinue={() => navigate(toReportPath)} />}
        </div>
      </div>

      <ContinueBar
        studyId={studyId}
        readiness={signalsReadiness(doc)}
        previous={{ screen: 'A1', label: 'Codebook' }}
        next={{ screen: 'A3', label: 'Continue to Report' }}
        stay="Keep working on tensions"
        lead={tab === 'signals' && t.toReview > 0 ? { label: `Review ${plural(t.toReview, 'tension')}`, onClick: () => showTensions('Suggested') } : undefined}
        message={
          <>
            Goes to the report: {plural(used, 'signal pattern')} and {plural(t.themes, 'tension theme')}.
            {t.toReview > 0 ? <span className="ml-1.5 font-medium text-pending-fg">{plural(t.toReview, 'tension')} still to review.</span> : <span className="ml-1.5 text-positive-fg">Every tension is decided.</span>}
          </>
        }
      />
    </div>
  )
}

/** What the readings are measured on, and what isn't, in one quiet line. Always shown, so nobody reads more into them than is there. */
function CoverageLine({ cov }: { cov: ReturnType<typeof coverage> }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm text-graphite" data-testid="coverage">
      <span>
        Voice and hesitation measured on <span className="font-medium text-ink tabular-nums">{cov.sessions}</span> accepted sessions. Faces read for <span className="font-medium text-ink tabular-nums">{cov.video}</span>
        {cov.audioOnly > 0 && ` (${cov.audioOnly} audio-only, so no face reading, never counted as neutral)`}. {cov.excluded > 0 && `${cov.excluded} excluded in Review are left out.`}
      </span>
      <Tooltip content="Faces are read against each person’s own resting face and described by what was visible. A reading is a lead, not a verdict, and you can correct it." focusable align="left">
        <span className="inline-flex h-5 items-center rounded-xs border border-dashed border-mist-strong px-1.5 text-xs font-medium">How faces are read</span>
      </Tooltip>
    </p>
  )
}

/** One strip: how far the tensions are, and each status as a filter. The signals themselves have no decision to count. */
function Progress({ t, tab, filter, onPick }: { t: ReturnType<typeof tensionCounts>; tab: Tab; filter: TensionFilter; onPick: (f: TensionFilter) => void }) {
  const items: { key: TensionFilter; label: string; n: number; tone: string }[] = [
    { key: 'Suggested', label: 'To review', n: t.toReview, tone: 'bg-pending-fg' },
    { key: 'Turned into a theme', label: 'Turned into themes', n: t.themes, tone: 'bg-positive-fg' },
    { key: 'Dismissed', label: 'Dismissed', n: t.dismissed, tone: 'bg-held-fg' },
  ]
  const decided = t.total - t.toReview
  return (
    <section aria-label="Tensions at a glance" className="flex flex-wrap items-stretch rounded-md border border-mist bg-surface">
      <div className="flex min-w-56 flex-1 flex-col justify-center gap-2 px-5 py-3">
        <p className="text-sm text-graphite">
          <span className="text-lg font-semibold text-ink tabular-nums">{decided}</span> of <span className="tabular-nums">{t.total}</span> tensions decided
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
          {items.slice(1).map((i) => (
            <span key={i.key} className={cn('h-full', i.tone)} style={{ width: `${t.total ? (i.n / t.total) * 100 : 0}%` }} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap border-t border-mist sm:border-t-0 sm:border-l" role="group" aria-label="Show tensions by status">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={tab === 'tensions' && filter === i.key}
            onClick={() => onPick(i.key)}
            data-testid={`sum-${i.key}`}
            className={cn('flex min-w-28 flex-col items-start justify-center gap-0.5 border-r border-mist px-4 py-2.5 text-left last:border-r-0 hover:bg-haze', tab === 'tensions' && filter === i.key && 'bg-paper shadow-[inset_0_-2px_0_var(--color-ink)]')}
          >
            <span className="flex items-center gap-1.5 text-sm text-graphite">
              <span aria-hidden="true" className={cn('size-2 rounded-full', i.tone)} />
              {i.label}
            </span>
            <span className="text-lg font-semibold tabular-nums">{i.n}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
