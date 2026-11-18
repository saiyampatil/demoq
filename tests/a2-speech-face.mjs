// A2 Signals: two groups, Speech and Face. Hesitation is folded into Speech; the verdict rule is the one in src/config/delivery.ts.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-speech-face.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail ? `${label} (${detail})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.innerText.replace(/\\s+/g,' '))`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
try {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals?view=code`)
  await b.waitFor('What stands out')
  await b.sleep(600)

  // ── The rule, as code ──
  const u = await withMod(`(async () => {
    const em = await window.__mod('/src/state/emotion')
    const cfg = await window.__mod('/src/config/delivery')
    const doc = { faceFixes: {} }
    const mk = (o = {}) => ({ key: 'k' + Math.random(), participantId: 'P-1', sessionId: 'S', pet: 'Dog', atSec: 1, facts: { delaySec: 1, pauseSec: 0, fillers: 0 }, usual: 1, band: o.band ?? 'Steady', reason: 'r', voice: { tone: o.tone ?? 'Even', pace: 1, usualPace: 1, pitch: 1, usualPitch: 1, loudness: 0, reason: 'v' }, stance: o.stance ?? 'Positive', face: o.face === null ? undefined : { emotion: o.face?.[0] ?? 'Interest', intensity: 'Medium', confidence: o.face?.[1] ?? 0.8, cue: 'c', onsetSec: 1 } })
    const fit = (o) => { const p = mk(o); return em.fitOf(p, em.faceOf(p, doc)) }
    return {
      hes: fit({ band: 'Marked hesitation' }), some: fit({ band: 'Some hesitation', tone: 'Even' }),
      tense: fit({ tone: 'Tense' }), tenseNeg: fit({ tone: 'Tense', stance: 'Negative', face: null }),
      flatPos: fit({ tone: 'Flat' }), flatNeg: fit({ tone: 'Flat', stance: 'Negative', face: null }),
      doubtMed: fit({ face: ['Doubt', 0.7] }), doubtLow: fit({ face: ['Doubt', 0.5] }),
      both: fit({ tone: 'Tense', face: ['Doubt', 0.9] }), audioOnly: fit({ face: null, tone: 'Tense' }), audioOnlyQuiet: fit({ face: null }),
      uncertainTone: fit({ band: 'Marked hesitation', tone: 'Animated' }),
      rule: em.FIT_RULE_TEXT, cfg: cfg.DELIVERY_RULE, min: cfg.DELIVERY.minPeople,
      neutralAudio: em.emotionSplit([mk({ face: null })], doc),
    }
  })()`)
  ok('hesitation alone never pulls against the words: Marked hesitation with a normal tone is Uncertain', u.hes.fit === 'Uncertain' && u.hes.against.length === 0, JSON.stringify(u.hes))
  ok('some hesitation is ignored: it matches', u.some.fit === 'Matches')
  ok('a tense voice pulls against; flat pulls against a positive claim only (hesitation not used)', u.tense.fit === 'Pulls against' && u.flatPos.fit === 'Pulls against' && u.flatNeg.fit === 'Matches' && u.tenseNeg.fit === 'Pulls against')
  ok('a face pulls against only at medium confidence or higher', u.doubtMed.fit === 'Pulls against' && u.doubtLow.fit === 'Matches', `${u.doubtMed.fit} / ${u.doubtLow.fit}`)
  ok('Speech and Face at the same moment count once', u.both.fit === 'Pulls against' && u.both.against.length === 2)
  ok('audio-only is read for Speech and never counted as neutral', u.audioOnly.fit === 'Pulls against' && u.audioOnlyQuiet.fit === 'Matches' && u.neutralAudio.noVideo === 1 && u.neutralAudio.counts.Neutral === 0 && u.neutralAudio.valence.Neutral === 0)
  ok('an uncertain person is neither against nor matching', u.uncertainTone.fit === 'Uncertain')
  ok('the rule text is built from config: over half, speech, face, once, uncertain, and the minimum', Object.values(u.cfg).every((t) => u.rule.includes(t)) && u.rule.includes(`Under ${u.min} people`) && /more than half/.test(u.rule))

  // ── The screen: two groups, no separate hesitation column ──
  const lenses = await b.evaluate(`[...document.querySelectorAll('[role=group][aria-label=Channel] button')].map(x=>x.innerText.trim())`)
  ok('the channel switch has exactly two groups: Face and Speech', JSON.stringify(lenses) === JSON.stringify(['Face', 'Speech']), JSON.stringify(lenses))
  ok('no Voice or Hesitation switch remains', (await b.evaluate(`document.querySelectorAll('[data-testid=lens-voice],[data-testid=lens-hesitation]').length`)) === 0)
  await click('[data-testid=lens-speech]')
  const head = await text('[data-testid=fit-rule]')
  ok('one Speech column, with tone and certainty in one cell', (await b.evaluate(`document.querySelectorAll('[data-testid=speech-bars]').length`)) > 5 && /flat or tense · \d+ hesitated of \d+/.test((await all('[data-testid=signal-row]'))[0] ?? ''), (await all('[data-testid=signal-row]'))[0])
  ok('the column header says Speech, not Hesitation or Voice', await b.evaluate(`(()=>{const t=document.querySelector('[data-testid=fit-rule]').parentElement.innerText;return /Speech/.test(t) && !/\\bHesitation\\b|\\bVoice\\b/.test(t.split('How it')[0])})()`))
  ok('the rule under the table says how it is decided, in the config’s words', /^How it’s decided\./.test(head ?? '') && Object.values(u.cfg).every((t) => (head ?? '').includes(t)))
  const standouts = await all('[data-testid=standout]')
  ok('What stands out says Speech, and the moment tie is labelled Speech · certainty', standouts.some((s) => /^Speech /.test(s)) && standouts.some((s) => /Speech · certainty .*tie for the most hesitation/.test(s)) && !standouts.some((s) => /^Hesitation/.test(s)), standouts.join(' | '))
  await b.evaluate(`document.querySelector('[data-testid=signal-row]').click(); true`); await b.sleep(250)
  const panel = await text('[data-testid=signal-panel]')
  ok('the panel has one Speech row (tone and certainty) and a Face row, with no Voice or Hesitation rows', /Speech Tone: .* Certainty: marked hesitation in \d+ of \d+/.test(panel ?? '') && /Face/.test(panel ?? '') && !/ Voice | Hesitation Marked/.test(panel ?? ''), panel?.slice(0, 400))
  const cell = await b.evaluate(`document.querySelector('[data-testid=speech-cell]')?.innerText`)
  ok('a person’s Speech cell reads like “Flat · hesitated”', /^(Even|Animated|Flat|Tense) · (hesitated|some hesitation|steady)$/.test(cell ?? ''), cell)
  await click('[data-testid=view-moment]')
  await click('[data-testid=lens-speech]')
  ok('By moment keeps its certainty view inside Speech', /marked · \d+ some · \d+ steady/.test((await text('[data-testid=moment-row]')) ?? ''))
  await b.goto(`${root}/signals`)
  await b.waitFor('What stands out'); await b.sleep(500)
  ok('By theme says speech or face, never “face, voice or hesitation”', !/face, voice or hesitation|voice and hesitation/i.test((await text('body')) ?? ''))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
}
await b.close()
console.log(`${n} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 SPEECH AND FACE FAILED:\n - ' + failures.join('\n - '))
  process.exit(1)
}
console.log('A2 SPEECH AND FACE OK')
