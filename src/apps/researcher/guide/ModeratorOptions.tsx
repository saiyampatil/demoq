import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { CheckIcon } from '@/components/icons'
import { standbyOf, teamOf, type GuideDoc } from '@/state/guide'
import { addMe, addPulse, addTeamPersonToStudy, removeFrom, type Where } from '@/state/moderatorAssign'
import { PulseModeratorPicker } from './PulseModeratorPicker'
import { TeamModeratorPicker } from './TeamModeratorPicker'

type Props = {
  /** `team` for a human-led study, `standby` for an AI-led one. The options and the rules are the same. */
  where: Where
  doc: GuideDoc
  me: string
  /** The study language, from the brief. Null until the brief gives one. */
  language: string | null
  /** Edits the setup, so on an approved guide it makes a new version like any other edit. */
  update: (fn: (d: GuideDoc) => GuideDoc) => void
  heading: string
  intro: string
  myself: { title: string; text: string }
  pulse: { title: string; text: string; panelTitle: string; panelDescription?: string }
  team: { text: string }
}

/**
 * The three ways to add a moderator, shared by human-led setup and AI-led standby. Nothing is requested: each option adds
 * the person at once. Only a new person from the team list is Invited, and counts once they accept.
 */
export function ModeratorOptions({ where, doc, me, language, update, heading, intro, myself, pulse, team: teamCopy }: Props) {
  const list = where === 'team' ? teamOf(doc.moderator) : standbyOf(doc.moderator)
  const [pulseOpen, setPulseOpen] = useState(() => list.some((t) => t.source === 'PulseAI'))
  const [teamOpen, setTeamOpen] = useState(() => list.some((t) => t.source === 'My team'))
  const me_ = list.some((t) => t.source === 'Myself')
  const lang = language ?? ''

  const cards: { key: string; title: string; text: string; on: boolean; action: React.ReactNode }[] = [
    {
      key: 'myself',
      title: myself.title,
      text: myself.text,
      on: me_,
      action: me_ ? (
        <span className="flex items-center gap-1 text-sm font-medium text-positive-fg">
          <CheckIcon size={14} /> Added
        </span>
      ) : (
        <Button size="sm" disabled={!language} onClick={() => update((d) => addMe(d, me, where, lang))} data-testid="add-myself">
          Add me
        </Button>
      ),
    },
    {
      key: 'pulseai',
      title: pulse.title,
      text: pulse.text,
      on: pulseOpen || list.some((t) => t.source === 'PulseAI'),
      action: (
        <Button size="sm" onClick={() => setPulseOpen((x) => !x)} aria-expanded={pulseOpen} data-testid="open-pulseai">
          {pulseOpen ? 'Hide options' : 'Choose'}
        </Button>
      ),
    },
    {
      key: 'team',
      title: 'Someone from my team',
      text: teamCopy.text,
      on: teamOpen || list.some((t) => t.source === 'My team'),
      action: (
        <Button size="sm" onClick={() => setTeamOpen((x) => !x)} aria-expanded={teamOpen} data-testid="open-team">
          {teamOpen ? 'Hide list' : 'Choose'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <section aria-label="Moderator options">
        <h2 className="mb-1 text-md font-semibold">{heading}</h2>
        <p className="mb-3 text-sm text-graphite">{intro}</p>
        {!language && <p className="mb-3 text-sm text-pending-fg">Set the study’s market in the brief first. Moderators are added once the study has a language.</p>}
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.key} className={cn('flex flex-col gap-3 rounded-md border bg-surface p-4', c.on ? 'border-ink ring-1 ring-ink' : 'border-mist')}>
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-0.5 text-sm text-graphite">{c.text}</p>
              </div>
              <div className="mt-auto">{c.action}</div>
            </div>
          ))}
        </div>
      </section>

      {pulseOpen && (
        <PulseModeratorPicker
          title={pulse.panelTitle}
          description={pulse.panelDescription}
          language={language}
          added={list}
          onAdd={(id) => update((d) => addPulse(d, me, where, id, lang))}
          onRemove={(id) => update((d) => removeFrom(d, me, where, id))}
        />
      )}
      {teamOpen && (
        <TeamModeratorPicker
          added={list}
          me={me}
          disabled={!language}
          onAdd={(p) => update((d) => addTeamPersonToStudy(d, me, where, p, lang))}
          onRemove={(id) => update((d) => removeFrom(d, me, where, id))}
        />
      )}
    </>
  )
}
