// Wall-clock arithmetic in a time zone, shared by standby booking and each moderator's own availability.

/** The zone's offset from UTC at an instant, in minutes. */
export function offsetMin(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(utcMs)
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return (Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - utcMs) / 60000
}

/** The instant a wall-clock time in a zone happens. Settles on the right offset across a clock change. */
export function zonedInstant(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - offsetMin(timeZone, guess) * 60000
  return guess - offsetMin(timeZone, first) * 60000
}

/** The calendar date in a zone at an instant. */
export function localDate(timeZone: string, utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utcMs)
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return { y: n('year'), m: n('month'), d: n('day') }
}

export const pad = (n: number) => String(n).padStart(2, '0')
/** A calendar date as "YYYY-MM-DD". */
export const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** The Monday of the week an instant falls in, as a calendar date in the zone. */
export function weekOf(timeZone: string, utcMs: number): { y: number; m: number; d: number; key: string } {
  const { y, m, d } = localDate(timeZone, utcMs)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const monday = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7)))
  const my = monday.getUTCFullYear()
  const mm = monday.getUTCMonth() + 1
  const md = monday.getUTCDate()
  return { y: my, m: mm, d: md, key: dateKey(my, mm, md) }
}

/** The calendar date `offset` days after a date, using the date alone so a clock change never shifts the day. */
export function addDays(y: number, m: number, d: number, offset: number) {
  const t = new Date(Date.UTC(y, m - 1, d + offset))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** The zone's name for a person: "Eastern Time (EST)". */
export function zoneLabel(timeZone: string, atMs: number = Date.now()): string {
  const long = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' }).formatToParts(atMs).find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  const short = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(atMs).find((p) => p.type === 'timeZoneName')?.value ?? ''
  return `${long.replace(/ (Standard|Daylight) Time$/, ' Time')} (${short})`
}
