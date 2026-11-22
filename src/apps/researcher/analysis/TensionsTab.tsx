import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, TextArea, TextField } from '@/components/Field'
import { PlayIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { EmotionChip } from './SignalBits'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { formatStamp } from '@/lib/format'
import { segmentsOf, type SegmentConfig } from '@/mock/studyAnalysis'
import { screenById, studyPath } from '@/routes/screens'
import { dismissTension, restoreTension, turnTensionIntoTheme } from '@/state/codebook'
import { TENSION_KINDS, TENSION_KIND_HINT, TENSION_KIND_LABEL, tensionsOf, type Side, type Tension, type TensionKind, type TensionStatus } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import { ReasonDialog } from './CodeDialogs'
import { playHref } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'

/** 'Waiting' is the cards that need a code the Researcher has not accepted yet: not actionable, so never part of "To review". */
export type TensionFilter = TensionStatus | 'All' | 'Waiting'
const FILTERS: { key: TensionFilter; label: string }[] = [
  { key: 'Suggested', label: 'To review' },
  { key: 'Added as a tension theme', label: 'Added' },
  { key: 'Dismissed', label: 'Dismissed' },
  { key: 'Waiting', label: 'Waiting on codebook' },
  { key: 'All', label: 'All' },
]
const KIND_HINT = TENSION_KIND_HINT

/** Where what people said doesn't add up. PulseAI suggests each one; you add it as a tension theme or dismiss it, and say why. */
export function TensionsTab({ ctx, filter, setFilter, focusId, onSeeSignals, onContinue }: { ctx: CodebookCtx; filter: TensionFilter; setFilter: (f: TensionFilter) => void; focusId?: string; onSeeSignals: (codeId?: string) => void; onContinue: () => void }) {
  const [kind, setKind] = useState<TensionKind | 'all'>('all')
  const [turning, setTurning] = useState<Tension>()
  const [dismissing, setDismissing] = useState<Tension>()
  const toast = useToast()
  const all = tensionsOf(ctx.doc, ctx.basis)
  // A card waiting on an unaccepted code has no decision and cannot be reviewed: it is in "Waiting", never in "To review".
  const waiting = (t: Tension) => !!t.unavailable && !t.decision
  const inFilter = (t: Tension, f: TensionFilter) => (f === 'All' ? true : f === 'Waiting' ? waiting(t) : f === 'Suggested' ? t.status === 'Suggested' && !waiting(t) : t.status === f)
  const shown = all.filter((t) => inFilter(t, filter) && (kind === 'all' || t.kind === kind))
  const count = (f: TensionFilter) => all.filter((t) => inFilter(t, f)).length
  // Only the types that have cards, the one with most first.
  const kinds = TENSION_KINDS.map((k, i) => ({ k, n: all.filter((t) => t.kind === k).length, i })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.i - b.i)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Tension status" className="flex flex-wrap rounded-sm border border-mist-strong p-0.5">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} data-testid={`tf-${f.key}`} className={cn('h-7 rounded-xs px-2.5 text-sm', filter === f.key ? 'bg-ink font-medium text-white' : 'text-graphite hover:bg-haze hover:text-ink')}>
              {f.label} <span className={cn('tabular-nums', filter === f.key ? 'text-white/80' : 'text-muted')} data-testid={`tf-n-${f.key}`}>{count(f.key)}</span>
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as TensionKind | 'all')} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
            <option value="all">All types</option>
            {kinds.map(({ k, n }) => (
              <option key={k} value={k}>
                {TENSION_KIND_LABEL[k]} ({n})
              </option>
            ))}
          </select>
        </label>
        <p className="min-w-0 flex-1 text-sm text-graphite">Where what people said doesn’t match how they looked, sounded or answered. Suggested by PulseAI. Nothing reaches the report until you add it.</p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState
            title={filter === 'Suggested' && kind === 'all' ? 'Every tension has a decision' : 'No tensions match'}
            description={filter === 'Suggested' && kind === 'all' ? 'Nothing is waiting for you here. Continue to the report when you’re ready.' : 'Try another status or type.'}
            action={
              filter === 'Suggested' && kind === 'all' ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="primary" onClick={onContinue} data-testid="empty-continue">
                    Continue to Report
                  </Button>
                  <Button
                    onClick={() => {
                      setFilter('All')
                      setKind('all')
                    }}
                  >
                    Show all tensions
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    setFilter('All')
                    setKind('all')
                  }}
                >
                  Show all tensions
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="tension-list">
          {shown.map((t) => (
            <TensionCard
              key={t.id}
              t={t}
              ctx={ctx}
              focused={focusId === t.id}
              onSeeSignals={onSeeSignals}
              onTurn={() => setTurning(t)}
              onDismiss={() => setDismissing(t)}
              onRestore={() => {
                ctx.act((d) => restoreTension(d, t, { by: ctx.me }))
                toast(t.status === 'Added as a tension theme' ? 'Back in To review. The tension theme was taken out.' : 'Back in To review')
              }}
            />
          ))}
        </ul>
      )}

      <TurnDialog ctx={ctx} t={turning} onClose={() => setTurning(undefined)} />
      <ReasonDialog
        open={!!dismissing}
        title="Dismiss this tension?"
        description={dismissing ? `“${dismissing.title}”. It stays in the log with your reason, and never reaches the client. You can restore it.` : undefined}
        confirm="Dismiss tension"
        onClose={() => setDismissing(undefined)}
        onConfirm={(why) => {
          if (!dismissing) return
          ctx.act((d) => dismissTension(d, dismissing, { by: ctx.me }, why))
          toast('Tension dismissed')
          setDismissing(undefined)
        }}
      />
    </div>
  )
}

function TensionCard({ t, ctx, focused, onSeeSignals, onTurn, onDismiss, onRestore }: { t: Tension; ctx: CodebookCtx; focused: boolean; onSeeSignals: (codeId?: string) => void; onTurn: () => void; onDismiss: () => void; onRestore: () => void }) {
  const dim = t.status === 'Dismissed' || !!t.unavailable
  const theme = t.decision?.themeId ? ctx.doc.themes.find((x) => x.id === t.decision?.themeId) : undefined
  const ref = useRef<HTMLLIElement>(null)
  const [ring, setRing] = useState(false)
  // Arriving from a code's panel scrolls to this card and marks it for a moment.
  useEffect(() => {
    if (!focused) return
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setRing(true)
    const id = setTimeout(() => setRing(false), 2200)
    return () => clearTimeout(id)
  }, [focused])
  const codes = t.codeIds.map((id) => ctx.doc.codes.find((c) => c.id === id)).filter(Boolean)
  return (
    <li ref={ref} id={`tension-${t.id}`} data-testid="tension-card" data-status={t.status} data-kind={t.kind} data-waiting={t.unavailable && !t.decision ? 'true' : undefined} className={cn('rounded-md border bg-surface transition-shadow', dim ? 'border-mist bg-paper' : 'border-mist', ring && 'border-iris-600 shadow-[0_0_0_3px_var(--color-iris-100)]')}>
      <header className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <span className="inline-flex h-5 items-center rounded-xs border border-mist-strong bg-surface px-1.5 text-xs font-medium text-graphite" title={KIND_HINT[t.kind]}>
          {TENSION_KIND_LABEL[t.kind]}
        </span>
        {t.status === 'Suggested' && !t.unavailable && <AIGeneratedTag />}
        <span className="flex-1" />
        <StatusChip status={t.status} size="sm" />
      </header>
      <div className="px-5 pt-2.5 pb-4">
        <h3 className={cn('text-md leading-snug font-semibold', dim && 'text-graphite')}>{t.title}</h3>
        <p className="mt-1 text-sm text-graphite">{t.summary}</p>
        {!t.unavailable && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite">
            See the signals:
            {[
              ...codes.map((c) => ({ key: c!.id, label: c!.name, test: 'see-signals', onClick: () => onSeeSignals(c!.id) })),
            ].map((l, i) => (
              <span key={l.key} className="inline-flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">·</span>}
                <button type="button" onClick={l.onClick} data-testid={l.test} className="rounded-xs font-medium text-iris-700 hover:underline">
                  {l.label}
                </button>
              </span>
            ))}
          </p>
        )}

        {t.unavailable ? (
          <p className="mt-3 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg">{t.unavailable}</p>
        ) : (
          <>
            {t.kind === 'Between segments' && t.sides.length === 4 ? (
              <SegmentChart sides={t.sides} answers={t.answers ?? ['First answer', 'Second answer']} segments={segmentsOf(ctx.studyId)} />
            ) : (
              <div className="mt-4 grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]" data-testid="tension-sides">
                <SideBlock s={t.sides[0]} dim={dim} />
                <div className="flex items-center justify-center gap-1 text-xs text-graphite sm:flex-col" aria-hidden="true">
                  <span>of those</span>
                  <span className="text-base">→</span>
                </div>
                <SideBlock s={t.sides[1]} dim={dim} />
              </div>
            )}
            {t.caution && <p className="mt-2 text-xs text-pending-fg">{t.caution}</p>}
            {t.coverage?.map((c) => (
              <p key={c} className="mt-1 text-xs text-pending-fg" data-testid="tension-coverage">
                {c}
              </p>
            ))}

            {t.clips.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-graphite">Supporting moments</h4>
                <ul className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
                  {t.clips.slice(0, 4).map((c) => (
                    <li key={c.participantId} className="rounded-sm border border-mist bg-paper p-3">
                      <p className="flex items-center gap-2 text-xs text-graphite tabular-nums">
                        <span className="font-medium text-ink">{c.participantId}</span>
                        {mmss(c.atSec)}
                        <Link to={playHref(ctx.studyId, c.sessionId, c.atSec)} className="ml-auto inline-flex items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${c.participantId} at ${mmss(c.atSec)}`}>
                          <PlayIcon size={11} /> Play
                        </Link>
                      </p>
                      {c.quote && <p className="mt-1 font-serif text-quote leading-snug text-ink">“{c.quote}”</p>}
                      {c.faces && c.faces.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-1.5" data-testid="clip-faces">
                          {c.faces.map((f) => (
                            <li key={f.where} className="text-xs text-graphite">
                              <span className="font-medium text-ink">{f.where}.</span> Seen at <span className="tabular-nums">{mmss(f.atSec)}</span> ({f.onsetSec} s in): {f.cue.toLowerCase()}.
                              <span className="mt-0.5 block">
                                <EmotionChip emotion={f.emotion} intensity={f.intensity} corrected={f.corrected} reads />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 text-xs text-graphite">{c.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {(t.status === 'Suggested' && !t.unavailable) || t.decision ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-mist px-5 py-3">
          {t.status === 'Suggested' && (
            <>
              <Button variant="primary" onClick={onTurn} data-testid="turn-theme">
                Add as a tension theme
              </Button>
              <Button onClick={onDismiss} data-testid="dismiss-tension">
                Dismiss
              </Button>
            </>
          )}
          {t.status === 'Added as a tension theme' && t.decision && (
            <>
              <p className="min-w-0 flex-1 text-sm text-graphite">
                Tension theme <span className="font-medium text-ink">“{theme?.name ?? 'removed'}”</span> added by {t.decision.by}, {formatStamp(t.decision.at)}.{' '}
                {theme && (
                  <Link to={`${studyPath(ctx.studyId, screenById.A1)}?tab=themes`} className="font-medium text-iris-700 hover:underline">
                    Open in Themes
                  </Link>
                )}
              </p>
              <Button size="sm" onClick={onRestore} data-testid="restore-tension">
                Restore
              </Button>
            </>
          )}
          {t.status === 'Dismissed' && t.decision && (
            <>
              <p className="min-w-0 flex-1 text-sm text-graphite">
                Dismissed by {t.decision.by}, {formatStamp(t.decision.at)}. <span className="text-ink">“{t.decision.why}”</span>
              </p>
              <Button size="sm" onClick={onRestore} data-testid="restore-tension">
                Restore
              </Button>
            </>
          )}
        </footer>
      ) : null}
    </li>
  )
}

/** The same question, answered by two groups: one row per answer, a bar each for the first and the second group (cat and dog owners, parents and adults), sized by the share of that group. */
function SegmentChart({ sides, answers, segments }: { sides: Side[]; answers: [string, string]; segments: SegmentConfig }) {
  const rows = [
    { label: answers[0], first: sides[0], second: sides[2] },
    { label: answers[1], first: sides[1], second: sides[3] },
  ]
  // A longer answer needs a wider label column.
  const wide = answers.some((a) => a.length > 30)
  // The people in neither row, so each group's lines add up to the group.
  const restOf = (s: Side) => s.rest ?? []
  const restLabels = [...new Set([...restOf(sides[0]), ...restOf(sides[2])].map((r) => r.label))]
  const restRow = (label: string) => ({ label, first: restOf(sides[0]).find((r) => r.label === label), second: restOf(sides[2]).find((r) => r.label === label) })
  const bar = (s: Side, tone: string) => (
    <div className="flex items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-haze" aria-hidden="true">
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${s.of ? (s.n / s.of) * 100 : 0}%` }} />
      </span>
      <span className="w-14 shrink-0 text-xs text-graphite tabular-nums">
        <span className="font-semibold text-ink">{s.n}</span> of {s.of}
      </span>
    </div>
  )
  return (
    <div className="mt-4 rounded-sm border border-mist px-4 py-3" data-testid="segment-chart">
      <div className={cn('grid items-center gap-x-4 gap-y-2.5 text-sm', wide ? 'grid-cols-[13rem_1fr_1fr]' : 'grid-cols-[9.5rem_1fr_1fr]')}>
        <span />
        <span className="flex items-center gap-1.5 text-xs font-medium text-graphite">
          <span aria-hidden="true" className="size-2 rounded-full bg-iris-300" /> {segments.first.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-graphite">
          <span aria-hidden="true" className="size-2 rounded-full bg-ink" /> {segments.second.label}
        </span>
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <span>{r.label}</span>
            {bar(r.first, 'bg-iris-300')}
            {bar(r.second, 'bg-ink')}
          </div>
        ))}
        {restLabels.map((l) => {
          const r = restRow(l)
          const mk = (x?: { n: number; of: number }) => (x ? bar({ label: l, n: x.n, of: x.of }, 'bg-mist-strong') : <span />)
          return (
            <div key={l} className="contents" data-testid="segment-rest" data-label={l}>
              <span className="text-graphite">{l}</span>
              {mk(r.first)}
              {mk(r.second)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SideBlock({ s, dim }: { s: Side; dim: boolean }) {
  return (
    <div className="rounded-sm border border-mist px-3.5 py-3">
      <p className="flex items-baseline gap-1.5">
        <span className={cn('text-xl font-semibold tabular-nums', dim && 'text-graphite')}>{s.n}</span>
        <span className="text-sm text-graphite tabular-nums">of {s.of}</span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden="true">
        <span className="block h-full rounded-full bg-ink" style={{ width: `${s.of ? (s.n / s.of) * 100 : 0}%`, opacity: dim ? 0.4 : 1 }} />
      </div>
      <p className="mt-1.5 text-sm">{s.label}</p>
      {s.note && <p className="text-xs text-graphite">{s.note}</p>}
      {s.rest && s.rest.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-mist pt-2" data-testid="side-rest">
          {s.rest.map((r) => (
            <li key={r.label} data-testid="side-rest-line" data-n={r.n} data-of={r.of} className="flex items-center gap-2 text-xs text-graphite">
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-haze" aria-hidden="true">
                <span className="block h-full rounded-full bg-mist-strong" style={{ width: `${r.of ? (r.n / r.of) * 100 : 0}%` }} />
              </span>
              <span className="flex-1">{r.label}</span>
              <span className="tabular-nums">
                {r.n} of {r.of}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Turning a tension into a theme: name it for the client, and see which codes it draws on. The codes stay in their own themes. */
function TurnDialog({ ctx, t, onClose }: { ctx: CodebookCtx; t?: Tension; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState('')
  useEffect(() => {
    if (!t) return
    setName(t.themeName)
    setDefinition(t.summary)
  }, [t])
  const clash = !!t && ctx.doc.themes.some((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
  const codes = t ? t.codeIds.map((id) => ctx.doc.codes.find((c) => c.id === id)?.name).filter(Boolean) : []
  return (
    <Modal
      open={!!t}
      onClose={onClose}
      size="lg"
      title="Add as a tension theme"
      description="It joins your themes as a tension theme, and goes into the report. The codes it draws on stay in the themes they’re already in."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || clash}
            data-testid="turn-confirm"
            onClick={() => {
              if (!t) return
              ctx.act((d) => turnTensionIntoTheme(d, t, t.codeIds, name, definition, { by: ctx.me }))
              toast(`Tension theme “${name.trim()}” added`)
              onClose()
            }}
          >
            Add tension theme
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <p className="rounded-sm bg-paper px-3 py-2 text-sm text-graphite">“{t?.title}”</p>
        <TextField label="Tension theme name" value={name} onChange={(e) => setName(e.target.value)} error={clash ? 'A theme with this name already exists.' : undefined} />
        <TextArea label="What it means" rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        <p className="text-sm text-graphite">
          Draws on {codes.length === 1 ? 'the code' : 'the codes'}: <span className="font-medium text-ink">{codes.map((c) => `“${c}”`).join(', ')}</span>.
        </p>
      </div>
    </Modal>
  )
}
