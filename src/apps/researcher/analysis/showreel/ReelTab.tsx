import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { clipLength } from '@/mock/showreel'
import { mmss, plural } from '@/state/reportLogic'
import { clipsOfVersion, defaultOf, moveTheme, orderedThemes, reelSections, toggleLeftOut, totalSeconds, updateShowreel, type ShowreelDoc } from '@/state/showreel'
import { EmbedBox, ExportMenu, PrintStoryboard, useMockExport } from './Export'
import { ReelPlayer, type Item } from './ReelPlayer'
import type { ThemeData } from './ThemeVideos'


/** Every accepted theme with a Default version, in the Researcher's order, one after another. Default versions only. */
export function ReelTab({ studyId, show, themes }: { studyId: string; show: ShowreelDoc; themes: ThemeData[] }) {
  const toast = useToast()
  const mock = useMockExport()
  const [embed, setEmbed] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const ids = themes.map((t) => t.id)
  const order = orderedThemes(show, ids)
  const byId = new Map(themes.map((t) => [t.id, t]))
  const sections = reelSections(show, themes, (id) => byId.get(id)!.byId)
  const items: Item[] = sections.flatMap((s) => [{ kind: 'title' as const, title: s.theme.name }, ...s.clips.map((clip) => ({ kind: 'clip' as const, clip }))])
  const seconds = sections.reduce((n, s) => n + totalSeconds(s.clips), 0)
  const reason = sections.length ? undefined : 'Include at least one theme that has a default version.'
  const move = (from: number, to: number) => updateShowreel(studyId, (d) => moveTheme(d, ids, from, to))

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section aria-label="Theme order" className="print:hidden">
        <h2 className="text-xs font-semibold tracking-wide text-graphite uppercase">Theme order</h2>
        <ol className="mt-2" data-testid="order-list">
          {order.map((id, i) => {
            const t = byId.get(id)!
            const v = defaultOf(show, id)
            const left = show.leftOut.includes(id)
            const clips = clipsOfVersion(v, t.byId)
            return (
              <li
                key={id}
                data-testid="order-row"
                data-theme={id}
                data-included={!!v && !left}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragFrom !== null && (move(dragFrom, i), setDragFrom(null))}
                className="flex items-start gap-2 border-b border-mist py-2.5 last:border-b-0"
              >
                <input type="checkbox" aria-label={`Include ${t.name}`} data-testid="include" checked={!!v && !left} disabled={!v} title={v ? undefined : 'Set a default version first'} onChange={() => updateShowreel(studyId, (d) => toggleLeftOut(d, id))} className="mt-1 disabled:opacity-50" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-graphite tabular-nums">{t.n} of {t.of} people{v ? ` · ${plural(clips.length, 'clip')} · ${totalSeconds(clips)} s` : ''}</span>
                  {!v && <span className="block text-xs text-pending-fg" data-testid="no-default">No default set</span>}
                </span>
                <span className="flex items-center text-graphite">
                  <span aria-hidden="true" className="cursor-grab px-1">⋮⋮</span>
                  <button type="button" aria-label={`Move ${t.name} up`} data-testid="theme-up" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded-xs px-1 hover:bg-haze disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Move ${t.name} down`} data-testid="theme-down" disabled={i === order.length - 1} onClick={() => move(i, i + 1)} className="rounded-xs px-1 hover:bg-haze disabled:opacity-30">↓</button>
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="flex min-w-0 flex-col gap-5 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Showreel</h2>
          <span className="text-sm text-graphite tabular-nums" data-testid="reel-total">Total {seconds} s · {plural(sections.length, 'theme')}</span>
          <span className="flex-1" />
          <ExportMenu
            items={[
              { key: 'reel-mp4', label: 'Showreel as MP4', reason, run: mock },
              { key: 'full-mp4', label: 'Full study (all themes in sequence) as MP4', reason, run: mock },
              {
                key: 'reel-link',
                label: 'Embeddable link',
                reason,
                run: () => {
                  const url = `https://qual.example/embed/${studyId}/showreel`
                  try {
                    void navigator.clipboard?.writeText(url)
                  } catch {
                    // Copying isn't essential.
                  }
                  setEmbed(url)
                  toast('Link copied (mock)')
                },
              },
              { key: 'reel-storyboard', label: 'Storyboard with quotes', reason, run: () => window.print() },
            ]}
          />
        </div>
        {embed && <EmbedBox url={embed} onClose={() => setEmbed(null)} />}

        <div className="max-w-2xl">
          {sections.length === 0 ? (
            <p className="rounded-sm border border-dashed border-mist-strong px-4 py-6 text-sm text-graphite" data-testid="reel-empty">
              No themes in the showreel yet. Set a default version on a theme in Theme videos, and it appears here.
            </p>
          ) : (
            <ReelPlayer items={items} captions label="Showreel" />
          )}
        </div>

        <section aria-label="Storyboard" data-testid="storyboard">
          <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">Storyboard</h3>
          {sections.length === 0 ? (
            <p className="mt-1 text-sm text-graphite">Nothing to show yet.</p>
          ) : (
            sections.map((s) => (
              <div key={s.theme.id} className="mt-3" data-testid="storyboard-theme" data-theme={s.theme.id}>
                <h4 className="text-sm font-semibold">{s.theme.name}</h4>
                <ol>
                  {s.clips.map((c) => (
                    <li key={c.id} className="border-b border-mist py-2 text-sm last:border-b-0" data-testid="storyboard-clip" data-clip={c.id}>
                      <span className="font-medium">{c.participantId}</span> <span className="text-graphite tabular-nums">{mmss(c.start)} · {clipLength(c)} s{c.mode === 'audio-only' ? ' · audio only' : ''}</span>
                      <span className="block font-serif leading-snug">“{c.quote}”</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </section>
      </div>

      <PrintStoryboard title="Showreel: storyboard" themes={sections.map((s) => ({ name: s.theme.name, clips: s.clips }))} />
    </div>
  )
}
