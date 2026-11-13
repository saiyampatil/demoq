import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../shared/PageHeader'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { THEME_MAP } from '@/config/themeMap'
import { layoutBubbles, overlapOf } from '@/lib/themeLayout'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY } from '@/state/codebook'
import { plural } from '@/state/reportLogic'
import { accessibleName, bandWords, bubblesOf, directionalNote, peopleSets, segmentNoun, segmentSize, SEGMENTS, summaryOf, tensionLines, tourCaption, tourOrder, TOUR_END, verdictWords, type Bubble, type Segment } from '@/state/themeMap'
import { AnalysisStepper } from './AnalysisStepper'
import { Panel } from './thememap/Panel'
import { useAnalysis } from './useAnalysis'

const SEG = 'inline-flex overflow-hidden rounded-xs border border-mist'
const SEG_BTN = (on: boolean) => cn('px-2.5 py-1 text-sm font-medium', on ? 'bg-ink text-white' : 'bg-surface text-graphite hover:bg-haze')
const radiusOf = (n: number, max: number) => (max <= 0 ? THEME_MAP.radius.min : THEME_MAP.radius.min + (THEME_MAP.radius.max - THEME_MAP.radius.min) * (Math.sqrt(n) / Math.sqrt(max)))

function Segmented<T extends string>({ label, value, options, onChange, testid }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; testid: string }) {
  return (
    <div role="group" aria-label={label} className={SEG} data-testid={testid}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} data-testid={`${testid}-${v}`} onClick={() => onChange(v)} className={SEG_BTN(value === v)}>
          {text}
        </button>
      ))}
    </div>
  )
}

/** Fill and text for a bubble, in the chosen colour mode. */
function paint(b: Bubble, mode: 'strength' | 'verdict'): { fill: string; text: string; hatched: boolean } {
  if (b.kind === 'none') return { ...THEME_MAP.notInTheme, hatched: false }
  if (mode === 'strength') {
    if (b.notEnough || !b.band) return { fill: THEME_MAP.hatched.fill, text: THEME_MAP.hatched.text, hatched: true }
    return { ...THEME_MAP.strengthFill[b.band], hatched: false }
  }
  if (b.verdict === 'Consistent' || b.verdict === 'Conflicting' || b.verdict === 'Mixed') return { ...THEME_MAP.verdictFill[b.verdict], hatched: false }
  return { fill: THEME_MAP.hatched.fill, text: THEME_MAP.hatched.text, hatched: true }
}

/** Wraps a name into lines that fit a bubble. */
function lines(name: string, r: number, size: number): string[] {
  const per = Math.max(6, Math.floor((r * 1.7) / (size * 0.56)))
  const out: string[] = []
  let cur = ''
  for (const w of name.split(' ')) {
    if (cur && (cur + ' ' + w).length > per) (out.push(cur), (cur = w))
    else cur = cur ? `${cur} ${w}` : w
  }
  if (cur) out.push(cur)
  return out.slice(0, 4)
}

/** A3, Theme map. The accepted themes as one picture: size is people, colour is how strong the reaction was, the ring is A2's verdict. */
export function ThemeMapPage() {
  const { studyId, study, review, doc, basis, accepted, ready } = useAnalysis()
  const [params] = useSearchParams()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [seg, setSeg] = useState<Segment>('all')
  const [mode, setMode] = useState<'strength' | 'verdict'>('strength')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [selected, setSelected] = useState<string>()
  const [hover, setHover] = useState<string>()
  const [tour, setTour] = useState<number | null>(null)
  const [auto, setAuto] = useState(false)
  const [paused, setPaused] = useState(false)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const excluded = review.filter((r) => r.status === 'Excluded').length

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(t)
  }, [studyId])

  const everyone = useMemo(() => (doc ? bubblesOf(doc, basis, 'all') : []), [doc, basis])
  const bubbles = useMemo(() => (doc ? bubblesOf(doc, basis, seg) : []), [doc, basis, seg])
  const size = doc ? segmentSize(basis, seg) : 0
  // Positions come from the Everyone view, so a segment change resizes and recolours bubbles without moving any of them.
  const placed = useMemo(() => {
    const max = Math.max(1, ...everyone.map((b) => b.n))
    const sets = peopleSets(everyone)
    return layoutBubbles(
      everyone.map((b) => ({ key: b.key, r: radiusOf(b.n, max) })),
      (a, b) => overlapOf(sets.get(a) ?? new Set(), sets.get(b) ?? new Set()),
      THEME_MAP.viewBox.width,
      THEME_MAP.viewBox.height,
      `${studyId}|themes`,
    )
  }, [everyone, studyId])
  const maxAll = Math.max(1, ...everyone.map((b) => b.n))
  const at = new Map(placed.map((p) => [p.key, p]))
  const { lines: tension, skipped } = useMemo(() => (doc ? tensionLines(doc, basis, everyone) : { lines: [], skipped: 0 }), [doc, basis, everyone])
  const steps = useMemo(() => tourOrder(bubbles), [bubbles])
  const tourBubble = tour !== null && tour < steps.length ? steps[tour] : undefined
  const active = hover ?? tourBubble?.key
  const sel = bubbles.find((b) => b.key === selected)
  const open = !!sel

  // Esc closes the panel and returns to the bubble; Esc during the tour stops it. Arrow keys step the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tour !== null) {
        if (e.key === 'Escape') setTour(null)
        else if (e.key === 'ArrowRight') setTour((t) => (t === null ? t : Math.min(steps.length, t + 1)))
        else if (e.key === 'ArrowLeft') setTour((t) => (t === null ? t : Math.max(0, t - 1)))
        return
      }
      if (e.key === 'Escape' && selected) {
        const key = selected
        setSelected(undefined)
        setTimeout(() => refs.current[key]?.focus(), 0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tour, selected, steps.length])
  // Auto: five seconds a step, paused while the pointer is on the map or the caption bar.
  useEffect(() => {
    if (tour === null || !auto || paused || tour >= steps.length) return
    const t = setTimeout(() => setTour((x) => (x === null ? x : Math.min(steps.length, x + 1))), THEME_MAP.motion.tourAutoMs)
    return () => clearTimeout(t)
  }, [tour, auto, paused, steps.length])

  const header = (
    <>
      <p>
        <Link to={studyPath(studyId, screenById.A3)} className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline" data-testid="back-to-report">
          ‹ Back to Report
        </Link>
      </p>
      <PageHeader
        id="A3"
        title="Theme map"
        description="Your approved themes as one picture. Size is how many people said it. Colour is how strong the reaction was. Click a theme to see the quotes."
        actions={
          ready && doc ? (
            <label className="flex items-center gap-2 text-sm text-graphite">
              Lens
              <select aria-label="Lens" data-testid="lens-select" defaultValue="whole" className={controlBase + ' h-9 pr-8 text-sm text-ink'}>
                <option value="whole">Whole study</option>
                <option disabled>Make a lens in Tools › Lens builder</option>
              </select>
            </label>
          ) : undefined
        }
      />
      <AnalysisStepper studyId={studyId} current="report" />
    </>
  )

  if (!study) return null
  if (!ready || !doc || (loaded && everyone.length === 0))
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="No accepted themes yet" description="The map is made of themes you approved, from sessions accepted in Review." action={<Button to={studyPath(CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>} />
        </div>
      </div>
    )
  if (failed)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface">
          <ErrorState title="The theme map didn’t load" description="Nothing was lost. Try again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )
  if (!loaded)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5" role="status">
          <LoadingState label={`Building the theme map from ${plural(accepted.length, 'accepted session')}`} rows={5} />
        </div>
      </div>
    )

  const select = (key: string) => setSelected(selected === key ? undefined : key)
  const dim = (key: string) => (selected && selected !== key) || (active && active !== key) || false
  const note = directionalNote(size)
  const summary = summaryOf(bubbles)
  const relatedTension = tension.find((t) => t.a === selected || t.b === selected)?.id
  const tip = hover ? bubbles.find((b) => b.key === hover) : undefined

  const map = (
    <section aria-label="Theme map" className="relative rounded-md border border-mist bg-surface p-4" data-testid="map-card">
      {size === 0 ? (
        <p data-testid="no-one" className="px-4 py-16 text-center text-sm text-graphite">No one in this segment.</p>
      ) : view === 'map' ? (
        <div className="relative">
          <svg viewBox={`0 0 ${THEME_MAP.viewBox.width} ${THEME_MAP.viewBox.height}`} className="block h-auto w-full" role="group" aria-label="Themes" data-testid="map-svg" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <defs>
              <pattern id="tm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill={THEME_MAP.hatched.fill} />
                <line x1="0" y1="0" x2="0" y2="8" stroke={THEME_MAP.hatched.stripe} strokeWidth="3" />
              </pattern>
            </defs>
            {tension.map((t) => {
              const a = at.get(t.a)
              const b = at.get(t.b)
              if (!a || !b) return null
              return (
                <g key={t.id} data-testid="tension-line" data-tension={t.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={THEME_MAP.ring.amber} strokeWidth={1.6} strokeDasharray="6 5" />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} onMouseEnter={() => setHover(`tension:${t.id}`)} onMouseLeave={() => setHover(undefined)}>
                    <title>{t.title}</title>
                  </line>
                </g>
              )
            })}
            {bubbles.map((b, i) => {
              const p = at.get(b.key)
              if (!p) return null
              const r = radiusOf(b.n, maxAll)
              const c = paint(b, mode)
              const fs = Math.max(11, Math.min(15, r / 4.2))
              const ls = lines(b.name, r, fs)
              const isSel = selected === b.key
              const isOn = active === b.key
              return (
                <g key={b.key} className="tm-bubble tm-motion" data-testid="bubble-g" style={{ opacity: dim(b.key) ? THEME_MAP.dimOpacity : 1 }}>
                  <g className="tm-settle" style={{ animationDelay: `${[...bubbles].sort((x, y) => y.n - x.n).findIndex((x) => x.key === b.key) * THEME_MAP.motion.staggerMs}ms` }}>
                    <circle className="tm-halo" cx={p.x} cy={p.y} r={isSel ? r + 9 : r} fill="var(--color-iris-50, #eef0ff)" stroke={isSel ? '#111' : 'none'} strokeWidth={2} opacity={isSel ? 1 : 0} />
                    <circle className="tm-fill" data-testid="bubble-fill" data-key={b.key} data-r={Math.round(r)} data-fill={c.fill} data-hatched={c.hatched} cx={p.x} cy={p.y} style={{ r }} fill={c.hatched ? 'url(#tm-hatch)' : c.fill} stroke={isOn ? '#111' : 'none'} strokeWidth={2.5} />
                    {b.ring !== 'none' && (
                      <circle className="tm-ring" data-testid="bubble-ring" data-ring={b.ring} cx={p.x} cy={p.y} style={{ r: r + 4 }} fill="none" stroke={b.ring === 'solid' ? THEME_MAP.ring.colour : THEME_MAP.ring.amber} strokeWidth={b.ring === 'solid' ? 1.5 : 2.5} strokeDasharray={b.ring === 'dashed' ? '8 5' : b.ring === 'dotted' ? '1 5' : undefined} strokeLinecap={b.ring === 'dotted' ? 'round' : undefined} />
                    )}
                    <text className="tm-text" x={p.x} y={p.y - ((ls.length - 1) * fs * 0.6) + fs * 0.3} textAnchor="middle" fontSize={fs} fontWeight={600} fill={c.text} pointerEvents="none">
                      {ls.map((l, k) => (
                        <tspan key={k} x={p.x} dy={k === 0 ? 0 : fs * 1.2}>{l}</tspan>
                      ))}
                    </text>
                  </g>
                  <foreignObject x={p.x - at.get(b.key)!.r} y={p.y - at.get(b.key)!.r} width={at.get(b.key)!.r * 2} height={at.get(b.key)!.r * 2}>
                    <button
                      type="button"
                      ref={(el) => { refs.current[b.key] = el }}
                      data-testid="bubble"
                      data-key={b.key}
                      data-n={b.n}
                      data-of={b.of}
                      data-band={b.notEnough ? 'not-enough' : b.band}
                      data-verdict={b.verdict}
                      data-order={i}
                      aria-pressed={isSel}
                      aria-label={accessibleName(b, seg)}
                      onClick={() => select(b.key)}
                      onMouseEnter={() => setHover(b.key)}
                      onMouseLeave={() => setHover(undefined)}
                      onFocus={() => setHover(b.key)}
                      onBlur={() => setHover(undefined)}
                      className="h-full w-full rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-600"
                    />
                  </foreignObject>
                </g>
              )
            })}
          </svg>
          {tip && at.get(tip.key) && (
            <div role="tooltip" data-testid="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-ink px-2 py-1 text-xs text-white" style={{ left: `${(at.get(tip.key)!.x / THEME_MAP.viewBox.width) * 100}%`, top: `${((at.get(tip.key)!.y - radiusOf(tip.n, maxAll) - 8) / THEME_MAP.viewBox.height) * 100}%` }}>
              {tip.name} · {tip.n} of {tip.of} {segmentNoun(seg)} · {bandWords(tip)} · {verdictWords(tip.verdict)}
            </div>
          )}
          {hover?.startsWith('tension:') && (
            <div role="tooltip" data-testid="tension-tip" className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-xs text-white">
              {tension.find((t) => `tension:${t.id}` === hover)?.title}
            </div>
          )}
        </div>
      ) : (
        <ol data-testid="list-view" className="flex flex-col">
          {[...bubbles].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((b) => (
            <li key={b.key} className="border-b border-mist last:border-b-0">
              <button type="button" data-testid="list-row" data-key={b.key} data-n={b.n} data-of={b.of} data-band={b.notEnough ? 'not-enough' : b.band} data-verdict={b.verdict} aria-pressed={selected === b.key} ref={(el) => { refs.current[b.key] = el }} onClick={() => select(b.key)} className={cn('grid w-full grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_8rem] items-center gap-3 px-2 py-2 text-left text-sm hover:bg-haze', selected === b.key && 'bg-iris-50')}>
                <span className="truncate font-medium">{b.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-haze" aria-hidden="true"><span className="block h-full rounded-full bg-ink" style={{ width: `${b.of ? (b.n / b.of) * 100 : 0}%` }} /></span>
                <span className="text-xs text-graphite tabular-nums">{b.n} of {b.of} {segmentNoun(seg)}</span>
                <span className="text-xs text-graphite">{b.notEnough ? 'Not enough read' : b.band}</span>
                <span className="text-xs text-graphite">{b.verdict}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )

  const legend = (
    <div className="flex flex-col gap-1 text-sm text-graphite" data-testid="legend">
      <p data-testid="size-legend">Bigger means more people said it.</p>
      <p data-testid="colour-legend">
        {mode === 'strength'
          ? 'Colour: how strong the delivery was among the people who could be read. Darker means stronger (High), then Medium, then Low. Hatched grey: not enough read.'
          : 'Colour: how words and delivery fit. Plain grey: consistent. Amber: conflicting. Light amber: mixed. Hatched grey: too few to read.'}
      </p>
      <p data-testid="ring-legend">Ring: solid for words and delivery matched, dashed amber for pulled apart, dotted for partly. No ring: too few to read.</p>
      <p data-testid="closeness-legend">Closer means more of the same people said both.</p>
      <p data-testid="map-note">Showing {plural(bubbles.length, 'theme')}.</p>
      {skipped > 0 && <p className="sr-only">{skipped} approved tension left no line.</p>}
    </div>
  )

  return (
    <div className="flex flex-col gap-5 tm-motion">
      {header}
      <p className="text-sm text-graphite" data-testid="built-on">
        <span className="font-medium text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
        {' · '}
        {excluded > 0 ? `${excluded} excluded left out` : 'none excluded'}
        {study.releaseVersion && <> · {study.releaseVersion}</>}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="toolbar">
        <Segmented label="Show" testid="segment" value={seg} options={SEGMENTS} onChange={setSeg} />
        <span className="flex items-center gap-2 text-sm text-graphite">
          Colour
          <Segmented label="Colour" testid="mode" value={mode} options={[['strength', 'Reaction strength'], ['verdict', 'Words vs delivery']]} onChange={setMode} />
        </span>
        <Segmented label="View" testid="view" value={view} options={[['map', 'Map'], ['list', 'List']]} onChange={setView} />
        <span className="flex-1" />
        <Button size="sm" data-testid="tour-start" onClick={() => { setTour(0); setSelected(undefined) }} disabled={tour !== null || view !== 'map' || steps.length === 0}>
          Walk me through it
        </Button>
      </div>

      {summary && (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="summary">
          <AIGeneratedTag />
          <span>{summary}</span>
        </p>
      )}
      {note && <p className="text-sm text-pending-fg" data-testid="directional">{note}</p>}

      <div className={cn('tm-cols grid items-start gap-5 lg:[grid-template-columns:minmax(0,1fr)_var(--panel)]')} style={{ ['--panel' as string]: open ? '400px' : '0px', gap: open ? undefined : 0 }}>
        <div className="flex min-w-0 flex-col gap-3">
          {map}
          {tour !== null && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-mist bg-paper px-4 py-3" data-testid="tour-bar" role="status" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              <p className="min-w-0 flex-1 text-sm" data-testid="tour-caption" data-step={tour}>
                {tourBubble ? tourCaption(tourBubble, seg) : TOUR_END}
              </p>
              <Button size="sm" data-testid="tour-prev" disabled={tour === 0} onClick={() => setTour(Math.max(0, tour - 1))}>Previous</Button>
              <Button size="sm" data-testid="tour-next" disabled={tour >= steps.length} onClick={() => setTour(Math.min(steps.length, tour + 1))}>Next</Button>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" data-testid="tour-auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto</label>
              <Button size="sm" data-testid="tour-stop" onClick={() => setTour(null)}>Stop</Button>
            </div>
          )}
          {legend}
        </div>
        {open && sel && (
          <aside aria-label="Quotes" className="min-w-0 overflow-hidden rounded-md border border-mist bg-surface p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" data-testid="panel-wrap">
            <Panel key={sel.key} studyId={studyId} doc={doc} basis={basis} bubble={sel} seg={seg} tensionId={relatedTension} onClose={() => select(sel.key)} />
          </aside>
        )}
      </div>
    </div>
  )
}
