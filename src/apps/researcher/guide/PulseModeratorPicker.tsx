import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { StatusChip } from '@/components/StatusChip'
import { HUMAN_MODERATORS } from '@/mock/moderation'
import type { TeamMember } from '@/state/guide'

type Props = {
  title: string
  description?: string
  /** The study language, from the brief. Null until the brief gives one. */
  language: string | null
  /** Who is already on the list, so a person can't be asked twice. */
  asked: TeamMember[]
  onRequest: (rosterId: string) => void
}

/** Asking for PulseAI moderators: pick people from the roster. Shared by human-led and standby. */
export function PulseModeratorPicker({ title, description, language, asked: team, onRequest }: Props) {
  const [showOthers, setShowOthers] = useState(false)
  const speakers = language ? HUMAN_MODERATORS.filter((h) => h.languages.includes(language)) : []
  const others = language ? HUMAN_MODERATORS.filter((h) => !h.languages.includes(language)) : []
  return (
    <Card title={title} description={description}>
      <div className="flex flex-col gap-3" data-testid="pulseai-panel">
        {language ? (
          others.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} data-testid="show-other-languages" />
              Show other languages
            </label>
          )
        ) : (
          <p className="text-sm text-graphite">Moderators are listed once the study language is set.</p>
        )}
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
                    <p className="text-xs text-graphite">
                      <span className="tabular-nums">{h.weeklyHours}</span> hours a week
                    </p>
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
    </Card>
  )
}
