import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { SparkIcon } from '@/components/icons'
import { AGENTS, STYLES, SUGGESTED_AGENT } from '@/mock/moderation'
import { screenById, studyPath } from '@/routes/screens'
import { NO_LANGUAGE } from '@/state/language'
import { configBlockers, editModerator, switchMode, windowWeeks, type Mode, type Style } from '@/state/guide'
import { useStudies } from '@/state/StudyContext'
import { PageHeader } from '../../shared/PageHeader'
import { GuideGate, ReplaceGuideModal, VersionBanner } from './GuideBits'
import { HumanModerators } from './HumanModerators'
import { StandbyModerators } from './StandbyModerators'
import { useGuide } from './useGuide'

const MODES: { value: Mode; title: string; description: string }[] = [
  { value: 'ai', title: 'AI moderator', description: 'Automated and asynchronous. Each participant takes the interview when it suits them.' },
  { value: 'human', title: 'Human moderator', description: 'Live and scheduled. A person runs each session at a booked time.' },
]

export function ModeratorSetup() {
  const { studyId, editable, doc, me, update, ensure, stale, audience, language } = useGuide()
  const { getLaunch } = useStudies()
  const launch = getLaunch(studyId)
  const [switching, setSwitching] = useState<Mode>()

  useEffect(() => {
    if (editable && !doc) ensure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, doc === undefined])

  if (!editable) return <GuideGate reason="readonly" />
  if (stale) return <GuideGate reason="stale" />
  if (!doc) return null

  const m = doc.moderator
  const blockers = configBlockers(m, language)
  const edit = (fn: Parameters<typeof editModerator>[2], note?: string) => update((d) => editModerator(d, me, fn, note))
  const pickMode = (mode: Mode) => {
    if (mode === m.mode) return
    // With a guide in place, switching replaces it, so ask first.
    if (doc.guide) setSwitching(mode)
    else update((d) => switchMode(d, me, mode, language))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="R12" title="Moderator setup" description="Choose who runs the interviews. The guide is drafted from this setup." />
      <VersionBanner doc={doc} />

      {!language && (
        <Banner tone="warning" title={NO_LANGUAGE}>
          The interview language is set from the brief’s market, and the brief doesn’t name one we have a language for.{' '}
          <Link to={studyPath(studyId, screenById.R4)} className="font-medium underline underline-offset-2" data-testid="add-market-link">
            Open the brief
          </Link>
        </Banner>
      )}
      {language && (
        <p className="text-sm text-graphite" data-testid="study-language">
          Interview language: <span className="font-medium text-ink">{language}</span>, set from your market.{' '}
          <Link to={studyPath(studyId, screenById.R4)} className="font-medium text-iris-700 underline underline-offset-2 hover:text-iris-800">
            Change in brief
          </Link>
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Who moderates?</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {MODES.map((o) => {
            const on = m.mode === o.value
            return (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-md border bg-surface p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris-600',
                  on ? 'border-ink ring-1 ring-ink' : 'border-mist hover:border-graphite',
                )}
              >
                <input type="radio" name="mode" value={o.value} checked={on} onChange={() => pickMode(o.value)} className="sr-only" />
                <span aria-hidden="true" className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-ink' : 'border-graphite')}>
                  {on && <span className="size-2 rounded-full bg-ink" />}
                </span>
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="mt-0.5 block text-sm text-graphite">{o.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {m.mode === 'ai' && (
        <>
          <Card title="AI agent" description="Agents are trained in different expertise areas. Pick the one closest to this study.">
            <div className="flex flex-col gap-3">
              <div role="radiogroup" aria-label="AI agent" className="grid gap-3 lg:grid-cols-2">
                {AGENTS.map((a) => {
                  const on = m.agentId === a.id
                  return (
                    <label
                      key={a.id}
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-md border bg-surface p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris-600',
                        on ? 'border-ink ring-1 ring-ink' : 'border-mist hover:border-graphite',
                      )}
                    >
                      <input type="radio" name="agent" value={a.id} checked={on} onChange={() => edit((x) => ({ ...x, agentId: a.id }), 'Agent changed')} className="sr-only" />
                      <span aria-hidden="true" className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-ink' : 'border-graphite')}>
                        {on && <span className="size-2 rounded-full bg-ink" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{a.name}</span>
                          <span className="text-sm text-graphite">{a.expertise}</span>
                          {a.id === SUGGESTED_AGENT && (
                            <span className="inline-flex h-5 items-center gap-1 rounded-xs border border-dashed border-iris-300 bg-iris-50 px-1.5 text-xs font-medium text-iris-700">
                              <SparkIcon size={12} />
                              Suggested
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-graphite">{a.note}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {(() => {
                const a = AGENTS.find((x) => x.id === (m.agentId ?? SUGGESTED_AGENT))!
                return (
                  <div className="ai-surface p-3 text-sm">
                    <p className="mb-1 flex items-center gap-2">
                      <AIGeneratedTag />
                      <span className="font-medium">{m.agentId ? `Why ${a.name}` : `Why ${a.name} is suggested`}</span>
                    </p>
                    <p>{a.why}</p>
                  </div>
                )
              })()}
            </div>
          </Card>

          <Card title="Interview settings">
            <div className="flex flex-col gap-5">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Moderation style</legend>
                <div role="radiogroup" className="grid gap-3 md:grid-cols-3">
                  {STYLES.map((s) => {
                    const on = m.style === s.value
                    return (
                      <label
                        key={s.value}
                        className={cn(
                          'flex cursor-pointer flex-col rounded-md border bg-surface p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris-600',
                          on ? 'border-ink ring-1 ring-ink' : 'border-mist hover:border-graphite',
                        )}
                      >
                        <input type="radio" name="style" value={s.value} checked={on} onChange={() => edit((x) => ({ ...x, style: s.value as Style }), 'Style changed')} className="sr-only" />
                        <span className="font-semibold">{s.label}</span>
                        <span className="mt-0.5 text-sm text-graphite">{s.note}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </div>
          </Card>

          <StandbyModerators doc={doc} me={me} language={language} update={update} />
        </>
      )}

      {m.mode === 'human' && <HumanModerators doc={doc} me={me} language={language} update={update} interviews={audience?.def?.total ?? null} weeks={windowWeeks(launch?.setup.fieldwork)} />}



      {m.mode === null && <Banner tone="info" title="Choose a moderator type to continue">The setup below depends on it. You can switch later, which drafts the guide again.</Banner>}

      <WizardFooter
        previous={{ to: studyPath(studyId, screenById.R11), label: 'Pool' }}
        message={blockers.length ? `Still needed: ${blockers.join(', ').toLowerCase()}.` : 'Setup complete.'}
      >
        {blockers.length ? (
          <Tooltip focusable content={`${blockers.join('. ')}.`}>
            <Button variant="primary" disabled>
              Continue to stimuli
            </Button>
          </Tooltip>
        ) : (
          <Button variant="primary" to={studyPath(studyId, screenById.R13)}>
            Continue to stimuli
          </Button>
        )}
      </WizardFooter>

      <ReplaceGuideModal
        open={!!switching}
        doc={doc}
        title={`Switch to ${switching === 'ai' ? 'an AI moderator' : 'human moderators'}?`}
        extra={switching === 'human' ? 'AI settings, standby moderators and surveys no longer apply, and surveys are removed from the new guide.' : 'The guide is drafted again for an AI moderator, and surveys can be added.'}
        onCancel={() => setSwitching(undefined)}
        onConfirm={() => {
          if (switching) update((d) => switchMode(d, me, switching, language))
          setSwitching(undefined)
        }}
      />
    </div>
  )
}

