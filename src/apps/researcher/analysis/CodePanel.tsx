import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { BUCKET_WORDS } from '@/config/labels'
import { EMOTIONS, STANCE_LABEL, topEmotions } from '@/state/emotion'
import { personReads, plural, type Bucket, type CodeSignal, type Tension } from '@/state/signals'
import { mmss } from '../review/reviewUi'
import { BandBar, EmotionBar, EmotionChip, FitChip, HesitantNote, PointCard, ToneBar, ValenceCounts, noReading, playHref } from './SignalBits'
import type { CodebookCtx } from './codebookCtx'
import { Tiles, countBuckets } from './panelParts'
import { median, r1 } from './signalsShared'
import { DOT, TEXT, toneOfBucket } from './verdictStyle'

/** One code: its verdict, who fit and who didn't with the evidence for each, and the detail behind it, folded away. */
export function CodePanel({ s, ctx, tensions, theme, onTheme, onOpenTension }: { s: CodeSignal; ctx: CodebookCtx; tensions: Tension[]; theme?: { id: string; name: string }; onTheme: (id: string) => void; onOpenTension: (id: string) => void }) {
  const [bucket, setBucket] = useState<Bucket | null>(null)
  const reads = useMemo(() => personReads(s.moments, ctx.doc), [s.moments, ctx.doc])
  const counts = countBuckets(reads)
  const backed = reads.filter((r) => r.bucket === 'fit' && r.positive).length
  const confused = reads.filter((r) => r.confused).length
  const shown = bucket ? reads.filter((r) => r.bucket === bucket) : reads
  const clearest = reads[0]?.point
  const e = s.emotions
  const tops = topEmotions(e)
  const delay = r1(median(s.points.map((p) => p.facts.delaySec)))
  const usual = r1(median(s.points.map((p) => p.usual)))
  const stance = s.points[0]?.stance
  const off = s.tones.counts.Flat + s.tones.counts.Tense

  return (
    <section aria-label={`Signals for ${s.code.name}`} data-testid="signal-panel" className="flex max-h-[calc(100vh-8rem)] flex-col rounded-md border border-mist bg-surface">
      <div className="flex-1 overflow-y-auto">
        <header className="px-5 pt-4 pb-3">
          {theme && (
            <button type="button" onClick={() => onTheme(theme.id)} className="text-xs font-medium text-iris-700 hover:underline" data-testid="code-theme-link">
              ← {theme.name}
            </button>
          )}
          <div className="mt-1.5 flex items-start gap-2">
            <h2 className="min-w-0 flex-1 text-lg leading-snug font-semibold">{s.code.name}</h2>
            {s.readable && (
              <span className="mt-0.5 shrink-0" data-testid="panel-verdict">
                <FitChip pattern={s.fit.pattern} />
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-graphite">{s.code.definition}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-graphite tabular-nums">
            <span>
              Said by {s.people} of {s.of}
            </span>
            <span className="text-muted" data-testid="asked-line">
              Asked: {s.of} of {ctx.basis.participants.size} people
            </span>
            {clearest && (
              <Link to={playHref(ctx.studyId, clearest.sessionId, clearest.atSec)} className="inline-flex items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" data-testid="code-play">
                <PlayIcon size={11} /> Play the clearest moment · {clearest.participantId} at {mmss(clearest.atSec)}
              </Link>
            )}
          </p>
        </header>

        {s.readable ? (
          <section aria-label="Who fit" className="border-t border-mist px-5 py-3.5" data-testid="channels">
            <Tiles counts={counts} backed={backed} active={bucket} onPick={setBucket} />
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted" data-testid="delivery-breakdown">
              <span data-testid="breakdown-line">
                {reads.length} of {s.people} took a position{confused > 0 ? ` · ${confused} confused, not counted` : ''}
              </span>
              <HesitantNote points={s.points} doc={ctx.doc} of={s.of} />
            </div>
          </section>
        ) : (
          <p className="border-t border-mist px-5 py-3.5 text-sm">Only {plural(s.people, 'person')} said this, which is too few to read a pattern. Their moments are below.</p>
        )}

        {tensions.length > 0 && (
          <section aria-label="Related tensions" className="border-t border-mist px-5 py-3.5">
            <h3 className="text-sm font-semibold">Tensions</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {tensions.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTension(t.id)} data-testid="related-tension" className="flex w-full items-start gap-1.5 rounded-xs text-left text-sm text-iris-700 hover:underline">
                    <span className="min-w-0 flex-1">{t.title}</span>
                    <span className="mt-0.5 shrink-0 text-xs text-graphite">{t.status === 'Suggested' ? 'To review' : t.status}</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="People" className="border-t border-mist px-5 py-3.5">
          <h3 className="text-sm font-semibold">
            People <span className="font-normal text-graphite tabular-nums">{shown.length}</span>
          </h3>
          <ul className="mt-1 divide-y divide-mist" data-testid="people-list">
            {(s.readable ? shown : reads).map((r) => (
              <li key={r.participantId} className="py-2" data-testid="person-row" data-bucket={r.bucket} data-person={r.participantId}>
                <p className="flex items-center gap-2 text-xs">
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[toneOfBucket(r.bucket)])} />
                  <span className={cn('font-medium', TEXT[toneOfBucket(r.bucket)])}>{BUCKET_WORDS[r.bucket]}</span>
                  <span className="text-graphite" data-testid="person-reason">
                    {r.reason}
                  </span>
                </p>
                <ul>
                  <PointCard point={r.point} ctx={ctx} context={s.code.name} hideFit />
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <details className="border-t border-mist px-5 py-3" data-testid="code-details">
          <summary className="cursor-pointer text-sm font-semibold select-none">Details</summary>
          <div className="mt-2 flex flex-col gap-3 text-xs text-graphite">
            <p>
              <span className="font-medium">Words:</span> {stance ? STANCE_LABEL[stance] : '—'}
            </p>
            <div data-testid="channel-face">
              <p className="mb-1 font-medium">Face</p>
              <EmotionBar split={e} tall />
              <p className="mt-1 tabular-nums">
                {tops.length ? `${e.read} faces read` : 'No faces read'}
                {noReading(e) && ` (${noReading(e)})`}. <ValenceCounts e={e} />
              </p>
              {e.read > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  {EMOTIONS.filter((x) => e.counts[x]).map((x, _i, xs) => (
                    <span key={x} className="inline-flex items-center gap-1 tabular-nums">
                      <EmotionChip emotion={x} />
                      {xs.length > 1 && <> {e.counts[x]}</>}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <div data-testid="channel-speech">
              <p className="mb-1 font-medium">Tone</p>
              <ToneBar split={s.tones} tall />
              <p className="mt-1 tabular-nums">Flat or tense for {off} of {s.tones.n}. Animated {s.tones.counts.Animated}, even {s.tones.counts.Even}.</p>
              <p className="mt-2 mb-1 font-medium" data-testid="certainty-chip">
                Certainty: {s.pattern === 'Often hesitant' ? 'often hesitant' : s.pattern === 'Mixed' ? 'some hesitation' : s.pattern === 'Mostly steady' ? 'steady' : 'too few to read'}
              </p>
              <BandBar split={{ counts: { Steady: s.steady, 'Some hesitation': s.some, 'Marked hesitation': s.marked }, n: s.people }} tall />
              <p className="mt-1 tabular-nums">
                Marked hesitation in {s.marked} of {s.people}, some in {s.some}. Median delay {delay} s, against a usual {usual} s.
              </p>
            </div>
            <p className="text-muted" data-testid="origin">
              Origin: {s.code.isNew ? 'new code' : 'guide question'}
            </p>
          </div>
        </details>
      </div>
    </section>
  )
}
