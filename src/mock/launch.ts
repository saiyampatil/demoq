import { buildRunReport, compileStudyPlan, consentTemplate, DEVICES, defaultLinks, emptyLaunchDoc, makeRunIssue, recordRun, runKey, supportedLanguages, type Inputs, type LaunchDoc, type Release } from '@/state/launch'
import { people } from './people'

const maya = people.researcher.name

/** Study setup for the launch stages: English consent approved and a two-week fieldwork window. */
export function seedLaunchDoc(studyId: string, kind: 'ready' | 'live', client: string): LaunchDoc {
  const doc = emptyLaunchDoc(studyId)
  doc.setup = {
    extraLanguages: [],
    consent: { 'English (US)': { text: consentTemplate('English (US)', client), approved: true, by: maya, at: '2026-10-26T15:00:00-04:00', origin: 'researcher' } },
    fieldwork: { start: '2026-11-03', end: '2026-11-17' },
    translated: {},
    links: defaultLinks(),
  }
  if (kind === 'ready') return doc

  const at = '2026-11-03T09:40:00-05:00'
  const report = (device: string) => ({
    mandatoryCovered: 12,
    mandatoryTotal: 12,
    durationMin: device === 'Mobile' ? 20 : 21,
    targetMin: 20,
    stimuli: [
      { name: 'Concept A: 72-hour hydration', ok: true },
      { name: 'Concept B: Refillable jar', ok: true },
      { name: 'Concept C: Barrier repair', ok: true },
    ],
    surveysCompleted: 2,
    surveysTotal: 2,
    note: '',
    issues: [],
  })
  const release: Release = {
    number: 1,
    version: 'Release v1.0',
    by: maya,
    at,
    guideVersion: 3,
    moderator: 'Ava, warm style',
    language: 'English (US)',
    stimuli: [
      { id: 'st-a', name: 'Concept A: 72-hour hydration' },
      { id: 'st-b', name: 'Concept B: Refillable jar' },
      { id: 'st-c', name: 'Concept C: Barrier repair' },
    ],
    planSignature: '',
  }
  return {
    ...doc,
    runs: {
      'English (US)|Mobile': { status: 'Completed', guideVersion: 3, at: '2026-11-01T11:00:00-04:00', report: report('Mobile') },
      'English (US)|Desktop': { status: 'Completed', guideVersion: 3, at: '2026-11-01T11:20:00-04:00', report: report('Desktop') },
    },
    release,
    releases: [release],
  }
}

export type MockRuns = 'pass' | 'issue' | 'none' | 'outdated'

/**
 * The dev panel's test-run switches. Each returns a change to the launch doc, built from the real compiled plan,
 * so the reports are the ones a real run would give. It does nothing if the plan doesn't compile.
 */
export function mockTestRuns(kind: MockRuns, i: Inputs): ((d: LaunchDoc) => LaunchDoc) | undefined {
  const compile = compileStudyPlan(i.guide)
  if (compile.state !== 'ok') return undefined
  const version = i.guide?.version ?? 0
  return (d) => {
    if (kind === 'none') return { ...d, runs: {} }
    const langs = supportedLanguages(i.guide, d)
    let doc: LaunchDoc = { ...d, runs: {} }
    langs.forEach((lang, li) =>
      DEVICES.forEach((dev, di) => {
        const report = { ...buildRunReport({ ...i, launch: d, plan: compile.plan }, lang, dev), issues: [] }
        const broken = kind === 'issue' && li === 0 && di === DEVICES.length - 1
        doc = recordRun(doc, runKey(lang, dev), kind === 'outdated' ? Math.max(0, version - 1) : version, broken ? { ...report, issues: [makeRunIssue('Media rendering', 'A concept card did not load on this device (mock).', maya)] } : report, broken ? 'Issues found' : 'Completed')
      }),
    )
    return doc
  }
}
