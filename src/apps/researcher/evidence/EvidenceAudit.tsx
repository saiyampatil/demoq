import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { people } from '@/mock/people'
import { scoreBand, type ScoreBand } from '@/mock/review'
import { screenById, studyPath } from '@/routes/screens'
import { evidenceRows, retentionPolicy, useEvidenceMock, type Artifact, type EvidenceRow } from '@/state/evidence'
import { PageHeader } from '../../shared/PageHeader'
import { FieldworkGate } from '../fieldwork/FieldworkBits'
import { SampleDataBanner } from '../SampleDataBanner'
import { useStudySessions } from '../useStudySessions'

const bandClass: Record<ScoreBand, string> = {
  High: 'bg-positive-bg text-positive-fg',
  Mid: 'bg-pending-bg text-pending-fg',
  Low: 'bg-negative-bg text-negative-fg',
}

/** R24: the record of what was found and decided. It shows; it never changes a decision. Corrections are made in R22. */
export function EvidenceAudit() {
  const { studyId, study, editable, doc, review, preview } = useStudySessions()
  const mock = useEvidenceMock()
  const [params] = useSearchParams()
  const [onlyMissing, setOnlyMissing] = useState(false)

  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />

  const rows = evidenceRows(review, mock)
  const shown = onlyMissing ? rows.filter((r) => r.missing.length > 0) : rows
  const incomplete = rows.filter((r) => r.missing.length > 0).length
  const highlight = params.get('session')
  const href = (id: string) => studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', id) })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R24"
        title="Evidence and audit trail"
        description="What was recorded for each session, which release it ran under, and what was decided. This is a record: to change a decision, open the session in Review."
      />

      {preview && <SampleDataBanner studyId={studyId} />}

      <Governance
        release={preview ? 'Release v1.0' : doc.releaseVersion}
        guide={doc.plan.guideVersion}
        consent={doc.consentWording}
        researcher={people.researcher.name}
        client={{ name: study.clientContact ?? people.client.name, organization: study.client }}
      />

      <Card
        title="Evidence by session"
        description="One row per session that reached Review. The raw transcript is written once and never edited; the reviewed copy is a separate, versioned artifact."
        flush
        actions={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="size-4 accent-iris-600" />
            Only sessions missing something
            <span className="rounded-full bg-haze px-1.5 text-xs tabular-nums text-graphite" data-testid="incomplete-count">
              {incomplete}
            </span>
          </label>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="No sessions have reached Review yet" description="A session appears here once it ends and enters the review queue." />
        ) : shown.length === 0 ? (
          <EmptyState title="Nothing is missing" description="Every session has its transcript, reviewed copy, both scores and a decision on file." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" data-testid="evidence-table">
              <caption className="sr-only">Evidence on file for each reviewed session</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-sm font-medium text-graphite">
                  <th scope="col" className="h-9 px-4 whitespace-nowrap">Session</th>
                  <th scope="col" className="px-3 whitespace-nowrap">Raw transcript</th>
                  <th scope="col" className="px-3 whitespace-nowrap">Reviewed copy</th>
                  <th scope="col" className="px-3 whitespace-nowrap">Participant integrity</th>
                  <th scope="col" className="px-3 whitespace-nowrap">Interview quality</th>
                  <th scope="col" className="px-3 whitespace-nowrap">Review decision</th>
                  <th scope="col" className="px-3 whitespace-nowrap">Ran under</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} data-testid="evidence-row" data-session={r.id} className={cn('border-b border-mist last:border-0 align-top', highlight === r.id && 'bg-iris-50')}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link to={href(r.id)} className="font-medium tabular-nums text-iris-700 underline-offset-2 hover:underline">
                        {r.id}
                      </Link>
                      {r.missing.length > 0 && <p className="mt-0.5 text-xs text-negative-fg">Missing: {r.missing.join(', ').toLowerCase()}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <ArtifactChip a={r.transcript} />
                    </td>
                    <td className="px-3 py-2.5">
                      <ArtifactChip a={r.reviewed} />
                    </td>
                    <ScoreCells row={r} />
                    <td className="px-3 py-2.5">
                      <DecisionCell row={r} />
                    </td>
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      {r.release}
                      <span className="block text-xs text-graphite">{r.guide}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Governance({ release, guide, consent, researcher, client }: { release: string; guide: number | string; consent: string; researcher: string; client: { name: string; organization: string } }) {
  const facts: { label: string; value: React.ReactNode; note?: string }[] = [
    { label: 'Release', value: release, note: 'Locked when launch was authorized' },
    { label: 'Guide version', value: `v${guide}`, note: `Locked under ${release}` },
    { label: 'Consent wording', value: consent, note: 'What every participant agreed to' },
  ]
  return (
    <Card title="Study governance" description="Read only. Set at launch and in study settings.">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="governance">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-sm text-graphite">{f.label}</dt>
            <dd className="font-medium">{f.value}</dd>
            {f.note && <dd className="text-xs text-graphite">{f.note}</dd>}
          </div>
        ))}
        <div className="sm:col-span-2 lg:col-span-1">
          <dt className="text-sm text-graphite">Data retention</dt>
          <dd>
            <ul className="mt-0.5 flex flex-col gap-0.5 text-sm">
              {retentionPolicy.map((p) => (
                <li key={p.label}>
                  <span className="font-medium">{p.label}:</span> {p.value}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-graphite">Who has access</dt>
          <dd>
            <ul className="mt-0.5 flex flex-col gap-0.5 text-sm">
              <li>
                <span className="font-medium">{researcher}</span> <span className="text-graphite">Researcher: builds the study, makes every decision</span>
              </li>
              <li>
                <span className="font-medium">{client.name}</span> <span className="text-graphite">Client, {client.organization}: reviews the brief, watches from the backroom</span>
              </li>
            </ul>
          </dd>
        </div>
      </dl>
    </Card>
  )
}

/** Present or missing, with a glyph so colour is never the only signal. The version number is only on the reviewed copy. */
function ArtifactChip({ a }: { a: Artifact }) {
  return a.present ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-positive-fg">
      <span aria-hidden="true">✓</span>
      <span className="text-ink">Present{a.version ? `, v${a.version}` : ''}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-negative-fg">
      <span aria-hidden="true">✕</span>
      Missing
    </span>
  )
}

/** Two score columns side by side. If one is on file both are; if not, both read "Not scored". They are never combined. */
function ScoreCells({ row }: { row: EvidenceRow }) {
  if (!row.scores) {
    return (
      <>
        <td className="px-3 py-2.5 text-sm text-graphite">Not scored</td>
        <td className="px-3 py-2.5 text-sm text-graphite">Not scored</td>
      </>
    )
  }
  const cell = (value: number, name: string) => {
    const band = scoreBand(value)
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-sm font-medium tabular-nums', bandClass[band])} title={`${name}: ${value}, ${band.toLowerCase()}`}>
        {value}
        <span className="text-xs font-normal">{band}</span>
      </span>
    )
  }
  return (
    <>
      <td className="px-3 py-2.5">{cell(row.scores.integrity, 'Participant integrity')}</td>
      <td className="px-3 py-2.5">{cell(row.scores.quality, 'Interview quality')}</td>
    </>
  )
}

function DecisionCell({ row }: { row: EvidenceRow }) {
  switch (row.decision) {
    case 'Accepted':
    case 'Excluded':
      return <StatusChip status={row.decision} size="sm" />
    case 'Replacement ordered':
      return (
        <span className="flex flex-col gap-0.5">
          <StatusChip status="Excluded" size="sm" />
          <span className="text-xs text-graphite">Replacement ordered</span>
        </span>
      )
    case 'Request clarification':
      return (
        <span className="flex flex-col gap-0.5">
          <StatusChip status="Under review" size="sm" />
          <span className="text-xs text-graphite">Clarification requested</span>
        </span>
      )
    default:
      return <span className="text-sm text-graphite">None yet</span>
  }
}
