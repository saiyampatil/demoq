// Theme map settings (A3). Nothing here is hardcoded in the page: change a number or a colour here.

export const THEME_MAP = {
  /** A segment with fewer people than this is "Directional". */
  segmentMinimum: 5,
  /** Fewer readable people than this and a theme is "Not enough read". */
  minRead: 3,
  /** Reaction strength: the share of readable people whose delivery is strong. High at or above `high`, Medium at or above `medium`. */
  strength: { high: 0.6, medium: 0.3 },
  /**
   * Whether the face reading may feed the colour. Off until it is signed off: voice and hesitation only. Switch it on and a face
   * of Delight, Interest, Surprise, Confusion, Doubt or Frustration, read at this confidence or more, counts as strong too.
   */
  faceInColour: false,
  faceConfidence: 0.6,
  strongFaces: ['Delight', 'Interest', 'Surprise', 'Confusion', 'Doubt', 'Frustration'] as const,
  strongTones: ['Animated', 'Tense'] as const,
  /** The picture is drawn at this size and scaled to the card. */
  viewBox: { width: 900, height: 520 },
  /** Bubble radius in the picture, on a square-root scale of people. */
  radius: { min: 28, max: 92 },
  /** Fill and text for each strength band: one hue in three steps, never red and green. Text on each fill passes 4.5:1. */
  strengthFill: { High: { fill: '#2f7f78', text: '#ffffff' }, Medium: { fill: '#8cc9c0', text: '#0f2b28' }, Low: { fill: '#d9eeea', text: '#0f2b28' } },
  /** Words vs delivery: Consistent neutral, Conflicting amber, Mixed light amber. */
  verdictFill: { Consistent: { fill: '#eceef2', text: '#1b1d22' }, Conflicting: { fill: '#f0b955', text: '#2a1c00' }, Mixed: { fill: '#f8e3b5', text: '#2a1c00' } },
  /** The one bubble for accepted codes in no theme is plain grey in both colour modes; its band and verdict are still said in words. */
  notInTheme: { fill: '#d3d6dc', text: '#1b1d22' },
  hatched: { fill: '#e4e6ea', stripe: '#b3b8c1', text: '#1b1d22' },
  /** The ring round a bubble says how words and delivery fit, in both colour modes. */
  ring: { colour: '#4b5563', amber: '#b45309' },
  motion: { settleMs: 600, resizeMs: 400, hoverMs: 120, selectMs: 200, crossfadeMs: 250, staggerMs: 90, tourAutoMs: 5000 },
  dimOpacity: 0.4,
} as const

export type StrengthBand = 'High' | 'Medium' | 'Low'
export const strengthBandOf = (share: number): StrengthBand => (share >= THEME_MAP.strength.high ? 'High' : share >= THEME_MAP.strength.medium ? 'Medium' : 'Low')
