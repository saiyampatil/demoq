// Every screen in CLAUDE.md's inventory, in one list.
// Routes, the stepper and the dev Screen jump menu all read from here.

export type AppKey = 'researcher' | 'participant' | 'moderator' | 'observer'
export type StepKey = 'brief' | 'audience' | 'guide' | 'launch' | 'fieldwork' | 'review' | 'analysis'

export type Screen = {
  id: string
  name: string
  app: AppKey
  module: string
  /** Build phase from CLAUDE.md. */
  phase: number
  /** Path relative to the app's base. Researcher study screens are relative to the study. */
  path: string
  step?: StepKey
  /** R10 is a drawer over R9, not its own page. */
  drawerOf?: string
  /** Screens reached from outside the stepper, e.g. Settings. */
  standalone?: boolean
  /** Kept in the code and reachable by URL, but not offered in the step's navigation. */
  hidden?: boolean
  /** A screen built for one study only: the Screen jump opens it on that study. */
  demoStudy?: string
}

export const screens: Screen[] = [
  { id: 'R0', name: 'Studies dashboard', app: 'researcher', module: '—', phase: 0, path: '' },

  { id: 'R1', name: 'Brief intake', app: 'researcher', module: '1', phase: 1, path: 'brief/intake', step: 'brief' },
  { id: 'R4', name: 'Brief editor', app: 'researcher', module: '1', phase: 1, path: 'brief/editor', step: 'brief' },
  { id: 'R5', name: 'Share brief and record decision', app: 'researcher', module: '1', phase: 1, path: 'brief/share', step: 'brief' },

  { id: 'R6', name: 'Audience definition', app: 'researcher', module: '2', phase: 2, path: 'audience/definition', step: 'audience' },
  { id: 'R7', name: 'Screener editor', app: 'researcher', module: '2', phase: 2, path: 'audience/screener', step: 'audience' },
  { id: 'R8', name: 'Participant sourcing', app: 'researcher', module: '2', phase: 2, path: 'audience/sourcing', step: 'audience' },
  { id: 'R9', name: 'Screening dashboard', app: 'researcher', module: '2', phase: 2, path: 'audience/screening', step: 'audience' },
  { id: 'R10', name: 'Applicant drawer', app: 'researcher', module: '2', phase: 2, path: 'audience/screening?applicant=A-1007', step: 'audience', drawerOf: 'R9' },
  { id: 'R11', name: 'Finalize pool', app: 'researcher', module: '2', phase: 2, path: 'audience/pool', step: 'audience' },

  { id: 'R12', name: 'Moderator setup', app: 'researcher', module: '3', phase: 3, path: 'guide/moderator', step: 'guide' },
  { id: 'R13', name: 'Stimulus library', app: 'researcher', module: '3', phase: 3, path: 'guide/stimuli', step: 'guide' },
  { id: 'R14', name: 'Discussion guide editor', app: 'researcher', module: '3', phase: 3, path: 'guide/editor', step: 'guide' },

  { id: 'R15', name: 'Launch readiness', app: 'researcher', module: '4.1', phase: 4, path: 'launch/readiness', step: 'launch' },
  { id: 'R16', name: 'Test runs', app: 'researcher', module: '4.1', phase: 4, path: 'launch/test-runs', step: 'launch', hidden: true },
  { id: 'R17', name: 'Preflight and authorize launch', app: 'researcher', module: '4.1', phase: 4, path: 'launch/preflight', step: 'launch', hidden: true },

  { id: 'R18', name: 'Fieldwork command center', app: 'researcher', module: '4.6', phase: 7, path: 'fieldwork/command-center', step: 'fieldwork' },
  { id: 'R19', name: 'Session record', app: 'researcher', module: '4.6 / 4.7', phase: 7, path: 'fieldwork/sessions/:sessionId', step: 'fieldwork' },

  { id: 'R21', name: 'Review queue', app: 'researcher', module: '4.8', phase: 8, path: 'review/queue', step: 'review' },
  { id: 'R22', name: 'Session review', app: 'researcher', module: '4.8', phase: 8, path: 'review/session/:sessionId', step: 'review' },

  { id: 'A1', name: 'Codebook', app: 'researcher', module: '5', phase: 10, path: 'analysis/codebook', step: 'analysis', demoStudy: 'pet-food-churn' },
  { id: 'A2', name: 'Signals & tensions', app: 'researcher', module: '5', phase: 10, path: 'analysis/signals', step: 'analysis', demoStudy: 'pet-food-churn' },
  { id: 'A3', name: 'Report', app: 'researcher', module: '5', phase: 10, path: 'analysis/report', step: 'analysis', demoStudy: 'pet-food-churn' },
  { id: 'R23', name: 'Study settings', app: 'researcher', module: '4.9', phase: 9, path: 'settings', standalone: true },

  { id: 'P1', name: 'Welcome, data consent, 18+ check', app: 'participant', module: '2', phase: 2, path: 'welcome' },
  { id: 'P2', name: 'Screener', app: 'participant', module: '2', phase: 2, path: 'screener' },
  { id: 'P3', name: 'Screening result', app: 'participant', module: '2', phase: 2, path: 'screening-result' },
  { id: 'P4', name: 'Verification intro and permissions', app: 'participant', module: '2', phase: 2, path: 'verify' },
  { id: 'P5', name: 'Verification checks', app: 'participant', module: '2', phase: 2, path: 'verify/video' },
  { id: 'P6', name: 'Proof upload', app: 'participant', module: '2', phase: 2, path: 'verify/proof' },
  { id: 'P7', name: 'Verification result', app: 'participant', module: '2', phase: 2, path: 'verify/result' },
  { id: 'P8', name: 'Link unavailable', app: 'participant', module: '4.2', phase: 5, path: 'unavailable' },
  { id: 'P9', name: 'Entry disclosure and consent', app: 'participant', module: '4.2', phase: 5, path: 'consent' },
  { id: 'P10', name: 'Slot booking and confirmation', app: 'participant', module: '4.2', phase: 5, path: 'booking' },
  { id: 'P12', name: 'Pre-session checks', app: 'participant', module: '4.2', phase: 5, path: 'checks' },
  { id: 'P13', name: 'Waiting room', app: 'participant', module: '4.2', phase: 5, path: 'waiting-room' },
  { id: 'P14', name: 'Interview', app: 'participant', module: '4.3 / 4.4 / 4.5', phase: 5, path: 'interview' },
  { id: 'P15', name: 'Resume', app: 'participant', module: '4.7', phase: 5, path: 'resume' },
  { id: 'P16', name: 'Escalation consent', app: 'participant', module: '4.5', phase: 6, path: 'escalation' },
  { id: 'P17', name: 'Closing', app: 'participant', module: '4.7', phase: 5, path: 'closing' },
  { id: 'P18', name: 'Something’s not working (self-service fix)', app: 'participant', module: '4.2 / 4.7', phase: 5, path: 'technical-issue' },

  { id: 'M1', name: 'My sessions', app: 'moderator', module: '4.5', phase: 6, path: 'sessions' },
  { id: 'M2', name: 'Moderator console', app: 'moderator', module: '4.5', phase: 6, path: 'sessions/:sessionId/console' },
  { id: 'M3', name: 'Post-session notes', app: 'moderator', module: '4.5 / 4.7', phase: 6, path: 'sessions/:sessionId/notes' },

  { id: 'O1', name: 'Backroom view', app: 'observer', module: '4.5', phase: 6, path: 'sessions/:sessionId' },
]

export const screenById = Object.fromEntries(screens.map((s) => [s.id, s])) as Record<string, Screen>

export const appBase: Record<AppKey, string> = {
  researcher: '/researcher',
  participant: '/p/:inviteId',
  moderator: '/moderator',
  observer: '/observer',
}

export const appLabel: Record<AppKey, string> = {
  researcher: 'Researcher',
  participant: 'Participant',
  moderator: 'Moderator',
  observer: 'Observer',
}

export const steps: { key: StepKey; label: string }[] = [
  { key: 'brief', label: 'Brief' },
  { key: 'audience', label: 'Audience' },
  { key: 'guide', label: 'Moderator & Guide' },
  { key: 'launch', label: 'Launch' },
  { key: 'fieldwork', label: 'Fieldwork' },
  { key: 'review', label: 'Review' },
  { key: 'analysis', label: 'Analysis' },
]

/** Sample IDs used to fill route params in links and the Screen jump menu. */
export const sample = {
  studyId: 'moisturizer-concept',
  sessionId: 'P-2041',
  inviteId: 'inv-7f3k2q',
}

export function studyPath(studyId: string, screen: Screen) {
  return `/researcher/studies/${studyId}/${screen.path.replace(':sessionId', sample.sessionId)}`
}

/** A concrete URL for any screen, with sample params filled in. */
export function screenHref(screen: Screen, studyId = sample.studyId) {
  if (screen.app === 'researcher') return screen.id === 'R0' ? '/researcher' : studyPath(screen.demoStudy ?? studyId, screen)
  const base = appBase[screen.app].replace(':inviteId', sample.inviteId)
  return `${base}/${screen.path.replace(':sessionId', sample.sessionId)}`
}

export function screensForStep(step: StepKey) {
  return screens.filter((s) => s.step === step && !s.drawerOf && !s.hidden)
}

/** Researcher screens that are built. The sub-stepper lists the rest as upcoming. */
export const builtScreenIds = new Set(['R1', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R21', 'R22', 'A1', 'A2', 'A3'])

/** Short names for the sub-stepper inside a step. */
export const wizardLabel: Record<string, string> = {
  R1: 'Intake',
  R4: 'Editor',
  R5: 'Share',
  R6: 'Audience',
  R7: 'Screener',
  R8: 'Sourcing',
  R9: 'Screening',
  R11: 'Pool',
  R12: 'Moderator',
  R13: 'Stimuli',
  R14: 'Discussion guide',
  R15: 'Launch',
  R16: 'Test runs',
  R17: 'Authorize',
  R18: 'Command center',
  R19: 'Session',
  R21: 'Queue',
  R22: 'Session',
  A1: 'Codebook',
  A2: 'Signals & tensions',
  A3: 'Report',
}

/** Position of a screen in the global order, used to pick the slide direction. */
export const screenOrder = (id: string) => screens.findIndex((s) => s.id === id)
