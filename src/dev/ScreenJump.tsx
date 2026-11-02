import { useEffect, useMemo, useState } from 'react'
import { Link, matchPath, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { CloseIcon, SearchIcon } from '@/components/icons'
import { mockTestRuns, type MockRuns } from '@/mock/launch'
import { MOISTURIZER_ID, stagePresets } from '@/mock/moisturizerStudy'
import { appLabel, screenHref, screens, type AppKey } from '@/routes/screens'
import { addReviewEvent, useReviewState } from '@/state/reviewState'
import { reviewList } from '@/state/studySessions'
import { featureInfo, useFeatures, type FeatureKey } from '@/state/features'
import { useStudies } from '@/state/StudyContext'
import { SessionSimulator } from './SessionSimulator'

const apps: AppKey[] = ['researcher', 'participant', 'moderator', 'observer']

// Dev-only menu: jump to any screen by ID, and move the seed study between stages.
export function ScreenJump() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { stage, setStage, resetSeed, getStudy, getAudience, getGuide, getLaunch, updateLaunch, getFieldwork, updateFieldwork } = useStudies()
  const mockRuns = (kind: MockRuns) => {
    const study = getStudy(MOISTURIZER_ID)
    const change = study && mockTestRuns(kind, { study, audience: getAudience(MOISTURIZER_ID), guide: getGuide(MOISTURIZER_ID), launch: getLaunch(MOISTURIZER_ID) })
    if (change) updateLaunch(MOISTURIZER_ID, change)
  }
  const { flags, setFlag } = useFeatures()
  const reviewState = useReviewState()
  const demoDecide = () => {
    const doc = getFieldwork(MOISTURIZER_ID)
    reviewList(doc, reviewState)
      .filter((r) => r.status === 'Under review')
      .forEach((r) => addReviewEvent(r.id, { type: 'decision', outcome: 'Accepted', note: 'Dev demo decision.', by: 'Dev demo' }, r.completedAt))
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Screens kept in the code but out of the navigation (R16) are not offered here either.
    const offered = screens.filter((s) => !s.hidden)
    return q ? offered.filter((s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : offered
  }, [query])

  const here = pathname + search
  // On a session page (R19) the panel also carries the controls that stand in for the participant.
  const onSession = matchPath('/researcher/studies/:studyId/fieldwork/sessions/:sessionId', pathname)
  const sessionDoc = onSession ? getFieldwork(onSession.params.studyId) : undefined
  const sessionStudy = onSession ? getStudy(onSession.params.studyId) : undefined


  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fixed bottom-4 left-4 z-50 flex h-8 max-md:top-[60px] max-md:right-2 max-md:bottom-auto max-md:left-auto items-center rounded-full bg-ink px-3.5 text-xs font-medium text-white shadow-overlay hover:bg-graphite"
      >
        Screen jump
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Screen jump"
          className="fixed top-4 right-4 bottom-32 z-50 flex w-[340px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-md border border-mist bg-surface shadow-overlay motion-safe:animate-[fade-in_120ms_ease-out]"
        >
          <header className="flex items-center gap-2 border-b border-mist px-4 py-3">
            <h2 className="flex-1 font-semibold">Screen jump</h2>
            <span className="rounded-xs bg-haze px-1.5 text-xs text-graphite">Dev only</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 text-graphite hover:bg-haze hover:text-ink"
              aria-label="Close screen jump"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {onSession && sessionDoc && (
              <SessionSimulator
                doc={sessionDoc}
                sessionId={onSession.params.sessionId ?? ''}
                paused={sessionStudy?.status === 'Paused' || !!sessionDoc.paused}
                update={(fn) => updateFieldwork(onSession.params.studyId ?? '', fn)}
              />
            )}
            <section className="border-b border-mist px-4 py-3">
              <h3 className="text-sm font-semibold">Fieldwork window (mock)</h3>
              <p className="text-xs text-graphite">Moves the end of the seed study’s window, to see the “Not enough time left” warning. The clock is Nov 11.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ['2 days left', '2026-11-13'],
                  ['6 days left (default)', '2026-11-17'],
                ].map(([label, end]) => (
                  <Button key={end} size="sm" onClick={() => getFieldwork(MOISTURIZER_ID)?.window && updateFieldwork(MOISTURIZER_ID, (d) => ({ ...d, window: d.window && { ...d.window, end } }))}>
                    {label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="border-b border-mist px-4 py-3">
              <h3 className="text-sm font-semibold">Review (dev demo)</h3>
              <p className="mt-1 text-xs text-graphite">Records a real decision (Accepted, by “Dev demo”) on every session still Under review. Reset the study stage to undo.</p>
              <Button size="sm" className="mt-2" onClick={demoDecide}>
                Dev demo: decide every session
              </Button>
            </section>

            <section className="border-b border-mist px-4 py-3">
              <h3 className="text-sm font-semibold">Test runs (mock)</h3>
              <p className="text-xs text-graphite">Sets every test run on the Launch screen from the real compiled plan. Needs an approved guide that compiles.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => mockRuns('pass')}>
                  Mock all pass
                </Button>
                <Button size="sm" onClick={() => mockRuns('issue')}>
                  Mock one issue
                </Button>
                <Button size="sm" onClick={() => mockRuns('none')}>
                  Mock all not run
                </Button>
                <Button size="sm" onClick={() => mockRuns('outdated')}>
                  Mock guide version changed
                </Button>
              </div>
            </section>

            <section className="border-b border-mist px-4 py-3">
              <h3 className="text-sm font-semibold">Study stage</h3>
              <p className="text-xs text-graphite">Moisturizer Concept Study only. Changing it replaces its saved progress; studies you created stay.</p>
              <fieldset className="mt-2 flex flex-col gap-0.5">
                <legend className="sr-only">Study stage</legend>
                {stagePresets.map((p) => (
                  <label
                    key={p.key}
                    className={cn(
                      'flex cursor-pointer gap-2.5 rounded-sm px-2 py-1.5',
                      stage === p.key ? 'bg-haze' : 'hover:bg-paper',
                    )}
                  >
                    <input
                      type="radio"
                      name="stage"
                      className="mt-1 accent-[var(--color-iris-600)]"
                      checked={stage === p.key}
                      onChange={() => setStage(p.key)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="block text-xs text-graphite">{p.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    resetSeed()
                    navigate('/researcher')
                  }}
                >
                  Reset seed
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false)
                    navigate('/design')
                  }}
                >
                  Open /design
                </Button>
              </div>
            </section>

            <section className="border-b border-mist px-4 py-3">
              <h3 className="text-sm font-semibold">Feature flags and mock switches</h3>
              <p className="text-xs text-graphite">Recommended additions (not PRD requirements) and mock study settings.</p>
              <div className="mt-2 flex flex-col gap-1">
                {(Object.keys(featureInfo) as FeatureKey[]).map((key) => (
                  <label key={key} className="flex cursor-pointer gap-2.5 rounded-sm px-2 py-1.5 hover:bg-paper">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[var(--color-iris-600)]"
                      checked={flags[key]}
                      onChange={(e) => setFlag(key, e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{featureInfo[key].label}</span>
                      <span className="block text-xs text-graphite">{featureInfo[key].description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <div className="sticky top-0 border-b border-mist bg-surface px-4 py-2.5">
              <label className="flex h-8 items-center gap-2 rounded-sm border border-mist-strong px-2 text-graphite focus-within:border-iris-600">
                <SearchIcon size={14} />
                <span className="sr-only">Find a screen</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find by ID or name"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </label>
            </div>

            {apps.map((app) => {
              const list = filtered.filter((s) => s.app === app)
              if (list.length === 0) return null
              return (
                <section key={app} className="px-2 py-2">
                  <h3 className="px-2 pb-1 text-xs font-semibold text-graphite">{appLabel[app]}</h3>
                  <ul>
                    {list.map((s) => {
                      const href = screenHref(s)
                      const active = href === here
                      return (
                        <li key={s.id}>
                          <Link
                            to={href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-baseline gap-2 rounded-sm px-2 py-1.5 text-sm',
                              active ? 'bg-iris-50 text-ink' : 'text-ink hover:bg-haze',
                            )}
                          >
                            <span className="w-8 shrink-0 text-xs font-semibold text-graphite tabular-nums">{s.id}</span>
                            <span className="min-w-0 flex-1">{s.name}</span>
                            <span className="shrink-0 text-xs text-muted tabular-nums">Phase {s.phase}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
            {filtered.length === 0 && <p className="px-4 py-6 text-sm text-graphite">No screen matches “{query}”.</p>}
          </div>
        </div>
      )}
    </>
  )
}
