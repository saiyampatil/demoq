import { cn } from '@/components/cn'
import { plural } from '@/state/reportLogic'
import { LABEL, useWs, type ToolKey } from './ws'

type Tool = { key: ToolKey; label: string; built: boolean }
const GROUPS: { label: string; tools: Tool[] }[] = [
  {
    label: 'Outputs',
    tools: [
      { key: 'theme-videos', label: 'Theme videos', built: false },
      { key: 'showreel', label: 'Showreel', built: false },
      { key: 'word-cloud', label: 'Word cloud', built: false },
      { key: 'theme-map', label: 'Theme map', built: false },
      { key: 'audio-summary', label: 'Audio summary', built: false },
    ],
  },
  {
    label: 'Explore',
    tools: [
      { key: 'ask', label: 'Ask', built: false },
      { key: 'numbers', label: 'Numbers', built: false },
      { key: 'highlights', label: 'Highlights', built: true },
    ],
  },
  {
    label: 'Lenses',
    tools: [
      { key: 'lens-builder', label: 'Lens builder', built: false },
      { key: 'compare-lenses', label: 'Compare lenses', built: false },
    ],
  },
  {
    label: 'Review',
    tools: [
      { key: 'review', label: 'Approve sentences', built: true },
      { key: 'compare', label: 'Compare AI and mine', built: true },
    ],
  },
  {
    label: 'Release',
    tools: [
      { key: 'exports', label: 'Exports', built: false },
      { key: 'release', label: 'Publish', built: true },
    ],
  },
]

/** The tools around the report. Each opens a large pop-up studio over it; a live state sits beside the ones that have one. */
export function Tools() {
  const { model, report, openStudio } = useWs()
  const open = model.open.length
  const differ = [report.execSummary, ...report.findings].filter((t) => t.researcherDraft.length > 0 && JSON.stringify(t.researcherDraft.map((s) => s.text)) !== JSON.stringify(t.aiDraft.map((s) => s.text))).length

  /** A tool shows a state only when it has one. Tools that aren't built, or have nothing to report, show none. */
  const state = (t: Tool): { text: string; tone?: 'warn' | 'ok' } | null => {
    if (t.key === 'review') return open ? { text: `${open} to review`, tone: 'warn' } : { text: 'All approved', tone: 'ok' }
    if (t.key === 'compare') return differ ? { text: `${differ} differ` } : null
    if (t.key === 'release') return open ? { text: `${plural(open, 'sentence')} to approve`, tone: 'warn' } : { text: 'Ready', tone: 'ok' }
    return null
  }

  return (
    <nav aria-label="Tools" data-testid="tools" className="flex flex-col gap-4">
      <h2 className={cn(LABEL, 'px-2')}>Tools</h2>
      {GROUPS.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="px-2 pb-1 text-xs font-medium text-graphite">{g.label}</h3>
          <ul>
            {g.tools.map((t) => {
              const st = state(t)
              return (
                <li key={t.key}>
                  <button type="button" data-testid={`tool-${t.key}`} onClick={() => openStudio(t.key)} className="flex w-full items-baseline justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-haze">
                    <span className="min-w-0 whitespace-nowrap">{t.label}</span>
                    {st && (
                      <span className={cn('shrink-0 text-xs', st.tone === 'warn' ? 'font-medium text-pending-fg' : st.tone === 'ok' ? 'text-positive-fg' : 'text-graphite')} data-testid={`tool-state-${t.key}`}>
                        {st.text}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
