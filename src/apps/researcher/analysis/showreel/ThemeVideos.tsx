import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { SideDrawer } from '@/components/SideDrawer'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { BRIEF_RANGE, clipLength, MAX_CLIPS, MIN_CLIPS, rank, scoreOf, summaryOf, type Clip, type Stimulus, type Strength } from '@/mock/showreel'
import { screenById, studyPath } from '@/routes/screens'
import { mmss, plural } from '@/state/reportLogic'
import {
  addClip,
  cantDelete,
  cantRegenerate,
  clipsOfVersion,
  defaultOf,
  deleteVersion,
  firstVersion,
  moveClip,
  newVersion,
  removeClip,
  replaceClip,
  setCaptions,
  setDefault,
  totalSeconds,
  updateShowreel,
  versionsOf,
  MAX_VERSIONS,
  type ShowreelDoc,
} from '@/state/showreel'
import type { CodebookDoc, Basis } from '@/state/codebook'
import { EmbedBox, ExportMenu, PrintStoryboard, useMockExport } from './Export'
import { ReelPlayer, type Item } from './ReelPlayer'

export type ThemeData = { id: string; name: string; n: number; of: number; clips: Clip[]; byId: Map<string, Clip> }

const TAG = 'rounded-xs border border-mist-strong px-1.5 py-0.5 text-xs text-graphite'
const LINK = 'text-sm text-graphite underline-offset-2 hover:text-ink hover:underline'
const SEG = 'rounded-xs border border-mist-strong bg-surface px-2.5 py-1 text-sm hover:bg-haze disabled:opacity-50'

export const lengthLine = (seconds: number) => seconds < BRIEF_RANGE.min || seconds > BRIEF_RANGE.max

/** Why a theme can't be exported, or undefined: it needs enough clips and a Default version with clips in it. */
export function exportReason(d: ShowreelDoc, t: ThemeData): string | undefined {
  if (t.clips.length < MIN_CLIPS) return 'Not enough clips yet.'
  const v = defaultOf(d, t.id)
  if (!v) return 'Set a default version first.'
  if (!clipsOfVersion(v, t.byId).length) return 'The default version has no clips.'
  return undefined
}

export function ThemeVideos({ studyId, doc, basis, show, themes, selectedId, onSelect }: { studyId: string; doc: CodebookDoc; basis: Basis; show: ShowreelDoc; themes: ThemeData[]; selectedId: string; onSelect: (id: string) => void }) {
  const toast = useToast()
  const mock = useMockExport()
  const t = themes.find((x) => x.id === selectedId) ?? themes[0]
  const [versionId, setVersionId] = useState<string>()
  const [picker, setPicker] = useState<{ replace?: string } | null>(null)
  const [preview, setPreview] = useState<Clip | null>(null)
  const [regen, setRegen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [embed, setEmbed] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  const versions = t ? versionsOf(show, t.id) : []
  const version = versions.find((v) => v.id === versionId) ?? versions.find((v) => v.id === show.themes[t?.id ?? '']?.defaultId) ?? versions[0]
  // The first version of a theme is made the first time it is opened.
  useEffect(() => {
    if (t && !versions.length && t.clips.length >= MIN_CLIPS) updateShowreel(studyId, (d) => firstVersion(d, t.id, t.clips))
  }, [t, versions.length, studyId])
  useEffect(() => {
    setPreview(null)
    setPicker(null)
    setRegen(false)
    setEmbed(null)
  }, [selectedId])
  useEffect(() => {
    if (version && versionId !== version.id) setVersionId(version.id)
  }, [version, versionId])

  const chosen = useMemo(() => (t ? clipsOfVersion(version, t.byId) : []), [t, version])
  const seconds = totalSeconds(chosen)
  const isDefault = !!version && show.themes[t.id]?.defaultId === version.id
  const dflt = t ? defaultOf(show, t.id) : undefined
  const edit = (fn: (d: ShowreelDoc) => ShowreelDoc) => updateShowreel(studyId, fn)

  const items: Item[] = preview ? [{ kind: 'clip', clip: preview }] : chosen.map((clip) => ({ kind: 'clip', clip }))
  const exportReasonNow = t ? exportReason(show, t) : 'No theme.'
  const storyboardClips = t ? clipsOfVersion(dflt, t.byId) : []

  if (!t) return <p className="text-sm text-graphite">No accepted themes yet.</p>

  const list = (
    <nav aria-label="Themes" className="flex flex-col" data-testid="theme-rail">
      {themes.map((x) => {
        const v = defaultOf(show, x.id)
        const len = totalSeconds(clipsOfVersion(v ?? versionsOf(show, x.id)[0], x.byId))
        const count = clipsOfVersion(v ?? versionsOf(show, x.id)[0], x.byId).length
        return (
          <button key={x.id} type="button" data-testid="theme-row" data-theme={x.id} aria-current={x.id === t.id} onClick={() => onSelect(x.id)} className={cn('flex flex-col gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-haze', x.id === t.id && 'bg-iris-50')}>
            <span className="font-medium">{x.name}</span>
            <span className="text-xs text-graphite tabular-nums">{x.n} of {x.of} people</span>
            <span className="text-xs text-graphite tabular-nums">{x.clips.length < MIN_CLIPS ? 'Not enough clips yet' : `${plural(count, 'clip')} · ${len} s`}</span>
            <span className={cn('text-xs', v ? 'text-positive-fg' : 'text-graphite')} data-testid="default-status">{v ? 'Default set' : 'No default yet'}</span>
          </button>
        )
      })}
    </nav>
  )

  const move = (i: number, to: number) => version && edit((d) => moveClip(d, t.id, version.id, i, to))
  const row = (c: Clip, i: number) => (
    <li
      key={c.id}
      data-testid="clip-row"
      data-clip={c.id}
      data-participant={c.participantId}
      draggable
      onDragStart={() => setDragFrom(i)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => dragFrom !== null && (move(dragFrom, i), setDragFrom(null))}
      className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-mist py-2.5 last:border-b-0"
    >
      <span className="flex items-center gap-0.5 text-graphite">
        <span aria-hidden="true" className="cursor-grab select-none px-1" title="Drag to reorder">⋮⋮</span>
        <button type="button" aria-label={`Move ${c.participantId} up`} data-testid="move-up" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-xs px-1 hover:bg-haze disabled:opacity-30">↑</button>
        <button type="button" aria-label={`Move ${c.participantId} down`} data-testid="move-down" disabled={i === chosen.length - 1} onClick={() => move(i, i + 1)} className="rounded-xs px-1 hover:bg-haze disabled:opacity-30">↓</button>
      </span>
      <span className="w-28 shrink-0 text-sm tabular-nums">
        <span className="font-medium">{c.participantId}</span> <span className="text-graphite">{mmss(c.start)}</span>
      </span>
      <span className="min-w-0 flex-1 basis-60">
        <span className="block font-serif leading-snug">“{c.quote}”</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span className={TAG}>{c.emotionStrength} emotion</span>
          {c.stimulus !== 'None' && <span className={TAG}>{c.stimulus}</span>}
          {c.mode === 'audio-only' && <span className={TAG}>Audio only</span>}
          <span className="text-xs text-graphite tabular-nums">{clipLength(c)} s</span>
        </span>
      </span>
      <span className="flex gap-2 text-sm">
        <button type="button" className={LINK} data-testid="replace" onClick={() => setPicker({ replace: c.id })}>Replace</button>
        <button type="button" className={LINK} data-testid="remove" onClick={() => version && edit((d) => removeClip(d, t.id, version.id, c.id))}>Remove</button>
      </span>
    </li>
  )

  const pool = rank(t.clips.filter((c) => !chosen.some((x) => x.id === c.id)))
  const maxN = Math.max(1, ...themes.map((x) => x.n))

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="print:hidden">{list}</div>

      <div className="flex min-w-0 flex-col gap-5 print:hidden" data-testid="theme-main" data-theme={t.id}>
        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold" data-testid="theme-name">{t.name}</h2>
            <span className="text-sm text-graphite tabular-nums" data-testid="theme-count">{t.n} of {t.of} people</span>
            <span className="flex-1" />
            <ExportMenu
              items={[
                { key: 'mp4', label: 'This theme as MP4', reason: exportReasonNow, run: mock },
                {
                  key: 'link',
                  label: 'Embeddable link',
                  reason: exportReasonNow,
                  run: () => {
                    const url = `https://qual.example/embed/${studyId}/${t.id}`
                    try {
                      void navigator.clipboard?.writeText(url)
                    } catch {
                      // Copying isn't essential.
                    }
                    setEmbed(url)
                    toast('Link copied (mock)')
                  },
                },
                { key: 'storyboard', label: 'Storyboard with quotes', reason: exportReasonNow, run: () => window.print() },
              ]}
            />
          </div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <AIGeneratedTag />
            <span data-testid="theme-summary">{summaryOf(doc, doc.themes.find((x) => x.id === t.id)!, basis, t.n, t.of)}</span>
            <Link to={`${studyPath(studyId, screenById.A3)}#theme-${t.id}`} className={LINK} data-testid="read-more">Read more</Link>
          </p>
          {embed && <EmbedBox url={embed} onClose={() => setEmbed(null)} />}
        </header>

        {t.clips.length < MIN_CLIPS ? (
          <p className="rounded-sm border border-dashed border-mist-strong px-4 py-6 text-sm text-graphite" data-testid="not-enough">Not enough clips yet. {plural(t.clips.length, 'clip')} from accepted sessions; at least {MIN_CLIPS} are needed.</p>
        ) : (
          <>
            <div className="max-w-2xl">
              <ReelPlayer items={items} captions={version?.captions ?? true} label={`${t.name} video`} />
              {preview && (
                <p className="mt-1 text-sm text-graphite" data-testid="previewing">
                  Previewing {preview.participantId} at {mmss(preview.start)}.{' '}
                  <button type="button" className={LINK} onClick={() => setPreview(null)}>Back to the video</button>
                </p>
              )}
              <p className="mt-1 text-sm tabular-nums" data-testid="total">Total {seconds} s</p>
              {lengthLine(seconds) && chosen.length > 0 && (
                <p className="text-sm text-pending-fg" data-testid="length-warning">Brief asks for {BRIEF_RANGE.min} to {BRIEF_RANGE.max} seconds.</p>
              )}
              {chosen.length < MIN_CLIPS && (
                <p className="text-sm text-pending-fg" data-testid="few-clips">Fewer than {MIN_CLIPS} clips.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3" data-testid="controls">
              <span className="flex items-center gap-2 text-sm">
                <Switch checked={version?.captions ?? true} label="Captions" onChange={(on) => version && edit((d) => setCaptions(d, t.id, version.id, on))} />
                Captions
              </span>
              <span role="group" aria-label="Versions" className="flex items-center gap-1.5">
                {versions.map((v) => {
                  const isD = show.themes[t.id]?.defaultId === v.id
                  const why = cantDelete(show, t.id, v.id)
                  return (
                    <span key={v.id} className={cn('inline-flex items-center overflow-hidden rounded-xs border', v.id === version?.id ? 'border-ink' : 'border-mist-strong')} data-testid="version-chip" data-version={`v${v.n}`} data-default={isD}>
                      <button type="button" aria-pressed={v.id === version?.id} onClick={() => setVersionId(v.id)} className={cn('px-2 py-0.5 text-sm', v.id === version?.id ? 'bg-ink text-white' : 'bg-surface hover:bg-haze')} title={v.instruction ? `Asked for: ${v.instruction}` : undefined}>
                        v{v.n}
                        {isD && <span className="ml-1 text-xs">· Default</span>}
                        {v.simulated && <span className="ml-1 text-xs opacity-80">· Simulated</span>}
                      </button>
                      <button type="button" aria-label={`Delete v${v.n}`} data-testid="delete-version" disabled={!!why} title={why ?? `Delete v${v.n}`} onClick={() => edit((d) => deleteVersion(d, t.id, v.id))} className="border-l border-mist px-1.5 text-xs hover:bg-haze disabled:opacity-40">×</button>
                    </span>
                  )
                })}
              </span>
              <button type="button" className={SEG} data-testid="set-default" disabled={!version || isDefault} onClick={() => version && edit((d) => setDefault(d, t.id, version.id))}>
                {isDefault ? 'Default' : 'Set as default'}
              </button>
              <button type="button" className={SEG} data-testid="regenerate" disabled={!!cantRegenerate(show, t.id, t.clips)} onClick={() => setRegen((r) => !r)}>
                Regenerate
              </button>
            </div>
            {versions.length >= MAX_VERSIONS && (
              <p className="-mt-3 text-xs text-graphite" data-testid="regen-reason">Delete a version to make a new one.</p>
            )}
            {regen && !cantRegenerate(show, t.id, t.clips) && (
              <div className="flex flex-col gap-2 rounded-sm border border-mist bg-paper p-3" data-testid="regen-panel">
                <label className="text-sm font-medium" htmlFor="regen-text">Tell the system what to change</label>
                <textarea id="regen-text" rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="For example: More from dog owners, or Shorter" className="w-full rounded-sm border border-mist-strong bg-surface px-2 py-1 text-sm" />
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="primary"
                    data-testid="create-version"
                    onClick={() => {
                      edit((d) => newVersion(d, t.id, t.clips, instruction))
                      setInstruction('')
                      setRegen(false)
                      setVersionId(undefined)
                    }}
                  >
                    Create new version
                  </Button>
                  <span className="text-xs text-graphite">A mock: it picks another set from the ranked clips and labels it Simulated.</span>
                </div>
              </div>
            )}

            <section aria-label="Clips">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Clips, in video order</h3>
                <span className="flex-1" />
                <button type="button" className={LINK} data-testid="add-clip" disabled={chosen.length >= MAX_CLIPS || !pool.length} onClick={() => setPicker({})}>
                  + Add a clip
                </button>
              </div>
              {chosen.length === 0 ? <p className="py-3 text-sm text-graphite">No clips in this version.</p> : <ol data-testid="clip-list">{chosen.map(row)}</ol>}
              {chosen.length >= MAX_CLIPS && <p className="text-xs text-graphite">Up to {MAX_CLIPS} clips.</p>}
            </section>
          </>
        )}

        <section aria-label="Themes by people" data-testid="theme-chart" className="max-w-2xl">
          <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Themes, by people</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {themes.map((x) => (
              <li key={x.id} data-testid="chart-row" data-theme={x.id} data-n={x.n} data-selected={x.id === t.id} className="grid grid-cols-[10rem_1fr_4.5rem] items-center gap-3 text-sm">
                <span className={cn('truncate', x.id === t.id && 'font-semibold')}>{x.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-haze" aria-hidden="true"><span className={cn('block h-full rounded-full', x.id === t.id ? 'bg-ink' : 'bg-mist-strong')} style={{ width: `${(x.n / Math.max(maxN, x.of ? x.of : 1)) * 100}%` }} /></span>
                <span className="text-xs text-graphite tabular-nums">{x.n} of {x.of}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <PrintStoryboard title={`${t.name}: storyboard`} themes={[{ name: t.name, clips: storyboardClips }]} />

      <Picker
        open={!!picker}
        replace={picker?.replace}
        pool={pool}
        onClose={() => setPicker(null)}
        onPreview={(c) => setPreview(c)}
        onUse={(c) => {
          if (!version) return
          edit((d) => (picker?.replace ? replaceClip(d, t.id, version.id, picker.replace, c.id) : addClip(d, t.id, version.id, c.id)))
          setPicker(null)
          setPreview(null)
        }}
      />
    </div>
  )
}

function Picker({ open, replace, pool, onClose, onPreview, onUse }: { open: boolean; replace?: string; pool: Clip[]; onClose: () => void; onPreview: (c: Clip) => void; onUse: (c: Clip) => void }) {
  const [emotion, setEmotion] = useState<'All' | Strength>('All')
  const [stim, setStim] = useState<'All' | Stimulus>('All')
  const shown = pool.filter((c) => (emotion === 'All' || c.emotionStrength === emotion) && (stim === 'All' || c.stimulus === stim))
  const sel = 'h-8 rounded-sm border border-mist-strong bg-surface px-2 text-sm'
  return (
    <SideDrawer open={open} onClose={onClose} title={replace ? 'Replace this clip' : 'Add a clip'} description="Other clips for this theme, best first. Preview plays one in the player behind.">
      <div className="flex flex-col gap-3" data-testid="picker">
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5">Emotion strength
            <select aria-label="Emotion strength" data-testid="filter-emotion" value={emotion} onChange={(e) => setEmotion(e.target.value as typeof emotion)} className={sel}>
              {['All', 'High', 'Medium', 'Low'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">Stimulus
            <select aria-label="Stimulus" data-testid="filter-stimulus" value={stim} onChange={(e) => setStim(e.target.value as typeof stim)} className={sel}>
              {['All', 'Concept A', 'Concept B', 'Concept C', 'None'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-graphite" data-testid="picker-empty">No other clips match.</p>
        ) : (
          <ul>
            {shown.map((c) => (
              <li key={c.id} data-testid="picker-row" data-clip={c.id} data-score={scoreOf(c)} className="border-b border-mist py-2.5 last:border-b-0">
                <p className="text-sm"><span className="font-medium">{c.participantId}</span> <span className="text-graphite tabular-nums">{mmss(c.start)} · {clipLength(c)} s</span></p>
                <p className="mt-0.5 font-serif text-sm leading-snug">“{c.quote}”</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={TAG}>{c.emotionStrength} emotion</span>
                  {c.stimulus !== 'None' && <span className={TAG}>{c.stimulus}</span>}
                  {c.mode === 'audio-only' && <span className={TAG}>Audio only</span>}
                  <span className="flex-1" />
                  <button type="button" className={LINK} data-testid="preview" onClick={() => onPreview(c)}>Preview</button>
                  <button type="button" className={SEG} data-testid="use-clip" onClick={() => onUse(c)}>Use this clip</button>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SideDrawer>
  )
}
