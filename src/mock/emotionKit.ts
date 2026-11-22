// The registries every study adds its emotion content to. Participant IDs and code IDs are unique across studies, so one table
// serves all of them. Pet Food's content is in emotion.ts, Ice Cream's in iceCream/emotion.ts. This file imports neither (types only).

import type { Emotion, Intensity, Stance, Tone } from './emotion'

export type Set2 = [Emotion, Intensity]

/** First reactions to each concept, in the first five seconds, by moment ID and then participant ID. Written by hand. */
export const CONCEPT_FACES: Record<string, Record<string, Set2>> = {}
/** Hand-set readings at coded quotes, by "codeId:participantId", where the story needs them. The rest are drawn. */
export const QUOTE_FACES: Record<string, Set2> = {}
/** What each code's words claim. Codes not listed state a fact or a preference. */
export const STANCE: Record<string, Stance> = {}
/** Hand-set tones at coded quotes, by "codeId:participantId". */
export const VOICE_OVERRIDES: Record<string, Tone> = {}

/** Joins one study's concept faces into the shared table. */
export function addConceptFaces(faces: Record<string, Record<string, Set2>>) {
  Object.entries(faces).forEach(([id, byPerson]) => (CONCEPT_FACES[id] = { ...(CONCEPT_FACES[id] ?? {}), ...byPerson }))
}
