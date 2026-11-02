import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { EmptyState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { useToast } from '@/components/Toast'
import { screenById, studyPath } from '@/routes/screens'
import { formatStamp } from '@/lib/format'
import { participantEmail } from '@/mock/participants'
import { inviteFromReserve } from '@/state/fieldwork'
import type { ReserveCandidate } from '@/state/fieldwork'
import { reserveRows, shortfall, type ReserveRow, type ReserveStatus } from '@/state/selectors'
import { MaskedEmail } from '../MaskedEmail'
import { invitedIds, invitedMessage, type FWProps } from './FieldworkBits'

const TONE: Record<ReserveStatus, string> = {
  Available: 'border-positive-line bg-positive-bg text-positive-fg',
  Invited: 'border-progress-line bg-progress-bg text-progress-fg',
  Used: 'border-mist-strong bg-haze text-graphite',
  Expired: 'border-pending-line bg-pending-bg text-pending-fg',
  'Re-screen needed': 'border-negative-line bg-negative-bg text-negative-fg',
}

/**
 * The reserve: everyone who passed screening and isn't in an interview, first in first out. Reserve people only get here through screening, and only enter an interview when invited.
 */
export function ReserveTab({ doc, audience, target, outcomes, reserve, paused, closed, readOnly, update, me, studyId }: FWProps) {
  const toast = useToast()
  const rows = reserveRows(doc, audience)
  const gap = shortfall(doc, target, outcomes, reserve)
  const rescreen = rows.filter((r) => r.label === 'Re-screen needed').length
  const [notice, setNotice] = useState<string>()
  const why = readOnly ? 'This is sample data. Nothing can be changed.' : closed ? 'Fieldwork is closed' : paused ? 'Study is paused' : undefined
  const next = Math.min(gap.gap, reserve.length)

  const invite = (list: ReserveCandidate[]) => {
    const after = inviteFromReserve(doc, me, list)
    const ids = invitedIds(doc, after)
    update(() => after)
    if (ids.length) toast(invitedMessage(ids), { label: 'View in Sessions', to: `${studyPath(studyId, screenById.R18)}?tab=sessions` })
    setNotice(`Invited ${list.length} from the reserve: ${list.map((c) => c.id).join(', ')}.`)
  }
  const position = (r: ReserveRow) => reserve.findIndex((c) => c.id === r.id) + 1

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p role="status" className="rounded-sm border border-positive-line bg-positive-bg px-4 py-2 text-sm text-positive-fg">
          {notice}
        </p>
      )}

      <Card
        title="Reserve"
        description={`First in, first out by when they were screened. Invite the next ones in order, or pick anyone who is available.${rescreen > 0 ? ` ${rescreen} ${rescreen === 1 ? 'person was' : 'people were'} screened under an older version of the audience and need re-screening before they can be invited.` : ''}`}
        flush
        actions={
          why ? (
            <Tooltip content={why} focusable>
              <Button size="sm" variant="primary" disabled>
                {next > 0 ? `Invite first ${next}` : 'Invite first'}
              </Button>
            </Tooltip>
          ) : (
            <Button size="sm" variant="primary" disabled={next === 0} onClick={() => invite(reserve.slice(0, next))}>
              {next > 0 ? `Invite first ${next}` : 'Invite first'}
            </Button>
          )
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Nobody is in the reserve" description="Use Source more to add applicants. They go through screening, and anyone who qualifies appears here first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Reserve</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Order', 'Applicant', 'Email', 'Source', 'State', 'Screened', 'Status', ''].map((h, i) => (
                    <th key={i} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">{h || <span className="sr-only">Action</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-mist last:border-0">
                    <td className="px-4 py-3 tabular-nums text-graphite">{c.label === 'Available' ? position(c) : '—'}</td>
                    <th scope="row" className="px-4 py-3 font-medium tabular-nums">{c.id}</th>
                    <td className="px-4 py-3"><MaskedEmail email={participantEmail(c.id)} /></td>
                    <td className="px-4 py-3">{c.source}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.state ? `${c.state}${c.region ? `, ${c.region}` : ''}` : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatStamp(c.arrivedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded-xs border px-1.5 py-0.5 text-xs font-medium', TONE[c.label])}>{c.label}</span>
                      {c.invitedAs && (
                        <>
                          {' '}
                          <span className="ml-1 text-xs text-graphite tabular-nums">as {c.invitedAs}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.label === 'Available' &&
                        (why ? (
                          <Tooltip content={why} focusable>
                            <Button size="sm" disabled>
                              Invite
                            </Button>
                          </Tooltip>
                        ) : (
                          <Button size="sm" onClick={() => invite([c])} aria-label={`Invite ${c.id}`}>
                            Invite
                          </Button>
                        ))}
                      {c.label === 'Re-screen needed' && <span className="text-xs text-graphite">Can’t be invited</span>}
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
