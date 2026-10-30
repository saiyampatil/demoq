import { useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { EmptyState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { formatDate, formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { inviteFromReserve } from '@/state/fieldwork'
import type { ReserveCandidate } from '@/state/fieldwork'
import { reserveRows, shortfall, slotLedger, type ReserveRow, type ReserveStatus, type SlotState } from '@/state/monitor'
import type { FWProps } from './FieldworkBits'

const TONE: Record<ReserveStatus, string> = {
  Available: 'border-positive-line bg-positive-bg text-positive-fg',
  Invited: 'border-progress-line bg-progress-bg text-progress-fg',
  Used: 'border-mist-strong bg-haze text-graphite',
  Expired: 'border-pending-line bg-pending-bg text-pending-fg',
  'Re-screen needed': 'border-negative-line bg-negative-bg text-negative-fg',
}

const SLOT: Record<SlotState, { cls: string; word: string }> = {
  counting: { cls: 'bg-ink', word: 'Counting interview' },
  running: { cls: 'hatched border border-ink', word: 'Held by someone who can still finish' },
  noShow: { cls: 'border-2 border-pending-fg bg-pending-bg', word: 'Held by a no-show until the window closes' },
  open: { cls: 'border-2 border-dashed border-negative-fg bg-surface', word: 'Open' },
}

/**
 * The reserve (everyone who passed screening and isn't in an interview), first in first out, and the slot ledger that says
 * how many slots are open for them. Reserve people only get here through screening, and only enter an interview when invited.
 */
export function ReserveTab({ doc, audience, studyId, target, outcomes, reserve, paused, readOnly, update, me }: FWProps) {
  const rows = reserveRows(doc, audience)
  const gap = shortfall(doc, target, outcomes, reserve)
  const ledger = slotLedger(doc, target, outcomes)
  const rescreen = rows.filter((r) => r.label === 'Re-screen needed').length
  const [notice, setNotice] = useState<string>()
  const why = readOnly ? 'This is sample data. Nothing can be changed.' : paused ? 'Study is paused' : undefined
  const next = Math.min(gap.gap, reserve.length)

  const invite = (list: ReserveCandidate[]) => {
    update((d) => inviteFromReserve(d, me, list))
    setNotice(`Invited ${list.length} from the reserve: ${list.map((c) => c.id).join(', ')}.`)
  }
  const position = (r: ReserveRow) => reserve.findIndex((c) => c.id === r.id) + 1

  return (
    <div className="flex flex-col gap-6">
      <Banner
        tone={gap.gap > 0 ? 'warning' : 'info'}
        title={gap.gap > 0 ? `${gap.gap} more ${gap.gap === 1 ? 'person is' : 'people are'} needed. The reserve has ${reserve.length}.` : `The target is covered. The reserve has ${reserve.length}.`}
        actions={
          why ? (
            <Tooltip content={why} focusable>
              <Button size="sm" disabled>
                Source more
              </Button>
            </Tooltip>
          ) : (
            <Button size="sm" to={studyPath(studyId, screenById.R8)}>
              Source more
            </Button>
          )
        }
      >
        The reserve is everyone who passed screening and isn’t in an interview. Eligible applicants beyond the target land here, and so does anyone screened after launch. They only enter an interview when you invite them.
        {rescreen > 0 && ` ${rescreen} ${rescreen === 1 ? 'person was' : 'people were'} screened under an older version of the audience and need re-screening before they can be invited.`}
      </Banner>

      {notice && (
        <p role="status" className="rounded-sm border border-positive-line bg-positive-bg px-4 py-2 text-sm text-positive-fg">
          {notice}
        </p>
      )}

      <Card title="Slot ledger" description={`The target is ${ledger.target} slots. Each is held or open. A slot opens only when someone is excluded, withdraws, is a no-show after the window closes, or you give up on them.`}>
        <div className="flex flex-col gap-4">
          <ol aria-label="Slots" data-testid="slots" className="flex flex-wrap gap-1.5">
            {ledger.slots.map((st, i) => (
              <li key={i} title={`Slot ${i + 1}: ${SLOT[st].word}`} aria-label={`Slot ${i + 1}: ${SLOT[st].word}`} className={cn('size-5 rounded-xs', SLOT[st].cls)} />
            ))}
          </ol>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-graphite tabular-nums" data-testid="slot-legend">
            <li>{ledger.counting} counting ({ledger.confirmed} accepted, {ledger.pending} under review)</li>
            <li>{ledger.running} held by people who can still finish</li>
            {ledger.noShowHeld > 0 && <li>{ledger.noShowHeld} held by no-shows until {ledger.windowEnd ? formatDate(`${ledger.windowEnd}T12:00:00-05:00`) : 'the window closes'}</li>}
            <li className={cn(ledger.open > 0 && 'font-medium text-negative-fg')}>{ledger.open} open</li>
          </ul>
          {ledger.released.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Slots that opened</p>
              <ul className="flex flex-col gap-0.5 text-sm text-graphite">
                {ledger.released.map((r) => (
                  <li key={r.participantId + r.why}>
                    <span className="font-medium text-ink tabular-nums">{r.participantId}</span>: {r.why}
                    {r.detail ? `. ${r.detail}` : ''}
                  </li>
                ))}
              </ul>
              {ledger.over > 0 || ledger.released.length > ledger.open ? (
                <p className="mt-1 text-xs text-graphite">The study invited more people than it has slots (the over-recruitment buffer), so fewer slots are open than have opened.</p>
              ) : null}
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Reserve"
        description="First in, first out by when they were screened. Invite the next ones in order, or pick anyone who is available."
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
                  {['Order', 'Applicant', 'Contact', 'Source', 'State', 'Screened', 'Status', ''].map((h, i) => (
                    <th key={i} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">{h || <span className="sr-only">Action</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-mist last:border-0">
                    <td className="px-4 py-3 tabular-nums text-graphite">{c.label === 'Available' ? position(c) : '—'}</td>
                    <th scope="row" className="px-4 py-3 font-medium tabular-nums">{c.id}</th>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.contact}</td>
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
