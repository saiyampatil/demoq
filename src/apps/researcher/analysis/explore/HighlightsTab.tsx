import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { PlayIcon, SearchIcon } from '@/components/icons'
import { LoadingState } from '@/components/States'
import { useToast } from '@/components/Toast'
import { screenById, studyPath } from '@/routes/screens'
import { addIdeaCode, denominator, dismissSuggestion, peopleOf, questionOf, restoreSuggestion } from '@/state/codebook'
import { uid } from '@/state/brief'
import { MIN_IDEA_LENGTH, currentCodeGroups, matchedWords, proposalFor, scanIdea, type Hit, type ScanResult } from '@/state/highlights'
import { mmss } from '../../review/reviewUi'
import type { CodebookCtx } from '../codebookCtx'

const DEBOUNCE_MS = 300
/** Mock delay, so the scan feels like a scan. */
const SCAN_MS = 400
const EXAMPLES = ['pause when we travel', 'too much food', 'vet']

type Phase = 'idle' | 'loading' | 'done' | 'error'

/**
 * Real-time highlights (brief step 7): type an idea, and the accepted interviews are scanned for it. Matching quotes are
 * proposed as one code. Scanning changes nothing; only Accept writes to the codebook.
 */
export function HighlightsTab({ ctx }: { ctx: CodebookCtx }) {
  const { doc, basis } = ctx
  const toast = useToast()
  const [idea, setIdea] = useState('')
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [scan, setScan] = useState<ScanResult>()
  const [tries, setTries] = useState(0)
  // ?demo=explore-error makes the first scan fail, so the error state can be seen.
  const [forceError, setForceError] = useState(() => new URLSearchParams(window.location.search).get('demo') === 'explore-error')

  // The scan starts 300 ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQuery(idea.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [idea])

  useEffect(() => {
    if (query.length < MIN_IDEA_LENGTH) {
      setPhase('idle')
      setScan(undefined)
      return
    }
    setPhase('loading')
    const t = setTimeout(() => {
      try {
        if (forceError) throw new Error('The scan failed')
        setScan(scanIdea(query, basis))
        setPhase('done')
      } catch {
        setPhase('error')
      }
    }, SCAN_MS)
    return () => clearTimeout(t)
    // A retry scans the same words again.
  }, [query, basis, forceError, tries])

  const typing = idea.trim() !== query
  const dismissed = !!scan && doc.dismissedSuggestions.includes(scan.key)

  return (
    <div className="flex flex-col gap-5" data-testid="highlights">
      <CurrentCodes ctx={ctx} />

      <section aria-label="Find an idea" className="flex flex-col gap-3">
        <div>
          <label htmlFor="idea" className="text-sm font-semibold">
            Type an idea or question
          </label>
          <p className="mt-0.5 text-xs text-graphite">PulseAI scans the accepted interviews as you type, and proposes a code from what it finds. Nothing is added until you accept.</p>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            <SearchIcon size={14} />
          </span>
          <input
            id="idea"
            data-testid="idea-input"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="For example: pause when we travel"
            autoComplete="off"
            className="h-10 w-full rounded-sm border border-mist-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:border-iris-600 focus:shadow-[0_0_0_3px_var(--color-iris-100)]"
          />
        </div>

        {phase === 'idle' && !idea.trim() && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-graphite">
            Try
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => setIdea(e)} className="rounded-full border border-mist-strong px-2.5 py-0.5 font-medium text-iris-700 hover:bg-iris-50">
                {e}
              </button>
            ))}
          </p>
        )}

        {(phase === 'loading' || (typing && phase !== 'idle')) && idea.trim().length >= MIN_IDEA_LENGTH && (
          <div role="status" aria-live="polite" data-testid="scanning" className="rounded-md border border-mist bg-paper">
            <p className="px-4 pt-3 text-sm font-medium">Scanning {basis.sessions.size} accepted interviews…</p>
            <LoadingState label={`Scanning ${basis.sessions.size} accepted interviews`} rows={3} className="px-4 pt-3 pb-4" />
          </div>
        )}

        {phase === 'error' && !typing && (
          <Banner
            tone="danger"
            title="The scan didn’t finish"
            actions={
              <Button
                size="sm"
                data-testid="scan-retry"
                onClick={() => {
                  setForceError(false)
                  setTries((n) => n + 1)
                }}
              >
                Try again
              </Button>
            }
          >
            Nothing was changed. Try scanning again.
          </Banner>
        )}

        {phase === 'done' && !typing && scan && !dismissed && <Results key={scan.key} ctx={ctx} scan={scan} onDone={() => setIdea('')} />}

        {phase === 'done' && !typing && scan && dismissed && (
          <div className="rounded-md border border-mist bg-paper px-4 py-3 text-sm" data-testid="idea-dismissed">
            <p className="font-medium">You dismissed this idea earlier, so it isn’t offered again.</p>
            <p className="mt-0.5 text-graphite">Change the wording to look again, or offer it again.</p>
            <Button
              size="sm"
              className="mt-2"
              data-testid="idea-restore"
              onClick={() => {
                ctx.act((d) => restoreSuggestion(d, scan.key))
                toast('Idea offered again')
              }}
            >
              Offer it again
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── the codes there are now ────────────────────────────────────────────────

function CurrentCodes({ ctx }: { ctx: CodebookCtx }) {
  const { doc, basis } = ctx
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase()
    return currentCodeGroups(doc)
      .map((g) => ({ ...g, codes: g.codes.filter((c) => !t || c.name.toLowerCase().includes(t) || c.definition.toLowerCase().includes(t)) }))
      .filter((g) => g.codes.length)
  }, [doc, q])
  const total = doc.codes.filter((c) => c.status === 'Accepted').length
  return (
    <section aria-label="Current codes" data-testid="current-codes">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Current codes</h3>
        <span className="text-xs text-graphite tabular-nums" data-testid="current-codes-count">
          {total} accepted
        </span>
      </div>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted">
          <SearchIcon size={13} />
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the current codes" placeholder="Search the codes" className="h-8 w-full rounded-sm border border-mist-strong bg-surface pr-3 pl-8 text-sm outline-none placeholder:text-muted focus:border-iris-600" />
      </div>
      <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-mist">
        {groups.length === 0 ? (
          <p className="px-3 py-3 text-sm text-graphite">No accepted code matches.</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="border-b border-mist last:border-0">
              <p className="bg-haze px-3 py-1 text-xs font-medium text-graphite">{g.label}</p>
              <ul>
                {g.codes.map((c) => (
                  <li key={c.id} data-testid="current-code" className="flex items-baseline gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="shrink-0 text-xs text-graphite tabular-nums">
                      {peopleOf(c, basis).size} of {denominator(c, basis)} people
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

// ─── what was found ─────────────────────────────────────────────────────────

function Results({ ctx, scan, onDone }: { ctx: CodebookCtx; scan: ScanResult; onDone: () => void }) {
  const { doc } = ctx
  const toast = useToast()
  const [left, setLeft] = useState<Set<string>>(new Set())
  const [name, setName] = useState(() => proposalFor(scan)?.name ?? '')
  const [definition, setDefinition] = useState(() => proposalFor(scan)?.definition ?? '')
  const included = scan.hits.filter((h) => !left.has(h.key))
  const proposal = useMemo(() => proposalFor(scan, included), [scan, included])

  if (!scan.hits.length) {
    return (
      <div className="rounded-md border border-dashed border-mist-strong bg-paper px-4 py-6 text-center text-sm text-graphite" data-testid="no-matches">
        {scan.stems.length ? 'No matches in the accepted interviews for this wording. Try a different word.' : 'Those are all common words. Add a more specific word to look for.'}
      </div>
    )
  }

  const clash = doc.codes.some((c) => c.status !== 'Merged' && c.name.trim().toLowerCase() === name.trim().toLowerCase())
  const canAccept = !!proposal && !!name.trim() && !!definition.trim() && !clash
  const question = proposal?.questionId ? questionOf(proposal.questionId).label : 'Outside the guide'

  const toggle = (key: string) =>
    setLeft((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const accept = () => {
    if (!proposal || !canAccept) return
    const id = uid('c-hl')
    ctx.act((d) =>
      addIdeaCode(
        d,
        id,
        {
          name,
          definition,
          idea: scan.idea,
          questionId: proposal.questionId,
          anchorQuestionId: proposal.anchorQuestionId,
          quotes: proposal.hits.map((h) => ({ sessionId: h.sessionId, participantId: h.participantId, turnIndex: h.turnIndex, atSec: h.atSec, text: h.text, questionId: h.questionId })),
        },
        { by: ctx.me },
      ),
    )
    toast(`Added code “${name.trim()}”, ${proposal.people} ${proposal.people === 1 ? 'person' : 'people'}`)
    onDone()
  }

  const dismiss = () => {
    ctx.act((d) => dismissSuggestion(d, scan.key))
    toast('Idea dismissed. It won’t be offered again.')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3" data-testid="results">
      <section aria-label="Proposed code" className="rounded-md border border-dashed border-iris-300 bg-iris-50 p-4" data-testid="proposal">
        <div className="flex flex-wrap items-center gap-2">
          <AIGeneratedTag />
          <span className="text-xs font-medium text-graphite">Proposed code</span>
          <span className="ml-auto text-xs text-graphite tabular-nums" data-testid="proposal-count">
            {proposal ? `${proposal.people} ${proposal.people === 1 ? 'person' : 'people'} · ${included.length} ${included.length === 1 ? 'quote' : 'quotes'}` : 'No quotes included'}
          </span>
        </div>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-graphite">Name</span>
          <input
            data-testid="proposal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn('mt-1 h-9 w-full rounded-sm border bg-surface px-2.5 text-sm font-medium outline-none focus:border-iris-600', clash ? 'border-negative-fg' : 'border-mist-strong')}
          />
        </label>
        {clash && <p className="mt-1 text-xs text-negative-fg">A code with this name already exists. Rename this one, or merge them in the codebook.</p>}
        <TextArea label="What it means" rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} containerClassName="mt-3" data-testid="proposal-definition" />
        <p className="mt-2 text-xs text-graphite">
          Goes in <span className="font-medium text-ink">{question}</span>
          {!proposal?.questionId && <> (new codes, not asked about in the guide)</>}. The count is against {proposal?.questionId ? 'everyone asked that question' : 'everyone'}.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={!canAccept} onClick={accept} data-testid="accept-idea">
            Accept as a code
          </Button>
          <Button variant="ghost" onClick={dismiss} data-testid="dismiss-idea">
            Dismiss
          </Button>
        </div>
      </section>

      <section aria-label="Quotes found">
        <h4 className="text-sm font-semibold">
          Quotes found <span className="font-normal text-graphite tabular-nums">{scan.hits.length}</span>
          <span className="ml-2 text-xs font-normal text-graphite">From {scan.sessions} accepted interviews. Leave out any that don’t fit.</span>
        </h4>
        <ul className="mt-2 divide-y divide-mist rounded-md border border-mist bg-surface">
          {scan.hits.map((h) => (
            <Quote key={h.key} hit={h} stems={scan.stems} ctx={ctx} out={left.has(h.key)} onToggle={() => toggle(h.key)} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function Quote({ hit: h, stems, ctx, out, onToggle }: { hit: Hit; stems: string[]; ctx: CodebookCtx; out: boolean; onToggle: () => void }) {
  const marked = matchedWords(h.text, stems)
  const parts = h.text.split(/([A-Za-z0-9][A-Za-z0-9’']*)/)
  const href = `${studyPath(ctx.studyId, { ...screenById.R22, path: screenById.R22.path.replace(':sessionId', h.sessionId) })}?from=codebook&at=${h.atSec}`
  return (
    <li className={cn('px-3.5 py-3', out && 'bg-paper')} data-testid="quote" data-text={h.text} data-session={h.sessionId} data-participant={h.participantId} data-at={h.atSec} data-out={out}>
      <p className={cn('font-serif text-quote leading-snug', out ? 'text-muted line-through decoration-mist-strong' : 'text-ink')}>
        “
        {parts.map((p, i) =>
          marked.has(p.toLowerCase()) ? (
            <mark key={i} className="rounded-xs bg-iris-100 px-0.5 text-ink">
              {p}
            </mark>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
        ”
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-graphite">
        <span className="font-medium text-ink tabular-nums">{h.participantId}</span>
        <span>{h.pet} owner</span>
        <span className="tabular-nums">{h.sessionId}</span>
        <span className="tabular-nums">{mmss(h.atSec)}</span>
        <span className="basis-full">{h.questionId ? questionOf(h.questionId).label : 'Outside the guide'}</span>
      </p>
      <p className="mt-1.5 flex items-center gap-3 text-xs">
        <Link to={href} className="inline-flex items-center gap-1 rounded-xs font-medium text-iris-700 hover:underline" aria-label={`Play ${h.participantId} at ${mmss(h.atSec)}`}>
          <PlayIcon size={11} /> Play
        </Link>
        <button type="button" onClick={onToggle} data-testid="quote-toggle" className="rounded-xs font-medium text-graphite hover:text-ink hover:underline">
          {out ? 'Include' : 'Leave out'}
        </button>
      </p>
    </li>
  )
}
