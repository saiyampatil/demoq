import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { AlertIcon, ArrowUpIcon, ChevronRightIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { Switch } from '@/components/Switch'
import { OriginTag } from '../audience/OriginTag'
import { questionNumber, type Flag, type Guide, type Question, type Stimulus, type Survey } from '@/state/guide'

const field = cn(controlBase, 'h-8 px-2 text-sm')

type Props = {
  q: Question
  guide: Guide
  stimuli: Stimulus[]
  surveys: Survey[]
  /** Surveys only exist for AI moderators. */
  aiMode: boolean
  flag?: Flag
  onChange: (fn: (q: Question) => Question) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onClearStimulus: () => void
  libraryTo: string
}

export function QuestionCard({ q, guide, stimuli, surveys, aiMode, flag, onChange, onMove, onRemove, onClearStimulus, libraryTo }: Props) {
  // Advanced stays closed on every question until someone opens it.
  const [advanced, setAdvanced] = useState(false)
  const n = questionNumber(guide, q.id)
  const set = (patch: Partial<Question>) => onChange((x) => ({ ...x, ...patch }))
  const others = guide.sections.flatMap((s) => s.questions).filter((x) => x.id !== q.id)
  const active = stimuli.filter((s) => s.active)
  const attached = stimuli.find((s) => s.id === q.stimulusId)
  const advancedCount = q.banned.length + (q.maxFollowUps !== null ? 1 : 0) + (q.branch ? 1 : 0)

  return (
    <li id={`q-${q.id}`} className={cn('rounded-md bg-surface p-4', flag ? 'border border-pending-line ring-1 ring-pending-line' : q.origin === 'ai' ? 'ai-surface' : 'border border-mist')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-semibold text-white tabular-nums">Q{n}</span>
        {q.origin === 'ai' ? <AIGeneratedTag /> : <OriginTag origin={q.origin} />}
        <span className="flex-1" />
        <span className="flex items-center gap-2 text-sm">
          <span className={cn('w-16 text-right', q.mandatory ? 'font-medium text-ink' : 'text-graphite')}>{q.mandatory ? 'Mandatory' : 'Optional'}</span>
          <Switch checked={q.mandatory} onChange={(on) => onChange((x) => ({ ...x, mandatory: on, origin: x.origin === 'ai' ? 'edited' : x.origin }))} label={`Question ${n} is mandatory`} />
        </span>
        <Button size="sm" variant="ghost" onClick={() => onMove(-1)} aria-label={`Move question ${n} up`}>
          <ArrowUpIcon size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onMove(1)} aria-label={`Move question ${n} down`}>
          <ArrowUpIcon size={14} className="rotate-180" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove question ${n}`}>
          Remove
        </Button>
      </div>

      {flag && (
        <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg">
          <AlertIcon size={14} />
          <span className="min-w-0 flex-1">
            {flag.reason === 'inactive' ? `“${flag.stimulusName}” was switched off in the library, so the moderator can’t use it.` : 'The stimulus attached here is no longer in the library.'}
          </span>
          <Button size="sm" onClick={onClearStimulus}>
            Remove stimulus
          </Button>
          <Button size="sm" to={libraryTo}>
            Open library
          </Button>
        </p>
      )}

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs text-graphite">Question</span>
        <textarea
          rows={2}
          value={q.text}
          placeholder="Write the question"
          onChange={(e) => onChange((x) => ({ ...x, text: e.target.value, origin: x.origin === 'ai' ? 'edited' : x.origin }))}
          className={cn(controlBase, 'w-full resize-y bg-surface py-2 leading-[21px]')}
        />
      </label>

      <div className="mt-3">
        <p className="mb-1 text-xs text-graphite">Permitted probes</p>
        <ul className="flex flex-col gap-1.5">
          {q.probes.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                aria-label={`Probe ${i + 1} for question ${n}`}
                value={p}
                onChange={(e) => onChange((x) => ({ ...x, probes: x.probes.map((y, j) => (j === i ? e.target.value : y)), origin: x.origin === 'ai' ? 'edited' : x.origin }))}
                className={cn(field, 'w-full bg-surface')}
              />
              <button type="button" aria-label={`Remove probe ${i + 1} from question ${n}`} onClick={() => onChange((x) => ({ ...x, probes: x.probes.filter((_, j) => j !== i) }))} className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" icon={<PlusIcon />} className="mt-1" onClick={() => onChange((x) => ({ ...x, probes: [...x.probes, ''] }))}>
          Add probe
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-graphite">Show a stimulus</span>
          <select
            aria-label={`Stimulus for question ${n}`}
            value={q.stimulusId ?? ''}
            onChange={(e) => onChange((x) => ({ ...x, stimulusId: e.target.value || undefined, origin: x.origin === 'ai' ? 'edited' : x.origin }))}
            className={cn(field, 'w-56 pr-6')}
          >
            <option value="">None</option>
            {attached && !attached.active && <option value={attached.id}>{attached.name} (not active)</option>}
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {aiMode && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-graphite">Run a survey</span>
            <select
              aria-label={`Survey for question ${n}`}
              value={q.surveyId ?? ''}
              onChange={(e) => onChange((x) => ({ ...x, surveyId: e.target.value || undefined, origin: x.origin === 'ai' ? 'edited' : x.origin }))}
              className={cn(field, 'w-56 pr-6')}
            >
              <option value="">None</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.text.length > 36 ? `${s.text.slice(0, 36)}…` : s.text}
                </option>
              ))}
            </select>
          </label>
        )}
        <div>
          <p className="mb-1 text-xs text-graphite">Covers objectives</p>
          <div className="flex flex-wrap gap-1.5">
            {guide.objectives.map((o, i) => {
              const on = q.covers.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  title={o.text}
                  aria-label={`Objective ${i + 1}: ${o.text}`}
                  onClick={() => onChange((x) => ({ ...x, covers: on ? x.covers.filter((c) => c !== o.id) : [...x.covers, o.id], origin: x.origin === 'ai' ? 'edited' : x.origin }))}
                  className={cn('h-7 min-w-8 rounded-xs border px-2 text-xs font-medium tabular-nums', on ? 'border-ink bg-ink text-white' : 'border-mist-strong bg-surface text-graphite hover:border-graphite')}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-mist pt-2">
        <button
          type="button"
          aria-expanded={advanced}
          aria-controls={`adv-${q.id}`}
          onClick={() => setAdvanced((x) => !x)}
          className="flex items-center gap-1.5 rounded-xs py-1 text-sm font-medium text-graphite hover:text-ink"
        >
          <ChevronRightIcon size={14} className={cn('transition-transform', advanced && 'rotate-90')} />
          Advanced
          {advancedCount > 0 && <span className="text-xs font-normal">({advancedCount} set)</span>}
        </button>
        {advanced && (
          <div id={`adv-${q.id}`} className="mt-2 flex flex-col gap-4 pl-5">
            <div>
              <p className="mb-1 text-xs text-graphite">Banned phrasing: the moderator must never say</p>
              <ul className="flex flex-col gap-1.5">
                {q.banned.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      aria-label={`Banned phrase ${i + 1} for question ${n}`}
                      value={p}
                      onChange={(e) => onChange((x) => ({ ...x, banned: x.banned.map((y, j) => (j === i ? e.target.value : y)), origin: x.origin === 'ai' ? 'edited' : x.origin }))}
                      className={cn(field, 'w-full bg-surface')}
                    />
                    <button type="button" aria-label={`Remove banned phrase ${i + 1} from question ${n}`} onClick={() => onChange((x) => ({ ...x, banned: x.banned.filter((_, j) => j !== i) }))} className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
                      <CloseIcon size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" icon={<PlusIcon />} className="mt-1" onClick={() => onChange((x) => ({ ...x, banned: [...x.banned, ''] }))}>
                Add banned phrase
              </Button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-graphite">Maximum follow-ups</span>
              <input
                type="number"
                min={0}
                aria-label={`Maximum follow-ups for question ${n}`}
                value={q.maxFollowUps ?? ''}
                placeholder="No limit"
                onChange={(e) => onChange((x) => ({ ...x, maxFollowUps: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))), origin: x.origin === 'ai' ? 'edited' : x.origin }))}
                className={cn(field, 'w-28 tabular-nums')}
              />
            </label>

            <div>
              <p className="mb-1 text-xs text-graphite">Branching rule</p>
              {q.branch ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>If the answer to</span>
                  <select aria-label={`Branch source for question ${n}`} value={q.branch.ifQuestionId} onChange={(e) => set({ branch: { ...q.branch!, ifQuestionId: e.target.value }, origin: q.origin === 'ai' ? 'edited' : q.origin })} className={cn(field, 'w-24 pr-6')}>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        Q{questionNumber(guide, o.id)}
                      </option>
                    ))}
                  </select>
                  <span>is</span>
                  <input aria-label={`Branch answer for question ${n}`} value={q.branch.answer} placeholder="e.g. None of them appeal" onChange={(e) => set({ branch: { ...q.branch!, answer: e.target.value }, origin: q.origin === 'ai' ? 'edited' : q.origin })} className={cn(field, 'w-48 bg-surface')} />
                  <select aria-label={`Branch action for question ${n}`} value={q.branch.action} onChange={(e) => set({ branch: { ...q.branch!, action: e.target.value as 'skip-to' | 'branch-to' }, origin: q.origin === 'ai' ? 'edited' : q.origin })} className={cn(field, 'w-28 pr-6')}>
                    <option value="skip-to">skip to</option>
                    <option value="branch-to">branch to</option>
                  </select>
                  <select aria-label={`Branch target for question ${n}`} value={q.branch.targetId} onChange={(e) => set({ branch: { ...q.branch!, targetId: e.target.value }, origin: q.origin === 'ai' ? 'edited' : q.origin })} className={cn(field, 'w-24 pr-6')}>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        Q{questionNumber(guide, o.id)}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => set({ branch: undefined })}>
                    Remove rule
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<PlusIcon />}
                  disabled={others.length < 2}
                  onClick={() => set({ branch: { ifQuestionId: others[0].id, answer: '', action: 'skip-to', targetId: others[others.length - 1].id }, origin: q.origin === 'ai' ? 'edited' : q.origin })}
                >
                  Add branching rule
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
