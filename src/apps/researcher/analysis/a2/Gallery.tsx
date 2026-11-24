// Dev only: every shared A2 piece in every state, at /design/a2. Not linked from the product.

import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { ClipPlayer } from '@/components/ClipPlayer'
import { EmptyState } from '@/components/States'
import { Tooltip } from '@/components/Tooltip'
import { useToast } from '@/components/Toast'
import { FIT_ORDER, VERDICT_ORDER } from '@/config/delivery'
import type { CodebookCtx } from '../codebookCtx'
import { FitChip, OneFitChip } from '../SignalBits'
import { HowToRead, InsightStatusChip } from '../themes/Bits'
import { BackLink, ConceptLetter, FaceChip, FaceNotRight, InlineError, PanelSkeleton, PersonBar, RespondentQuote, TabBadge } from './ui'

const STATUSES = ['Suggested', 'Accepted', 'Edited', 'Left out', 'Out of date', 'Nothing to decide'] as const
const ctx = { doc: { faceFixes: {} }, basis: {}, me: 'Maya Ortiz', studyId: 'gallery', act: () => {} } as unknown as CodebookCtx
const row = (label: string, children: React.ReactNode) => (
  <section className="flex flex-col gap-2 border-b border-mist py-4">
    <h2 className="text-xs font-semibold text-graphite">{label}</h2>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </section>
)

export function A2Gallery() {
  const toast = useToast()
  const people = (n: number, bad: number, hes: number) => Array.from({ length: n }, (_, i) => ({ id: `P-${4101 + i}`, tone: (i < n - bad - hes ? 'good' : i < n - hes ? 'warn' : 'quiet') as 'good' | 'warn' | 'quiet' }))
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-1 p-6" data-testid="a2-gallery">
      <h1 className="text-lg font-semibold">A2 design system</h1>
      <p className="text-sm text-graphite">Tokens are in src/styles/tokens.css and index.css. Everything below reads them.</p>
      {row('Verdict pills', VERDICT_ORDER.map((v) => <FitChip key={v} pattern={v} />))}
      {row('Delivery chips (Matched · No match · Hesitant)', FIT_ORDER.map((f) => <OneFitChip key={f} fit={f} against={[]} />))}
      {row('Status pills', STATUSES.map((s) => <InsightStatusChip key={s} status={s} />))}
      {row('AI-generated tag', <AIGeneratedTag />)}
      {row('Face chips (one teal family, faces only)', <><FaceChip label="Delight" confidence={0.9} /><FaceChip label="Interest" confidence={0.7} at="Mango" /><FaceChip label="Doubt" confidence={0.5} corrected /><FaceChip label={null} /></>)}
      {row('Concept letters', ['A', 'B', 'C'].map((l) => <ConceptLetter key={l} letter={l} />))}
      {row('Tab badges', <><TabBadge n={2} label="to review" testid="g1" /><TabBadge n={12} label="to review" testid="g2" /></>)}
      {row('Segmented person bar (hover a block for the ID)', <div className="w-80"><PersonBar people={people(8, 2, 1)} label="8 people: 5 matched, 2 no match, 1 hesitant" /></div>)}
      {row('Respondent quote vs AI line vs researcher note', <div className="flex w-full flex-col gap-3"><RespondentQuote>I go back to caramel every time.</RespondentQuote><div className="ai-surface p-3 text-[18px]"><AIGeneratedTag className="mb-1" /><p>12 of 14 people were verbally positive about it.</p></div><p className="rounded-sm border border-mist bg-paper p-3 text-sm">Your note: kept apart from the insight.</p></div>)}
      {row('Back link', <BackLink onClick={() => {}}>The safe choice wins the shelf</BackLink>)}
      {row('How to read this (popover)', <HowToRead />)}
      {row('Toast with Undo (6 seconds)', <Button onClick={() => toast('Accepted “The safe choice wins the shelf”', { label: 'Undo', onClick: () => {} })}>Show a toast</Button>)}
      {row('Tooltip (after about 300 ms)', <Tooltip content="Said by 14 of 20 people" focusable><Button size="sm">Hover or focus me</Button></Tooltip>)}
      {row('Face “Not right?” (the seven labels and No clear reading)', <FaceNotRight ctx={ctx} fixKey="gallery" name="Gallery" from="Delight" who="P-4109" />)}
      {row('Mini-player with a reveal marker and caption bar', <ClipPlayer className="w-80" label="P-4109" startSec={880} lengthSec={10} markerSec={2} markerLabel="Reveal" captionBar={<span className="flex flex-wrap items-center gap-2">Seen: leaned in with a wide smile <FaceChip label="Delight" confidence={0.9} /></span>} />)}
      {row('Empty state', <div className="w-full rounded-md border border-dashed border-mist-strong bg-surface"><EmptyState title="Nothing needs review" description="Every insight is decided." /></div>)}
      {row('Loading skeleton (the panel’s shape)', <div className="w-80"><PanelSkeleton /></div>)}
      {row('Inline error with Retry', <InlineError message="The panel didn’t load. Your decisions are safe." onRetry={() => toast('Retrying')} />)}
    </div>
  )
}
