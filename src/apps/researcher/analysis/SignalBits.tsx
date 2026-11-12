import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { PlayIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { Tooltip } from '@/components/Tooltip'
import { petOf } from '@/mock/codebook'
import { screenById, studyPath } from '@/routes/screens'
import { band as confidenceBand, correctFace } from '@/state/codebook'
import { EMOTION_HINT, EMOTIONS, STANCE_LABEL, TONE_HINT, TONES, VALENCE, VALENCE_WORD, VALENCES, faceOf, fitOf, type Emotion, type EmotionSplit, type Face, type Fit, type FitPattern, type Tone, type ToneSplit } from '@/state/emotion'
import { signsOf, type Band, type Pattern, type Point, type Split } from '@/state/signals'
import { BANDS } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import type { CodebookCtx } from './codebookCtx'

// ─── hesitation ─────────────────────────────────────────────────────────────

/** One hue at three strengths, so a band is never read as good or bad by its colour. */
export const BAND_CHIP: Record<Band, string> = {
  Steady: 'border-mist-strong bg-haze text-graphite',
  'Some hesitation': 'border-iris-100 bg-iris-50 text-iris-700',
  'Marked hesitation': 'border-iris-600 bg-iris-600 text-white',
}
const BAND_FILL: Record<Band, string> = { Steady: 'bg-mist-strong', 'Some hesitation': 'bg-iris-300', 'Marked hesitation': 'bg-iris-600' }
const chipBase = 'inline-flex h-5 shrink-0 items-center gap-1 rounded-xs border px-1.5 text-xs font-medium whitespace-nowrap'

export function BandChip({ band, className }: { band: Band; className?: string }) {
  return <span className={cn(chipBase, BAND_CHIP[band], className)}>{band}</span>
}

export function PatternChip({ pattern }: { pattern: Pattern }) {
  const cls =
    pattern === 'Often hesitant'
      ? BAND_CHIP['Marked hesitation']
      : pattern === 'Mixed'
        ? BAND_CHIP['Some hesitation']
        : pattern === 'Mostly steady'
          ? BAND_CHIP.Steady
          : 'border-dashed border-mist-strong bg-surface text-muted'
  return <span className={cn(chipBase, cls)}>{pattern}</span>
}

/** Marked, some and steady as one bar. Counts are written beside it, so the colour never carries the meaning alone. */
export function BandBar({ split, tall }: { split: Split; tall?: boolean }) {
  const label = BANDS.slice()
    .reverse()
    .map((b) => `${split.counts[b]} ${b.toLowerCase()}`)
    .join(', ')
  return (
    <div className={cn('flex overflow-hidden rounded-full bg-haze', tall ? 'h-3.5' : 'h-2')} role="img" aria-label={`${label}, of ${split.n}`}>
      {BANDS.slice()
        .reverse()
        .map((b) => (split.counts[b] ? <span key={b} className={cn('h-full', BAND_FILL[b])} style={{ width: `${(split.counts[b] / split.n) * 100}%` }} title={`${split.counts[b]} ${b.toLowerCase()}`} /> : null))}
    </div>
  )
}

function Legend({ items }: { items: { label: string; fill: string; hint?: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-graphite" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5" title={i.hint}>
          <span aria-hidden="true" className={cn('size-2.5 rounded-xs', i.fill)} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function BandLegend() {
  return <Legend items={BANDS.slice().reverse().map((b) => ({ label: b, fill: BAND_FILL[b] }))} />
}

// ─── emotion ────────────────────────────────────────────────────────────────

export const EMOTION_FILL: Record<Emotion, string> = {
  Delight: 'bg-emo-delight',
  Interest: 'bg-emo-interest',
  Surprise: 'bg-emo-surprise',
  Neutral: 'bg-emo-neutral',
  Confusion: 'bg-emo-confusion',
  Doubt: 'bg-emo-doubt',
  Frustration: 'bg-emo-frustration',
}
// Unclear (confusion) is drawn dashed and plain, so it is never read as a warning.
const VALENCE_CHIP = { Positive: 'border-emo-warm-line bg-emo-warm-bg text-emo-warm-fg', Neutral: 'border-mist-strong bg-haze text-graphite', Negative: 'border-emo-cold-line bg-emo-cold-bg text-emo-cold-fg', Unclear: 'border-dashed border-mist-strong bg-surface text-graphite' } as const

/**
 * An emotion with its strength. `reads` writes it as an interpretation ("reads as Doubt"), which is how every single
 * face reading is shown. Surprise reads as in between, so it takes the sand tone rather than positive or negative.
 */
export function EmotionChip({ emotion, intensity, corrected, reads, className }: { emotion: Emotion | null; intensity?: string; corrected?: boolean; reads?: boolean; className?: string }) {
  if (!emotion) return <span className={cn(chipBase, 'border-dashed border-mist-strong bg-surface text-muted', className)}>No clear expression</span>
  const cls = emotion === 'Surprise' ? 'border-emo-mid-line bg-emo-mid-bg text-emo-mid-fg' : VALENCE_CHIP[VALENCE[emotion]]
  return (
    <span className={cn(chipBase, cls, className)} title={EMOTION_HINT[emotion]}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', EMOTION_FILL[emotion])} />
      {reads && <span className="font-normal">reads as</span>}
      {emotion}
      {intensity && emotion !== 'Neutral' && <span className="font-normal opacity-80">· {intensity.toLowerCase()}</span>}
      {corrected && <span className="font-normal opacity-80">· corrected</span>}
    </span>
  )
}

/** Every emotion among the faces read, warm to cold. Who had no video is written beside it, never drawn as neutral. */
export function EmotionBar({ split, tall }: { split: EmotionSplit; tall?: boolean }) {
  const label = EMOTIONS.filter((e) => split.counts[e]).map((e) => `${split.counts[e]} ${e.toLowerCase()}`).join(', ')
  if (!split.read) return <div className={cn('rounded-full border border-dashed border-mist-strong', tall ? 'h-3.5' : 'h-2')} role="img" aria-label="No faces read" />
  return (
    <div className={cn('flex overflow-hidden rounded-full bg-haze', tall ? 'h-3.5' : 'h-2')} role="img" aria-label={`${label}, of ${split.read} faces read`}>
      {EMOTIONS.map((e) => (split.counts[e] ? <span key={e} className={cn('h-full', EMOTION_FILL[e])} style={{ width: `${(split.counts[e] / split.read) * 100}%` }} title={`${split.counts[e]} ${e.toLowerCase()}`} /> : null))}
    </div>
  )
}

export function EmotionLegend() {
  return <Legend items={EMOTIONS.map((e) => ({ label: e, fill: EMOTION_FILL[e], hint: EMOTION_HINT[e] }))} />
}

/** How the seven labels are grouped, written out once so the counts everywhere ("3 positive, 2 negative") can be traced. */
export function ValenceKey() {
  return (
    <p className="text-xs text-graphite" data-testid="valence-key">
      <span className="font-medium text-ink">Grouped as</span>{' '}
      {VALENCES.map((v, i) => (
        <span key={v}>
          {i > 0 && ' · '}
          <span className="font-medium">{VALENCE_WORD[v]}</span>: {EMOTIONS.filter((e) => VALENCE[e] === v).join(', ')}
        </span>
      ))}
      . Confusion is shown on its own: it is never counted as negative, and never for or against the words.
    </p>
  )
}

/** The four groups as counts: positive, neutral, negative, then unclear set apart, so they add up to the faces read. */
export function ValenceCounts({ e, className }: { e: EmotionSplit; className?: string }) {
  return (
    <span className={cn('tabular-nums', className)} data-testid="valence-counts">
      <span className="font-semibold text-emo-warm-fg">{e.valence.Positive}</span> positive · {e.valence.Neutral} neutral · <span className="font-semibold text-emo-cold-fg">{e.valence.Negative}</span> negative <span className="text-muted">·</span> <span className="italic">{e.valence.Unclear} unclear</span>
    </span>
  )
}

/** Why some people have no face counted: said once, beside any "of N faces read". Empty when everyone was read. */
export function noReading(e: EmotionSplit) {
  return [e.noVideo ? `${e.noVideo} audio-only` : '', e.unclear ? `${e.unclear} marked no clear expression` : ''].filter(Boolean).join(', ')
}

// ─── voice ──────────────────────────────────────────────────────────────────

const TONE_FILL: Record<Tone, string> = { Animated: 'bg-emo-interest', Even: 'bg-emo-neutral', Flat: 'bg-tone-flat', Tense: 'bg-emo-doubt' }
const TONE_CHIP: Record<Tone, string> = { Animated: VALENCE_CHIP.Positive, Even: VALENCE_CHIP.Neutral, Flat: 'border-mist-strong bg-neutral-bg text-neutral-fg', Tense: VALENCE_CHIP.Negative }

export function ToneChip({ tone }: { tone: Tone }) {
  return (
    <span className={cn(chipBase, TONE_CHIP[tone])} title={TONE_HINT[tone]}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', TONE_FILL[tone])} />
      {tone}
    </span>
  )
}

export function ToneBar({ split, tall }: { split: ToneSplit; tall?: boolean }) {
  return (
    <div className={cn('flex overflow-hidden rounded-full bg-haze', tall ? 'h-3.5' : 'h-2')} role="img" aria-label={`${TONES.map((t) => `${split.counts[t]} ${t.toLowerCase()}`).join(', ')}, of ${split.n}`}>
      {TONES.map((t) => (split.counts[t] ? <span key={t} className={cn('h-full', TONE_FILL[t])} style={{ width: `${(split.counts[t] / split.n) * 100}%` }} title={`${split.counts[t]} ${t.toLowerCase()}`} /> : null))}
    </div>
  )
}

export function ToneLegend() {
  return <Legend items={TONES.map((t) => ({ label: t, fill: TONE_FILL[t], hint: TONE_HINT[t] }))} />
}

// ─── words vs delivery ──────────────────────────────────────────────────────

const FIT_CHIP: Record<FitPattern, string> = {
  Consistent: 'border-mist-strong bg-haze text-graphite',
  Mixed: 'border-pending-line bg-pending-bg text-pending-fg',
  Conflicting: 'border-pending-fg bg-pending-fg text-white',
  'Too few to read': 'border-dashed border-mist-strong bg-surface text-muted',
  'No claim': 'border-dashed border-mist-strong bg-surface text-muted',
}
const FIT_HINT: Record<FitPattern, string> = {
  Consistent: 'Face, voice and hesitation mostly match what the words claim',
  Mixed: 'For some people, one channel or more pulled against the words',
  Conflicting: 'For many people, how they said it clearly pulled against what they said',
  'Too few to read': 'Fewer than three people, too few to read a pattern',
  'No claim': 'These words state a fact or a preference, so there is nothing for the face or voice to disagree with',
}

export function FitChip({ pattern }: { pattern: FitPattern }) {
  return (
    <span className={cn(chipBase, FIT_CHIP[pattern])} title={FIT_HINT[pattern]}>
      {pattern === 'No claim' ? 'No claim' : pattern}
    </span>
  )
}

const ONE_FIT: Record<Fit, string> = { Fits: 'border-mist-strong bg-haze text-graphite', Partly: 'border-pending-line bg-pending-bg text-pending-fg', 'Doesn’t fit': 'border-pending-fg bg-pending-fg text-white' }

export function OneFitChip({ fit, against }: { fit: Fit; against: string[] }) {
  return (
    <span className={cn(chipBase, ONE_FIT[fit])} title={against.length ? `Against the words: ${against.join(', ').toLowerCase()}` : 'Matches the words'}>
      {fit === 'Fits' ? 'Fits the words' : fit === 'Partly' ? 'Partly fits' : 'Doesn’t fit the words'}
    </span>
  )
}

// ─── one moment ─────────────────────────────────────────────────────────────

export const playHref = (studyId: string, sessionId: string, atSec: number) =>
  `${studyPath(studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', sessionId) })}?from=signals&at=${atSec}`

/** How long the answer took to start, against this person's own usual (the tick). Four seconds fills the bar. */
export function DelayBar({ delay, usual, hot }: { delay: number; usual: number; hot: boolean }) {
  const max = 4
  return (
    <span className="relative inline-block h-1.5 w-16 rounded-full bg-haze align-middle" role="img" aria-label={`${delay} seconds, this person usually takes ${usual}`}>
      <span className={cn('absolute inset-y-0 left-0 rounded-full', hot ? 'bg-iris-600' : 'bg-graphite/40')} style={{ width: `${Math.min(delay / max, 1) * 100}%` }} />
      <span className="absolute -top-0.5 h-2.5 w-px bg-ink" style={{ left: `${Math.min(usual / max, 1) * 100}%` }} title={`Usual: ${usual} s`} />
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-baseline gap-x-2 py-1">
      <dt className="text-xs font-medium text-graphite">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

/**
 * One person at one moment, on every channel: the quote, the face (with what was visible, and a way to correct it),
 * the voice against their usual, and the hesitation measurements. Play opens the recording there.
 */
export function PointCard({ point: p, ctx, context }: { point: Point; ctx: CodebookCtx; context: string }) {
  const [fixing, setFixing] = useState(false)
  const signs = signsOf(p.facts, p.usual)
  const face = faceOf(p, ctx.doc)
  const fit = fitOf(p, face)
  const fact = (on: boolean, text: string) => <span className={cn(on ? 'font-medium text-ink' : 'text-graphite')}>{text}</span>
  return (
    <li className="py-3.5 first:pt-1 last:pb-0" data-testid="signal-point" data-band={p.band} data-key={p.key}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite">
        <span className="font-medium text-ink tabular-nums">{p.participantId}</span>
        <span>{petOf(p.participantId)} owner</span>
        <span className="tabular-nums">{mmss(p.atSec)}</span>
        <span className="flex-1" />
        {fit.fit && <OneFitChip fit={fit.fit} against={fit.against} />}
      </div>
      {p.excerpt && <p className="mt-1.5 font-serif text-quote leading-snug text-ink">“{p.excerpt.text}”</p>}
      <dl className="mt-1.5">
        <Row label="Face">
          {face ? (
            <span data-testid="face-reading" data-emotion={face.emotion ?? 'none'}>
              <span className="block text-xs text-graphite" data-testid="face-seen">
                <span className="font-medium text-ink tabular-nums">Seen at {mmss(p.atSec)}</span> ({face.reading.onsetSec} s in): {face.reading.cue.toLowerCase()}.
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <EmotionChip emotion={face.emotion} intensity={face.reading.intensity} corrected={!!face.fix} reads />
                {!face.fix && <span className="text-xs text-graphite">{confidenceBand(face.reading.confidence)} confidence</span>}
                <button type="button" onClick={() => setFixing(true)} className="text-xs font-medium text-iris-700 hover:underline" data-testid="fix-face">
                  {face.fix ? 'Change' : 'Not right?'}
                </button>
              </span>
              {face.fix && (
                <span className="mt-0.5 block text-xs text-graphite">
                  PulseAI read {face.reading.emotion.toLowerCase()}. Corrected by {face.fix.by}: “{face.fix.why}”
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted" data-testid="no-face">
              No reading. This session is audio-only.
            </span>
          )}
        </Row>
        <Row label="Voice">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ToneChip tone={p.voice.tone} />
            <Tooltip content={p.voice.reason} focusable align="left">
              <span className="text-xs text-graphite tabular-nums">
                {p.voice.pace} wpm <span className="text-muted">(usual {p.voice.usualPace})</span> · pitch {p.voice.pitch} st <span className="text-muted">(usual {p.voice.usualPitch})</span>
              </span>
            </Tooltip>
          </span>
        </Row>
        <Row label="Hesitation">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
            <BandChip band={p.band} />
            <span className="inline-flex items-center gap-1.5">
              {fact(signs.includes('delay'), `Delay ${p.facts.delaySec} s`)}
              <DelayBar delay={p.facts.delaySec} usual={p.usual} hot={signs.includes('delay')} />
              <span className="text-muted">usual {p.usual} s</span>
            </span>
            {fact(signs.includes('pause'), `Pause ${p.facts.pauseSec} s`)}
            {fact(signs.includes('fillers'), `${p.facts.fillers} ${p.facts.fillers === 1 ? 'filler' : 'fillers'}`)}
          </span>
        </Row>
      </dl>
      {p.stance && (
        <p className="mt-1 text-xs text-graphite">
          <span className="font-medium">Words: </span>
          {STANCE_LABEL[p.stance].toLowerCase()}
          {fit.against.length > 0 && <>. Against them: {fit.against.join(', ').toLowerCase()}.</>}
        </p>
      )}
      <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="mt-1.5 inline-flex items-center gap-1 rounded-xs text-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${p.participantId} at ${mmss(p.atSec)}`}>
        <PlayIcon size={11} /> Play at {mmss(p.atSec)}
      </Link>
      {face && <CorrectFaceDialog open={fixing} onClose={() => setFixing(false)} point={p} face={face} ctx={ctx} context={context} />}
    </li>
  )
}

// ─── correcting a face reading ──────────────────────────────────────────────

const CHOICES: (Emotion | 'No clear expression')[] = [...EMOTIONS, 'No clear expression']

/** The Researcher can correct what PulseAI read. A reason is required, and the original stays beside the correction. */
function CorrectFaceDialog({ open, onClose, point: p, face, ctx, context }: { open: boolean; onClose: () => void; point: Point; face: Face; ctx: CodebookCtx; context: string }) {
  const toast = useToast()
  const current: Emotion | 'No clear expression' = face.fix ? face.fix.to : face.reading.emotion
  const [pick, setPick] = useState(current)
  const [why, setWhy] = useState('')
  useEffect(() => {
    if (open) {
      setPick(current)
      setWhy('')
    }
  }, [open, current])
  const original = face.reading.emotion
  const restoring = !!face.fix && pick === original
  const changed = pick !== current
  const save = () => {
    ctx.act((d) => correctFace(d, p.key, `${p.participantId} at ${mmss(p.atSec)}, ${context}`, original, pick, { by: ctx.me }, why))
    toast(restoring ? 'PulseAI’s reading restored' : 'Face reading corrected. Every count that uses it has updated.')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct this face reading"
      description={`${p.participantId} at ${mmss(p.atSec)}, ${context}. Your correction replaces PulseAI’s label in every count. The original stays visible.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!changed || !why.trim()} onClick={save} data-testid="fix-confirm">
            {restoring ? 'Restore PulseAI’s reading' : 'Save correction'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <div className="rounded-sm border border-mist bg-paper px-3 py-2.5 text-sm">
          <p className="text-xs text-graphite">
            <span className="font-medium text-ink tabular-nums">Seen at {mmss(p.atSec)}</span> ({face.reading.onsetSec} s in): {face.reading.cue.toLowerCase()}.
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-graphite">PulseAI’s interpretation</span>
            <EmotionChip emotion={original} intensity={face.reading.intensity} reads />
            <span className="text-xs text-graphite">{confidenceBand(face.reading.confidence)} confidence</span>
          </p>
          <Link to={playHref(ctx.studyId, p.sessionId, p.atSec)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-iris-700 hover:underline">
            <PlayIcon size={11} /> Watch it at {mmss(p.atSec)}
          </Link>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">What did you see?</legend>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup">
            {CHOICES.map((c) => (
              <label key={c} className={cn('flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm', pick === c ? 'border-iris-600 bg-iris-50' : 'border-mist hover:bg-haze', c === 'No clear expression' && 'col-span-2')} title={c === 'No clear expression' ? 'Takes this moment out of the face counts' : EMOTION_HINT[c]}>
                <input type="radio" name="face-fix" value={c} checked={pick === c} onChange={() => setPick(c)} className="accent-[var(--color-iris-600)]" />
                {c !== 'No clear expression' && <span aria-hidden="true" className={cn('size-2 rounded-full', EMOTION_FILL[c])} />}
                {c}
                {c === original && <span className="ml-auto text-[11px] text-muted">PulseAI</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <TextArea label="Why" hint="Saved in the change log with your name and the time." rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="She’s squinting at the screen, not doubting it." />
      </div>
    </Modal>
  )
}
