import { useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { screenById, studyPath } from '@/routes/screens'
import type { Basis, CodebookDoc } from '@/state/codebook'
import { mmss } from '@/state/reportLogic'
import { bandWords, headline, quotesOf, segmentNoun, segmentOf, verdictWords, type Bubble, type Segment } from '@/state/themeMap'
import { peopleOf } from '@/state/codebook'

const LINK = 'text-sm text-graphite underline-offset-2 hover:text-ink hover:underline'

/** The quotes behind a theme. Read only: nothing here can be ignored, deleted or added. */
export function Panel({ studyId, doc, basis, bubble, seg, tensionId, onClose }: { studyId: string; doc: CodebookDoc; basis: Basis; bubble: Bubble; seg: Segment; tensionId?: string; onClose: () => void }) {
  const [filter, setFilter] = useState<string>()
  const quotes = quotesOf(bubble, doc, basis, seg).filter((q) => !filter || q.code.id === filter)
  const href = (sessionId: string, at: number) => `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', sessionId) })}?from=themes-map&at=${at}`
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="panel" data-theme={bubble.key}>
      <header className="sticky top-0 z-10 -mx-1 flex flex-col gap-1 bg-surface px-1 pb-2">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-lg font-semibold" data-testid="panel-name">{bubble.name}</h3>
          <button type="button" aria-label="Close" onClick={onClose} data-testid="panel-close" className="rounded-xs px-1.5 text-graphite hover:bg-haze">×</button>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-graphite tabular-nums" data-testid="panel-numbers">
          <span className="font-medium text-ink">{bubble.n} of {bubble.of} {segmentNoun(seg)}</span>
          <span>· {bandWords(bubble)}</span>
          <span className="rounded-xs border border-mist-strong px-1.5 py-0.5 text-xs" data-testid="panel-verdict">{bubble.verdict}</span>
        </p>
        <p className="text-sm" data-testid="panel-headline">{headline(bubble)}</p>
      </header>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Codes in this theme">
        {bubble.codes.map((c) => {
          const people = [...peopleOf(c, basis)].filter((p) => seg === 'all' || segmentOf(p) === seg).length
          return (
            <button key={c.id} type="button" aria-pressed={filter === c.id} data-testid="code-chip" onClick={() => setFilter(filter === c.id ? undefined : c.id)} className={cn('rounded-xs border px-2 py-0.5 text-xs', filter === c.id ? 'border-ink bg-ink text-white' : 'border-mist-strong bg-surface text-graphite hover:bg-haze')}>
              {c.name} · {people} of {bubble.of}
            </button>
          )
        })}
      </div>

      {bubble.verdict === 'Conflicting' && tensionId && (
        <Link to={`${studyPath(studyId, screenById.A2)}?tab=tensions`} className={LINK} data-testid="tension-link">
          See the related tension in Emotion &amp; behaviour
        </Link>
      )}

      <ul data-testid="quotes" className="flex flex-col">
        {quotes.map(({ excerpt: e, code, reading }) => (
          <li key={e.id} data-testid="quote" data-participant={e.participantId} className="border-b border-mist py-3 last:border-b-0">
            <p className="font-serif leading-snug text-ink">“{e.text}”</p>
            <p className="mt-1 text-xs text-graphite tabular-nums">
              {e.participantId} · {e.sessionId} · {mmss(e.atSec)} · <Link to={href(e.sessionId, e.atSec)} className="font-medium text-iris-700 hover:underline" data-testid="play">Play</Link>
            </p>
            <p className="text-xs text-graphite">{segmentOf(e.participantId)} owner · {code.name}</p>
            <p className="text-xs text-graphite" data-testid="reading">{reading}</p>
          </li>
        ))}
        {quotes.length === 0 && <li className="py-3 text-sm text-graphite">No quotes.</li>}
      </ul>
      <p className="sr-only">{verdictWords(bubble.verdict)}</p>
    </div>
  )
}
