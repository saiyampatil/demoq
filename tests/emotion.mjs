// Emotion & behaviour (A2): faces, voice, words vs delivery, theme roll-ups, corrections, the tension made from emotion,
// and the corrected count on a tension theme. Every step waits on state and every expectation is asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/emotion.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail ? `${label} (${detail})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const clickText = async (sel, label) => {
  const done = await b.poll(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.innerText.trim().replace(/\\s+/g,' ').startsWith(${JSON.stringify(label)}));if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel} "${label}"`)
  await b.sleep(350)
}
const fresh = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto(`${root}/signals`)
  await b.waitFor('Emotion & behaviour'); await b.waitFor('What stands out'); await b.sleep(500)
}
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const selectCode = async (name) => { await clickText('[data-testid=signal-row]', name); await b.sleep(300) }

try {
  await fresh()
  const page = await text('main')
  ok('step is named Emotion & behaviour', /Emotion & behaviour/.test(page ?? ''))
  ok('the old step name is gone from the header', !/Signals & tensions/.test(page ?? ''))
  ok('the coverage line says who has no face reading', /audio-only, so no face reading/.test((await text('[data-testid=coverage]')) ?? ''), await text('[data-testid=coverage]'))
  ok('Emotion is the default channel', await b.evaluate(`document.querySelector('[data-testid=lens-emotion]').getAttribute('aria-pressed')==='true'`))
  const stand = await b.evaluate(`[...document.querySelectorAll('[data-testid=standout]')].map(e=>e.innerText.replace(/\\s+/g,' '))`)
  ok('What stands out leads with the warmest concept (C)', /Concept C/.test(stand[0] ?? '') && /warmest/.test(stand[0] ?? ''), stand[0])
  ok('What stands out has a words-vs-delivery line', stand.some((s) => /didn’t match the words/.test(s)), stand.join(' | '))
  ok('What stands out still has hesitation and tensions', stand.some((s) => /marked hesitation/.test(s)) && stand.some((s) => /tensions? to review/.test(s)), stand.join(' | '))
  await b.shot('emo-a2-overview')

  // The positive-claim theme only exists once the Researcher accepts PulseAI's suggestion for it.
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
  const accepted = await b.evaluate(`(()=>{const s=[...document.querySelectorAll('[data-testid=theme-suggestion]')].find(x=>/Wanting control/.test(x.innerText));if(!s)return false;s.querySelector('[data-testid=accept-theme]').click();return true})()`)
  ok('PulseAI suggests a theme for the control codes', accepted)
  await b.sleep(500)
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(500)

  // ── By code: the table, the roll-up, the report switch ──
  const rows = await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  const nothing = rows.find((r) => /Nothing would have kept them/.test(r))
  ok('a code with two people reads "Too few to read"', /Too few to read/.test(nothing ?? ''), nothing)
  ok('and cannot be put in the report', await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Nothing would have kept them/.test(r.innerText)).closest('li').querySelector('[data-testid=use-signal]').disabled`))
  const rolls = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-rollup]')].map(e=>e.innerText.replace(/\\s+/g,' '))`)
  ok('every theme has a roll-up line with people, faces and hesitation', rolls.length >= 3 && rolls.every((r) => /people\. Faces read for \d+/.test(r) && /Marked hesitation in \d+ of \d+/.test(r)), rolls.join(' | '))
  ok('a theme with a positive claim and an unsettled delivery says so', await b.evaluate(`!!document.querySelector('[data-testid=theme-highlight]')`), rolls.join(' | '))

  // ── The code panel: every channel, and the pause story ──
  await selectCode('Pause would have kept them')
  const panel = await text('[data-testid=signal-panel]')
  ok('the panel shows words, face, voice and hesitation', ['Words', 'Face', 'Voice', 'Hesitation'].every((w) => new RegExp(`\\b${w}\\b`).test(panel ?? '')), panel?.slice(0, 300))
  ok('the panel says the delivery pulled against the words', /pulled against the words/.test(panel ?? ''), panel?.slice(0, 400))
  ok('audio-only people say so instead of showing a face', (await b.evaluate(`document.querySelectorAll('[data-testid=no-face]').length`)) >= 1)
  ok('a face reading shows what was seen', /Seen: /.test(panel ?? ''))
  ok('every person shows their delay, pause and fillers', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-point]').length`)) === 6)
  await b.shot('emo-a2-code-panel')

  // ── Correct a face reading: reason required, counts move, original stays, logged ──
  const before = await text('[data-testid=channel-face]')
  const firstKey = await b.evaluate(`(()=>{const li=[...document.querySelectorAll('[data-testid=signal-point]')].find(l=>l.querySelector('[data-testid=face-reading]')&&l.querySelector('[data-testid=face-reading]').dataset.emotion!=='Neutral');return li?li.dataset.key:null})()`)
  ok('a corrigible reading exists', !!firstKey)
  const was = await b.evaluate(`document.querySelector('[data-key=${JSON.stringify(firstKey)}] [data-testid=face-reading]').dataset.emotion`.replace(JSON.stringify(firstKey), `"${firstKey}"`))
  await b.evaluate(`document.querySelector('[data-key="${firstKey}"] [data-testid=fix-face]').click(); true`); await b.sleep(400)
  ok('the dialog opens', await b.evaluate(`!!document.querySelector('[role=dialog] [data-testid=fix-confirm]')`))
  ok('saving needs a change and a reason', await b.evaluate(`document.querySelector('[data-testid=fix-confirm]').disabled`))
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.innerText.trim().startsWith('No clear expression')).querySelector('input').click(); true`); await b.sleep(250)
  ok('still needs a reason', await b.evaluate(`document.querySelector('[data-testid=fix-confirm]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'She is squinting at the screen, not doubting it.')); await b.sleep(250)
  await b.shot('emo-a2-fix-dialog')
  await click('[data-testid=fix-confirm]')
  const card = await text(`[data-key="${firstKey}"]`)
  ok('the original reading stays visible beside the correction', /PulseAI read/.test(card ?? '') && /squinting/.test(card ?? '') && /No clear expression/.test(card ?? ''), card)
  const after = await text('[data-testid=channel-face]')
  ok('the face counts move', after !== before && /marked no clear expression/.test(after ?? ''), `${before} -> ${after}`)
  await b.goto(`${root}/codebook?tab=log`); await b.waitFor('Change log'); await b.sleep(500)
  const log = await text('main')
  ok('the correction is in the change log with the reason', /Face reading corrected/.test(log ?? '') && /squinting/.test(log ?? ''))
  ok('the log can be filtered to face readings', await b.evaluate(`!![...document.querySelectorAll('option')].find(o=>o.textContent==='Face readings only')`))

  // ── By moment: the concept story, split by owner, never neutral for no video ──
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  await click('[data-testid=view-moment]')
  const moments = await b.evaluate(`[...document.querySelectorAll('[data-testid=moment-row]')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  const rowC = moments.find((r) => /Concept C/.test(r))
  ok('Concept C is marked the warmest reaction', /Warmest reaction/.test(rowC ?? ''), rowC)
  ok('concept rows count warm, neutral and cold of faces read', /warm · \d+ neutral · \d+ cold of \d+/.test(rowC ?? ''), rowC)
  await clickText('[data-testid=moment-row]', 'First reaction: Concept C')
  const mp = await text('[data-testid=moment-panel]')
  ok('the concept panel says how many faces were read and how many were audio-only', /faces read\./.test(mp ?? '') && /audio-only/.test(mp ?? ''), mp?.slice(0, 300))
  await b.shot('emo-a2-moment-c')
  await click('[data-testid=compare-pets]')
  ok('comparing owners shows dog and cat rows', /Dog owners/.test((await text('[data-testid=moment-row]')) ?? '') || (await b.evaluate(`document.body.innerText.includes('Cat owners')`)))
  await click('[data-testid=lens-voice]')
  ok('the voice channel reads flat or tense per moment', /flat or tense/.test((await text('[data-testid=moment-row]')) ?? ''))
  await click('[data-testid=lens-hesitation]')
  ok('the hesitation channel still counts marked, some and steady', /marked · \d+ some · \d+ steady/.test((await text('[data-testid=moment-row]')) ?? ''))

  // ── Tensions: the new kind, faces on clips, the right numbers ──
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  await clickText('[data-testid=tf-All]', 'All'); await b.sleep(300)
  const cards = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].map(c=>c.innerText.replace(/\\s+/g,' '))`)
  const face = cards.find((c) => /Said vs emotion/.test(c))
  ok('there is a Said vs emotion tension about pause and portions', !!face && /portion-matched boxes/.test(face), cards.map((c) => c.slice(0, 50)).join(' | '))
  const sides = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText)).querySelector('[data-testid=tension-sides]').innerText.replace(/\\s+/g,' ')`)
  ok('its sides are in n of N, and name who had no face', /\d+ of 6/.test(sides) && /of 2|of 4|of 3|of 5/.test(sides) && /audio-only/.test(sides), sides)
  ok('its clips show the face at Concept A and at Concept C', await b.evaluate(`(()=>{const c=[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText));const f=c.querySelector('[data-testid=clip-faces]');return !!f&&/Concept A/.test(f.innerText)&&/Concept C/.test(f.innerText)})()`))
  await b.shot('emo-a2-tensions')

  // ── A tension theme counts the tension's own finding ──
  await clickText('[data-testid=tension-card] button', 'Turn into a theme')
  await b.evaluate(`document.querySelector('[data-testid=turn-theme]')?.click(); true`); await b.sleep(400)
  const opened = await b.evaluate(`!!document.querySelector('[data-testid=turn-confirm]')`)
  ok('Turn into a theme opens the dialog', opened)
  if (opened) {
    await click('[data-testid=turn-confirm]')
    await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
    const th = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-card]')].filter(c=>c.dataset.fromTension==='true').map(c=>c.innerText.replace(/\\s+/g,' '))`)
    ok('the theme made from the tension shows its own count, not everyone who said the code', th.length >= 1 && th.every((t) => /of \d+ people/.test(t) && !/of 20 people/.test(t)), th.join(' | '))
    await b.shot('emo-themes-tension')
  }

  // ── The way on ──
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  const foot = await text('main')
  ok('the stepper names the step', /Emotion & behaviour/.test(foot ?? ''))
  ok('invariants hold', !(await b.evaluate('window.__invariants'))?.length)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('EMOTION FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('EMOTION OK')
