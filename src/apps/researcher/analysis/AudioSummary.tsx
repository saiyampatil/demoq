import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../shared/PageHeader'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { currentUser } from '@/mock/people'
import { screenById, studyPath } from '@/routes/screens'
import { CODEBOOK_STUDY, codeThemes, themeCodes } from '@/state/codebook'
import { buildDraft, chapterTitle, chaptersOf, clock, focusPlan, segmentLabel, staleOf, timeline, type Ctx, type Line } from '@/state/audioScript'
import { addNote, addQuoteText, approve, approvalProblem, backToAI, editLine, editsLost, ensureAudio, isOutOfDate, needsAudio, rebuild, regenerateAudio, removeLine, replaceQuote, restoreLine, rewrite, setVoice, startOver, statusOf, toggleMark, unapprove, updateAudio, useAudioSummary } from '@/state/audioSummary'
import { plural } from '@/state/reportLogic'
import { AnalysisStepper } from './AnalysisStepper'
import { AUDIO } from '@/config/audioSummary'
import { useToast } from '@/components/Toast'
import { AddLine, LineEditor, QuotePicker } from './audio/Editors'
import { inMode, PlayerBar, usePlayback, type PlayMode } from './audio/PlayerBar'
import { StateDot, type Dot } from './report/ws'
import { useAnalysis } from './useAnalysis'

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
const dotOf = (l: Line): Dot => (l.state === 'Approved' ? 'approved' : l.state === 'Edited' ? 'edited' : 'not-approved')
const LABEL = 'text-xs text-graphite'
const ACTION = 'rounded-xs text-graphite underline-offset-2 hover:text-ink hover:underline disabled:opacity-40 disabled:no-underline'
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
  const toast = useToast()
  const [editing, setEditing] = useState<string>()
  const [rewriting, setRewriting] = useState<string>()
  const [instruction, setInstruction] = useState('')
  const [more, setMore] = useState<string>()
  const [picker, setPicker] = useState<{ chapter: string; replace?: string }>()
  const [producing, setProducing] = useState<{ done: number; total: number } | null>(null)
  const [targetSel, setTargetSel] = useState<number>(AUDIO.defaultTarget)
  const [focus, setFocus] = useState('')
  const [focusMsg, setFocusMsg] = useState<string>()
  const [confirmOver, setConfirmOver] = useState(false)
  const [voiceMenu, setVoiceMenu] = useState(false)
  const [removedOpen, setRemovedOpen] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string>()
  const seekBack = useRef<number | null>(null)
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
  // After a line is saved the clock stays where it was and playback is paused: lengths moved under it, the position did not.
  useEffect(() => {
    if (seekBack.current !== null) {
      pb.seek(seekBack.current)
      seekBack.current = null
    }
  }, [tl])
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
      const sel = selected && audio?.lines.find((l) => l.id === selected)
      if ((e.key === 'e' || e.key === 'E') && sel && !e.metaKey && !e.ctrlKey && (sel.type === 'narration' || sel.type === 'note') && !sel.locked) return (e.preventDefault(), setEditing(sel.id))
      if ((e.key === 'a' || e.key === 'A') && sel && ctx && !e.metaKey && !e.ctrlKey) return (e.preventDefault(), updateAudio(studyId, (d) => approve(d, sel.id, me, ctx)))
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
  // ── editing ──
  const save = (next: ReturnType<typeof editLine>) => {
    if (next.problems.length) return setError(next.problems[0])
    setError(undefined)
    seekBack.current = pb.t
    pb.pause()
    updateAudio(studyId, () => next.doc)
  }
  const heard = new Set(live.filter((l) => l.type === 'quote' && l.id !== picker?.replace).map((l) => l.cites[0].participantId))
  const taken = new Set(live.filter((l) => l.type === 'quote').map((l) => `${l.cites[0].sessionId}|${l.cites[0].turnIndex}`))
  const plan = focusPlan(focus, ctx)
  const draftFor = (target: number) => buildDraft(ctx, target, [], plan.first)
  const produce = (ids?: string[]) => {
    const want = (ids ?? needsAudio(audio).map((l) => l.id)).filter((id) => audio.lines.find((l) => l.id === id)?.audio === 'Needs audio')
    if (!want.length || producing) return
    setProducing({ done: 0, total: want.length })
    let done = 0
    const id = setInterval(() => {
      done++
      if (done >= want.length) {
        clearInterval(id)
        updateAudio(studyId, (d) => regenerateAudio(d, want, me).doc)
        setProducing(null)
      } else setProducing({ done, total: want.length })
    }, 350)
  }
  const doRebuild = () => {
    if (!plan.ok) return setFocusMsg(plan.message)
    setFocusMsg(undefined)
    seekBack.current = 0
    updateAudio(studyId, (d) => rebuild(d, draftFor(targetSel), targetSel, me))
  }
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

      <div className="flex flex-col gap-2 rounded-sm border border-mist bg-paper px-3 py-2.5" data-testid="draft-controls">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-sm text-graphite">
            Target length
            <select aria-label="Target length" data-testid="target" value={targetSel} onChange={(e) => setTargetSel(Number(e.target.value))} className="h-8 rounded-sm border border-mist-strong bg-surface px-1.5 text-sm text-ink">
              {AUDIO.targets.map((t) => (
                <option key={t} value={t}>{t} minutes</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-48 flex-1 items-center gap-1.5 text-sm text-graphite">
            Focus
            <input type="text" value={focus} onChange={(e) => { setFocus(e.target.value); setFocusMsg(undefined) }} placeholder="For example: start with price creep" aria-label="Focus" data-testid="focus" className="h-8 min-w-0 flex-1 rounded-sm border border-mist-strong bg-surface px-2 text-sm text-ink" />
          </label>
          <Button size="sm" data-testid="rebuild" onClick={doRebuild}>Rebuild draft</Button>
          <div className="relative">
            <Button size="sm" aria-haspopup="menu" aria-expanded={voiceMenu} onClick={() => setVoiceMenu((v) => !v)} data-testid="voice-menu">Voice ▾</Button>
            {voiceMenu && (
              <div role="menu" className="absolute right-0 z-30 mt-1 flex w-72 flex-col gap-3 rounded-sm border border-mist bg-surface p-3 shadow-md" data-testid="voice-panel">
                <label className="flex items-center justify-between gap-3 text-sm">
                  Narrator
                  <select aria-label="Narrator voice" data-testid="voice-narrator" value={audio.voice.narrator} onChange={(e) => updateAudio(studyId, (d) => setVoice(d, 'narrator', e.target.value, me))} className="h-8 rounded-sm border border-mist-strong bg-surface px-1.5 text-sm text-ink">
                    {AUDIO.narratorVoices.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Quotes
                  <select aria-label="Quote voice" data-testid="voice-quote" value={audio.voice.quote} onChange={(e) => updateAudio(studyId, (d) => setVoice(d, 'quote', e.target.value, me))} className="h-8 rounded-sm border border-mist-strong bg-surface px-1.5 text-sm text-ink">
                    {AUDIO.quoteVoices.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-graphite">A mock. Changing a voice marks the lines it reads “Needs audio”.</p>
              </div>
            )}
          </div>
          <span className="flex-1" />
          {confirmOver ? (
            <span className="flex flex-wrap items-center gap-2 text-sm" data-testid="start-over-confirm">
              <span>Start over? {editsLost(audio)} {editsLost(audio) === 1 ? 'edit' : 'edits'} will be lost.</span>
              <Button size="sm" variant="primary" data-testid="start-over-yes" onClick={() => { if (!plan.ok) return setFocusMsg(plan.message); seekBack.current = 0; updateAudio(studyId, (d) => startOver(d, draftFor(targetSel), targetSel, me)); setConfirmOver(false) }}>Start over</Button>
              <Button size="sm" onClick={() => setConfirmOver(false)}>Keep my edits</Button>
            </span>
          ) : (
            <button type="button" className="text-sm text-graphite underline-offset-2 hover:text-ink hover:underline" data-testid="start-over" onClick={() => setConfirmOver(true)}>Start over…</button>
          )}
        </div>
        {focusMsg && <p className="text-sm text-pending-fg" data-testid="focus-message">{focusMsg}</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button size="sm" data-testid="regen-changed" disabled={status.needsAudio === 0 || !!producing} onClick={() => produce()}>Regenerate changed lines ({status.needsAudio})</Button>
          {producing && <span className="tabular-nums text-graphite" data-testid="producing" role="status">Producing audio, {producing.done + 1} of {producing.total}</span>}
          <span className="text-xs text-graphite">Draft written for {audio.target} minutes. Rebuild keeps lines you approved, edited or added.</span>
        </div>
        {error && <p className="text-sm text-negative-fg" data-testid="edit-error" role="alert">{error}</p>}
      </div>

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
          const removedHere = lines.filter((l) => l.chapter === c && l.removed)
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
                        {editing === l.id && (
                          <div className="mt-2">
                            <LineEditor line={l} ctx={ctx} onSave={(text, src, cites) => { save(editLine(audio, l.id, text, me, ctx, src, cites)); setEditing(undefined) }} onCancel={() => setEditing(undefined)} onBackToAI={l.aiText && l.text !== l.aiText ? () => { seekBack.current = pb.t; pb.pause(); updateAudio(studyId, (d) => backToAI(d, l.id, me)); setEditing(undefined) } : undefined} />
                          </div>
                        )}
                        {rewriting === l.id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="rewrite-box">
                            <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Optional: Shorter, Plainer words" aria-label="How to rewrite it" data-testid="rewrite-instruction" className="h-8 min-w-48 flex-1 rounded-sm border border-mist-strong bg-surface px-2 text-sm" />
                            <Button size="sm" variant="primary" data-testid="rewrite-go" onClick={() => { seekBack.current = pb.t; pb.pause(); updateAudio(studyId, (d) => rewrite(d, l.id, instruction, me)); setRewriting(undefined); setInstruction('') }}>Rewrite</Button>
                            <Button size="sm" onClick={() => setRewriting(undefined)}>Cancel</Button>
                          </div>
                        )}
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
                          {l.edited && <span className="rounded-xs border border-mist-strong px-1 text-graphite" data-testid="edited-tag">Edited</span>}
                          {l.audio === 'Needs audio' && <span className="text-pending-fg" data-testid="needs-audio">Audio out of date</span>}
                          {stale.state !== 'current' && !l.keptAs && <span className="text-pending-fg" data-testid="stale-note">The analysis changed since this was written. {stale.why}.</span>}
                        </p>
                        {editing !== l.id && rewriting !== l.id && !l.locked && (
                          <div className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', selected === l.id ? '' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100')} data-testid="line-actions">
                            {(l.type === 'narration' || l.type === 'note') && <button type="button" className={ACTION} data-testid="edit" onClick={() => setEditing(l.id)}>Edit</button>}
                            {l.type === 'narration' && !!l.alts?.length && <button type="button" className={ACTION} data-testid="rewrite" onClick={() => setRewriting(l.id)}>Rewrite</button>}
                            {l.type === 'quote' && <button type="button" className={ACTION} data-testid="replace" onClick={() => setPicker({ chapter: l.chapter, replace: l.id })}>Replace</button>}
                            {l.type === 'quote' && <button type="button" className={ACTION} data-testid="hear-original" onClick={() => toast(`Original recording (mock): nothing plays. ${l.cites[0].participantId} at ${clock(l.cites[0].atSec)}.`)}>Hear original</button>}
                            {l.audio === 'Needs audio' && <button type="button" className={ACTION} data-testid="regen-audio" disabled={!!producing} onClick={() => produce([l.id])}>Regenerate audio</button>}
                            {l.type !== 'signpost' &&
                              (l.state === 'Approved' ? (
                                <button type="button" className={ACTION} data-testid="unapprove" onClick={() => updateAudio(studyId, (d) => unapprove(d, l.id, me))}>Withdraw approval</button>
                              ) : (
                                <button type="button" className={ACTION} data-testid="approve" disabled={!!approvalProblem(l, ctx)} title={approvalProblem(l, ctx) ?? undefined} onClick={() => updateAudio(studyId, (d) => approve(d, l.id, me, ctx))}>Approve</button>
                              ))}
                            {l.type !== 'signpost' && l.state !== 'Approved' && approvalProblem(l, ctx) && <span className="text-xs text-graphite" data-testid="approve-why">{approvalProblem(l, ctx)}</span>}
                            <span className="relative">
                              <button type="button" className={ACTION} aria-haspopup="menu" aria-expanded={more === l.id} data-testid="more" onClick={() => setMore(more === l.id ? undefined : l.id)}>More ▾</button>
                              {more === l.id && (
                                <span role="menu" className="absolute left-0 z-20 mt-1 flex w-32 flex-col rounded-sm border border-mist bg-surface py-1 shadow-md">
                                  <button role="menuitem" type="button" className="px-3 py-1.5 text-left text-sm hover:bg-haze" data-testid="remove" onClick={() => { setMore(undefined); seekBack.current = pb.t; updateAudio(studyId, (d) => removeLine(d, l.id, me)) }}>Remove</button>
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => updateAudio(studyId, (d) => toggleMark(d, l.id))} aria-pressed={starred} aria-label={starred ? 'Remove bookmark' : 'Bookmark this line'} title={starred ? 'Remove bookmark' : 'Bookmark this line'} data-testid="bookmark" className={cn('h-6 shrink-0 rounded-xs px-1.5 text-sm leading-none hover:bg-haze', starred ? 'text-ink' : 'text-graphite opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
                        {starred ? '★' : '☆'}
                      </button>
                    </li>
                  )
                })}
              </ol>
              {removedHere.length > 0 && (
                <div className="mt-1" data-testid="removed">
                  <button type="button" className={ACTION + ' text-sm'} aria-expanded={removedOpen.has(c)} data-testid="removed-toggle" onClick={() => setRemovedOpen((o) => { const n = new Set(o); n.has(c) ? n.delete(c) : n.add(c); return n })}>
                    {removedOpen.has(c) ? '▾' : '▸'} Removed ({removedHere.length})
                  </button>
                  {removedOpen.has(c) && (
                    <ul className="mt-1">
                      {removedHere.map((l) => (
                        <li key={l.id} data-testid="removed-row" data-id={l.id} className="border-b border-mist py-2 text-sm last:border-b-0">
                          <p className="text-graphite">{l.type === 'quote' ? `“${l.text}”` : l.text}</p>
                          <p className="text-xs text-graphite">Removed by {l.removed!.by}, {new Date(l.removed!.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{' '}
                            <button type="button" className={ACTION + ' text-xs'} data-testid="restore" onClick={() => { seekBack.current = pb.t; updateAudio(studyId, (d) => restoreLine(d, l.id, me)) }}>Restore</button>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {c !== 'about' && c !== 'close' && filter === 'all' && (
                <AddLine chapter={c} ctx={ctx} onNote={(text, src, cites) => save(addNote(audio, c, text, me, ctx, src, cites))} onQuote={() => setPicker({ chapter: c })} />
              )}
            </section>
          )
        })}
        {live.filter(matches).length === 0 && <p className="text-sm text-graphite" data-testid="filter-empty">No lines match.</p>}
      </div>
      <QuotePicker
        open={!!picker}
        title={picker?.replace ? 'Replace this quote' : 'Add a quote'}
        ctx={ctx}
        heard={heard}
        taken={taken}
        onClose={() => setPicker(undefined)}
        onPick={(cite, text, source) => {
          if (!picker) return
          seekBack.current = pb.t
          pb.pause()
          updateAudio(studyId, (d) => (picker.replace ? replaceQuote(d, picker.replace, cite, text, me, ctx) : addQuoteText(d, picker.chapter, cite, text, me, ctx, source)))
          setPicker(undefined)
        }}
      />
      <p className="sr-only" role="status" aria-live="polite" data-testid="announce">{announce}</p>
    </div>
  )
}
