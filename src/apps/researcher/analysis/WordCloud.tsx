import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../shared/PageHeader'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Switch } from '@/components/Switch'
import { WORDCLOUD, type Band } from '@/config/wordcloud'
import { layoutCloud } from '@/lib/cloudLayout'
import { currentUser } from '@/mock/people'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY, codeThemes } from '@/state/codebook'
import { plural } from '@/state/reportLogic'
import { allWords, appliedEdits, currentEdits, ensureCloud, pendingChanges, regenerateCloud, removalKey, shownWords, useWordCloud, wordDefs, type Kind, type Word } from '@/state/wordcloud'
import { AnalysisStepper } from './AnalysisStepper'
import { Panel } from './wordcloud/Panel'
import { useAnalysis } from './useAnalysis'

const SEG = 'inline-flex overflow-hidden rounded-xs border border-mist'
const SEG_BTN = (on: boolean) => cn('px-2.5 py-1 text-sm font-medium', on ? 'bg-ink text-white' : 'bg-surface text-graphite hover:bg-haze')
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

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

/** A3, Word cloud. A display layer over the codebook: the words are the accepted themes or codes, sized by how many people said them. */
export function WordCloudPage() {
  const { studyId, study, review, doc, basis, accepted, ready } = useAnalysis()
  const cloud = useWordCloud(studyId)
  const [params] = useSearchParams()
  const me = currentUser.name
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [kind, setKind] = useState<Kind>('theme')
  const [view, setView] = useState<'cloud' | 'list'>('cloud')
  const [colourBy, setColourBy] = useState<'confidence' | 'theme'>('confidence')
  const [min, setMin] = useState<number>(WORDCLOUD.minPeople)
  const [leadership, setLeadership] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [hover, setHover] = useState<string>()
  // Ignores are view-only: held here, never saved, gone when the Researcher leaves.
  const [ignored, setIgnored] = useState<Set<string>>(new Set())
  const [appliedIgnored, setAppliedIgnored] = useState<Set<string>>(new Set())
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const excluded = review.filter((r) => r.status === 'Excluded').length

  useEffect(() => {
    if (ready) ensureCloud(studyId)
  }, [ready, studyId])
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(t)
  }, [studyId])
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const key = selected
      setSelected(undefined)
      setTimeout(() => refs.current[key]?.focus(), 0)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  const themeOrder = useMemo(() => (doc ? codeThemes(doc).map((t) => t.id) : []), [doc])
  const colourOf = (w: Word) => {
    if (colourBy === 'confidence') return WORDCLOUD.confidenceColour[w.band]
    return w.theme ? WORDCLOUD.themePalette[themeOrder.indexOf(w.theme.id) % WORDCLOUD.themePalette.length] : WORDCLOUD.notInTheme
  }

  // What the cloud shows is the last Regenerate. The leadership preview never includes ignores or anything not yet applied.
  const applied = useMemo(() => (cloud ? appliedEdits(cloud, leadership ? new Set() : appliedIgnored) : undefined), [cloud, appliedIgnored, leadership])
  const live = useMemo(() => (cloud ? (leadership ? appliedEdits(cloud) : currentEdits(cloud, ignored)) : undefined), [cloud, ignored, leadership])
  const all = useMemo(() => (doc && applied ? allWords(doc, basis, kind, applied) : []), [doc, basis, kind, applied])
  const counts = useMemo(() => (doc && applied ? shownWords(all, min, doc, basis, kind, applied) : { shown: [], belowMin: 0, beyondCap: 0 }), [all, min, doc, basis, kind, applied])
  // The layout is made from every word, not just those over the minimum, so the minimum never moves a word.
  const placed = useMemo(() => {
    if (!all.length) return []
    const ns = all.map((w) => w.n)
    const lo = Math.min(...ns)
    const hi = Math.max(...ns)
    const size = (n: number) => (hi === lo ? (WORDCLOUD.font.min + WORDCLOUD.font.max) / 2 : WORDCLOUD.font.min + (WORDCLOUD.font.max - WORDCLOUD.font.min) * ((Math.sqrt(n) - Math.sqrt(lo)) / (Math.sqrt(hi) - Math.sqrt(lo))))
    return layoutCloud(all.map((w) => ({ key: w.key, text: w.name, size: Math.round(size(w.n)) })), WORDCLOUD.viewBox.width, WORDCLOUD.viewBox.height, `${studyId}|${kind}|${all.map((w) => w.key).join(',')}`)
  }, [all, studyId, kind])

  const header = (
    <>
      <p>
        <Link to={studyPath(studyId, screenById.A3)} className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline" data-testid="back-to-report">
          ‹ Back to Report
        </Link>
      </p>
      <PageHeader
        id="A3"
        title="Word cloud"
        description="The codes and themes you approved, sized by how many people said them. Click a word to see the exact statements."
        actions={
          ready && doc ? (
            <>
              <label className="flex items-center gap-2 text-sm text-graphite">
                Lens
                <select aria-label="Lens" data-testid="lens-select" defaultValue="whole" className={controlBase + ' h-9 pr-8 text-sm text-ink'}>
                  <option value="whole">Whole study</option>
                  <option disabled>Make a lens in Tools › Lens builder</option>
                </select>
              </label>
              <span className="flex items-center gap-2 text-sm">
                <Switch checked={leadership} label="Preview as leadership" onChange={setLeadership} />
                Preview as leadership
              </span>
            </>
          ) : undefined
        }
      />
      <AnalysisStepper studyId={studyId} current="report" />
    </>
  )

  if (!study) return null
  if (!ready || !doc)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="No accepted themes yet" description="Words come only from codes and themes you accepted, in sessions accepted in Review." action={<Button to={studyPath(CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>} />
        </div>
      </div>
    )
  if (failed)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface">
          <ErrorState title="The word cloud didn’t load" description="Nothing was lost. Try again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )
  if (!loaded || !cloud || !applied || !live)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5" role="status">
          <LoadingState label={`Building the word cloud from ${plural(accepted.length, 'accepted session')}`} rows={5} />
        </div>
      </div>
    )

  const pending = pendingChanges(cloud, ignored, appliedIgnored)
  const shownKeys = new Set(counts.shown.map((w) => w.key))
  const byKey = new Map(all.map((w) => [w.key, w]))
  const lookup = new Map(placed.map((p) => [p.key, p]))
  const defOf = (key: string) => wordDefs(doc, kind).find((d) => d.key === key)
  const selDef = selected ? defOf(selected) : undefined
  const open = !!selDef
  const rank = [...counts.shown].sort((a, b) => b.n - a.n)
  const bigThird = new Set(rank.slice(0, Math.ceil(rank.length / 3)).map((w) => w.key))
  const ns = counts.shown.map((w) => w.n)
  const select = (key: string) => setSelected(selected === key ? undefined : key)
  const pendingHere = (key: string) => {
    const prefix = `${key}|`
    const nowR = new Set(cloud.removed.filter((r) => r.wordKey === key).map((r) => removalKey(r.wordKey, r.excerptId)))
    const wasR = new Set(cloud.applied.removed.filter((k) => k.startsWith(prefix)))
    const nowA = new Set(cloud.added.filter((a) => a.wordKey === key).map((a) => a.id))
    const wasA = new Set(cloud.applied.added.filter((id) => cloud.added.find((a) => a.id === id)?.wordKey === key))
    const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
    const ig = (set: Set<string>) => new Set([...set].filter((k) => k.startsWith(prefix)))
    return !same(nowR, wasR) || !same(nowA, wasA) || !same(ig(ignored), ig(appliedIgnored))
  }

  const legend = (
    <div className="flex flex-col gap-1.5 text-sm text-graphite" data-testid="legend">
      <p data-testid="size-legend">
        Bigger means more people said it.{ns.length ? ` Smallest: ${Math.min(...ns)} of ${counts.shown[0].of} · largest: ${Math.max(...ns)} of ${counts.shown[0].of}.` : ''}
      </p>
      {colourBy === 'confidence' ? (
        <p className="flex flex-wrap items-center gap-4" data-testid="colour-legend">
          {(['High', 'Medium', 'Low'] as Band[]).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: WORDCLOUD.confidenceColour[b] }} />
              <span className={b === 'Low' ? 'underline decoration-dashed underline-offset-4' : undefined}>{b === 'High' ? 'High confidence' : b}</span>
            </span>
          ))}
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-4" data-testid="colour-legend">
          {[...new Set(counts.shown.map((w) => w.theme?.id ?? ''))].map((id) => {
            const w = counts.shown.find((x) => (x.theme?.id ?? '') === id)!
            return (
              <span key={id || 'none'} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: colourOf(w) }} />
                {w.theme?.name ?? 'Not in a theme'}
              </span>
            )
          })}
        </p>
      )}
    </div>
  )

  const note =
    counts.shown.length === 0 ? null : (
      <p className="text-sm text-graphite" data-testid="cloud-note">
        Showing {counts.shown.length} {counts.shown.length === 1 ? 'word' : 'words'}.
        {counts.belowMin > 0 && ` ${counts.belowMin} said by fewer than ${min} ${min === 1 ? 'person' : 'people'} ${counts.belowMin === 1 ? 'is' : 'are'} hidden.`}
        {counts.beyondCap > 0 && ` ${counts.beyondCap} more are beyond the limit of ${WORDCLOUD.maxWords}.`}
      </p>
    )

  const cloudCard = (
    <section aria-label="Word cloud" className="relative rounded-md border border-mist bg-surface p-4" data-testid="cloud-card">
      {counts.shown.length === 0 ? (
        <div data-testid="below-min" className="px-4 py-16 text-center text-sm text-graphite">
          Everything is below the minimum of {min} {min === 1 ? 'person' : 'people'}. Lower the minimum to see words.
        </div>
      ) : view === 'cloud' ? (
        <div className="relative">
          <svg viewBox={`0 0 ${WORDCLOUD.viewBox.width} ${WORDCLOUD.viewBox.height}`} className="block h-auto w-full" role="group" aria-label="Words" data-testid="cloud-svg">
            {placed.filter((p) => shownKeys.has(p.key)).map((p) => {
              const w = byKey.get(p.key)!
              const isSel = selected === w.key
              return (
                <foreignObject key={p.key} x={p.x - p.w / 2} y={p.y - p.h / 2} width={p.w} height={p.h} data-testid="word-slot" data-key={p.key} data-x={Math.round(p.x)} data-y={Math.round(p.y)}>
                  <button
                    type="button"
                    ref={(el) => { refs.current[w.key] = el }}
                    data-testid="word"
                    data-key={w.key}
                    data-n={w.n}
                    data-band={w.band}
                    aria-pressed={isSel}
                    aria-label={`${w.name}, ${w.n} of ${w.of} people, ${w.band} confidence`}
                    onClick={() => select(w.key)}
                    onMouseEnter={() => setHover(w.key)}
                    onMouseLeave={() => setHover(undefined)}
                    onFocus={() => setHover(w.key)}
                    onBlur={() => setHover(undefined)}
                    className={cn('flex h-full w-full items-center justify-center whitespace-nowrap rounded-sm leading-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-iris-600', isSel && 'bg-iris-50 outline-2 outline-ink')}
                    style={{
                      fontSize: p.size,
                      fontWeight: bigThird.has(w.key) ? 600 : 500,
                      color: colourOf(w),
                      textDecoration: w.band === 'Low' && colourBy === 'confidence' ? 'underline dashed' : undefined,
                      textUnderlineOffset: 5,
                    }}
                  >
                    {w.name}
                  </button>
                </foreignObject>
              )
            })}
          </svg>
          {hover && lookup.get(hover) && byKey.get(hover) && shownKeys.has(hover) && (
            <div role="tooltip" data-testid="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-ink px-2 py-1 text-xs text-white" style={{ left: `${(lookup.get(hover)!.x / WORDCLOUD.viewBox.width) * 100}%`, top: `${((lookup.get(hover)!.y - lookup.get(hover)!.h / 2) / WORDCLOUD.viewBox.height) * 100}%` }}>
              {byKey.get(hover)!.name} · {byKey.get(hover)!.n} of {byKey.get(hover)!.of} people · {byKey.get(hover)!.band} confidence
            </div>
          )}
        </div>
      ) : (
        <ol data-testid="list-view" className="flex flex-col">
          {[...counts.shown].map((w) => (
            <li key={w.key} className="border-b border-mist last:border-b-0">
              <button type="button" data-testid="list-row" data-key={w.key} data-n={w.n} data-band={w.band} aria-pressed={selected === w.key} ref={(el) => { refs.current[w.key] = el }} onClick={() => select(w.key)} className={cn('grid w-full grid-cols-[minmax(0,1fr)_8rem_8rem_6rem] items-center gap-3 px-2 py-2 text-left text-sm hover:bg-haze', selected === w.key && 'bg-iris-50')}>
                <span className="truncate font-medium" style={{ color: colourOf(w) }}>{w.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-haze" aria-hidden="true"><span className="block h-full rounded-full bg-ink" style={{ width: `${w.of ? (w.n / w.of) * 100 : 0}%` }} /></span>
                <span className="text-xs text-graphite tabular-nums">{w.n} of {w.of} people</span>
                <span className="text-xs text-graphite">{w.band}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )

  return (
    <div className="flex flex-col gap-5">
      {header}
      <p className="text-sm text-graphite" data-testid="built-on">
        <span className="font-medium text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
        {' · '}
        {excluded > 0 ? `${excluded} excluded left out` : 'none excluded'}
        {study.releaseVersion && <> · {study.releaseVersion}</>}
      </p>
      {leadership && (
        <p className="rounded-sm bg-haze px-3 py-1.5 text-sm text-graphite" data-testid="leadership-banner">
          Leadership preview. Read only.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="toolbar">
        <Segmented label="Words are" testid="kind" value={kind} options={[['theme', 'Themes'], ['code', 'Codes']]} onChange={(k) => { setKind(k); setSelected(undefined) }} />
        <Segmented label="View" testid="view" value={view} options={[['cloud', 'Cloud'], ['list', 'List']]} onChange={setView} />
        <Segmented label="Colour by" testid="colour" value={colourBy} options={[['confidence', 'Confidence'], ['theme', 'Theme']]} onChange={setColourBy} />
        {!leadership && (
          <span className="flex items-center gap-1.5 text-sm" role="group" aria-label="Minimum people">
          Minimum people
          <button type="button" aria-label="Fewer" data-testid="min-down" disabled={min <= WORDCLOUD.minPeopleRange[0]} onClick={() => setMin((m) => m - 1)} className="rounded-xs border border-mist px-2 py-0.5 hover:bg-haze disabled:opacity-40">−</button>
          <span className="w-4 text-center tabular-nums" data-testid="min-value">{min}</span>
          <button type="button" aria-label="More" data-testid="min-up" disabled={min >= WORDCLOUD.minPeopleRange[1]} onClick={() => setMin((m) => m + 1)} className="rounded-xs border border-mist px-2 py-0.5 hover:bg-haze disabled:opacity-40">+</button>
        </span>
        )}
        {!leadership && ignored.size + appliedIgnored.size > 0 && (
          <button type="button" className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline" data-testid="reset-view" onClick={() => { setIgnored(new Set()); setAppliedIgnored(new Set()) }}>
            Reset view
          </button>
        )}
        <span className="flex-1" />
        {!leadership && (
          <>
            {pending > 0 && (
              <span className="rounded-xs border border-pending-line bg-pending-bg px-2 py-0.5 text-xs font-medium text-pending-fg" data-testid="pending-chip">
                {pending} {pending === 1 ? 'change' : 'changes'} not applied
              </span>
            )}
            <Button size="sm" data-testid="regenerate" disabled={pending === 0} onClick={() => { regenerateCloud(studyId, me); setAppliedIgnored(new Set(ignored)) }}>
              Regenerate
            </Button>
            <span className="text-xs text-graphite tabular-nums" data-testid="updated">Updated {hhmm(cloud.regeneratedAt)}</span>
          </>
        )}
      </div>

      <div className={cn('grid items-start gap-5', open && 'lg:grid-cols-[minmax(0,1fr)_400px]')}>
        <div className="flex min-w-0 flex-col gap-3">
          {cloudCard}
          {note}
          {legend}
        </div>
        {open && selDef && (
          <aside aria-label="Statements" className="rounded-md border border-mist bg-surface p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" data-testid="panel-wrap">
            <Panel
              key={selDef.key}
              studyId={studyId}
              me={me}
              doc={doc}
              basis={basis}
              def={selDef}
              cloud={cloud}
              edits={live}
              leadership={leadership}
              inCloud={shownKeys.has(selDef.key)}
              pendingHere={pendingHere(selDef.key)}
              ignoredIds={ignored}
              onIgnore={(id) => setIgnored(new Set([...ignored, removalKey(selDef.key, id)]))}
              onUndoIgnore={(id) => setIgnored(new Set([...ignored].filter((k) => k !== removalKey(selDef.key, id))))}
              onClose={() => select(selDef.key)}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
