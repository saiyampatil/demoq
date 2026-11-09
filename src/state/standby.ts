// Standby moderators: the times a participant who asks to talk to a person can book. Pure, so the same function serves
// Launch (how many open times there are) and Fieldwork (which slot was booked).

import { availabilityFor, STANDBY_DAYS, STANDBY_NOTICE_HOURS, STANDBY_SLOT_MIN } from '@/mock/moderation'

export type Slot = { moderatorId: string; name: string; /** UTC instants. Show them with formatSlot, which adds the zone. */ start: string; end: string }

/** The zone's offset from UTC at an instant, in minutes. */
function offsetMin(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(utcMs)
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return (Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - utcMs) / 60000
}

/** The instant a wall-clock time in a zone happens. Settles on the right offset across a clock change. */
function zonedInstant(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - offsetMin(timeZone, guess) * 60000
  return guess - offsetMin(timeZone, first) * 60000
}

/** Today's calendar date in a zone. */
function localDate(timeZone: string, utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utcMs)
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return { y: n('year'), m: n('month'), d: n('day') }
}

/**
 * Every open booking for these moderators in the next week, earliest first. A slot needs notice, must end inside the
 * moderator's window, and isn't offered if it is in `taken` ("<moderatorId>|<start>").
 */
export function openSlots(moderators: { id: string; name: string }[], from: string, taken: ReadonlySet<string> = new Set()): Slot[] {
  const start = new Date(from).getTime()
  const earliest = start + STANDBY_NOTICE_HOURS * 3600000
  const latest = start + STANDBY_DAYS * 86400000
  const out: Slot[] = []
  for (const mod of moderators) {
    // Someone off the PulseAI roster gets the mock default window, so a study with only them on standby still offers times.
    const { availability: a } = availabilityFor(mod.id)
    const today = localDate(a.timeZone, start)
    const [fh, fm] = a.from.split(':').map(Number)
    const [th, tm] = a.to.split(':').map(Number)
    for (let offset = 0; offset <= STANDBY_DAYS; offset++) {
      // Calendar arithmetic on the date alone, so a clock change doesn't shift the day.
      const day = new Date(Date.UTC(today.y, today.m - 1, today.d + offset))
      if (!a.days.includes(day.getUTCDay())) continue
      const y = day.getUTCFullYear()
      const m = day.getUTCMonth() + 1
      const d = day.getUTCDate()
      const windowEnd = zonedInstant(y, m, d, th, tm, a.timeZone)
      for (let t = zonedInstant(y, m, d, fh, fm, a.timeZone); t + STANDBY_SLOT_MIN * 60000 <= windowEnd; t += STANDBY_SLOT_MIN * 60000) {
        if (t < earliest || t > latest) continue
        const iso = new Date(t).toISOString()
        if (taken.has(`${mod.id}|${iso}`)) continue
        out.push({ moderatorId: mod.id, name: mod.name, start: iso, end: new Date(t + STANDBY_SLOT_MIN * 60000).toISOString() })
      }
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start) || x.name.localeCompare(y.name))
}
