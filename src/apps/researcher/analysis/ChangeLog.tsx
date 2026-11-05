import { useMemo, useState } from 'react'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { formatStamp } from '@/lib/format'
import { AI_CODER } from '@/state/codebook'
import type { CodebookCtx } from './codebookCtx'

type Kind = 'all' | 'code' | 'theme' | 'tension'

/** Founder brief step 5: a short log of who changed what, and why. Entries are never edited or removed. */
export function ChangeLog({ ctx }: { ctx: CodebookCtx }) {
  const [kind, setKind] = useState<Kind>('all')
  const [who, setWho] = useState('all')
  const [query, setQuery] = useState('')
  const people = useMemo(() => [...new Set(ctx.doc.log.map((l) => l.by))].sort(), [ctx.doc.log])
  const rows = ctx.doc.log.filter((l) => {
    const q = query.trim().toLowerCase()
    return (
      (kind === 'all' || l.target.kind === kind) &&
      (who === 'all' || l.by === who) &&
      (!q || [l.target.name, l.action, l.detail ?? '', l.why ?? ''].some((s) => s.toLowerCase().includes(q)))
    )
  })

  return (
    <section aria-label="Change log" className="rounded-md border border-mist bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-mist px-4 py-3">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search the log</span>
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted">
            <SearchIcon size={14} />
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by code, theme or reason" className={cn(controlBase, 'h-8 w-full pl-8 text-sm')} />
        </label>
        <label>
          <span className="sr-only">Show</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
            <option value="all">Everything</option>
            <option value="code">Codes only</option>
            <option value="theme">Themes only</option>
            <option value="tension">Tensions only</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Who</span>
          <select value={who} onChange={(e) => setWho(e.target.value)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
            <option value="all">Everyone</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-graphite tabular-nums" aria-live="polite">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing matches" description="Try another filter or clear the search." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-testid="change-log">
            <caption className="sr-only">Every change to codes and themes, newest first</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                {['When', 'Who', 'Code or theme', 'Change', 'Why'].map((h) => (
                  <th key={h} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-mist align-top last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-graphite tabular-nums">{formatStamp(l.at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{l.by === AI_CODER ? <span className="text-iris-700">{l.by}</span> : l.by}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{l.target.name}</span>
                    <span className="block text-xs text-graphite">{l.target.kind === 'theme' ? 'Theme' : l.target.kind === 'code' ? 'Code' : l.target.kind === 'tension' ? 'Tension' : 'Whole codebook'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {l.action}
                    {l.detail && <span className="block text-xs text-graphite">{l.detail}</span>}
                  </td>
                  <td className="max-w-72 px-4 py-2.5 text-graphite">{l.why ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
