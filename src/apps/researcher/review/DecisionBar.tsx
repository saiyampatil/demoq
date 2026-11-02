import { useMemo, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { useToast } from '@/components/Toast'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { scoreBreakdown, trackShort, type FlagTrack, type ReviewEvent, type ReviewFlag, type ReviewSession } from '@/mock/review'
import { decisionHistory, effectLines, effectOf } from '@/state/decisions'
import { inviteFromReserve, tick, type FieldworkDoc, type Outcomes, type ReserveCandidate } from '@/state/fieldwork'
import { addReviewEvent } from '@/state/reviewState'
import { mmss, Severity } from './reviewUi'

/** What the decision modals need from the study. */
export type DecisionCtx = {
  session: ReviewSession
  doc: FieldworkDoc
  /** Completed interviews the study needs. */
  target: number
  outcomes: Outcomes
  /** Reserve people who can be invited now, first in first out. */
  reserve: ReserveCandidate[]
  me: string
  /** Changes the fieldwork doc. Missing on sample data. */
  update?: (fn: (d: FieldworkDoc) => FieldworkDoc) => void
  paused: boolean
  /** Fieldwork is closed: a slot that opens can't be refilled. */
  closed?: boolean
  readOnly: boolean
}

const NOTE_MAX = 500
const counter = (n: number) => `${n}/${NOTE_MAX}`

export const EXCLUDE_REASONS = ['Not the right person (fails eligibility)', 'Duplicate or repeat entry', 'Did not engage honestly', 'Interview not run to the guide', 'Technical failure, the data is unusable']

const activeFlags = (s: ReviewSession) => s.flags.filter((f) => !s.dismissed?.[f.id])

/** The decision as a stamped line: who and when, with the zone. */
const by = (who: string, at: string) => `${who}, ${formatStamp(at)}`

function Effect({ headline, lines }: { headline: string; lines: string[] }) {
  return (
    <div role="note" aria-label="Effect" data-testid="effect" className="rounded-sm border border-mist bg-paper px-3.5 py-3 text-sm">
      <p className="font-medium">{headline}</p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-graphite tabular-nums">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

function Summary({ s }: { s: ReviewSession }) {
  const rows: [string, string][] = [
    ['Participant', s.participantId],
    ['Moderator', s.moderator],
    ['Release', s.release],
    ['Participant integrity', s.scored ? `${s.integrity} / 100` : 'Not scored yet'],
    ['Interview quality', s.scored ? `${s.quality} / 100` : 'Not scored yet'],
  ]
  return (
    <dl aria-label="Session summary" className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-sm border border-mist px-3.5 py-3 text-sm sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-graphite">{k}</dt>
          <dd className="font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function FlagList({ flags, label }: { flags: ReviewFlag[]; label: string }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <ul className="flex flex-col divide-y divide-mist rounded-sm border border-mist text-sm">
        {flags.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5">
            <span className="tabular-nums text-graphite">{mmss(f.atSec)}</span>
            <span className="font-medium">{f.type}</span>
            <Severity severity={f.severity} />
            <span className="text-xs text-graphite">{trackShort[f.track]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NoteField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <TextArea label={label} rows={3} maxLength={NOTE_MAX} value={value} onChange={(e) => onChange(e.target.value)} hint={<span data-testid="counter" className="tabular-nums">{counter(value.length)}</span>} />
}

function Footer({ onCancel, confirm, disabled, onConfirm, tone = 'primary' }: { onCancel: () => void; confirm: string; disabled: boolean; onConfirm: () => void; tone?: 'primary' | 'danger' }) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant={tone} disabled={disabled} onClick={onConfirm}>
        {confirm}
      </Button>
    </>
  )
}

// ─── the forms: shared by the modals and by Order replacement ────────────────

type AcceptForm = { note: string; ack: boolean }
type ExcludeForm = { reasons: string[]; note: string }
const acceptReady = (s: ReviewSession, f: AcceptForm) => f.note.trim().length > 0 && (activeFlags(s).length === 0 || f.ack)
const excludeReady = (f: ExcludeForm) => f.reasons.length > 0 || f.note.trim().length > 0

function AcceptFields({ s, form, set }: { s: ReviewSession; form: AcceptForm; set: (f: AcceptForm) => void }) {
  const flags = activeFlags(s)
  return (
    <div className="flex flex-col gap-3">
      <Summary s={s} />
      {flags.length > 0 && (
        <>
          <FlagList flags={flags} label={`${flags.length} ${flags.length === 1 ? 'flag' : 'flags'} on this session`} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={form.ack} onChange={(e) => set({ ...form, ack: e.target.checked })} className="mt-0.5 accent-[var(--color-iris-600)]" />
            I’ve reviewed these flags
          </label>
        </>
      )}
      <NoteField label="Note (required)" value={form.note} onChange={(note) => set({ ...form, note })} />
    </div>
  )
}

function ExcludeFields({ form, set }: { form: ExcludeForm; set: (f: ExcludeForm) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Rationale (required): pick a reason, type one, or both</legend>
      <div className="flex flex-col gap-1.5">
        {EXCLUDE_REASONS.map((r) => (
          <label key={r} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.reasons.includes(r)}
              onChange={(e) => set({ ...form, reasons: e.target.checked ? [...form.reasons, r] : form.reasons.filter((x) => x !== r) })}
              className="mt-0.5 accent-[var(--color-iris-600)]"
            />
            {r}
          </label>
        ))}
      </div>
      <NoteField label="In your own words" value={form.note} onChange={(note) => set({ ...form, note })} />
    </fieldset>
  )
}

const excludeNote = (f: ExcludeForm) => f.note.trim() || f.reasons.join('; ')

// ─── Accept ─────────────────────────────────────────────────────────────────

function AcceptModal({ ctx, open, onClose }: { ctx: DecisionCtx; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<AcceptForm>({ note: '', ack: false })
  const s = ctx.session
  const lines = effectLines(effectOf(ctx.doc, ctx.target, ctx.outcomes, ctx.reserve, { sessionId: s.id, to: 'Accepted' }))
  const close = () => {
    setForm({ note: '', ack: false })
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Accept ${s.participantId}`}
      description="Accepting needs a note, and an acknowledgement of any flags. Your name and the time are recorded."
      footer={
        <Footer
          onCancel={close}
          confirm="Accept session"
          disabled={!acceptReady(s, form)}
          onConfirm={() => {
            addReviewEvent(s.id, { type: 'decision', outcome: 'Accepted', note: form.note.trim(), by: ctx.me }, tick(ctx.doc))
            close()
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <Effect headline="Counts towards the study target and is available in Results Analysis." lines={lines} />
        <AcceptFields s={s} form={form} set={setForm} />
      </div>
    </Modal>
  )
}

// ─── Exclude ────────────────────────────────────────────────────────────────

function ExcludeModal({ ctx, open, onClose }: { ctx: DecisionCtx; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<ExcludeForm>({ reasons: [], note: '' })
  const s = ctx.session
  const lines = effectLines(effectOf(ctx.doc, ctx.target, ctx.outcomes, ctx.reserve, { sessionId: s.id, to: 'Excluded' }))
  const close = () => {
    setForm({ reasons: [], note: '' })
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Exclude ${s.participantId}`}
      description="Excluding needs a rationale. Your name and the time are recorded."
      footer={
        <Footer
          tone="danger"
          onCancel={close}
          confirm="Exclude session"
          disabled={!excludeReady(form)}
          onConfirm={() => {
            addReviewEvent(s.id, { type: 'decision', outcome: 'Excluded', note: excludeNote(form), reasons: form.reasons, by: ctx.me }, tick(ctx.doc))
            if (ctx.closed) toast(`${s.participantId} excluded. Fieldwork is closed, so the slot can’t be refilled.`)
            else if (ctx.reserve.length > 0) toast('Slot opened', { label: 'Invite from reserve', to: studyPath(ctx.doc.studyId, screenById.R18) })
            else toast('Slot opened', { label: 'Source more', to: studyPath(ctx.doc.studyId, screenById.R8) })
            close()
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <Effect headline="Frees one slot in the study target. The session stays visible for audit but is left out of analysis." lines={lines} />
        <ExcludeFields form={form} set={setForm} />
      </div>
    </Modal>
  )
}

// ─── Request clarification ──────────────────────────────────────────────────

function ClarifyModal({ ctx, open, onClose }: { ctx: DecisionCtx; open: boolean; onClose: () => void }) {
  const s = ctx.session
  const human = s.moderatorType === 'Human'
  const [to, setTo] = useState<'Participant' | 'Moderator'>('Participant')
  const [message, setMessage] = useState('')
  const [flagIds, setFlagIds] = useState<string[]>([])
  const lines = effectLines(effectOf(ctx.doc, ctx.target, ctx.outcomes, ctx.reserve, { sessionId: s.id, to: 'Under review' }))
  const close = () => {
    setMessage('')
    setFlagIds([])
    setTo('Participant')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Request clarification on ${s.participantId}`}
      description="Ask a question and wait for the answer. The session stays under review in the meantime."
      footer={
        <Footer
          onCancel={close}
          confirm="Send request"
          disabled={!message.trim()}
          onConfirm={() => {
            addReviewEvent(s.id, { type: 'clarify', to, message: message.trim(), flagIds, by: ctx.me }, tick(ctx.doc))
            close()
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <Effect headline="Stays Under review, waiting for the reply, until the answer arrives. It keeps counting as pending." lines={lines} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">Who is asked</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="clarify-to" checked={to === 'Participant'} onChange={() => setTo('Participant')} className="accent-[var(--color-iris-600)]" />
            The participant
          </label>
          {human ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="clarify-to" checked={to === 'Moderator'} onChange={() => setTo('Moderator')} className="accent-[var(--color-iris-600)]" />
              The moderator ({s.moderator})
            </label>
          ) : (
            <p className="text-xs text-graphite">This study is AI-led, so the question goes to the participant. Asking the moderator is only offered in human-led studies.</p>
          )}
        </fieldset>
        <TextArea label="Message (required)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        {s.flags.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">Attach flags (optional)</legend>
            {s.flags.map((f) => (
              <label key={f.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={flagIds.includes(f.id)}
                  onChange={(e) => setFlagIds(e.target.checked ? [...flagIds, f.id] : flagIds.filter((x) => x !== f.id))}
                  className="mt-0.5 accent-[var(--color-iris-600)]"
                />
                <span>
                  {f.type} <span className="text-graphite tabular-nums">at {mmss(f.atSec)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Modal>
  )
}

// ─── Order replacement ──────────────────────────────────────────────────────

function ReplacementModal({ ctx, open, onClose }: { ctx: DecisionCtx; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const s = ctx.session
  const next = ctx.reserve[0]
  const [step, setStep] = useState<'candidate' | 'decide'>('candidate')
  const [choice, setChoice] = useState<'Accepted' | 'Excluded'>('Accepted')
  const [acc, setAcc] = useState<AcceptForm>({ note: '', ack: false })
  const [exc, setExc] = useState<ExcludeForm>({ reasons: [], note: '' })
  const effect = useMemo(() => (next ? effectOf(ctx.doc, ctx.target, ctx.outcomes, ctx.reserve, { sessionId: s.id, to: choice }, next) : undefined), [ctx.doc, ctx.target, ctx.outcomes, ctx.reserve, s.id, choice, next])
  const close = () => {
    setStep('candidate')
    setChoice('Accepted')
    setAcc({ note: '', ack: false })
    setExc({ reasons: [], note: '' })
    onClose()
  }
  const ready = choice === 'Accepted' ? acceptReady(s, acc) : excludeReady(exc)
  const confirm = () => {
    if (!next || !ctx.update) return
    const floor = tick(ctx.doc)
    // One step: the replacement is invited and the original session is decided together, so it never stays Under review.
    ctx.update((d) => inviteFromReserve(d, ctx.me, [next]))
    const invitedAs = `P-${Math.max(2040, ...ctx.doc.sessions.map((x) => parseInt(x.participantId.slice(2), 10) || 0)) + 1}`
    addReviewEvent(s.id, { type: 'replacement', candidateId: next.id, invitedAs, by: ctx.me }, floor)
    toast(`${invitedAs} invited`, { label: 'View in Sessions', to: `${studyPath(ctx.doc.studyId, screenById.R18)}?tab=sessions` })
    if (choice === 'Accepted') addReviewEvent(s.id, { type: 'decision', outcome: 'Accepted', note: acc.note.trim(), by: ctx.me }, floor)
    else addReviewEvent(s.id, { type: 'decision', outcome: 'Excluded', note: excludeNote(exc), reasons: exc.reasons, by: ctx.me }, floor)
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Order a replacement for ${s.participantId}`}
      description="A replacement comes from the reserve, first in first out. The original session is then accepted or excluded: it can’t stay under review."
      footer={
        !next ? (
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        ) : step === 'candidate' ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setStep('decide')}>
              Continue: decide on {s.participantId}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('candidate')}>
              Back
            </Button>
            <Button variant={choice === 'Excluded' ? 'danger' : 'primary'} disabled={!ready} onClick={confirm}>
              Order replacement and {choice === 'Accepted' ? 'accept' : 'exclude'} {s.participantId}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        {!next ? (
          <div role="status" data-testid="reserve-empty" className="rounded-sm border border-dashed border-mist-strong px-4 py-5 text-sm">
            <p className="font-medium">The reserve is empty.</p>
            <p className="mt-1 text-graphite">There is nobody to invite, so there is nothing to confirm. Source more people from Fieldwork, then come back.</p>
          </div>
        ) : step === 'candidate' ? (
          <>
            <div className="rounded-sm border border-mist px-3.5 py-3 text-sm" data-testid="next-candidate">
              <p className="text-graphite">Next in the reserve</p>
              <p className="mt-0.5 font-semibold tabular-nums">{next.id}</p>
              <p className="tabular-nums text-graphite">
                {next.contact} · {next.source} · screened {formatStamp(next.arrivedAt)}
              </p>
            </div>
            <p className="text-sm text-graphite">After you continue you decide on {s.participantId}. Nothing is invited until you confirm the last step.</p>
          </>
        ) : (
          <>
            {effect && <Effect headline={`Invites ${next.id} as a new participant, and ${choice === 'Accepted' ? 'accepts' : 'excludes'} ${s.participantId}.`} lines={effectLines(effect)} />}
            <div role="radiogroup" aria-label={`Decision on ${s.participantId}`} className="inline-flex self-start rounded-sm border border-mist-strong bg-haze p-0.5">
              {(['Accepted', 'Excluded'] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={choice === c} onClick={() => setChoice(c)} className={cn('rounded-xs px-3 py-1 text-sm', choice === c ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}>
                  {c === 'Accepted' ? 'Accept' : 'Exclude'} {s.participantId}
                </button>
              ))}
            </div>
            {choice === 'Accepted' ? <AcceptFields s={s} form={acc} set={setAcc} /> : <ExcludeFields form={exc} set={setExc} />}
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Reopen ─────────────────────────────────────────────────────────────────

function ReopenModal({ ctx, open, onClose }: { ctx: DecisionCtx; open: boolean; onClose: () => void }) {
  const s = ctx.session
  const [reason, setReason] = useState('')
  const lines = effectLines(effectOf(ctx.doc, ctx.target, ctx.outcomes, ctx.reserve, { sessionId: s.id, to: 'Under review' }))
  const close = () => {
    setReason('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Reopen ${s.participantId} for review`}
      description="The session goes back to Under review. The earlier decision stays in its history."
      footer={
        <Footer
          onCancel={close}
          confirm="Reopen for review"
          disabled={!reason.trim()}
          onConfirm={() => {
            addReviewEvent(s.id, { type: 'reopen', reason: reason.trim(), by: ctx.me }, tick(ctx.doc))
            close()
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <Effect headline={`Returns to Under review. It was ${s.status}.`} lines={lines} />
        <NoteField label="Reason (required)" value={reason} onChange={setReason} />
      </div>
    </Modal>
  )
}

// ─── Dismiss a flag ─────────────────────────────────────────────────────────

export function DismissFlagModal({ ctx, flag, onClose }: { ctx: DecisionCtx; flag: ReviewFlag | undefined; onClose: () => void }) {
  const s = ctx.session
  const [reason, setReason] = useState('')
  const track: FlagTrack | undefined = flag?.track
  const now = new Set(Object.keys(s.dismissed ?? {}))
  const base = s.baseScores ? { ...s, integrity: s.baseScores.integrity, quality: s.baseScores.quality } : s
  const before = track ? scoreBreakdown(base, track, now).score : 0
  const after = track && flag ? scoreBreakdown(base, track, new Set([...now, flag.id])).score : 0
  const close = () => {
    setReason('')
    onClose()
  }
  return (
    <Modal
      open={!!flag}
      onClose={close}
      title={`Dismiss “${flag?.type ?? ''}”`}
      description="A dismissed flag stays listed, struck through, with your name and reason. It stops counting toward the score. It is never deleted."
      footer={
        <Footer
          onCancel={close}
          confirm="Dismiss flag"
          disabled={!reason.trim()}
          onConfirm={() => {
            if (flag) addReviewEvent(s.id, { type: 'dismiss', flagId: flag.id, reason: reason.trim(), by: ctx.me }, tick(ctx.doc))
            close()
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        {flag && <Effect headline="The flag stays listed and leaves the score." lines={[`${track === 'Integrity' ? 'Participant integrity' : 'Interview quality'} score ${before} → ${after}`]} />}
        <TextArea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  )
}

// ─── the bar ────────────────────────────────────────────────────────────────

const MOCK_ANSWER = {
  Participant: 'I was on my commute and rushed a few of those answers. Happy to say that I do use a moisturizer most days, and the refill idea appealed to me.',
  Moderator: 'The refill question was dropped because we ran out of time. The participant did cover the theme earlier, around the midpoint.',
}

type Modal = 'accept' | 'exclude' | 'clarify' | 'replace' | 'reopen'

/**
 * R22's action bar. While the session is Under review: Accept, Exclude, Request clarification, Order replacement.
 * Once it is Accepted or Excluded it becomes the read-only decision record, with Reopen for review.
 */
export function DecisionBar({ ctx }: { ctx: DecisionCtx }) {
  const s = ctx.session
  const [open, setOpen] = useState<Modal>()
  const done = () => setOpen(undefined)
  const blocked = ctx.readOnly ? 'This is sample data. Nothing can be changed.' : undefined
  const replaceBlocked = blocked ?? (ctx.closed ? 'Fieldwork is closed' : ctx.paused ? 'Study is paused' : undefined)
  const history = decisionHistory(s)

  const answer = () => {
    if (!s.awaiting) return
    addReviewEvent(s.id, { type: 'answer', from: s.awaiting.to === 'Moderator' ? s.moderator : s.participantId, text: MOCK_ANSWER[s.awaiting.to], replyTo: s.awaiting.id, by: s.awaiting.to === 'Moderator' ? s.moderator : s.participantId }, tick(ctx.doc))
  }

  if (s.status !== 'Under review') {
    const d = s.decision
    return (
      <section aria-label="Decision record" className="rounded-md border border-mist bg-surface p-5">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-md font-semibold">
              Decision record <StatusChip status={s.status} size="sm" />
            </h2>
            {d && (
              <p data-testid="decision-by" className="mt-1 text-sm tabular-nums text-graphite">
                {s.status} by {by(d.by, d.at)}
              </p>
            )}
          </div>
          {blocked ? (
            <Tooltip content={blocked} focusable>
              <Button disabled>Reopen for review</Button>
            </Tooltip>
          ) : (
            <Button onClick={() => setOpen('reopen')}>Reopen for review</Button>
          )}
        </div>
        {d && (
          <div className="mt-3 rounded-sm border border-mist bg-paper px-3.5 py-3 text-sm">
            <p className="text-xs text-graphite">Researcher’s note</p>
            <p data-testid="decision-note" className="mt-0.5 whitespace-pre-wrap">{d.note}</p>
            {d.reasons && d.reasons.length > 0 && <p className="mt-1 text-xs text-graphite">Reasons: {d.reasons.join('; ')}</p>}
          </div>
        )}
        {s.status === 'Excluded' && <p className="mt-2 text-sm text-graphite">Left out of analysis and out of the study target. The session stays visible for audit.</p>}
        {history.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium">History</p>
            <ol data-testid="history" className="flex flex-col gap-1 text-sm text-graphite">
              {history.map((e) => (
                <li key={e.id} className="tabular-nums">
                  {e.type === 'reopen' ? `Reopened by ${by(e.by, e.at)}: ${e.reason}` : `${e.outcome} by ${by(e.by, e.at)}: ${e.note}`}
                </li>
              ))}
            </ol>
          </div>
        )}
        <ReopenModal ctx={ctx} open={open === 'reopen'} onClose={done} />
      </section>
    )
  }

  const btn = (label: string, kind: Modal, variant: 'primary' | 'secondary' | 'danger', reason?: string) =>
    reason ? (
      <Tooltip content={reason} focusable>
        <Button disabled>{label}</Button>
      </Tooltip>
    ) : (
      <Button variant={variant} onClick={() => setOpen(kind)}>
        {label}
      </Button>
    )

  return (
    <section aria-label="Decision" className="rounded-md border border-mist bg-surface p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="flex flex-wrap items-center gap-2 text-md font-semibold">
            Decision <StatusChip status="Under review" size="sm" />
            {s.awaiting && <span data-testid="substate" className="rounded-xs border border-pending-line bg-pending-bg px-1.5 py-0.5 text-xs font-medium text-pending-fg">Waiting for {s.awaiting.to.toLowerCase()}</span>}
          </h2>
          <p className="mt-0.5 text-sm text-graphite">Flags support your decision. Nothing is accepted or excluded for you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {btn('Accept', 'accept', 'primary', blocked)}
          {btn('Exclude', 'exclude', 'secondary', blocked)}
          {btn('Request clarification', 'clarify', 'secondary', blocked)}
          {btn('Order replacement', 'replace', 'secondary', replaceBlocked)}
        </div>
      </div>

      {s.awaiting && (
        <Banner tone="warning" title={`Awaiting clarification from the ${s.awaiting.to.toLowerCase()}`}>
          <p className="tabular-nums">
            Asked by {by(s.awaiting.by, s.awaiting.at)}: “{s.awaiting.message}”
          </p>
          <p className="mt-1 text-xs">The session stays Under review and counts as pending until the answer arrives, or you decide.</p>
          {import.meta.env.DEV && !ctx.readOnly && (
            <div className="mt-2">
              <Button size="sm" onClick={answer}>
                Simulate: the answer arrives
              </Button>
            </div>
          )}
        </Banner>
      )}

      <AcceptModal ctx={ctx} open={open === 'accept'} onClose={done} />
      <ExcludeModal ctx={ctx} open={open === 'exclude'} onClose={done} />
      <ClarifyModal ctx={ctx} open={open === 'clarify'} onClose={done} />
      <ReplacementModal ctx={ctx} open={open === 'replace'} onClose={done} />
    </section>
  )
}

// ─── Activity ───────────────────────────────────────────────────────────────

function describe(e: ReviewEvent, s: ReviewSession): { title: string; body?: string } {
  const flagName = (id: string) => s.flags.find((f) => f.id === id)?.type ?? id
  switch (e.type) {
    case 'decision':
      return { title: e.outcome === 'Accepted' ? 'Accepted' : 'Excluded', body: e.note + (e.reasons?.length ? ` (${e.reasons.join('; ')})` : '') }
    case 'reopen':
      return { title: 'Reopened for review', body: e.reason }
    case 'clarify':
      return { title: `Asked the ${e.to.toLowerCase()} for clarification`, body: e.message + (e.flagIds.length ? ` (flags: ${e.flagIds.map(flagName).join(', ')})` : '') }
    case 'answer':
      return { title: `Answer from ${e.from}`, body: e.text }
    case 'replacement':
      return { title: 'Ordered a replacement', body: `${e.candidateId} was invited from the reserve as ${e.invitedAs}.` }
    case 'dismiss':
      return { title: `Dismissed the flag “${flagName(e.flagId)}”`, body: e.reason }
  }
}

/** Everything that has happened to this session in review, oldest first. Nothing here can be edited or removed. */
export function ActivityPanel({ session }: { session: ReviewSession }) {
  const events = session.events ?? []
  return events.length === 0 ? (
    <p className="text-sm text-graphite">Nothing has happened to this session in review yet.</p>
  ) : (
    <ol aria-label="Review activity" data-testid="activity" className="flex flex-col divide-y divide-mist">
      {events.map((e) => {
        const d = describe(e, session)
        return (
          <li key={e.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
            <p className="text-sm font-medium">{d.title}</p>
            {d.body && <p className="text-sm text-graphite">{d.body}</p>}
            <p className="text-xs text-graphite tabular-nums">
              {e.by}, {formatStamp(e.at)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
