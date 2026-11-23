// A small made-up study for testing the Concepts logic where the seeds can't: concepts shown in rotation, so each concept has its own base.
// 24 people. Each saw two of three concepts (A and B, B and C, or C and A, eight people each). Half are on video, a few have no consent,
// and some pairs of readings tie. It is only used by the tests; no screen shows it.

import type { ConceptInput, PersonConcept } from '@/state/concepts'

const ids = ['a', 'b', 'c'].map((x) => `m-concept-${x}`)
const reading = (conceptId: string, label: 'Delight' | 'Interest' | 'Neutral' | 'Doubt', intensity: 'Low' | 'Medium' | 'High', confidence = 0.8) => ({ conceptId, label, intensity, confidence })

/** Rotation: person i sees concepts (i % 3) and ((i + 1) % 3). */
export function rotatedStudy(): ConceptInput {
  const people: PersonConcept[] = Array.from({ length: 24 }, (_, i) => {
    const seen = [ids[i % 3], ids[(i + 1) % 3]]
    const video = i % 2 === 0
    const consent = i !== 4 && i !== 10
    const first = seen[0]
    const second = seen[1]
    // Each person's first-seen concept draws the warmer reading, except every sixth person, whose two readings tie.
    const readings = video && consent ? [reading(first, 'Delight', i % 6 === 0 ? 'Medium' : 'High'), reading(second, i % 6 === 0 ? 'Delight' : 'Interest', 'Medium')] : []
    return { participantId: `P-9${String(i).padStart(3, '0')}`, saw: seen, video, consent, readings, said: first, did: seen[i % 2] }
  })
  return { concepts: ids.map((id, i) => ({ id, name: `Concept ${'ABC'[i]}` })), people, hasChoiceTask: true, saidAvailable: Object.fromEntries(ids.map((id) => [id, true])) }
}
