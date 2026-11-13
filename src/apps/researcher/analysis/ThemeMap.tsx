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
import { accessibleName, bandWords, bubblesOf, directionalNote, peopleSets, segmentNoun, segmentSize, SEGMENTS, sharedLabel, sharing, summaryOf, tensionLines, tourCaption, tourEnd, tourOrder, verdictWords, type Bubble, type Segment } from '@/state/themeMap'
import { AnalysisStepper } from './AnalysisStepper'
import { Panel } from './thememap/Panel'
import { useAnalysis } from './useAnalysis'

const SEG = 'inline-flex overflow-hidden rounded-xs border border-mist'
const SEG_BTN = (on: boolean) => cn('px-2.5 py-1 text-sm font-medium', on ? 'bg-ink text-white' : 'bg-surface text-graphite hover:bg-haze')
const radiusOf = (n: number, max: number) => (max <= 0 ? THEME_MAP.radius.min : THEME_MAP.radius.min + (THEME_MAP.radius.max - THEME_MAP.radius.min) * (Math.sqrt(n) / Math.sqrt(max)))
/** A bubble's radius: people on a square-root scale of the largest real theme. "Not in a theme" is drawn smaller and never past the largest theme. */
const sizeOf = (b: Bubble, maxTheme: number) => {
  const r = radiusOf(b.n, maxTheme)
  return b.kind === 'none' ? Math.min(r * THEME_MAP.noneScale, radiusOf(maxTheme, maxTheme) * THEME_MAP.noneCap) : r
}

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

/** Wraps a name into at most two lines that fit a bubble, ending in an ellipsis if it can't. */
function lines(name: string, r: number, size: number): string[] {
  const per = Math.max(6, Math.floor((r * 1.7) / (size * 0.56)))
  const out: string[] = []
  let cur = ''
  for (const w of name.split(' ')) {
    if (cur && (cur + ' ' + w).length > per) (out.push(cur), (cur = w))
    else cur = cur ? `${cur} ${w}` : w
  }
  if (cur) out.push(cur)
  if (out.length <= 2) return out
  const first = out[0]
  const rest = out.slice(1).join(' ')
  return [first, rest.length > per ? `${rest.slice(0, per - 1)}…` : rest]
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
  const [tip, setTip] = useState<{ key: string; left: number; top: number }>()
  const [tour, setTour] = useState<number | null>(null)
  const [auto, setAuto] = useState(false)
  const [paused, setPaused] = useState(false)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const card = useRef<HTMLElement>(null)
  const excluded = review.filter((r) => r.status === 'Excluded').length

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(t)
  }, [studyId])

  const everyone = useMemo(() => (doc ? bubblesOf(doc, basis, 'all') : []), [doc, basis])
  const bubbles = useMemo(() => (doc ? bubblesOf(doc, basis, seg) : []), [doc, basis, seg])
  const size = doc ? segmentSize(basis, seg) : 0
  const maxTheme = Math.max(1, ...everyone.filter((b) => b.kind === 'theme').map((b) => b.n))
  const radius = (b: Bubble) => sizeOf(b, maxTheme)
  // Positions come from the Everyone view, so a segment change resizes and recolours bubbles without moving any of them. Each bubble is
  // laid out with its ring, so the gap between outer rings is the full gap. "Not in a theme" goes toward the edge.
  const placed = useMemo(() => {
    const sets = peopleSets(everyone)
    return layoutBubbles(
      everyone.map((b) => ({ key: b.key, r: sizeOf(b, maxTheme) + (b.kind === 'none' ? 2 : THEME_MAP.ringOutset) })),
      (a, b) => overlapOf(sets.get(a) ?? new Set(), sets.get(b) ?? new Set()),
      THEME_MAP.viewBox.width,
      THEME_MAP.viewBox.height,
      `${studyId}|themes`,
      THEME_MAP.gap,
      everyone.some((b) => b.kind === 'none') ? 'none' : undefined,
    )
  }, [everyone, studyId, maxTheme])
  const at = new Map(placed.map((p) => [p.key, p]))
  const { lines: tension, skipped } = useMemo(() => (doc ? tensionLines(doc, basis, everyone) : { lines: [], skipped: 0 }), [doc, basis, everyone])
  const steps = useMemo(() => tourOrder(bubbles), [bubbles])
  const tourBubble = tour !== null && tour < steps.length ? steps[tour] : undefined
  const sel = bubbles.find((b) => b.key === selected)
  const open = !!sel
  // Dimming is for hover and the tour only. With the panel open nothing is dimmed: the selected bubble just has its outline.
  const dimming = hover && !hover.startsWith('tension:') ? hover : tourBubble?.key
  // Lines to the themes that share people with the bubble pointed at, or the selected one.
  const lineFrom = bubbles.find((b) => b.key === (hover && !hover.startsWith('tension:') ? hover : selected))

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
  const note = directionalNote(size)
  const summary = summaryOf(bubbles)
  const relatedTension = tension.find((t) => t.a === selected || t.b === selected)?.id
  const tipBubble = tip ? bubbles.find((b) => b.key === tip.key) : undefined
  const noun = segmentNoun(seg)
  /** Where a tooltip goes: above the bubble's button, measured, so it is right whatever the card's size. */
  const showTip = (key: string, el: HTMLElement) => {
    setHover(key)
    const c = card.current?.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (c) setTip({ key, left: r.left - c.left + r.width / 2, top: r.top - c.top })
  }
  const clearTip = () => {
    setHover(undefined)
    setTip(undefined)
  }
  const mapCard = (
    <section ref={card} aria-label="Theme map" className="relative rounded-md border border-mist bg-surface p-3" style={{ height: '70vh', minHeight: 360 }} data-testid="map-card">
      {size === 0 ? (
        <p data-testid="no-one" className="px-4 py-16 text-center text-sm text-graphite">No one in this segment.</p>
      ) : view === 'map' ? (
        <>
          <svg viewBox={`0 0 ${THEME_MAP.viewBox.width} ${THEME_MAP.viewBox.height}`} className="block h-full w-full" role="group" aria-label="Themes" data-testid="map-svg" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <defs>
              <pattern id="tm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill={THEME_MAP.hatched.fill} />
                <line x1="0" y1="0" x2="0" y2="8" stroke={THEME_MAP.hatched.stripe} strokeWidth="3" />
              </pattern>
            </defs>

            {/* Who is in both: thin lines from the bubble pointed at or selected, each with its shared count. */}
            {lineFrom &&
              sharing(lineFrom, bubbles).map(({ other, shared }) => {
                const a = at.get(lineFrom.key)
                const b = at.get(other.key)
                if (!a || !b) return null
                const mx = (a.x + b.x) / 2
                const my = (a.y + b.y) / 2
                return (
                  <g key={other.key} data-testid="share-line" data-shared={shared} data-from={lineFrom.key} data-to={other.key} pointerEvents="none">
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6b7280" strokeWidth={1} />
                    <text x={mx} y={my} textAnchor="middle" fontSize={12} fill="#1b1d22" stroke="#fff" strokeWidth={4} paintOrder="stroke" data-testid="share-label">{sharedLabel(shared)}</text>
                  </g>
                )
              })}

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
              const r = radius(b)
              const ev = everyone.find((x) => x.key === b.key)
              const evR = ev ? sizeOf(ev, maxTheme) : r
              const c = paint(b, mode)
              const isNone = b.kind === 'none'
              const fs = Math.max(11, Math.min(15, r / 4.2))
              const nameLines = lines(b.name, r, fs)
              const showNumber = !isNone && r >= THEME_MAP.minRadiusForNumber
              const numberLines = !showNumber ? [] : seg !== 'all' && r >= 52 ? [`${b.n} of ${b.of}`, noun] : [`${b.n} of ${b.of}`]
              const total = nameLines.length + numberLines.length * 0.85
              const top = p.y - (total * fs * 1.2) / 2 + fs * 0.95
              const isSel = selected === b.key
              const isOn = hover === b.key || tourBubble?.key === b.key
              const rank = [...bubbles].sort((x, y) => y.n - x.n).findIndex((x) => x.key === b.key)
              return (
                <g key={b.key} className="tm-bubble tm-motion" data-testid="bubble-g" style={{ opacity: dimming && dimming !== b.key ? THEME_MAP.dimOpacity : 1 }}>
                  <g className="tm-settle" style={{ animationDelay: `${rank * THEME_MAP.motion.staggerMs}ms` }}>
                    {seg !== 'all' && (
                      <circle data-testid="ghost" data-key={b.key} data-r={Math.round(evR)} cx={p.x} cy={p.y} r={evR} fill="none" stroke="#9aa1ad" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} pointerEvents="none" />
                    )}
                    <circle className="tm-halo" cx={p.x} cy={p.y} r={isSel ? r + 9 : r} fill="var(--color-iris-50, #eef0ff)" stroke={isSel ? '#111' : 'none'} strokeWidth={2} opacity={isSel ? 1 : 0} />
                    <circle className="tm-fill" data-testid="bubble-fill" data-key={b.key} data-r={Math.round(r)} data-fill={c.fill} data-hatched={c.hatched} cx={p.x} cy={p.y} style={{ r }} fill={c.hatched ? 'url(#tm-hatch)' : c.fill} stroke={isOn ? '#111' : isNone ? '#6b7280' : 'none'} strokeWidth={isOn ? 2.5 : 1} strokeDasharray={isNone && !isOn ? '5 4' : undefined} />
                    {b.ring !== 'none' && !isNone && (
                      <circle className="tm-ring" data-testid="bubble-ring" data-ring={b.ring} cx={p.x} cy={p.y} style={{ r: r + 4 }} fill="none" stroke={b.ring === 'solid' ? THEME_MAP.ring.colour : THEME_MAP.ring.amber} strokeWidth={b.ring === 'solid' ? 1.5 : 2.5} strokeDasharray={b.ring === 'dashed' ? '8 5' : b.ring === 'dotted' ? '1 5' : undefined} strokeLinecap={b.ring === 'dotted' ? 'round' : undefined} />
                    )}
                    <text className="tm-text" textAnchor="middle" fill={c.text} pointerEvents="none" data-testid="bubble-text">
                      {nameLines.map((l, k) => (
                        <tspan key={k} x={p.x} y={top + k * fs * 1.2} fontSize={fs} fontWeight={600}>{l}</tspan>
                      ))}
                      {numberLines.map((l, k) => (
                        <tspan key={`n${k}`} x={p.x} y={top + nameLines.length * fs * 1.2 + k * fs * 1.05} fontSize={Math.max(10, fs * 0.85)} fontWeight={500} data-testid="bubble-number">{l}</tspan>
                      ))}
                    </text>
                  </g>
                  <foreignObject x={p.x - p.r} y={p.y - p.r} width={p.r * 2} height={p.r * 2}>
                    <button
                      type="button"
                      ref={(el) => { refs.current[b.key] = el }}
                      data-testid="bubble"
                      data-key={b.key}
                      data-n={b.n}
                      data-of={b.of}
                      data-band={isNone ? 'not-grouped' : b.notEnough ? 'not-enough' : b.band}
                      data-verdict={b.verdict}
                      data-order={i}
                      aria-pressed={isSel}
                      aria-label={accessibleName(b, seg)}
                      onClick={() => select(b.key)}
                      onMouseEnter={(e) => showTip(b.key, e.currentTarget)}
                      onMouseLeave={clearTip}
                      onFocus={(e) => showTip(b.key, e.currentTarget)}
                      onBlur={clearTip}
                      className="h-full w-full rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-600"
                    />
                  </foreignObject>
                  {isNone && (
                    <foreignObject x={Math.min(THEME_MAP.viewBox.width - 244, Math.max(4, p.x - 120))} y={p.y > THEME_MAP.viewBox.height / 2 ? p.y - r - 52 : p.y + r + 8} width={240} height={44}>
                      <div className="text-center text-[11px] leading-tight text-graphite" data-testid="none-caption">
                        <p>{b.n} of {b.of} {seg === 'all' ? '' : `${noun} `}said something not grouped yet</p>
                        <Link to={studyPath(studyId, screenById.A1)} className="font-medium text-iris-700 underline-offset-2 hover:underline" data-testid="group-link">Group these in the codebook</Link>
                      </div>
                    </foreignObject>
                  )}
                </g>
              )
            })}
          </svg>
          {tip && tipBubble && (
            <div role="tooltip" data-testid="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-ink px-2 py-1 text-xs text-white" style={{ left: tip.left, top: tip.top - 6 }}>
              {tipBubble.name} · {tipBubble.n} of {tipBubble.of} {noun}{tipBubble.kind === 'none' ? ' · not grouped yet' : ` · ${bandWords(tipBubble)} · ${verdictWords(tipBubble.verdict)}`}
            </div>
          )}
          {hover?.startsWith('tension:') && (
            <div role="tooltip" data-testid="tension-tip" className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-xs text-white">
              {tension.find((t) => `tension:${t.id}` === hover)?.title}
            </div>
          )}
        </>
      ) : (
        <div className="h-full overflow-y-auto">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_9rem] items-center gap-3 border-b border-mist px-2 py-2 text-xs font-medium text-graphite" data-testid="list-header">
            <span>Theme</span>
            <span aria-hidden="true" />
            <span>People</span>
            <span>Reaction strength</span>
            <span>Words vs delivery</span>
          </div>
          <ol data-testid="list-view" className="flex flex-col">
            {[...bubbles].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((b) => (
              <li key={b.key} className="border-b border-mist last:border-b-0">
                <button type="button" data-testid="list-row" data-key={b.key} data-n={b.n} data-of={b.of} data-band={b.kind === 'none' ? 'not-grouped' : b.notEnough ? 'not-enough' : b.band} data-verdict={b.verdict} aria-pressed={selected === b.key} ref={(el) => { refs.current[b.key] = el }} onClick={() => select(b.key)} className={cn('grid w-full grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_9rem] items-center gap-3 px-2 py-2 text-left text-sm hover:bg-haze', selected === b.key && 'bg-iris-50')}>
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-haze" aria-hidden="true"><span className="block h-full rounded-full bg-ink" style={{ width: `${b.of ? (b.n / b.of) * 100 : 0}%` }} /></span>
                  <span className="text-xs text-graphite tabular-nums">{b.n} of {b.of} {noun}</span>
                  <span className="text-xs text-graphite">{b.kind === 'none' ? 'Not grouped' : b.notEnough ? 'Not enough read' : b.band}</span>
                  <span>{b.kind === 'none' ? <span className="text-xs text-graphite">Not compared</span> : <span className="rounded-xs border border-mist-strong px-1.5 py-0.5 text-xs" data-testid="verdict-chip">{b.verdict}</span>}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )

  // One compact row: size, the colour steps (or the verdict colours), the ring styles, and what closeness means.
  const sw = (fill: string, label: string, hatched = false) => (
    <li key={label} className="inline-flex items-center gap-1.5" data-testid="legend-item">
      <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border border-mist-strong" style={hatched ? { background: `repeating-linear-gradient(45deg, ${THEME_MAP.hatched.fill} 0 2px, ${THEME_MAP.hatched.stripe} 2px 4px)` } : { background: fill }} />
      {label}
    </li>
  )
  const ringSw = (kind: 'solid' | 'dashed' | 'dotted', label: string) => (
    <li key={label} className="inline-flex items-center gap-1.5" data-testid="legend-item">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke={kind === 'solid' ? THEME_MAP.ring.colour : THEME_MAP.ring.amber} strokeWidth={kind === 'solid' ? 1.2 : 1.8} strokeDasharray={kind === 'dashed' ? '3 2' : kind === 'dotted' ? '0.5 2.6' : undefined} strokeLinecap={kind === 'dotted' ? 'round' : undefined} /></svg>
      {label}
    </li>
  )
  const legend = (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-graphite" data-testid="legend">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="legend-row">
        <li className="inline-flex items-center gap-1.5" data-testid="legend-item">
          <span aria-hidden="true" className="inline-flex items-end gap-0.5"><span className="inline-block h-2 w-2 rounded-full border border-graphite" /><span className="inline-block h-3.5 w-3.5 rounded-full border border-graphite" /></span>
          Size: people
        </li>
        {mode === 'strength'
          ? [sw(THEME_MAP.strengthFill.Low.fill, 'Low'), sw(THEME_MAP.strengthFill.Medium.fill, 'Medium'), sw(THEME_MAP.strengthFill.High.fill, 'High'), sw('', 'Not enough read', true)]
          : [sw(THEME_MAP.verdictFill.Consistent.fill, 'Consistent'), sw(THEME_MAP.verdictFill.Mixed.fill, 'Mixed'), sw(THEME_MAP.verdictFill.Conflicting.fill, 'Conflicting'), sw('', 'Too few', true)]}
        {ringSw('solid', 'Matched')}
        {ringSw('dotted', 'Partly')}
        {ringSw('dashed', 'Pulled apart')}
        <li data-testid="map-note">{plural(bubbles.filter((b) => b.kind === 'theme').length, 'theme')} shown</li>
      </ul>
      <p data-testid="closeness-legend">Closer means more of the same people said both.</p>
      {skipped > 0 && <span className="sr-only">{skipped} approved tension left no line.</span>}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 tm-motion">
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
      {seg !== 'all' && (
        <p className="text-sm text-graphite" data-testid="segment-line">
          Showing {noun}, {plural(size, 'person', 'people')}.
        </p>
      )}

      {summary && (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="summary">
          <AIGeneratedTag />
          <span>{summary}</span>
        </p>
      )}
      {note && <p className="text-sm text-pending-fg" data-testid="directional">{note}</p>}

      <div className={cn('tm-cols grid items-start gap-5 lg:[grid-template-columns:minmax(0,1fr)_var(--panel)]')} style={{ ['--panel' as string]: open ? '400px' : '0px', gap: open ? undefined : 0 }}>
        <div className="flex min-w-0 flex-col gap-3">
          {mapCard}
          {tour !== null && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-mist bg-paper px-4 py-3" data-testid="tour-bar" role="status" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              <p className="min-w-0 flex-1 text-sm" data-testid="tour-caption" data-step={tour}>
                {tourBubble ? tourCaption(tourBubble, seg) : tourEnd(bubbles, seg)}
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
