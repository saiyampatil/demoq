// The one place a test run starts from.
//
// Phase 4 simulates the walkthrough: a scripted set of steps that ends in a report built from the real plan.
// Phase 5 builds the participant interview (P14). When it exists, set TEST_RUN_MODE to 'participant' and
// have startTestRun return a route to open P14 in Test mode (with the language and device) instead of steps.
// The report shape (RunReport in state/launch.ts) stays the same, so nothing else on R16 changes.

export type TestRunRequest = { studyId: string; language: string; device: string }

export const TEST_RUN_MODE: 'simulated' | 'participant' = 'simulated'

const STEPS = [
  'Opening the interview in Test mode',
  'Intro and consent',
  'Current behaviours',
  'Research themes',
  'Showing stimuli',
  'Running surveys',
  'Reflection and wrap-up',
]

export function startTestRun(_req: TestRunRequest): { steps: string[]; stepMs: number } {
  return { steps: STEPS, stepMs: 650 }
}
