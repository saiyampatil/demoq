import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { EmptyState, LoadingState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { formatSlot } from '@/lib/format'
import { PET_ID } from '@/mock/petFood'
import { screenById, studyPath } from '@/routes/screens'
import { BASE_FILTERS, baseRows, baseSummary, filterRows, type BaseFilter, type BaseRow, type BaseSummary } from '@/state/analysis'
import { PageHeader } from '../../shared/PageHeader'
import { useStudySessions } from '../useStudySessions'
import { AnalysisStepper } from './AnalysisStepper'

const ids = (rows: BaseRow[]) => rows.map((r) => r.participantId).join(', ')

/** A1: Step 0 of Results Analysis. What the analysis is built on, to be checked and approved before any coding. */
export function AnalysisBase() {
  const { studyId, study, doc, review, preview } = useStudySessions()
  const [filter, setFilter] = useState<BaseFilter>('all')
  const [loaded, setLoaded] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(t)
  }, [studyId])

  const rows = useMemo(() => baseRows(review, doc), [review, doc])
  const sum = useMemo(() => baseSummary(rows), [rows])

  if (!study) return null
  // The analysis is built for the Pet Food study in this prototype; the seed study is still being reviewed.
  if (studyId !== PET_ID || !doc || preview)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState
          title="No analysis base for this study"
          description="Results Analysis is built on Pet Food Subscription Churn in this prototype. This study has no finished interviews to analyse."
          action={<Button to={studyPath(PET_ID, screenById.A1)}>Open Pet Food Subscription Churn</Button>}
        />
      </div>
    )

  const show = (f: BaseFilter) => {
    setFilter(f)
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="A1"
        title="Analysis base"
        description="What the analysis is built on. Check it, then approve it to start coding."
        meta={
          <>
            <StatusChip status="Ready to approve" />
            <span>{study.name}</span>
          </>
        }
        actions={
          <Tooltip content="Approval is wired up in Stage 3">
            <Button variant="primary" disabled>
              Approve base
            </Button>
          </Tooltip>
        }
      />

      <AnalysisStepper />

      {!loaded ? (
        <div className="rounded-md border border-mist bg-surface p-5">
          <LoadingState label="Working out what the analysis is built on" rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="No sessions have reached Review yet" description="The analysis base is built from sessions that finished and were accepted in Review." action={<Button to={studyPath(studyId, screenById.R21)}>Open Review</Button>} />
        </div>
      ) : (
        <>
          <Kpis sum={sum} show={show} />
          <div ref={tableRef} className="scroll-mt-4">
            <SessionsCard rows={rows} sum={sum} filter={filter} setFilter={setFilter} studyId={studyId} />
          </div>
        </>
      )}
    </div>
  )
}

function Kpis({ sum, show }: { sum: BaseSummary; show: (f: BaseFilter) => void }) {
  const inN = sum.included.length
  const cards: { key: string; label: string; n: number; of: string; note: string; filter: BaseFilter }[] = [
    {
      key: 'included',
      label: 'In the analysis',
      n: inN,
      of: `of ${sum.completed} completed`,
      note: sum.undecided.length ? `${sum.undecided.length} waiting for a Review decision` : 'Accepted in Review',
      filter: 'included',
    },
    { key: 'excluded', label: 'Excluded in Review', n: sum.excluded.length, of: `of ${sum.completed} completed`, note: sum.excluded.length ? `${ids(sum.excluded)}. Kept visible, not analysed.` : 'None', filter: 'excluded' },
    { key: 'corrected', label: 'Using a corrected transcript', n: sum.corrected.length, of: `of ${inN} in the analysis`, note: sum.corrected.length ? `${ids(sum.corrected)} (${sum.corrected[0].transcript.label.replace('Reviewed ', '')})` : 'None', filter: 'corrected' },
    {
      key: 'caveat',
      label: 'Carry a caveat',
      n: sum.caveated.length,
      of: `of ${inN} in the analysis`,
      note: `${ids(sum.caveated)}${sum.questionLevel.length ? `. ${sum.questionLevel.length} more are handled per question.` : ''}`,
      filter: 'caveat',
    },
    { key: 'video', label: 'Video available', n: sum.video, of: `of ${inN} in the analysis`, note: `${sum.audioOnly.length} audio-only`, filter: 'audio' },
  ]
  return (
    <section aria-label="Base at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => show(c.filter)}
          data-testid={`kpi-${c.key}`}
          className="flex min-w-0 flex-col rounded-md border border-mist bg-surface p-3.5 text-left transition-colors hover:border-mist-strong hover:bg-paper"
        >
          <span className="flex-1 text-sm text-graphite">{c.label}</span>
          <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xl font-semibold tabular-nums">{c.n}</span>
            <span className="text-sm text-graphite tabular-nums">{c.of}</span>
          </span>
          <span className="mt-1 text-xs text-graphite tabular-nums">{c.note}</span>
        </button>
      ))}
    </section>
  )
}

function SessionsCard({ rows, sum, filter, setFilter, studyId }: { rows: BaseRow[]; sum: BaseSummary; filter: BaseFilter; setFilter: (f: BaseFilter) => void; studyId: string }) {
  const navigate = useNavigate()
  const shown = filterRows(rows, filter)
  const counts: Record<BaseFilter, number> = {
    all: rows.length,
    included: sum.included.length,
    excluded: rows.length - sum.included.length,
    corrected: sum.corrected.length,
    caveat: sum.caveated.length,
    audio: sum.audioOnly.length,
  }
  const href = (id: string) => `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', id) })}?from=analysis-base`
  const firstOut = shown.findIndex((r) => !r.inAnalysis)
  const outLabel = (n: number) => (n === 1 ? 'Not in analysis (1)' : `Not in analysis (${n})`)

  return (
    <Card
      title="Sessions in the base"
      description={
        <>
          To change who’s included, change the decision in{' '}
          <Link to={studyPath(studyId, screenById.R21)} className="font-medium text-iris-700 hover:underline">
            Review
          </Link>
          .
        </>
      }
      flush
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-mist px-5 py-2.5" role="group" aria-label="Filter the sessions">
        {BASE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-sm',
              filter === f.key ? 'border-ink bg-ink text-white' : 'border-mist-strong bg-surface text-graphite hover:bg-haze hover:text-ink',
            )}
          >
            {f.label}
            <span className={cn('text-xs tabular-nums', filter === f.key ? 'text-white/80' : 'text-muted')}>{counts[f.key]}</span>
          </button>
        ))}
        <span className="ml-auto text-sm text-graphite tabular-nums" aria-live="polite">
          Showing {shown.length} of {rows.length} sessions
        </span>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No sessions match" description="Pick another filter to see more." action={<Button onClick={() => setFilter('all')}>Show all sessions</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="base-table">
            <caption className="sr-only">Sessions the analysis is built on, and the ones left out</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                {['Participant', 'Segment', 'Moderator', 'Transcript', 'Media', 'Caveats', 'Review decision'].map((h) => (
                  <th key={h} scope="col" className="h-9 px-2 font-medium whitespace-nowrap first:px-3.5 xl:px-3 xl:first:px-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <RowGroup key={r.sessionId} row={r} first={i === firstOut && filter !== 'excluded'} label={outLabel(shown.length - firstOut)} href={href(r.sessionId)} go={() => navigate(href(r.sessionId))} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function RowGroup({ row: r, first, label, href, go }: { row: BaseRow; first: boolean; label: string; href: string; go: () => void }) {
  return (
    <>
      {first && (
        <tr className="border-b border-mist bg-paper">
          <th colSpan={7} scope="colgroup" className="px-5 py-2 text-left text-sm font-medium text-graphite">
            {label}
            <span className="ml-2 font-normal">Kept visible. Their words are not coded.</span>
          </th>
        </tr>
      )}
      <tr
        data-testid="base-row"
        data-session={r.sessionId}
        data-in-analysis={r.inAnalysis}
        onClick={go}
        className={cn('cursor-pointer border-b border-mist align-top last:border-0 hover:bg-haze', !r.inAnalysis && 'bg-paper text-graphite')}
      >
        <td className="px-3.5 py-3 xl:px-5">
          <Link to={href} onClick={(e) => e.stopPropagation()} className={cn('font-medium tabular-nums underline-offset-2 hover:underline', r.inAnalysis ? 'text-iris-700' : 'text-graphite')}>
            {r.participantId}
          </Link>
          {r.notes.map((n) => (
            <p key={n} className="mt-0.5 max-w-44 text-xs text-graphite xl:max-w-64">
              {n}
            </p>
          ))}
        </td>
        <td className="px-2 py-3 whitespace-nowrap xl:px-3">
          {r.region ?? 'Unknown'}
          {r.state && <span className="block text-xs text-graphite">{r.state}</span>}
        </td>
        <td className="px-2 py-3 xl:px-3">
          {r.moderator.kind === 'AI' ? 'AI agent' : r.moderator.kind === 'Human' ? `Human (${r.moderator.human})` : <>AI then human ({r.moderator.human})</>}
        </td>
        <td className={cn('px-2 py-3 whitespace-nowrap xl:px-3', r.transcript.reviewed ? 'font-medium' : 'text-graphite')}>{r.transcript.label}</td>
        <td className="px-2 py-3 xl:px-3">
          {r.media === 'Audio only' ? (
            <span className="inline-flex h-5 items-center rounded-xs border border-held-line bg-held-bg px-1.5 text-xs font-medium whitespace-nowrap text-held-fg">Audio only</span>
          ) : (
            'Video'
          )}
        </td>
        <td className="px-2 py-3 xl:px-3">
          {r.caveats.length === 0 ? (
            <span className="text-muted">None</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {r.caveats.map((c) => (
                <span
                  key={c.flagId}
                  title={`${c.detail}${c.scope === 'question' ? ' Only that answer is left out; the session stays in.' : ''}`}
                  className={cn(
                    'inline-flex h-5 items-center rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap',
                    c.scope === 'session' ? 'border-pending-line bg-pending-bg text-pending-fg' : 'border-held-line bg-held-bg text-held-fg',
                  )}
                >
                  {c.label}
                </span>
              ))}
            </span>
          )}
        </td>
        <td className="px-2 py-3 xl:px-3">
          <StatusChip status={r.status} size="sm" />
          {!r.inAnalysis && <span className="mt-1 block text-xs font-medium text-graphite">Not in analysis</span>}
          {r.decidedAt && <span className="mt-0.5 block max-w-28 text-xs text-graphite xl:max-w-none">{formatSlot(r.decidedAt)}</span>}
        </td>
      </tr>
    </>
  )
}
