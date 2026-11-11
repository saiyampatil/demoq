import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { SearchIcon } from '@/components/icons'
import { SideDrawer } from '@/components/SideDrawer'
import { updateCodebook, type Basis, type CodebookDoc } from '@/state/codebook'
import type { CodebookCtx } from '../codebookCtx'
import { HighlightsTab } from './HighlightsTab'

export type ExploreTab = 'ask' | 'numbers' | 'highlights'
const TABS: { key: ExploreTab; label: string }[] = [
  { key: 'ask', label: 'Ask' },
  { key: 'numbers', label: 'Numbers' },
  { key: 'highlights', label: 'Highlights' },
]

/**
 * The Explore button and its drawer. The same component sits in the top bar of the Codebook, Emotion & behaviour and the
 * Report, so wherever the Researcher is, they can look across the accepted interviews without leaving. `first` is the
 * tab it opens on. Ask and Numbers are placeholders; Highlights is built.
 */
export function ExploreControl({ doc, basis, me, studyId, first = 'highlights' }: { doc: CodebookDoc; basis: Basis; me: string; studyId: string; first?: ExploreTab }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ExploreTab>(first)
  const ctx: CodebookCtx = { doc, basis, me, studyId, act: (fn) => updateCodebook(studyId, fn) }
  const show = () => {
    setTab(first)
    setOpen(true)
  }
  return (
    <>
      <Button onClick={show} icon={<SearchIcon size={14} />} data-testid="explore-open">
        Explore
      </Button>
      <SideDrawer open={open} onClose={() => setOpen(false)} title="Explore" description="Look across the accepted interviews: find an idea, ask a question, count what people said.">
        <div data-testid="explore-drawer">
          <div role="tablist" aria-label="Explore" className="-mt-1 mb-4 flex gap-1 border-b border-mist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                type="button"
                id={`explore-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="explore-panel"
                data-testid={`explore-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-ink text-ink' : 'border-transparent text-graphite hover:text-ink')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id="explore-panel" role="tabpanel" aria-labelledby={`explore-tab-${tab}`}>
            {tab === 'highlights' && <HighlightsTab ctx={ctx} />}
            {tab === 'ask' && <ComingNext title="Ask" text="Type a question and get only answers that cite an exact quote, with its timestamp and a link to play it." />}
            {tab === 'numbers' && <ComingNext title="Numbers" text="How often each theme comes up, and where segments differ, always with the quotes behind each number." />}
          </div>
        </div>
      </SideDrawer>
    </>
  )
}

function ComingNext({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-dashed border-mist-strong bg-paper px-5 py-8 text-center" data-testid="coming-next">
      <p className="text-sm font-semibold">{title}: coming next</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-graphite">{text}</p>
    </div>
  )
}
