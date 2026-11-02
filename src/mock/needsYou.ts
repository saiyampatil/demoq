// Needs you: how long a problem has to go on before it becomes the Researcher's. A row never appears before its grace
// period ends, because the participant's own screens and PulseAI get the first go. These are mock constants for the
// prototype; the real values will be set by the platform.

export const NEEDS_YOU_GRACE_MIN = {
  /** Waiting for moderator: nobody answered, so it is already late. */
  escalation: 0,
  /** Moderator didn't show: the participant is already waiting, and it is our fault. */
  moderatorNoShow: 0,
  /** Self-service failed: the on-screen steps and one retry are already done. */
  selfServiceFailed: 0,
  /** Link expired or invalid: they can't start until a new one is issued. */
  linkExpired: 0,
  /** Connection lost: time to come back and resume on their own. */
  connectionLost: 15,
  /** Left part-way: time to come back from their link. */
  leftPartWay: 30,
  /** Consented (or opened) but never started: a day to get to it. */
  neverStarted: 24 * 60,
  /** PulseAI hasn't recovered: the timeout it gets before a person is told. */
  pulseAiUnrecovered: 2 * 60,
} as const

/** Dev only: the steps of "Simulate time passing". */
export const SIMULATE_TIME_STEPS = [
  { label: '+15 min', minutes: 15 },
  { label: '+30 min', minutes: 30 },
  { label: '+2 h', minutes: 120 },
  { label: '+24 h', minutes: 24 * 60 },
] as const
