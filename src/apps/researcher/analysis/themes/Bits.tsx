// The parts of the A2 Themes tab that more than one place uses: the status chip, the stance tag, the Key, the tiles with their people,
// and the clips to watch. No bars and no colour legend on the page: the Key holds every meaning.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { PlayIcon } from '@/components/icons'
import { StatusGlyph } from '@/components/StatusChip'
import type { StatusFamily } from '@/components/status'
import { useToast } from '@/components/Toast'
import {
  DELIVERY_RULE_LINES,
  FIT_COLOUR,
  FIT_DEF,
  FIT_LABEL,
  FIT_ORDER,
  INSIGHT_STATUS_DEF,
  RAISED_TIP,
  SIDE_DEF,
  SIDE_LABEL,
  STANCE_TAG,
  STANCE_TAG_DEF,
  VERDICT_DEF,
  VERDICT_ORDER,
  sideGroupHead,
  sideGroupLine,
  type FitKey,
} from '@/config/delivery'
import { correctCodeStance, correctPersonStance, type Code } from '@/state/codebook'
import type { Stance } from '@/state/emotion'
import { aiStance, codeStance } from '@/state/speech'
import { segmentLabelOf, sideSummary, type InsightStatus, type MomentToWatch, type PersonRead, type Point } from '@/state/signals'
import type { Fit, PersonFit } from '@/state/speech'
import { mmss } from '../../review/reviewUi'
import type { CodebookCtx } from '../codebookCtx'
import { FitChip, OneFitChip, playHref } from '../SignalBits'

// ─── a small popover that closes on Escape or a click elsewhere ─────────────

export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return { open, setOpen, ref }
}

// ─── the status of an insight ───────────────────────────────────────────────

const STATUS_FAMILY: Record<InsightStatus, StatusFamily> = {
  Suggested: 'progress',
  Accepted: 'positive',
  Edited: 'positive',
  'Left out': 'held',
  'Out of date': 'pending',
  'Nothing to decide': 'neutral',
}
const FAMILY_CLASS: Record<StatusFamily, string> = {
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-line',
  pending: 'bg-pending-bg text-pending-fg border-pending-line',
  progress: 'bg-progress-bg text-progress-fg border-progress-line',
  positive: 'bg-positive-bg text-positive-fg border-positive-line',
  negative: 'bg-negative-bg text-negative-fg border-negative-line',
  held: 'bg-held-bg text-held-fg border-held-line',
}

/** Suggested, Accepted, Edited, Left out, Out of date, or Nothing to decide: an icon and the words, never cut short. */
export function InsightStatusChip({ status, className }: { status: InsightStatus; className?: string }) {
  const fam = STATUS_FAMILY[status]
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs font-medium whitespace-nowrap', FAMILY_CLASS[fam], className)} title={INSIGHT_STATUS_DEF[status]} data-testid="status-chip" data-status={status}>
      <StatusGlyph family={fam} />
      {status}
    </span>
  )
}

// ─── what the words of a code claim ─────────────────────────────────────────

const STANCES: Stance[] = ['Positive', 'Negative', 'Neutral']

/**
 * The small tag on a code row: For it, Against it, or Just describes. One click opens the three choices and one more corrects it for the whole
 * code. A correction updates every count and is logged. A corrected tag shows a dashed border and says who changed it.
 */
export function StanceTag({ ctx, code, className }: { ctx: CodebookCtx; code: Pick<Code, 'id' | 'name'>; className?: string }) {
  const toast = useToast()
  const { open, setOpen, ref } = usePopover()
  const now = codeStance(ctx.doc, code.id)
  const ai = aiStance(code.id)
  const fix = ctx.doc.stanceFixes?.[`code:${code.id}`]
  const pick = (to: Stance) => {
    setOpen(false)
    if (to === now) return
    ctx.act((d) => correctCodeStance(d, code, ai, to, { by: ctx.me }))
    toast(`“${code.name}” is now “${STANCE_TAG[to]}”`, { label: 'Undo', onClick: () => ctx.act((d) => correctCodeStance(d, code, ai, now, { by: ctx.me })) })
  }
  return (
    <span ref={ref} className={cn('relative inline-flex', className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="stance-tag"
        data-stance={now}
        title={fix ? `Corrected from “${STANCE_TAG[fix.from]}” by ${fix.by}. ${STANCE_TAG_DEF[now]}` : `${STANCE_TAG_DEF[now]} Click to change.`}
        className={cn('inline-flex min-h-6 cursor-pointer items-center rounded-xs border bg-surface px-1.5 text-xs whitespace-nowrap text-graphite hover:bg-haze', fix ? 'border-dashed border-iris-600' : 'border-mist-strong')}
      >
        {STANCE_TAG[now]}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-1 shrink-0"><path d="m1.5 3 2.5 2.5L6.5 3" /></svg>
      </button>
      {open && (
        <ul role="menu" aria-label={`What “${code.name}” claims`} data-testid="stance-menu" className="absolute top-full right-0 z-30 mt-1 w-44 rounded-sm border border-mist bg-surface py-1 text-sm shadow-overlay">
          {STANCES.map((s) => (
            <li key={s} role="none">
              <button type="button" role="menuitemradio" aria-checked={s === now} onClick={() => pick(s)} data-stance-option={s} className="flex min-h-9 w-full cursor-pointer items-center justify-between px-3 text-left hover:bg-haze">
                {STANCE_TAG[s]}
                {s === ai && <span className="text-xs text-muted">PulseAI</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

// ─── how to read this ───────────────────────────────────────────────────────

/**
 * One popover holding everything the page does not spell out, in two short sections: what the labels mean, and how a verdict is decided.
 * Each meaning is written once. Closes on Escape or a click elsewhere.
 */
export function HowToRead() {
  const { open, setOpen, ref } = usePopover()
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} data-testid="how-to-read" className="min-h-9 cursor-pointer rounded-xs px-1 text-sm font-medium text-iris-700 hover:underline">
        How to read this
      </button>
      {open && (
        <div role="dialog" aria-label="How to read this" data-testid="read-pop" className="absolute top-full left-0 z-30 mt-1.5 max-h-[70vh] w-[26rem] overflow-y-auto rounded-sm border border-mist bg-surface p-4 text-sm font-normal text-ink shadow-overlay">
          <h3 className="mb-2 text-xs font-semibold">What the labels mean</h3>
          <p className="mb-1 text-xs text-graphite">Verdict</p>
          <ul className="flex flex-col gap-1.5" data-testid="key-verdicts">
            {VERDICT_ORDER.map((v) => (
              <li key={v} className="flex items-start gap-2 text-xs">
                <span className="w-28 shrink-0"><FitChip pattern={v} /></span>
                <span>{VERDICT_DEF[v]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-1 text-xs text-graphite">Did their delivery match their words?</p>
          <ul className="flex flex-col gap-1.5" data-testid="key-fits">
            {FIT_ORDER.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs">
                <span className="w-28 shrink-0"><OneFitChip fit={f} against={[]} /></span>
                <span>{FIT_DEF[f]}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-xs">
              <span className="w-28 shrink-0 pt-0.5 font-medium">Split across codes</span>
              <span>Their positions across codes point both ways and neither side is ahead. In the base, in no tile.</span>
            </li>
          </ul>
          <p className="mt-3 mb-1 text-xs text-graphite">What people said</p>
          <ul className="flex flex-col gap-1.5" data-testid="key-words">
            {(['Positive', 'Negative', 'Neutral'] as const).map((k) => (
              <li key={k} className="text-xs"><span className="font-medium">{STANCE_TAG[k]}</span> ({SIDE_LABEL[k].toLowerCase()}): {SIDE_DEF[k]}</li>
            ))}
          </ul>
          <p className="mt-3 mb-1 text-xs text-graphite">Status</p>
          <ul className="flex flex-col gap-1.5" data-testid="key-statuses">
            {(['Suggested', 'Accepted', 'Edited', 'Left out', 'Out of date', 'Nothing to decide'] as const).map((s) => (
              <li key={s} className="flex items-start gap-2 text-xs">
                <span className="w-28 shrink-0"><InsightStatusChip status={s} /></span>
                <span>{INSIGHT_STATUS_DEF[s]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs" data-testid="key-grouping">Codes sit under the themes you made in the codebook. Codes that are not in a theme yet are listed last, with no verdict.</p>
          <h3 className="mt-4 mb-2 text-xs font-semibold">How it’s decided</h3>
          <ol className="flex flex-col gap-1.5 text-xs" data-testid="key-rules">
            {DELIVERY_RULE_LINES.map((l, i) => (
              <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-graphite tabular-nums">{i + 1}.</span><span>{l}</span></li>
            ))}
          </ol>
        </div>
      )}
    </span>
  )
}

// ─── tiles, and the people behind them ──────────────────────────────────────

/** One word for why a person matched, did not match, or was hesitant: the tone, or "Hesitated". */
const reasonWord = (p: Point, fit: FitKey | 'Split') => (fit === 'Split' ? 'Split across codes' : fit === 'Uncertain' ? 'Hesitated' : p.voice.tone)

/**
 * "Did their delivery match their words?": the tiles Matched · No match · Hesitant for each side that has people (two groups headed
 * "Spoke in favour · n" and "Spoke against it · n" when people are on both sides), a quiet line for people split across codes, and one for
 * people who just described it. A tile or a heading opens the people in it: ID, segment, one word, Play. With a `code`, each person has "Not right?".
 */
export function Tiles({ reads, ctx, code }: { reads: PersonRead[]; ctx: CodebookCtx; code?: Pick<Code, 'id' | 'name'> }) {
  const sum = sideSummary(reads)
  const toast = useToast()
  const [open, setOpen] = useState<{ side: string; fit?: FitKey } | null>(null)
  const [who, setWho] = useState(false)
  const [fixing, setFixing] = useState<string | null>(null)
  const current = code ? codeStance(ctx.doc, code.id) : undefined
  const correct = (p: Point, to: Stance) => {
    if (!code || !current) return
    const had = ctx.doc.stanceFixes?.[`person:${code.id}|${p.participantId}`]?.to ?? current
    ctx.act((d) => correctPersonStance(d, code, p.participantId, current, to, { by: ctx.me }))
    setFixing(null)
    toast(`${p.participantId}: “${STANCE_TAG[to]}” at “${code.name}”`, { label: 'Undo', onClick: () => ctx.act((d) => correctPersonStance(d, code, p.participantId, current, had, { by: ctx.me })) })
  }
  const person = (p: Point, f: FitKey | 'Split') => (
    <li key={p.participantId} data-testid="tile-person" className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 text-xs">
      <span className="font-medium whitespace-nowrap tabular-nums">{p.participantId}</span>
      <span className="text-graphite">{segmentLabelOf(p.participantId)}</span>
      <span className="text-graphite" data-testid="tile-reason">{reasonWord(p, f)}</span>
      <span className="ml-auto flex items-center gap-2">
        {code && (
          <button type="button" onClick={() => setFixing(fixing === p.participantId ? null : p.participantId)} aria-expanded={fixing === p.participantId} data-testid="not-right" className="min-h-6 cursor-pointer rounded-xs text-graphite underline-offset-2 hover:text-ink hover:underline">
            Not right?
          </button>
        )}
        <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="inline-flex min-h-6 items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${p.participantId} at ${mmss(p.atSec)}`}>
          <PlayIcon size={11} /> Play
        </Link>
      </span>
      {code && fixing === p.participantId && (
        <span className="flex basis-full flex-wrap items-center gap-1.5 pt-1" role="group" aria-label={`What ${p.participantId} said at “${code.name}”`} data-testid="not-right-menu">
          <span className="text-graphite">Their words were:</span>
          {(['Positive', 'Negative', 'Neutral'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={(ctx.doc.stanceFixes?.[`person:${code.id}|${p.participantId}`]?.to ?? current) === s} onClick={() => correct(p, s)} data-stance-option={s} className="min-h-6 cursor-pointer rounded-xs border border-mist-strong px-1.5 hover:bg-haze aria-pressed:border-iris-600 aria-pressed:bg-iris-50">
              {STANCE_TAG[s]}
            </button>
          ))}
        </span>
      )}
    </li>
  )
  return (
    <div className="flex flex-col gap-2.5" data-testid="delivery-breakdown">
      {sum.groups.map((g) => {
        const both = sum.groups.length > 1
        const key = g.side
        const listed = open?.side === key ? (open.fit ? g.tiles[open.fit] : g.points) : []
        return (
          <section key={key} aria-label={SIDE_LABEL[g.side]} data-testid="tile-group" data-side={g.side} data-n={g.points.length} className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setOpen(open?.side === key && !open.fit ? null : { side: key })} aria-expanded={open?.side === key && !open.fit} data-testid="group-head" className="min-h-6 cursor-pointer self-start rounded-xs text-left text-xs text-graphite hover:text-ink hover:underline">
              {both ? sideGroupHead(g.side, g.points.length) : sideGroupLine(g.side, g.points.length)}
            </button>
            <dl className="grid grid-cols-3 gap-2" data-testid="match-tiles">
              {FIT_ORDER.map((k) => (
                <button key={k} type="button" onClick={() => setOpen(open?.side === key && open.fit === k ? null : { side: key, fit: k })} aria-pressed={open?.side === key && open.fit === k} data-testid={`fig-${{ Matches: 'matched', 'Pulls against': 'against', Uncertain: 'uncertain' }[k]}`} data-fit={k} data-n={g.tiles[k].length} title={FIT_DEF[k]} className={cn('min-h-11 cursor-pointer rounded-sm border px-2 py-1.5 text-left', open?.side === key && open.fit === k && 'ring-1 ring-ink')} style={{ background: FIT_COLOUR[k].bg, borderColor: FIT_COLOUR[k].line }}>
                  <dd className="text-lg leading-none font-semibold tabular-nums" style={{ color: FIT_COLOUR[k].fg }}>{g.tiles[k].length}</dd>
                  <dt className="mt-1 text-xs text-graphite">{FIT_LABEL[k]}</dt>
                </button>
              ))}
            </dl>
            {g.split.length > 0 && (
              <p className="text-xs text-graphite" data-testid="split-line">
                {g.split.length} split across codes
              </p>
            )}
            {listed.length > 0 && open?.side === key && (
              <ul className="divide-y divide-mist rounded-sm border border-mist" data-testid="tile-people" data-for={open.fit ?? 'all'}>
                {listed.map((p) => person(p, g.fits[p.participantId] as FitKey | 'Split'))}
              </ul>
            )}
          </section>
        )
      })}
      {sum.described.length > 0 && (
        <p className="text-xs text-graphite" data-testid="fact-only">
          {sum.described.length} just described what happened, not checked.{' '}
          <button type="button" aria-expanded={who} onClick={() => setWho((w) => !w)} data-testid="see-who" className="min-h-6 cursor-pointer rounded-xs font-medium text-iris-700 hover:underline">
            Show who
          </button>
        </p>
      )}
      {who && sum.described.length > 0 && (
        <ul className="divide-y divide-mist rounded-sm border border-mist" data-testid="fact-only-people">
          {[...sum.described].sort((a, b) => a.participantId.localeCompare(b.participantId)).map((p) => (
            <li key={p.participantId} data-testid="tile-person" className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
              <span className="font-medium whitespace-nowrap tabular-nums">{p.participantId}</span>
              <span className="text-graphite">{segmentLabelOf(p.participantId)}</span>
              <span className="text-graphite">Just described it</span>
              <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="ml-auto inline-flex min-h-6 items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${p.participantId} at ${mmss(p.atSec)}`}>
                <PlayIcon size={11} /> Play
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The sentence's N carries a tooltip saying who it counts. */
export function SentenceWithN({ sentence, of, what }: { sentence: string; of: number; what: 'theme' | 'code' }) {
  const [lead, ...after] = sentence.split(new RegExp(`(?<= of |All )${of}(?= people)`))
  if (!after.length) return <>{sentence}</>
  return (
    <>
      {lead}
      <span title={RAISED_TIP[what]} data-testid="raised-n" className="cursor-help underline decoration-dotted underline-offset-2">{of}</span>
      {after.join(String(of))}
    </>
  )
}

// ─── clips to watch ─────────────────────────────────────────────────────────

/** The clips most worth playing, one per person, the clearest first, each with the numbers that make it stand out. */
export function Moments({ moments, studyId, fits }: { moments: MomentToWatch[]; studyId: string; /** Each person's one result, for the small chip on their clip. */ fits: Record<string, PersonFit | undefined> }) {
  if (!moments.length) return <p className="text-sm text-graphite" data-testid="moments-none">No clips to show.</p>
  return (
    <ol className="flex flex-col divide-y divide-mist" data-testid="moments">
      {moments.map((m) => (
        <li key={m.participantId} data-testid="moment" data-person={m.participantId} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-graphite">
            <span className="font-medium whitespace-nowrap text-ink tabular-nums">{m.participantId}</span>
            <span>{segmentLabelOf(m.participantId)}</span>
            <span className="tabular-nums">{mmss(m.atSec)}</span>
            {fits[m.participantId] && fits[m.participantId] !== 'Split' && <OneFitChip fit={fits[m.participantId] as Fit} against={[]} />}
            {fits[m.participantId] === 'Split' && <span className="text-xs text-graphite" data-testid="moment-split">Split across codes</span>}
            <Link to={playHref(studyId, m.sessionId, m.atSec)} className="ml-auto inline-flex min-h-6 items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${m.participantId} at ${mmss(m.atSec)}`}>
              <PlayIcon size={11} /> Play
            </Link>
          </div>
          {m.quote && <p className="font-serif text-quote leading-snug text-ink">“{m.quote}”</p>}
          {m.reason && <p className="text-xs text-graphite" data-testid="moment-reason">{m.reason}</p>}
        </li>
      ))}
    </ol>
  )
}
