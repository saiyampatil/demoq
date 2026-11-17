import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { SideDrawer } from '@/components/SideDrawer'
import { WORDCLOUD } from '@/config/wordcloud'
import { clipsOfTheme } from '@/mock/showreel'
import { checkEdit, citesFor, clock, segmentLabel, sourceOptions, type Cite, type Ctx, type Line, type SourceRef } from '@/state/audioScript'
import { codeThemes, excerpt, themeCodes } from '@/state/codebook'
import { searchTranscripts } from '@/state/wordcloud'

const LINK = 'text-sm text-graphite underline-offset-2 hover:text-ink hover:underline'
const sameRef = (a?: SourceRef, b?: SourceRef) => !!a && !!b && a.kind === b.kind && a.id === b.id
const refKey = (r?: SourceRef) => (r ? `${r.kind}|${r.id}` : '')

/**
 * The editor for a narration line or a Researcher's note, with its checks live under it: how long it takes to say, whether the numbers
 * match the data, whether it is cited. Save is blocked while any of them fails. A note can link a source; a narration line keeps its own.
 */
export function LineEditor({ line, ctx, onSave, onCancel, onBackToAI, initialText }: { line?: Line; ctx: Ctx; onSave: (text: string, source: SourceRef | undefined, cites: Cite[]) => void; onCancel: () => void; onBackToAI?: () => void; initialText?: string }) {
  const isNote = !line || line.type === 'note'
  const [text, setText] = useState(initialText ?? line?.text ?? '')
  const [source, setSource] = useState<SourceRef | undefined>(line?.source)
  const options = useMemo(() => sourceOptions(ctx), [ctx])
  const cites = useMemo(() => (isNote ? (source ? citesFor(source, ctx) : []) : (line?.cites ?? [])), [isNote, source, ctx, line])
  const check = checkEdit(text, isNote ? 'note' : 'narration', isNote ? source : line?.source, cites, ctx)
  // A note with no count needs no source; a note with a count (and any narration) is checked against one.
  const problems = isNote && !check.numbers.length ? check.problems.filter((p) => p !== 'Add a source') : check.problems
  const blocked = problems.length > 0 || !text.trim()
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-mist bg-paper p-3" data-testid="line-editor">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label={isNote ? 'Researcher’s note' : 'Narration'} data-testid="editor-text" autoFocus className="w-full rounded-sm border border-mist-strong bg-surface px-2 py-1.5 text-base text-ink" />
      {isNote && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-graphite">
          Source
          <select aria-label="Source" data-testid="editor-source" value={refKey(source)} onChange={(e) => setSource(options.find((o) => refKey(o.ref) === e.target.value)?.ref)} className="h-8 max-w-xs rounded-sm border border-mist-strong bg-surface px-1.5 text-sm text-ink">
            <option value="">No source (a note, not a data claim)</option>
            {options.map((o) => (
              <option key={refKey(o.ref)} value={refKey(o.ref)}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
      <ul className="flex flex-col gap-0.5 text-sm" data-testid="editor-checks">
        <li data-testid="check-length" className="text-graphite">Takes {check.seconds.toFixed(1)} s to say</li>
        {check.numbers.length > 0 &&
          (check.numbers.every((n) => n.ok) ? (
            <li data-testid="check-numbers" data-ok="true" className="text-positive-fg">Numbers match the data</li>
          ) : (
            check.numbers.filter((n) => !n.ok).map((n) => (
              <li key={n.text} data-testid="check-numbers" data-ok="false" className="text-negative-fg">{n.expected ? `Says ${n.text}. The data says ${n.expected}` : `${n.text} needs a source that matches it`}</li>
            ))
          ))}
        {(!isNote || check.numbers.length > 0 || source) && (
          <li data-testid="check-cited" data-ok={cites.length > 0} className={cites.length > 0 ? 'text-positive-fg' : 'text-negative-fg'}>{cites.length > 0 ? 'Cited' : 'Add a source'}</li>
        )}
        {problems.filter((p) => !/^Says |needs a source|^Add a source$/.test(p)).map((p) => (
          <li key={p} data-testid="check-problem" className="text-negative-fg">{p}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" disabled={blocked} data-testid="editor-save" onClick={() => onSave(text, isNote ? source : line?.source, cites)}>Save</Button>
        <Button size="sm" data-testid="editor-cancel" onClick={onCancel}>Cancel</Button>
        {onBackToAI && (
          <button type="button" className={LINK} data-testid="editor-back-to-ai" onClick={onBackToAI}>Back to AI draft</button>
        )}
      </div>
    </div>
  )
}

/** Quotes the Researcher can use: the best of each approved theme, one person each, minus people already heard in the episode. */
export function eligibleQuotes(ctx: Ctx, heard: Set<string>): { cite: Cite; text: string; theme: string; source: SourceRef }[] {
  const themes = codeThemes(ctx.doc).filter((t) => themeCodes(ctx.doc, t).length > 0)
  const seen = new Set<string>()
  const out: { cite: Cite; text: string; theme: string; source: SourceRef; score: number }[] = []
  for (const t of themes)
    for (const c of clipsOfTheme(ctx.doc, t, ctx.basis)) {
      const e = excerpt(c.id.slice(5))
      if (!e || heard.has(c.participantId) || seen.has(c.participantId)) continue
      seen.add(c.participantId)
      out.push({ cite: { excerptId: e.id, sessionId: e.sessionId, participantId: e.participantId, turnIndex: e.turnIndex, atSec: e.atSec }, text: e.text, theme: t.name, source: { kind: 'theme', id: t.id }, score: c.confidence })
    }
  return out.sort((a, b) => b.score - a.score || a.cite.participantId.localeCompare(b.cite.participantId))
}

/**
 * A drawer for choosing a quote. Two lists: the best quotes of the approved themes, and a search over the full transcripts of accepted sessions
 * (never an excluded one). A segment already in the episode is marked and can't be added twice.
 */
export function QuotePicker({ open, title, ctx, heard, taken, onClose, onPick }: { open: boolean; title: string; ctx: Ctx; heard: Set<string>; taken: Set<string>; onClose: () => void; onPick: (cite: Cite, text: string, source?: SourceRef) => void }) {
  const [query, setQuery] = useState('')
  // A fresh search each time the drawer opens, not the last one.
  useEffect(() => { if (open) setQuery('') }, [open])
  const best = useMemo(() => eligibleQuotes(ctx, heard).slice(0, 12), [ctx, heard])
  const hits = useMemo(() => searchTranscripts(ctx.basis, query), [ctx.basis, query])
  const searching = query.trim().length >= WORDCLOUD.search.minChars
  return (
    <SideDrawer open={open} onClose={onClose} title={title} description="Quotes are the participant’s own words and are never edited. Accepted sessions only.">
      <div className="flex flex-col gap-3" data-testid="quote-picker">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the transcripts" aria-label="Search the transcripts" data-testid="picker-search" className="h-9 rounded-sm border border-mist-strong bg-surface px-2 text-sm" />
        {searching ? (
          hits.length === 0 ? (
            <p className="text-sm text-graphite" data-testid="picker-none">Nothing found.</p>
          ) : (
            <ul data-testid="picker-hits">
              {hits.map((h) => {
                const already = taken.has(`${h.sessionId}|${h.turnIndex}`)
                return (
                  <li key={`${h.sessionId}|${h.turnIndex}`} data-testid="picker-hit" data-participant={h.participantId} className="border-b border-mist py-2.5 text-sm last:border-b-0">
                    <p className="font-serif leading-snug text-ink">“{h.text}”</p>
                    <p className="mt-1 text-xs text-graphite tabular-nums">{h.participantId} · {h.sessionId} · {clock(h.atSec)} · {segmentLabel(h.participantId)}</p>
                    <div className="mt-1">
                      {already ? (
                        <button type="button" disabled className="text-sm text-graphite opacity-60" data-testid="picker-already">Already included</button>
                      ) : (
                        <Button size="sm" data-testid="picker-use" onClick={() => onPick({ excerptId: `turn:${h.sessionId}:${h.turnIndex}`, sessionId: h.sessionId, participantId: h.participantId, turnIndex: h.turnIndex, atSec: h.atSec }, h.text)}>Use this quote</Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <>
            <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Best quotes not yet in the episode</h3>
            {best.length === 0 ? (
              <p className="text-sm text-graphite">Every person with a quote is already in the episode.</p>
            ) : (
              <ul data-testid="picker-best">
                {best.map((q) => (
                  <li key={q.cite.excerptId} data-testid="picker-quote" data-participant={q.cite.participantId} className="border-b border-mist py-2.5 text-sm last:border-b-0">
                    <p className="font-serif leading-snug text-ink">“{q.text}”</p>
                    <p className="mt-1 text-xs text-graphite tabular-nums">{q.cite.participantId} · {q.cite.sessionId} · {clock(q.cite.atSec)} · {segmentLabel(q.cite.participantId)} · {q.theme}</p>
                    <div className="mt-1">
                      <Button size="sm" data-testid="picker-use" onClick={() => onPick(q.cite, q.text, q.source)}>Use this quote</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SideDrawer>
  )
}

/** "+ Add a line" at the end of a chapter: a Researcher's note by default, or a quote. */
export function AddLine({ chapter, ctx, onNote, onQuote }: { chapter: string; ctx: Ctx; onNote: (text: string, source: SourceRef | undefined, cites: Cite[]) => void; onQuote: () => void }) {
  const [mode, setMode] = useState<'closed' | 'choose' | 'note'>('closed')
  if (mode === 'note')
    return <LineEditor ctx={ctx} onSave={(t, s, c) => (onNote(t, s, c), setMode('closed'))} onCancel={() => setMode('closed')} />
  if (mode === 'choose')
    return (
      <div className="flex flex-wrap items-center gap-3 py-2" data-testid="add-choose" data-chapter={chapter}>
        <button type="button" className={cn(LINK, 'font-medium text-ink')} data-testid="add-note" onClick={() => setMode('note')}>Researcher’s note</button>
        <button type="button" className={LINK} data-testid="add-quote" onClick={() => (setMode('closed'), onQuote())}>Quote</button>
        <button type="button" className={LINK} onClick={() => setMode('closed')}>Cancel</button>
      </div>
    )
  return (
    <button type="button" className={cn(LINK, 'py-2')} data-testid="add-line" data-chapter={chapter} onClick={() => setMode('choose')}>
      + Add a line
    </button>
  )
}
export { sameRef }
