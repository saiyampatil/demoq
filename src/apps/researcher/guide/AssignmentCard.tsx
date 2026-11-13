import { Banner } from '@/components/Banner'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { Switch } from '@/components/Switch'
import type { StimuliState } from '@/state/guide'
import { assignmentOf, assignmentProblem, buildPlans, groupCount, shownItems, type Assignment } from '@/state/stimulusPlans'

/** How participants are split across the stimuli, and whether the order rotates. Shown with the library; the guide can't be locked on an uneven split. */
export function AssignmentCard({ stimuli, set }: { stimuli: StimuliState; set: (a: Assignment, note: string) => void }) {
  const a = assignmentOf(stimuli)
  const n = shownItems(stimuli).length
  const problem = assignmentProblem(a, n)
  const plans = !problem ? buildPlans(shownItems(stimuli), a) : []
  const by = a.perPerson !== undefined ? 'per' : 'groups'
  const num = (v: string) => (v === '' ? undefined : Number(v))
  const choose = (mode: Assignment['mode']) => set(mode === 'all' ? { mode: 'all', rotate: a.rotate } : { mode: 'split', groups: a.groups ?? 2, rotate: a.rotate }, mode === 'all' ? 'Everyone sees all stimuli' : 'Split stimuli into groups')
  return (
    <Card title="Who sees which" description="Spread the stimuli evenly so each one gets the same number of people, and the same number of first looks.">
      <div className="flex flex-col gap-4" data-testid="assignment-card">
        <div role="radiogroup" aria-label="Who sees which stimuli" className="flex flex-wrap gap-2">
          {(['all', 'split'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={a.mode === m}
              data-testid={`assign-${m}`}
              onClick={() => choose(m)}
              className={cn('rounded-sm border px-3 py-1.5 text-sm', a.mode === m ? 'border-ink bg-ink text-white' : 'border-mist-strong bg-surface hover:bg-haze')}
            >
              {m === 'all' ? 'Everyone sees all' : 'Split into groups'}
            </button>
          ))}
        </div>

        {a.mode === 'split' && (
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-graphite">Set by</span>
              <select
                data-testid="assign-by"
                value={by}
                onChange={(e) => set(e.target.value === 'per' ? { mode: 'split', perPerson: 1, rotate: a.rotate } : { mode: 'split', groups: 2, rotate: a.rotate }, 'Changed how stimuli are split')}
                className="h-9 rounded-sm border border-mist-strong bg-surface px-2"
              >
                <option value="groups">Number of groups</option>
                <option value="per">How many each person sees</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-graphite">{by === 'per' ? 'Each person sees' : 'Groups'}</span>
              <input
                data-testid="assign-number"
                type="number"
                min={1}
                value={(by === 'per' ? a.perPerson : a.groups) ?? ''}
                onChange={(e) => set(by === 'per' ? { mode: 'split', perPerson: num(e.target.value), rotate: a.rotate } : { mode: 'split', groups: num(e.target.value), rotate: a.rotate }, 'Changed how stimuli are split')}
                className="h-9 w-24 rounded-sm border border-mist-strong bg-surface px-2 tabular-nums"
              />
            </label>
            {!problem && (
              <p className="pb-2 text-graphite" data-testid="assign-summary">
                {groupCount(a, n)} {groupCount(a, n) === 1 ? 'group' : 'groups'} of {n / groupCount(a, n)}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch checked={a.rotate} label="Rotate order" onChange={(on) => set({ ...a, rotate: on }, on ? 'Rotate the order of stimuli' : 'Stopped rotating the order of stimuli')} />
          <span className="text-sm">Rotate order <span className="text-graphite">so each stimulus comes first equally often</span></span>
        </div>

        {problem ? (
          <div data-testid="assign-error">
            <Banner tone="danger" title="This split isn’t even">
              {problem} The guide can’t be locked until this is fixed.
            </Banner>
          </div>
        ) : plans.length > 1 ? (
          <p className="text-sm text-graphite" data-testid="assign-plans">
            {plans.length} plans. Each new participant gets the least-used one for their group.
          </p>
        ) : null}
      </div>
    </Card>
  )
}
