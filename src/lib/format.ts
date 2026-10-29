import { studyTimeZone, zoneLabel } from './timeZone'

// Dates and times are shown in the study's time zone (lib/timeZone.ts). Anything with a clock time carries the
// zone label, e.g. "Nov 4 2026, 12:22 PM ET". Date-only values have no label.

const fmt = (options: Intl.DateTimeFormatOptions, iso: string) => new Date(iso).toLocaleString('en-US', { ...options, timeZone: studyTimeZone() })
const tag = (text: string) => `${text} ${zoneLabel()}`

export const formatDate = (iso: string) => fmt({ month: 'short', day: 'numeric', year: 'numeric' }, iso)

/** "Nov 4, 2026, 12:22 PM ET" */
export const formatDateTime = (iso: string) => tag(fmt({ month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }, iso))

/** "Nov 4 2026, 12:22 PM ET" */
export const formatStamp = (iso: string) => tag(fmt({ month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }, iso).replace(/(\d), (\d{4}),/, '$1 $2,'))

/** "Nov 4, 12:22 PM ET" */
export const formatSlot = (iso: string) => tag(fmt({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, iso))

/** "Nov 4", no year and no clock. */
export const formatDay = (iso: string) => fmt({ month: 'short', day: 'numeric' }, iso)

/** "12:22 PM ET" */
export const formatClock = (iso: string) => tag(fmt({ hour: 'numeric', minute: '2-digit' }, iso))
