import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { Modal } from '@/components/Modal'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import { checkEdit, type Block } from '@/state/reportBlocks'
import type { Line, PartKey } from '@/state/reportLines'
import { checkLine, PART_LABEL } from '@/state/reportSummary'
import { usePopover } from '../themes/Bits'
import { Bullets, QuoteRow, StatusPill } from './parts'
import { excerpt } from '@/state/codebook'

export type BlockActs = {
  approve: (b: Block) => void
  leaveOut: (b: Block, reason?: string) => void
  reopen: (b: Block) => void
  regenerate: (b: Block) => void
  edit: (blockId: string, lineId: string, text: string | undefined) => void
  draft: (a: 'ai' | 'mine') => void
  mine: (p: PartKey, t: string) => void
  implications: (t: string) => void
  note: (blockId: string, t: string) => void
}

/** Open and close without a jump: the row height animates, and not at all under reduced motion. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="grid transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none" style={{ gridTemplateRows: open ? '1fr' : '0fr' }} aria-hidden={!open}>
      <div className="min-h-0 overflow-hidden" {...(!open ? { inert: true } : {})}>{children}</div>
    </div>
  )
}

const A2_TAB: Record<string, string> = { concepts: 'concepts', sounded: 'themes', tensions: 'tensions' }

function LeaveOut({ onConfirm }: { onConfirm: (reason?: string) => void }) {
  const p = usePopover()
  const [reason, setReason] = useState('')
  return (
    <span ref={p.ref} className="relative">
      <Button size="sm" onClick={() => p.setOpen(!p.open)} aria-expanded={p.open} data-testid="leave-out">Leave out</Button>
      {p.open && (
        <div role="dialog" aria-label="Leave this block out" className="absolute right-0 z-20 mt-1 flex w-72 flex-col gap-2 rounded-md border border-mist bg-surface p-3 shadow-lg">
          <p className="text-sm text-ink">It stays in your workspace and does not reach the client.</p>
          <label className="text-xs text-graphite" htmlFor="lo-reason">Reason (optional)</label>
          <textarea id="lo-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="rounded-sm border border-mist-strong p-2 text-sm" data-testid="leave-out-reason" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => p.setOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => { p.setOpen(false); onConfirm(reason); setReason('') }} data-testid="leave-out-confirm">Leave out</Button>
          </div>
        </div>
      )}
    </span>
  )
}

/** Inline editing of one generated sentence: the words change, the numbers are locked chips. */
function LineEditor({ b, l, onSave, onCancel, onReset }: { b: Block; l: Line; onSave: (t: string) => void; onCancel: () => void; onReset: () => void }) {
  const [text, setText] = useState(l.text)
  const problems = checkEdit(l, text)
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-mist-strong bg-paper p-3" data-testid="line-editor" data-line={l.id}>
      <label className="sr-only" htmlFor={`ed-${l.id}`}>Wording</label>
      <textarea id={`ed-${l.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} className="rounded-sm border border-mist-strong bg-surface p-2 text-sm" data-testid="edit-text" />
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-graphite">
        Locked numbers:
        {l.parts.filter((p) => p.t === 'fig').map((p, i) => (
          <span key={i} className="rounded-xs border border-mist bg-surface px-1.5 tabular-nums text-ink" data-testid="locked-chip">{p.v}</span>
        ))}
      </p>
      {problems.length > 0 && <ul className="text-xs text-negative-fg" role="alert" data-testid="edit-problems">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div className="flex flex-wrap justify-end gap-2">
        {l.edited && <Button size="sm" variant="ghost" onClick={onReset}>Back to generated</Button>}
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={problems.length > 0} onClick={() => onSave(text.trim())} data-testid="edit-save">Save wording</Button>
      </div>
      <span className="sr-only">{b.title}</span>
    </div>
  )
}

function EditableLines({ b, selectedLine, onOpenLine, acts, editing }: { b: Block; selectedLine?: string; onOpenLine?: (l: Line) => void; acts: BlockActs; editing: boolean }) {
  const [editId, setEditId] = useState<string | null>(null)
  if (!editing) return <Bullets lines={b.lines} selectedId={selectedLine} onOpen={onOpenLine} />
  return (
    <ul className="flex flex-col gap-2">
      {b.lines.map((l) => (
        <li key={l.id}>
          {editId === l.id ? (
            <LineEditor b={b} l={l} onCancel={() => setEditId(null)} onSave={(t) => { acts.edit(b.id, l.id, t === l.text ? undefined : t); setEditId(null) }} onReset={() => { acts.edit(b.id, l.id, undefined); setEditId(null) }} />
          ) : (
            <button type="button" onClick={() => setEditId(l.id)} className="min-h-9 w-full rounded-xs border border-dashed border-mist-strong px-3 py-2 text-left text-sm hover:bg-haze" data-testid="edit-line">
              {l.text}
              {l.edited && <span className="ml-2 text-xs text-graphite">(your wording)</span>}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ExecBody({ b, selectedLine, onOpenLine, acts, editing, preview, implications, studyId }: { b: Block; selectedLine?: string; onOpenLine?: (l: Line) => void; acts: BlockActs; editing: boolean; preview?: boolean; implications: string; studyId: string }) {
  const parts: PartKey[] = ['study', 'who', 'found', 'firm']
  const mine = b.draft === 'mine'
  return (
    <div className="flex flex-col gap-4" data-testid="exec-body">
      {!preview && (
        <div className="inline-flex self-start rounded-sm border border-mist p-0.5" role="group" aria-label="Draft">
          {(['ai', 'mine'] as const).map((d) => (
            <button key={d} type="button" aria-pressed={b.draft === d} onClick={() => acts.draft(d)} data-testid={`draft-${d}`} className={cn('min-h-9 rounded-xs px-3 text-sm font-medium', b.draft === d ? 'bg-ink text-white' : 'text-graphite hover:bg-haze')}>
              {d === 'ai' ? 'AI draft' : 'Mine'}
            </button>
          ))}
        </div>
      )}
      {b.missing && b.missing.some((m) => m !== 'decision') && !preview && (
        <p className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg" data-testid="exec-missing">
          Add this in the brief: {b.missing.filter((m) => m !== 'decision').map((m) => (m === 'client' ? 'the client' : 'the research objective')).join(' and ')}.{' '}
          <Link className="font-medium underline" to={studyPath(studyId, screenById.R4)}>Open brief</Link>
        </p>
      )}
      {b.empty && !preview && <p className="rounded-sm border border-dashed border-mist-strong px-3 py-2 text-sm text-graphite" data-testid="exec-empty">Nothing is approved in Emotion & behaviour yet. Approve insights there to fill this report.</p>}
      {mine ? (
        <div className="flex flex-col gap-3">
          {parts.map((k) => {
            const line = b.lines.find((l) => l.part === k)
            const text = line?.text ?? ''
            const problems = text ? checkLine({ text, tag: 'Analysis', source: { type: 'mine' } }) : []
            return (
              <div key={k} className="flex flex-col gap-1">
                <label htmlFor={`mine-${k}`} className="text-xs font-medium text-graphite">{PART_LABEL[k]}</label>
                {preview ? <p className="text-sm text-ink">{text}</p> : <MineField id={`mine-${k}`} value={text} onSave={(t) => acts.mine(k, t)} />}
                {problems.length > 0 && !preview && <p className="text-xs text-negative-fg" role="alert">{problems[0]}</p>}
              </div>
            )
          })}
        </div>
      ) : (
        parts.map((k) => {
          const ls = b.lines.filter((l) => l.part === k)
          if (!ls.length) return null
          return (
            <div key={k} className="flex flex-col gap-1" data-part={k}>
              <p className="text-xs font-medium text-graphite">{PART_LABEL[k]}</p>
              <EditableLines b={{ ...b, lines: ls }} selectedLine={selectedLine} onOpenLine={onOpenLine} acts={acts} editing={editing} />
            </div>
          )
        })
      )}
      {(!preview || implications.trim()) && (
        <div className="rounded-sm border border-pending-line bg-pending-bg p-3" data-testid="implications">
          <label htmlFor="impl" className="text-xs font-semibold tracking-wide text-pending-fg uppercase">Researcher’s implications · written by you, not AI</label>
          {preview ? <p className="mt-1 text-sm text-ink">{implications}</p> : <ImplField value={implications} onSave={acts.implications} />}
        </div>
      )}
    </div>
  )
}

function MineField({ id, value, onSave }: { id: string; value: string; onSave: (t: string) => void }) {
  const [v, setV] = useState(value)
  return <textarea id={id} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} rows={2} placeholder="Write this part yourself." className="rounded-sm border border-mist-strong bg-surface p-2 text-sm" />
}
function ImplField({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [v, setV] = useState(value)
  return <textarea id="impl" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} rows={2} placeholder="Add your implications. Written by you, not AI." className="mt-1 w-full rounded-sm border border-pending-line bg-surface p-2 text-sm" data-testid="implications-field" />
}

function Note({ b, acts }: { b: Block; acts: BlockActs }) {
  const [open, setOpen] = useState(!!b.note)
  const [v, setV] = useState(b.note ?? '')
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-9 self-start rounded-xs text-xs text-graphite hover:underline" data-testid="add-note">Add a note</button>
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-dashed border-mist-strong bg-paper p-2">
      <label htmlFor={`note-${b.id}`} className="text-xs font-medium text-graphite">Your note (never goes to the client)</label>
      <textarea id={`note-${b.id}`} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (b.note ?? '') && acts.note(b.id, v)} rows={2} className="rounded-sm border border-mist bg-surface p-2 text-sm" data-testid="note-field" />
    </div>
  )
}

export function BlockCard({ b, open, onToggle, preview, studyId, acts, selectedLine, onOpenLine, implications, regenerating, reviewing }: {
  b: Block; open: boolean; onToggle: () => void; preview?: boolean; studyId: string; acts: BlockActs; selectedLine?: string; onOpenLine?: (l: Line) => void; implications: string; regenerating?: boolean; reviewing?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const editable = b.kind === 'exec' || b.kind === 'question'
  const toA2 = `${studyPath(studyId, screenById.A2)}?tab=${A2_TAB[b.kind] ?? 'themes'}`
  const noLines = b.lines.length === 0 && !(b.kind === 'exec')
  const cannotApprove = b.kind === 'exec' && b.lines.length === 0
  const decided = b.status === 'Approved' || b.status === 'Left out'
  return (
    <section id={`blk-${b.id}`} data-testid="block" data-block={b.id} data-status={b.status} data-fingerprint={b.fingerprint} aria-label={b.title} className={cn('scroll-mt-4 rounded-md border bg-surface', reviewing ? 'border-iris-600 ring-2 ring-iris-100' : 'border-mist')}>
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${b.title}`} data-testid="block-toggle" className="min-h-9 min-w-9 rounded-xs text-graphite hover:bg-haze">
          <span aria-hidden className={cn('inline-block transition-transform duration-[180ms] motion-reduce:transition-none', open && 'rotate-90')}>›</span>
        </button>
        <div className="min-w-0 flex-1">
          {b.kicker && <p className="text-xs text-graphite">{b.kicker}</p>}
          <h2 className="text-base font-semibold text-ink">{b.number ? <span className="mr-1.5 text-graphite tabular-nums">{b.number}.</span> : null}{b.title}</h2>
          {b.strength && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-graphite">
              <span className={cn('rounded-full border px-2 py-0.5 font-semibold', b.strength.label === 'Strong' ? 'border-positive-line bg-positive-bg text-positive-fg' : 'border-pending-line bg-pending-bg text-pending-fg')} data-testid="strength">{b.strength.label}</span>
              <span className="tabular-nums">{b.strength.n} of {b.strength.of} people</span>
            </p>
          )}
        </div>
        {!preview && <StatusPill status={b.status} />}
      </header>
      {!preview && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3" data-testid="block-actions">
          {!decided && (
            <Tooltip content={cannotApprove ? 'Write at least one part first.' : 'Approves this block, its wording and its numbers, for the report. Nothing is published.'} focusable align="left">
              <Button size="sm" variant="primary" disabled={cannotApprove || noLines && b.kind !== 'question'} onClick={() => acts.approve(b)} data-testid="approve">{b.status === 'Out of date' ? 'Re-approve' : 'Approve'}</Button>
            </Tooltip>
          )}
          {b.status !== 'Left out' && <LeaveOut onConfirm={(r) => acts.leaveOut(b, r)} />}
          {decided && <Button size="sm" variant="ghost" onClick={() => acts.reopen(b)} data-testid="put-back">Put back to review</Button>}
          {editable && b.status !== 'Left out' && b.draft !== 'mine' && b.lines.length > 0 && <Button size="sm" onClick={() => setEditing((e) => !e)} aria-pressed={editing} data-testid="edit">{editing ? 'Done editing' : 'Edit'}</Button>}
          {!editable && b.kind !== 'thin' && <Link to={toA2} className="inline-flex min-h-9 items-center rounded-sm border border-mist-strong px-3 text-sm font-medium text-ink hover:bg-haze" data-testid="edit-in-a2">Edit in Emotion & behaviour</Link>}
          {editable && <Button size="sm" variant="ghost" loading={regenerating} onClick={() => setConfirm(true)} data-testid="regenerate">Regenerate</Button>}
        </div>
      )}
      <Collapse open={open}>
        <div className="flex flex-col gap-3 border-t border-mist px-4 py-3">
          {b.status === 'Out of date' && b.was && !preview && (
            <div className="grid gap-3 rounded-sm border border-negative-line bg-negative-bg p-3 text-sm sm:grid-cols-2" data-testid="out-of-date">
              <div><p className="text-xs font-semibold text-negative-fg uppercase">When you approved it</p><ul className="mt-1 flex flex-col gap-1">{b.was.map((w) => <li key={w.id} className="text-ink">{w.text}</li>)}</ul></div>
              <div><p className="text-xs font-semibold text-negative-fg uppercase">Now</p><ul className="mt-1 flex flex-col gap-1">{b.lines.map((w) => <li key={w.id} className="text-ink">{w.text}</li>)}</ul></div>
              <p className="text-xs text-negative-fg sm:col-span-2">What this block rests on changed after you approved it. Nothing was rewritten.</p>
            </div>
          )}
          {b.kind === 'exec' ? (
            <ExecBody b={b} selectedLine={selectedLine} onOpenLine={onOpenLine} acts={acts} editing={editing} preview={preview} implications={implications} studyId={studyId} />
          ) : b.kind === 'question' ? (
            <>
              {b.lines.length > 0 ? <EditableLines b={b} selectedLine={selectedLine} onOpenLine={onOpenLine} acts={acts} editing={editing && !preview} /> : <p className="text-sm text-graphite">No finding sentence yet for this question.</p>}
              {b.flag && <p className="flex items-start gap-1.5 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg" data-testid="flag"><span aria-hidden>⚑</span>{b.flag}</p>}
              {!!b.quotes?.length && (
                <ul className="flex flex-col gap-2" data-testid="quotes">
                  {b.quotes.map((id) => { const e = excerpt(id); return <QuoteRow key={id} participantId={e.participantId} text={e.text} atSec={e.atSec} sessionId={e.sessionId} /> })}
                </ul>
              )}
            </>
          ) : (
            <>
              <Bullets lines={b.lines} selectedId={selectedLine} onOpen={onOpenLine} />
              {b.footnote && <p className="text-xs text-graphite tabular-nums" data-testid="footnote">{b.footnote}</p>}
            </>
          )}
          {!preview && <Note b={b} acts={acts} />}
        </div>
      </Collapse>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Regenerate this block?" description="It is written again from what you accepted. Wording you edited and approvals you made are kept." footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="primary" onClick={() => { setConfirm(false); acts.regenerate(b) }} data-testid="regenerate-confirm">Regenerate</Button></>} />
    </section>
  )
}

