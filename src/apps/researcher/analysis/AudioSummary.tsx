import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../shared/PageHeader'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { currentUser } from '@/mock/people'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY, codeThemes, themeCodes } from '@/state/codebook'
import { chapterTitle, chaptersOf, clock, segmentLabel, staleOf, timeline, type Ctx, type Line } from '@/state/audioScript'
import { ensureAudio, isOutOfDate, statusOf, toggleMark, updateAudio, useAudioSummary } from '@/state/audioSummary'
import { plural } from '@/state/reportLogic'
import { AnalysisStepper } from './AnalysisStepper'
import { AUDIO } from '@/config/audioSummary'
import { inMode, PlayerBar, usePlayback, type PlayMode } from './audio/PlayerBar'
import { StateDot, type Dot } from './report/ws'
import { useAnalysis } from './useAnalysis'

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
const dotOf = (l: Line): Dot => (l.state === 'Approved' ? 'approved' : l.state === 'Edited' ? 'edited' : 'not-approved')
const LABEL = 'text-xs text-graphite'
type Filter = 'all' | 'unapproved' | 'audio' | 'stale' | 'uncited' | 'marked'

/** The words of the line being said, lit up as the clock reaches them: the words spoken so far are dark, the rest lighter. */
function Spoken({ text, progress }: { text: string; progress: number }) {
  const parts = text.split(/(\s+)/)
  const words = parts.filter((x) => x.trim()).length
  const upto = Math.floor(progress * words + 0.0001)
  let seen = 0
  return (
    <span data-testid="spoken-line">
      {parts.map((x, i) => {
        if (!x.trim()) return x
        const spoken = seen < upto
        seen++
        return <span key={i} data-spoken={spoken} className={spoken ? 'text-ink' : 'text-graphite'}>{x}</span>
      })}
    </span>
  )
}

/** Who is speaking a line, in words. Respondent words, AI lines and researcher notes are always told apart. */
const speakerOf = (l: Line) =>
  l.type === 'quote' ? `Participant quote · ${l.cites[0].participantId} · ${segmentLabel(l.cites[0].participantId)}` : l.type === 'note' ? `Researcher’s note · ${l.author}` : l.type === 'frame' ? 'Locked line' : l.type === 'signpost' ? 'Signpost' : 'Narrator, AI-written'

const positionKey = (studyId: string) => `pulseai-qual:audio-position:${studyId}`
/** The same script retimed for what is played: lines out of the mode drop out and the rest run on from each other. */
function retime(tl: ReturnType<typeof timeline>, mode: PlayMode) {
  let t = 0
  return tl.filter((l) => inMode(l.type, mode)).map((l) => {
    const out = { ...l, start: t }
    t += l.seconds
    return out
  })
}

/** A3, Audio summary. A spoken summary written from the approved themes and tensions. Every claim links to the words people said. */
export function AudioSummaryPage() {
  const { studyId, study, review, doc, basis, accepted, ready } = useAnalysis()
  const audio = useAudioSummary(studyId)
  const [params] = useSearchParams()
  const me = currentUser.name
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(params.get('demo') === 'error')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string>()
  const [follow, setFollow] = useState(true)
  const [mode, setMode] = useState<PlayMode>('all')
  const [view, setView] = useState<'read' | 'listen'>('read')
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState(0)
  const [resumeAt, setResumeAt] = useState<number>()
  const [announce, setAnnounce] = useState('')
  const rows = useRef<Record<string, HTMLElement | null>>({})
  const excluded = review.filter((r) => r.status === 'Excluded').length

  const ctx: Ctx | undefined = useMemo(() => (doc ? { doc, basis, studyName: study?.name ?? '', release: study?.releaseVersion ?? 'Release v1.0' } : undefined), [doc, basis, study])
  const themes = useMemo(() => (doc ? codeThemes(doc).filter((t) => themeCodes(doc, t).length > 0) : []), [doc])

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(t)
  }, [studyId])
  useEffect(() => {
    if (ready && ctx && themes.length >= 2) ensureAudio(studyId, ctx, me)
  }, [ready, ctx, themes.length, studyId, me])

  const lines = audio?.lines ?? []
  const full = useMemo(() => timeline(lines), [lines])
  const tl = useMemo(() => retime(full, mode), [full, mode])
  const chapters = useMemo(() => chaptersOf(lines.filter((l) => !l.removed)), [lines])
  const pb = usePlayback(tl)
  const current = tl[pb.index]
  const fullSeconds = full.length ? full[full.length - 1].start + full[full.length - 1].seconds : 0

  // Where the listener was, kept so the next visit can offer to pick up there. Never started by itself.
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(positionKey(studyId)))
      if (v > 0) setResumeAt(v)
    } catch {
      // Storage blocked.
    }
  }, [studyId])
  useEffect(() => {
    if (!pb.playing) return
    try {
      localStorage.setItem(positionKey(studyId), String(Math.floor(pb.t)))
    } catch {
      // Storage blocked.
    }
  }, [Math.floor(pb.t / 2), pb.playing])

  // Follow along: the current line scrolls into view, instantly. Only while playing, so the page doesn't move on its own otherwise.
  useEffect(() => {
    if (follow && pb.playing && current) rows.current[current.id]?.scrollIntoView({ block: 'center' })
  }, [current?.id, follow, pb.playing])
  useEffect(() => {
    if (current) setAnnounce(`${pb.playing ? 'Playing' : 'Paused'}, line ${pb.index + 1} of ${tl.length}: ${current.text}. ${current.state}.`)
  }, [current?.id, pb.playing])

  // Space plays and pauses; the arrow keys move between lines. Not while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || (e.key === ' ' && /^(BUTTON|A)$/.test(el.tagName))) return
      if (e.key === ' ') (e.preventDefault(), pb.toggle())
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') (e.preventDefault(), pb.next())
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') (e.preventDefault(), pb.prev())
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const header = (
    <>
      <p>
        <Link to={studyPath(studyId, screenById.A3)} className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline" data-testid="back-to-report">
          ‹ Back to Report
        </Link>
      </p>
      <PageHeader
        id="A3"
        title="Audio summary"
        description="A spoken summary of the study, written from the themes and tensions you approved. Every claim links to the exact words people said."
        actions={
          ready && doc ? (
            <label className="flex items-center gap-2 text-sm text-graphite">
              Lens
              <select aria-label="Lens" data-testid="lens-select" defaultValue="whole" className={controlBase + ' h-9 pr-8 text-sm text-ink'}>
                <option value="whole">Whole study</option>
                <option disabled>Make a lens in Tools › Lens builder</option>
              </select>
            </label>
          ) : undefined
        }
      />
      <AnalysisStepper studyId={studyId} current="report" />
    </>
  )

  if (!study) return null
  if (!ready || !doc || themes.length === 0)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface">
          <EmptyState title="No approved themes yet" description="The summary is written from themes you approved, in sessions accepted in Review." action={<Button to={studyPath(CODEBOOK_STUDY, screenById.A1)}>Go to the codebook</Button>} />
        </div>
      </div>
    )
  if (failed)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface">
          <ErrorState title="The audio summary didn’t load" description="Nothing was lost. Try again." onRetry={() => setFailed(false)} />
        </div>
      </div>
    )
  if (themes.length < 2)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-dashed border-mist-strong bg-surface" data-testid="not-enough">
          <EmptyState title="Not enough approved material for a summary" description="Approve at least two themes in the codebook and a summary can be written." action={<Button to={studyPath(studyId, screenById.A1)}>Go to the codebook</Button>} />
        </div>
      </div>
    )
  if (!loaded || !audio || !ctx)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-md border border-mist bg-surface p-5" role="status">
          <LoadingState label={`Writing the summary from ${plural(accepted.length, 'accepted session')}`} rows={6} />
        </div>
      </div>
    )

  const status = statusOf(audio, ctx)
  const live = lines.filter((l) => !l.removed)
  const matches = (l: Line) => (filter === 'all' ? true : filter === 'unapproved' ? l.state !== 'Approved' : filter === 'audio' ? l.audio === 'Needs audio' : filter === 'stale' ? isOutOfDate(l, ctx) : filter === 'marked' ? (audio.marks ?? []).includes(l.id) : l.type === 'narration' && l.cites.length === 0)
  const claimCount = status.claims
  const startOf = new Map(tl.map((l) => [l.id, l]))
  const marks = audio.marks ?? []
  const q = query.trim().toLowerCase()
  const found = q.length >= 2 ? full.filter((l) => l.text.toLowerCase().includes(q)).map((l) => l.id) : []
  const goTo = (id: string) => {
    const t = startOf.get(id)
    if (t) pb.seek(t.start)
    setSelected(id)
    rows.current[id]?.scrollIntoView({ block: 'center' })
  }
  const stepHit = (by: number) => {
    if (!found.length) return
    const next = (hit + by + found.length) % found.length
    setHit(next)
    goTo(found[next])
  }
  const nextLine = tl[pb.index + 1]
  const prevLine = tl[pb.index - 1]
  const mark = (text: string) => {
    if (q.length < 2) return text
    const i = text.toLowerCase().indexOf(q)
    return i < 0 ? text : <>{text.slice(0, i)}<mark className="rounded-xs bg-pending-bg px-0.5 text-ink" data-testid="match">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
  }
  // The line being said lights up word by word; every other line shows the search match, if any.
  const body = (l: Line, isCurrent: boolean) => {
    const t = startOf.get(l.id)
    if (!isCurrent || !t) return mark(l.text)
    return <Spoken text={l.text} progress={Math.min(1, Math.max(0, (pb.t - t.start) / Math.max(0.1, t.seconds - AUDIO.pauseSec)))} />
  }
  const link = (f: Filter, text: string, n: number | string, testid: string) => (
    <button type="button" onClick={() => setFilter(filter === f ? 'all' : f)} aria-pressed={filter === f} data-testid={testid} className={cn('rounded-xs underline-offset-2 hover:text-ink hover:underline', filter === f && 'font-medium text-ink underline')}>
      {text} {n}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}
      <p className="text-sm text-graphite" data-testid="built-on">
        <span className="font-medium text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
        {' · '}
        {excluded > 0 ? `${excluded} excluded left out` : 'none excluded'}
        {study.releaseVersion && <> · {study.releaseVersion}</>}
      </p>

      <PlayerBar p={pb} timeline={tl} chapters={chapters} ctx={ctx} follow={follow} onFollow={setFollow} onChapter={(key) => rows.current[`chapter:${key}`]?.scrollIntoView({ block: 'start' })} fullLength={fullSeconds} mode={mode} onMode={(m) => { setMode(m); pb.seek(0) }} resumeAt={resumeAt} onResume={() => { pb.seek(resumeAt ?? 0); setResumeAt(undefined) }} />

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite tabular-nums" data-testid="status-strip">
        <span>Written {hhmm(audio.writtenAt)}</span>·<span data-testid="count-lines">{plural(status.lines, 'line')}</span>·
        <span data-testid="count-cited">{link('uncited', 'Claims cited', `${status.cited} of ${claimCount}`, 'filter-uncited')}</span>·
        {link('unapproved', 'Approved', `${status.approved} of ${status.lines}`, 'filter-unapproved')}·
        {link('audio', 'Needs audio', status.needsAudio, 'filter-audio')}·
        {link('stale', 'Out of date', status.outOfDate, 'filter-stale')}
        {marks.length > 0 && <>·{link('marked', 'Bookmarked', marks.length, 'filter-marked')}</>}
        {filter !== 'all' && (
          <button type="button" className="ml-2 underline-offset-2 hover:text-ink hover:underline" onClick={() => setFilter('all')} data-testid="filter-clear">Show all lines</button>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="script-tools">
        <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-xs border border-mist" data-testid="view">
          {(['read', 'listen'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} data-testid={`view-${v}`} onClick={() => setView(v)} className={cn('px-2.5 py-1 text-sm font-medium', view === v ? 'bg-ink text-white' : 'bg-surface text-graphite hover:bg-haze')}>
              {v === 'read' ? 'Read' : 'Listen'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <span className="sr-only">Search the script</span>
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setHit(0) }} placeholder="Search the script" aria-label="Search the script" data-testid="script-search" className="h-8 w-56 rounded-sm border border-mist-strong bg-surface px-2 text-sm text-ink" />
        </label>
        {q.length >= 2 && (
          <span className="flex items-center gap-2 text-sm text-graphite">
            <span data-testid="search-count">{found.length} {found.length === 1 ? 'match' : 'matches'}</span>
            <button type="button" className="rounded-xs border border-mist-strong px-2 py-0.5 hover:bg-haze disabled:opacity-40" disabled={!found.length} onClick={() => stepHit(-1)} data-testid="search-prev" aria-label="Previous match">‹</button>
            <button type="button" className="rounded-xs border border-mist-strong px-2 py-0.5 hover:bg-haze disabled:opacity-40" disabled={!found.length} onClick={() => stepHit(1)} data-testid="search-next" aria-label="Next match">›</button>
          </span>
        )}
      </div>

      {view === 'listen' && current && (
        <section aria-label="Listening view" className="max-w-[720px] py-6" data-testid="listen">
          <p className="text-sm text-graphite" data-testid="listen-where">Line {pb.index + 1} of {tl.length}</p>
          {prevLine && (
            <div className="mt-4 opacity-70" data-testid="listen-prev-wrap">
              <p className="text-xs text-graphite" data-testid="listen-prev-label">{chapterTitle(prevLine.chapter, ctx)} · {speakerOf(prevLine)}</p>
              <p className="text-base text-ink" data-testid="listen-prev">{prevLine.text}</p>
            </div>
          )}
          <div className="my-4" data-testid="listen-current-wrap">
            <p className="text-sm text-graphite" data-testid="listen-speaker">{chapterTitle(current.chapter, ctx)} · {speakerOf(current)}</p>
            <p className={cn('mt-1 leading-snug text-ink', current.type === 'quote' ? 'border-l-2 border-mist-strong pl-4 font-serif text-[26px]' : 'text-[26px] font-medium')} data-testid="listen-current" aria-live="off">
              <Spoken text={current.text} progress={Math.min(1, Math.max(0, (pb.t - current.start) / Math.max(0.1, current.seconds - AUDIO.pauseSec)))} />
            </p>
          </div>
          {nextLine && (
            <div className="opacity-70" data-testid="listen-next-wrap">
              <p className="text-xs text-graphite" data-testid="listen-next-label">{chapterTitle(nextLine.chapter, ctx)} · {speakerOf(nextLine)}</p>
              <p className="text-base text-ink" data-testid="listen-next">{nextLine.text}</p>
            </div>
          )}
        </section>
      )}

      <div className={cn('max-w-[720px]', view === 'listen' && 'hidden')} data-testid="script">
        {chapters.map((c) => {
          const inChapter = live.filter((l) => l.chapter === c)
          const shown = inChapter.filter(matches)
          if (!shown.length) return null
          const secs = tl.filter((l) => l.chapter === c).reduce((n, l) => n + l.seconds, 0)
          const approved = inChapter.filter((l) => l.state === 'Approved').length
          let aiLabelled = false
          return (
            <section key={c} aria-label={chapterTitle(c, ctx)} data-testid="chapter" data-chapter={c} className="mb-8">
              <header ref={(el) => { rows.current[`chapter:${c}`] = el }} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-mist pb-1.5" data-testid="chapter-head">
                <h2 className="text-lg font-semibold">{chapterTitle(c, ctx)}</h2>
                <span className="text-sm text-graphite tabular-nums" data-testid="chapter-length">{clock(secs)}</span>
                <span className="text-sm text-graphite tabular-nums" data-testid="chapter-approved">{approved} of {inChapter.length} approved</span>
              </header>
              <ol>
                {shown.map((l) => {
                  const t = startOf.get(l.id)
                  const isCurrent = current?.id === l.id
                  // One line is lit: the one being played, or, when paused, the one selected (else the one the clock is at).
                  const lit = (pb.playing ? current?.id : (selected ?? current?.id)) === l.id
                  const starred = marks.includes(l.id)
                  const stale = staleOf(l, ctx)
                  const showAI = l.type === 'narration' && !aiLabelled && ((aiLabelled = true), !l.edited)
                  return (
                    <li
                      key={l.id}
                      ref={(el) => { rows.current[l.id] = el }}
                      data-testid="line"
                      data-id={l.id}
                      data-key={l.key ?? ''}
                      data-type={l.type}
                      data-state={l.state}
                      data-current={isCurrent}
                      data-selected={selected === l.id}
                      data-lit={lit}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={cn('group flex gap-3 border-b border-mist py-2.5', lit && 'bg-iris-50', !isCurrent && pb.playing && follow && 'opacity-75', !t && 'opacity-50')}
                    >
                      <button type="button" onClick={() => { if (t) pb.seek(t.start); setSelected(l.id) }} aria-label={t ? `Go to ${clock(t.start)}: ${l.text}` : `Select, not played in this mode: ${l.text}`} data-testid="line-jump" data-skipped={!t} className="w-10 shrink-0 pt-0.5 text-left text-xs tabular-nums text-graphite hover:text-ink">
                        {t ? clock(t.start) : '–'}
                      </button>
                      <span className="pt-1"><StateDot dot={dotOf(l)} why={l.state === 'Approved' ? undefined : l.state === 'Edited' ? 'edited, not approved yet' : 'waiting for your approval'} /></span>
                      <div className="min-w-0 flex-1">
                        {l.type === 'quote' ? (
                          <div className="border-l-2 border-mist-strong pl-3">
                            <p className="font-serif leading-snug text-ink" data-testid="line-text">“{body(l, isCurrent)}”</p>
                            <p className={LABEL} data-testid="line-label">Quote · {l.cites[0].participantId} · {segmentLabel(l.cites[0].participantId)}</p>
                          </div>
                        ) : (
                          <>
                            {l.type === 'note' && <p className={LABEL} data-testid="line-label">Researcher’s note · {l.author}</p>}
                            {l.type === 'frame' && <p className={LABEL} data-testid="line-label">{l.key === 'frame-open' ? 'Opening, locked' : 'Closing, locked'}</p>}
                            {l.type === 'signpost' && <p className={LABEL} data-testid="line-label">Signpost</p>}
                            {showAI && <p className={LABEL} data-testid="ai-label">AI-written</p>}
                            <p className="text-base leading-snug text-ink" data-testid="line-text">
                              {body(l, isCurrent)}
                              {l.cites.length > 0 && l.type === 'narration' && (
                                <sup className="ml-0.5">
                                  <button type="button" onClick={() => setSelected(l.id)} data-testid="cite-mark" aria-label={`${l.cites.length === 1 ? 'Source 1' : `Sources 1 to ${l.cites.length}`}`} className="rounded-xs px-0.5 text-[11px] font-semibold text-iris-700 hover:bg-haze">
                                    {l.cites.length === 1 ? '1' : `1–${l.cites.length}`}
                                  </button>
                                </sup>
                              )}
                            </p>
                          </>
                        )}
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                          {l.edited && <span className="rounded-xs border border-mist-strong px-1 text-graphite" data-testid="edited-tag">Edited</span>}
                          {l.audio === 'Needs audio' && <span className="text-pending-fg" data-testid="needs-audio">Audio out of date</span>}
                          {stale.state !== 'current' && !l.keptAs && <span className="text-pending-fg" data-testid="stale-note">The analysis changed since this was written. {stale.why}.</span>}
                        </p>
                      </div>
                      <button type="button" onClick={() => updateAudio(studyId, (d) => toggleMark(d, l.id))} aria-pressed={starred} aria-label={starred ? 'Remove bookmark' : 'Bookmark this line'} title={starred ? 'Remove bookmark' : 'Bookmark this line'} data-testid="bookmark" className={cn('h-6 shrink-0 rounded-xs px-1.5 text-sm leading-none hover:bg-haze', starred ? 'text-ink' : 'text-graphite opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
                        {starred ? '★' : '☆'}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
        {live.filter(matches).length === 0 && <p className="text-sm text-graphite" data-testid="filter-empty">No lines match.</p>}
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-testid="announce">{announce}</p>
    </div>
  )
}
