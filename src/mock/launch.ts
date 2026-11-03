import { buildRunReport, compileStudyPlan, consentTemplate, DEVICES, defaultLinks, emptyLaunchDoc, makeRunIssue, recordRun, runKey, supportedLanguages, type Inputs, type LaunchDoc, type Release } from '@/state/launch'
import { people } from './people'

const maya = people.researcher.name

/** What differs between studies' launch records. The defaults are the seed study's. */
export type LaunchSeed = {
  guideVersion: number
  stimuli: { id: string; name: string }[]
  fieldwork: { start: string; end: string }
  consentAt: string
  releaseAt: string
  testRunsAt: [string, string]
  mandatory: number
  durationMin: number
  /** Rewrites the default support links for another client's domain. */
  domain?: string
}

const SEED_LAUNCH: LaunchSeed = {
  guideVersion: 3,
  stimuli: [
    { id: 'st-a', name: 'Concept A: 72-hour hydration' },
    { id: 'st-b', name: 'Concept B: Refillable jar' },
    { id: 'st-c', name: 'Concept C: Barrier repair' },
  ],
  fieldwork: { start: '2026-11-03', end: '2026-11-17' },
  consentAt: '2026-10-26T15:00:00-04:00',
  releaseAt: '2026-11-03T09:40:00-05:00',
  testRunsAt: ['2026-11-01T11:00:00-04:00', '2026-11-01T11:20:00-04:00'],
  mandatory: 12,
  durationMin: 20,
}

/** Study setup for the launch stages: English consent approved and a two-week fieldwork window. */
export function seedLaunchDoc(studyId: string, kind: 'ready' | 'live', client: string, seed: LaunchSeed = SEED_LAUNCH): LaunchDoc {
  const doc = emptyLaunchDoc(studyId)
  doc.setup = {
    extraLanguages: [],
    consent: { 'English (US)': { text: consentTemplate('English (US)', client), approved: true, by: maya, at: seed.consentAt, origin: 'researcher' } },
    fieldwork: seed.fieldwork,
    translated: {},
    links: seed.domain ? defaultLinks().map((l) => ({ ...l, url: l.url.replace('verdane.example', seed.domain!) })) : defaultLinks(),
  }
  if (kind === 'ready') return doc

  const at = seed.releaseAt
  const report = (device: string) => ({
    mandatoryCovered: seed.mandatory,
    mandatoryTotal: seed.mandatory,
    durationMin: seed.durationMin + (device === 'Mobile' ? 0 : 1),
    targetMin: seed.durationMin,
    stimuli: seed.stimuli.map((x) => ({ name: x.name, ok: true })),
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
    guideVersion: seed.guideVersion,
    moderator: 'Ava, warm style',
    language: 'English (US)',
    stimuli: seed.stimuli,
    planSignature: '',
  }
  return {
    ...doc,
    runs: {
      'English (US)|Mobile': { status: 'Completed', guideVersion: seed.guideVersion, at: seed.testRunsAt[0], report: report('Mobile') },
      'English (US)|Desktop': { status: 'Completed', guideVersion: seed.guideVersion, at: seed.testRunsAt[1], report: report('Desktop') },
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
  const compile = compileStudyPlan(i.guide, i.language)
  if (compile.state !== 'ok') return undefined
  const version = i.guide?.version ?? 0
  return (d) => {
    if (kind === 'none') return { ...d, runs: {} }
    const langs = supportedLanguages(i.language, d)
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
