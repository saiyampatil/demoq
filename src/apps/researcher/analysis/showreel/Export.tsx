import { useState } from 'react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { mmss } from '@/state/reportLogic'
import type { Clip } from '@/mock/showreel'
import { clipLength } from '@/mock/showreel'

export type ExportItem = { key: string; label: string; /** Why it can't be used right now, or undefined. */ reason?: string; run: () => void }

/** One Export menu. An item that can't be used is disabled and says why in one line. */
export function ExportMenu({ items }: { items: ExportItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" data-testid="export">
      <Button size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="export-button">
        Export ▾
      </Button>
      {open && (
        <ul role="menu" className="absolute right-0 z-20 mt-1 w-72 rounded-sm border border-mist bg-surface py-1 shadow-md">
          {items.map((i) => (
            <li key={i.key} role="none">
              <button
                role="menuitem"
                type="button"
                data-testid={`export-${i.key}`}
                disabled={!!i.reason}
                onClick={() => {
                  setOpen(false)
                  i.run()
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-haze disabled:opacity-60 disabled:hover:bg-transparent"
              >
                {i.label}
                {i.reason && (
                  <span className="block text-xs text-graphite" data-testid="export-reason">
                    {i.reason}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The mock link and the snippet to paste it with. Nothing is hosted. */
export function EmbedBox({ url, onClose }: { url: string; onClose: () => void }) {
  const snippet = `<iframe src="${url}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`
  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-mist bg-paper px-3 py-2.5 text-sm" data-testid="embed-box">
      <p className="text-graphite">Link copied (mock): nothing is hosted yet.</p>
      <code className="break-all text-xs" data-testid="embed-snippet">{snippet}</code>
      <div>
        <button type="button" className="text-xs text-graphite underline-offset-2 hover:underline" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

export type StoryboardTheme = { name: string; clips: Clip[] }

/** Shown only when printing: black on white, theme headings, clips in order with participant, time and quote. No buttons. */
export function PrintStoryboard({ title, themes }: { title: string; themes: StoryboardTheme[] }) {
  return (
    <section id="storyboard-print" data-testid="storyboard-print" className="hidden bg-white text-black print:block">
      <h1 className="text-xl font-semibold">{title}</h1>
      {themes.map((t) => (
        <div key={t.name} className="mt-4" style={{ breakInside: 'avoid' }}>
          <h2 className="text-lg font-semibold">{t.name}</h2>
          <ol className="mt-1 list-decimal pl-5">
            {t.clips.map((c) => (
              <li key={c.id} className="py-1" style={{ breakInside: 'avoid' }}>
                <span className="font-medium">{c.participantId}</span> · {mmss(c.start)} · {clipLength(c)} s{c.mode === 'audio-only' ? ' · audio only' : ''}
                <br />“{c.quote}”
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}

export const useMockExport = () => {
  const toast = useToast()
  return () => toast('Export queued (mock)')
}
