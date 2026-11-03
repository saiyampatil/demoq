import { useEffect, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { Tooltip } from '@/components/Tooltip'
import { formatDateTime } from '@/lib/format'
import type { AudienceDoc } from '@/state/audience'
import { decimalsOf, PAID_WHEN, REWARD_TYPES, rewardComplete, rewardLine, rewardLocks, rewardOf, rewardProblems, saveReward, studyCountry, type PaidWhen, type Reward, type RewardType } from '@/state/reward'
import { CurrencyPicker } from './CurrencyPicker'

/**
 * R8, "Participant reward". Typed into a draft and saved with a button, so every saved change is one log line with who and
 * when. Before any invitation is sent it is fully editable. After, the amount can only go up and the rest is locked.
 */
export function RewardCard({ audience, hint, me, update }: { audience: AudienceDoc; hint: number | null; me: string; update: (fn: (d: AudienceDoc) => AudienceDoc) => void }) {
  const saved = rewardOf(audience, hint)
  const locks = rewardLocks(audience)
  const country = studyCountry(audience)
  const [draft, setDraft] = useState<Reward>(saved)
  const [showLog, setShowLog] = useState(false)
  const [done, setDone] = useState(false)

  // A saved change from elsewhere (or a reset) replaces the draft.
  useEffect(() => setDraft(rewardOf(audience, hint)), [audience.reward, hint]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Reward>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDone(false)
  }
  const dirty = JSON.stringify({ ...draft, log: 0 }) !== JSON.stringify({ ...saved, log: 0 })
  const problems = rewardProblems(draft, saved, audience)
  const complete = rewardComplete(saved)
  const line = draft.offered ? rewardLine(draft, country) : null
  const decimals = decimalsOf(draft.currency)
  const step = decimals === 0 ? 1 : 1 / 10 ** decimals

  return (
    <Card
      title="Participant reward"
      description="Set before the first invitation goes out. It is used everywhere participants read about the reward."
      actions={complete ? <span className="flex items-center gap-1 text-sm text-positive-fg"><CheckIcon size={14} /> Saved</span> : <span className="text-sm text-pending-fg">Required before invitations</span>}
    >
      <div className="flex flex-col gap-4" data-testid="reward-card">
        {locks.sent && (
          <Banner tone="info" title="Invitations have been sent">
            The amount can go up, never down. Currency and reward type are locked. Each change is logged with who and when.
          </Banner>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Reward offered</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { on: true, title: 'Offer a reward', text: 'Participants are paid for taking part.' },
              { on: false, title: 'No reward', text: 'For internal or volunteer studies. Participant copy leaves the reward line out.' },
            ].map((o) => {
              const sel = draft.offered === o.on
              const blocked = !o.on && locks.sent && saved.offered && !!saved.savedAt
              return (
                <label key={o.title} className={cn('flex gap-3 rounded-md border bg-surface p-3', sel ? 'border-ink ring-1 ring-ink' : 'border-mist hover:border-graphite', blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                  <input type="radio" name="reward-offered" checked={sel} disabled={blocked} onChange={() => set({ offered: o.on })} className="mt-1 accent-[var(--color-iris-600)]" />
                  <span>
                    <span className="block font-semibold">{o.title}</span>
                    <span className="block text-sm text-graphite">{blocked ? locks.offered : o.text}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {!draft.offered ? (
          <TextArea label="Why is there no reward? (required)" rows={2} value={draft.noRewardReason} onChange={(e) => set({ noRewardReason: e.target.value })} hint="For example: an internal study with employees who take part in work time." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Amount</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={saved.savedAt && locks.sent && saved.offered && saved.amount ? saved.amount : 1}
                  step={step}
                  value={draft.amount ?? ''}
                  onChange={(e) => set({ amount: e.target.value === '' ? null : Number(e.target.value) })}
                  className={cn(controlBase, 'h-9 tabular-nums')}
                  aria-label="Amount"
                />
                <span className="text-xs text-graphite">{locks.sent && saved.savedAt ? locks.amount : `At least 1. ${decimals === 0 ? 'Whole amounts' : `${decimals} decimals`} for ${draft.currency}.`}</span>
              </label>
              <div>
                {locks.currency && saved.savedAt ? (
                  <Tooltip content={locks.currency} focusable align="left">
                    <div className="w-full">
                      <CurrencyPicker label="Currency" value={draft.currency} onChange={() => undefined} disabled />
                    </div>
                  </Tooltip>
                ) : (
                  <CurrencyPicker label="Currency" value={draft.currency} onChange={(currency) => set({ currency, amount: draft.amount })} />
                )}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Reward type</span>
                <select value={draft.type} disabled={!!locks.type && !!saved.savedAt} onChange={(e) => set({ type: e.target.value as RewardType })} className={cn(controlBase, 'h-9 pr-7')} title={saved.savedAt ? locks.type : undefined}>
                  {REWARD_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                {locks.type && saved.savedAt && <span className="text-xs text-graphite">{locks.type}</span>}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Paid when</span>
                <select value={draft.paidWhen} onChange={(e) => set({ paidWhen: e.target.value as PaidWhen })} className={cn(controlBase, 'h-9 pr-7')}>
                  {PAID_WHEN.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Promised length (minutes)</span>
                <input type="number" min={1} value={draft.promisedMin ?? ''} onChange={(e) => set({ promisedMin: e.target.value === '' ? null : Math.floor(Number(e.target.value)) })} className={cn(controlBase, 'h-9 w-28 tabular-nums')} aria-label="Promised length in minutes" />
                <span className="text-xs text-graphite">Starts from the brief’s target length.</span>
              </label>
            </div>

            <div className="rounded-sm border border-mist bg-paper p-3" aria-live="polite">
              <p className="text-xs font-medium text-graphite">What participants read</p>
              <p className="mt-1" data-testid="reward-preview">
                {line ?? <span className="text-graphite">Enter an amount to see the sentence.</span>}
              </p>
            </div>
          </>
        )}

        {problems.length > 0 && dirty && (
          <ul className="text-sm text-negative-fg" role="alert">
            {problems.map((p) => (
              <li key={p}>{p}.</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!dirty || problems.length > 0} onClick={() => { update((d) => saveReward(d, draft, me, hint)); setDone(true) }} data-testid="save-reward">
            Save reward
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => { setDraft(saved); setDone(false) }}>
              Discard changes
            </Button>
          )}
          {done && !dirty && (
            <span role="status" className="flex items-center gap-1 text-sm text-positive-fg">
              <CheckIcon size={14} /> Reward saved and logged.
            </span>
          )}
          {saved.log.length > 0 && (
            <button type="button" onClick={() => setShowLog((x) => !x)} className="ml-auto text-sm font-medium text-iris-700 hover:underline" aria-expanded={showLog}>
              {showLog ? 'Hide history' : `History (${saved.log.length})`}
            </button>
          )}
        </div>

        {showLog && (
          <ol className="flex flex-col divide-y divide-mist rounded-sm border border-mist text-sm" data-testid="reward-log">
            {[...saved.log].reverse().map((e) => (
              <li key={e.id} className="px-3 py-2">
                <p>{e.text}</p>
                <p className="text-xs text-graphite tabular-nums">
                  {e.by}, {formatDateTime(e.at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}
