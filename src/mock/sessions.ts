// The one list of sessions for the seed study. Fieldwork (R18, R19), Review (R21, R22) and the stepper all read
// from it (one cohort, 25 participants, 27 sessions, because two people came back for a second one): a session is in Fieldwork until it ends, then in Review. 25 people were invited for a target of 24.
// Times are Eastern. The prototype clock is FIELDWORK_NOW in state/fieldwork.ts (Nov 11 2026, 5 PM).

/** How far the person got. "done" sessions completed and are in Review; the rest are still in Fieldwork. */
export type SeedVariant = 'done' | 'active' | 'incomplete' | 'error' | 'withdrawn' | 'consented' | 'noshow' | 'opened' | 'invited'

export type SeedIssue = [type: string, severity: 'Blocking' | 'Degraded' | 'Minor', status: 'Open' | 'Resolved', resolution?: string]

export type SeedReview = {
  integrity: number
  quality: number
  flags: string[]
  status: 'Under review' | 'Accepted' | 'Excluded'
}

export type SeedSession = {
  /** The person. A participant can have more than one session: a resume, a retry, a reschedule. */
  participant: string
  /** Their session number, 1 unless they came back. The session ID is `P-2041-1`. */
  no?: number
  state: string
  variant: SeedVariant
  /** Completed sessions: when the interview ended. Others: the person's latest step (started, consented, opened, invited). */
  at: string
  durationMin?: number
  issues?: SeedIssue[]
  review?: SeedReview
}

const ET = (day: number, hm: string) => `2026-11-${String(day).padStart(2, '0')}T${hm}:00-05:00`

export const SEED_SESSIONS: SeedSession[] = [
  // ── Completed: in Review ──
  { participant: 'P-2041', state: 'New York', variant: 'done', at: ET(3, '11:20'), durationMin: 22, issues: [['Stimulus failed to load', 'Degraded', 'Resolved', 'A fallback card was shown. Counted as not seen.']], review: { integrity: 41, quality: 78, flags: ['Screener contradiction', 'Extended silence', 'Incorrect stimulus presentation'], status: 'Under review' } },
  { participant: 'P-2043', state: 'Texas', variant: 'done', at: ET(3, '16:40'), durationMin: 19, issues: [['Echo or background noise', 'Minor', 'Resolved', 'Noted for the reviewer']], review: { integrity: 34, quality: 82, flags: ['Rushed response', 'Duplicate entry', 'Audio-transcript mismatch'], status: 'Under review' } },
  { participant: 'P-2044', no: 1, state: 'California', variant: 'error', at: ET(3, '15:30'), durationMin: 3, issues: [['Connection lost', 'Blocking', 'Resolved', 'The participant came back on a new link. Their second session is the one in Review.']] },
  { participant: 'P-2046', no: 1, state: 'Georgia', variant: 'incomplete', at: ET(3, '14:00'), durationMin: 9, issues: [['Audio dropped', 'Degraded', 'Resolved', 'Participant rejoined and the answer was repeated']] },
  { participant: 'P-2044', no: 2, state: 'California', variant: 'done', at: ET(4, '10:15'), durationMin: 26, issues: [['Survey answer not saved', 'Degraded', 'Resolved', 'Answer re-entered and locked']], review: { integrity: 77, quality: 49, flags: ['Insufficient probing'], status: 'Under review' } },
  { participant: 'P-2045', state: 'Illinois', variant: 'done', at: ET(4, '12:30'), durationMin: 20, issues: [['Stimulus failed to load', 'Degraded', 'Resolved', 'The card could not be shown. Counted as not seen.']], review: { integrity: 69, quality: 85, flags: ['Incorrect stimulus presentation'], status: 'Under review' } },
  { participant: 'P-2046', no: 2, state: 'Georgia', variant: 'done', at: ET(4, '15:10'), durationMin: 23, issues: [['Recording upload incomplete', 'Degraded', 'Resolved', 'Upload retried and verified']], review: { integrity: 52, quality: 38, flags: ['Leading question', 'Repetitive or canned answers', 'Missed core theme'], status: 'Under review' } },
  { participant: 'P-2049', state: 'Washington', variant: 'done', at: ET(5, '14:00'), durationMin: 18, review: { integrity: 29, quality: 74, flags: ['Rushed response', 'Screener contradiction'], status: 'Under review' } },
  { participant: 'P-2054', state: 'Massachusetts', variant: 'done', at: ET(7, '12:10'), durationMin: 21, issues: [['AI agent timeout', 'Degraded', 'Resolved', 'Session resumed']], review: { integrity: 91, quality: 83, flags: ['Guide deviation'], status: 'Under review' } },
  { participant: 'P-2055', state: 'Florida', variant: 'done', at: ET(10, '15:45'), durationMin: 25, review: { integrity: 36, quality: 61, flags: ['Identity mismatch', 'Repetitive or canned answers'], status: 'Under review' } },
  { participant: 'P-2057', state: 'Ohio', variant: 'done', at: ET(11, '13:15'), durationMin: 26, issues: [['Video stream interrupted', 'Degraded', 'Resolved', 'Stream restarted after 40 seconds']], review: { integrity: 79, quality: 51, flags: ['Repetitive AI prompt'], status: 'Under review' } },
  { participant: 'P-2059', state: 'Colorado', variant: 'done', at: ET(3, '12:00'), durationMin: 21, review: { integrity: 92, quality: 90, flags: [], status: 'Under review' } },
  { participant: 'P-2060', state: 'New York', variant: 'done', at: ET(4, '11:00'), durationMin: 24, review: { integrity: 87, quality: 84, flags: [], status: 'Under review' } },
  { participant: 'P-2062', state: 'Texas', variant: 'done', at: ET(6, '11:40'), durationMin: 25, issues: [['Connection lost', 'Blocking', 'Resolved', 'Participant rejoined and the answer was repeated']], review: { integrity: 74, quality: 77, flags: ['Technical error'], status: 'Accepted' } },
  { participant: 'P-2063', state: 'California', variant: 'done', at: ET(4, '16:30'), durationMin: 17, review: { integrity: 22, quality: 64, flags: ['Duplicate entry', 'Rushed response', 'Screener contradiction'], status: 'Excluded' } },
  { participant: 'P-2064', state: 'Illinois', variant: 'done', at: ET(7, '11:30'), durationMin: 15, review: { integrity: 31, quality: 33, flags: ['Leading question', 'Repetitive or canned answers', 'Rushed response', 'Missed core theme'], status: 'Excluded' } },

  // ── Still in Fieldwork ──
  { participant: 'P-2042', state: 'Georgia', variant: 'active', at: '2026-11-11T16:38:00-05:00', issues: [['Transcription delayed', 'Minor', 'Open']] },
  { participant: 'P-2047', state: 'Washington', variant: 'incomplete', at: ET(10, '15:00'), durationMin: 9, issues: [['Audio dropped', 'Degraded', 'Resolved', 'Participant rejoined and the answer was repeated']] },
  { participant: 'P-2048', state: 'Massachusetts', variant: 'error', at: ET(11, '10:30'), durationMin: 3, issues: [['Connection lost', 'Blocking', 'Open']] },
  { participant: 'P-2050', state: 'Florida', variant: 'withdrawn', at: ET(9, '14:20'), durationMin: 6, issues: [['Recording failed to start', 'Blocking', 'Resolved', 'The participant withdrew. No recording is kept.']] },
  { participant: 'P-2051', state: 'Ohio', variant: 'consented', at: ET(11, '09:00'), issues: [['Camera not detected', 'Blocking', 'Resolved', 'Offered the audio-only access mode']] },
  { participant: 'P-2052', state: 'Colorado', variant: 'consented', at: ET(10, '18:30'), issues: [['Consent capture failed', 'Blocking', 'Resolved', 'Participant consented again and it was saved']] },
  { participant: 'P-2053', state: 'New York', variant: 'noshow', at: ET(5, '10:00') },
  { participant: 'P-2056', state: 'Texas', variant: 'noshow', at: ET(6, '13:00') },
  { participant: 'P-2058', state: 'California', variant: 'opened', at: ET(9, '19:10'), issues: [['Unsupported browser or device', 'Blocking', 'Resolved', 'Sent a link to open in Chrome']] },
  { participant: 'P-2061', state: 'Illinois', variant: 'opened', at: ET(10, '12:25'), issues: [['Microphone permission denied', 'Blocking', 'Open']] },
  { participant: 'P-2065', state: 'Georgia', variant: 'invited', at: ET(8, '09:00'), issues: [['Link expired or invalid', 'Blocking', 'Open']] },
]

export const sessionIdOf = (s: Pick<SeedSession, 'participant' | 'no'>) => `${s.participant}-${s.no ?? 1}`
