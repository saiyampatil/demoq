// Deterministic placement for the theme map. Bubbles whose people overlap more sit closer; none overlap and none leave the picture.
// The same input always gives the same positions: no randomness, and the only seed is a number made from the study id.

export type BubbleIn = { key: string; r: number }
export type BubbleAt = { key: string; x: number; y: number; r: number }

/** A stable number from text. */
export const seedOf = (text: string) => [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 23)

/** Overlap of two sets of people, 0 to 1: the people in both, over the people in either. */
export function overlapOf(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size || !b.size) return 0
  let both = 0
  a.forEach((x) => b.has(x) && both++)
  return both / (a.size + b.size - both)
}

/**
 * `edge` names a bubble to put toward the edge of the picture instead of among the others: the one that is not a theme. It goes where it
 * is furthest from every other bubble, still inside the picture and still `gap` clear of them.
 */
export function layoutBubbles(items: BubbleIn[], overlap: (a: string, b: string) => number, width: number, height: number, seed: string, gap = 10, edge?: string): BubbleAt[] {
  if (edge && items.length > 1) {
    const rest = layoutBubbles(items.filter((i) => i.key !== edge), overlap, width, height, seed, gap)
    const me = items.find((i) => i.key === edge)!
    const phase = seedOf(seed) % 360
    let best: BubbleAt | undefined
    let bestScore = -Infinity
    for (let a = 0; a < 360; a += 6) {
      const t = ((a + phase) * Math.PI) / 180
      for (const inset of [0, 0.12, 0.25]) {
        const x = Math.min(width - me.r - 6, Math.max(me.r + 6, width / 2 + Math.cos(t) * (width / 2 - me.r - 6) * (1 - inset)))
        const y = Math.min(height - me.r - 6, Math.max(me.r + 6, height / 2 + Math.sin(t) * (height / 2 - me.r - 6) * (1 - inset)))
        const clear = Math.min(...rest.map((o) => Math.hypot(o.x - x, o.y - y) - o.r - me.r))
        if (clear < gap) continue
        // Furthest from the middle, and clear of the rest by as much as possible.
        const score = Math.hypot(x - width / 2, y - height / 2) + clear * 0.1
        if (score > bestScore) (bestScore = score), (best = { key: me.key, x, y, r: me.r })
      }
    }
    if (!best) {
      // No clear spot at the edge: lay everything out together so nothing overlaps.
      return layoutBubbles(items, overlap, width, height, seed, gap)
    }
    return [...rest, { ...best, x: Math.round(best.x * 10) / 10, y: Math.round(best.y * 10) / 10 }]
  }
  const list = [...items].sort((a, b) => b.r - a.r || a.key.localeCompare(b.key))
  if (!list.length) return []
  const phase = (seedOf(seed) % 360) * (Math.PI / 180)
  // Start round a circle, biggest first.
  const out: BubbleAt[] = list.map((it, i) => {
    const angle = phase + (i * 2 * Math.PI) / list.length
    const ring = list.length === 1 ? 0 : Math.min(width, height) * 0.22
    return { key: it.key, r: it.r, x: width / 2 + Math.cos(angle) * ring * 1.5, y: height / 2 + Math.sin(angle) * ring }
  })
  const SPREAD = Math.min(width, height) * 0.28
  for (let step = 0; step < 500; step++) {
    const k = 0.05 * (1 - step / 500) + 0.005
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        const dx = b.x - a.x || 0.001
        const dy = b.y - a.y || 0.001
        const dist = Math.hypot(dx, dy)
        // Where this pair would like to sit: touching if they share all their people, further apart the fewer they share.
        const want = a.r + b.r + gap + (1 - overlap(a.key, b.key)) * SPREAD
        const push = (dist - want) * k
        const ux = dx / dist
        const uy = dy / dist
        a.x += ux * push
        a.y += uy * push
        b.x -= ux * push
        b.y -= uy * push
      }
    for (const o of out) {
      // A pull to the middle, so the group stays together.
      o.x += (width / 2 - o.x) * 0.004
      o.y += (height / 2 - o.y) * 0.004
      o.x = Math.min(width - o.r - 6, Math.max(o.r + 6, o.x))
      o.y = Math.min(height - o.r - 6, Math.max(o.r + 6, o.y))
    }
  }
  // Finally, make sure nothing overlaps.
  for (let pass = 0; pass < 200; pass++) {
    let moved = false
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        const dx = b.x - a.x || 0.001
        const dy = b.y - a.y || 0.001
        const dist = Math.hypot(dx, dy)
        const min = a.r + b.r + gap
        if (dist < min) {
          const push = (min - dist) / 2
          a.x -= (dx / dist) * push
          a.y -= (dy / dist) * push
          b.x += (dx / dist) * push
          b.y += (dy / dist) * push
          moved = true
        }
      }
    for (const o of out) {
      o.x = Math.min(width - o.r - 6, Math.max(o.r + 6, o.x))
      o.y = Math.min(height - o.r - 6, Math.max(o.r + 6, o.y))
    }
    if (!moved) break
  }
  return out.map((o) => ({ ...o, x: Math.round(o.x * 10) / 10, y: Math.round(o.y * 10) / 10 }))
}
