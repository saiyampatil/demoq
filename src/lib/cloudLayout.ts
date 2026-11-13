// Deterministic word cloud placement. The same words and the same seed always give the same picture: nothing random, nothing
// that depends on the screen. Words are horizontal rectangles placed along an outward spiral, biggest first, none overlapping and
// none outside the picture. A word that can't find room is made smaller until it does.

export type CloudInput = { key: string; text: string; size: number }
export type Placed = { key: string; x: number; y: number; w: number; h: number; size: number }

/** A stable number from text, for the seed. */
export const seedOf = (text: string) => [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17)

/** Width of a word at a size. An estimate, so the layout is the same on every machine. */
const widthOf = (text: string, size: number) => Math.ceil(text.length * size * 0.56 + size * 0.9)
const heightOf = (size: number) => Math.ceil(size * 1.35)

export function layoutCloud(words: CloudInput[], width: number, height: number, seed: string, gap = 6): Placed[] {
  const placed: Placed[] = []
  const s = seedOf(seed)
  // The spiral starts at an angle that depends on the seed, so different studies don't all look alike.
  const phase = ((s % 360) * Math.PI) / 180
  const overlaps = (a: Placed) => placed.some((b) => Math.abs(a.x - b.x) * 2 < a.w + b.w + gap && Math.abs(a.y - b.y) * 2 < a.h + b.h + gap)
  const inside = (p: Placed) => p.x - p.w / 2 >= 4 && p.x + p.w / 2 <= width - 4 && p.y - p.h / 2 >= 4 && p.y + p.h / 2 <= height - 4
  for (const word of words) {
    let size = word.size
    let done: Placed | undefined
    for (let attempt = 0; attempt < 14 && !done; attempt++) {
      const w = widthOf(word.text, size)
      const h = heightOf(size)
      // Wider than the picture: shrink first.
      if (w > width - 8) {
        size = Math.floor(size * 0.9)
        continue
      }
      for (let t = 0; t < 2400; t++) {
        const angle = phase + t * 0.18
        const r = 1.6 * t * 0.5
        // Stretch the spiral sideways to follow the shape of the picture.
        const cand: Placed = { key: word.key, x: width / 2 + r * Math.cos(angle) * 1.55, y: height / 2 + r * Math.sin(angle), w, h, size }
        if (inside(cand) && !overlaps(cand)) {
          done = cand
          break
        }
        if (r > width) break
      }
      if (!done) size = Math.floor(size * 0.92)
    }
    if (done) placed.push(done)
  }
  return placed
}
