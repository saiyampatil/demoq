import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { SideDrawer } from '@/components/SideDrawer'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { formatDateTime } from '@/lib/format'
import { useFeature } from '@/state/features'
import { addEntry, type Applicant, type CheckResult, type ScreeningOutcome, type VerificationStatus } from '@/state/screening'
import type { AudienceDoc } from '@/state/audience'

type Pending = { kind: 'outcome'; to: ScreeningOutcome } | { kind: 'verification'; to: VerificationStatus }

/** Why a person marks someone ineligible. A reason is always required; "Other" needs words. */
const INELIGIBLE_REASONS = ['Outside the audience', 'Answers contradict each other', 'Failed verification', 'Works in market research or advertising', 'Took part in research recently', 'Duplicate applicant', 'Other']

/** A disabled button says why, on hover and focus. */
const gate = (reason: string | undefined, button: React.ReactNode, align: 'left' | 'right') =>
  reason ? (
    <Tooltip content={reason} focusable align={align}>
      <span className="w-full [&>button]:w-full">{button}</span>
    </Tooltip>
  ) : (
    button
  )

const resultMark: Record<CheckResult, { icon: string; label: string; cls: string }> = {
  pass: { icon: '✓', label: 'Pass', cls: 'text-positive-fg' },
  fail: { icon: '✗', label: 'Fail', cls: 'text-negative-fg' },
  unclear: { icon: '?', label: 'Unclear', cls: 'text-pending-fg' },
  skip: { icon: '–', label: 'Not checked', cls: 'text-muted' },
}

type Props = {
  applicant: Applicant | undefined
  /** The pool is finalized in R11, so decisions can't change until it is reopened there. */
  locked: boolean
  me: string
  update: (fn: (d: AudienceDoc) => AudienceDoc) => void
  onClose: () => void
}

export function ApplicantDrawer({ applicant: a, locked, me, update, onClose }: Props) {
  const proofRequired = useFeature('proofRequired')
  const [pending, setPending] = useState<Pending>()
  const [overriding, setOverriding] = useState<VerificationStatus>()
  const [reason, setReason] = useState('')
  const [vReason, setVReason] = useState('')
  const [why, setWhy] = useState('')

  const decide = (p: Pending, why: string) => {
    if (!a) return
    update((d) => addEntry(d, { applicantId: a.id, by: me, kind: p.kind, from: p.kind === 'outcome' ? a.outcome : a.verification, to: p.to, reason: why.trim() }))
  }

  const lastManual = a ? [...a.log].reverse().find((e) => e.kind === 'outcome') : undefined

  const closeAll = () => {
    setPending(undefined)
    setOverriding(undefined)
    setReason('')
    setVReason('')
    setWhy('')
    onClose()
  }

  return (
    <SideDrawer
      open={!!a}
      onClose={closeAll}
      title={a?.id ?? ''}
      description={a ? `${a.contact} · ${a.source}` : undefined}
      footer={
        a && (
          <div className="flex w-full flex-col gap-3">
            {pending?.kind === 'outcome' ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const text = pending.to === 'Ineligible' ? (why === 'Other' || !why ? reason.trim() : `${why}${reason.trim() ? `: ${reason.trim()}` : ''}`) : reason.trim()
                  if (!text || (pending.to === 'Ineligible' && !why)) return
                  decide(pending, text)
                  setPending(undefined)
                  setReason('')
                  setWhy('')
                }}
              >
                {pending.to === 'Ineligible' && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Reason for “Mark ineligible” (required)</span>
                    <select value={why} onChange={(e) => setWhy(e.target.value)} className={cn(controlBase, 'h-9 pr-7')} aria-label="Reason">
                      <option value="">Choose a reason</option>
                      {INELIGIBLE_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                )}
                <TextArea
                  label={pending.to === 'Ineligible' ? (why === 'Other' ? 'Explain (required)' : 'Details (optional)') : 'Reason for “Mark eligible” (required)'}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                  hint="Saved with your name and the time. You can change this until the pool is finalized."
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={pending.to === 'Ineligible' ? !why || (why === 'Other' && !reason.trim()) : !reason.trim()}>
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPending(undefined)
                      setReason('')
                      setWhy('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-2">
                {locked && <p className="text-sm text-pending-fg">The pool is finalized, so this can’t change. Reopen the pool in Finalize pool first.</p>}
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const verified = a.checks.consent === true && a.checks.language === true && a.checks.human === true
                    const eligibleWhy = locked ? 'The pool is finalized.' : a.outcome === 'Eligible' ? 'Already eligible.' : !verified ? 'Confirm the three verification checks first: consent to record, language and human.' : undefined
                    const ineligibleWhy = locked ? 'The pool is finalized.' : a.outcome === 'Ineligible' ? 'Already ineligible.' : undefined
                    return (
                      <>
                        {gate(
                          eligibleWhy,
                          <Button size="sm" className="w-full" disabled={!!eligibleWhy} onClick={() => setPending({ kind: 'outcome', to: 'Eligible' })} data-testid="mark-eligible">
                            Mark eligible
                          </Button>,
                          'left',
                        )}
                        {gate(
                          ineligibleWhy,
                          <Button size="sm" className="w-full" disabled={!!ineligibleWhy} onClick={() => setPending({ kind: 'outcome', to: 'Ineligible' })} data-testid="mark-ineligible">
                            Mark ineligible
                          </Button>,
                          'right',
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )
      }
    >
      {a && (
        <div className="flex flex-col gap-6">
          <section aria-label="Outcome" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={a.outcome} />
              {a.outcomeEdited && <span className="text-xs text-graphite">Edited by a person. Auto result: {a.autoOutcome}</span>}
            </div>
            <p className="text-sm">
              {lastManual ? `Set to ${lastManual.to} by ${lastManual.by}: “${lastManual.reason}”` : (a.note ?? a.reason)}
              {lastManual && a.note ? ` ${a.note}` : ''}
            </p>
          </section>

          <section aria-label="Rules">
            <h3 className="mb-2 text-md font-semibold">Why this outcome</h3>
            <div className="flex flex-col gap-3">
              {a.groups.map((g) => (
                <div key={g.title}>
                  <p className="mb-1 text-sm font-medium">{g.title}</p>
                  <ul className="divide-y divide-mist rounded-sm border border-mist">
                    {g.checks.map((c, i) => {
                      const m = resultMark[c.result]
                      return (
                        <li key={i} className="flex gap-2 px-3 py-1.5 text-sm">
                          <span className={cn('w-4 shrink-0 text-center font-semibold', m.cls)} aria-hidden="true">
                            {m.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="sr-only">{m.label}: </span>
                            <span className="font-medium">{c.rule}</span>
                            <span className="text-graphite">: {c.detail}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Screener answers">
            <h3 className="mb-2 text-md font-semibold">Screener answers</h3>
            <dl className="flex flex-col divide-y divide-mist rounded-sm border border-mist">
              {a.answers.map((x, i) => (
                <div key={i} className="px-3 py-2">
                  <dt className="text-sm text-graphite">{x.question}</dt>
                  <dd className="font-medium">{x.answer || <span className="font-normal text-pending-fg">No answer</span>}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="Verification">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="mr-1 text-md font-semibold">Verification</h3>
              <StatusChip status={a.verification} size="sm" />
              {!overriding && (
                <Button size="sm" variant="ghost" onClick={() => setOverriding(a.verification === 'Passed' ? 'Failed' : 'Passed')}>
                  Override
                </Button>
              )}
            </div>
            {a.verificationEdited && <p className="mb-2 text-xs text-graphite">Overridden by a person. Auto result: {a.autoVerification}</p>}
            {overriding && (
              <form
                className="mb-3 flex flex-col gap-2 rounded-sm border border-mist bg-paper p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!vReason.trim()) return
                  decide({ kind: 'verification', to: overriding }, vReason)
                  setOverriding(undefined)
                  setVReason('')
                }}
              >
                <fieldset className="flex gap-4 text-sm">
                  <legend className="mb-1 font-medium">Set verification to</legend>
                  {(['Passed', 'Failed'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="radio" name="vo" checked={overriding === v} onChange={() => setOverriding(v)} className="accent-[var(--color-iris-600)]" />
                      {v}
                    </label>
                  ))}
                </fieldset>
                <TextArea label="Reason (required)" rows={2} value={vReason} onChange={(e) => setVReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="primary" disabled={!vReason.trim() || overriding === a.verification}>
                    Save override
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOverriding(undefined)
                      setVReason('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <VerificationChecks checks={a.checks} />
          </section>

          <section aria-label="Proof of purchase">
            <h3 className="mb-2 text-md font-semibold">Proof of purchase</h3>
            {!proofRequired ? (
              <p className="text-sm text-graphite">No proof required for this study.</p>
            ) : a.proof ? (
              <div className="flex items-center gap-3 rounded-sm border border-mist p-2">
                <div
                  aria-hidden="true"
                  className="flex h-20 w-16 shrink-0 flex-col justify-between rounded-xs border border-mist-strong bg-haze p-1.5 text-[9px] leading-tight text-graphite"
                >
                  <span className="font-semibold">RECEIPT</span>
                  <span>Moisturizer 1.7 oz</span>
                  <span>Total $24.99</span>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{a.proof.file}</p>
                  <p className="text-graphite">Uploaded {a.proof.uploadedAt}. Placeholder image.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-graphite">Not uploaded yet.</p>
            )}
          </section>

          <section aria-label="Activity">
            <h3 className="mb-2 text-md font-semibold">Activity</h3>
            {a.log.length === 0 ? (
              <p className="text-sm text-graphite">No manual changes. The outcome was set automatically from the screener answers.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {[...a.log].reverse().map((e) => (
                  <li key={e.id} className="rounded-sm border border-mist px-3 py-2 text-sm">
                    <p>
                      <span className="font-medium">{e.by}</span> changed {e.kind === 'outcome' ? 'screening' : 'verification'} from {e.from} to <span className="font-medium">{e.to}</span>
                     
                    </p>
                    <p className="text-graphite">“{e.reason}”</p>
                    <p className="text-xs text-graphite tabular-nums">{formatDateTime(e.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </SideDrawer>
  )
}

function VerificationChecks({ checks }: { checks: Applicant['checks'] }) {
  const rows: { key: keyof Applicant['checks']; label: string; short: string }[] = [
    { key: 'consent', label: 'Consent to record', short: 'Consent' },
    { key: 'language', label: 'Language ability (English)', short: 'Language' },
    { key: 'human', label: 'Human, not a bot', short: 'Human' },
  ]
  const reviewed = rows.some((r) => checks[r.key] !== null)
  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-mist rounded-sm border border-mist">
        {rows.map((r) => {
          const v = checks[r.key]
          return (
            <li key={r.key} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="flex-1">{r.label}</span>
              {v === null ? (
                <span className="text-graphite">Not reviewed yet</span>
              ) : v ? (
                <span className="flex items-center gap-1 font-medium text-positive-fg">
                  <CheckIcon size={14} /> Pass
                </span>
              ) : (
                <span className="flex items-center gap-1 font-medium text-negative-fg">
                  <CloseIcon size={14} /> Fail
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {reviewed ? (
        <p className="text-sm tabular-nums">{rows.map((r) => `${r.short} ${checks[r.key] ? '✓' : '✗'}`).join(' · ')}</p>
      ) : (
        <p className="text-sm text-graphite">Not reviewed yet</p>
      )}
    </div>
  )
}
