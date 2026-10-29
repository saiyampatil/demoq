// The study's time zone. Every timestamp in the Researcher app is shown in it and labelled with it, so
// "11:20 AM" is never ambiguous. The zone is a field on the study record (`timeZone`); Study settings (R23)
// will edit it. Until a study is opened the default applies.

export const DEFAULT_TIME_ZONE = 'America/New_York'

const SHORT: Record<string, string> = {
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Phoenix': 'MST',
  'America/Los_Angeles': 'PT',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HST',
  UTC: 'UTC',
}

let current = DEFAULT_TIME_ZONE

/** Called by the study workspace with the open study's zone, and with nothing outside a study. */
export const setStudyTimeZone = (id?: string) => {
  current = id || DEFAULT_TIME_ZONE
}

export const studyTimeZone = () => current

/** "ET", "CT" and so on; other zones fall back to their UTC offset, e.g. "GMT+5:30". */
export function zoneLabel(id: string = current): string {
  if (SHORT[id]) return SHORT[id]
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: id, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? id
  } catch {
    return id
  }
}
