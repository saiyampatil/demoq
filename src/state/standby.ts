// Standby moderators: the times a participant who asks to talk to a person can book. Pure, so the same function serves
// Launch (how many open times there are) and Fieldwork (which slot was booked).

import { availabilityText, STANDBY_DAYS, STANDBY_NOTICE_HOURS, STANDBY_SLOT_MIN } from '@/mock/moderation'
import { isAvailableSpan, runsOnDay, zoneOf } from './availability'
import { addDays, localDate, zonedInstant, zoneShort } from './zone'

export type Slot = { moderatorId: string; name: string; /** UTC instants. Show them with formatSlot, which adds the zone. */ start: string; end: string }

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
    const today = localDate(zoneOf(mod.id), start)
    for (let offset = 0; offset <= STANDBY_DAYS; offset++) {
      // Calendar arithmetic on the date alone, so a clock change doesn't shift the day.
      const day = addDays(today.y, today.m, today.d, offset)
      // A run of consecutive available hours is cut into slots from its start, so the default window gives the same grid as before.
      for (const [runStart, runEnd] of runsOnDay(mod.id, day.y, day.m, day.d)) {
        for (let t = runStart; t + STANDBY_SLOT_MIN * 60000 <= runEnd; t += STANDBY_SLOT_MIN * 60000) {
          if (t < earliest || t > latest) continue
          const iso = new Date(t).toISOString()
          if (taken.has(`${mod.id}|${iso}`)) continue
          out.push({ moderatorId: mod.id, name: mod.name, start: iso, end: new Date(t + STANDBY_SLOT_MIN * 60000).toISOString() })
        }
      }
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start) || x.name.localeCompare(y.name))
}

// ─── a moderator and a time ─────────────────────────────────────────────────

/** A time a moderator is already holding: a booked session, or a time they proposed and are waiting on. */
export type Busy = { start: number; end: number; who: string }
export const busyAt = (startISO: string, who: string): Busy => ({ start: new Date(startISO).getTime(), end: new Date(startISO).getTime() + STANDBY_SLOT_MIN * 60000, who })

/**
 * Why a moderator can't take a time, or null when they can: it has passed, it is outside their hours (their weekdays and
 * window, in their own zone), or it overlaps something they already hold. A slot is STANDBY_SLOT_MIN long.
 */
export function slotProblem(moderatorId: string, startMs: number, nowMs: number, busy: readonly Busy[]): string | null {
  if (startMs <= nowMs) return 'That time has passed.'
  if (!isAvailableSpan(moderatorId, startMs, STANDBY_SLOT_MIN * 60000)) return `You aren’t available then. Your hours are ${availabilityText(moderatorId).text}.`
  const clash = busy.find((b) => b.start < startMs + STANDBY_SLOT_MIN * 60000 && b.end > startMs)
  return clash ? `You’re booked then (${clash.who}).` : null
}

/** The first weekday after `from`, at a wall-clock time in a zone, as a UTC instant. Used for the time a participant suggests. */
export function nextWeekdayAt(timeZone: string, from: string, hh: number, mm: number): string {
  const start = new Date(from).getTime()
  const today = localDate(timeZone, start)
  for (let offset = 1; offset <= 7; offset++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + offset))
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue
    return new Date(zonedInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mm, timeZone)).toISOString()
  }
  return new Date(start + 86400000).toISOString()
}

/** Free times for one moderator in the next week, with anything they already hold taken out. */
export function freeSlots(moderator: { id: string; name: string }, from: string, busy: readonly Busy[]): Slot[] {
  return openSlots([moderator], from).filter((s) => slotProblem(moderator.id, new Date(s.start).getTime(), new Date(from).getTime(), busy) === null)
}

/** "Thu, Nov 12, 2:00 PM EST" in a zone. */
export const formatIn = (iso: string, timeZone: string) => {
  const ms = new Date(iso).getTime()
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ms)
  return `${parts} ${zoneShort(timeZone, ms)}`
}
