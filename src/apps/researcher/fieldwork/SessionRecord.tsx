import { Link, useParams } from 'react-router'
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
import { ISSUE_META, moderatorName } from '@/state/fieldwork'
import { PageHeader } from '../../shared/PageHeader'
import { FieldworkGate, slotText } from './FieldworkBits'
import { SampleDataBanner } from '../SampleDataBanner'
import { useStudySessions } from '../useStudySessions'

export function SessionRecord() {
  const { sessionId = '' } = useParams()
  const { studyId, study, editable, doc, review, preview } = useStudySessions()
  if (!editable || !study || !doc) return <FieldworkGate studyId={studyId} editable={editable} />
  const back = { to: studyPath(studyId, screenById.R18), label: 'Fieldwork command center' }
  const s = doc.sessions.find((x) => x.id === sessionId)
  const crumbs = (
    <>
      <Breadcrumb parent={back} current={sessionId} className="-mb-2" />
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

  return (
    <div className="flex flex-col gap-6">
      {crumbs}
      <PageHeader
        id="R19"
        title={`Session ${s.id}`}
        description={`${s.ref}${s.cohort ? `, ${s.cohort}` : ''}${s.reserve ? ' (reserve)' : ''}`}
        meta={
          <>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Timeline">
          <ol className="flex flex-col gap-2.5">
            {s.events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-graphite tabular-nums">{slotText(e.at)}</span>
                <span>{e.text}</span>
              </li>
            ))}
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
                    <span className="flex-1">{x.name}</span>
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
                    <dd className="font-medium">{a.answer} <span className="text-xs font-normal text-graphite">Locked {formatStamp(a.lockedAt)}</span></dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Consent record">
          {s.consent ? (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-graphite">Agreed to</dt>
                <dd className="font-medium">{s.consent.wording}, {formatStamp(s.consent.at)}</dd>
              </div>
              <div><dt className="text-graphite">Recording</dt><dd className="font-medium">{s.consent.recording ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-graphite">AI moderator</dt><dd className="font-medium">{s.consent.aiModerator ? 'Yes' : 'Not used'}</dd></div>
              <div><dt className="text-graphite">Data use</dt><dd className="font-medium">{s.consent.dataUse ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-graphite">Contact again</dt><dd className="font-medium">{s.consent.recontact ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-graphite">18 or older</dt><dd className="font-medium">{s.consent.over18 ? 'Confirmed' : 'No'}</dd></div>
              <div><dt className="text-graphite">Device</dt><dd className="font-medium">{s.consent.device}</dd></div>
              {s.consent.withdrawn && (
                <p className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-pending-fg sm:col-span-2">
                  Withdrawn {formatStamp(s.consent.withdrawn.at)}. {s.consent.withdrawn.reason}
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
