// Fieldwork Overview: the "repeating problem" line. One file, so the threshold and the wording are changed in one place.

import type { IssueType } from '@/state/fieldwork'

/** The same problem has to reach this many different participants in the study before the Overview says so. */
export const REPEATING_PROBLEM_MIN_PEOPLE = 3

export type RepeatingProblemKind = {
  key: string
  /** How the problem is named on the line: "{label} for 4 people." */
  label: string
  /** The issue types that count as this problem. */
  types: IssueType[]
  /** What to check first. Shown after the count. */
  check: string
}

/** In this order when two problems reach the same number of people. Issue types not listed here never make the line. */
export const REPEATING_PROBLEMS: RepeatingProblemKind[] = [
  { key: 'mic-camera', label: 'Microphone or camera blocked', types: ['Microphone permission denied', 'Camera not detected'], check: 'Check the pre-session instructions.' },
  { key: 'unsupported', label: 'Browser or device unsupported', types: ['Unsupported browser or device'], check: 'Check the supported browser notice.' },
  { key: 'link', label: 'Link expired or invalid', types: ['Link expired or invalid'], check: 'Check the invitation window and link settings.' },
  { key: 'connection', label: 'Connection lost', types: ['Connection lost'], check: 'Check interview length and stability.' },
  { key: 'stimulus', label: 'Stimulus failed to load', types: ['Stimulus failed to load'], check: 'Check the stimulus file in Interview materials.' },
  { key: 'consent-recording', label: 'Consent or recording failed', types: ['Consent capture failed', 'Recording failed to start', 'Recording upload incomplete'], check: 'Report to PulseAI support.' },
]
