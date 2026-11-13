import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../shared/PageHeader'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { EmptyState, ErrorState } from '@/components/States'
import { clipsOfTheme } from '@/mock/showreel'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY } from '@/state/codebook'
import { numbersOf, plural } from '@/state/reportLogic'
import { useShowreel } from '@/state/showreel'
import { AnalysisStepper } from './AnalysisStepper'
import { ReelTab } from './showreel/ReelTab'
import { ThemeVideos, type ThemeData } from './showreel/ThemeVideos'
import { useAnalysis } from './useAnalysis'

/** A3, Theme videos and Showreel. A mock: grey players and clips made from the accepted quotes. Opened from Tools on the Report page. */
export function ShowreelPage() {
  const { studyId, study, review, doc, basis, accepted, ready } = useAnalysis()
  const show = useShowreel(studyId)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'showreel' ? 'showreel' : 'themes'
  const [picked, setPicked] = useState<string>()
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const excluded = review.filter((r) => r.status === 'Excluded').length

  // Accepted themes only: ones with accepted codes behind them. Clips come from accepted sessions only, so an excluded one never appears.
  const themes: ThemeData[] = useMemo(() => {
    if (!doc) return []
    return doc.themes.flatMap((theme) => {
      const num = numbersOf(theme.id, { doc, basis })
      if (!num) return []
      const clips = clipsOfTheme(doc, theme, basis)
      return clips.length || num.n ? [{ id: theme.id, name: theme.name, n: num.n, of: num.of, clips, byId: new Map(clips.map((c) => [c.id, c])) }] : []
    })
  }, [doc, basis])

  const header = (
    <>
      <p>
        <Link to={studyPath(studyId, screenById.A3)} className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline print:hidden" data-testid="back-to-report">
          ‹ Back to Report
        </Link>
      </p>
      <PageHeader
        id="A3"
        title="Theme videos and showreel"
        description="Short clips from the accepted quotes, built into a video for each theme and one showreel for the study. This is a mock: no real video is made."
        actions={
          ready && doc ? (
            <label className="flex items-center gap-2 text-sm text-graphite">
              Lens
              <select aria-label="Lens" data-testid="lens-select" defaultValue="whole" className={controlBase + ' h-9 pr-8 text-sm text-ink'}>
                <option value="whole">Whole study</option>
                <option disabled>Make a lens in Tools › Lens builder</option>
              </select>
            </label>
          ) : undefined
        }
      />
      <AnalysisStepper studyId={studyId} current="report" />
    </>
  )

  if (!study) return null
  if (!ready || !doc)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={studyId === CODEBOOK_STUDY ? 'No accepted interviews yet' : 'No analysis for this study yet'}
            description="Clips come only from sessions accepted in Review."
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
          <ErrorState title="The clips didn’t load" description="Nothing was lost. Try again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )

  const selectedId = picked && themes.some((t) => t.id === picked) ? picked : themes[0]?.id
  const setTab = (t: 'themes' | 'showreel') => setParams(t === 'themes' ? {} : { tab: t }, { replace: true })

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">{header}</div>
      <p className="text-sm text-graphite print:hidden" data-testid="built-on">
        <span className="font-medium text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
        {' · '}
        {excluded > 0 ? `${excluded} excluded left out` : 'none excluded'}
        {study.releaseVersion && <> · {study.releaseVersion}</>}
      </p>

      <div role="tablist" aria-label="Output" className="flex gap-1 border-b border-mist print:hidden">
        {(['themes', 'showreel'] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} data-testid={`tab-${k}`} onClick={() => setTab(k)} className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === k ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}>
            {k === 'themes' ? 'Theme videos' : 'Showreel'}
          </button>
        ))}
      </div>

      {themes.length === 0 ? (
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="No accepted themes yet" description="Build themes from accepted codes in the codebook. Each one gets a video here." action={<Button to={studyPath(studyId, screenById.A1)}>Go to the codebook</Button>} />
        </div>
      ) : tab === 'themes' ? (
        <ThemeVideos studyId={studyId} doc={doc} basis={basis} show={show} themes={themes} selectedId={selectedId!} onSelect={setPicked} />
      ) : (
        <ReelTab studyId={studyId} show={show} themes={themes} />
      )}
    </div>
  )
}
