import type { ReactNode } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/States'
import { WizardFooter } from '@/components/WizardFooter'
import { CODEBOOK_STUDY } from '@/state/codebook'
import { screenById, studyPath } from '@/routes/screens'
import { PageHeader } from '../../shared/PageHeader'
import { AnalysisStepper } from './AnalysisStepper'
import type { AnalysisStepKey } from '@/state/analysisProgress'

type Fact = { label: string; value: string; note?: string }

/**
 * The frame of an analysis step that isn't built yet: it still shows where you are, what the step will use from the
 * steps before it (live from the codebook), what you'll decide here, and what it hands on. Nothing here is a mock result.
 */
export function StepPage({
  id,
  step,
  studyId,
  title,
  description,
  ready,
  stale,
  takesIn,
  youDecide,
  handsOn,
  previous,
  next,
}: {
  id: string
  step: AnalysisStepKey
  studyId: string
  title: string
  description: string
  ready: boolean
  stale: boolean
  takesIn: Fact[]
  youDecide: string[]
  handsOn: string[]
  previous: { screen: 'A1' | 'A2'; label: string }
  next?: { screen: 'A3'; label: string }
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id={id} title={title} description={description} />
      <AnalysisStepper studyId={studyId} current={step} />

      {!ready ? (
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={studyId === CODEBOOK_STUDY ? 'Accept a code first' : 'No analysis for this study yet'}
            description={studyId === CODEBOOK_STUDY ? 'This step works on the codes you’ve accepted in the codebook.' : 'Results Analysis is built on Pet Food Subscription Churn in this prototype.'}
            action={<Button to={studyPath(studyId === CODEBOOK_STUDY ? studyId : CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>}
          />
        </div>
      ) : (
        <>
          {stale && (
            <Banner tone="warning" title="Review changed after the codebook was built" actions={<Button size="sm" to={studyPath(studyId, screenById.A1)}>Update the codebook</Button>}>
              The counts below follow Review. Update the codebook so they match.
            </Banner>
          )}
          <Banner tone="info" title="This step isn’t built in the prototype yet">
            Below is what it will take in from the earlier steps, what you’ll decide here, and what it hands on. The numbers on the left are live.
          </Banner>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Card title="Takes in" description="From the earlier steps, as they stand now.">
              <dl className="grid gap-3 sm:grid-cols-2" data-testid="takes-in">
                {takesIn.map((f) => (
                  <div key={f.label} className="rounded-sm border border-mist px-3 py-2.5">
                    <dt className="text-xs text-graphite">{f.label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{f.value}</dd>
                    {f.note && <p className="text-xs text-graphite">{f.note}</p>}
                  </div>
                ))}
              </dl>
            </Card>
            <div className="flex flex-col gap-5">
              <List title="You decide" items={youDecide} />
              <List title="Hands on" items={handsOn} />
            </div>
          </div>
        </>
      )}

      <WizardFooter
        previous={{ to: studyPath(studyId, screenById[previous.screen]), label: previous.label }}
        message={ready ? undefined : 'Accept at least one code in the codebook to use this step.'}
      >
        {next && ready && (
          <Button variant="primary" to={studyPath(studyId, screenById[next.screen])} data-testid="continue-analysis">
            {next.label}
          </Button>
        )}
      </WizardFooter>
    </div>
  )
}

function List({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <Card title={title}>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </Card>
  )
}
