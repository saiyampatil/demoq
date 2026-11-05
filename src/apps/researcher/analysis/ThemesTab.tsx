import { useEffect, useRef, useState } from 'react'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea, TextField } from '@/components/Field'
import { PlusIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import {
  createTheme,
  deleteTheme,
  dismissSuggestion,
  editTheme,
  moveCode,
  openSuggestions,
  peopleOf,
  questionOf,
  themeCodes,
  themePeople,
  unthemed,
  type Code,
  type Theme,
} from '@/state/codebook'
import { ReasonDialog } from './CodeDialogs'
import type { CodebookCtx } from './codebookCtx'

const DRAG = 'text/x-code-id'
type Editing = { mode: 'new'; codeIds?: string[]; name?: string; definition?: string; from?: string } | { mode: 'edit'; theme: Theme }

/** Founder brief step 4: group accepted codes into themes. A code sits in one theme; only accepted codes can be placed. */
export function ThemesTab({ ctx, onOpenCode }: { ctx: CodebookCtx; onOpenCode: (id: string) => void }) {
  const { doc, basis, me } = ctx
  const toast = useToast()
  const [editing, setEditing] = useState<Editing>()
  const [deleting, setDeleting] = useState<Theme>()
  const free = unthemed(doc)
  const suggestions = openSuggestions(doc)
  const accepted = doc.codes.filter((c) => c.status === 'Accepted').length
  const N = basis.participants.size

  const move = (codeId: string, themeId: string | null) => ctx.act((d) => moveCode(d, codeId, themeId, { by: me }))

  if (!accepted)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes yet" description="Themes are built only from codes you’ve accepted. Review the suggested codes first." />
      </div>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-graphite">
          Drag accepted codes into a theme, or use a code’s menu. A theme counts each person once, however many of its codes they said.
        </p>
        <Button variant="primary" icon={<PlusIcon size={14} />} onClick={() => setEditing({ mode: 'new' })}>
          New theme
        </Button>
      </div>

      {suggestions.length > 0 && (
        <section aria-label="Suggested themes" className="ai-surface p-4">
          <header className="flex flex-wrap items-center gap-2">
            <AIGeneratedTag />
            <h3 className="text-sm font-semibold">
              PulseAI suggests {suggestions.length === 1 ? 'a theme' : `${suggestions.length} themes`} for codes not in a theme yet
            </h3>
          </header>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {suggestions.map((s) => {
              const codes = s.codeIds.map((id) => doc.codes.find((c) => c.id === id)!)
              const people = new Set(codes.flatMap((c) => [...peopleOf(c, basis)])).size
              return (
                <li key={s.id} className="flex flex-col rounded-sm border border-iris-100 bg-surface p-3.5" data-testid="theme-suggestion">
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-0.5 text-sm text-graphite">{s.definition}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {codes.map((c) => (
                      <span key={c.id} className="rounded-xs bg-haze px-1.5 py-0.5 text-xs">
                        {c.name}
                      </span>
                    ))}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-xs text-graphite tabular-nums">
                      {people} of {N} people
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => ctx.act((d) => dismissSuggestion(d, s.id))}>
                      Dismiss
                    </Button>
                    <Button size="sm" onClick={() => setEditing({ mode: 'new', codeIds: s.codeIds, name: s.name, definition: s.definition, from: s.id })}>
                      Edit first
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      data-testid="accept-theme"
                      onClick={() => {
                        ctx.act((d) => createTheme(d, s.name, s.definition, s.codeIds, { by: me }, s.id))
                        toast(`Theme “${s.name}” created`)
                      }}
                    >
                      Accept theme
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {doc.themes.length === 0 ? (
          <div className="rounded-md border border-dashed border-mist-strong bg-surface">
            <EmptyState title="No themes yet" description="Create a theme, or accept one PulseAI suggests, then add codes to it." action={<Button onClick={() => setEditing({ mode: 'new' })}>New theme</Button>} />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" aria-label="Themes">
            {doc.themes.map((t) => (
              <ThemeCard key={t.id} ctx={ctx} theme={t} onEdit={() => setEditing({ mode: 'edit', theme: t })} onDelete={() => setDeleting(t)} move={move} onOpenCode={onOpenCode} />
            ))}
          </ul>
        )}

        <Tray codes={free} ctx={ctx} move={move} onOpenCode={onOpenCode} />
      </div>

      <ThemeDialog ctx={ctx} editing={editing} free={free} onClose={() => setEditing(undefined)} />
      <ReasonDialog
        open={!!deleting}
        title={`Delete “${deleting?.name}”?`}
        description="Its codes go back to “Not in a theme”. The codes themselves don’t change."
        confirm="Delete theme"
        danger
        onClose={() => setDeleting(undefined)}
        onConfirm={(why) => {
          if (!deleting) return
          ctx.act((d) => deleteTheme(d, deleting.id, { by: me }, why))
          toast(`Deleted “${deleting.name}”`)
          setDeleting(undefined)
        }}
      />
    </div>
  )
}

function useDrop(onDrop: (codeId: string) => void) {
  const [over, setOver] = useState(false)
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG)) return
        e.preventDefault()
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false)
        const id = e.dataTransfer.getData(DRAG)
        if (id) onDrop(id)
      },
    },
  }
}

function ThemeCard({ ctx, theme: t, onEdit, onDelete, move, onOpenCode }: { ctx: CodebookCtx; theme: Theme; onEdit: () => void; onDelete: () => void; move: (codeId: string, themeId: string | null) => void; onOpenCode: (id: string) => void }) {
  const { doc, basis } = ctx
  const codes = themeCodes(doc, t)
  const people = themePeople(doc, t, basis).size
  const N = basis.participants.size
  const spans = [...new Set(codes.map((c) => questionOf(c.questionId).label))]
  const drop = useDrop((id) => move(id, t.id))
  return (
    <li {...drop.props} data-testid="theme-card" className={cn('flex flex-col rounded-md border bg-surface transition-colors', drop.over ? 'border-iris-600 bg-iris-50' : 'border-mist')}>
      <div className="flex items-start gap-2 px-4 pt-3.5">
        <h3 className="min-w-0 flex-1 font-semibold">{t.name}</h3>
        <button type="button" onClick={onEdit} className="rounded-xs px-1.5 py-0.5 text-xs font-medium text-graphite hover:bg-haze hover:text-ink">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="rounded-xs px-1.5 py-0.5 text-xs font-medium text-graphite hover:bg-haze hover:text-negative-fg">
          Delete
        </button>
      </div>
      <div className="px-4">
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums">{people}</span>
          <span className="text-sm text-graphite tabular-nums">of {N} people</span>
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
          <span className="block h-full rounded-full bg-ink" style={{ width: `${(people / N) * 100}%` }} />
        </div>
        {t.definition && <p className="mt-2.5 text-sm text-graphite">{t.definition}</p>}
      </div>
      <ul className="mt-3 flex flex-1 flex-col gap-1.5 px-4 pb-3" aria-label={`Codes in ${t.name}`}>
        {codes.map((c) => (
          <Chip key={c.id} code={c} ctx={ctx} current={t.id} move={move} onOpenCode={onOpenCode} />
        ))}
        <li className={cn('rounded-sm border border-dashed px-3 py-2 text-center text-xs', drop.over ? 'border-iris-600 text-iris-700' : 'border-mist-strong text-muted')}>
          {codes.length ? 'Drop a code here' : 'No codes yet. Drop one here'}
        </li>
      </ul>
      {spans.length > 0 && <p className="border-t border-mist px-4 py-2 text-xs text-graphite">From: {spans.join(' · ')}</p>}
    </li>
  )
}

function Tray({ codes, ctx, move, onOpenCode }: { codes: Code[]; ctx: CodebookCtx; move: (codeId: string, themeId: string | null) => void; onOpenCode: (id: string) => void }) {
  const drop = useDrop((id) => move(id, null))
  return (
    <aside {...drop.props} aria-label="Accepted codes not in a theme" className={cn('rounded-md border bg-surface lg:sticky lg:top-4', drop.over ? 'border-iris-600 bg-iris-50' : 'border-mist')}>
      <header className="border-b border-mist px-4 py-3">
        <h3 className="text-sm font-semibold">
          Not in a theme <span className="font-normal text-graphite tabular-nums">{codes.length}</span>
        </h3>
        <p className="text-xs text-graphite">Accepted codes waiting for a theme. Drop a code here to take it out of one.</p>
      </header>
      {codes.length === 0 ? (
        <p className="px-4 py-5 text-sm text-graphite">Every accepted code is in a theme.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 p-3" data-testid="tray">
          {codes.map((c) => (
            <Chip key={c.id} code={c} ctx={ctx} current={null} move={move} onOpenCode={onOpenCode} />
          ))}
        </ul>
      )}
    </aside>
  )
}

/** A code in a theme or the tray. Drag it, or open its menu to move it without a mouse. */
function Chip({ code: c, ctx, current, move, onOpenCode }: { code: Code; ctx: CodebookCtx; current: string | null; move: (codeId: string, themeId: string | null) => void; onOpenCode: (id: string) => void }) {
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])
  const n = peopleOf(c, ctx.basis).size
  const targets = ctx.doc.themes.filter((t) => t.id !== current)
  return (
    <li ref={ref} className="relative">
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG, c.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        data-testid="code-chip"
        className="flex cursor-grab items-center gap-2 rounded-sm border border-mist bg-paper px-2.5 py-1.5 text-sm hover:border-mist-strong active:cursor-grabbing"
      >
        <span aria-hidden="true" className="text-muted">
          ⠿
        </span>
        <span className="min-w-0 flex-1 truncate">{c.name}</span>
        <span className="text-xs text-graphite tabular-nums">{n}</span>
        <button type="button" aria-haspopup="menu" aria-expanded={menu} aria-label={`Move or open ${c.name}`} onClick={() => setMenu((m) => !m)} className="-mr-1 rounded-xs px-1 text-graphite hover:bg-haze hover:text-ink">
          ⋯
        </button>
      </div>
      {menu && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-sm border border-mist bg-surface py-1 text-sm shadow-overlay">
          <button role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left hover:bg-haze" onClick={() => onOpenCode(c.id)}>
            Open code
          </button>
          {targets.length > 0 && <p className="px-3 pt-2 pb-1 text-xs text-graphite">Move to</p>}
          {targets.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              type="button"
              className="block w-full truncate px-3 py-1.5 text-left hover:bg-haze"
              onClick={() => {
                move(c.id, t.id)
                setMenu(false)
              }}
            >
              {t.name}
            </button>
          ))}
          {current && (
            <button
              role="menuitem"
              type="button"
              className="block w-full border-t border-mist px-3 py-1.5 text-left text-graphite hover:bg-haze"
              onClick={() => {
                move(c.id, null)
                setMenu(false)
              }}
            >
              Take out of this theme
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function ThemeDialog({ ctx, editing, free, onClose }: { ctx: CodebookCtx; editing?: Editing; free: Code[]; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState('')
  const [codeIds, setCodeIds] = useState<string[]>([])
  useEffect(() => {
    if (!editing) return
    if (editing.mode === 'edit') {
      setName(editing.theme.name)
      setDefinition(editing.theme.definition)
    } else {
      setName(editing.name ?? '')
      setDefinition(editing.definition ?? '')
      setCodeIds(editing.codeIds ?? [])
    }
  }, [editing])
  const isNew = editing?.mode === 'new'
  const clash = ctx.doc.themes.some((t) => (editing?.mode !== 'edit' || t.id !== editing.theme.id) && t.name.trim().toLowerCase() === name.trim().toLowerCase())
  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      size="lg"
      title={isNew ? (editing?.from ? 'Edit the suggested theme' : 'New theme') : 'Edit theme'}
      description={isNew ? 'Name it in plain words, as you’d say it to the client.' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || clash}
            onClick={() => {
              if (!editing) return
              if (editing.mode === 'edit') ctx.act((d) => editTheme(d, editing.theme.id, name, definition, { by: ctx.me }))
              else ctx.act((d) => createTheme(d, name, definition, codeIds, { by: ctx.me }, editing.from))
              toast(isNew ? `Theme “${name.trim()}” created` : 'Theme saved')
              onClose()
            }}
          >
            {isNew ? 'Create theme' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={clash ? 'A theme with this name already exists.' : undefined} />
        <TextArea label="What it means (optional)" rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        {isNew && free.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">Codes to add</legend>
            <p className="text-xs text-graphite">From accepted codes not in a theme. You can add more later.</p>
            <ul className="mt-1.5 max-h-52 overflow-y-auto rounded-sm border border-mist">
              {free.map((c) => (
                <li key={c.id} className="border-b border-mist last:border-0">
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-haze">
                    <input
                      type="checkbox"
                      className="accent-[var(--color-iris-600)]"
                      checked={codeIds.includes(c.id)}
                      onChange={(e) => setCodeIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-graphite tabular-nums">{peopleOf(c, ctx.basis).size}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>
    </Modal>
  )
}
