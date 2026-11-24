import { Button } from '@/components/Button'
import { EmptyState, LoadingState } from '@/components/States'
import { PageHeader } from '../../shared/PageHeader'
import { hasAnalysis } from '@/mock/studyAnalysis'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY } from '@/state/codebook'
import { plural } from '@/state/reportLogic'
import { AnalysisStepper } from './AnalysisStepper'
import { useReportModel } from './useReportModel'

/**
 * A3, the report page, is being rebuilt to the new design (docs/stitch/A3_revamp). Phase 0 built the model underneath it (state/reportBlocks.ts)
 * and removed the old page. Until Phase 1 puts the new page here, this holds the place: the way to the other outputs, and in development a plain
 * readout of the model so it can be checked. Nothing on it can be approved.
 */
export function Report() {
  const { studyId, study, accepted, ready, doc, model } = useReportModel()
  if (!study) return null

  const header = (
    <>
      <PageHeader id="A3" title="Report" description="The report the client will receive. It is being rebuilt, so nothing can be approved on this page yet." />
      <AnalysisStepper studyId={studyId} current="report" />
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
        <div className="rounded-md border border-mist bg-surface p-5" role="status">
          <LoadingState label={`Building the report from ${plural(accepted.length, 'accepted session')}`} rows={4} />
        </div>
      </div>
    )

  const c = model.counts
  return (
    <div className="flex flex-col gap-5" data-testid="report-holding">
      {header}
      <section aria-label="Outputs" className="flex flex-wrap items-center gap-2 rounded-md border border-mist bg-surface p-4">
        <h2 className="mr-2 text-sm font-semibold text-ink">Outputs</h2>
        <Button to={`${studyPath(studyId, screenById.A3V)}`} data-testid="tool-theme-videos">Theme videos</Button>
        <Button to={`${studyPath(studyId, screenById.A3V)}?tab=showreel`} data-testid="tool-showreel">Showreel</Button>
        <Button to={studyPath(studyId, screenById.A3W)} data-testid="tool-word-cloud">Word cloud</Button>
        <Button to={studyPath(studyId, screenById.A3M)} data-testid="tool-theme-map">Theme map</Button>
        <Button to={studyPath(studyId, screenById.A3P)} data-testid="tool-audio-summary">Audio summary</Button>
      </section>

      {import.meta.env.DEV && (
        <section aria-label="Report model" className="rounded-md border border-dashed border-mist-strong bg-surface p-4 text-sm" data-testid="model-readout">
          <h2 className="font-semibold text-ink">Report model (temporary, Phase 0)</h2>
          <p className="text-graphite" data-testid="model-counts">
            {c.approved} of {c.total} blocks approved · {c.undecided} to review · {c.outOfDate} out of date · {c.leftOut} left out
          </p>
          <ol className="mt-3 flex flex-col gap-3">
            {model.blocks.map((b) => (
              <li key={b.id} data-testid="model-block" data-id={b.id} data-status={b.status} data-fingerprint={b.fingerprint}>
                <p className="font-medium text-ink">
                  {b.number ? `${b.number}. ` : ''}
                  {b.title} <span className="text-graphite">· {b.status}{b.strength ? ` · ${b.strength.label}, ${b.strength.n} of ${b.strength.of} people` : ''}</span>
                </p>
                <ul className="ml-4 list-disc text-graphite">
                  {b.lines.map((l) => (
                    <li key={l.id}>
                      {l.lead ? <span className="text-graphite">{l.lead}: </span> : null}
                      {l.text}
                      {l.directional ? ' (Directional)' : ''}
                    </li>
                  ))}
                </ul>
                {b.flag && <p className="ml-4 text-graphite">{b.flag}</p>}
                {b.footnote && <p className="ml-4 text-xs text-graphite">{b.footnote}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
