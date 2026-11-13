import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { bandOf, WORDCLOUD } from '@/config/wordcloud'
import { screenById, studyPath } from '@/routes/screens'
import type { Basis, CodebookDoc } from '@/state/codebook'
import { mmss } from '@/state/reportLogic'
import { addStatement, deleteStatement, restoreStatement, searchTranscripts, statementsOf, wordOf, type CloudDoc, type Edits, type Statement, type WordDef } from '@/state/wordcloud'

const LINK = 'text-sm text-graphite underline-offset-2 hover:text-ink hover:underline'
const SERIF = 'font-serif leading-snug text-ink'

type Props = {
  studyId: string
  me: string
  doc: CodebookDoc
  basis: Basis
  def: WordDef
  cloud: CloudDoc
  /** The edits this view works from: the live ones for the Researcher, the last Regenerate for leadership. */
  edits: Edits
  leadership: boolean
  /** The word is still in the cloud as drawn. */
  inCloud: boolean
  pendingHere: boolean
  ignoredIds: Set<string>
  onIgnore: (excerptId: string) => void
  onUndoIgnore: (excerptId: string) => void
  onClose: () => void
}

const hi = (text: string, q: string) => {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0 || !q) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-xs bg-pending-bg px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

/** The statements behind a word. For the Researcher it is where a word is cleaned up: ignore, delete, add. For leadership it only reads. */
export function Panel(p: Props) {
  const { studyId, me, doc, basis, def, cloud, edits, leadership } = p
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [codeFilter, setCodeFilter] = useState<string>()
  const [confirm, setConfirm] = useState<string>()
  const [removedOpen, setRemovedOpen] = useState(false)

  const word = wordOf(def, doc, basis, edits)
  const parts = statementsOf(def, basis, edits)
  const sorted = (list: Statement[]) => [...list].sort((a, b) => Number(b.added) - Number(a.added) || (b.confidence ?? -1) - (a.confidence ?? -1) || a.participantId.localeCompare(b.participantId))
  const shown = sorted([...parts.included, ...(leadership ? [] : parts.ignored)]).filter((s) => !codeFilter || s.codeId === codeFilter || s.added)
  const removedHere = cloud.removed.filter((r) => r.wordKey === def.key)
  const deletedN = parts.removed.filter((s) => !s.added).length
  const addedN = parts.included.filter((s) => s.added).length
  const ignoredN = parts.ignored.length
  const differs = !!word && word.n !== word.codebookN
  const hits = useMemo(() => (adding ? searchTranscripts(basis, query) : []), [adding, basis, query])
  const here = new Set([...parts.included, ...parts.ignored, ...parts.removed].map((s) => `${s.sessionId}|${s.turnIndex}`))
  const href = (s: Statement) => `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', s.sessionId) })}?from=wordcloud&at=${s.atSec}`

  const details = (s: Statement) => (leadership ? `${s.details.segment}` : `${s.details.segment} · ${s.details.ageBand} · ${s.details.city}`)

  if (adding && !leadership)
    return (
      <div className="flex flex-col gap-3" data-testid="add-view">
        <header className="flex flex-col gap-1">
          <button type="button" className={cn(LINK, 'self-start')} onClick={() => { setAdding(false); setQuery('') }} data-testid="add-back">‹ Back to the statements</button>
          <h3 className="font-semibold">Add to: {def.name}</h3>
          <input aria-label="Search the transcripts" data-testid="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search what people said (at least ${WORDCLOUD.search.minChars} characters)`} className="h-9 rounded-sm border border-mist-strong bg-surface px-2 text-sm" autoFocus />
        </header>
        {query.trim().length < WORDCLOUD.search.minChars ? (
          <p className="text-sm text-graphite">Searches the full transcripts of accepted sessions.</p>
        ) : hits.length === 0 ? (
          <p className="text-sm text-graphite" data-testid="no-hits">Nothing found.</p>
        ) : (
          <ul data-testid="hits">
            {hits.map((h) => {
              const already = here.has(`${h.sessionId}|${h.turnIndex}`)
              return (
                <li key={`${h.sessionId}|${h.turnIndex}`} data-testid="hit" data-session={h.sessionId} data-participant={h.participantId} className="border-b border-mist py-2.5 text-sm last:border-b-0">
                  {h.before && <p className="text-xs text-graphite">…{h.before}</p>}
                  <p className={SERIF}>“{hi(h.text, query)}”</p>
                  {h.after && <p className="text-xs text-graphite">{h.after}…</p>}
                  <p className="mt-1 text-xs text-graphite tabular-nums">{h.participantId} · {h.sessionId} · {mmss(h.atSec)}</p>
                  <p className="text-xs text-graphite">{h.details.segment} · {h.details.ageBand} · {h.details.city}</p>
                  <div className="mt-1">
                    {already ? (
                      <button type="button" disabled className="text-sm text-graphite opacity-60" data-testid="already">Already included</button>
                    ) : (
                      <Button size="sm" data-testid="add-hit" onClick={() => { addStatement(studyId, { wordKey: def.key, sessionId: h.sessionId, participantId: h.participantId, turnIndex: h.turnIndex, atSec: h.atSec, text: h.text, by: me }, def.name); setAdding(false); setQuery('') }}>Add</Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="panel" data-word={def.key}>
      <header className="sticky top-0 z-10 -mx-1 flex flex-col gap-1 bg-surface px-1 pb-2">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-lg font-semibold" data-testid="panel-name">{def.name}</h3>
          <span className="rounded-xs border border-mist-strong px-1.5 py-0.5 text-xs text-graphite" data-testid="panel-kind">{def.kind === 'theme' ? 'Theme' : 'Code'}</span>
          <button type="button" aria-label="Close" onClick={p.onClose} data-testid="panel-close" className="rounded-xs px-1.5 text-graphite hover:bg-haze">×</button>
        </div>
        {word && (
          <p className="text-sm text-graphite tabular-nums" data-testid="panel-numbers">
            <span className="font-medium text-ink">{word.n} of {word.of} people</span> · {word.band}{word.avg !== undefined ? `, ${word.avg.toFixed(2)}` : ''}
          </p>
        )}
        {!leadership && differs && word && (
          <p className="text-xs text-graphite" data-testid="diff-line">
            Codebook: {word.codebookN} of {word.of}. Cloud: {word.n} of {word.of} ({deletedN} deleted{ignoredN ? `, ${ignoredN} ignored` : ''}, {addedN} added).
          </p>
        )}
        {!leadership && p.pendingHere && <p className="text-xs text-pending-fg" data-testid="pending-note">Not applied yet. Regenerate to update the cloud.</p>}
        {!p.inCloud && <p className="text-xs text-pending-fg" data-testid="gone-note">This word no longer appears in the cloud.</p>}
      </header>

      {def.kind === 'theme' && def.codes.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Codes in this theme">
          {def.codes.map((c) => (
            <button key={c.id} type="button" aria-pressed={codeFilter === c.id} data-testid="code-chip" onClick={() => setCodeFilter(codeFilter === c.id ? undefined : c.id)} className={cn('rounded-xs border px-2 py-0.5 text-xs', codeFilter === c.id ? 'border-ink bg-ink text-white' : 'border-mist-strong bg-surface text-graphite hover:bg-haze')}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {!leadership && (
        <button type="button" className={cn(LINK, 'self-start font-medium text-ink')} data-testid="add-statement" onClick={() => setAdding(true)}>
          + Add a statement
        </button>
      )}

      <ul data-testid="statements" className="flex flex-col">
        {shown.map((s) => {
          const ignored = parts.ignored.some((x) => x.id === s.id)
          return (
            <li key={s.id} data-testid="statement" data-id={s.id} data-added={s.added} data-ignored={ignored} data-participant={s.participantId} className={cn('border-b border-mist py-3 last:border-b-0', ignored && 'opacity-60')}>
              <p className={SERIF}>“{s.text}”</p>
              <p className="mt-1 text-xs text-graphite tabular-nums">
                {leadership ? s.participantId : `${s.participantId} · ${s.sessionId}`} · {mmss(s.atSec)} · <Link to={href(s)} className="font-medium text-iris-700 hover:underline" data-testid="play">Play</Link>
              </p>
              <p className="text-xs text-graphite" data-testid="details">{details(s)}</p>
              <p className="text-xs text-graphite">{s.added ? 'Added by you' : `${s.codeName} · ${s.confidence !== undefined ? bandOfStatement(s.confidence) : ''}`}</p>
              {!leadership && (
                <p className="mt-1.5 flex flex-wrap items-center gap-3">
                  {ignored ? (
                    <span className="text-xs text-graphite">Ignored in this view <button type="button" className={cn(LINK, 'text-xs')} data-testid="undo-ignore" onClick={() => p.onUndoIgnore(s.id)}>Undo</button></span>
                  ) : confirm === s.id ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm" data-testid="confirm">
                      <span>Delete from the word cloud? It stays in the codebook, the transcript and the report.</span>
                      <Button size="sm" variant="primary" data-testid="confirm-delete" onClick={() => { deleteStatement(studyId, def.key, s.id, def.name, me); setConfirm(undefined) }}>Delete</Button>
                      <Button size="sm" onClick={() => setConfirm(undefined)}>Cancel</Button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className={LINK} data-testid="ignore" onClick={() => p.onIgnore(s.id)}>Ignore</button>
                      <button type="button" className={LINK} data-testid="delete" onClick={() => setConfirm(s.id)}>Delete</button>
                    </>
                  )}
                </p>
              )}
            </li>
          )
        })}
        {shown.length === 0 && <li className="py-3 text-sm text-graphite">No statements.</li>}
      </ul>

      {!leadership && removedHere.length > 0 && (
        <section data-testid="removed">
          <button type="button" aria-expanded={removedOpen} onClick={() => setRemovedOpen((o) => !o)} className={LINK} data-testid="removed-toggle">
            {removedOpen ? '▾' : '▸'} Removed ({removedHere.length})
          </button>
          {removedOpen && (
            <ul className="mt-1">
              {removedHere.map((r) => {
                const s = [...parts.removed].find((x) => x.id === r.excerptId)
                return (
                  <li key={r.id} data-testid="removed-row" data-id={r.excerptId} className="border-b border-mist py-2 text-sm last:border-b-0">
                    <p className="font-serif leading-snug text-graphite">{s ? `“${s.text}”` : 'A statement that is no longer in the codebook.'}</p>
                    <p className="text-xs text-graphite">Removed by {r.by}, {new Date(r.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{' '}
                      <button type="button" className={cn(LINK, 'text-xs')} data-testid="restore" onClick={() => restoreStatement(studyId, def.key, r.excerptId, def.name, me)}>Restore</button>
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

const bandOfStatement = (c: number) => bandOf(c)
