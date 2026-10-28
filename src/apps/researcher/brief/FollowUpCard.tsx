import { useState } from 'react'
import { AIContent } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { formatDateTime } from '@/lib/format'
import { sectionTitle, type FollowUp, type FollowUpStatus } from '@/state/brief'

type FollowUpCardProps = {
  followUp: FollowUp
  onResolve: (status: Exclude<FollowUpStatus, 'open'>, answer?: string) => void
  /** In the editor a skipped item can still be answered. In the chat it's final. */
  reopenSkipped?: boolean
}

export function FollowUpCard({ followUp: f, onResolve, reopenSkipped }: FollowUpCardProps) {
  const [answer, setAnswer] = useState('')
  const actionable = f.status === 'open' || (reopenSkipped && f.status === 'skipped')
  const isConflict = f.kind === 'conflict'

  return (
    <div className={cn('rounded-md border bg-surface p-4', actionable ? 'border-pending-line' : 'border-mist')}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-xs border border-pending-line bg-pending-bg px-1.5 py-0.5 font-medium text-pending-fg">
          {isConflict ? 'Conflicting details' : 'Missing information'}
        </span>
        <span className="text-graphite">{sectionTitle(f.section)}</span>
      </div>
      <p className="mt-2 font-medium">{f.question}</p>
      <p className="mt-0.5 text-sm text-graphite">{f.detail}</p>

      {f.status === 'skipped' && (
        <p className="mt-2 text-sm text-pending-fg">Skipped for now. It stays flagged in the brief until it’s answered.</p>
      )}

      {actionable ? (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (answer.trim()) onResolve('answered', answer)
          }}
        >
          {isConflict && f.assumption && (
            <AIContent label="Suggested assumption" className="p-3">
              <p className="text-sm">{f.assumption}</p>
            </AIContent>
          )}
          <TextArea
            label="Your answer"
            rows={2}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={isConflict ? 'e.g. 12 completed interviews' : 'e.g. Decide which concept to take into the January range review'}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={!answer.trim()}>
              Answer
            </Button>
            {isConflict && f.assumption && (
              <Button size="sm" onClick={() => onResolve('assumed')}>
                Accept assumption
              </Button>
            )}
            {f.status === 'open' && (
              <Button size="sm" variant="ghost" onClick={() => onResolve('skipped')}>
                Skip for now
              </Button>
            )}
          </div>
        </form>
      ) : (
        f.status !== 'skipped' && (
          <p className="mt-2 text-sm text-ink">
            {f.status === 'answered' ? (
              <>
                Answered by {f.resolvedBy}: “{f.answer}”
              </>
            ) : (
              <>Assumption accepted by {f.resolvedBy}: {f.assumedText}</>
            )}
            {f.resolvedAt && <span className="text-graphite"> {formatDateTime(f.resolvedAt)}</span>}
          </p>
        )
      )}
    </div>
  )
}
