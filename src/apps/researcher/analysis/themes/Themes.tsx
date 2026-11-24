// A2, the Themes tab: one table of themes and their codes, and the one panel beside it.
// Columns: Name · Said by · What stood out · Verdict · Status. Collapsed on load. No bars, no colour legend: the Key holds every meaning.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { AlertIcon, ChevronRightIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { screenById, studyPath } from '@/routes/screens'
import { acceptInsight, editInsight, leaveOutInsight, setInsightNote, undoInsight, type Theme } from '@/state/codebook'
import { standoutLabel } from '@/state/speech'
import { TENSION_KIND_LABEL, plural, tensionsFor, type CodeSignal, type Tension, type ThemeSignal } from '@/state/signals'
import type { CodebookCtx } from '../codebookCtx'
import { FitChip } from '../SignalBits'
import { HowToRead, InsightStatusChip, StanceLabel } from './Bits'
import type { ThemeModel, SignalFocus } from './model'
import { CodePanel, ThemePanel, tensionsOn, type Intent, type Review } from './Panels'

// Fixed widths and a clear gap, so no header label touches the next. Cells line up on the first line of the name.
const GRID = 'grid grid-cols-[minmax(0,1fr)_4.5rem_9.5rem_7.25rem_8.25rem] items-start gap-x-3'
type Show = 'All' | 'Needs review'

const themeRef = (p: ThemeSignal): Pick<Theme, 'id' | 'name'> => ({ id: p.id, name: p.name })
const needsReview = (p: ThemeSignal) => p.decision.status === 'Suggested' || p.decision.status === 'Out of date'

export function ThemesTab({
  ctx,
  model,
  focus,
  setFocus,
  tensions,
  reviewStart,
  onOpenTensions,
  onOpenTension,
}: {
  ctx: CodebookCtx
  model: ThemeModel
  focus: SignalFocus
  setFocus: (f: SignalFocus) => void
  tensions: Tension[]
  /** Changes when the footer's "Review n insights" is pressed. */
  reviewStart: number
  onOpenTensions: () => void
  onOpenTension: (id: string) => void
}) {
  const { doc, me, studyId } = ctx
  const toast = useToast()
  const { signals, profiles } = model
  const themes = profiles.filter((p) => p.kind === 'theme')
  const none = profiles.find((p) => p.kind === 'none')
  // Accepted tension themes: shown apart, with no verdict, no insight and no Accept, and never in the insights counter.
  const fromTensions = profiles.filter((p) => p.kind === 'tension')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [show, setShow] = useState<Show>('All')
  const [intent, setIntent] = useState<Intent>()
  const [queue, setQueue] = useState<string[] | null>(null)
  const [at, setAt] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  const shownThemes = show === 'Needs review' ? themes.filter(needsReview) : themes
  const codesOf = (p: ThemeSignal) => p.codes
  const themeOfCode = (id: string) => themes.find((t) => t.codes.some((c) => c.code.id === id))
  const allIds = [...themes.map((t) => t.id), ...(none ? ['none'] : [])]
  const allOpen = allIds.length > 0 && allIds.every((id) => open.has(id))
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const expand = (id: string) => setOpen((s) => new Set(s).add(id))

  const openTheme = (id: string) => setFocus({ theme: id })
  const openCode = (id: string) => {
    const t = themeOfCode(id)
    if (t) expand(t.id)
    setFocus({ code: id })
  }

  // ── decisions ──
  const accept = (p: ThemeSignal, next = false) => {
    if (!p.decidable) return
    const prev = doc.insights?.[p.id]
    ctx.act((d) => acceptInsight(d, themeRef(p), p.now, { by: me }))
    toast(`Accepted “${p.name}”`, { label: 'Undo', onClick: () => ctx.act((d) => undoInsight(d, themeRef(p), prev, { by: me })) })
    if (next) goNext(p.id)
  }
  const edit = (p: ThemeSignal, text: string) => {
    ctx.act((d) => editInsight(d, themeRef(p), p.now, text, { by: me }))
    toast(`Saved your wording for “${p.name}”`)
  }
  const leaveOut = (p: ThemeSignal, why: string) => {
    const prev = doc.insights?.[p.id]
    ctx.act((d) => leaveOutInsight(d, themeRef(p), p.now, { by: me }, why))
    toast(`Left out “${p.name}”`, { label: 'Undo', onClick: () => ctx.act((d) => undoInsight(d, themeRef(p), prev, { by: me })) })
    if (queue) goNext(p.id)
  }

  // ── review mode: the first insight to decide, then the next one after each Accept ──
  const startReview = () => {
    const ids = model.counts.toReview.map((p) => p.id)
    if (!ids.length) return
    setQueue(ids)
    setAt(0)
    openTheme(ids[0])
  }
  const goNext = (currentId: string) => {
    if (!queue) return
    const i = queue.indexOf(currentId)
    // The ones not decided yet, after this one. The current one is being decided now.
    const rest = queue.slice(i + 1).filter((id) => { const p = profiles.find((x) => x.id === id); return p && needsReview(p) && p.decidable })
    if (!rest.length) {
      setQueue(null)
      toast('Every insight is decided')
      return
    }
    setAt(queue.indexOf(rest[0]))
    openTheme(rest[0])
  }
  // Only a press of the footer's button starts it, never the page opening.
  const seen = useRef(reviewStart)
  useEffect(() => {
    if (reviewStart === seen.current) return
    seen.current = reviewStart
    startReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewStart])
  const review: Review | undefined = queue ? { index: at, total: queue.length, exit: () => setQueue(null) } : undefined

  // ── keyboard: Up and Down move rows, Enter opens, A accepts, E edits, L leaves out ──
  const visible = useMemo(() => {
    const out: string[] = []
    shownThemes.forEach((t) => { out.push(`t:${t.id}`); if (open.has(t.id)) codesOf(t).forEach((c) => out.push(`c:${c.code.id}`)) })
    if (none && show === 'All') { out.push('t:none'); if (open.has('none')) none.codes.forEach((c) => out.push(`c:${c.code.id}`)) }
    return out
  }, [shownThemes, open, none, show]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return
    const row = t.closest<HTMLElement>('[data-row]')
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!row) return
      e.preventDefault()
      const i = visible.indexOf(row.dataset.row ?? '')
      const next = visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      root.current?.querySelector<HTMLElement>(`[data-row="${next}"] [data-row-main]`)?.focus()
      return
    }
    const k = e.key.toLowerCase()
    if (k !== 'a' && k !== 'e' && k !== 'l') return
    const id = row?.dataset.themeOf ?? focus.theme ?? (focus.code ? themeOfCode(focus.code)?.id : undefined)
    const p = themes.find((x) => x.id === id)
    if (!p) return
    e.preventDefault()
    openTheme(p.id)
    if (k === 'a') { if (p.decision.status !== 'Accepted' && p.decision.status !== 'Edited') accept(p, !!queue) }
    else setIntent({ theme: p.id, kind: k === 'e' ? 'edit' : 'leave', n: Date.now() })
  }

  if (!signals.length)
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-surface">
        <EmptyState title="No accepted codes" description="How people sounded is read on the codes you’ve accepted. Accept some in the codebook first." />
      </div>
    )

  const selectedTheme = focus.theme ? profiles.find((p) => p.id === focus.theme && p.kind === 'theme') : undefined
  const selectedCode = focus.code ? signals.find((s) => s.code.id === focus.code) : undefined
  const codeTheme = selectedCode ? themeOfCode(selectedCode.code.id) : undefined
  const noneLine = none && (
    <>
      {plural(none.codes.length, 'code')} {none.codes.length === 1 ? 'isn’t' : 'aren’t'} in a theme yet.{' '}
      <Link to={`${studyPath(studyId, screenById.A1)}?tab=themes`} data-testid="group-in-codebook" className="relative z-10 rounded-xs font-medium text-iris-700 hover:underline">
        Group {none.codes.length === 1 ? 'it' : 'them'} in the codebook.
      </Link>
    </>
  )

  const codeRow = (c: CodeSignal, parent: string) => {
    const on = focus.code === c.code.id
    return (
      <li key={c.code.id} data-row={`c:${c.code.id}`} data-theme-of={parent} className="border-t border-mist/70 first:border-t-0">
        <div
          data-testid="signal-row"
          data-code={c.code.id}
          aria-current={on ? 'true' : undefined}
          onClick={() => openCode(c.code.id)}
          className={cn(GRID, 'min-h-11 cursor-pointer border-l-2 py-2.5 pr-3 pl-20 text-[13px] leading-5', on ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}
        >
          <span className="flex min-w-0 items-start gap-2">
            <button type="button" data-row-main data-testid="code-name" className="line-clamp-2 min-w-0 flex-1 cursor-pointer rounded-xs text-left font-medium">{c.code.name}</button>
            <StanceLabel ctx={ctx} code={c.code} />
          </span>
          <span className="text-right text-xs whitespace-nowrap text-graphite tabular-nums" data-testid="code-said-by">{c.people} of {c.of}</span>
          <span className="text-xs text-graphite tabular-nums" data-testid="code-stood-out">{c.standout ? standoutLabel(c.standout) : '—'}</span>
          <span data-testid="fit-cell" className="pt-px"><FitChip pattern={c.readable ? c.fit.pattern : 'Too few to read'} /></span>
          <span />
        </div>
      </li>
    )
  }

  return (
    <div ref={root} onKeyDown={onKeyDown} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Themes" data-testid="themes-table" className="min-w-0 overflow-x-clip rounded-md border border-mist bg-surface">
        <div className="min-w-[42rem]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-mist px-3 py-1">
            <HowToRead />
            <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(allIds))} data-testid="expand-all" className="min-h-9 cursor-pointer rounded-xs px-1 text-sm font-medium text-iris-700 hover:underline">{allOpen ? 'Collapse all' : 'Expand all'}</button>
            <span className="flex-1" />
            <span className="flex items-center gap-1 text-sm text-graphite" role="group" aria-label="Show">
              Show:
              {(['All', 'Needs review'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={show === s} onClick={() => setShow(s)} data-testid={`show-${s === 'All' ? 'all' : 'review'}`} className={cn('inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xs px-2 text-sm', show === s ? 'bg-iris-600 font-medium text-white' : 'hover:bg-haze hover:text-ink')}>
                  {s}
                  {s === 'Needs review' && <span className={cn('tabular-nums', show === s ? 'text-white/80' : 'text-muted')} data-testid="show-review-count">{model.counts.toReview.length}</span>}
                </button>
              ))}
            </span>
          </div>
          <div className={cn(GRID, 'sticky top-14 z-10 border-b border-mist bg-haze py-2 pr-3 pl-3 text-xs font-medium text-graphite')} data-testid="signal-head">
            <span className="pl-12">Name</span>
            <span className="text-right">Said by</span>
            <span>What stood out</span>
            <span>Verdict</span>
            <span>Status</span>
          </div>
          {shownThemes.length === 0 && !(none && show === 'All') ? (
            <EmptyState title="Nothing needs review" description="Every insight is decided." action={<Button onClick={() => setShow('All')}>Show all</Button>} />
          ) : (
            <div className="pt-1">
              {shownThemes.map((p) => {
                const isOpen = open.has(p.id)
                const on = focus.theme === p.id
                // The same list the panel shows (tensionsOn), so a row's count and its panel always match.
                const mine = tensionsOn(tensions, new Set(p.codes.map((c) => c.code.id)))
                const toReview = mine.filter((t) => t.status === 'Suggested').length
                const status = p.decision.status
                const decision = doc.insights?.[p.id]
                const insightLine = (status === 'Accepted' || status === 'Edited') && decision ? decision.text : p.insight?.sentence ?? `Only ${plural(p.people, 'person', 'people')} said this, too few to read a pattern.`
                const canAccept = p.decidable && (status === 'Suggested' || status === 'Out of date' || status === 'Left out')
                const flagTip = `${plural(mine.length, 'tension')} draw on this theme${toReview ? `, ${toReview} still to review` : ''}. Open the Tensions tab.`
                return (
                  <section key={p.id} aria-labelledby={`grp-${p.id}`} data-testid="theme-group" data-group-id={p.id} data-open={isOpen ? 'true' : undefined} className={cn('border-b border-mist last:border-0', isOpen && 'bg-haze/60')}>
                    <div data-row={`t:${p.id}`} data-theme-of={p.id} data-testid="theme-row" data-selected={on ? 'true' : undefined} className={cn(GRID, 'group relative min-h-[4.5rem] border-l-2 py-3 pr-3 pl-1', on ? 'border-iris-600 bg-iris-50' : 'border-transparent hover:bg-haze')}>
                      <div className="flex min-w-0 items-start gap-0.5">
                        <button type="button" onClick={() => toggle(p.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${p.name}`} data-testid="theme-chevron" className="relative z-10 -my-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xs text-graphite hover:bg-haze">
                          <ChevronRightIcon size={14} className={cn('transition-transform duration-150 motion-reduce:transition-none', isOpen && 'rotate-90')} />
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-5">
                            <h3 id={`grp-${p.id}`} className="text-[15px] font-semibold">
                              <button type="button" data-row-main onClick={() => openTheme(p.id)} aria-current={on ? 'true' : undefined} data-testid="theme-name" className="cursor-pointer rounded-xs text-left underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline">{p.name}</button>
                            </h3>
                            <span className="text-xs text-muted tabular-nums" data-testid="group-count">{plural(p.codes.length, 'code')}</span>
                            {mine.length > 0 && (
                              <button type="button" onClick={() => (mine.length === 1 ? onOpenTension(mine[0].id) : onOpenTensions())} data-testid="tension-flag" data-to-review={toReview} title={flagTip} aria-label={flagTip} className={cn('relative z-10 inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-xs text-xs font-medium hover:underline', toReview ? 'text-pending-fg' : 'text-graphite')}>
                                <AlertIcon size={12} />
                                <span className="tabular-nums">{plural(mine.length, 'tension')}</span>
                              </button>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-4 text-graphite" data-testid="theme-insight">{insightLine}</p>
                        </div>
                      </div>
                      <span className="text-right text-xs leading-5 whitespace-nowrap text-graphite tabular-nums" data-testid="theme-said-by">{p.people} of {p.of}</span>
                      <span className="text-xs leading-5 text-muted" data-testid="theme-stood-out" aria-label="Nothing for a theme here">—</span>
                      <button type="button" onClick={() => openTheme(p.id)} data-testid="theme-verdict" aria-label={`Open ${p.name}`} className="relative z-10 -my-3 inline-flex min-h-11 cursor-pointer items-center self-start rounded-xs"><FitChip pattern={p.verdict} /></button>
                      <span className="relative z-10 -my-3 flex min-h-11 items-center" data-testid="status-cell"><InsightStatusChip status={status} /></span>
                      {canAccept && (
                        <Button size="sm" variant="secondary" className="absolute right-3 bottom-2.5 z-10 w-[8.25rem] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none" onClick={() => { openTheme(p.id); accept(p, !!queue) }} data-testid="row-accept" aria-label={`Accept ${p.name}`}>Accept</Button>
                      )}
                    </div>
                    {isOpen && <ul className="pb-1">{codesOf(p).map((c) => codeRow(c, p.id))}</ul>}
                  </section>
                )
              })}
              {none && show === 'All' && (
                <section aria-labelledby="grp-none" data-testid="theme-group" data-group-id="none" data-open={open.has('none') ? 'true' : undefined} className={cn('border-b border-mist last:border-0', open.has('none') && 'bg-haze/60')}>
                  <div data-row="t:none" data-testid="theme-row" className={cn(GRID, 'relative min-h-[4.5rem] border-l-2 border-transparent py-3 pr-3 pl-1')}>
                    <div className="flex min-w-0 items-start gap-0.5">
                      <button type="button" onClick={() => toggle('none')} aria-expanded={open.has('none')} aria-label={`${open.has('none') ? 'Collapse' : 'Expand'} Not in a theme`} data-testid="theme-chevron" className="relative z-10 -my-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xs text-graphite hover:bg-haze">
                        <ChevronRightIcon size={14} className={cn('transition-transform duration-150 motion-reduce:transition-none', open.has('none') && 'rotate-90')} />
                      </button>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 leading-5">
                          <h3 id="grp-none" className="text-[15px] font-semibold">
                            <button type="button" data-row-main onClick={() => toggle('none')} data-testid="theme-name" className="min-h-6 cursor-pointer rounded-xs text-left underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline">Not in a theme</button>
                          </h3>
                          <span className="text-xs text-muted tabular-nums" data-testid="group-count">{plural(none.codes.length, 'code')}</span>
                        </div>
                        <p className="mt-0.5 text-xs leading-4 text-graphite" data-testid="theme-insight">{noneLine}</p>
                      </div>
                    </div>
                    <span /><span /><span /><span />
                  </div>
                  {open.has('none') && <ul className="pb-1">{none.codes.map((c) => codeRow(c, 'none'))}</ul>}
                </section>
              )}
              {fromTensions.length > 0 && show === 'All' && (
                <section aria-labelledby="grp-tensions" data-testid="tension-group" className="border-b border-mist bg-haze/40 last:border-0">
                  <h3 id="grp-tensions" className="px-4 pt-3 pb-1 text-[15px] font-semibold">From tensions <span className="text-xs font-normal text-muted tabular-nums" data-testid="group-count">({fromTensions.length})</span></h3>
                  <ul className="pb-2">
                    {fromTensions.map((p) => {
                      const tn = tensions.find((t) => t.id === p.theme?.tensionId)
                      return (
                        <li key={p.id} data-testid="tension-theme-row" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                          <span className="min-w-0 font-medium">{p.name}</span>
                          <span className="inline-flex h-5 items-center rounded-xs border border-pending-line bg-pending-bg px-1.5 text-xs font-medium text-pending-fg" data-testid="from-a-tension-tag">From a tension</span>
                          {tn && <span className="text-xs text-graphite" data-testid="tension-type">{TENSION_KIND_LABEL[tn.kind]}</span>}
                          {tn && <button type="button" onClick={() => onOpenTension(tn.id)} data-testid="open-tension-card" className="ml-auto min-h-9 cursor-pointer rounded-xs text-xs font-medium text-iris-700 hover:underline">Open its card in Tensions</button>}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="lg:sticky lg:top-20">
        {selectedTheme ? (
          <ThemePanel
            key={selectedTheme.id}
            prof={selectedTheme}
            ctx={ctx}
            tensions={tensions}
            intent={intent}
            review={review}
            onAccept={() => accept(selectedTheme, !!queue)}
            onEdit={(text) => edit(selectedTheme, text)}
            onLeaveOut={(why) => leaveOut(selectedTheme, why)}
            onNote={(text) => ctx.act((d) => setInsightNote(d, themeRef(selectedTheme), text, { by: me }))}
            onCode={openCode}
            onOpenTension={onOpenTension}
          />
        ) : selectedCode ? (
          <CodePanel key={selectedCode.code.id} s={selectedCode} theme={codeTheme} ctx={ctx} tensions={tensionsFor(tensions, selectedCode.code.id)} onOpenTension={onOpenTension} back={codeTheme ? { name: codeTheme.name, onClick: () => openTheme(codeTheme.id) } : undefined} />
        ) : (
          <div className="rounded-md border border-dashed border-mist-strong bg-surface" data-testid="panel-empty">
            <EmptyState title="Pick a theme" description="Open a theme to see how people sounded against what they said, and the moments that show it." />
          </div>
        )}
      </div>
    </div>
  )
}
