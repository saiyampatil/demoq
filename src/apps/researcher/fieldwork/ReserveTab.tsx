import { Banner } from '@/components/Banner'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/States'
import { formatStamp } from '@/lib/format'
import { shortfall } from '@/state/monitor'
import type { FWProps } from './FieldworkBits'

/** The people who passed screening but aren't in an interview yet. Part B gives this tab its full controls. */
export function ReserveTab({ doc, target, outcomes, reserve }: FWProps) {
  const gap = shortfall(doc, target, outcomes, reserve)
  const invited = doc.reserve.filter((c) => c.status === 'Invited')
  const rows = [...reserve.map((c) => ({ ...c, label: 'Available' })), ...invited.map((c) => ({ ...c, label: `Invited as ${c.invitedAs}` }))]

  return (
    <div className="flex flex-col gap-6">
      <Banner tone={gap.gap > 0 ? 'warning' : 'info'} title={gap.gap > 0 ? `${gap.gap} more ${gap.gap === 1 ? 'person is' : 'people are'} needed. The reserve has ${gap.reserve}.` : `The target is covered. The reserve has ${gap.reserve}.`}>
        The reserve is everyone who passed screening and isn’t in an interview. Eligible applicants beyond the target land here, and so does anyone recruited later. Reserve people only enter an interview when you invite them.
      </Banner>
      <Card title="Reserve" flush>
        {rows.length === 0 ? (
          <EmptyState title="Nobody is in the reserve" description="Use Recruit more on the Overview to reopen screening. Anyone who qualifies appears here first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Reserve</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Applicant', 'Contact', 'State', 'Region', 'Screened', 'Status'].map((h) => (
                    <th key={h} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-mist last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium tabular-nums">{c.id}</th>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.contact}</td>
                    <td className="px-4 py-3">{c.state || '—'}</td>
                    <td className="px-4 py-3">{c.region ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatStamp(c.arrivedAt)}</td>
                    <td className="px-4 py-3">{c.label}</td>
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
