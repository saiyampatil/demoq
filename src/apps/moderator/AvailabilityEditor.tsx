import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import { availabilityText } from '@/mock/moderation'
import { blocksOfWeek, clearWeek, copyLastWeek, repeatEveryWeek, setBlocks, useAvailabilityVersion, weekHours, zoneOf } from '@/state/availability'
import { fieldworkNow, FIELDWORK_NOW } from '@/state/fieldwork'
import { coverageGap, heldHours } from '@/state/requests'
import { addDays, dateKey, weekOf, zoneLabel, zonedInstant } from '@/state/zone'
import type { useModeratorData } from './Sessions'

type Data = ReturnType<typeof useModeratorData>

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`

type Pending = { title: string; lines: string[]; run: () => void }

/**
 * A moderator's hours, a week at a time, in one-hour blocks in their own time zone. Click or drag across empty hours to add,
 * × to remove. Hours that have started are locked, a booked or held hour can't be removed, and taking off a block the
 * study's standby coverage depends on asks first. The same blocks decide what a participant can book.
 */
export function AvailabilityEditor({ data }: { data: Data }) {
  const { me, all, studyName } = data
  const toast = useToast()
  useAvailabilityVersion()
  const tz = zoneOf(me.id)
  // The prototype's clock: the latest of the studies this moderator can see.
  const nowMs = new Date(Object.values(all).map((d) => fieldworkNow(d)).sort().pop() ?? FIELDWORK_NOW).getTime()
  const [offset, setOffset] = useState(0)
  const [menu, setMenu] = useState(false)
  const [pending, setPending] = useState<Pending>()
  const drag = useRef<boolean>(false)
  useEffect(() => {
    const up = () => (drag.current = false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const base = weekOf(tz, nowMs)
  const first = addDays(base.y, base.m, base.d, offset * 7)
  const key = dateKey(first.y, first.m, first.d)
  const on = blocksOfWeek(me.id, key)
  const held = heldHours(all, me.id)
  const { perDay, total } = weekHours(me.id, key)
  const cell = (day: number, h: number) => {
    const d = addDays(first.y, first.m, first.d, day)
    return new Date(zonedInstant(d.y, d.m, d.d, h, 0, tz)).toISOString()
  }
  const past = (iso: string) => new Date(iso).getTime() <= nowMs
  const weekIsPast = offset < 0
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' })
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric' })
  const range = `${fmt.format(new Date(cell(0, 12)))} to ${fmt.format(new Date(cell(6, 12)))}`

  const remove = (iso: string) => {
    const gap = coverageGap(all, me.id, new Date(iso).getTime(), studyName)
    const run = () => setBlocks(me.id, [iso], false, nowMs)
    if (gap.length === 0) return run()
    setPending({ title: 'Standby coverage depends on this hour', lines: gap.map((s) => `${dayName.format(new Date(iso))}: ${s} would have no standby moderator available.`), run })
  }
  const clear = () => {
    const mine = [...on].filter((iso) => !past(iso) && !held.has(iso))
    const gaps = mine.flatMap((iso) => coverageGap(all, me.id, new Date(iso).getTime(), studyName).map((s) => `${dayName.format(new Date(iso))}: ${s}`))
    const run = () => {
      clearWeek(me.id, key, nowMs, [...held.keys()])
      toast(held.size ? 'Cleared. Booked and held hours stay.' : 'This week is cleared.')
    }
    if (gaps.length === 0) return run()
    setPending({ title: `Clearing this week leaves ${gaps.length} ${gaps.length === 1 ? 'hour' : 'hours'} without standby coverage`, lines: gaps.slice(0, 6).concat(gaps.length > 6 ? [`and ${gaps.length - 6} more`] : []), run })
  }

  return (
    <div className="flex flex-col gap-4" data-testid="availability-editor">
      <p className="text-sm text-graphite">
        Your usual hours: <span className="font-medium text-ink">{availabilityText(me.id).text}</span>. Click or drag across empty hours to add them, × to take one off. Participants who ask for a person can be booked into these hours.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" aria-label="Previous week" data-testid="week-prev" onClick={() => setOffset((o) => o - 1)}>
            ‹
          </Button>
          <span className="min-w-44 text-center text-sm font-medium tabular-nums" data-testid="week-label">
            {range}
          </span>
          <Button size="sm" aria-label="Next week" data-testid="week-next" onClick={() => setOffset((o) => o + 1)}>
            ›
          </Button>
          {offset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
              This week
            </Button>
          )}
        </div>
        <span className="text-xs text-graphite" data-testid="zone-label">
          Times are in {zoneLabel(tz, nowMs)}
        </span>
        <span className="flex-1" />
        <p className="text-sm tabular-nums" data-testid="avail-total">
          Total <span className="font-semibold">{total}</span> h / week
        </p>
        <div className="relative">
          <Button size="sm" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} data-testid="week-menu">
            Week ▾
          </Button>
          {menu && (
            <ul role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-sm border border-mist bg-surface py-1 shadow-md">
              {(
                [
                  ['Copy last week', 'week-copy', () => (copyLastWeek(me.id, key, nowMs, [...held.keys()]), toast('Copied last week’s hours into this week.'))],
                  ['Repeat every week', 'week-repeat', () => (repeatEveryWeek(me.id, key), toast('Every week after this one now follows these hours.'))],
                  ['Clear this week', 'week-clear', clear],
                ] as const
              ).map(([label, tid, fn]) => (
                <li key={tid} role="none">
                  <button
                    role="menuitem"
                    type="button"
                    data-testid={tid}
                    disabled={weekIsPast}
                    title={weekIsPast ? 'This week has passed' : undefined}
                    onClick={() => {
                      setMenu(false)
                      fn()
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-haze disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-mist bg-surface" onMouseLeave={() => (drag.current = false)}>
        <table className="w-full min-w-[44rem] table-fixed border-collapse text-sm select-none" aria-label={`Your hours, ${range}`}>
          <thead>
            <tr className="border-b border-mist bg-haze text-xs font-medium text-graphite">
              <th className="w-20 px-3 py-2 text-left">{zoneLabel(tz, nowMs).match(/\(([^)]+)\)/)?.[1]}</th>
              {DAYS.map((d, i) => {
                const day = addDays(first.y, first.m, first.d, i)
                return (
                  <th key={d} className="px-2 py-2 text-left" data-testid="day-head">
                    {d} {day.d} <span className="font-normal text-muted tabular-nums">{perDay[i]} h</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h} className="border-b border-mist last:border-b-0">
                <th scope="row" className="px-3 py-0 text-left text-xs font-normal text-graphite">
                  {hourLabel(h)}
                </th>
                {DAYS.map((d, i) => {
                  const iso = cell(i, h)
                  const isOn = on.has(iso)
                  const isPast = past(iso)
                  const holder = held.get(iso)
                  const state = holder ? (holder.startsWith('held') ? 'held' : 'booked') : isOn ? 'on' : 'off'
                  return (
                    <td key={d} className="p-0.5">
                      <div
                        data-testid="avail-cell"
                        data-hour={iso}
                        data-state={isPast ? `past-${state}` : state}
                        className={cn(
                          'relative flex h-7 items-center justify-between rounded-xs px-1.5 text-xs',
                          isPast && 'cursor-not-allowed bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--color-haze)_4px,var(--color-haze)_8px)]',
                          !isPast && state === 'off' && 'cursor-pointer border border-dashed border-transparent hover:border-iris-300 hover:bg-iris-50',
                          state === 'on' && (isPast ? 'bg-mist text-muted' : 'bg-iris-100 text-iris-700'),
                          state === 'booked' && 'bg-iris-600 font-medium text-white',
                          state === 'held' && 'border border-pending-line bg-pending-bg font-medium text-pending-fg',
                        )}
                        onMouseDown={() => {
                          if (isPast || state !== 'off') return
                          drag.current = true
                          setBlocks(me.id, [iso], true, nowMs)
                        }}
                        onMouseEnter={() => {
                          if (drag.current && !isPast && state === 'off') setBlocks(me.id, [iso], true, nowMs)
                        }}
                      >
                        {holder && <span className="truncate">{holder.startsWith('held') ? 'Held' : `Booked: ${holder}`}</span>}
                        {!holder && isOn && !isPast && (
                          <>
                            <span className="sr-only">Available</span>
                            <span aria-hidden="true" className="flex-1" />
                            <button type="button" aria-label={`Remove ${dayName.format(new Date(iso))}`} data-testid="avail-remove" onMouseDown={(e) => e.stopPropagation()} onClick={() => remove(iso)} className="rounded-xs px-1 leading-none hover:bg-iris-600 hover:text-white">
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-graphite">Hatched hours have already started and are locked. Booked and held hours can’t be removed: a held hour is waiting for a participant to answer a new time.</p>

      <Modal
        open={!!pending}
        onClose={() => setPending(undefined)}
        title={pending?.title ?? ''}
        description="Standby coverage is what lets a participant who asks for a person reach someone. Taking this off leaves a gap."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(undefined)} data-testid="coverage-keep">
              Keep it
            </Button>
            <Button
              variant="primary"
              data-testid="coverage-confirm"
              onClick={() => {
                pending?.run()
                setPending(undefined)
              }}
            >
              Remove anyway
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-1 text-sm" data-testid="coverage-lines">
          {pending?.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
