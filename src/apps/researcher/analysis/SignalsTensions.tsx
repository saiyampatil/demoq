import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import { signalsReadiness } from '@/state/analysisProgress'
import { CODEBOOK_STUDY, updateCodebook } from '@/state/codebook'
import { codeSignals, coverage, tensionCounts, plural } from '@/state/signals'
import { PageHeader } from '../../shared/PageHeader'
import { AnalysisStepper } from './AnalysisStepper'
import { ContinueBar } from './ContinueBar'
import { SignalsTab } from './SignalsTab'
import { TensionsTab, type TensionFilter } from './TensionsTab'
import type { CodebookCtx } from './codebookCtx'
import { useAnalysis } from './useAnalysis'

const TABS = [
  { key: 'signals', label: 'Signals' },
  { key: 'tensions', label: 'Tensions' },
] as const
type Tab = (typeof TABS)[number]['key']

/** A2: how they said it, and where what they said doesn't add up. Measured on the codes accepted in the codebook. */
export function SignalsTensions() {
  const { studyId, study, review, me, accepted, doc, basis, stale, ready } = useAnalysis()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'signals') as Tab
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [filter, setFilter] = useState<TensionFilter>('Suggested')

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 500)
    return () => clearTimeout(t)
  }, [studyId])

  if (!study) return null
  const excluded = review.filter((r) => r.status === 'Excluded').length
  const go = (t: Tab) => setParams((p) => (t === 'signals' ? p.delete('tab') : p.set('tab', t), p), { replace: true })

  const header = (
    <>
      <PageHeader id="A2" title="Signals & tensions" description="How people said it, and where what they said doesn’t add up. Behaviour is described, never diagnosed, and never used to exclude a session." />
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
  const notable = codeSignals(doc, basis).filter((s) => s.notable).length
  const showTensions = (f: TensionFilter) => {
    setFilter(f)
    go('tensions')
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {stale && (
        <Banner tone="warning" title="Review changed after the codebook was built" actions={<Button size="sm" to={studyPath(studyId, screenById.A1)}>Update the codebook</Button>}>
          The signals below follow Review. Update the codebook so its counts match.
        </Banner>
      )}

      <Coverage cov={cov} />
      <Summary t={t} notable={notable} tab={tab} filter={filter} onSignals={() => go('signals')} onPick={showTensions} />

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
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === x.key ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
            >
              {x.label}
              {x.key === 'tensions' && <span className="ml-1.5 text-xs text-muted tabular-nums">{t.total}</span>}
            </button>
          ))}
        </div>
        <div id="signals-panel" role="tabpanel" aria-labelledby={`sttab-${tab}`} className="pt-5">
          {tab === 'signals' && <SignalsTab ctx={ctx} onOpenTensions={() => go('tensions')} />}
          {tab === 'tensions' && <TensionsTab ctx={ctx} filter={filter} setFilter={setFilter} />}
        </div>
      </div>

      <ContinueBar
        studyId={studyId}
        readiness={signalsReadiness(doc)}
        previous={{ screen: 'A1', label: 'Codebook' }}
        next={{ screen: 'A3', label: 'Continue to Report' }}
        stay="Keep working on tensions"
        message={
          t.toReview > 0
            ? `${plural(t.toReview, 'tension')} still to review · ${plural(t.themes, 'theme')} made`
            : `Every tension has a decision · ${plural(t.themes, 'theme')} made. Next: the report.`
        }
      />
    </div>
  )
}

/** What the signals are measured on, and what isn't. Always shown, so nobody reads more into them than is there. */
function Coverage({ cov }: { cov: ReturnType<typeof coverage> }) {
  const item = (label: string, value: string, note?: string) => (
    <div className="flex flex-col px-5 py-3">
      <dt className="text-xs text-graphite">{label}</dt>
      <dd className="mt-0.5 text-sm">
        <span className="text-base font-semibold tabular-nums">{value}</span>
        {note && <span className="ml-1.5 text-xs text-graphite">{note}</span>}
      </dd>
    </div>
  )
  return (
    <section aria-label="What the signals are measured on" className="rounded-md border border-mist bg-surface">
      <dl className="flex flex-wrap divide-x divide-mist" data-testid="coverage">
        {item('Audio signals', `${cov.sessions} of ${cov.sessions}`, 'sessions')}
        {item('Video', `${cov.video} of ${cov.sessions}`, cov.audioOnly ? `${cov.audioOnly} audio-only` : undefined)}
        {item('Left out', String(cov.excluded), 'excluded in Review')}
        <div className="flex flex-1 items-center justify-end px-5 py-3">
          <Tooltip content="Reading emotion from faces is on hold until the consent and legal decision is made." focusable>
            <span className="inline-flex h-6 items-center rounded-xs border border-dashed border-mist-strong px-2 text-xs font-medium text-graphite">Facial analysis: on hold</span>
          </Tooltip>
        </div>
      </dl>
    </section>
  )
}

function Summary({ t, notable, tab, filter, onSignals, onPick }: { t: ReturnType<typeof tensionCounts>; notable: number; tab: Tab; filter: TensionFilter; onSignals: () => void; onPick: (f: TensionFilter) => void }) {
  const items: { key: TensionFilter; label: string; n: number; tone: string }[] = [
    { key: 'Suggested', label: 'To review', n: t.toReview, tone: 'bg-pending-fg' },
    { key: 'Turned into a theme', label: 'Turned into themes', n: t.themes, tone: 'bg-positive-fg' },
    { key: 'Dismissed', label: 'Dismissed', n: t.dismissed, tone: 'bg-held-fg' },
  ]
  const decided = t.total - t.toReview
  return (
    <section aria-label="Signals and tensions at a glance" className="flex flex-wrap items-stretch rounded-md border border-mist bg-surface">
      <button type="button" onClick={onSignals} className="flex min-w-48 flex-col items-start justify-center gap-0.5 px-5 py-3.5 text-left hover:bg-haze">
        <span className="text-sm text-graphite">Worth a look</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums">{notable}</span>
          <span className="text-sm text-graphite">{notable === 1 ? 'code' : 'codes'} with a pattern</span>
        </span>
      </button>
      <div className="flex min-w-56 flex-1 flex-col justify-center gap-2 border-l border-mist px-5 py-3.5">
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
            className={cn('flex min-w-28 flex-col items-start justify-center gap-0.5 border-r border-mist px-4 py-3 text-left last:border-r-0 hover:bg-haze', tab === 'tensions' && filter === i.key && 'bg-paper shadow-[inset_0_-2px_0_var(--color-ink)]')}
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
