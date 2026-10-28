import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { formatDateTime } from '@/lib/format'
import type { BriefDoc, BriefEvent } from '@/state/brief'

function describe(e: BriefEvent) {
  switch (e.type) {
    case 'saved':
      return { title: `Version ${e.version} saved by ${e.by}`, detail: e.note, tone: 'neutral' as const }
    case 'shared':
      return { title: `Version ${e.version} downloaded to send to the client`, detail: `By ${e.by}`, tone: 'neutral' as const }
    case 'changes-requested':
      return { title: `${e.client} requested changes to version ${e.version}`, detail: `“${e.feedback}” Recorded by ${e.by}.`, tone: 'pending' as const }
    case 'approved':
      return {
        title: e.method === 'Client' ? `Version ${e.version} approved by client (${e.client})` : `Version ${e.version} approved directly (solo)`,
        detail:
          e.via === 'email'
            ? 'Approved from the emailed review link. Approval method: Client.'
            : `Recorded by ${e.by}. Approval method: ${e.method === 'Client' ? 'Client' : 'Solo'}.`,
        tone: 'positive' as const,
      }
    case 'emailed':
      return { title: `Version ${e.version} emailed for approval`, detail: `To ${e.recipients.join(', ')}. Sent by ${e.by}.`, tone: 'neutral' as const }
    case 'resent':
      return { title: `Review link resent to ${e.email}`, detail: `By ${e.by}`, tone: 'neutral' as const }
    case 'client-viewed':
      return { title: `${e.email} opened version ${e.version}`, detail: 'Viewed the review link.', tone: 'neutral' as const }
    case 'client-commented':
      return { title: `${e.email} commented on version ${e.version}`, detail: `“${e.text}”`, tone: 'pending' as const }
    case 'client-declined':
      return { title: `${e.email} declined version ${e.version}`, detail: `“${e.reason}”`, tone: 'negative' as const }
    case 'request-closed':
      return {
        title: e.reason === 'cancelled' ? `Approval request for version ${e.version} cancelled` : `Approval request for version ${e.version} superseded`,
        detail: e.reason === 'cancelled' ? `Closed by ${e.by}.` : 'A newer version was saved, so the old review link no longer applies.',
        tone: 'neutral' as const,
      }
  }
}

const dotClass = { neutral: 'bg-mist-strong', pending: 'bg-pending-fg', positive: 'bg-positive-fg', negative: 'bg-negative-fg' }

export function ApprovalTimeline({ doc }: { doc: BriefDoc }) {
  return (
    <Card title="Approval record" description="Every version and decision, newest first.">
      <ol className="flex flex-col">
        {[...doc.events].reverse().map((e, i, all) => {
          const d = describe(e)
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < all.length - 1 && <span className="absolute top-3 bottom-0 left-[3px] w-px bg-mist" aria-hidden="true" />}
              <span className={cn('relative mt-1.5 size-[7px] shrink-0 rounded-full', dotClass[d.tone])} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-sm text-graphite">{d.detail}</p>
                <p className="text-xs text-muted tabular-nums">{formatDateTime(e.at)}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
