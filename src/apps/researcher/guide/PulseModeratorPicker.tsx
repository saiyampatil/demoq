import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { HUMAN_MODERATORS } from '@/mock/moderation'
import type { TeamMember } from '@/state/guide'

type Props = {
  title: string
  description: string
  /** The study language, from the brief. Null until the brief gives one. */
  language: string | null
  /** Who is already on the list, so a person can't be asked twice. */
  asked: TeamMember[]
  onAssign: (count: number) => void
  onRequest: (rosterId: string) => void
}

/** Asking for PulseAI moderators: let PulseAI assign a number, or choose specific people from the roster. Shared by human-led and standby. */
export function PulseModeratorPicker({ title, description, language, asked: team, onAssign, onRequest }: Props) {
  const [mode, setMode] = useState<'assign' | 'choose'>('assign')
  const [count, setCount] = useState(1)
  const [showOthers, setShowOthers] = useState(false)
  const speakers = language ? HUMAN_MODERATORS.filter((h) => h.languages.includes(language)) : []
  const others = language ? HUMAN_MODERATORS.filter((h) => !h.languages.includes(language)) : []
  const toast = useToast()
  return (
    <Card title={title} description={description}>
      <div className="flex flex-col gap-4" data-testid="pulseai-panel">
        <div role="radiogroup" aria-label="How to get PulseAI moderators" className="inline-flex self-start rounded-sm border border-mist-strong bg-haze p-0.5">
          {([
            ['assign', 'Let PulseAI assign'],
            ['choose', 'Choose specific moderators'],
          ] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn('rounded-xs px-3 py-1 text-sm', mode === v ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'assign' ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">How many moderators</span>
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} className={cn(controlBase, 'h-9 w-24 tabular-nums')} />
            </label>
            <Button
              variant="primary"
              disabled={!language}
              onClick={() => {
                onAssign(count)
                toast(`Requested ${count} PulseAI ${count === 1 ? 'moderator' : 'moderators'}. They show as Requested until PulseAI confirms.`)
              }}
              data-testid="request-pulseai"
            >
              Request {count} {count === 1 ? 'moderator' : 'moderators'}
            </Button>
            <p className="basis-full text-xs text-graphite">PulseAI matches people to your study language and confirms.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-graphite">
                {language ? `Showing moderators who speak ${language}.` : 'Moderators are listed once the study language is set.'}
              </p>
              {language && others.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} data-testid="show-other-languages" />
                  Show other languages
                </label>
              )}
            </div>
            <ul className="grid gap-3 md:grid-cols-2" data-testid="roster">
              {[...speakers, ...(showOthers ? others : [])].map((h) => {
                const asked = team.find((t) => t.rosterId === h.id)
                const speaks = speakers.includes(h)
                return (
                  <li key={h.id} className={cn('flex flex-col gap-2 rounded-md border border-mist p-3', speaks ? 'bg-surface' : 'bg-haze')} data-speaks={speaks}>
                    <div className="flex items-start gap-3">
                      <div className={cn('min-w-0 flex-1', !speaks && 'text-graphite')}>
                        <p className="font-semibold">{h.name}</p>
                        <p className="text-sm text-graphite">{h.title}</p>
                        <p className="text-xs text-graphite">{h.languages.join(', ')} · <span className="tabular-nums">{h.weeklyHours}</span> hours a week</p>
                        {!speaks && <p className="mt-0.5 text-xs font-medium text-pending-fg">Doesn’t speak {language}, so can’t moderate this study.</p>}
                      </div>
                      {asked ? (
                        <StatusChip status={asked.status} size="sm" />
                      ) : (
                        <Button size="sm" disabled={!speaks} onClick={() => onRequest(h.id)} aria-label={`Request ${h.name}`}>
                          Request
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}

