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
    // Mixed: ten people, three with marked hesitation (one channel against) is exactly 3 in 10 at least partly.
    const mixed = sg.rollupPoints(team(10, (i) => (i < 3 ? { band: 'Marked hesitation' } : {})), doc)
    // Conflicting: ten people, four with marked hesitation and a tense voice (two channels against) is exactly 4 in 10 clearly.
    const conflicting = sg.rollupPoints(team(10, (i) => (i < 4 ? { band: 'Marked hesitation', tone: 'Tense' } : {})), doc)
    // Just under each line: two clearly in ten is not Conflicting, two partly in ten is not Mixed.
    const underConflict = sg.rollupPoints(team(10, (i) => (i < 3 ? { band: 'Marked hesitation', tone: 'Tense' } : {})), doc)
    const underMixed = sg.rollupPoints(team(10, (i) => (i < 2 ? { band: 'Marked hesitation' } : {})), doc)
    const few = sg.rollupPoints(team(2, () => ({ band: 'Marked hesitation', tone: 'Tense' })), doc)
    // Someone who complains, and smiles while doing it, is the one thing that pulls against a complaint.
    const complaint = sg.rollupPoints(team(5, (i) => ({ stance: 'Negative', face: i < 3 ? ['Delight', 'High'] : ['Frustration', 'Medium'] })), doc)
    // Audio-only: no face at all. Two of five.
    const audio = sg.rollupPoints(team(5, (i) => ({ face: i < 2 ? null : ['Interest', 'Medium'] })), doc)
    const pick = (r) => ({ verdict: r.verdict, people: r.people, fits: r.fit.fits, partly: r.fit.partly, doesnt: r.fit.doesnt, n: r.fit.n, headline: sg.headlineOf(r) })
    return { rule: em.FIT_RULE, consistent: pick(consistent), mixed: pick(mixed), conflicting: pick(conflicting), underConflict: pick(underConflict), underMixed: pick(underMixed), few: pick(few), complaint: pick(complaint), audio: { read: audio.emotions.read, noVideo: audio.emotions.noVideo, neutral: audio.emotions.counts.Neutral, validNeutral: audio.emotions.valence.Neutral, unclear: audio.emotions.unclear, people: audio.people, headline: sg.headlineOf(audio), verdict: audio.verdict } }
  })()`)
  ok('a consistent theme: delivery fit the words for everyone', unit.consistent.verdict === 'Consistent' && unit.consistent.fits === 6 && unit.consistent.n === 6, JSON.stringify(unit.consistent))
  ok('its headline says delivery matched, in n of N', /^Delivery matched the words for 6 of 6 people\.$/.test(unit.consistent.headline), unit.consistent.headline)
  ok('a mixed theme: 3 in 10 at least partly against', unit.mixed.verdict === 'Mixed' && unit.mixed.partly === 3 && unit.mixed.doesnt === 0 && unit.mixed.n === 10, JSON.stringify(unit.mixed))
  ok('a conflicting theme: 4 in 10 clearly against', unit.conflicting.verdict === 'Conflicting' && unit.conflicting.doesnt === 4 && unit.conflicting.n === 10, JSON.stringify(unit.conflicting))
  ok('the headline names the gap in plain words with counts', /^4 of 10 people argued for it, but (hesitated as they said it|sounded flat or tense); 4 of 10 also (hesitated as they said it|sounded flat or tense)\.$/.test(unit.conflicting.headline), unit.conflicting.headline)
  ok('one step under each line is not that verdict', unit.underConflict.verdict === 'Mixed' && unit.underMixed.verdict === 'Consistent', `${unit.underConflict.verdict} / ${unit.underMixed.verdict}`)
  ok('the thresholds are the repo’s own (4 in 10, 3 in 10, 3 people)', unit.rule.conflicting === 0.4 && unit.rule.mixed === 0.3 && unit.rule.min === 3, JSON.stringify(unit.rule))
  ok('under 3 people is too few to read, said in people', unit.few.verdict === 'Too few to read' && /^Only 2 people said this, too few to read a pattern\.$/.test(unit.few.headline), `${unit.few.verdict}: ${unit.few.headline}`)
  ok('a complaint said with a smile is what pulls against a complaint', unit.complaint.n === 5 && unit.complaint.doesnt + unit.complaint.partly === 3 && /^3 of 5 people complained about it, but had faces that read as delight or interest/.test(unit.complaint.headline), `${JSON.stringify(unit.complaint)}`)
  ok('audio-only people are never counted as neutral', unit.audio.noVideo === 2 && unit.audio.read === 3 && unit.audio.neutral === 0 && unit.audio.validNeutral === 0 && unit.audio.unclear === 0, JSON.stringify(unit.audio))

  // ── By theme is the default view, and the channel switch is gone ──
  await acceptAllThemes()
  ok('By theme is first in the switch and the default', await b.evaluate(`(()=>{const bs=[...document.querySelectorAll('[role=group][aria-label="Read signals by"] button')];return bs[0].innerText==='By theme'&&bs[0].getAttribute('aria-pressed')==='true'})()`))
  ok('the Emotion | Voice | Hesitation switch is hidden', (await b.evaluate(`document.querySelectorAll('[data-testid=lens-emotion],[data-testid=lens-voice],[data-testid=lens-hesitation]').length`)) === 0)
  const rows = await all('[data-testid=theme-signal-row]')
  ok('every accepted theme is a row', ['Price creep', 'The pet decides', 'Wanting control over deliveries', 'Why they joined'].every((n) => rows.some((r) => r.startsWith(n))), rows.map((r) => r.slice(0, 30)).join(' | '))
  ok('each row shows said by n of N, a verdict, words, face, voice and hesitation', rows.every((r) => /Said by \d+ of \d+/.test(r) && /(Consistent|Mixed|Conflicting|Too few to read|No claim)/.test(r) && /Words /.test(r) && /Face /.test(r) && /Voice \d+ of \d+ flat or tense/.test(r) && /Hesitation \d+ of \d+ marked/.test(r)), rows[0])
  ok('no percentages and no vague counts', rows.every((r) => !/%/.test(r) && !/a number of|a few of|some of/i.test(r)))
  ok('every theme has a headline', (await all('[data-testid=theme-headline]')).length === rows.length && (await all('[data-testid=theme-headline]')).every((h) => h.length > 30))
  ok('the rule is stated in one place on the screen', /Conflicting: 4 in 10 or more/.test((await text('[data-testid=theme-rule]')) ?? '') && /Each person counts once/.test((await text('[data-testid=theme-rule]')) ?? ''))

  // Each row: the verdict is the rule applied to its panel's numbers; the lines add up.
  const rl = unit.rule
  const bad = []
  const names = rows.map((r) => r.split(' Said by')[0])
  const panels = {}
  for (const name of names) {
    await clickText('[data-testid=theme-signal-row]', name); await b.sleep(150)
    const chip = (await b.evaluate(`document.querySelector('[data-testid=theme-panel] header span')?.innerText.trim()`)) ?? ''
    const v = (await text('[data-testid=theme-fit-verdict]')) ?? ''
    const m = v.match(/For (\d+) of (\d+),.*?(?:\((\d+) clearly\))?\./)
    const clean = v.match(/fits the words for all (\d+)/)
    const tr = (await text('[data-testid=theme-trace]')) ?? ''
    panels[name] = { chip, v, tr, headline: await text('[data-testid=theme-headline-text]') }
    if (m || clean) {
      const n = m ? +m[2] : +clean[1]
      const against = m ? +m[1] : 0
      const doesnt = m && m[3] ? +m[3] : 0
      const want = n < rl.min ? 'Too few to read' : doesnt / n >= rl.conflicting ? 'Conflicting' : against / n >= rl.mixed ? 'Mixed' : 'Consistent'
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
  ok('the panel shows face, voice and hesitation evidence', ['Words', 'Face', 'Voice', 'Hesitation'].every((w) => new RegExp(`\\b${w}\\b`).test(panel ?? '')) && /positive · \d+ neutral · \d+ negative/.test(panel ?? ''))
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
  const ticks = await b.evaluate(`Object.fromEntries([...document.querySelectorAll('[data-testid=theme-signal-item]')].map(li=>[li.querySelector('[data-testid=theme-signal-row]').innerText.split(/\\s+Said by/)[0], li.querySelector('[data-testid=use-theme]')?.checked]))`)
  const notable = Object.fromEntries(rows.map((r, i) => [names[i], /Mixed|Conflicting/.test(r.match(/Said by \d+ of \d+ (\w[\w ]*?) Words/)?.[1] ?? '') || /Hesitation (\d+) of (\d+) marked/.test(r) && (() => { const m = r.match(/Hesitation (\d+) of (\d+) marked/); return m[1] / m[2] >= 0.25 })()]))
  ok('the tick is on for the Conflicting theme and off for the ones with no gap', ticks['Wanting control over deliveries'] === true && ticks['Why they joined'] === false, JSON.stringify(ticks))
  ok('the tick agrees with the code-level default (hesitation shows, or words and delivery don’t fit)', names.every((n) => ticks[n] === notable[n]), JSON.stringify({ ticks, notable }))
  await b.goto(`${root}/report`); await b.waitFor('Executive summary'); await b.sleep(600)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  const sig = await b.evaluate(`[...document.querySelectorAll('[data-testid=signals] li[data-kind]')].map(li=>({kind:li.dataset.kind,text:li.innerText.replace(/\\s+/g,' ')}))`)
  const control = sig.find((s) => /Wanting control over deliveries/.test(s.text))
  ok('A3’s “How people sounded” shows the theme profile with its headline', !!control && control.kind === 'theme' && /\d+ of \d+ people argued for it, but /.test(control.text) && /off in the client version until cleared/.test(control.text), JSON.stringify(sig.map((s) => s.text.slice(0, 80))))
  ok('and does not show the Consistent themes', !sig.some((s) => /Why they joined|Price creep/.test(s.text)))
  // Untick it in A2: it leaves A3. Reload: the tick is still saved.
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-signal-item]')].find(li=>/Wanting control/.test(li.innerText)).querySelector('[data-testid=use-theme]').click(); true`); await b.sleep(400)
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(500)
  ok('an unticked theme stays unticked after a reload (only the tick is saved)', (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-signal-item]')].find(li=>/Wanting control/.test(li.innerText)).querySelector('[data-testid=use-theme]').checked`)) === false)
  const stored = await b.evaluate(`JSON.stringify(Object.entries(localStorage).filter(([k])=>/codebook/.test(k)).map(([k,v])=>v)).includes('themePicks')`)
  const profileStored = await b.evaluate(`/headline|Delivery matched|argued for it/.test(JSON.stringify(Object.entries(localStorage).filter(([k])=>/codebook|report/.test(k))))`)
  ok('the tick is stored and the profile is not', stored && !profileStored)
  await b.goto(`${root}/report`); await b.waitFor('Executive summary'); await b.sleep(600)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  ok('so it is gone from A3', !(await b.evaluate(`[...document.querySelectorAll('[data-testid=signals] li[data-kind=theme]')].some(li=>/Wanting control/.test(li.innerText))`)))
  // A code-level tick still works for older data.
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  await click('[data-testid=view-code]')
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Flexibility matters more than price/.test(r.innerText)).closest('li').querySelector('[data-testid=use-signal]').click(); true`); await b.sleep(400)
  await b.goto(`${root}/report`); await b.waitFor('Executive summary'); await b.sleep(600)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
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
  ok('and is read with the same profile as any theme', /Said by \d+ of \d+/.test(tRows[0]) && /Voice \d+ of \d+ flat or tense/.test(tRows[0]))
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
