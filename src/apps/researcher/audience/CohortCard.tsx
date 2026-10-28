import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { AlertIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { FILTER_FIELDS, filterMeta, newFilter, touch, type Cohort, type Filter } from '@/state/audience'
import { OriginTag } from './OriginTag'

// Filter rows sit on one line, so their controls size themselves.
const inline = cn(controlBase, 'h-8 px-2 text-sm')

type CohortCardProps = {
  cohort: Cohort
  index: number
  canRemove: boolean
  onChange: (fn: (c: Cohort) => Cohort) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function CohortCard({ cohort: c, index, canRemove, onChange, onDuplicate, onRemove }: CohortCardProps) {
  const setFilter = (id: string, fn: (f: Filter) => Filter) => onChange((x) => ({ ...x, filters: x.filters.map((f) => (f.id === id ? touch(fn(f)) : f)) }))

  return (
    <section aria-label={`Cohort ${index + 1}`} className="flex flex-col gap-4 rounded-md border border-mist bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-md font-semibold">
          <span className="shrink-0">Cohort {index + 1}:</span>
          <input
            aria-label={`Cohort ${index + 1} name`}
            value={c.name}
            onChange={(e) => onChange((x) => ({ ...x, name: e.target.value }))}
            className="min-w-0 flex-1 rounded-xs border border-transparent px-1 py-0.5 hover:border-mist-strong focus:border-iris-600"
          />
        </label>
        <Button size="sm" variant="ghost" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} disabled={!canRemove} title={canRemove ? undefined : 'An audience needs at least one cohort'}>
          Remove
        </Button>
      </header>

      {c.missing.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {c.missing.map((m) => (
            <li key={m} className="flex items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg">
              <AlertIcon size={14} />
              {m}: missing, not in brief. Add a filter for it.
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        {c.filters.length === 0 && <p className="text-sm text-graphite">No filters yet. Add one to say who qualifies.</p>}
        {c.filters.map((f, i) => (
          <div key={f.id}>
            {i > 0 && <p className="mb-1 pl-1 text-xs font-medium text-graphite">AND</p>}
            <FilterRow
              filter={f}
              usedFields={c.filters.filter((x) => x.id !== f.id).map((x) => x.field)}
              onChange={(fn) => setFilter(f.id, fn)}
              onRemove={() => onChange((x) => ({ ...x, filters: x.filters.filter((y) => y.id !== f.id) }))}
            />
          </div>
        ))}
        <Button size="sm" icon={<PlusIcon />} className="self-start" onClick={() => onChange((x) => ({ ...x, filters: [...x.filters, newFilter(x)] }))}>
          Add filter
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-mist pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Participants in this cohort</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={c.participants ?? ''}
            placeholder="Not set"
            onChange={(e) => {
              const n = e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value)))
              onChange((x) => ({ ...x, participants: n, participantsOrigin: n === null ? 'missing' : 'added' }))
            }}
            className={cn(controlBase, 'h-8 w-32 text-sm tabular-nums', c.participants === null && 'border-pending-line')}
          />
        </label>
        <OriginTag origin={c.participantsOrigin} className="mb-1" />
      </div>
    </section>
  )
}

function FilterRow({
  filter: f,
  usedFields,
  onChange,
  onRemove,
}: {
  filter: Filter
  usedFields: string[]
  onChange: (fn: (f: Filter) => Filter) => void
  onRemove: () => void
}) {
  const meta = filterMeta[f.field]
  const label = meta.label
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-sm px-2 py-1.5', f.origin === 'ai' ? 'ai-surface rounded-sm' : 'border border-mist')}>
      <OriginTag origin={f.origin} />
      <select
        aria-label="Filter"
        value={f.field}
        onChange={(e) => onChange((x) => ({ id: x.id, field: e.target.value as Filter['field'], value: '', origin: x.origin }))}
        className={cn(inline, 'w-36 pr-6')}
      >
        {FILTER_FIELDS.map((field) => (
          <option key={field} value={field} disabled={usedFields.includes(field)}>
            {filterMeta[field].label}
          </option>
        ))}
      </select>
      {meta.input === 'range' ? (
        <span className="flex items-center gap-2">
          <input
            aria-label={`${label} minimum`}
            type="number"
            placeholder="Min"
            value={f.min ?? ''}
            onChange={(e) => onChange((x) => ({ ...x, min: e.target.value }))}
            className={cn(inline, 'w-16 tabular-nums')}
          />
          <span className="text-sm text-graphite">to</span>
          <input
            aria-label={`${label} maximum`}
            type="number"
            placeholder="Max"
            value={f.max ?? ''}
            onChange={(e) => onChange((x) => ({ ...x, max: e.target.value }))}
            className={cn(inline, 'w-16 tabular-nums')}
          />
        </span>
      ) : meta.input === 'select' ? (
        <select aria-label={label} value={f.value} onChange={(e) => onChange((x) => ({ ...x, value: e.target.value }))} className={cn(inline, 'min-w-28 flex-1 pr-6')}>
          <option value="">Choose…</option>
          {meta.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={label}
          value={f.value}
          placeholder={meta.placeholder}
          onChange={(e) => onChange((x) => ({ ...x, value: e.target.value }))}
          className={cn(inline, 'min-w-28 flex-1')}
        />
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label} filter`} className="ml-auto rounded-sm p-1 text-graphite hover:bg-haze hover:text-ink">
        <CloseIcon size={14} />
      </button>
    </div>
  )
}
