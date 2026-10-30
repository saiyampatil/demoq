import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Breadcrumb } from '@/components/Breadcrumb'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { ISSUE_META, moderatorName, resolveSession, sessionCountOf, sessionsOfParticipant } from '@/state/fieldwork'
import { PageHeader } from '../../shared/PageHeader'
import { FieldworkGate, slotText } from './FieldworkBits'
import { Banner } from '@/components/Banner'
import { SampleDataBanner } from '../SampleDataBanner'
import { sessionText } from '../SessionTag'
import { useStudySessions } from '../useStudySessions'

export function SessionRecord() {
  const { sessionId = '' } = useParams()
  const [params] = useSearchParams()
  const { studyId, study, editable, doc, review, preview } = useStudySessions()
  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />
  const back = { to: studyPath(studyId, screenById.R18), label: 'Fieldwork command center' }
  const found = resolveSession(doc, sessionId)
  // A participant ID with no session number means their latest session. Send it to the canonical address.
  if (found && !found.exact) return <Navigate replace to={`${studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', found.session.id) })}${params.toString() ? `?${params}` : ''}`} />
  const s = found?.session
  const count = s ? sessionCountOf(doc, s) : 1
  const crumbs = (
    <>
      <Breadcrumb parent={back} current={s ? sessionText(s.participantId, s.no, count) : sessionId} className="-mb-2" />
      {preview && <SampleDataBanner studyId={studyId} />}
    </>
  )
  if (!s)
    return (
      <div className="flex flex-col gap-6">
        {crumbs}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="Session not found" description={`There’s no session “${sessionId}” in this study.`} action={<Button to={back.to}>Back to command center</Button>} />
        </div>
      </div>
    )

  const target = doc.plan.durationMin
  const mandatory = doc.plan.mandatoryCount
  const reviewed = review.find((r) => r.id === s.id)
  // Consent is given once, in the participant's first session, and still applies to later ones.
  const consent = s.consent ?? sessionsOfParticipant(doc, s.participantId)[0]?.consent ?? null

  return (
    <div className="flex flex-col gap-6">
      {crumbs}
      <PageHeader
        id="R19"
        title={`Session ${s.participantId}`}
        description={`${s.ref}${s.reserve ? ' (reserve)' : ''}`}
        meta={
          <>
            {count > 1 && <span className="font-medium text-ink">Session {s.no} of {count}</span>}
            <StatusChip status={s.access} size="sm" />
            <StatusChip status={s.status} size="sm" />
            <span>{s.mode === 'ai' ? moderatorName(null) : `Human: ${moderatorName(s.moderatorId)}`}</span>
            <span>{doc.releaseVersion}, guide v{doc.plan.guideVersion}</span>
            {s.slot && <span>Slot {slotText(s.slot)}</span>}
            {s.region && <span>{s.state}, {s.region}</span>}
            <span>{s.device}</span>
          </>
        }
        actions={
          s.mode === 'human' ? (
            <Tooltip content="Rescheduling (4.7) isn’t built in the prototype yet.">
              <Button disabled>Reschedule</Button>
            </Tooltip>
          ) : undefined
        }
      />

      {params.get('from') === 'review' && (
        <Banner tone="info" title="Still in fieldwork, not ready for review.">
          {s.participantId} {count > 1 ? `has an unfinished session ${s.no}` : 'hasn’t finished the interview'}. It reaches the review queue once the interview is completed.
        </Banner>
      )}

      {reviewed ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-graphite">
          This session has ended and is in Review: <StatusChip status={reviewed.status} size="sm" />
          <Link to={studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', s.id) })} className="font-medium text-iris-700 hover:underline">
            Open in review
          </Link>
          <span>Completed means the interview ended. It doesn’t mean the session is accepted.</span>
        </p>
      ) : (
        <p className="text-sm text-graphite">This session is still in fieldwork. It moves to Review when the interview is completed.</p>
      )}

      {count > 1 && (
        <Card title={`All sessions for ${s.participantId}`} description="A participant keeps one ID. Each time they come back (a retry, a resume, a new slot) it’s a new session.">
          <ol className="flex flex-col divide-y divide-mist">
            {sessionsOfParticipant(doc, s.participantId).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                <span className="w-24 text-sm font-medium tabular-nums">Session {x.no} of {count}</span>
                <StatusChip status={x.status} size="sm" />
                <span className="min-w-0 flex-1 text-sm text-graphite">{x.durationMin ? `${x.durationMin} min. ` : ''}{slotText(x.startedAt ?? x.slot ?? x.events[0]?.at ?? null)}</span>
                {x.id === s.id ? (
                  <span className="text-xs text-graphite">This session</span>
                ) : (
                  <Link to={studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', x.id) })} className="text-sm font-medium text-iris-700 hover:underline">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Timeline">
          <ol className="flex flex-col gap-2.5">
            {s.events.map((e) =>
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

        <div className="flex flex-col gap-6">
          <Card title="Coverage and duration">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-graphite">Mandatory questions covered</dt>
                <dd className="font-medium tabular-nums">{s.covered.length} of {mandatory}</dd>
              </div>
              <div>
                <dt className="text-graphite">Duration against target</dt>
                <dd className="font-medium tabular-nums">{s.durationMin !== null ? `${s.durationMin} min, target ${target}` : `In progress or not started, target ${target}`}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Stimuli" description="A stimulus that failed to load counts as not seen.">
            {s.stimuli.length === 0 ? (
              <p className="text-sm text-graphite">None shown yet.</p>
            ) : (
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
            )}
          </Card>

          <Card title="Survey answers" description="Locked once recorded. Follow-up probes never change them.">
            {s.answers.length === 0 ? (
              <p className="text-sm text-graphite">No survey answers recorded.</p>
            ) : (
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
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Consent record" description={s.no > 1 && consent ? `Given in session 1 of ${s.participantId}. It still applies.` : undefined}>
          {consent ? (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-graphite">Agreed to</dt>
                <dd className="font-medium">{consent.wording}, {formatStamp(consent.at)}</dd>
              </div>
              <div><dt className="text-graphite">Recording</dt><dd className="font-medium">{consent.recording ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-graphite">AI moderator</dt><dd className="font-medium">{consent.aiModerator ? 'Yes' : 'Not used'}</dd></div>
              <div><dt className="text-graphite">Data use</dt><dd className="font-medium">{consent.dataUse ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-graphite">Contact again</dt><dd className="font-medium">{consent.recontact ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-graphite">18 or older</dt><dd className="font-medium">{consent.over18 ? 'Confirmed' : 'No'}</dd></div>
              <div><dt className="text-graphite">Device</dt><dd className="font-medium">{consent.device}</dd></div>
              {consent.withdrawn && (
                <p className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-pending-fg sm:col-span-2">
                  Withdrawn {formatStamp(consent.withdrawn.at)}. {consent.withdrawn.reason}
                </p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-graphite">No consent on record yet. The participant consents before booking or starting.</p>
          )}
        </Card>

        <Card title="Technical issues">
          {s.issues.length === 0 ? (
            <p className="text-sm text-graphite">No technical issues on this session.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {s.issues.map((x) => (
                <li key={x.id}>
                  <p className="font-medium">
                    {x.type} <span className="font-normal text-graphite">({x.severity}, {x.status})</span>
                  </p>
                  <p className="text-graphite">{x.status === 'Resolved' ? `Resolved by ${x.resolvedBy}: ${x.resolution}` : ISSUE_META[x.type].action}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Transcript excerpt" actions={s.mode === 'ai' ? <AIGeneratedTag /> : undefined}>
          {s.transcript.length === 0 ? (
            <p className="text-sm text-graphite">No transcript yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {s.transcript.map((t, i) => (
                <li key={i} className="text-sm">
                  <p className="text-xs text-graphite">{t.speaker}</p>
                  <p className={t.speaker === 'Participant' ? 'font-serif text-quote' : ''}>{t.text}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-graphite">An excerpt. The recording isn’t part of this prototype.</p>
        </Card>

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
            <p className="text-sm text-graphite">{s.mode === 'ai' ? 'AI-led sessions have no moderator notes.' : 'The moderator hasn’t submitted notes yet.'}</p>
          )}
        </Card>
      </div>

    </div>
  )
}
