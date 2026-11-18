import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { readingWord } from '@/config/labels'
import { READING_LABELS, type ReadingLabel } from '@/config/readings'
import { setReading, setReadingNote, type ReadingDecision } from '@/state/codebook'
import { personReads, type Bucket } from '@/state/signals'
import { decisionFor, editProblems, isAccepted, labelShown, linesOf } from '@/state/themeReadings'
import { mmss } from '../review/reviewUi'
import { BandBar, EmotionBar, FitChip, ToneBar, ValenceCounts, playHref } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { PersonRows, Tiles, countBuckets } from './panelParts'
import { ReadingChip, STATUS_TEXT, StatusChip, acceptRow, when, type ThemeRow } from './signalsShared'

/** What the keyboard asks the panel to open, with a count so the same key twice still works. */
export type Intent = { mode: 'edit' | 'leave'; n: number }
/** Review mode: which Suggested theme this is, out of how many, and what comes next. */
export type ReviewStep = { index: number; total: number; next?: string }

/** A theme selected: its reading and the Researcher's decision first, then the people behind it. */
export function ThemePanel({ row, ctx, onCode, onOpenTension, intent, review, onAcceptNext }: { row: ThemeRow; ctx: CodebookCtx; onCode: (id: string) => void; onOpenTension: (id: string) => void; intent?: Intent; review?: ReviewStep; onAcceptNext?: () => void }) {
  const { t, reading, decision, status } = row
  const toast = useToast()
  const [mode, setMode] = useState<'view' | 'edit' | 'label' | 'leave'>('view')
  const [menu, setMenu] = useState(false)
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const lines = linesOf(decision, reading)
  const label = labelShown(decision, reading)
  const [draft, setDraft] = useState<string[]>(lines)
  const [newLabel, setNewLabel] = useState<ReadingLabel>(label)
  const [why, setWhy] = useState('')
  const note = ctx.doc.readingNotes?.[t.id]
  const [noteText, setNoteText] = useState(note?.text ?? '')
  const reads = useMemo(() => personReads(t.moments, ctx.doc), [t.moments, ctx.doc])
  const counts = countBuckets(reads)
  const shown = bucket ? reads.filter((r) => r.bucket === bucket) : reads
  const theme = { id: t.id, name: t.name }
  const sessions = ctx.basis.sessions.size
  const outOfDate = status === 'Out of date'
  const x = reading.nums
  const problems = editProblems(reading.lines, draft.map((l) => l.trim()).filter(Boolean))
  const tensionList = [...row.tensions].sort((a, b) => Number(b.status === 'Added as a tension theme') - Number(a.status === 'Added as a tension theme'))

  useEffect(() => {
    if (!intent) return
    if (intent.mode === 'edit' && !outOfDate) (setDraft(lines), setMode('edit'))
    if (intent.mode === 'leave' && status !== 'Left out') setMode('leave')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.n])

  const save = (next: ReadingDecision | undefined, action: string, msg: string, detail?: string, reason?: string) => {
    ctx.act((d) => setReading(d, theme, next, action, ctx.me, detail, reason))
    toast(msg)
    setMode('view')
    setWhy('')
  }

  return (
    <section aria-label={`Reading for ${t.name}`} data-testid="theme-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 text-lg leading-snug font-semibold">{t.name}</h2>
            <ReadingChip label={label} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={cn('font-medium', STATUS_TEXT[status])} data-testid="panel-status">
              {status}
            </span>
            <span className="text-muted">·</span>
            <span className="text-muted">
              {t.people} of {t.of} said it
            </span>
          </div>

          {mode === 'edit' ? (
            <div className="mt-3 flex flex-col gap-2" data-testid="reading-editor">
              {draft.map((l, i) => (
                <TextArea key={i} rows={2} value={l} onChange={(e) => setDraft(draft.map((x2, j) => (j === i ? e.target.value : x2)))} aria-label={`Line ${i + 1}`} data-testid="reading-edit-line" />
              ))}
              {problems.length > 0 && (
                <ul className="text-xs text-negative-fg" data-testid="reading-edit-problems">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" disabled={problems.length > 0} onClick={() => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Accepted', text: draft.map((l) => l.trim()).filter(Boolean), label: decision?.label, labelWhy: decision?.labelWhy }), 'Reading edited and accepted', `“${t.name}” reading saved with your wording`)} data-testid="reading-edit-save">
                  Save and accept
                </Button>
                <Button size="sm" onClick={() => setMode('view')}>
                  Cancel
                </Button>
                <button type="button" className="text-xs font-medium text-iris-700 hover:underline" onClick={() => setDraft(reading.lines)}>
                  PulseAI’s wording
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3" data-testid="reading-statement">
              {lines.map((l, i) => (
                <p key={i} className={i === 0 ? 'text-base leading-snug text-ink' : 'mt-1.5 text-[13px] leading-snug text-graphite'}>
                  {l}
                </p>
              ))}
              <span className="mt-2 inline-flex h-5 items-center rounded-xs border border-dashed border-iris-300 bg-iris-50 px-1.5 text-xs font-medium text-iris-700" data-testid="reading-tag">
                {decision?.text && !outOfDate ? `Edited by ${decision.by}` : 'AI-suggested'}
              </span>
              {decision?.label && !outOfDate && (
                <p className="mt-1.5 text-xs text-graphite" data-testid="label-why">
                  Label changed from “{readingWord(reading.label)}” by {decision.by}: “{decision.labelWhy}”
                </p>
              )}
            </div>
          )}

          {outOfDate && decision && (
            <div className="mt-3 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-xs text-pending-fg" data-testid="out-of-date">
              <p className="font-medium">The data changed since this was {decision.status === 'Left out' ? 'left out' : 'accepted'}.</p>
              <p className="mt-0.5 tabular-nums" data-testid="old-new">
                Was {readingWord(decision.snap.label as ReadingLabel)}: {decision.snap.M} fit, {decision.snap.P} didn’t fit, {decision.snap.U} unsure of {decision.snap.R}. Now {readingWord(reading.label)}: {x.M} fit, {x.P} didn’t fit, {x.U} unsure of {x.R}.
              </p>
            </div>
          )}

          {mode === 'label' && (
            <div className="mt-3 flex flex-col gap-2 rounded-sm border border-mist p-3" data-testid="label-editor">
              <label className="text-xs font-medium text-graphite">
                Label
                <select value={newLabel} onChange={(e) => setNewLabel(e.target.value as ReadingLabel)} className="mt-1 block h-8 w-full rounded-sm border border-mist-strong bg-surface px-2 text-sm" data-testid="label-select">
                  {READING_LABELS.map((l) => (
                    <option key={l} value={l}>
                      {readingWord(l)}
                    </option>
                  ))}
                </select>
              </label>
              <TextArea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why does this label fit better? (required)" aria-label="Reason" data-testid="label-why-input" />
              <p className="text-xs text-graphite">The numbers stay as they are: {x.M} fit, {x.P} didn’t fit, {x.U} unsure of {x.R}.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={!why.trim() || newLabel === reading.label} onClick={() => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Accepted', label: newLabel, labelWhy: why.trim(), text: decision?.text }), 'Reading label changed', `“${t.name}” label changed`, `“${reading.label}” to “${newLabel}”`, why)} data-testid="label-save">
                  Change label
                </Button>
                <Button size="sm" onClick={() => setMode('view')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {mode === 'leave' && (
            <div className="mt-3 flex flex-col gap-2 rounded-sm border border-mist p-3" data-testid="leave-editor">
              <TextArea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why leave it out? (optional)" aria-label="Reason" data-testid="leave-why" />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={() => save(decisionFor(reading, decision, ctx.me, sessions, { status: 'Left out', why: why.trim() || undefined }), 'Reading left out', `“${t.name}” reading left out of the report`, undefined, why)} data-testid="leave-save">
                  Leave out
                </Button>
                <Button size="sm" onClick={() => setMode('view')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mode === 'view' && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="reading-actions">
              {review && onAcceptNext ? (
                <Button size="sm" variant="primary" onClick={onAcceptNext} data-testid="reading-accept-next">
                  Accept and next
                  <span className="ml-1.5 text-xs font-normal opacity-80 tabular-nums">
                    {review.index} of {review.total}
                  </span>
                </Button>
              ) : null}
              <Button size="sm" variant={review ? 'secondary' : 'primary'} disabled={!outOfDate && isAccepted(status)} onClick={() => acceptRow(ctx, row, toast)} data-testid="reading-accept">
                {outOfDate ? 'Re-accept' : isAccepted(status) ? 'Accepted' : 'Accept'}
              </Button>
              <Button size="sm" disabled={outOfDate} onClick={() => (setDraft(lines), setMode('edit'))} data-testid="reading-edit">
                Edit
              </Button>
              <Button size="sm" disabled={status === 'Left out'} onClick={() => setMode('leave')} data-testid="reading-leave">
                Leave out
              </Button>
              <span className="relative">
                <Button size="sm" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} data-testid="reading-more">
                  More ▾
                </Button>
                {menu && (
                  <span role="menu" className="absolute top-full left-0 z-20 mt-1 flex w-40 flex-col rounded-sm border border-mist bg-surface py-1 text-sm shadow-overlay">
                    <button type="button" role="menuitem" disabled={outOfDate} className="px-3 py-1.5 text-left hover:bg-haze disabled:opacity-50" onClick={() => (setMenu(false), setNewLabel(label), setMode('label'))} data-testid="reading-label">
                      Change label
                    </button>
                    {decision && (
                      <button type="button" role="menuitem" className="px-3 py-1.5 text-left hover:bg-haze" onClick={() => (setMenu(false), save(undefined, 'Reading decision undone', `“${t.name}” is back to Suggested`))} data-testid="reading-undo">
                        Undo decision
                      </button>
                    )}
                  </span>
                )}
              </span>
            </div>
          )}
          {reading.problems.length > 0 && (
            <ul className="mt-2 text-xs text-negative-fg" data-testid="reading-problems">
              {reading.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </header>

        <section aria-label="Who fit" className="border-t border-mist px-5 py-3.5">
          <Tiles counts={counts} backed={x.backed} active={bucket} onPick={setBucket} />
          <p className="mt-2 text-xs text-muted" data-testid="reading-coverage">
            {x.R} of {t.people} took a position{reading.coverage ? ` · ${reading.coverage}` : ''}
            {x.confused > 0 ? ` · ${x.confused} confused, not counted` : ''}
          </p>
          <div className="mt-2">
            <PersonRows reads={shown} ctx={ctx} />
          </div>
        </section>

        <section aria-label="Codes in this theme" className="border-t border-mist px-5 py-3.5">
          <h3 className="text-sm font-semibold">Codes</h3>
          <ul className="mt-1 divide-y divide-mist" data-testid="theme-panel-codes">
            {t.codes.map((c) => (
              <li key={c.code.id}>
                <button type="button" onClick={() => onCode(c.code.id)} className="flex w-full items-center gap-3 py-1.5 text-left text-sm hover:text-iris-700" data-testid="theme-panel-code">
                  <span className="min-w-0 flex-1 truncate">{c.code.name}</span>
                  <FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {tensionList.length > 0 && (
          <section aria-label="Tensions on this theme" className="border-t border-mist px-5 py-3.5">
            <h3 className="text-sm font-semibold">Tensions</h3>
            <ul className="mt-1 flex flex-col gap-1" data-testid="theme-panel-tensions">
              {tensionList.map((x2) => (
                <li key={x2.id}>
                  <button type="button" onClick={() => onOpenTension(x2.id)} className="flex w-full items-start gap-1.5 rounded-xs text-left text-sm text-iris-700 hover:underline" data-testid="theme-tension">
                    <span className="min-w-0 flex-1">{x2.title}</span>
                    <span className="mt-0.5 shrink-0 text-xs text-graphite">{x2.status === 'Added as a tension theme' ? 'Accepted' : x2.unavailable ? 'Waiting on codebook' : x2.status === 'Suggested' ? 'To review' : x2.status}</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {t.play && (
          <div className="border-t border-mist px-5 py-3">
            <Link to={playHref(ctx.studyId, t.play.sessionId, t.play.atSec)} className="inline-flex items-center gap-1 text-xs font-medium text-iris-700 hover:underline" data-testid="theme-play">
              <PlayIcon size={11} /> Play the clearest moment · {t.play.participantId} at {mmss(t.play.atSec)}
            </Link>
          </div>
        )}

        <section aria-label="Researcher’s note" className="border-t border-mist px-5 py-3.5">
          <h3 className="text-sm font-semibold">Researcher’s note</h3>
          <TextArea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} className="mt-1.5" placeholder="Your own words. Kept apart from PulseAI’s reading." aria-label="Researcher’s note" data-testid="reading-note" />
          <div className="mt-1.5 flex items-center gap-2">
            <Button size="sm" disabled={noteText.trim() === (note?.text ?? '')} onClick={() => (ctx.act((d) => setReadingNote(d, theme, noteText, ctx.me)), toast('Note saved'))} data-testid="reading-note-save">
              Save note
            </Button>
            {note && (
              <span className="text-xs text-muted" data-testid="reading-note-by">
                Researcher’s note · {note.by} · {when(note.at)}
              </span>
            )}
          </div>
        </section>

        <details className="border-t border-mist px-5 py-3" data-testid="theme-details">
          <summary className="cursor-pointer text-sm font-semibold select-none">Details</summary>
          <div className="mt-2 flex flex-col gap-3 text-xs text-graphite">
            <div>
              <p className="mb-1 font-medium">Face</p>
              <EmotionBar split={t.emotions} tall />
              <p className="mt-1 tabular-nums">
                <ValenceCounts e={t.emotions} /> of {t.emotions.read} read
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium">Tone</p>
              <ToneBar split={t.tones} tall />
            </div>
            <div>
              <p className="mb-1 font-medium">Certainty</p>
              <BandBar split={{ counts: { Steady: t.steady, 'Some hesitation': t.some, 'Marked hesitation': t.marked }, n: t.people }} tall />
            </div>
          </div>
        </details>
      </div>
      <footer className="border-t border-mist bg-paper px-5 py-2.5 text-xs text-graphite" data-testid="approval-footer">
        {decision ? `${decision.status === 'Left out' ? 'Left out' : 'Accepted'} by ${decision.by} · ${when(decision.at)} · data v${decision.version}${decision.why ? ` · “${decision.why}”` : ''}` : 'Suggested by PulseAI. Not in the report until you accept it.'}
      </footer>
    </section>
  )
}
export { StatusChip }
