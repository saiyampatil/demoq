import { useEffect, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextArea } from '@/components/Field'
import { CloseIcon, PlusIcon, SparkIcon } from '@/components/icons'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { AGENTS, LANGUAGES, STYLES, SUGGESTED_AGENT } from '@/mock/moderation'
import { screenById, studyPath } from '@/routes/screens'
import { uid } from '@/state/brief'
import { configBlockers, editModerator, switchMode, windowWeeks, type Mode, type Style } from '@/state/guide'
import { useStudies } from '@/state/StudyContext'
import { PageHeader } from '../../shared/PageHeader'
import { GuideGate, ReplaceGuideModal, VersionBanner } from './GuideBits'
import { HumanModerators } from './HumanModerators'
import { useGuide } from './useGuide'

const MODES: { value: Mode; title: string; description: string }[] = [
  { value: 'ai', title: 'AI moderator', description: 'Automated and asynchronous. Each participant takes the interview when it suits them.' },
  { value: 'human', title: 'Human moderator', description: 'Live and scheduled. A person runs each session at a booked time.' },
]

export function ModeratorSetup() {
  const { studyId, editable, doc, me, update, ensure, approved, stale, audience } = useGuide()
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
  const blockers = configBlockers(m)
  const edit = (fn: Parameters<typeof editModerator>[2], note?: string) => update((d) => editModerator(d, me, fn, note))
  const pickMode = (mode: Mode) => {
    if (mode === m.mode) return
    // With a guide in place, switching replaces it, so ask first.
    if (doc.guide) setSwitching(mode)
    else update((d) => switchMode(d, me, mode))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="R12" title="Moderator setup" description="Choose who runs the interviews. The guide is drafted from this setup." />
      <VersionBanner doc={doc} />

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
              <label className="flex max-w-xs flex-col gap-1.5">
                <span className="text-sm font-medium">Interview language</span>
                <select value={m.language} onChange={(e) => edit((x) => ({ ...x, language: e.target.value }), 'Language changed')} className={cn(controlBase, 'h-9 pr-7')}>
                  {LANGUAGES.includes(m.language) ? null : <option>{m.language}</option>}
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <span className="text-xs text-graphite">Starts as English (US). Change it if the interviews run in another language.</span>
              </label>
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
        </>
      )}

      {m.mode === 'human' && <HumanModerators doc={doc} me={me} update={update} interviews={audience?.def?.total ?? null} weeks={windowWeeks(launch?.setup.fieldwork)} />}

      {m.mode && (
        <Card title="Target duration" description="One value, used by the guide’s duration check.">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Minutes per interview</span>
              <input
                type="number"
                min={1}
                value={m.durationMin || ''}
                onChange={(e) => edit((x) => ({ ...x, durationMin: Math.max(0, Math.floor(Number(e.target.value))) }), 'Target duration changed')}
                className={cn(controlBase, 'h-9 w-28 tabular-nums')}
              />
            </label>
            {approved?.sections.length?.text && <p className="pb-2 text-sm text-graphite">The brief says: “{approved.sections.length.text}”</p>}
          </div>
        </Card>
      )}

      {m.mode === 'ai' && <Surveys surveys={m.surveys} onChange={(fn) => edit((x) => ({ ...x, surveys: fn(x.surveys) }), 'Surveys changed')} />}

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
        extra={switching === 'human' ? 'AI settings and surveys no longer apply, and surveys are removed from the new guide.' : 'The guide is drafted again for an AI moderator, and surveys can be added.'}
        onCancel={() => setSwitching(undefined)}
        onConfirm={() => {
          if (switching) update((d) => switchMode(d, me, switching))
          setSwitching(undefined)
        }}
      />
    </div>
  )
}

function Surveys({ surveys, onChange }: { surveys: { id: string; text: string; options: string[] }[]; onChange: (fn: (s: typeof surveys) => typeof surveys) => void }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [options, setOptions] = useState('')
  const opts = options.split(/\r?\n/).map((o) => o.trim()).filter(Boolean)
  return (
    <Card
      title="In-session surveys"
      description="Optional. Short questions shown during the interview. Wording and answer options are fixed once created, so to change one, remove it and add it again."
      actions={
        !adding && (
          <Button size="sm" icon={<PlusIcon />} onClick={() => setAdding(true)}>
            Add survey
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {surveys.length === 0 && !adding && <p className="text-sm text-graphite">No surveys. The interview is conversation only.</p>}
        <ul className="flex flex-col gap-2">
          {surveys.map((s) => (
            <li key={s.id} className="flex items-start gap-3 rounded-sm border border-mist p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.text}</p>
                <p className="mt-0.5 text-sm text-graphite">{s.options.join('  ·  ')}</p>
              </div>
              <button type="button" aria-label={`Remove survey: ${s.text}`} onClick={() => onChange((x) => x.filter((y) => y.id !== s.id))} className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
        {adding && (
          <form
            className="flex flex-col gap-3 rounded-sm border border-mist bg-paper p-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!text.trim() || opts.length < 2) return
              onChange((x) => [...x, { id: uid('sv'), text: text.trim(), options: opts }])
              setText('')
              setOptions('')
              setAdding(false)
            }}
          >
            <TextArea label="Survey question" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
            <TextArea label="Answer options, one per line" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} hint="At least two. Participants pick one." />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={!text.trim() || opts.length < 2}>
                Add survey
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}
