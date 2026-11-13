import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { StimulusThumb } from '@/components/StimulusThumb'
import type { BriefDoc } from '@/state/brief'
import type { FieldworkDoc, Session } from '@/state/fieldwork'
import type { GuideDoc, Stimulus } from '@/state/guide'
import type { PlanItem } from '@/state/launch'

/** The stimuli a participant sees, in their assigned order. A session with no plan sees them in the guide's order. Never the plans of anyone else. */
export function stimuliFor(doc: FieldworkDoc, session: Session, guide?: GuideDoc): { name: string; item?: Stimulus }[] {
  const names = session.stimulusPlan ? session.stimulusPlan.names : [...new Set(doc.plan.sections.flatMap((s) => s.items.map((i) => i.stimulus)).filter((x): x is string => !!x))]
  return names.map((name) => ({ name, item: guide?.stimuli.items.find((i) => i.name === name) })).filter((s) => s.item?.kind !== 'survey')
}

/** The AI's own opening tells the participant they are talking to an AI. A person never says that. */
const AI_SPECIFIC = /\bAI\b|artificial|chatbot|virtual (interviewer|moderator)/i
export const humanOpening = (first: string, continued: boolean) =>
  continued
    ? `Hi, I’m ${first}, I’m a researcher and I’ll take it from here. We’ll pick up where you left off.`
    : `Hi, I’m ${first}. Thanks for joining. This conversation is recorded, there are no right or wrong answers, and you can ask me to repeat, skip or pause at any time.`

/** "Concept C: Recipe swap guarantee" → "C". Anything else keeps its name. */
const shortName = (n: string) => n.match(/^Concept (\w+)/)?.[1] ?? n

type Row = {
  item: PlanItem
  text: string
  probes: string[]
  /** The stimulus card shown before this question, with its place in this participant's order. */
  card?: { name: string; stimulus?: Stimulus; position: number; of: number; byAI: boolean }
  done: boolean
}

/**
 * What a human moderator reads before a session, as one document: the objective, then the guide top to bottom with each
 * stimulus where it is shown, in this participant's own order. Read only. It never carries screener answers, criteria, the
 * balance table or anyone else's plan, so the live console can embed it as it is. Nothing here edits the stored guide:
 * the opening script and the stimulus wording are swapped for this view only.
 */
export function SessionBrief({ doc, session, guide, brief, moderator, whenText }: { doc: FieldworkDoc; session: Session; guide?: GuideDoc; brief?: BriefDoc; moderator: string; whenText?: string }) {
  const plan = doc.plan
  const first = moderator.split(' ')[0] || moderator
  const objective = brief?.draft?.objective.text?.trim()
  const questions = new Map((guide?.guide?.sections ?? []).flatMap((s) => s.questions).map((q) => [q.id, q]))
  const continued = !!session.escalation && session.asked.length > 0
  const since = session.bookedGuide !== undefined && session.bookedGuide < plan.guideVersion

  // Print opens every collapsed part, so the paper copy is complete.
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  // Stimulus slots: the questions that show a stimulus, in guide order. Slot k shows what this participant's plan puts k-th.
  const isStimulusQ = (i: PlanItem) => !!i.stimulus && !i.survey && guide?.stimuli.items.find((s) => s.name === i.stimulus)?.kind !== 'survey'
  const slots = plan.sections.flatMap((s) => s.items).filter(isStimulusQ)
  const assigned = session.stimulusPlan?.names
  const shownByAI = new Set(session.stimuli.filter((x) => x.result === 'Shown').map((x) => x.name))
  const total = assigned ? assigned.length : slots.length
  const slotName = (i: PlanItem) => {
    const k = slots.findIndex((x) => x.id === i.id)
    return assigned ? assigned[k] : i.stimulus
  }
  const slotPos = (i: PlanItem) => slots.findIndex((x) => x.id === i.id) + 1

  const doneSet = new Set([...session.asked, ...session.covered])
  const rowsOf = (sec: (typeof plan.sections)[number], secIndex: number): Row[] =>
    sec.items.flatMap((i, n): Row[] => {
      const isStim = isStimulusQ(i)
      const name = isStim ? slotName(i) : undefined
      if (isStim && !name) return [] // a participant in a split sees fewer stimuli, so this slot isn't theirs
      let text = i.text
      if (isStim && name !== i.stimulus && i.stimulus) text = text.split(i.stimulus).join(name!)
      if (secIndex === 0 && n === 0 && AI_SPECIFIC.test(text)) text = humanOpening(first, continued)
      const byAI = !!name && continued && shownByAI.has(name)
      return [
        {
          item: i,
          text,
          probes: (questions.get(i.id)?.probes ?? []).filter((p) => p.trim()),
          card: isStim ? { name: name!, stimulus: guide?.stimuli.items.find((s) => s.name === name), position: slotPos(i), of: total, byAI } : undefined,
          done: continued && (doneSet.has(i.id) || byAI),
        },
      ]
    })
  const sections = plan.sections.map((sec, n) => ({ sec, rows: rowsOf(sec, n) })).filter((x) => x.rows.length > 0)
  const all = sections.flatMap((x) => x.rows)
  const firstTodo = continued ? all.find((r) => !r.done) : undefined
  const mustCount = all.filter((r) => r.item.core).length

  // The AI's stopping point, in words.
  const doneSections = sections.filter((x) => x.rows.every((r) => r.done)).map((x) => x.sec.title)
  const todoIdx = firstTodo ? all.indexOf(firstTodo) : -1
  const stoppedAfter = todoIdx > 0 ? all[todoIdx - 1].item.n : undefined
  const todoSection = firstTodo ? sections.findIndex((x) => x.rows.includes(firstTodo)) : -1
  const startsSection = todoSection >= 0 && sections[todoSection].rows[0] === firstTodo

  // Orientation line: only the order. Stimuli the AI already showed are not part of what is left.
  const order = (assigned ?? slots.map((i) => i.stimulus!)).filter(Boolean)
  const left = order.filter((n) => !(continued && shownByAI.has(n)))
  const shownList = order.filter((n) => continued && shownByAI.has(n))
  const orderLine = order.length === 0 ? null : shownList.length ? `${left.length} ${left.length === 1 ? 'stimulus' : 'stimuli'} left, order: ${left.map(shortName).join(', ') || 'none'}. Shown by AI: ${shownList.map(shortName).join(', ')}.` : `${order.length} ${order.length === 1 ? 'stimulus' : 'stimuli'}, assigned order: ${order.map(shortName).join(', ')}`

  return (
    <article className="flex flex-col gap-6 text-base" data-testid="session-brief">
      <header className="flex flex-col gap-1 border-b border-mist pb-4" data-testid="brief-header">
        {whenText && (
          <p className="text-sm text-graphite" data-testid="brief-when">
            {whenText}
          </p>
        )}
        <p className="text-sm text-graphite" data-testid="brief-version">
          Guide version {plan.guideVersion} · {plan.durationMin} minutes · {plan.language} · Moderator {moderator}
        </p>
        <p className="text-sm text-graphite" data-testid="brief-counts">
          {mustCount} must-cover {mustCount === 1 ? 'question' : 'questions'}
          {orderLine && (
            <>
              {' · '}
              <span data-testid="brief-order">{orderLine}</span>
            </>
          )}
        </p>
      </header>

      {since && (
        <p className="border-l-2 border-iris-600 pl-3 text-sm" data-testid="guide-updated">
          <span className="font-semibold">Guide updated to version {plan.guideVersion}.</span> You booked this under version {session.bookedGuide}. What you see below is version {plan.guideVersion}.
        </p>
      )}

      {continued && (
        <section className="rounded-sm border border-iris-100 bg-iris-50 px-4 py-3 text-sm" data-testid="continued-banner">
          <p className="font-semibold">Continued from AI</p>
          <p className="mt-0.5">
            {doneSections.length > 0 ? `The AI covered ${doneSections.join(' and ')}. ` : 'The AI asked a few questions. '}
            {stoppedAfter !== undefined ? `It stopped after Q${stoppedAfter}. ` : ''}
            {firstTodo ? (startsSection ? `Start at Section ${todoSection + 1}.` : `Start at Q${firstTodo.item.n}, in Section ${todoSection + 1}.`) : 'Everything in the guide is done.'}
          </p>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold tracking-wide text-graphite uppercase">What this study is about</h2>
        <p className="mt-1 max-w-prose" data-testid="brief-objective">
          {objective || 'The Researcher hasn’t written the objective down yet.'}
        </p>
      </section>

      <div className="flex flex-col gap-8" data-testid="brief-guide">
        {sections.map(({ sec, rows }, n) => {
          const allDone = rows.every((r) => r.done)
          return (
            <Section key={sec.title} n={n + 1} title={sec.title} minutes={sec.minutes} done={allDone} printing={printing}>
              <ol className="flex flex-col">
                {rows.map((r) => (
                  <Question key={r.item.id} r={r} start={r === firstTodo} sayFirst={r === firstTodo && continued ? humanOpening(first, true) : undefined} printing={printing} />
                ))}
              </ol>
            </Section>
          )
        })}
      </div>
    </article>
  )
}

const TAG = 'rounded-xs border border-mist-strong px-1.5 py-0.5 text-xs font-medium text-graphite'

/** A section of the guide. One the AI finished is collapsed and grey until opened; print opens it. */
function Section({ n, title, minutes, done, printing, children }: { n: number; title: string; minutes: number; done: boolean; printing: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const shown = !done || open || printing
  return (
    <section data-testid="brief-section" data-done={done ? 'ai' : undefined} className={done && !shown ? 'text-muted' : undefined}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-mist pb-1.5">
        <h3 className="text-lg font-semibold">
          {n}. {title}
        </h3>
        <span className="text-sm text-graphite tabular-nums">{minutes} min</span>
        {done && <span className={TAG} data-testid="done-by-ai">Done by AI</span>}
        <span className="flex-1" />
        {done && (
          <button type="button" aria-expanded={shown} onClick={() => setOpen((o) => !o)} className="rounded-xs px-1 text-sm font-medium text-iris-700 hover:bg-iris-50" data-testid="section-toggle">
            {open ? 'Collapse' : 'Show what the AI asked'}
          </button>
        )}
      </div>
      {shown && <div className={done ? 'text-graphite' : undefined}>{children}</div>}
    </section>
  )
}

function Question({ r, start, sayFirst, printing }: { r: Row; start: boolean; sayFirst?: string; printing: boolean }) {
  const [open, setOpen] = useState(false)
  const { item } = r
  const collapsed = r.done && !open && !printing
  return (
    <li id={`q-${item.id}`} data-testid="brief-question" data-q={item.n} data-done={r.done ? 'ai' : undefined} data-start={start ? 'true' : undefined} className="border-b border-mist py-3 last:border-b-0">
      {r.card && <StimulusCard c={r.card} />}
      <div data-keep-together className={start ? 'border-l-4 border-iris-600 pl-3' : undefined}>
        {sayFirst && (
          <p className="mb-1 text-sm" data-testid="say-first">
            <span className="font-semibold">Say first: </span>
            {sayFirst}
          </p>
        )}
        <div className={r.done ? 'flex flex-wrap items-baseline gap-x-2 text-graphite' : 'flex flex-wrap items-baseline gap-x-2'}>
          <span className="text-sm text-graphite tabular-nums">Q{item.n}</span>
          {start && <span className="rounded-xs bg-iris-600 px-1.5 py-0.5 text-xs font-semibold text-white" data-testid="start-here">Start here</span>}
          {item.core && <span className={TAG}>Must cover</span>}
          {r.done && <span className={TAG} data-testid="done-by-ai">Done by AI</span>}
          {r.done && !printing && (
            <button type="button" aria-expanded={!collapsed} onClick={() => setOpen((o) => !o)} className="rounded-xs px-1 text-xs font-medium text-iris-700 hover:bg-iris-50" data-testid="question-toggle">
              {open ? 'Collapse' : 'Show'}
            </button>
          )}
        </div>
        {!collapsed && (
          <>
            <p className={r.done ? 'mt-0.5 text-graphite' : 'mt-0.5 text-base font-medium'}>{r.text}</p>
            {item.survey && <p className="mt-0.5 text-sm text-graphite">Survey on screen: {item.survey}</p>}
            {r.probes.length > 0 && (
              <div className="mt-1.5 pl-4 text-sm text-graphite" data-testid="brief-probes">
                <p className="text-xs font-semibold tracking-wide uppercase">Probes</p>
                <ul className="mt-0.5 list-disc pl-4">
                  {r.probes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  )
}

/** Where a stimulus is shown: its place in this participant's order, a thumbnail, what it is, and the rule for the step. */
function StimulusCard({ c }: { c: NonNullable<Row['card']> }) {
  return (
    <div data-keep-together data-testid="stimulus-card" data-stimulus={c.name} data-position={c.position} className="mb-3 flex gap-3 rounded-sm border border-mist px-3 py-2.5">
      <StimulusThumb name={c.name} kind={c.stimulus?.kind} width={120} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-semibold tracking-wide text-graphite uppercase">
            Stimulus {c.position} of {c.of}
          </span>
          {c.byAI && <span className={TAG} data-testid="shown-by-ai">Shown by AI</span>}
        </p>
        <p className="mt-0.5 font-semibold">{c.name}</p>
        {(c.stimulus?.text || c.stimulus?.detail) && <p className="mt-0.5 text-graphite">{c.stimulus?.text ?? c.stimulus?.detail}</p>}
        <p className="mt-1 text-graphite">Ask for the first reaction before describing it.</p>
      </div>
    </div>
  )
}
