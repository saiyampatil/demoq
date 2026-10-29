import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { Banner } from '@/components/Banner'
import { regionMatrix, REGIONS, quotaFill } from '@/state/fieldwork'
import type { FWProps } from './FieldworkBits'

export function QuotasTab({ doc, audience, target, excluded }: FWProps) {
  const fill = quotaFill(doc, audience, excluded)
  const m = regionMatrix(doc, audience, excluded)
  const booked = (name: string) => doc.sessions.filter((s) => s.cohort === name && s.status === 'Booked').length
  const maxCell = Math.max(1, ...m.rows.flatMap((r) => REGIONS.map((x) => r.byRegion[x])))

  return (
    <div className="flex flex-col gap-6">
      <Card title="Quota by segment" description="Each segment is a cohort from the audience definition. Its number is its quota." flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Quota by segment</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                {['Segment', 'Quota', 'Completed', 'In progress', 'Booked', 'Reserve', 'Still needed', ''].map((h) => (
                  <th key={h} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fill.map((f) => {
                const needed = Math.max(0, f.target - f.completed)
                const covered = f.completed + f.inProgress + booked(f.name)
                return (
                  <tr key={f.id} className="border-b border-mist last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">{f.name}</th>
                    <td className="px-4 py-3 tabular-nums">{f.target}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{f.completed}</td>
                    <td className="px-4 py-3 tabular-nums">{f.inProgress}</td>
                    <td className="px-4 py-3 tabular-nums">{booked(f.name)}</td>
                    <td className="px-4 py-3 tabular-nums">{f.reserve}</td>
                    <td className={cn('px-4 py-3 tabular-nums', needed > 0 && 'text-pending-fg')}>{needed}</td>
                    <td className="min-w-40 px-4 py-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
                        <div className="h-full bg-ink" style={{ width: `${f.target ? Math.min(100, (f.completed / f.target) * 100) : 0}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-graphite">{covered >= f.target ? 'Enough booked or running to fill it' : `${f.target - covered} more people needed beyond those booked`}</p>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-paper font-medium">
                <th scope="row" className="px-4 py-3">All segments</th>
                <td className="px-4 py-3 tabular-nums">{target}</td>
                <td className="px-4 py-3 tabular-nums">{fill.reduce((n, f) => n + f.completed, 0)}</td>
                <td colSpan={5} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Segment by region" description="Where the completed interviews came from, using the US Census regions. Reserve interviews aren’t counted." flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Completed interviews by segment and region</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                <th scope="col" className="h-9 px-4 font-medium">Segment</th>
                {REGIONS.map((r) => (
                  <th key={r} scope="col" className="h-9 px-4 text-right font-medium">{r}</th>
                ))}
                <th scope="col" className="h-9 px-4 text-right font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => (
                <tr key={r.id} className="border-b border-mist">
                  <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">{r.name}</th>
                  {REGIONS.map((x) => (
                    <td key={x} className="px-4 py-3 text-right tabular-nums" style={{ background: r.byRegion[x] ? `color-mix(in srgb, var(--color-mist-strong) ${Math.round((r.byRegion[x] / maxCell) * 70)}%, transparent)` : undefined }}>
                      {r.byRegion[x]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.completed}</td>
                </tr>
              ))}
              <tr className="bg-paper font-medium">
                <th scope="row" className="px-4 py-3">All segments</th>
                {REGIONS.map((x) => (
                  <td key={x} className="px-4 py-3 text-right tabular-nums">{m.totals[x]}</td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums">{m.total}</td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 text-graphite">Share of completed</th>
                {REGIONS.map((x) => (
                  <td key={x} className="px-4 py-3 text-right text-graphite tabular-nums">{m.total ? Math.round((m.totals[x] / m.total) * 100) : 0}%</td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Banner tone="info" title="Region isn’t a quota yet">
        The audience definition sets quotas by segment only, so there are no region targets to fill. This table shows spread so you can spot a skew. If the client needs region quotas, they belong in the audience definition.
      </Banner>
    </div>
  )
}
