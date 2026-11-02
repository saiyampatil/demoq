// Unused. The Study governance card from the removed Evidence step (R24), moved here unchanged so it is not lost.
// It is not rendered anywhere. A Study settings page can show it later.

import { Card } from '@/components/Card'

export type Retention = { label: string; value: string }
/** Mock policy text. The real retention settings live in R23, which isn't built yet. */
export const retentionPolicy: Retention[] = [
  { label: 'Raw media', value: 'Retained 90 days after fieldwork closes, then deleted' },
  { label: 'Transcripts', value: 'Retained 24 months' },
  { label: 'Reviewed copies and decisions', value: 'Retained for the life of the study record' },
]

export function Governance({ release, guide, consent, researcher, client }: { release: string; guide: number | string; consent: string; researcher: string; client: { name: string; organization: string } }) {
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
