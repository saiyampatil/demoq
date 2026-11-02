import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea, controlBase } from '@/components/Field'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { formatStamp } from '@/lib/format'
import { maskEmail } from '@/mock/participants'
import { screenById, studyPath } from '@/routes/screens'
import { closeWithoutFix, handledBySystem, ISSUE_FIX, ISSUE_META, moderatorName, resolveSession, sessionCountOf, sessionsOfParticipant, type FieldworkDoc, type Session } from '@/state/fieldwork'
import { needsYou, type NeedsRow } from '@/state/selectors'
import { ScreenTag } from '../../shared/ScreenTag'
import { SampleDataBanner } from '../SampleDataBanner'
import { sessionText } from '../SessionTag'
import { useStudySessions } from '../useStudySessions'
import { FieldworkGate, slotText } from './FieldworkBits'
import { SessionActions } from './SessionActions'
import { listParams, sessionHref, sessionRows, sessionsTabHref } from './sessionList'

const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1)

/** What the Researcher can do about it, in one phrase: "resend link or give up and replace". */
const youCan = (row: NeedsRow) => (row.kind === 'escalation' ? 'assign a moderator or send a booking link' : `${lower(row.action)}${row.giveUp ? ' or give up and replace them' : ''}`)

/** What happened and what the Researcher can do, in plain words. */
function story(doc: FieldworkDoc, s: Session, row: NeedsRow | undefined, reviewTo: string | undefined, reviewed: string | undefined): ReactNode {
  const mins = s.durationMin
  const later = sessionsOfParticipant(doc, s.participantId).find((x) => x.no > s.no)
  const can = row ? ` You can ${youCan(row)}.` : ''
  if (s.gaveUp) return 'Given up. The slot is open again and the data is kept.'
  switch (s.status) {
    case 'Completed':
      return (
        <>
          {mins !== null ? `The interview ended after ${mins} min.` : 'The interview ended.'}{' '}
          {reviewed && reviewTo ? (
            <>
              In Review it is {reviewed}, not accepted until you decide.{' '}
              <Link to={reviewTo} className="font-medium text-iris-700 hover:underline">
                Open in review
              </Link>
            </>
          ) : null}
        </>
      )
    case 'Active':
      return `The interview is in progress${s.startedAt ? `, started ${slotText(s.startedAt)}` : ''}.`
    case 'Paused':
      return `The interview is paused${mins !== null ? ` at ${mins} min` : ''}.`
    case 'Technical Error': {
      const issue = [...s.issues].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1)
      const at = mins !== null ? ` at ${mins} min` : ''
      if (later) return `${issue?.type ?? 'A technical problem'}${at}. The participant came back in session ${later.no}${later.status === 'Completed' ? ' and finished' : `, now ${later.status.toLowerCase()}`}.`
      if (issue && issue.status === 'Open' && handledBySystem(issue.type)) return `${issue.type}${at}. PulseAI is handling this.`
      return `${issue?.type ?? 'A technical problem'}${at}.${row ? can : issue && issue.status === 'Open' ? ` ${ISSUE_META[issue.type].action}` : ''}`
    }
    case 'Incomplete (resumable)':
      return `Stopped${mins !== null ? ` at ${mins} min` : ''}, and the participant can resume from the last saved point.${can}`
    case 'Withdrawn':
      return `${mins !== null ? `Stopped at ${mins} min. ` : ''}${s.consent?.withdrawn?.reason ?? 'The participant withdrew.'}`
    case 'Booked':
      return `Booked for ${slotText(s.slot)}.${can}`
    case 'Rescheduled':
      return `Didn’t join the booked slot, so it was rescheduled.${can}`
    default:
      return `${s.access === 'Invited' ? 'Invited, hasn’t opened the link yet.' : s.access === 'Opened' ? 'Opened the link, hasn’t started yet.' : 'Consented, hasn’t started yet.'}${can}`
  }
}

/** One figure in the summary row. */
function Figure({ label, children, tone }: { label: string; children: ReactNode; tone?: 'amber' | 'red' }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <dt className="text-sm text-graphite">{label}</dt>
      <dd className={cn('mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap text-lg font-semibold tabular-nums', tone === 'amber' && 'text-pending-fg', tone === 'red' && 'text-negative-fg')}>{children}</dd>
    </div>
  )
}

/** Each part of the breadcrumb is a link, the last one to this page. */
function Crumbs({ items }: { items: { label: string; to: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-graphite">
      {items.map((x, i) => {
        const last = i === items.length - 1
        return (
          <span key={x.label} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRightIcon size={12} />}
            <Link to={x.to} aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-ink' : 'rounded-xs font-medium text-iris-700 hover:underline'}>
              {x.label}
            </Link>
          </span>
        )
      })}
    </nav>
  )
}

export function SessionRecord() {
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { studyId, study, editable, doc, review, preview, update, me } = useStudySessions()
  const [closing, setClosing] = useState<{ id: string; type: string }>()
  const [reason, setReason] = useState('')
  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />
  const fromNeeds = params.get('from') === 'needs-you'
  const home = studyPath(studyId, screenById.R18)
  const found = resolveSession(doc, sessionId)
  // A participant ID with no session number means their latest session. Send it to the canonical address.
  if (found && !found.exact) return <Navigate replace to={`${sessionHref(studyId, found.session.id)}${params.toString() ? `?${params}` : ''}`} />
  const s = found?.session
  const count = s ? sessionCountOf(doc, s) : 1
  // The list the Researcher came from, so Back, Previous and Next stay inside it.
  const list = listParams(params)
  const backTo = fromNeeds ? `${home}#needs-you` : sessionsTabHref(studyId, list, s?.id)
  const backLabel = fromNeeds ? 'Back to Needs you' : 'Back to Sessions'
  const sample = preview ? <SampleDataBanner studyId={studyId} /> : null
  if (!s)
    return (
      <div className="flex flex-col gap-6">
        {sample}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="Session not found" description={`There’s no session “${sessionId}” in this study.`} action={<Button to={home}>Back to command center</Button>} />
        </div>
      </div>
    )

  const target = doc.plan.durationMin
  const mandatory = doc.plan.mandatoryCount
  const reviewed = review.find((r) => r.id === s.id)
  const needs = needsYou(doc)
  const row = needs.find((r) => r.session.id === s.id)
  const closed = !preview && (!!doc.closed || study.status === 'Complete')
  const paused = !preview && (study.status === 'Paused' || !!doc.paused || closed)
  const blockedWhy = preview ? 'This is sample data. Nothing can be changed.' : closed ? 'Fieldwork is closed' : paused ? 'Study is paused' : undefined

  const ids = fromNeeds ? needs.map((r) => r.session.id) : sessionRows(doc, params).map((x) => x.id)
  const at = ids.indexOf(s.id)
  const carry = Object.fromEntries(params)
  const go = (id: string) => sessionHref(studyId, id, carry)
  const mine = sessionsOfParticipant(doc, s.participantId)
  const open = s.issues.filter((i) => i.status === 'Open').length
  const showStimuli = s.stimuli.some((x) => x.result !== 'Not shown')
  const ssRecords = s.selfService ?? []
  const sessionLabel = sessionText(s.participantId, s.no, count)

  return (
    <div className="flex flex-col gap-6">
      {sample}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button size="sm" to={backTo} icon={<ChevronLeftIcon size={14} />}>
          {backLabel}
        </Button>
        <Crumbs items={[{ label: 'Fieldwork command center', to: home }, fromNeeds ? { label: 'Needs you', to: `${home}#needs-you` } : { label: 'Sessions', to: backTo }, { label: sessionLabel, to: pathname + search }]} />
      </div>

      <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-96">
          <div className="flex items-center gap-3">
            <ScreenTag id="R19" />
            <h1 className="text-xl font-semibold">Session {s.participantId}</h1>
          </div>
          <p className="mt-1 text-graphite">
            {maskEmail(s.email)}, {s.country}
            {s.reserve ? ' (reserve)' : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusChip status={s.status} size="sm" />
            <p className="min-w-0 flex-1 basis-80 text-sm" data-testid="session-story">
              {story(doc, s, row, reviewed ? studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', s.id) }) : undefined, reviewed?.status)}
            </p>
          </div>
          {s.status !== 'Completed' && <p className="mt-1.5 text-xs text-graphite">Still in fieldwork. It moves to Review when the interview is completed.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {count > 1 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Session of {s.participantId}</span>
              <select value={s.id} onChange={(e) => navigate(go(e.target.value))} className={cn(controlBase, 'h-8 pr-7 text-sm')} data-testid="session-switcher">
                {mine.map((x) => (
                  <option key={x.id} value={x.id}>
                    Session {x.no} of {count}
                  </option>
                ))}
              </select>
            </label>
          )}
          {at >= 0 && (
            <nav aria-label="Sessions in this list" className="flex items-center gap-1.5">
              <Button size="sm" to={at > 0 ? go(ids[at - 1]) : undefined} disabled={at === 0} icon={<ChevronLeftIcon size={14} />}>
                Previous
              </Button>
              <span className="px-1 text-sm whitespace-nowrap tabular-nums text-graphite" data-testid="session-position">
                {at + 1} of {ids.length}
              </span>
              <Button size="sm" to={at < ids.length - 1 ? go(ids[at + 1]) : undefined} disabled={at === ids.length - 1}>
                Next
                <ChevronRightIcon size={14} />
              </Button>
            </nav>
          )}
        </div>
      </header>

      {row && <SessionActions key={row.key} doc={doc} row={row} me={me} update={update ?? (() => undefined)} blockedWhy={blockedWhy} />}

      {s.gaveUp && (
        <Banner tone="warning" title="Given up, slot opened">
          {s.gaveUp.by} gave up on {s.participantId}, {formatStamp(s.gaveUp.at)}: “{s.gaveUp.reason}”. Their slot is open again and shows in the gap. Their data and this record are kept.
        </Banner>
      )}

      {params.get('from') === 'review' && !reviewed && (
        <Banner tone="info" title="Still in fieldwork, not ready for review.">
          {s.participantId} {count > 1 ? `has an unfinished session ${s.no}` : 'hasn’t finished the interview'}. It reaches the review queue once the interview is completed.
        </Banner>
      )}

      <dl className="grid grid-cols-2 divide-x divide-mist rounded-md border border-mist bg-surface sm:grid-cols-4" aria-label="Summary" data-testid="session-summary">
        <Figure label="Status">
          <StatusChip status={s.status} size="sm" />
        </Figure>
        <Figure label="Length" tone={s.durationMin !== null && s.durationMin > target ? 'amber' : undefined}>
          {s.durationMin !== null ? `${s.durationMin} min` : '—'}
          <span className="text-sm font-normal text-graphite">target {target}</span>
        </Figure>
        <Figure label="Mandatory questions">
          {s.covered.length} of {mandatory}
        </Figure>
        <Figure label="Open issues" tone={open > 0 ? 'red' : undefined}>
          {open}
        </Figure>
      </dl>

      {count > 1 && (
        <Card title={`All sessions for ${s.participantId}`} description="Each return, whether a retry, a resume or a new slot, is a new session.">
          <ol className="flex flex-col divide-y divide-mist">
            {mine.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                <span className="w-24 text-sm font-medium whitespace-nowrap tabular-nums">Session {x.no} of {count}</span>
                <StatusChip status={x.status} size="sm" />
                <span className="min-w-0 flex-1 text-sm text-graphite">{x.durationMin ? `${x.durationMin} min. ` : ''}{slotText(x.startedAt ?? x.slot ?? x.events[0]?.at ?? null)}</span>
                {x.id === s.id ? (
                  <span className="text-xs text-graphite">This session</span>
                ) : (
                  <Link to={go(x.id)} className="text-sm font-medium text-iris-700 hover:underline">
                    Open session {x.no}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {s.carried && (
        <section aria-label="Carried over" className="rounded-md border border-progress-line bg-progress-bg px-5 py-4">
          <h2 className="text-md font-semibold text-progress-fg">Carried over from {s.carried.from}</h2>
          <p className="mt-0.5 text-sm text-ink">
            This session resumed from the last saved state, not from the start. The handoff point is {slotText(s.carried.at)}, marked in the timeline.
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-graphite">Questions already asked</dt>
              <dd className="font-medium tabular-nums">{s.carried.questions}</dd>
            </div>
            <div>
              <dt className="text-graphite">Survey answers kept (locked)</dt>
              <dd className="font-medium tabular-nums">{s.carried.answerIds.length}</dd>
            </div>
            <div>
              <dt className="text-graphite">Stimuli already shown</dt>
              <dd className="font-medium tabular-nums">{s.carried.stimuliShown.length}</dd>
            </div>
          </dl>
          {s.carried.turns.length > 0 ? (
            <ol className="mt-3 flex flex-col gap-1.5 border-t border-progress-line pt-3 text-sm" aria-label="Earlier answers carried over">
              {s.carried.turns.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-24 shrink-0 text-graphite">{t.ai || t.speaker !== 'Participant' ? 'Asked' : 'Answered'}</span>
                  <span className="min-w-0 flex-1">{t.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 border-t border-progress-line pt-3 text-sm text-graphite">Nothing had been answered before the first session stopped.</p>
          )}
        </section>
      )}

      {s.escalation && (
        <Card title="Escalation to a human">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-4" data-testid="escalation-card">
            <div>
              <dt className="text-graphite">Status</dt>
              <dd className="font-medium">{s.escalation.status}</dd>
            </div>
            <div>
              <dt className="text-graphite">Asked</dt>
              <dd>{slotText(s.escalation.requestedAt)}</dd>
            </div>
            <div>
              <dt className="text-graphite">{s.escalation.joinedAt ? 'Joined' : s.escalation.actedBy ? s.escalation.actedBy.action === 'Assigned' ? 'Assigned by' : 'Booking link sent by' : 'Offered to'}</dt>
              <dd>
                {s.escalation.joinedAt
                  ? `${moderatorName(s.escalation.acceptedBy ?? null)}, ${slotText(s.escalation.joinedAt)}`
                  : s.escalation.actedBy
                    ? `${s.escalation.actedBy.by}, ${slotText(s.escalation.actedBy.at)}`
                    : s.escalation.offers.map((o) => `${moderatorName(o.moderatorId)} (${o.outcome.toLowerCase()})`).join(', ') || 'No one'}
              </dd>
            </div>
            <div>
              <dt className="text-graphite">Counts</dt>
              <dd>Once toward the target, across the AI and human parts</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-graphite">Each step is in the timeline below.</p>
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card title="Timeline" className={cn(s.issues.length === 0 && ssRecords.length === 0 && 'xl:col-span-2')}>
          <ol className="flex flex-col gap-2.5">
            {[...s.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((e) =>
              e.marker === 'handoff' ? (
                <li key={e.id} aria-label="Handoff point" className="-mx-2 flex gap-3 rounded-sm border border-dashed border-progress-line bg-progress-bg px-2 py-1.5 text-sm">
                  <span className="w-40 shrink-0 font-medium text-progress-fg tabular-nums">{slotText(e.at)}</span>
                  <span className="font-medium text-progress-fg">{e.text}</span>
                </li>
              ) : (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="w-40 shrink-0 text-graphite tabular-nums">{slotText(e.at)}</span>
                  <span>{e.text}</span>
                </li>
              ),
            )}
          </ol>
        </Card>

        {(s.issues.length > 0 || ssRecords.length > 0) && (
          <Card title="Technical issues">
            <ul className="flex flex-col gap-3 text-sm">
              {s.issues.map((x) => {
                const tried = ssRecords.find((r) => r.issue === x.type)
                return (
                  <li key={x.id}>
                    <p className="font-medium">
                      {x.type} <span className="font-normal text-graphite">({x.severity}, {x.status})</span>
                      {x.selfService && <span className="ml-2 rounded-xs border border-positive-line bg-positive-bg px-1.5 py-0.5 text-xs font-medium text-positive-fg">Fixed by the participant</span>}
                    </p>
                    {x.status === 'Resolved' ? (
                      <p className="text-positive-fg" data-testid="resolved-line">
                        Resolved: {x.resolution}
                        {x.resolvedAt ? ` · ${slotText(x.resolvedAt)}` : ''}
                        {x.detail ? <span className="text-graphite">. {x.detail}</span> : null}
                      </p>
                    ) : handledBySystem(x.type) ? (
                      <p className="font-medium" data-testid="system-handling">PulseAI is handling this.</p>
                    ) : (
                      <>
                        <p className="text-graphite">
                          Who fixes it: {ISSUE_FIX[x.type].fixer}. {ISSUE_FIX[x.type].resolvesWhen}. {ISSUE_META[x.type].action}
                        </p>
                        {!preview && !s.gaveUp && (
                          <Button size="sm" className="mt-1.5" data-testid="close-without-fix" onClick={() => setClosing({ id: x.id, type: x.type })}>
                            Close without fix
                          </Button>
                        )}
                      </>
                    )}
                    {tried && x.status !== 'Resolved' && (
                      <p className="text-graphite tabular-nums">The participant tried {tried.checks} {tried.checks === 1 ? 'check' : 'checks'} first. It didn’t fix it.</p>
                    )}
                  </li>
                )
              })}
              {/* A failed self-service attempt with no issue behind it still shows, once. */}
              {ssRecords.filter((r) => !s.issues.some((x) => x.type === r.issue)).map((r) => (
                <li key={r.id} data-testid="self-service">
                  <p className="font-medium">{r.issue}</p>
                  <p className="text-graphite tabular-nums">
                    {r.outcome === 'resolved' ? `Fixed by the participant after ${r.checks} ${r.checks === 1 ? 'check' : 'checks'}.` : `Not fixed after ${r.checks} checks. The research team was told, and it is in Needs you.`} {formatStamp(r.at)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {s.transcript.length > 0 && (
        <Card title="Transcript excerpt" description="An excerpt. The recording isn’t part of this prototype." actions={s.mode === 'ai' ? <AIGeneratedTag /> : undefined}>
          <ul className="flex flex-col gap-3">
            {s.transcript.map((t, i) => (
              <li key={i} className="text-sm">
                <p className="text-xs text-graphite">{t.speaker}</p>
                <p className={t.speaker === 'Participant' ? 'font-serif text-quote' : ''}>{t.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(showStimuli || s.answers.length > 0) && (
        <div className={cn('grid items-start gap-6', showStimuli && s.answers.length > 0 && 'lg:grid-cols-2')}>
          {showStimuli && (
            <Card title="Stimuli" description="A stimulus that failed to load counts as not seen.">
              <ul className="flex flex-col gap-1.5 text-sm">
                {s.stimuli.map((x) => (
                  <li key={x.name} className="flex items-center gap-2">
                    {x.result === 'Shown' ? <CheckIcon size={14} className="text-positive-fg" /> : x.result === 'Failed to load' ? <CloseIcon size={14} className="text-negative-fg" /> : <span className="size-3.5" />}
                    <span className="flex-1">
                      {x.name}
                      {s.carried?.stimuliShown.includes(x.name) && <span className="ml-2 text-xs text-progress-fg">Carried over</span>}
                    </span>
                    <span className={x.result === 'Failed to load' ? 'font-medium text-negative-fg' : 'text-graphite'}>{x.result === 'Failed to load' ? 'Failed to load, not seen' : x.result}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {s.answers.length > 0 && (
            <Card title="Survey answers" description="Locked once recorded. Follow-up probes never change them.">
              <dl className="flex flex-col divide-y divide-mist">
                {s.answers.map((a) => (
                  <div key={a.questionId} className="py-2 first:pt-0 last:pb-0">
                    <dt className="text-sm text-graphite">{a.question}</dt>
                    <dd className="font-medium">
                      {a.answer} <span className="text-xs font-normal text-graphite">Locked {formatStamp(a.lockedAt)}</span>
                      {s.carried?.answerIds.includes(a.questionId) && <span className="ml-2 text-xs font-normal text-progress-fg">Carried over from {s.carried.from}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      )}

      {s.mode === 'human' && (
        <Card title="Moderator notes">
          {s.notes ? (
            <dl className="flex flex-col gap-3 text-sm">
              <div><dt className="text-graphite">Key takeaways</dt><dd>{s.notes.takeaways}</dd></div>
              <div><dt className="text-graphite">Guide friction</dt><dd>{s.notes.friction}</dd></div>
              <div><dt className="text-graphite">Missing coverage</dt><dd>{s.notes.missing}</dd></div>
              <div><dt className="text-graphite">Recontact</dt><dd>{s.notes.recontact}{s.notes.recontactNote ? `. ${s.notes.recontactNote}` : ''}</dd></div>
              <p className="text-xs text-graphite">{s.notes.by}, {formatStamp(s.notes.at)}</p>
            </dl>
          ) : (
            <p className="text-sm text-graphite">The moderator hasn’t submitted notes yet.</p>
          )}
        </Card>
      )}

      <details className="group rounded-md border border-mist bg-surface" data-testid="session-details">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-md font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon size={14} className="text-graphite transition-transform group-open:rotate-90" />
          Session details
        </summary>
        <dl className="grid gap-x-8 gap-y-3 border-t border-mist px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-graphite">Moderator</dt>
            <dd className="font-medium">{s.mode === 'ai' ? moderatorName(null) : `Human: ${moderatorName(s.moderatorId)}`}</dd>
          </div>
          <div>
            <dt className="text-graphite">Release and guide</dt>
            <dd className="font-medium tabular-nums">{doc.releaseVersion}, guide v{doc.plan.guideVersion}</dd>
          </div>
          <div>
            <dt className="text-graphite">Device</dt>
            <dd className="font-medium">{s.device}</dd>
          </div>
          {s.region && (
            <div>
              <dt className="text-graphite">Region</dt>
              <dd className="font-medium">{s.state}, {s.region}</dd>
            </div>
          )}
          {s.slot && (
            <div>
              <dt className="text-graphite">Slot</dt>
              <dd className="font-medium tabular-nums">{slotText(s.slot)}</dd>
            </div>
          )}
        </dl>
      </details>

      <Modal
        open={!!closing}
        onClose={() => {
          setClosing(undefined)
          setReason('')
        }}
        title={`Close “${closing?.type ?? ''}” without a fix?`}
        description="Use this when the problem won’t be fixed and the session carries on or ends anyway. It isn’t a confirmation that anything was fixed. The reason is logged with your name and the time."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setClosing(undefined)
                setReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!reason.trim()}
              data-testid="confirm-close-without-fix"
              onClick={() => {
                if (closing) update?.((d) => closeWithoutFix(d, s.id, closing.id, reason, me))
                setClosing(undefined)
                setReason('')
              }}
            >
              Close without fix
            </Button>
          </>
        }
      >
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  )
}
