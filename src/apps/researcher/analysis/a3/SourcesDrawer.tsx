import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { FIT_LABEL } from '@/config/delivery'
import { screenById, studyPath } from '@/routes/screens'
import { liveExcerpts, themeCodes, type Basis, type CodebookDoc } from '@/state/codebook'
import { conceptRows } from '@/state/concepts'
import type { Block } from '@/state/reportBlocks'
import type { ReportInputs } from '@/state/reportInputs'
import type { Line, Source } from '@/state/reportLines'
import { themeSignals, tensionsOf } from '@/state/signals'
import { Dot, QuoteRow, StatusPill } from './parts'

const SOURCE_LABEL: Record<Source['type'], string> = { brief: 'Brief', setup: 'Study set-up', theme: 'Theme insight', concept: 'Concept line', tension: 'Tension', question: 'Findings', firmness: 'How firm', mine: 'Written by you' }
const ord = (n?: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n ? `${n}th` : 'n/a')

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2 border-t border-mist px-4 py-3">
    <h3 className="text-xs font-semibold tracking-wide text-graphite uppercase">{title}</h3>
    {children}
  </section>
)
const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-sm bg-haze px-3 py-2 text-sm">
    <span className="text-graphite">{label}</span>
    <p className="mt-0.5 font-medium text-ink">{value}</p>
  </div>
)
const Open = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="inline-flex min-h-9 items-center self-start rounded-xs text-sm font-medium text-iris-700 underline-offset-2 hover:underline">
    {children}
  </Link>
)

type Ctx = { studyId: string; doc: CodebookDoc; basis: Basis; inputs: ReportInputs; blocks: Block[]; onGoto: (blockId: string) => void }

function Body({ line, c }: { line: Line; c: Ctx }) {
  const s = line.source
  const a2 = (tab: string) => `${studyPath(c.studyId, screenById.A2)}?tab=${tab}`
  if (s.type === 'brief')
    return (
      <>
        <Section title="From the approved brief">
          <p className="text-sm leading-relaxed text-ink">{c.inputs.objective ?? 'The brief has no research objective yet.'}</p>
          <Open to={studyPath(c.studyId, screenById.R4)}>Open brief</Open>
        </Section>
      </>
    )
  if (s.type === 'setup')
    return (
      <Section title="From the study set-up">
        {s.what === 'stimuli' ? (
          <Fact label="Concepts in the approved guide" value={c.inputs.stimuli.join(', ') || 'None'} />
        ) : (
          <>
            <Fact label="Accepted sessions" value={`${c.inputs.people} people`} />
            <Fact label="Groups" value={c.inputs.segments.map((g) => `${g.n} ${g.noun}`).join(' and ')} />
            <Fact label="Interviews" value={c.inputs.mode === 'ai' ? 'AI-led' : 'Human-led'} />
            {c.inputs.coverage.excluded > 0 && <Fact label="Left out" value={`${c.inputs.coverage.excluded} excluded in Review`} />}
          </>
        )}
        <Open to={studyPath(c.studyId, screenById.R15)}>Open study set-up</Open>
      </Section>
    )
  if (s.type === 'theme') {
    const t = themeSignals(c.doc, c.basis).find((x) => x.id === s.id)
    const theme = c.doc.themes.find((x) => x.id === s.id)
    if (!t || !theme) return <Section title="Source">This theme is no longer available.</Section>
    const reads = t.reads.filter((r) => r.fit)
    return (
      <>
        <Section title="Where the numbers come from">
          <Fact label="People who took a side" value={`${t.now.snap.of} of ${c.basis.participants.size} people said it`} />
          <Fact label="On the side the sentence names" value={`${t.now.snap.n} of ${t.now.snap.of} people`} />
          <Fact label="Delivery against words" value={t.now.snap.verdict} />
        </Section>
        <Section title="Built on these accepted codes">
          <ul className="flex flex-col gap-2">
            {themeCodes(c.doc, theme).map((code) => (
              <li key={code.id} className="text-sm">
                <p className="font-medium text-ink">{code.name}</p>
                <p className="text-graphite">{code.definition}</p>
              </li>
            ))}
          </ul>
          <Open to={studyPath(c.studyId, screenById.A1)}>Open in codebook</Open>
        </Section>
        <Section title="How each person’s delivery matched">
          <ul className="flex flex-col divide-y divide-mist rounded-sm border border-mist">
            {reads.map((r) => {
              const label = r.fit === 'Split' ? 'Split across codes' : FIT_LABEL[r.fit as keyof typeof FIT_LABEL]
              return (
                <li key={r.participantId} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{r.participantId}</span>
                    <span className="rounded-xs border border-mist px-1.5 text-xs" data-testid="fit-chip">{label}</span>
                  </span>
                  {(r.fit === 'Pulls against' || r.fit === 'Uncertain') && r.point?.reason && <span className="text-xs text-graphite">{r.point.reason}</span>}
                </li>
              )
            })}
          </ul>
        </Section>
        <Section title="What they said">
          <ul className="flex flex-col gap-2">
            {reads.slice(0, 3).map((r) => (
              <QuoteRow key={r.participantId} participantId={r.participantId} text={r.point?.excerpt?.text} atSec={r.point?.atSec ?? 0} sessionId={r.point?.sessionId} />
            ))}
          </ul>
          <Open to={a2('themes')}>Open in Emotion & behaviour</Open>
        </Section>
      </>
    )
  }
  if (s.type === 'concept') {
    const rows = conceptRows(c.doc, c.basis)
    const r = rows?.rows.find((x) => x.key === `concept:${s.id}`)
    const def = rows?.defs.find((d) => d.id === s.id)
    const code = def ? c.doc.codes.find((x) => x.id === def.codeId) : undefined
    if (!r) return <Section title="Source">This concept is no longer available.</Section>
    return (
      <>
        <Section title="Said, did and showed">
          {r.said && <Fact label="Said they would pick it first" value={`${r.said.n} of ${r.said.of} people`} />}
          {r.did && <Fact label="Chose it to take home" value={`${r.did.n} of ${r.did.of} people`} />}
          <Fact label="Warmest first reaction at the reveal" value={`${r.showed.n} of ${r.showed.of} people on video`} />
          <p className="text-sm text-ink" data-testid="match-line">
            Said {ord(r.ranks.said)} · Did {ord(r.ranks.did)} · Showed {ord(r.ranks.showed)} <span className="font-medium">· {r.match}</span>
          </p>
        </Section>
        <Section title="What they said">
          <ul className="flex flex-col gap-2">
            {(code ? liveExcerpts(code, c.basis) : []).slice(0, 3).map((e) => (
              <QuoteRow key={e.id} participantId={e.participantId} text={e.text} atSec={e.atSec} sessionId={e.sessionId} />
            ))}
          </ul>
          <Open to={a2('concepts')}>Open in Emotion & behaviour</Open>
        </Section>
      </>
    )
  }
  if (s.type === 'tension') {
    const t = tensionsOf(c.doc, c.basis).find((x) => x.id === s.id)
    if (!t) return <Section title="Source">This tension is no longer available.</Section>
    return (
      <>
        <Section title="The two things compared">
          {t.sides.slice(0, 4).map((sd) => (
            <Fact key={sd.label} label={sd.label} value={`${sd.n} of ${sd.of} people`} />
          ))}
          <p className="text-xs text-graphite" data-testid="accounting">{t.accounting}</p>
          {t.directional && <p className="text-xs text-graphite">Directional: a group under 10 people. Read it as a prompt to look, not a result.</p>}
        </Section>
        <Section title="What they said">
          <ul className="flex flex-col gap-2">
            {t.clips.filter((x) => x.quote).slice(0, 3).map((x) => (
              <QuoteRow key={x.participantId} participantId={x.participantId} text={x.quote} atSec={x.atSec} sessionId={x.sessionId} />
            ))}
          </ul>
          <Open to={a2('tensions')}>Open in Emotion & behaviour</Open>
        </Section>
      </>
    )
  }
  if (s.type === 'question') {
    const codes = c.doc.codes.filter((x) => (s.codeIds ?? []).includes(x.id))
    return (
      <>
        <Section title="Built on these accepted codes">
          <ul className="flex flex-col gap-2">
            {codes.map((code) => (
              <li key={code.id} className="text-sm">
                <p className="font-medium text-ink">{code.name}</p>
                <p className="text-graphite">{code.definition}</p>
              </li>
            ))}
          </ul>
          <Open to={studyPath(c.studyId, screenById.A1)}>Open in codebook</Open>
        </Section>
        <Section title="What they said">
          <ul className="flex flex-col gap-2">
            {codes.flatMap((code) => liveExcerpts(code, c.basis)).slice(0, 3).map((e) => (
              <QuoteRow key={e.id} participantId={e.participantId} text={e.text} atSec={e.atSec} sessionId={e.sessionId} />
            ))}
          </ul>
        </Section>
      </>
    )
  }
  if (s.type === 'firmness')
    return (
      <Section title="Where the evidence is thin">
        <ul className="flex flex-col gap-2">
          {c.blocks.filter((b) => b.kind === 'question' && s.questionIds.includes(b.id.slice(2))).map((b) => (
            <li key={b.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-ink">{b.title}</span>
              <span className="tabular-nums text-graphite">{b.strength ? `${b.strength.n} of ${b.strength.of} people` : ''}</span>
              <button type="button" onClick={() => c.onGoto(b.id)} className="min-h-9 rounded-xs px-2 text-iris-700 hover:underline">Go to block</button>
            </li>
          ))}
          {c.inputs.objectives.filter((o) => s.objectiveIds.includes(o.id)).map((o) => (
            <li key={o.id} className="text-sm text-graphite">No accepted finding yet on: {o.text}</li>
          ))}
        </ul>
      </Section>
    )
  return (
    <Section title="Written by you">
      <p className="text-sm text-graphite">This sentence is your own wording, so it has no source of its own. Its numbers and quotes are yours to check.</p>
    </Section>
  )
}

/** The Sources drawer: an overlay from the right, never a column. Not modal: the report stays usable and clicking another sentence updates it. */
export function SourcesDrawer({ block, lineId, onSelect, onClose, ...c }: Ctx & { block: Block; lineId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const [all, setAll] = useState(false)
  const line = block.lines.find((l) => l.id === lineId) ?? block.lines[0]
  return (
    <aside role="complementary" aria-label="Sources" data-testid="sources-drawer" className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[440px] flex-col border-l border-mist bg-surface shadow-xl motion-safe:animate-[fade-in_150ms_ease-out]">
      <header className="flex items-start gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-graphite uppercase">Sources</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-ink" data-testid="drawer-block">
            {block.kind === 'question' ? `Question ${block.number}` : block.title} <StatusPill status={block.status} />
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close sources" data-testid="drawer-close" className="min-h-9 min-w-9 rounded-xs text-lg text-graphite hover:bg-haze">×</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {line && (
          <section className="px-4 pb-3">
            <p className="rounded-sm border border-mist bg-paper p-3 text-sm leading-relaxed text-ink" data-testid="drawer-sentence">{line.text}</p>
            <p className="mt-1.5 text-xs text-graphite">{SOURCE_LABEL[line.source.type]} · tagged {line.tag}</p>
          </section>
        )}
        {line && <Body line={line} c={c} />}
        <section className="border-t border-mist px-4 py-3">
          <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="min-h-9 rounded-xs text-sm font-medium text-iris-700 hover:underline" data-testid="all-sources">All sources</button>
          {all && (
            <ul className="mt-2 flex flex-col">
              {block.lines.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => onSelect(l.id)} className={cn('flex min-h-9 w-full items-start gap-2 rounded-xs px-2 py-1.5 text-left text-sm hover:bg-haze', l.id === lineId && 'bg-iris-50')}>
                    <Dot status={block.status} />
                    <span className="min-w-0 flex-1 text-ink">{l.text}</span>
                    <span className="shrink-0 text-xs text-graphite">{SOURCE_LABEL[l.source.type]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="px-4 pb-4 text-xs text-graphite">Arrow keys move between sentences. Esc closes.</p>
      </div>
    </aside>
  )
}

