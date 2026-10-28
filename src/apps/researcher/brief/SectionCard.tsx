import { useState } from 'react'
import { AIContent } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { DiffText } from '@/components/DiffText'
import { TextArea } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/format'
import {
  sectionMeta,
  splitSentences,
  type FollowUp,
  type FollowUpStatus,
  type Section,
  type SectionKey,
  type WebSource,
} from '@/state/brief'
import { FollowUpCard } from './FollowUpCard'
import { SourceTag } from './SourceTag'

type SectionCardProps = {
  sectionKey: SectionKey
  section: Section
  followUps: FollowUp[]
  showAiDiff: boolean
  onSave: (text: string) => void
  onAccept: () => void
  onResolve: (id: string, status: Exclude<FollowUpStatus, 'open'>, answer?: string) => void
  onShowSource: (span: string) => void
}

export function SectionCard({ sectionKey, section: s, followUps, showAiDiff, onSave, onAccept, onResolve, onShowSource }: SectionCardProps) {
  const meta = sectionMeta[sectionKey]
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(s.text)
  const [compare, setCompare] = useState(false)

  const missing = !s.text.trim()
  const awaitingReview = s.source === 'AI-generated' && !s.aiAccepted
  const openConflict = followUps.find((f) => f.kind === 'conflict' && (f.status === 'open' || f.status === 'skipped'))
  const skippedMissing = followUps.find((f) => f.kind === 'missing' && f.status === 'skipped')
  const assumed = followUps.find((f) => f.status === 'assumed')

  const startEdit = () => {
    setValue(s.text)
    setEditing(true)
  }

  return (
    <section id={`section-${sectionKey}`} className="scroll-mt-20 rounded-md border border-mist bg-surface">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-mist px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-md font-semibold">
            {meta.title}
            {meta.required && <span className="text-xs font-medium text-graphite">Required</span>}
          </h2>
          <p className="text-xs text-graphite">
            Last edited by {s.lastEdited.by}, <span className="tabular-nums">{formatDateTime(s.lastEdited.at)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceTag source={s.source} />
          {!editing && !missing && !awaitingReview && (
            <Button size="sm" variant="ghost" onClick={startEdit}>
              Edit
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 px-5 py-4">
        {openConflict && <FollowUpCard followUp={openConflict} reopenSkipped onResolve={(status, answer) => onResolve(openConflict.id, status, answer)} />}

        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onSave(value)
              setEditing(false)
            }}
          >
            <TextArea label={`Edit ${meta.title.toLowerCase()}`} rows={Math.max(3, Math.ceil(value.length / 90))} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary">
                Done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <span className="self-center text-xs text-muted">Changes stay unsaved until you save a version.</span>
            </div>
          </form>
        ) : missing ? (
          <MissingInput title={meta.title} needed={meta.needed} skipped={Boolean(skippedMissing)} required={meta.required} onSave={onSave} />
        ) : awaitingReview ? (
          <AIContent
            label={s.aiLabel}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={startEdit}>
                  Edit
                </Button>
                <Button size="sm" variant="primary" icon={<CheckIcon />} onClick={onAccept}>
                  Accept
                </Button>
              </>
            }
          >
            <p className="max-w-prose">{s.text}</p>
            {s.sources && <SourceList sources={s.sources} />}
          </AIContent>
        ) : (
          <>
            <LinkedText section={s} onShowSource={onShowSource} />
            {s.source === 'AI-generated' && (
              <p className="text-xs text-graphite">
                {s.aiLabel ?? 'AI-generated'}, reviewed by {s.lastEdited.by}.
              </p>
            )}
            {s.sources && (
              <details className="text-sm">
                <summary className="cursor-pointer rounded-xs text-graphite hover:text-ink">Web scan sources ({s.sources.length})</summary>
                <SourceList sources={s.sources} />
              </details>
            )}
          </>
        )}

        {assumed && !editing && (
          <p className="text-xs text-graphite">
            Assumption accepted by {assumed.resolvedBy} during intake: {assumed.assumption}
          </p>
        )}

        {showAiDiff && s.source === 'AI-generated' && s.aiOriginal && !awaitingReview && !editing && (
          <div>
            <Button size="sm" variant="ghost" onClick={() => setCompare((c) => !c)} aria-expanded={compare}>
              {compare ? 'Hide AI draft comparison' : 'Compare with AI draft'}
            </Button>
            {compare && (
              <div className="mt-2 rounded-md border border-mist bg-paper p-3 text-sm">
                {s.aiOriginal === s.text ? (
                  <p className="text-graphite">No changes. This is the AI draft as written.</p>
                ) : (
                  <>
                    <p className="mb-1.5 text-xs text-graphite">AI draft compared with your edit. Removed words are struck through, added words are highlighted.</p>
                    <DiffText before={s.aiOriginal} after={s.text} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** Each sentence that came from the input opens the original with that text highlighted. */
function LinkedText({ section, onShowSource }: { section: Section; onShowSource: (span: string) => void }) {
  const links = section.links ?? []
  return (
    <p className="max-w-prose">
      {splitSentences(section.text).map((sentence, i) => {
        const link = links.find((l) => l.sentence === sentence)
        return (
          <span key={i}>
            {i > 0 && ' '}
            {link ? (
              // A span, not a button: browsers render buttons as inline-block, which stops a sentence wrapping mid-line.
              <span
                role="button"
                tabIndex={0}
                onClick={() => onShowSource(link.span)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onShowSource(link.span)
                  }
                }}
                title="Show where this came from in the original input"
                className="cursor-pointer rounded-xs underline decoration-mist-strong decoration-dotted underline-offset-4 hover:bg-haze hover:decoration-graphite"
              >
                {sentence}
              </span>
            ) : (
              sentence
            )}
          </span>
        )
      })}
    </p>
  )
}

function MissingInput({ title, needed, skipped, required, onSave }: { title: string; needed: string; skipped: boolean; required?: boolean; onSave: (t: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      className={cn('flex flex-col gap-2 rounded-md border border-dashed p-4', required ? 'border-pending-line bg-pending-bg/40' : 'border-mist-strong')}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSave(value)
      }}
    >
      <p className="text-sm">
        <span className="font-medium">Needed: </span>
        {needed}
      </p>
      {skipped && <p className="text-sm text-pending-fg">Skipped during intake. Still flagged.</p>}
      {required && <p className="text-sm text-pending-fg">You can’t share the brief until this is filled.</p>}
      <TextArea label={`Add ${title.toLowerCase()}`} rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
      <div>
        <Button type="submit" size="sm" variant="primary" disabled={!value.trim()}>
          Add to brief
        </Button>
      </div>
    </form>
  )
}

function SourceList({ sources }: { sources: WebSource[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5 border-t border-iris-100 pt-2">
      {sources.map((src) => (
        <li key={src.url} className="text-sm">
          <span className="font-medium">{src.title}</span>
          <span className="text-graphite">, {src.publisher}</span>
          <span className="block text-xs break-all text-muted">{src.url}</span>
        </li>
      ))}
    </ul>
  )
}
