import { useEffect, useRef } from 'react'
import { Button } from '@/components/Button'
import { FileIcon, PlayIcon } from '@/components/icons'
import { SideDrawer } from '@/components/SideDrawer'
import { formatDateTime } from '@/lib/format'
import type { OriginalInput } from '@/state/brief'

type OriginalInputDrawerProps = {
  open: boolean
  onClose: () => void
  original: OriginalInput
  previousResearch: boolean
  /** Exact text to highlight, from a sentence clicked in the editor. */
  highlight?: string
}

export function OriginalInputDrawer({ open, onClose, original, previousResearch, highlight }: OriginalInputDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Original input"
      description="Read-only. Kept exactly as received, beside every version of the brief."
    >
      <OriginalInputBody original={original} previousResearch={previousResearch} highlight={highlight} />
    </SideDrawer>
  )
}

export function OriginalInputBody({ original, previousResearch, highlight }: Omit<OriginalInputDrawerProps, 'open' | 'onClose'>) {
  const markRef = useRef<HTMLElement>(null)
  const index = highlight ? original.text.indexOf(highlight) : -1

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlight])

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-graphite">Type</dt>
        <dd>{original.label}</dd>
        {original.from && (
          <>
            <dt className="text-graphite">From</dt>
            <dd>{original.from}</dd>
          </>
        )}
        <dt className="text-graphite">Received</dt>
        <dd className="tabular-nums">{formatDateTime(original.receivedAt)}</dd>
        <dt className="text-graphite">Previous research</dt>
        <dd>{previousResearch ? 'Mentioned in this input' : 'None found'}</dd>
      </dl>

      {original.fileName && (
        <div className="flex items-center gap-3 rounded-md border border-mist bg-paper px-3 py-2.5">
          <span className="text-graphite">{original.kind === 'audio' ? <PlayIcon /> : <FileIcon />}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{original.fileName}</div>
            <div className="text-xs text-graphite">
              {original.kind === 'audio' ? `Original recording kept${original.duration ? `, ${original.duration}` : ''}` : 'Original file kept'}
            </div>
          </div>
          <Button size="sm" variant="ghost" disabled title="Playback isn’t available in the prototype">
            {original.kind === 'audio' ? 'Play' : 'Open'}
          </Button>
        </div>
      )}

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{original.textLabel}</h3>
        <div className="rounded-md border border-mist bg-paper p-3 text-sm whitespace-pre-wrap">
          {index >= 0 && highlight ? (
            <>
              {original.text.slice(0, index)}
              <mark ref={markRef} className="rounded-xs bg-pending-bg px-0.5 text-ink ring-1 ring-pending-line">
                {highlight}
              </mark>
              {original.text.slice(index + highlight.length)}
            </>
          ) : (
            original.text
          )}
        </div>
        {highlight && index < 0 && (
          <p className="mt-2 text-sm text-graphite">That sentence was edited after intake, so it no longer matches the original.</p>
        )}
      </section>
    </div>
  )
}
