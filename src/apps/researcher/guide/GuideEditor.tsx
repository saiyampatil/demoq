import { useEffect, useMemo, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { ArrowUpIcon, CheckIcon, CloseIcon, HistoryIcon, PlusIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { SideDrawer } from '@/components/SideDrawer'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDateTime, formatDay } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import {
  allQuestions,
  approvalBlockers,
  approveGuide,
  configBlockers,
  coverageCheck,
  durationCheck,
  editGuide,
  fixCoverage,
  fixDuration,
  flaggedQuestions,
  moveQuestion,
  moveSection,
  newQuestion,
  newSection,
  overrideCheck,
  pruneBranches,
  regenerateGuide,
  saveGuideVersion,
  shareGuide,
  startGuide,
  studyHasClient,
  totalMinutes,
  touchQuestion,
  type Check,
  type Guide,
  type GuideEvent,
  type GuideSection,
} from '@/state/guide'
import { uid } from '@/state/brief'
import { OriginTag } from '../audience/OriginTag'
import { PageHeader } from '../../shared/PageHeader'
import { SendForApprovalCard } from '../brief/SendForApprovalCard'
import { ClientReviewBar } from './ClientReviewBar'
import { downloadGuide } from './download'
import { GuideGate, ReplaceGuideModal, VersionBanner } from './GuideBits'
import { QuestionCard } from './QuestionCard'
import { useGuide } from './useGuide'

const small = cn(controlBase, 'h-8 px-2 text-sm')

export function GuideEditor() {
  const { studyId, study, editable, doc, me, update, ensure, stale } = useGuide()
  const [history, setHistory] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [regenerate, setRegenerate] = useState(false)
  const [overriding, setOverriding] = useState<'coverage' | 'duration'>()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (editable && !doc) ensure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, doc === undefined])

  // Reaching R14 with a complete setup starts the draft. There is no Generate button.
  const ready = !!doc && configBlockers(doc.moderator).length === 0
  useEffect(() => {
    if (doc && ready && !doc.guide && !doc.guidePending) update(startGuide)
  }, [doc, ready, update])

  const flags = useMemo(() => (doc ? flaggedQuestions(doc) : []), [doc])

  if (!editable) return <GuideGate reason="readonly" />
  if (stale) return <GuideGate reason="stale" />
  if (!doc) return null

  const header = (meta?: React.ReactNode, actions?: React.ReactNode) => <PageHeader id="R14" title="Discussion guide" description="Drafted by the AI from the brief, audience, stimuli and moderator setup. Edit anything." meta={meta} actions={actions} />
  const back = { to: studyPath(studyId, screenById.R13), label: 'Stimuli' }

  const blockers = configBlockers(doc.moderator)
  if (!doc.guide && blockers.length) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface px-6 py-10">
          <h2 className="text-lg font-semibold">Finish the moderator setup first</h2>
          <p className="mt-1 max-w-prose text-graphite">The guide is drafted once the setup is complete. Still needed: {blockers.join(', ').toLowerCase()}.</p>
          <Button className="mt-4" variant="primary" to={studyPath(studyId, screenById.R12)}>
            Go to moderator setup
          </Button>
        </div>
        <WizardFooter previous={back} />
      </div>
    )
  }
  if (!doc.guide) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <div className="flex items-center gap-2 px-6 py-10 text-graphite" role="status">
            <Spinner /> Drafting the guide from the brief, audience and stimuli…
          </div>
        </div>
        <WizardFooter previous={back} />
      </div>
    )
  }

  const g = doc.guide
  const target = doc.moderator.durationMin
  const ai = doc.moderator.mode === 'ai'
  const edit = (fn: (g: Guide) => Guide, note?: string) => update((d) => editGuide(d, me, fn, note))
  const editSection = (id: string, fn: (s: GuideSection) => GuideSection) => edit((x) => ({ ...x, sections: x.sections.map((s) => (s.id === id ? fn({ ...s, origin: s.origin === 'ai' ? 'edited' : s.origin }) : s)) }))
  const editQuestion = (sid: string, qid: string, fn: (q: ReturnType<typeof newQuestion>) => ReturnType<typeof newQuestion>) =>
    edit((x) => ({ ...x, sections: x.sections.map((s) => (s.id === sid ? { ...s, questions: s.questions.map((q) => (q.id === qid ? touchQuestion(fn(q)) : q)) } : s)) }))

  const coverage = coverageCheck(g)
  const duration = durationCheck(g, target)
  const hasClient = studyHasClient(study?.client)
  const dirty = doc.status === 'Draft' && doc.edits > 0
  const approveBlockers = approvalBlockers(doc, hasClient)
  const clientEvent = [...doc.events].reverse().find((e) => e.type === 'client-approved' && e.version === doc.version)
  // Draft on a study with a client: the next step is sharing, not approving.
  const needsShare = hasClient && doc.status === 'Draft' && !clientEvent
  const shareWithClient = () => setSharing(true)
  const shortDate = formatDay
  const guideBlockers = approvalBlockers(doc, false)
  const footerMessage =
    doc.status === 'Approved' ? (
      <span className="flex items-center gap-1.5 text-positive-fg">
        <CheckIcon /> Version {doc.approved?.version} approved. Launch is unlocked.
      </span>
    ) : needsShare ? (
      'Share with the client before approving.'
    ) : hasClient && !clientEvent ? (
      'Waiting on the client’s decision. Record it above.'
    ) : guideBlockers.length ? (
      `Before you approve: ${guideBlockers[0].charAt(0).toLowerCase()}${guideBlockers[0].slice(1)}.`
    ) : clientEvent ? (
      `Client approved version ${doc.version} on ${shortDate(clientEvent.at)}. Approving records your name, the time and the version.`
    ) : (
      'No client on this study. Approving records your name, the time and the version.'
    )

  return (
    <div className="flex flex-col gap-6">
      {header(
        <>
          <span className="flex items-center gap-1.5">
            <StatusChip status={doc.status} size="sm" />
            <span className="font-medium text-ink tabular-nums">v{doc.version}</span>
          </span>
          <span>{ai ? 'AI moderator' : 'Human moderator'}</span>
          <span>Built from brief version {g.builtFrom.briefVersion}, audience version {g.builtFrom.audienceVersion}</span>
          {dirty && <span className="font-medium text-pending-fg">Unsaved changes</span>}
        </>,
        <>
          <Button variant="ghost" onClick={() => setRegenerate(true)}>
            Regenerate from brief and audience
          </Button>
          <Button variant="ghost" icon={<HistoryIcon />} onClick={() => setHistory(true)}>
            Version history
          </Button>
          <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={() => update((d) => saveGuideVersion(d, me))}>
            Save version
          </Button>
          {hasClient && doc.status !== 'Approved' && (
            <Button variant={dirty ? 'secondary' : 'primary'} onClick={() => setSharing(true)}>
              Share with client
            </Button>
          )}
        </>,
      )}

      <VersionBanner doc={doc} />

      <ClientReviewBar doc={doc} client={study?.client ?? ''} me={me} update={update} onShare={() => setSharing(true)} />

      <section aria-label="AI checks" className="flex flex-col gap-3">
        <CheckBanner
          title="Coverage"
          check={coverage}
          onFix={() => edit(fixCoverage, 'Added questions to cover every objective')}
          fixLabel="Add questions for the gaps"
          onOverride={() => setOverriding('coverage')}
        />
        <CheckBanner
          title="Duration"
          check={duration}
          onFix={() => edit((x) => fixDuration(x, target), 'Section times scaled to the target')}
          fixLabel={`Scale sections to ${target} min`}
          onOverride={() => setOverriding('duration')}
        />
        {flags.length > 0 && (
          <Banner
            tone="warning"
            title={`${flags.length === 1 ? '1 question uses' : `${flags.length} questions use`} a stimulus that isn’t active`}
            actions={
              <Button size="sm" to={studyPath(studyId, screenById.R13)}>
                Open library
              </Button>
            }
          >
            {flags.map((f) => `Q${allQuestions(g).findIndex((x) => x.id === f.question.id) + 1} (${f.stimulusName})`).join(', ')}. Switch the stimulus back on, or remove it from the question.
          </Banner>
        )}
      </section>

      <Card
        title="Research objectives"
        description="What the guide must cover. Each question says which objectives it covers."
        actions={
          <Button size="sm" icon={<PlusIcon />} onClick={() => edit((x) => ({ ...x, objectives: [...x.objectives, { id: uid('o'), text: '' }] }), 'Objective added')}>
            Add objective
          </Button>
        }
      >
        <ol className="flex flex-col gap-2">
          {g.objectives.map((o, i) => {
            const n = allQuestions(g).filter((q) => q.covers.includes(o.id)).length
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-haze text-xs font-semibold tabular-nums">{i + 1}</span>
                <input
                  aria-label={`Objective ${i + 1}`}
                  value={o.text}
                  placeholder="What the interviews need to find out"
                  onChange={(e) => edit((x) => ({ ...x, objectives: x.objectives.map((y) => (y.id === o.id ? { ...y, text: e.target.value } : y)) }), 'Objective edited')}
                  className={cn(small, 'min-w-0 flex-1 bg-surface')}
                />
                <span className={cn('w-44 text-sm', n ? 'text-positive-fg' : 'font-medium text-pending-fg')}>{n ? `Covered by ${n} ${n === 1 ? 'question' : 'questions'}` : 'No question covers this'}</span>
                <button
                  type="button"
                  aria-label={`Remove objective ${i + 1}`}
                  onClick={() => edit((x) => ({ ...x, objectives: x.objectives.filter((y) => y.id !== o.id), sections: x.sections.map((s) => ({ ...s, questions: s.questions.map((q) => ({ ...q, covers: q.covers.filter((c) => c !== o.id) })) })) }), 'Objective removed')}
                  className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink"
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">Sections</h2>
          <p className={cn('text-sm tabular-nums', duration.ok ? 'text-graphite' : 'font-medium text-pending-fg')}>
            {totalMinutes(g)} min of {target} min target
          </p>
        </div>
        {g.sections.map((s, si) => (
          <section key={s.id} aria-label={s.title} className="flex flex-col gap-3 rounded-md border border-mist bg-paper p-4">
            <header className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-ink text-xs font-semibold tabular-nums">{si + 1}</span>
              <input aria-label={`Section ${si + 1} title`} value={s.title} onChange={(e) => editSection(s.id, (x) => ({ ...x, title: e.target.value }))} className={cn(small, 'h-9 min-w-48 flex-1 bg-surface text-base font-semibold')} />
              {s.origin === 'ai' ? <AIGeneratedTag /> : <OriginTag origin={s.origin} />}
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="number"
                  min={0}
                  aria-label={`Section ${si + 1} minutes`}
                  value={Number.isFinite(s.minutes) ? s.minutes : ''}
                  onChange={(e) => editSection(s.id, (x) => ({ ...x, minutes: Math.max(0, Math.floor(Number(e.target.value))) }))}
                  className={cn(small, 'w-16 bg-surface tabular-nums')}
                />
                <span className="text-graphite">min</span>
              </label>
              <Button size="sm" variant="ghost" disabled={si === 0} onClick={() => edit((x) => moveSection(x, s.id, -1))} aria-label={`Move section ${si + 1} up`}>
                <ArrowUpIcon size={14} />
              </Button>
              <Button size="sm" variant="ghost" disabled={si === g.sections.length - 1} onClick={() => edit((x) => moveSection(x, s.id, 1))} aria-label={`Move section ${si + 1} down`}>
                <ArrowUpIcon size={14} className="rotate-180" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => edit((x) => pruneBranches({ ...x, sections: x.sections.filter((y) => y.id !== s.id) }), 'Section removed')} aria-label={`Remove section ${si + 1}`}>
                Remove
              </Button>
            </header>
            {s.questions.length === 0 && <p className="px-1 text-sm text-graphite">No questions in this section.</p>}
            <ol className="flex flex-col gap-3">
              {s.questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  guide={g}
                  stimuli={doc.stimuli.items}
                  surveys={doc.moderator.surveys}
                  aiMode={ai}
                  flag={flags.find((f) => f.question.id === q.id)}
                  libraryTo={studyPath(studyId, screenById.R13)}
                  onChange={(fn) => editQuestion(s.id, q.id, fn)}
                  onMove={(dir) => edit((x) => moveQuestion(x, q.id, dir))}
                  onRemove={() => edit((x) => pruneBranches({ ...x, sections: x.sections.map((y) => (y.id === s.id ? { ...y, questions: y.questions.filter((z) => z.id !== q.id) } : y)) }), 'Question removed')}
                  onClearStimulus={() => editQuestion(s.id, q.id, (x) => ({ ...x, stimulusId: undefined }))}
                />
              ))}
            </ol>
            <Button size="sm" className="self-start" icon={<PlusIcon />} onClick={() => edit((g2) => ({ ...g2, sections: g2.sections.map((y) => (y.id === s.id ? { ...y, questions: [...y.questions, newQuestion()] } : y)) }), 'Question added')}>
              Add question
            </Button>
          </section>
        ))}
        <Button className="self-start" icon={<PlusIcon />} onClick={() => edit((x) => ({ ...x, sections: [...x.sections, newSection()] }), 'Section added')}>
          Add section
        </Button>
      </div>

      <Card title="Wrap-up conditions" description="When the interview ends.">
        <ul className="flex flex-col gap-2">
          {g.wrapUp.map((w, i) => (
            <li key={i} className="flex items-center gap-2">
              <input aria-label={`Wrap-up condition ${i + 1}`} value={w} onChange={(e) => edit((x) => ({ ...x, wrapUp: x.wrapUp.map((y, j) => (j === i ? e.target.value : y)) }), 'Wrap-up edited')} className={cn(small, 'w-full bg-surface')} />
              <button type="button" aria-label={`Remove wrap-up condition ${i + 1}`} onClick={() => edit((x) => ({ ...x, wrapUp: x.wrapUp.filter((_, j) => j !== i) }), 'Wrap-up removed')} className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" icon={<PlusIcon />} className="mt-2" onClick={() => edit((x) => ({ ...x, wrapUp: [...x.wrapUp, ''] }), 'Wrap-up added')}>
          Add condition
        </Button>
      </Card>

      <WizardFooter previous={back} message={footerMessage}>
        {doc.status === 'Approved' ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R15)}>
            Continue to launch
          </Button>
        ) : needsShare ? (
          <Button variant="primary" onClick={shareWithClient}>
            Share with client
          </Button>
        ) : approveBlockers.length ? (
          <Tooltip focusable content={`${approveBlockers.join('. ')}.`}>
            <Button variant="primary" disabled>
              Approve version {doc.version}
            </Button>
          </Tooltip>
        ) : (
          <Button variant="primary" onClick={() => update((d) => approveGuide(d, me, clientEvent ? `${study?.client ?? 'Client'} (client)` : undefined, hasClient))}>
            Approve version {doc.version}
          </Button>
        )}
      </WizardFooter>

      <Modal
        open={!!overriding}
        onClose={() => setOverriding(undefined)}
        title={`Override the ${overriding} flag`}
        description="The flag stays on record. Your reason is logged with your name and the time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverriding(undefined)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!reason.trim()}
              onClick={() => {
                if (overriding) update((d) => overrideCheck(d, me, overriding, reason))
                setOverriding(undefined)
                setReason('')
              }}
            >
              Override
            </Button>
          </>
        }
      >
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <ReplaceGuideModal
        open={regenerate}
        doc={doc}
        title="Regenerate the guide from the brief and audience?"
        onCancel={() => setRegenerate(false)}
        onConfirm={() => {
          update((d) => regenerateGuide(d, me))
          setRegenerate(false)
        }}
      />

      <SideDrawer open={sharing} onClose={() => setSharing(false)} title="Share with client" description={`Choose how version ${doc.version} reaches the client.`}>
        <SendForApprovalCard
          bare
          noun="guide"
          version={doc.version}
          blockers={[]}
          emailHint="The email goes to the client with the guide. The client’s review page isn’t built yet, so you record their answer here."
          footnote="Sharing sets this version to In Review. Record Changes requested or Client approved in the bar above the guide."
          onSendEmail={(emails, message) => {
            update((d) => shareGuide(d, me, 'email', emails, message))
            setSharing(false)
          }}
          onDownload={() => {
            downloadGuide(doc, study?.name ?? 'Study')
            update((d) => shareGuide(d, me, 'pdf'))
            setSharing(false)
          }}
        />
      </SideDrawer>

      <SideDrawer open={history} onClose={() => setHistory(false)} title="Version history" description="Who did what, and when.">
        <HistoryList events={doc.events} />
      </SideDrawer>
    </div>
  )
}

function CheckBanner({ title, check, onFix, fixLabel, onOverride }: { title: string; check: Check; onFix: () => void; fixLabel: string; onOverride: () => void }) {
  if (check.ok)
    return (
      <p className="flex items-center gap-2 rounded-sm border border-positive-line bg-positive-bg px-4 py-2.5 text-sm">
        <CheckIcon className="text-positive-fg" />
        <span className="font-medium">{title}:</span> {check.message}
      </p>
    )
  if (check.overridden)
    return (
      <Banner tone="info" title={`${title} flag overridden`}>
        {check.message} Overridden by {check.overridden.by}, {formatDateTime(check.overridden.at)}: “{check.overridden.reason}”
      </Banner>
    )
  return (
    <Banner
      tone="warning"
      title={title === 'Duration' ? `Duration: ${check.message}` : 'Coverage: some objectives have no question'}
      actions={
        <>
          <Button size="sm" onClick={onFix}>
            {fixLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={onOverride}>
            Override
          </Button>
        </>
      }
    >
      {title === 'Duration' ? 'Fix the section times, or override with a reason.' : `${check.message} Fix it, or override with a reason.`}
    </Banner>
  )
}

const eventText = (e: GuideEvent) => {
  const v = `Version ${e.version}`
  switch (e.type) {
    case 'drafted':
      return `${v} drafted by ${e.by}`
    case 'redrafted':
      return `${v} drafted again by ${e.by}`
    case 'shared':
      return `${v} shared with the client by ${e.by} (PDF)`
    case 'emailed':
      return `${v} emailed for approval to ${e.note} by ${e.by}`
    case 'saved':
      return `${v} saved by ${e.by}`
    case 'changes-requested':
      return `${v}: changes requested${e.note ? `. ${e.note}` : ''}`
    case 'client-approved':
      return `${v} approved by the client${e.note ? `, ${e.note}` : ''}`
    case 'approved':
      return `${v} approved by ${e.by}`
    case 'reopened':
      return e.note ?? `${v} created`
    case 'override':
      return e.note ?? `${v}: flag overridden`
  }
}

function HistoryList({ events }: { events: GuideEvent[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="rounded-sm border border-mist px-3 py-2 text-sm">
          <p className={cn(e.type === 'approved' && 'font-semibold')}>{eventText(e)}</p>
          {e.feedback && <p className="mt-0.5 text-graphite">“{e.feedback}”</p>}
          {e.type === 'saved' && e.note && <p className="text-graphite">{e.note}.</p>}
          {e.type === 'approved' && e.note && <p className="text-graphite">{e.note}.</p>}
          <p className="mt-0.5 text-xs text-graphite tabular-nums">
            {e.by} · {formatDateTime(e.at)}
          </p>
        </li>
      ))}
    </ol>
  )
}

