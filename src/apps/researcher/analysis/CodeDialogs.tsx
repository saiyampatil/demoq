import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea, TextField } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { acceptCodes, denominator, mergeCodes, peopleOf, questionOf, renameCode, similarCodes, type Code } from '@/state/codebook'
import type { CodebookCtx } from './codebookCtx'

/** A decision that must say why: reject a code, remove a quote, delete a theme. */
export function ReasonDialog({ open, title, description, confirm, danger, onClose, onConfirm }: { open: boolean; title: string; description?: React.ReactNode; confirm: string; danger?: boolean; onClose: () => void; onConfirm: (why: string) => void }) {
  const [why, setWhy] = useState('')
  useEffect(() => {
    if (open) setWhy('')
  }, [open])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!why.trim()} onClick={() => onConfirm(why)} data-testid="reason-confirm">
            {confirm}
          </Button>
        </>
      }
    >
      <TextArea label="Why" hint="Saved in the change log with your name and the time." rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
    </Modal>
  )
}

export function RenameDialog({ ctx, code, open, onClose }: { ctx: CodebookCtx; code: Code; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(code.name)
  const [why, setWhy] = useState('')
  useEffect(() => {
    if (open) {
      setName(code.name)
      setWhy('')
    }
  }, [open, code.name])
  const clash = ctx.doc.codes.some((c) => c.id !== code.id && c.status !== 'Merged' && c.name.trim().toLowerCase() === name.trim().toLowerCase())
  const ok = name.trim() && name.trim() !== code.name && !clash
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename code"
      description="Use the words people used. PulseAI then looks through the other transcripts for excerpts that fit the new name."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              ctx.act((d) => renameCode(d, code.id, name, { by: ctx.me }, why))
              toast(`Renamed to “${name.trim()}”`)
              onClose()
            }}
          >
            Rename
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={clash ? 'Another code already has this name. Merge them instead.' : undefined} />
        <TextField label="Why (optional)" value={why} onChange={(e) => setWhy(e.target.value)} />
      </div>
    </Modal>
  )
}

/** Merge this code into another. The target keeps its place; every quote moves to it. */
export function MergeDialog({ ctx, code, open, into, onClose, onMerged }: { ctx: CodebookCtx; code: Code; open: boolean; into?: string; onClose: () => void; onMerged: (id: string) => void }) {
  const toast = useToast()
  const { doc, basis } = ctx
  const similar = useMemo(() => similarCodes(doc, code, basis), [doc, code, basis])
  const options = useMemo(() => {
    const open = doc.codes.filter((c) => c.id !== code.id && (c.status === 'Suggested' || c.status === 'Accepted'))
    const near = new Set(similar.map((s) => s.code.id))
    const same = (c: Code) => (c.questionId === code.questionId ? 0 : 1)
    return open.sort((a, b) => Number(near.has(b.id)) - Number(near.has(a.id)) || same(a) - same(b) || a.name.localeCompare(b.name))
  }, [doc.codes, code, similar])
  const [target, setTarget] = useState<string>()
  const [name, setName] = useState('')
  const [why, setWhy] = useState('')
  useEffect(() => {
    if (!open) return
    const t = into ?? options[0]?.id
    setTarget(t)
    setName(doc.codes.find((c) => c.id === t)?.name ?? '')
    setWhy('')
  }, [open, into, options, doc.codes])

  const tgt = doc.codes.find((c) => c.id === target)
  const combined = tgt ? new Set([...peopleOf(tgt, basis), ...peopleOf(code, basis)]).size : 0
  const N = tgt ? Math.max(denominator(tgt, basis), denominator(code, basis)) : 0
  const shared = new Map(similar.map((s) => [s.code.id, s.shared]))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Merge “${code.name}” into…`}
      description="Its quotes move to the code you pick. It stays in the codebook as Merged, so the history still reads."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!tgt || !name.trim() || !why.trim()}
            data-testid="merge-confirm"
            onClick={() => {
              if (!tgt) return
              ctx.act((d) => mergeCodes(d, code.id, tgt.id, name, { by: ctx.me }, why))
              toast(`Merged into “${name.trim()}”`)
              onClose()
              onMerged(tgt.id)
            }}
          >
            Merge
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="text-sm font-medium">Merge into</legend>
          <ul className="mt-1.5 max-h-56 overflow-y-auto rounded-sm border border-mist">
            {options.map((o) => (
              <li key={o.id} className="border-b border-mist last:border-0">
                <label className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-haze', target === o.id && 'bg-iris-50')}>
                  <input
                    type="radio"
                    name="merge-target"
                    checked={target === o.id}
                    onChange={() => {
                      setTarget(o.id)
                      setName(o.name)
                    }}
                    className="accent-[var(--color-iris-600)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.name}</span>
                    <span className="block text-xs text-graphite">
                      {o.status} · {o.isNew ? 'New code' : questionOf(o.questionId).label}
                    </span>
                  </span>
                  {shared.has(o.id) && <span className="shrink-0 text-xs font-medium text-iris-700 tabular-nums">{shared.get(o.id)} people in common</span>}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <TextField label="Name of the merged code" value={name} onChange={(e) => setName(e.target.value)} />
        <TextArea label="Why" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
        {tgt && (
          <p className="rounded-sm bg-paper px-3 py-2 text-sm text-graphite">
            After the merge: <span className="font-medium text-ink tabular-nums">{combined} of {N}</span> people. Anyone who said both counts once.
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Accept several high-confidence codes at once. Each is still listed, can be unticked, and is logged on its own. */
export function BulkAcceptDialog({ ctx, open, codes, onClose }: { ctx: CodebookCtx; open: boolean; codes: Code[]; onClose: () => void }) {
  const toast = useToast()
  const [ticked, setTicked] = useState<string[]>([])
  useEffect(() => {
    if (open) setTicked(codes.map((c) => c.id))
  }, [open, codes])
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Accept high-confidence codes"
      description="PulseAI is confident about these. Read each name and untick any you want to look at first."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ticked.length}
            data-testid="bulk-confirm"
            onClick={() => {
              ctx.act((d) => acceptCodes(d, ticked, { by: ctx.me }))
              toast(`Accepted ${ticked.length} ${ticked.length === 1 ? 'code' : 'codes'}`)
              onClose()
            }}
          >
            Accept {ticked.length} {ticked.length === 1 ? 'code' : 'codes'}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col divide-y divide-mist rounded-sm border border-mist">
        {codes.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-haze">
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--color-iris-600)]"
                checked={ticked.includes(c.id)}
                onChange={(e) => setTicked((t) => (e.target.checked ? [...t, c.id] : t.filter((x) => x !== c.id)))}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c.name}</span>
                <span className="block text-xs text-graphite">{c.definition}</span>
              </span>
              <span className="shrink-0 text-xs text-graphite tabular-nums">
                {peopleOf(c, ctx.basis).size} of {denominator(c, ctx.basis)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
