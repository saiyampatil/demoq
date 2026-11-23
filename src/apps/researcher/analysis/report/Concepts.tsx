// A3: the concept lines the Researcher accepted in Emotion & behaviour, as one small table (Said · Did · Showed) with the first reactions that
// go with each. Only accepted or edited lines are here; nothing is added by this screen.

import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { screenById, studyPath } from '@/routes/screens'
import type { Basis, CodebookDoc } from '@/state/codebook'
import { clipsOf, conceptRows } from '@/state/concepts'
import { plural, segmentLabelOf } from '@/state/signals'
import { mmss } from '../../review/reviewUi'
import { playHref } from '../SignalBits'

export const acceptedConceptLines = (doc: CodebookDoc, basis: Basis) => {
  const m = conceptRows(doc, basis)
  return m ? { ...m, accepted: m.rows.filter((r) => r.decision.status === 'Accepted' || r.decision.status === 'Edited') } : undefined
}

export function ConceptRows({ doc, basis, studyId, open, onToggle }: { doc: CodebookDoc; basis: Basis; studyId: string; open: boolean; onToggle: () => void }) {
  const m = acceptedConceptLines(doc, basis)
  if (!m) return null
  const link = `${studyPath(studyId, screenById.A2)}?tab=concepts`
  return (
    <section data-testid="concepts" aria-label="Concepts" className="rounded-md border border-mist bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper">
        <span className={cn('text-graphite transition-transform', open && 'rotate-90')}><ChevronRightIcon size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Concepts</span>
          <span className="block text-xs text-graphite" data-testid="concepts-summary">
            {m.accepted.length ? `${plural(m.accepted.length, 'concept line')} accepted in Emotion & behaviour` : 'No concept line is accepted yet.'}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-mist" data-testid="concepts-body">
          {m.accepted.length === 0 ? (
            <p className="px-4 py-3 text-sm text-graphite">
              Decide the lines in <Link to={link} className="font-medium text-iris-700 hover:underline">Emotion & behaviour</Link> and they appear here.
            </p>
          ) : (
            <>
              <div className={cn('hidden items-center gap-x-3 border-b border-mist bg-haze px-4 py-1.5 text-xs font-medium text-graphite sm:grid', m.hasChoiceTask ? 'grid-cols-[minmax(0,1fr)_5rem_5rem_5rem]' : 'grid-cols-[minmax(0,1fr)_5rem_5rem]')}>
                <span>Concept</span>
                <span className="text-right">Said</span>
                {m.hasChoiceTask && <span className="text-right">Did</span>}
                <span className="text-right">Showed</span>
              </div>
              <ul className="flex flex-col divide-y divide-mist">
                {m.accepted.map((r) => {
                  const text = doc.insights?.[r.key]?.text ?? r.line
                  const { clips } = clipsOf(m.input, r.id, 3)
                  return (
                    <li key={r.id} data-testid="concept-line-row" data-concept={r.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className={cn('grid items-baseline gap-x-3', m.hasChoiceTask ? 'grid-cols-[minmax(0,1fr)_5rem_5rem_5rem]' : 'grid-cols-[minmax(0,1fr)_5rem_5rem]')}>
                        <span className="text-sm font-medium text-ink">{r.name}</span>
                        <span className="text-right text-sm tabular-nums" data-testid="report-said">{r.said ? `${r.said.n} of ${r.said.of}` : '—'}</span>
                        {m.hasChoiceTask && <span className="text-right text-sm tabular-nums" data-testid="report-did">{r.did ? `${r.did.n} of ${r.did.of}` : '—'}</span>}
                        <span className={cn('text-right text-sm tabular-nums', r.showed.greyed && 'text-muted')} data-testid="report-showed">{r.showed.n} of {r.showed.of}</span>
                      </div>
                      <p className="text-sm text-ink" data-testid="report-concept-text">{text}</p>
                      {clips.length > 0 && (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite" data-testid="report-clips">
                          {clips.map((c) => (
                            <li key={c.participantId}>
                              <Link to={playHref(studyId, c.sessionId, c.reading.revealAtSec)} className="inline-flex min-h-6 items-center gap-1 rounded-xs hover:text-ink" aria-label={`Play ${c.participantId} at ${mmss(c.reading.revealAtSec)}`}>
                                <PlayIcon size={11} /> <span className="font-medium text-ink tabular-nums">{c.participantId}</span> {segmentLabelOf(c.participantId)} reads as {c.reading.label.toLowerCase()} · {c.reading.intensity.toLowerCase()}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
