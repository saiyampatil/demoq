import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { codebookReadiness } from '@/state/analysisProgress'
import { CODEBOOK_STUDY, counts, rebuild, updateCodebook, type CodebookDoc } from '@/state/codebook'
import { PageHeader } from '../../shared/PageHeader'
import { AnalysisStepper } from './AnalysisStepper'
import { ChangeLog } from './ChangeLog'
import { ContinueBar } from './ContinueBar'
import { CodesTab, type StatusFilter } from './CodesTab'
import { ExportButton } from './exportCodebook'
import { ThemesTab } from './ThemesTab'
import type { CodebookCtx } from './codebookCtx'
import { useAnalysis } from './useAnalysis'

const TABS = [
  { key: 'codes', label: 'Codes' },
  { key: 'themes', label: 'Themes' },
  { key: 'log', label: 'Change log' },
] as const
type Tab = (typeof TABS)[number]['key']

/** A1: the living codebook. Codes, themes and their history in one place, built on the sessions accepted in Review. */
export function Codebook() {
  const { studyId, study, review, me, accepted, doc, basis, stale } = useAnalysis()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'codes') as Tab
  const demo = params.get('demo')
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(demo === 'error')
  const [status, setStatus] = useState<StatusFilter>('Suggested')
  const [picked, setPicked] = useState<string>()

  const excluded = review.filter((r) => r.status === 'Excluded').length
  const undecided = review.filter((r) => r.status === 'Under review').length

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 500)
    return () => clearTimeout(t)
  }, [studyId])

  if (!study) return null

  const go = (t: Tab) => setParams((p) => (t === 'codes' ? p.delete('tab') : p.set('tab', t), p), { replace: true })
  const header = (extra?: React.ReactNode) => (
    <>
      <PageHeader
        id="A1"
        title="Codebook"
        description="Short labels for what people said, grouped into themes. PulseAI suggests; nothing counts until you accept it."
        meta={doc ? <BuiltOn doc={doc} accepted={accepted.length} excluded={excluded} studyId={studyId} /> : undefined}
        actions={doc && loaded && !failed ? <ExportButton doc={doc} basis={basis} studyName={study.name} /> : undefined}
      />
      <AnalysisStepper studyId={studyId} current="codebook" />
      {extra}
    </>
  )

  if (studyId !== CODEBOOK_STUDY || !accepted.length)
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          {studyId !== CODEBOOK_STUDY ? (
            <EmptyState
              title="No codebook for this study yet"
              description="The codebook is built from interviews accepted in Review. In this prototype it’s built on Pet Food Subscription Churn."
              action={<Button to={studyPath(CODEBOOK_STUDY, screenById.A1)}>Open Pet Food Subscription Churn</Button>}
            />
          ) : (
            <EmptyState title="No accepted interviews yet" description="Codes are drawn only from sessions accepted in Review." action={<Button to={studyPath(studyId, screenById.R21)}>Open Review</Button>} />
          )}
        </div>
      </div>
    )

  if (failed)
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="rounded-md border border-mist bg-surface">
          <ErrorState title="The codebook didn’t load" description="Your codes and decisions are safe. Try loading it again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )

  if (!loaded || !doc)
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="rounded-md border border-mist bg-surface p-5">
          <LoadingState label={`Loading the codebook for ${accepted.length} accepted sessions`} rows={7} />
        </div>
      </div>
    )

  const ctx: CodebookCtx = { doc, basis, me, studyId, act: (fn) => updateCodebook(studyId, fn) }
  const c = counts(doc)
  const showCodes = (s: StatusFilter) => {
    setStatus(s)
    go('codes')
  }

  return (
    <div className="flex flex-col gap-6">
      {header(
        <>
          <Stale doc={doc} accepted={accepted} undecided={undecided} onUpdate={() => ctx.act((d) => rebuild(d, accepted.map((s) => s.id), { by: me }))} />
          <Summary c={c} status={tab === 'codes' ? status : undefined} onPick={showCodes} onThemes={() => go('themes')} />
        </>,
      )}

      <div>
        <div role="tablist" aria-label="Codebook views" className="flex gap-1 border-b border-mist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`cbtab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="codebook-panel"
              onClick={() => go(t.key)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
            >
              {t.label}
              {t.key === 'themes' && <span className="ml-1.5 text-xs text-muted tabular-nums">{c.themes}</span>}
            </button>
          ))}
        </div>
        <div id="codebook-panel" role="tabpanel" aria-labelledby={`cbtab-${tab}`} className="pt-5">
          {tab === 'codes' && <CodesTab ctx={ctx} status={status} setStatus={setStatus} picked={picked} setPicked={setPicked} />}
          {tab === 'themes' && (
            <ThemesTab
              ctx={ctx}
              onOpenCode={(id) => {
                setStatus('All')
                setPicked(id)
                go('codes')
              }}
            />
          )}
          {tab === 'log' && <ChangeLog ctx={ctx} />}
        </div>
      </div>

      <ContinueBar
        studyId={studyId}
        readiness={codebookReadiness(doc, stale)}
        next={{ screen: 'A2', label: 'Continue to Signals & tensions' }}
        stay="Keep working on the codebook"
        message={
          c.accepted === 0
            ? 'No code is accepted yet. Accept at least one to continue.'
            : c.suggested > 0
              ? `${c.suggested} ${c.suggested === 1 ? 'code' : 'codes'} still to review · ${c.themes} ${c.themes === 1 ? 'theme' : 'themes'}`
              : c.themes === 0
                ? 'Every code has a decision. Group the accepted ones into themes, or continue.'
                : `Every code has a decision · ${c.themes} ${c.themes === 1 ? 'theme' : 'themes'}. Next: how they said it, and where it doesn’t add up.`
        }
      />
    </div>
  )
}

function BuiltOn({ doc, accepted, excluded, studyId }: { doc: CodebookDoc; accepted: number; excluded: number; studyId: string }) {
  return (
    <>
      <span>
        Built on <span className="font-medium text-ink tabular-nums">{accepted}</span> sessions accepted in{' '}
        <Link to={studyPath(studyId, screenById.R21)} className="font-medium text-iris-700 hover:underline">
          Review
        </Link>
        {excluded > 0 && <span className="tabular-nums">, {excluded} excluded and left out</span>}
      </span>
      <span>Corrected transcripts used where they exist</span>
      <span>Coded by PulseAI {formatStamp(doc.codedAt)}</span>
    </>
  )
}

/** The page's one number strip. Each status is also the filter for the code list. */
function Summary({ c, status, onPick, onThemes }: { c: ReturnType<typeof counts>; status?: StatusFilter; onPick: (s: StatusFilter) => void; onThemes: () => void }) {
  const decided = c.total - c.suggested
  const items: { key: StatusFilter; label: string; n: number; tone: string }[] = [
    { key: 'Suggested', label: 'To review', n: c.suggested, tone: 'bg-pending-fg' },
    { key: 'Accepted', label: 'Accepted', n: c.accepted, tone: 'bg-positive-fg' },
    { key: 'Rejected', label: 'Rejected', n: c.rejected, tone: 'bg-negative-fg' },
    { key: 'Merged', label: 'Merged', n: c.merged, tone: 'bg-held-fg' },
  ]
  return (
    <section aria-label="Codebook at a glance" className="flex flex-wrap items-stretch rounded-md border border-mist bg-surface">
      <div className="flex min-w-56 flex-1 flex-col justify-center gap-2 px-5 py-3.5">
        <p className="text-sm text-graphite">
          <span className="text-lg font-semibold text-ink tabular-nums">{decided}</span> of <span className="tabular-nums">{c.total}</span> codes decided
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
          {items.slice(1).map((i) => (
            <span key={i.key} className={cn('h-full', i.tone)} style={{ width: `${(i.n / c.total) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap border-t border-mist sm:border-t-0 sm:border-l" role="group" aria-label="Show codes by status">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={status === i.key}
            onClick={() => onPick(i.key)}
            data-testid={`sum-${i.key}`}
            className={cn('flex min-w-24 flex-col items-start justify-center gap-0.5 border-r border-mist px-4 py-3 text-left hover:bg-haze', status === i.key && 'bg-paper shadow-[inset_0_-2px_0_var(--color-ink)]')}
          >
            <span className="flex items-center gap-1.5 text-sm text-graphite">
              <span aria-hidden="true" className={cn('size-2 rounded-full', i.tone)} />
              {i.label}
            </span>
            <span className="text-lg font-semibold tabular-nums">{i.n}</span>
          </button>
        ))}
        <button type="button" onClick={onThemes} className="flex min-w-24 flex-col items-start justify-center gap-0.5 px-4 py-3 text-left hover:bg-haze">
          <span className="text-sm text-graphite">Themes</span>
          <span className="text-lg font-semibold tabular-nums">{c.themes}</span>
        </button>
      </div>
    </section>
  )
}

/** If a Review decision changed after coding, say so. Counts already follow Review; Update makes it permanent and logs it. */
function Stale({ doc, accepted, undecided, onUpdate }: { doc: CodebookDoc; accepted: { id: string; participantId: string }[]; undecided: number; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const now = new Set(accepted.map((s) => s.id))
  const out = doc.builtOn.filter((s) => !now.has(s))
  const added = accepted.filter((s) => !doc.builtOn.includes(s.id))
  if (!out.length && !added.length) return null
  const pid = (id: string) => id.replace(/-\d+$/, '')
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-pending-line bg-pending-bg px-4 py-3 text-sm text-pending-fg">
      <p className="min-w-0 flex-1">
        <span className="font-medium">Review changed after coding.</span>{' '}
        {out.length > 0 && <>{out.map(pid).join(', ')} {out.length === 1 ? 'is' : 'are'} no longer accepted, so {out.length === 1 ? 'their quotes are' : 'their quotes are'} left out of every count. </>}
        {added.length > 0 && <>{added.map((s) => s.participantId).join(', ')} {added.length === 1 ? 'was' : 'were'} accepted since and {added.length === 1 ? 'hasn’t' : 'haven’t'} been coded. </>}
        {undecided > 0 && <>{undecided} still {undecided === 1 ? 'waits' : 'wait'} for a decision.</>}
      </p>
      <Button
        size="sm"
        loading={busy}
        onClick={() => {
          setBusy(true)
          setTimeout(() => {
            onUpdate()
            setBusy(false)
          }, 1200)
        }}
      >
        Update the codebook
      </Button>
    </div>
  )
}
