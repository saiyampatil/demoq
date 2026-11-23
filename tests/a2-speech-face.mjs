// A2: the speech-only rule, as code (the person-level rule, the breakdown, the hesitant-delivery observation, the five rule lines), and the
// move of an older theme-level report tick to its codes. The page is checked in a2-themes-tab.mjs.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-speech-face.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
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
const LINES = [
  'We look at people who spoke in favour or against it and compare how they sounded with what they said. Faces play no part.',
  'No match if they spoke in favour and sounded tense or flat, or spoke against it and sounded animated.',
  'More than half matched: Consistent. More than half had no match: Gap. Otherwise Mixed. Under 3 people: Too few to read.',
  'Hesitating a lot, with nothing else off, shows as Hesitant and never counts toward Gap.',
  'Each person counts once. With several codes in a theme, their positions are counted together.',
]
const ruleOf = (against, unc, nn, min) => (nn < min ? 'Too few to read' : against / nn > 0.5 ? 'Conflicting' : (nn - against - unc) / nn > 0.5 ? 'Consistent' : 'Mixed')
try {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(600)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-suggestion]')].forEach(s=>s.querySelector('[data-testid=accept-theme]').click()); true`); await b.sleep(700)

  // ── The rule, as code ──
  const u = await withMod(`(async () => {
    const em = await window.__mod('/src/state/emotion')
    const sg = await window.__mod('/src/state/signals')
    const cfg = await window.__mod('/src/config/delivery')
    const doc = { faceFixes: {} }
    const mk = (id, o = {}) => ({ key: 'k' + id, participantId: 'P-' + id, sessionId: 'S' + id, pet: 'Dog', atSec: 1, facts: { delaySec: 1, pauseSec: 0, fillers: 0 }, usual: 1, band: o.band ?? 'Steady', reason: 'r', voice: { tone: o.tone ?? 'Even', pace: 1, usualPace: 1, pitch: 1, usualPitch: 1, loudness: 0, reason: 'v' }, stance: o.stance === undefined ? 'Positive' : o.stance, face: o.face === null ? undefined : { emotion: o.face?.[0] ?? 'Neutral', intensity: 'Medium', confidence: o.face?.[1] ?? 0.8, cue: 'c', onsetSec: 1 } })
    const fit = (o) => { const p = mk(1, o); return em.fitOf(p, em.faceOf(p, doc)) }
    const team = (nn, f) => Array.from({ length: nn }, (_, i) => mk(i + 1, f(i)))
    const out = {}
    for (const t of ['Tense', 'Flat', 'Animated', 'Even']) { out['pos' + t] = fit({ tone: t, face: null }).fit; out['neg' + t] = fit({ tone: t, face: null, stance: 'Negative' }).fit }
    for (const f of ['Doubt', 'Frustration', 'Confusion', 'Interest', 'Delight', 'Surprise', 'Neutral']) { out['posF' + f] = fit({ face: [f, 0.8] }).fit; out['negF' + f] = fit({ face: [f, 0.8], stance: 'Negative' }).fit }
    out.faceLow = fit({ face: ['Doubt', 0.5] }).fit
    out.hes = fit({ band: 'Marked hesitation', face: null })
    out.some = fit({ band: 'Some hesitation', face: null }).fit
    out.both = fit({ tone: 'Tense', face: ['Doubt', 0.9] })
    out.audioOnly = fit({ tone: 'Tense', face: null }).fit
    out.audioHes = fit({ band: 'Marked hesitation', face: null }).fit
    out.fact = fit({ stance: 'Neutral', tone: 'Tense' })
    const hesAll = sg.rollupPoints(team(10, () => ({ band: 'Marked hesitation', face: ['Interest', 0.8] })), doc)
    out.hesAll = { verdict: hesAll.verdict, against: hesAll.fit.against, uncertain: hesAll.fit.uncertain }
    const mixed = sg.rollupPoints(team(10, (i) => (i < 5 ? { tone: 'Tense' } : {})), doc)
    out.mixed = mixed.verdict
    const bd = sg.breakdownOf([...team(4, (i) => (i === 0 ? { tone: 'Tense', face: ['Doubt', 0.9] } : i === 1 ? { band: 'Marked hesitation' } : i === 2 ? { face: null, tone: 'Flat' } : {})), mk(5, { stance: 'Neutral' }), mk(6, { stance: 'Negative', tone: 'Tense', face: null })], doc)
    out.bd = { people: bd.people, positive: bd.positive, negative: bd.negative, against: bd.against, uncertain: bd.uncertain, matched: bd.matched, fact: bd.factOnly.map((p) => p.participantId), audioOnly: bd.audioOnly }
    out.line = sg.breakdownLine(bd)
    const hes = (stance, k) => sg.hesitantDelivery(team(6, (i) => ({ stance, band: i < k ? 'Marked hesitation' : 'Steady', face: null })), doc)
    out.hesitantPos = hes('Positive', 4); out.hesitantNeg = hes('Negative', 4); out.hesitantFew = hes('Positive', 2)
    out.lines = cfg.DELIVERY_RULE_LINES
    {
      const cb = await window.__mod('/src/state/codebook'); const ms = await window.__mod('/src/mock/signals'); const sess = await window.__mod('/src/mock/sessions')
      const d = Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /codebook/.test(k)))))[0]
      const sid = (p) => sess.sessionIdOf(sess.PET_SEED_SESSIONS.find((x) => x.participant === p && x.variant === 'done'))
      const basis = cb.basisOf(ms.ACCEPTED_PARTICIPANTS.map((p) => ({ id: sid(p), participantId: p })))
      out.hesitantNames = sg.codeSignals(d, basis).filter((s) => s.readable && sg.hesitantDelivery(s.points, d)).map((s) => s.code.name)
    }
    return out
  })()`)
  ok('hesitation alone never pulls against the words: marked hesitation with normal tone and no face is Uncertain', u.hes.fit === 'Uncertain' && u.hes.against.length === 0 && u.some === 'Matches', JSON.stringify(u.hes))
  ok('ten people who all hesitated, with calm voices and a pleased face, are Uncertain, none against: never Conflicting', u.hesAll.against === 0 && u.hesAll.uncertain === 10 && u.hesAll.verdict === 'Mixed', u.hesAll)
  ok('against a positive claim, tense and flat pull against; animated and even match', u.posTense === 'Pulls against' && u.posFlat === 'Pulls against' && u.posAnimated === 'Matches' && u.posEven === 'Matches', [u.posTense, u.posFlat, u.posAnimated, u.posEven])
  ok('against a complaint, tense matches and animated pulls against', u.negTense === 'Matches' && u.negAnimated === 'Pulls against' && u.negFlat === 'Matches' && u.negEven === 'Matches', [u.negTense, u.negAnimated, u.negFlat, u.negEven])
  // Decision: faces never feed a verdict. These two used to assert that doubt, frustration, confusion (against a positive claim) and
  // delight, interest (against a complaint) pulled against. They now assert the opposite: no face, at high confidence, moves a fit.
  ok('no face reading pulls against a positive claim: doubt, frustration and confusion match like every other face when the voice is even', ['Doubt', 'Frustration', 'Confusion', 'Interest', 'Delight', 'Surprise', 'Neutral'].every((f) => u['posF' + f] === 'Matches'))
  ok('no face reading pulls against a complaint: delight and interest match too when the voice is even', ['Delight', 'Interest', 'Doubt', 'Frustration', 'Confusion', 'Surprise', 'Neutral'].every((f) => u['negF' + f] === 'Matches'))
  ok('a face below medium confidence never pulls against', u.faceLow === 'Matches')
  ok('a tense voice with a doubtful face is one No match, and only Speech is named as the reason', u.both.fit === 'Pulls against' && u.both.against.length === 1 && u.both.against[0] === 'Speech', u.both)
  ok('audio-only people are read on speech (a tense voice counts), never on hesitation alone, and never as neutral', u.audioOnly === 'Pulls against' && u.audioHes === 'Uncertain')
  ok('someone who only stated a fact is not checked', u.fact.fit === undefined && u.fact.against.length === 0)
  ok('five against and five matching is Mixed: most is more than half', u.mixed === 'Mixed')
  ok('the breakdown counts each person once (a tense complaint matches), with the fact-only count right (audio-only is no longer counted apart: everyone is read on speech)', u.bd.people === 6 && u.bd.positive === 4 && u.bd.negative === 1 && u.bd.against === 2 && u.bd.uncertain === 1 && u.bd.matched === 2 && u.bd.fact.join() === 'P-5', u.bd)
  ok('the table line reads “4 spoke in favour and 1 spoke against it. Matched 2, no match 2, hesitant 1.”', u.line === '4 spoke in favour and 1 spoke against it. Matched 2, no match 2, hesitant 1.', u.line)
  ok('the hesitant-delivery observation needs a positive claim and at least half hesitating', u.hesitantPos?.hesitated === 4 && u.hesitantPos.speakers === 6 && u.hesitantNeg === null && u.hesitantFew === null, [u.hesitantPos, u.hesitantNeg, u.hesitantFew])
  ok('the rule lines in config are the five lines, word for word', JSON.stringify(u.lines) === JSON.stringify(LINES), u.lines)

  // The page checks that used to sit here (columns Code, Said by, Face, Speech and Words vs delivery; the colour legend; the Face and Speech cells; the
  // report switch on each theme and code; the hesitant-delivery line) tested parts of the Signals table that the Themes tab removed. The Themes
  // tab is checked in a2-themes-tab.mjs. The rule itself is still checked above, as code.
  // ── An older theme-level tick becomes code ticks, once ──
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const flex=d.codes.find(c=>c.name==='Flexibility matters more than price');const price=d.themes.find(t=>t.name==='Price creep');price.codeIds=price.codeIds.filter(x=>x!==flex.id);localStorage[k]=JSON.stringify(o);return true})()`)
  const ids = await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const th=(n)=>d.themes.find(t=>t.name===n);const ctl=th('Wanting control over deliveries'), joined=th('Why they joined'), price=th('Price creep');return {ctl:ctl.codeIds,joined:joined.codeIds,price:price.codeIds,pickedNow:d.signalPicks}})()`)
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const th=(n)=>d.themes.find(t=>t.name===n);d.signalPicks={};d.themePicks={[th('Why they joined').id]:true,[th('Wanting control over deliveries').id]:false};localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/signals`); await b.sleep(1000)
  const mig = await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const d=Object.values(JSON.parse(localStorage[k]))[0];return {picks:d.signalPicks,log:d.log.filter(l=>l.action==='Signals tick moved to its codes').length,themePicks:d.themePicks}})()`)
  const accepted = (await withMod(`(async()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const d=Object.values(JSON.parse(localStorage[k]))[0];const acc=(ids)=>ids.filter(i=>d.codes.find(c=>c.id===i)?.status==='Accepted');return {joined:acc(${JSON.stringify(ids.joined)}),ctl:acc(${JSON.stringify(ids.ctl)}),price:acc(${JSON.stringify(ids.price)})}})()`))
  ok('a theme ticked on carries its tick to each of its accepted codes, saved', accepted.joined.length >= 2 && accepted.joined.every((c) => mig.picks[c] === true), mig)
  ok('a theme ticked off carries that too, so nothing switches on by itself', accepted.ctl.length >= 2 && accepted.ctl.every((c) => mig.picks[c] === false), mig)
  ok('a theme with no tick adds nothing: its codes keep the code rule', accepted.price.every((c) => mig.picks[c] === undefined))
  ok('the old theme-level ticks stay stored, unread, and the move is logged once per theme', mig.themePicks && Object.keys(mig.themePicks).length === 2 && mig.log === 2, mig)
  await b.goto(`${root}/signals`); await b.sleep(700)
  const mig2 = await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const d=Object.values(JSON.parse(localStorage[k]))[0];return d.log.filter(l=>l.action==='Signals tick moved to its codes').length})()`)
  ok('reloading does not move them again, and a code switched off by hand stays off', mig2 === 2)

  // ── The report groups ticked codes under their theme ──
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const c=d.codes.find(c=>c.name==='Flexibility matters more than price');d.signalPicks={...d.signalPicks,[c.id]:true};localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(700)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=finding-more]')].forEach(x=>x.getAttribute('aria-expanded')==='false'&&x.click()); true`); await b.sleep(300)
  const rep = await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-group]')].map(g=>({group:g.dataset.group,items:[...g.querySelectorAll('li[data-kind]')].map(li=>({kind:li.dataset.kind,name:li.querySelector('p').innerText}))}))`)
  ok('A3 findings group ticked codes under their theme, as codes, never as a theme profile', rep.length >= 1 && rep.every((g) => g.items.length && g.items.every((i) => i.kind === 'code')) && rep.some((g) => g.group === 'Why they joined') && (await b.evaluate(`document.querySelectorAll('[data-testid=signals] li[data-kind=theme]').length`)) === 0, rep)
  ok('a code ticked on its own sits under its theme (Flexibility… under Wanting control over deliveries)', rep.some((g) => g.group === 'Wanting control over deliveries' && g.items.some((i) => /Flexibility matters more than price/.test(i.name))), rep)
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
