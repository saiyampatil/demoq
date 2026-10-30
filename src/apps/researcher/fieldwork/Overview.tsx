import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Button'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { AlertIcon } from '@/components/icons'
import { SplitBar } from '@/components/ProgressBar'
import { Tooltip } from '@/components/Tooltip'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { Modal } from '@/components/Modal'
import { approveReplacement, assignModerator, closeScreening, durationStats, HUMAN_MODERATOR_IDS, regionMatrix, regionSkew, reopenScreening, rescheduleSession, resendLink, retrySession, targetFill } from '@/state/fieldwork'
import { ago, funnel, needsYou, verdict, type NeedsRow, type VerdictLevel } from '@/state/monitor'
import { SessionTag } from '../SessionTag'
import type { FWProps } from './FieldworkBits'

const r19 = (studyId: string, id: string) => studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', id) })

const TONE: Record<VerdictLevel, { box: string; word: string }> = {
  'At risk': { box: 'border-negative-line bg-negative-bg', word: 'text-negative-fg' },
  'Behind pace': { box: 'border-pending-line bg-pending-bg', word: 'text-pending-fg' },
  'On track': { box: 'border-positive-line bg-positive-bg', word: 'text-positive-fg' },
}

export function Overview(p: FWProps) {
  const { doc, audience, target, studyId, outcomes, reserve, awaiting, readOnly, update, me } = p
  const needs = needsYou(doc, reserve)
  const v = verdict(doc, target, outcomes, reserve, needs.length)
  const fill = targetFill(doc, audience, outcomes)
  const regions = regionMatrix(doc, outcomes)
  const skew = regionSkew(regions.totals, regions.total)
  const dur = durationStats(doc)
  const flow = funnel(doc, outcomes)
  const [recruiting, setRecruiting] = useState(false)
  const screenerLabel = `screener from audience v${audience?.screener?.fromAudienceVersion ?? audience?.version ?? 1}`

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Verdict" className={cn('flex flex-wrap items-start gap-x-6 gap-y-3 rounded-md border px-5 py-4', TONE[v.level].box)}>
        <div className="min-w-0 flex-1 basis-80">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn('text-xl font-semibold', TONE[v.level].word)}>{v.level}</span>
            <span className="text-base text-ink tabular-nums">{v.sentence}</span>
          </p>
          {v.warning && (
            <p className="mt-2 flex items-start gap-2 text-sm text-pending-fg">
              <AlertIcon size={14} className="mt-0.5 shrink-0" />
              {v.warning}
            </p>
          )}
          <p className="mt-2 text-xs text-graphite">{v.basis}</p>
        </div>
        <div className="shrink-0">
          {v.action.to === 'recruit' && (
            <Button variant="primary" onClick={() => document.getElementById('coverage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              {v.action.label}
            </Button>
          )}
          {v.action.to === 'sessions' && (
            <Button variant="primary" onClick={() => p.goTab('sessions')}>
              {v.action.label}
            </Button>
          )}
          {v.action.to === 'needs' && (
            <Button variant="primary" onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {v.action.label}
            </Button>
          )}
          {v.action.to === 'review' && (
            <Button variant="primary" to={studyPath(studyId, screenById.R21)}>
              {v.action.label}
            </Button>
          )}
        </div>
      </section>

      <NeedsYou {...p} rows={needs} />

      {skew && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-pending-line bg-pending-bg px-4 py-2 text-sm text-pending-fg">
          <AlertIcon size={14} className="mt-0.5 shrink-0" />
          Regions are uneven. {skew}
        </p>
      )}

      <Card title="Participant funnel" description="Every invited participant is counted once, at the furthest stage they reached.">
        <div className="flex flex-col gap-5">
          {v.gap.gap > 0 && (
            <div id="coverage" role="alert" className="scroll-mt-24 rounded-md border border-negative-line bg-negative-bg px-4 py-3 text-negative-fg">
              <p className="flex items-center gap-2 font-medium">
                <AlertIcon /> Only {v.gap.ceiling} of {target} can finish. {v.gap.gap} more {v.gap.gap === 1 ? 'person is' : 'people are'} needed.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
                <span className="min-w-0 flex-1 basis-72 tabular-nums">
                  Target {target}: {v.gap.counting} counting, {v.gap.open} still open, {v.gap.reserve} in reserve (not invited).
                </span>
                {readOnly ? (
                  <Tooltip content="This is sample data. Nothing can be changed." focusable>
                    <Button size="sm" disabled>
                      Recruit {v.gap.gap} more
                    </Button>
                  </Tooltip>
                ) : doc.recruiting?.status === 'Open' ? (
                  <span className="text-xs text-graphite">Screening is open</span>
                ) : (
                  <Button size="sm" onClick={() => setRecruiting(true)}>
                    Recruit {v.gap.gap} more
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-graphite tabular-nums">Invited {flow.total} for a target of {target}. You can’t finish without more people.</p>
            </div>
          )}
          {doc.recruiting?.status === 'Open' && (
            <div role="status" className="flex flex-wrap items-start gap-3 rounded-md border border-progress-line bg-progress-bg px-4 py-3 text-sm">
              <span className="mt-0.5">{doc.recruiting.arrived === 0 ? <Spinner /> : <AlertIcon />}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-progress-fg">Screening is open</p>
                <p className="mt-0.5 text-ink">
                  {doc.recruiting.screenerVersion}, unchanged. {doc.recruiting.arrived === 0 ? 'Waiting for applicants…' : `${doc.recruiting.arrived} eligible applicant has gone to the reserve list. Approve the replacement in Needs you to invite them.`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" to={studyPath(studyId, screenById.R9)}>
                  Open screening
                </Button>
                {!readOnly && (
                  <Button size="sm" variant="ghost" onClick={() => update((d) => closeScreening(d, me))}>
                    Close screening
                  </Button>
                )}
              </div>
            </div>
          )}
          <ol className="flex flex-col gap-3" aria-label="Funnel stages">
            {flow.stages.map((st) => (
              <li key={st.key} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[7rem_minmax(0,1fr)_3rem]">
                <span className="text-sm font-medium">{st.label}</span>
                <div className="h-3 overflow-hidden rounded-xs bg-haze" aria-hidden="true">
                  <div className="h-full rounded-xs bg-ink" style={{ width: `${flow.total ? (st.reached / flow.total) * 100 : 0}%` }} />
                </div>
                <span className="text-right font-semibold tabular-nums max-sm:text-left">{st.reached}</span>
                {(st.left.length > 0 || st.waiting.length > 0 || st.key === 'completed') && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite sm:col-start-2 sm:col-span-2">
                    {st.left.map((x) => (
                      <li key={x.label} className="text-pending-fg tabular-nums">
                        {x.n} {x.label.toLowerCase()}, left the study
                      </li>
                    ))}
                    {st.waiting.map((x) => (
                      <li key={x.label} className="tabular-nums">
                        {x.n} {x.label.toLowerCase()}
                      </li>
                    ))}
                    {st.key === 'completed' && (
                      <>
                        <li className="tabular-nums">
                          Inside the {flow.completed.n}: {flow.completed.accepted} accepted, {flow.completed.pending} under review, {flow.completed.excluded} excluded
                        </li>
                        {flow.completed.excluded > 0 && (
                          <li className="font-medium text-pending-fg tabular-nums">
                            {flow.completed.excluded} excluded in review (replacements needed)
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <p className="border-t border-mist pt-3 text-sm text-graphite tabular-nums" data-testid="funnel-total">
            {flow.total} invited = {flow.completed.n} completed ({flow.completed.accepted} accepted + {flow.completed.pending} under review + {flow.completed.excluded} excluded) + {flow.withdrew} withdrew + {flow.noShow} no-show + {flow.inProgress} still in progress
            {flow.sum === flow.total ? '.' : `. ${flow.total - flow.sum} unaccounted for.`}
          </p>
        </div>
      </Card>

      <RecruitModal
        open={recruiting}
        cohortName={audience?.def?.cohort.name ?? 'the cohort'}
        screenerLabel={screenerLabel}
        audienceVersion={audience?.version ?? 1}
        onClose={() => setRecruiting(false)}
        onConfirm={() => {
          update((d) => reopenScreening(d, me, screenerLabel))
          setRecruiting(false)
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Progress toward the target">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="flex-1 font-medium">{fill.name}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{fill.completed}</span> of {fill.target}
              </span>
            </div>
            <SplitBar className="mt-1.5" confirmed={fill.accepted} pending={fill.pending} total={fill.target} label={`${fill.accepted} accepted, ${fill.pending} under review, of ${fill.target}`} />
            <p className="mt-1 text-xs text-graphite tabular-nums">
              {fill.accepted} confirmed, {fill.pending} pending review{fill.excluded ? `. ${fill.excluded} excluded, not counted` : ''}
            </p>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-mist pt-3 text-xs text-graphite">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-xs bg-ink" /> Accepted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="hatched inline-block h-2 w-4 rounded-xs bg-haze" /> Under review
            </span>
          </p>
        </Card>

        <Card title="At a glance">
          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="font-medium">Interview length</dt>
              <dd className="mt-0.5 text-graphite tabular-nums">
                {dur.n === 0
                  ? 'No completed interviews yet.'
                  : `Averaging ${dur.avg} min against the ${dur.target} min target. ${dur.over} of ${dur.n} ran over.`}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Review</dt>
              <dd className="mt-0.5">
                <Link to={studyPath(studyId, screenById.R21)} className="text-iris-700 hover:underline tabular-nums">
                  {awaiting} {awaiting === 1 ? 'session' : 'sessions'} awaiting review
                </Link>
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {doc.log.length > 0 && (
        <Card title="Activity">
          <ul className="flex flex-col gap-2 text-sm">
            {[...doc.log].reverse().map((l) => (
              <li key={l.id}>
                <span className="font-medium">{l.by}</span>: {l.text} <span className="text-xs text-graphite">{formatStamp(l.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

const FIRST_SHOWN = 5

function NeedsYou({ doc, rows, studyId, me, update, readOnly }: FWProps & { rows: NeedsRow[] }) {
  const [all, setAll] = useState(false)
  const [notice, setNotice] = useState<string>()
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(undefined), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const shown = all ? rows : rows.slice(0, FIRST_SHOWN)

  const run = (row: NeedsRow) => {
    const id = row.session?.id ?? ''
    const who = row.who
    if (row.action === 'Approve replacement' && row.candidate) {
      update((d) => approveReplacement(d, me, { sessionId: row.session?.id, candidate: row.candidate! }))
      setNotice(`Replacement approved: ${row.candidate.id} was invited${row.session ? ` in place of ${who}` : ''}.`)
    } else if (row.action === 'Resend link') {
      update((d) => resendLink(d, id, me))
      setNotice(`Link resent to ${who}.`)
    } else if (row.action === 'Retry') {
      update((d) => retrySession(d, id, me))
      setNotice(`Retry link sent to ${who}. A new session was created.`)
    } else if (row.action === 'Reschedule') {
      update((d) => rescheduleSession(d, id, me))
      setNotice(`${who} rescheduled.`)
    } else {
      update((d) => assignModerator(d, id, HUMAN_MODERATOR_IDS[0], me))
      setNotice(`Moderator assigned to ${who}.`)
    }
  }

  return (
    <section id="needs-you" aria-label="Needs you" className="scroll-mt-4 rounded-md border border-mist bg-surface">
      <header className="flex items-start gap-4 border-b border-mist px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-semibold">
            Needs you <span className="ml-1 rounded-full bg-haze px-2 text-sm font-medium tabular-nums text-graphite">{rows.length}</span>
          </h2>
          <p className="mt-0.5 text-sm text-graphite">Unfinished sessions only, most urgent first. Finished interviews are in Review.</p>
        </div>
      </header>
      {notice && (
        <p role="status" className="border-b border-positive-line bg-positive-bg px-5 py-2 text-sm text-positive-fg">
          {notice}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-graphite">Nothing needs you. Everyone unfinished is in progress or waiting on the participant.</p>
      ) : (
        <>
          <ul className="divide-y divide-mist">
            {shown.map((row) => (
              <li key={row.key} className="grid items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5.5rem_auto]">
                {row.session ? (
                  <Link to={r19(studyId, row.session.id)} className="font-medium text-iris-700 hover:underline">
                    <SessionTag participantId={row.session.participantId} no={row.session.no} count={doc.sessions.filter((x) => x.participantId === row.session!.participantId).length} />
                  </Link>
                ) : (
                  <span className="font-medium tabular-nums">
                    {row.who} <span className="text-xs font-normal text-graphite">Reserve</span>
                  </span>
                )}
                <span className="min-w-0 text-sm">{row.what}</span>
                <span className="text-sm text-graphite tabular-nums sm:text-right">{ago(row.since)}</span>
                <span className="sm:justify-self-end">
                  {row.blocked || readOnly ? (
                    <Tooltip content={readOnly ? 'This is sample data. Nothing can be changed.' : row.blocked!} focusable>
                      <Button size="sm" disabled>
                        {row.action}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button size="sm" onClick={() => run(row)} aria-label={`${row.action}: ${row.who}`}>
                      {row.action}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > FIRST_SHOWN && (
            <div className="border-t border-mist px-5 py-2.5">
              <Button size="sm" variant="ghost" onClick={() => setAll((x) => !x)}>
                {all ? 'Show fewer' : `Show all ${rows.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}


function RecruitModal({ open, cohortName, screenerLabel, audienceVersion, onClose, onConfirm }: { open: boolean; cohortName: string; screenerLabel: string; audienceVersion: number; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recruit more participants"
      description={`This reopens screening for ${cohortName}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Reopen screening
          </Button>
        </>
      }
    >
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
        <li>
          It uses the same {screenerLabel} and the same audience rules (audience v{audienceVersion}). Nothing about the audience changes, so no new version is needed.
        </li>
        <li>People who qualify go to the reserve list. They aren’t invited yet.</li>
        <li>Then approve the replacement in Needs you. That invites them.</li>
      </ul>
    </Modal>
  )
}
