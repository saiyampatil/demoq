// A2 By theme: the theme as the main unit, with its signals rolled up from the per-code rules.
//   the roll-up (a consistent, a mixed and a conflicting theme, built from known people), audio-only people never counted as neutral,
//   excluded sessions never shown, the rule on screen, headlines, the Report tick and A3, and the tension-theme wording and Restore.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-themes.mjs
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
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.innerText.replace(/\\s+/g,' '))`)
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
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
// Modules are imported by the exact URL the app loaded (the dev server adds ?t= after an edit), so they are the app's own instances.
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const fresh = async () => {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals`)
  await b.waitFor('What stands out')
  await b.sleep(500)
  // The seed has one approved tension (for the audio summary). These checks start with none, so it is put back to review first.
  await b.evaluate(`window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts'); (async()=>{const cb=await window.__mod('/src/state/codebook'); cb.updateCodebook('pet-food-churn', d=>cb.restoreTension(d,{id:'tn-pause-concept',title:'t'},{by:'test'})); return true})()`); await b.sleep(600)
}
const acceptAllThemes = async () => {
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-suggestion]')].forEach(s=>s.querySelector('[data-testid=accept-theme]').click()); true`)
  await b.sleep(600)
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(500)
}

try {
  await fresh()

  // ── The roll-up: a consistent, a mixed and a conflicting theme, from people whose readings are known ──
  const unit = await withMod(`(async () => {
    const sg = await window.__mod('/src/state/signals')
    const em = await window.__mod('/src/state/emotion')
    const doc = { faceFixes: {} }
    const mk = (id, o = {}) => ({ key: 't:' + id, participantId: id, sessionId: id + '-1', pet: 'Dog', atSec: 100, facts: { delaySec: 1, pauseSec: 0, fillers: 0 }, usual: 1, band: o.band ?? 'Steady', reason: 'r', voice: { tone: o.tone ?? 'Even', pace: 100, usualPace: 100, pitch: 4, usualPitch: 4, loudness: 0, reason: 'v' }, stance: o.stance ?? 'Positive', face: o.face === null ? undefined : { emotion: o.face?.[0] ?? 'Interest', intensity: o.face?.[1] ?? 'Medium', confidence: 0.8, cue: 'leaned in', onsetSec: 1 } })
    const team = (n, f) => Array.from({ length: n }, (_, i) => mk('P-' + (i + 1), f(i)))
    // Consistent: six people speak for it and look and sound steady.
    const consistent = sg.rollupPoints(team(6, () => ({})), doc)
    // Mixed: ten people, five with a tense voice (pulls against) and five who match: neither is more than half.
    const mixed = sg.rollupPoints(team(10, (i) => (i < 5 ? { tone: 'Tense' } : {})), doc)
    // Conflicting: six of ten pulled against is more than half.
    const conflicting = sg.rollupPoints(team(10, (i) => (i < 6 ? { tone: 'Tense' } : {})), doc)
    // Hesitation alone never pulls against the words: ten people, all marked hesitation, normal tone, interested face.
    const hesAlone = sg.rollupPoints(team(10, () => ({ band: 'Marked hesitation' })), doc)
    // Marked hesitation with a normal tone is Uncertain, and is not counted toward Conflicting: 6 uncertain + 4 against is not Conflicting.
    const uncertain = sg.rollupPoints(team(10, (i) => (i < 4 ? { tone: 'Tense' } : { band: 'Marked hesitation' })), doc)
    // Speech and Face at the same moment count once: a tense voice and a doubtful face on the same person.
    const once = sg.rollupPoints(team(4, () => ({ tone: 'Tense', face: ['Doubt', 'High'] })), doc)
    const few = sg.rollupPoints(team(2, () => ({ band: 'Marked hesitation', tone: 'Tense' })), doc)
    // Someone who complains, and smiles while doing it, is the one thing that pulls against a complaint.
    const complaint = sg.rollupPoints(team(5, (i) => ({ stance: 'Negative', face: i < 3 ? ['Delight', 'High'] : ['Frustration', 'Medium'] })), doc)
    // Audio-only: no face at all, but speech is still read. Two of five.
    const audio = sg.rollupPoints(team(5, (i) => ({ face: i < 2 ? null : ['Interest', 'Medium'], tone: i < 2 ? 'Tense' : 'Even' })), doc)
    const pick = (r) => ({ verdict: r.verdict, people: r.people, fits: r.fit.fits, uncertain: r.fit.uncertain, against: r.fit.against, n: r.fit.n, headline: sg.headlineOf(r) })
    return { rule: em.FIT_RULE, consistent: pick(consistent), mixed: pick(mixed), conflicting: pick(conflicting), hesAlone: pick(hesAlone), uncertain: pick(uncertain), once: pick(once), few: pick(few), complaint: pick(complaint), audio: { read: audio.emotions.read, noVideo: audio.emotions.noVideo, neutral: audio.emotions.counts.Neutral, against: audio.fit.against, validNeutral: audio.emotions.valence.Neutral, unclear: audio.emotions.unclear, people: audio.people, headline: sg.headlineOf(audio), verdict: audio.verdict } }
  })()`)
  ok('a consistent theme: delivery fit the words for everyone', unit.consistent.verdict === 'Consistent' && unit.consistent.fits === 6 && unit.consistent.n === 6, JSON.stringify(unit.consistent))
  ok('its headline says delivery matched, in n of N', /^Delivery matched the words for 6 of 6 people\.$/.test(unit.consistent.headline), unit.consistent.headline)
  ok('a mixed theme: 5 of 10 against and 5 matching is Mixed, since neither is over half', unit.mixed.verdict === 'Mixed' && unit.mixed.against === 5 && unit.mixed.fits === 5 && unit.mixed.n === 10, JSON.stringify(unit.mixed))
  ok('a conflicting theme: 6 of 10 against is over half', unit.conflicting.verdict === 'Conflicting' && unit.conflicting.against === 6 && unit.conflicting.n === 10, JSON.stringify(unit.conflicting))
  ok('the headline names the gap in plain words with counts', /^6 of 10 people argued for it, but sounded flat or tense\.$/.test(unit.conflicting.headline), unit.conflicting.headline)
  ok('hesitation alone never produces Conflicting: ten people with marked hesitation and a normal tone are all Uncertain, none against', unit.hesAlone.against === 0 && unit.hesAlone.uncertain === 10 && unit.hesAlone.verdict === 'Mixed', JSON.stringify(unit.hesAlone))
  ok('Marked hesitation with a normal tone is Uncertain and is not counted toward Conflicting (4 against, 6 uncertain: not Conflicting)', unit.uncertain.uncertain === 6 && unit.uncertain.against === 4 && unit.uncertain.verdict !== 'Conflicting' && unit.uncertain.n === 10, JSON.stringify(unit.uncertain))
  ok('Speech and Face at the same moment count once: a tense voice and a doubtful face is one person against, not two', unit.once.against === 4 && unit.once.n === 4, JSON.stringify(unit.once))
  ok('the rule is the repo’s own: over half, 3 people', unit.rule.majority === 0.5 && unit.rule.min === 3, JSON.stringify(unit.rule))
  ok('under 3 people is too few to read, said in people', unit.few.verdict === 'Too few to read' && /^Only 2 people said this, too few to read a pattern\.$/.test(unit.few.headline), `${unit.few.verdict}: ${unit.few.headline}`)
  ok('a complaint said with a smile is what pulls against a complaint', unit.complaint.n === 5 && unit.complaint.against === 3 && /^3 of 5 people complained about it, but had faces that read as delight or interest/.test(unit.complaint.headline), `${JSON.stringify(unit.complaint)}`)
  ok('audio-only people are never counted as neutral, and their speech is still read (a tense voice counts against)', unit.audio.against === 2 && unit.audio.noVideo === 2 && unit.audio.read === 3 && unit.audio.neutral === 0 && unit.audio.validNeutral === 0 && unit.audio.unclear === 0, JSON.stringify(unit.audio))

  // ── By theme is the default view, and the channel switch is gone ──
  await acceptAllThemes()
  ok('By theme is first in the switch and the default', await b.evaluate(`(()=>{const bs=[...document.querySelectorAll('[role=group][aria-label="Read signals by"] button')];return bs[0].innerText==='By theme'&&bs[0].getAttribute('aria-pressed')==='true'})()`))
  ok('the Face | Speech switch is hidden', (await b.evaluate(`document.querySelectorAll('[data-testid=lens-emotion],[data-testid=lens-speech]').length`)) === 0)
  const rows = await all('[data-testid=theme-signal-row]')
  ok('every accepted theme is a row', ['Price creep', 'The pet decides', 'Wanting control over deliveries', 'Why they joined'].every((n) => rows.some((r) => r.startsWith(n))), rows.map((r) => r.slice(0, 30)).join(' | '))
  ok('each row is light: the name, said by n of N, a verdict and one sentence (the detail is in the panel)', rows.every((r) => /Said by \d+ of \d+/.test(r) && /(Consistent|Mixed|Conflicting|Too few to read|No claim)/.test(r) && !/Words |Face |Voice \d|Hesitation \d/.test(r) && r.length < 230), rows.map((r) => r.length).join(','))
  ok('no percentages and no vague counts', rows.every((r) => !/%/.test(r) && !/a number of|a few of|some of/i.test(r)))
  ok('every theme has a headline', (await all('[data-testid=theme-headline]')).length === rows.length && (await all('[data-testid=theme-headline]')).every((h) => h.length > 30))
  ok('there is no rule box or rule paragraph; the rule is behind “How it’s decided”', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-rule-box],[data-testid=theme-rule]').length`)) === 0 && (await b.evaluate(`!!document.querySelector('[data-testid=how-decided]')`)))
  await click('[data-testid=how-decided]')
  ok('and opened it states the rule in five lines', (await all('[data-testid=how-decided-line]')).length === 5 && /Most didn’t fit: Conflicting/.test((await text('[data-testid=how-decided-pop]')) ?? '') && /Each person counts once/.test((await text('[data-testid=how-decided-pop]')) ?? ''))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(200)

  // Each row: the verdict is the rule applied to its panel's numbers; the lines add up.
  const rl = unit.rule
  const bad = []
  const names = rows.map((r) => r.split(' Said by')[0])
  const panels = {}
  for (const name of names) {
    await clickText('[data-testid=theme-signal-row]', name); await b.sleep(150)
    const chip = (await b.evaluate(`document.querySelector('[data-testid=theme-panel] header span')?.innerText.trim()`)) ?? ''
    const fg = await b.evaluate(`(()=>{const g=(k)=>{const e=document.querySelector('[data-testid=theme-panel] [data-testid=fig-'+k+']');return e?+e.dataset.n:null};return {a:g('against'),u:g('uncertain'),m:g('matched')}})()`)
    const v = JSON.stringify(fg)
    const tr = (await text('[data-testid=theme-trace]')) ?? ''
    const hm = ((await text('[data-testid=theme-panel]')) ?? '').match(/marked hesitation in (\d+) of (\d+)/)
    panels[name] = { chip, v, tr, headline: await text('[data-testid=theme-headline-text]'), hes: hm ? +hm[1] / +hm[2] : 0 }
    if (fg.a !== null) {
      const n = fg.a + fg.u + fg.m
      const against = fg.a
      const unc = fg.u
      const want = n < rl.min ? 'Too few to read' : against / n > rl.majority ? 'Conflicting' : (n - against - unc) / n > rl.majority ? 'Consistent' : 'Mixed'
      if (chip !== want) bad.push(`${name}: ${chip} should be ${want}`)
    }
    const f = tr.match(/faces read for (\d+) of (\d+)(?: \(([^)]*)\))?/i)
    const people = Number(tr.match(/^(\d+) of (\d+) said it/)?.[1])
    const left = f?.[3] ? [...f[3].matchAll(/(\d+) /g)].reduce((a, x) => a + +x[1], 0) : 0
    if (!f || +f[2] !== people || +f[1] + left !== +f[2]) bad.push(`${name}: faces do not add up: ${tr}`)
  }
  ok('every theme’s verdict follows the one rule, and its faces add up to its people (the left-out are named)', bad.length === 0, bad.join(' | '))
  ok('the control theme is Conflicting and its headline names the gap', panels['Wanting control over deliveries'].chip === 'Conflicting' && /\d+ of \d+ people argued for it, but /.test(panels['Wanting control over deliveries'].headline ?? ''), JSON.stringify(panels['Wanting control over deliveries']))
  ok('a theme with no gap says delivery matched the words', /^Delivery matched the words for \d+ of \d+ people/.test(panels['Why they joined'].headline ?? ''), panels['Why they joined'].headline)
  const trace = panels['Wanting control over deliveries'].tr
  ok('a theme with audio-only people says so, so the numbers add up', /\d+ audio-only/.test(trace) && /spoke for or against it/.test(trace), trace)

  // ── The panel: evidence, codes, the quotes at their timestamps, the related tension, Play ──
  await clickText('[data-testid=theme-signal-row]', 'Wanting control over deliveries'); await b.sleep(250)
  const panel = await text('[data-testid=theme-panel]')
  ok('the panel has the AI-generated tag, the headline and a Play link at a time', !!(await b.evaluate(`document.querySelector('[data-testid=theme-headline-block]')?.innerText.includes('AI-generated')`)) && (await b.evaluate(`!!document.querySelector('[data-testid=theme-play]')`)) && /Play the clearest moment · P-\d+ at \d+:\d\d/.test(panel ?? ''), panel?.slice(0, 400))
  ok('the panel shows words, face and speech (tone and certainty) evidence', ['Words', 'Face', 'Speech', 'Certainty'].every((w) => new RegExp(`\\b${w}\\b`).test(panel ?? '')) && /positive · \d+ neutral · \d+ negative/.test(panel ?? ''))
  ok('and its codes, each with its own verdict', (await all('[data-testid=theme-panel-codes] li')).length >= 3 && (await all('[data-testid=theme-panel-codes] li')).every((l) => /(Consistent|Mixed|Conflicting|Too few to read|No claim)/.test(l)))
  const points = await all('[data-testid=theme-panel] [data-testid=signal-point]')
  ok('every moment shows what was seen, the quote’s time and the model’s reason', points.length >= 5 && points.every((p) => /Seen at \d+:\d\d|audio-only/.test(p) && /Play at \d+:\d\d/.test(p) && /Why these readings/.test(p)), points[0])
  ok('a Conflicting theme links to its related tension', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-tension]').length`)) >= 1)
  await click('[data-testid=theme-tension]')
  await b.waitFor('Supporting moments')
  ok('and the link opens that tension', /Tensions/.test((await text('[role=tab][aria-selected=true]')) ?? '') && (await b.evaluate(`!!document.querySelector('[data-testid=tension-card]')`)))
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)

  // ── Rows expand to their codes ──
  await click('[data-testid=theme-expand]')
  const codes = await all('[data-testid=theme-codes] li')
  ok('a row opens to its codes with their verdicts', codes.length >= 2 && codes.every((c) => /\d+ of \d+/.test(c) && /(Consistent|Mixed|Conflicting|Too few to read|No claim)/.test(c)), codes.join(' | '))

  // ── Excluded sessions never appear ──
  const seenPeople = new Set()
  for (const name of names) {
    await clickText('[data-testid=theme-signal-row]', name); await b.sleep(120)
    ;(await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=signal-point] .tabular-nums.font-medium')].map(e=>e.innerText.trim()).filter(t=>/^P-\\d+$/.test(t))`)).forEach((p) => seenPeople.add(p))
  }
  ok('no theme shows an excluded session (P-3112, P-3119) and every person shown is one of the 20 accepted', seenPeople.size > 10 && !seenPeople.has('P-3112') && !seenPeople.has('P-3119'), [...seenPeople].join(','))
  const excl = await withMod(`(async()=>{const sg=await window.__mod('/src/mock/signals');const ss=await window.__mod('/src/mock/sessions');const ex=ss.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant);const st=await window.__mod('/src/state/signals');const cb=await window.__mod('/src/state/codebook');const doc=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k))??'')||'null');return {ex,tot:sg.ACCEPTED_PARTICIPANTS.length}})()`)
  ok('the two excluded sessions are the ones tested', excl.ex.includes('P-3112') && excl.ex.includes('P-3119') && excl.tot === 20, JSON.stringify(excl))
  ok('every “of N” is out of the 20 accepted, never 22', (await all('[data-testid=theme-signal-row]')).every((r) => !/of 2[1-9]\b/.test(r)))

  // ── Audio-only people in the screen: not neutral ──
  await clickText('[data-testid=theme-signal-row]', 'Wanting control over deliveries'); await b.sleep(200)
  const noFace = await b.evaluate(`document.querySelectorAll('[data-testid=theme-panel] [data-testid=no-face]').length`)
  const faceText = await text('[data-testid=theme-face]')
  const vc = faceText?.match(/(\d+) positive · (\d+) neutral · (\d+) negative · (\d+) unclear of (\d+) read/)
  const readM = faceText?.match(/(\d+) of (\d+) people had a face read \((\d+) audio-only/)
  ok('audio-only people have no reading and are left out of the neutral count', noFace >= 1 && !!vc && !!readM && +vc[1] + +vc[2] + +vc[3] + +vc[4] === +vc[5] && +vc[5] === +readM[1] && noFace === +readM[3], `${noFace} no-face cards; ${faceText}`)

  // ── The Report tick: theme level, default on for the notable themes, saved, and A3 reads from it ──
  const ticks = await b.evaluate(`Object.fromEntries([...document.querySelectorAll('[data-testid=theme-signal-item]')].map(li=>[li.querySelector('[data-testid=theme-signal-row]').innerText.split(/\\s+Said by/)[0], li.querySelector('[data-testid=use-theme]')?.getAttribute('aria-checked') === 'true']))`)
  const notable = Object.fromEntries(names.map((n) => [n, /Mixed|Conflicting/.test(panels[n].chip) || panels[n].hes >= 0.25]))
  ok('the tick is on for the Conflicting theme and off for the ones with no gap', ticks['Wanting control over deliveries'] === true && ticks['Why they joined'] === false, JSON.stringify(ticks))
  ok('the tick agrees with the code-level default (hesitation shows, or words and delivery don’t fit)', names.every((n) => ticks[n] === notable[n]), JSON.stringify({ ticks, notable }))
  await b.goto(`${root}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(600)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=finding-more]')].forEach(x=>x.getAttribute('aria-expanded')==='false'&&x.click()); true`); await b.sleep(250)
  const sig = await b.evaluate(`[...document.querySelectorAll('[data-testid=signals] li[data-kind]')].map(li=>({kind:li.dataset.kind,text:li.innerText.replace(/\\s+/g,' ')}))`)
  const control = sig.find((s) => /Wanting control over deliveries/.test(s.text))
  ok('A3’s “How people sounded” shows the theme profile with its headline', !!control && control.kind === 'theme' && /\d+ of \d+ people argued for it, but /.test(control.text) && /off in the client version until cleared/.test(control.text), JSON.stringify(sig.map((s) => s.text.slice(0, 80))))
  ok('and does not show the Consistent themes', !sig.some((s) => /Why they joined|Price creep/.test(s.text)))
  // Untick it in A2: it leaves A3. Reload: the tick is still saved.
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-signal-item]')].find(li=>/Wanting control/.test(li.innerText)).querySelector('[data-testid=use-theme]').click(); true`); await b.sleep(400)
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(500)
  ok('an unticked theme stays unticked after a reload (only the tick is saved)', (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-signal-item]')].find(li=>/Wanting control/.test(li.innerText)).querySelector('[data-testid=use-theme]').getAttribute('aria-checked')`)) === 'false')
  const stored = await b.evaluate(`JSON.stringify(Object.entries(localStorage).filter(([k])=>/codebook/.test(k)).map(([k,v])=>v)).includes('themePicks')`)
  const profileStored = await b.evaluate(`/headline|Delivery matched|argued for it/.test(JSON.stringify(Object.entries(localStorage).filter(([k])=>/codebook|report/.test(k))))`)
  ok('the tick is stored and the profile is not', stored && !profileStored)
  await b.goto(`${root}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(600)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=finding-more]')].forEach(x=>x.getAttribute('aria-expanded')==='false'&&x.click()); true`); await b.sleep(250)
  ok('so it is gone from A3', !(await b.evaluate(`[...document.querySelectorAll('[data-testid=signals] li[data-kind=theme]')].some(li=>/Wanting control/.test(li.innerText))`)))
  // A code-level tick still works for older data.
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  // Code-level ticks have no control on the screen any more, but ones already stored (older data) still count.
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const c=o[id].codes.find(c=>c.name==='Flexibility matters more than price');o[id].signalPicks={...(o[id].signalPicks||{}),[c.id]:true};localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(600)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=finding-more]')].forEach(x=>x.getAttribute('aria-expanded')==='false'&&x.click()); true`); await b.sleep(250)
  ok('a code-level tick still reaches A3, marked as a code', await b.evaluate(`[...document.querySelectorAll('[data-testid=signals] li[data-kind=code]')].some(li=>/Flexibility matters more than price/.test(li.innerText))`))

  // ── Tension themes: the wording, the group below, Restore ──
  await fresh()
  await acceptAllThemes()
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  const btn = await b.evaluate(`document.querySelector('[data-testid=turn-theme]')?.innerText.trim()`)
  ok('the button says Add as a tension theme', btn === 'Add as a tension theme', btn)
  ok('nothing says “Turn into a theme” any more', !/Turn into a theme|Turned into a theme/.test((await text('main')) ?? ''))
  const tTitle = await b.evaluate(`document.querySelector('[data-testid=tension-card][data-status=Suggested] h3').innerText.trim()`)
  await click('[data-testid=turn-theme]')
  await click('[data-testid=turn-confirm]')
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(500)
  const tRows = await all('[data-testid=tension-theme-list] [data-testid=theme-signal-row]')
  ok('a tension theme sits in its own group below, tagged From a tension', tRows.length === 1 && /From a tension/.test(tRows[0]) && /Tension themes/.test((await text('main')) ?? ''), tRows.join(' | '))
  await clickText('[data-testid=tension-theme-list] [data-testid=theme-signal-row]', 'Pause'); await b.sleep(250)
  ok('and is read with the same profile as any theme', /Said by \d+ of \d+/.test(tRows[0]) && /flat or tense for \d+ of \d+/.test((await text('[data-testid=theme-panel]')) ?? '') && /marked hesitation in \d+ of \d+/.test((await text('[data-testid=theme-panel]')) ?? ''))
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(400)
  ok('the Themes tab calls it a tension theme', await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-card][data-from-tension=true]')].every(c=>/Tension theme/.test(c.innerText))&&document.querySelectorAll('[data-testid=theme-card][data-from-tension=true]').length===1`))
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  await clickText('[data-testid=tf-All]', 'All'); await b.sleep(300)
  const addedCard = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card][data-status="Added as a tension theme"]')].map(c=>c.innerText.replace(/\\s+/g,' '))`)
  ok('an added tension shows Tension theme … added by, and a Restore button', addedCard.length === 1 && /Tension theme “.+” added by/.test(addedCard[0]) && /Restore/.test(addedCard[0]), addedCard[0])
  await b.evaluate(`document.querySelector('[data-testid=tension-card][data-status="Added as a tension theme"] [data-testid=restore-tension]').click(); true`); await b.sleep(500)
  ok('Restore puts the tension back to review', (await b.evaluate(`document.querySelectorAll('[data-testid=tension-card][data-status="Added as a tension theme"]').length`)) === 0 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card][data-status=Suggested]')].some(c=>c.innerText.includes(${JSON.stringify(tTitle.slice(0, 30))}))`)))
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(500)
  ok('and the tension theme is gone from By theme', (await b.evaluate(`document.querySelectorAll('[data-testid=tension-theme-list] [data-testid=theme-signal-row]').length`)) === 0)
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  await clickText('[data-testid=tf-Dismissed]', 'Dismissed'); await b.sleep(300)
  const dismissedCard = await b.evaluate(`!!document.querySelector('[data-testid=tension-card][data-status=Dismissed] [data-testid=restore-tension]')`)
  ok('a dismissed tension has Restore', dismissedCard)
  await clickText('[data-testid=tf-Suggested]', 'To review'); await b.sleep(300)
  await click('[data-testid=dismiss-tension]')
  ok('dismissing still asks for a reason', await b.evaluate(`document.querySelector('[data-testid=reason-confirm]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'Too few people.')); await b.sleep(250)
  await click('[data-testid=reason-confirm]')
  await clickText('[data-testid=tf-Dismissed]', 'Dismissed'); await b.sleep(300)
  ok('and the dismissed one can be restored', (await b.evaluate(`document.querySelectorAll('[data-testid=tension-card][data-status=Dismissed] [data-testid=restore-tension]').length`)) >= 2)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 THEMES FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A2 THEMES OK')
