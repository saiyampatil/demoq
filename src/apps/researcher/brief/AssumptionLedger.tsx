import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { formatDateTime } from '@/lib/format'
import { SECTION_KEYS, sectionTitle, type BriefDoc, type SectionKey } from '@/state/brief'

type Entry = { id: string; section: SectionKey; kind: 'Skipped' | 'Assumption accepted' | 'Answered' | 'AI suggestion accepted'; detail: string; who?: string; at?: string }

export function ledgerEntries(doc: BriefDoc): Entry[] {
  const fromFollowUps: Entry[] = doc.followUps
    .filter((f) => f.status !== 'open')
    .map((f) => ({
      id: f.id,
      section: f.section,
      kind: f.status === 'skipped' ? 'Skipped' : f.status === 'assumed' ? 'Assumption accepted' : 'Answered',
      detail: f.status === 'skipped' ? f.question : f.status === 'assumed' ? (f.assumption ?? '') : `“${f.answer}”`,
      who: f.resolvedBy,
      at: f.resolvedAt,
    }))
  const fromAi: Entry[] = doc.draft
    ? SECTION_KEYS.filter((k) => doc.draft![k].source === 'AI-generated' && doc.draft![k].aiAccepted).map((k) => ({
        id: `ai-${k}`,
        section: k,
        kind: 'AI suggestion accepted' as const,
        detail: doc.draft![k].aiLabel ?? 'AI-generated content',
        who: doc.draft![k].lastEdited.by,
        at: doc.draft![k].lastEdited.at,
      }))
    : []
  return [...fromFollowUps, ...fromAi]
}

const kindClass: Record<Entry['kind'], string> = {
  Skipped: 'text-pending-fg',
  'Assumption accepted': 'text-ink',
  Answered: 'text-graphite',
  'AI suggestion accepted': 'text-graphite',
}

/** Recommended addition (flag: assumptionLedger). */
export function AssumptionLedger({ doc, compact }: { doc: BriefDoc; compact?: boolean }) {
  const entries = ledgerEntries(doc)
  return (
    <Card
      title="Assumption ledger"
      description={compact ? undefined : 'Everything decided without a direct answer from the client, and anything still skipped.'}
      flush
    >
      {entries.length === 0 ? (
        <p className="px-5 py-4 text-sm text-graphite">Nothing to log. No skipped questions, assumptions or accepted AI suggestions.</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id} className="border-b border-mist px-5 py-3 last:border-b-0">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className={cn('font-medium', kindClass[e.kind])}>{e.kind}</span>
                <span className="text-graphite">{sectionTitle(e.section)}</span>
              </div>
              <p className="mt-0.5 text-sm">{e.detail}</p>
              {e.who && e.at && (
                <p className="mt-0.5 text-xs text-graphite">
                  {e.who}, <span className="tabular-nums">{formatDateTime(e.at)}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
