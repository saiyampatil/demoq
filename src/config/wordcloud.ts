// Word cloud settings (A3). Nothing here is hardcoded in the page: change a number or a colour here.

export const WORDCLOUD = {
  /** A word is shown only if at least this many people said it. The toolbar can change it from 1 to 5. */
  minPeople: 2,
  minPeopleRange: [1, 5] as const,
  maxWords: 40,
  /** Font size range in px: n sets the size on a square-root scale between these. */
  font: { min: 14, max: 48 },
  /** The average of the model's confidence across a word's statements: High at or above `high`, Medium at or above `medium`, otherwise Low. */
  bands: { high: 0.8, medium: 0.6 },
  /** One hue in three steps. All three pass 4.5:1 on the card's white; Low also gets a dashed underline, so colour is never the only carrier. */
  confidenceColour: { High: '#1f1b5c', Medium: '#4a43b3', Low: '#6a63cc' } as Record<'High' | 'Medium' | 'Low', string>,
  /** Six muted colours for themes, each passing 4.5:1 on white. Stable: a theme keeps its colour by its place in the codebook. */
  themePalette: ['#2f5d8a', '#8a5a1f', '#2f7a5a', '#8a3f6b', '#5a4fa8', '#9a4a3a'],
  notInTheme: '#5f6672',
  /** The picture is drawn at this size and scaled to the card, so opening the panel only rescales it. */
  viewBox: { width: 900, height: 520 },
  /** Transcript search for Add: starts at this many characters, shows up to this many results. */
  search: { minChars: 2, maxResults: 20 },
} as const

export type Band = 'High' | 'Medium' | 'Low'
export const bandOf = (avg: number | undefined): Band => (avg === undefined ? 'Low' : avg >= WORDCLOUD.bands.high ? 'High' : avg >= WORDCLOUD.bands.medium ? 'Medium' : 'Low')
