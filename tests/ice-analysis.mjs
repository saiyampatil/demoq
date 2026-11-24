// Ice Cream Flavour Concept Test: every Analysis screen opens with content and no leftovers from Pet Food.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/ice-cream-flavours/analysis'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const screens = [['A1 codebook', '/codebook'], ['A1 themes', '/codebook?tab=themes'], ['A2 signals', '/signals'], ['A2 tensions', '/signals?tab=tensions'], ['A3 report', '/report'], ['theme videos', '/report/videos'], ['word cloud', '/report/wordcloud'], ['theme map', '/report/themes-map'], ['audio summary', '/report/audio-summary']]
// Pet Food's concept is "Pause, don’t cancel". "pause" needs a closing word boundary: the audio player announces "Paused, line 1 of 32", which is not a leftover.
const LEFT = /\b(pause\b|portion|subscription|cancel|Burrow|Pet Food|dog|cat owner|Biscuit|vet\b)/i
let bad = 0
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  for (const [name, path] of screens) {
    await b.goto(root + path); await b.sleep(2800)
    const t = (await b.evaluate(T)) ?? ''
    const left = t.match(LEFT)
    if (left || t.length < 200 || /No analysis for this study|Something went wrong|Cannot read/.test(t)) { bad++; console.log(`!! ${name}: ${left ? 'leftover "' + left[0] + '"' : 'thin or error'}`) }
    console.log(`\n[${name}] ${t.slice(0, 520)}`)
    await b.shot('ice-' + name.replace(/\W+/g, '-'), true)
  }
} finally { b.close() }
console.log(bad ? `\nICE ANALYSIS: ${bad} problems` : '\nICE ANALYSIS OK')
