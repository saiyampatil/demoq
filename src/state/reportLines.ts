// One sentence of the report, and where it comes from. Every line has a source and a tag. Numbers inside a line are kept apart as
// "figure" parts, so an editor can lock them as chips and a validator can find them.

export type Tag = 'Brief' | 'Setup' | 'Analysis'
export type PartKey = 'study' | 'who' | 'found' | 'firm'

/** What a sentence stands on. The Sources drawer opens the matching view. */
export type Source =
  | { type: 'brief'; section: 'objective' }
  | { type: 'setup'; what: 'stimuli' | 'sessions' }
  | { type: 'theme'; id: string; name: string }
  | { type: 'concept'; id: string; name: string }
  | { type: 'tension'; id: string; kind: string }
  /** A finding sentence about one guide question, built on its accepted codes. */
  | { type: 'question'; id: string; codeIds?: string[] }
  | { type: 'firmness'; questionIds: string[]; objectiveIds: string[] }

export type Part = { t: 'text' | 'fig'; v: string }
export const txt = (v: string): Part => ({ t: 'text', v })
/** A number the code wrote. Locked: an edit can change the words around it, never this. */
export const fig = (v: string): Part => ({ t: 'fig', v })

export type Line = {
  id: string
  text: string
  parts: Part[]
  tag: Tag
  source: Source
  /** A short quiet lead-in: the theme name, the tension type, or the guide question. Not part of the sentence. */
  lead?: string
  /** The summary's part this sentence belongs to. */
  part?: PartKey
  /** A group under 10 people, as A2 says. A firmness statement, not a metric. */
  directional?: boolean
}

export function lineOf(id: string, parts: Part[], tag: Tag, source: Source, extra: { lead?: string; part?: PartKey; directional?: boolean } = {}): Line {
  return { id, parts, text: parts.map((p) => p.v).join(''), tag, source, ...extra }
}

/** A sentence's text split into plain text and the figures in it ("12 of 14"), so the figures can be locked. */
export function partsOf(text: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const m of text.matchAll(/\d+ of (?:the |those )?\d+/g)) {
    if (m.index! > last) parts.push(txt(text.slice(last, m.index)))
    parts.push(fig(m[0]))
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push(txt(text.slice(last)))
  return parts
}

/** A line whose words are one block of text (an accepted A2 sentence, verbatim). Its figures are found in the text. */
export function verbatim(id: string, text: string, tag: Tag, source: Source, extra: { lead?: string; directional?: boolean } = {}): Line {
  return { id, text, parts: partsOf(text), tag, source, ...extra }
}
