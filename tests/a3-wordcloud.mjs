// A3 Word cloud: accepted themes and codes only, sized by people; the verbatim panel with Ignore (view only), Delete (saved) and Add;
// Regenerate; the leadership preview; and a layout that never moves.
//   npx vite --port 5199 --strictPort &   then   node tests/a3-wordcloud.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const URL = '/researcher/studies/pet-food-churn/analysis/report/wordcloud'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = (s) => JSON.stringify(s)
const count = (sel) => b.evaluate(`document.querySelectorAll(${q(sel)}).length`)
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const click = async (sel) => { const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel}`); await b.sleep(250) }
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const wc=await window.__mod('/src/state/wordcloud'); const cfg=await window.__mod('/src/config/wordcloud'); const lay=await window.__mod('/src/lib/cloudLayout')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
  const cloudDoc=()=>JSON.parse(localStorage.getItem('pulseai-qual:wordcloud')||'{}')['pet-food-churn']`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const open = async (qs = '') => { await b.goto(`${URL}${qs}`); await b.waitFor('Word cloud'); await b.sleep(1300) }
const words = () => b.evaluate(`[...document.querySelectorAll('[data-testid=word]')].map(w=>({key:w.dataset.key,n:Number(w.dataset.n),band:w.dataset.band,label:w.getAttribute('aria-label'),name:w.innerText}))`)
const positions = () => b.evaluate(`[...document.querySelectorAll('[data-testid=word-slot]')].map(s=>s.dataset.key+':'+s.dataset.x+','+s.dataset.y).join('|')`)
const word = (key) => `[data-testid=word][data-key="${key}"]`
const pick = async (key) => { if (await b.evaluate(`!!document.querySelector('[data-testid=panel][data-word="${key}"]')`)) return; await b.evaluate(`(document.querySelector('[data-testid=word][data-key="${key}"]')||document.querySelector('[data-testid=list-row][data-key="${key}"]')).click(); true`); await b.sleep(350) }
const kind = async (k) => { await click(`[data-testid=kind-${k}]`); await b.sleep(300) }
const NOTHING = 'code:c-nothing'

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  // Entry: from Tools, with Back to Report.
  await b.goto('/researcher/studies/pet-food-churn/analysis/report'); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1200)
  await click('[data-testid=tool-word-cloud]'); await b.waitFor('Back to Report'); await b.sleep(700)
  ok('Word cloud in Tools opens /report/wordcloud', /\/analysis\/report\/wordcloud$/.test(await b.evaluate('location.pathname')))
  await click('[data-testid=back-to-report]'); await b.waitFor('EXECUTIVE SUMMARY')
  await open()
  ok('the header has the description, the study line, the Lens selector and the leadership switch', /sized by how many people said them/.test(await b.evaluate('document.body.innerText')) && /Built on 20 accepted sessions · 2 excluded left out · Release v1\.0/.test((await text('[data-testid=built-on]')) ?? '') && (await count('[data-testid=lens-select]')) === 1 && (await count('[role=switch][aria-label="Preview as leadership"]')) === 1)

  // ═══ What feeds the cloud ═══
  const themeWords = await words()
  const data = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const excl=sess.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant)
    const acceptedCodes=doc.codes.filter(c=>c.status==='Accepted').map(c=>c.name).sort(); const codeThemes=cb.codeThemes(doc).map(t=>t.name).sort()
    const hits=['price','vet','switch','portion','flexible'].map(qq=>({q:qq,hits:wc.searchTranscripts(basis,qq)}))
    return {acceptedCodes,codeThemes,excl,leak:hits.flatMap(h=>h.hits).filter(h=>excl.includes(h.participantId)).length,hitCounts:hits.map(h=>[h.q,h.hits.length,new Set(h.hits.map(x=>x.participantId)).size]),notAccepted:hits.flatMap(h=>h.hits).filter(h=>!basis.participants.has(h.participantId)).length}`)
  ok('Themes view lists only the accepted themes', JSON.stringify(themeWords.map((w) => w.name).sort()) === JSON.stringify(data.codeThemes) && themeWords.every((w) => w.key.startsWith('theme:')), themeWords.map((w) => w.name))
  await kind('code')
  const codeWords = await words()
  ok('Codes view lists only accepted codes, and no theme', JSON.stringify(codeWords.map((w) => w.name).sort()) === JSON.stringify(data.acceptedCodes) && codeWords.every((w) => w.key.startsWith('code:')), codeWords.map((w) => w.name))
  ok('Themes and Codes never appear together', !(await b.evaluate(`!!document.querySelector('[data-testid=word][data-key^="theme:"]') && !!document.querySelector('[data-testid=word][data-key^="code:"]')`)))
  ok('excluded sessions never appear in transcript search; every hit is from an accepted session', data.excl.length === 2 && data.leak === 0 && data.notAccepted === 0, data)
  ok('searching vet, price, switch, portion and flexible returns results from different people', data.hitCounts.every(([, n, people]) => n >= 1 && people >= 1) && data.hitCounts.find((h) => h[0] === 'price')[2] >= 5 && data.hitCounts.find((h) => h[0] === 'vet')[2] >= 3, data.hitCounts)
  const spread = codeWords.map((w) => w.n)
  ok('sizes: a spread of 2 to 8 people and all three confidence bands', Math.min(...spread) === 2 && Math.max(...spread) >= 8 && new Set([...codeWords, ...themeWords].map((w) => w.band)).size === 3, { spread, bands: [...new Set([...codeWords, ...themeWords].map((w) => w.band))] })
  const rule = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const defs=wc.wordDefs(doc,'code'); const d=defs.find(x=>x.id==='c-nothing')
    const base=wc.wordOf(d,doc,basis,wc.NO_EDITS)
    // One new person with two statements counts once; their confidence is not averaged in.
    const add=(n)=>({id:'ad'+n,wordKey:d.key,sessionId:sid('P-3101'),participantId:'P-3101',turnIndex:100+n,atSec:50+n,text:'x',by:'t',at:'now'})
    const plus=wc.wordOf(d,doc,basis,{removed:new Set(),added:[add(1),add(2)],ignored:new Set()})
    const bands=[0.8,0.79,0.6,0.59,0.95,0.2].map(v=>cfg.bandOf(v))
    return {baseN:base.n,plusN:plus.n,avgSame:base.avg===plus.avg,bands,cfg:cfg.WORDCLOUD.bands}`)
  ok('size is people: a person with two added statements counts once; added statements are left out of the average', rule.plusN === rule.baseN + 1 && rule.avgSame, rule)
  ok('confidence bands follow the config thresholds: 0.80 High, 0.79 and 0.60 Medium, 0.59 Low', JSON.stringify(rule.bands) === JSON.stringify(['High', 'Medium', 'Medium', 'Low', 'High', 'Low']) && rule.cfg.high === 0.8 && rule.cfg.medium === 0.6, rule)
  ok('every word has an accessible name with its count and confidence band', codeWords.every((w) => new RegExp(`^${w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, \\d+ of \\d+ people, (High|Medium|Low) confidence$`).test(w.label)), codeWords[0].label)
  ok('no percentages anywhere on the page', !/%/.test(await b.evaluate('document.body.innerText')))

  // ═══ Minimum people, the cap, the note ═══
  const noteAt = async (m) => { while (Number(await text('[data-testid=min-value]')) < m) await click('[data-testid=min-up]'); return { note: await text('[data-testid=cloud-note]'), n: (await words()).length } }
  const at2 = await noteAt(2)
  ok('at the default minimum of 2, nothing is hidden and the note says how many are shown', at2.n === 12 && /^Showing 12 words\.$/.test(at2.note), at2)
  const at5 = await noteAt(5)
  const expected5 = codeWords.filter((w) => w.n >= 5).length
  ok('raising the minimum hides words and the note counts them', at5.n === expected5 && new RegExp(`Showing ${expected5} words\\. ${12 - expected5} said by fewer than 5 people are hidden\\.`).test(at5.note), at5)
  const cap = await run(`const doc=JSON.parse(JSON.stringify(store())); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const src=doc.codes.find(c=>c.id==='c-price-rise'); for(let i=0;i<50;i++) doc.codes.push({...src,id:'x'+i,name:'Copy '+i}); const all=wc.allWords(doc,basis,'code',wc.NO_EDITS); const r=wc.shownWords(all,2,doc,basis,'code',wc.NO_EDITS); return {n:all.length,beyond:r.beyondCap,max:cfg.WORDCLOUD.maxWords}`)
  ok('the cap of 40 words holds and the rest are counted', cap.n === 40 && cap.beyond === 62 - 40 && cap.max === 40, cap)
  while (Number(await text('[data-testid=min-value]')) > 2) await click('[data-testid=min-down]')
  await kind('code')

  // ═══ Layout is steady ═══
  const p1 = await positions()
  await pick(NOTHING)
  const p2 = await positions()
  ok('opening the panel does not move any word', p1 === p2 && p1.length > 20, { p1: p1.slice(0, 60), p2: p2.slice(0, 60) })
  await click('[data-testid=panel-close]')
  const lay2 = await run(`const a=lay.layoutCloud([{key:'a',text:'Alpha',size:40},{key:'b',text:'Bravo beta',size:24},{key:'c',text:'Charlie',size:18}],900,520,'seed'); const c=lay.layoutCloud([{key:'a',text:'Alpha',size:40},{key:'b',text:'Bravo beta',size:24},{key:'c',text:'Charlie',size:18}],900,520,'seed'); const overlap=a.some((x,i)=>a.some((y,j)=>j>i&&Math.abs(x.x-y.x)*2<x.w+y.w&&Math.abs(x.y-y.y)*2<x.h+y.h)); return {same:JSON.stringify(a)===JSON.stringify(c),overlap,inside:a.every(p=>p.x-p.w/2>=0&&p.x+p.w/2<=900&&p.y-p.h/2>=0&&p.y+p.h/2<=520)}`)
  ok('the same data gives the same layout twice, with no overlap and nothing outside the picture', lay2.same && !lay2.overlap && lay2.inside, lay2)
  await open()
  await kind('code')
  ok('and a reload gives the same positions', (await positions()) === p1)
  await click('[data-testid=min-up]'); await click('[data-testid=min-up]'); await click('[data-testid=min-up]')
  const filtered = await positions()
  ok('changing the minimum never moves the words that stay', p1.split('|').filter((x) => filtered.includes(x)).length === filtered.split('|').length)
  while (Number(await text('[data-testid=min-value]')) > 2) await click('[data-testid=min-down]')

  // ═══ The panel, Ignore ═══
  await pick(NOTHING)
  ok('the panel header shows the name, Code tag, n of N people, and the band with the average', /Nothing would have kept them/.test((await text('[data-testid=panel-name]')) ?? '') && /Code/.test((await text('[data-testid=panel-kind]')) ?? '') && /2 of 20 people · High, 0\.84/.test((await text('[data-testid=panel-numbers]')) ?? ''))
  ok('no codebook-difference line while the numbers agree', (await count('[data-testid=diff-line]')) === 0 && (await count('[data-testid=pending-note]')) === 0)
  const sts = await b.evaluate(`[...document.querySelectorAll('[data-testid=statement]')].map(s=>({t:s.innerText,conf:s.querySelector('p:nth-of-type(4)')?.innerText}))`)
  ok('each statement has the quote, participant and session IDs, time, Play, user details, code and band, and Ignore and Delete', sts.length === 2 && sts.every((s) => /P-\d+ · P-\d+/.test(s.t) && /\d:\d\d/.test(s.t) && /Play/.test(s.t) && /(Dog|Cat) owner · \d\d to \d\d · \w+/.test(s.t) && /Nothing would have kept them · High/.test(s.t) && /Ignore/.test(s.t) && /Delete/.test(s.t)), sts[0]?.t)
  const logBefore = (await run(`return (cloudDoc()?.log||[]).length`)) ?? 0
  await click('[data-testid=ignore]')
  ok('Ignore greys the statement with “Ignored in this view” and Undo; the live number drops', (await count('[data-testid=statement][data-ignored=true]')) === 1 && /Ignored in this view/.test((await text('[data-testid=statement][data-ignored=true]')) ?? '') && /1 of 20 people/.test((await text('[data-testid=panel-numbers]')) ?? '') && /Codebook: 2 of 20\. Cloud: 1 of 20 \(0 deleted, 1 ignored, 0 added\)/.test((await text('[data-testid=diff-line]')) ?? ''))
  ok('Ignore shows as a pending change, in the chip and the panel note', /1 change not applied/.test((await text('[data-testid=pending-chip]')) ?? '') && /Not applied yet/.test((await text('[data-testid=pending-note]')) ?? '') && (await count('[data-testid=reset-view]')) === 1)
  ok('Ignore is never saved or logged', !/ignor/i.test(await b.evaluate(`localStorage.getItem('pulseai-qual:wordcloud')||''`)) && ((await run(`return (cloudDoc()?.log||[]).length`)) ?? 0) === logBefore)
  await click('[data-testid=undo-ignore]')
  ok('Undo puts it back and clears the pending change', (await count('[data-testid=pending-chip]')) === 0 && /2 of 20 people/.test((await text('[data-testid=panel-numbers]')) ?? ''))
  await click('[data-testid=ignore]')
  await open(); await kind('code')
  ok('leaving the page clears every ignore', (await count('[data-testid=pending-chip]')) === 0 && (await count('[data-testid=reset-view]')) === 0)
  ok('Regenerate is disabled when there are no pending changes', await b.evaluate(`document.querySelector('[data-testid=regenerate]').disabled`))

  // ═══ Delete, Regenerate, Restore ═══
  const cbBefore = await run(`const doc=store(); return JSON.stringify(doc.codes.map(c=>[c.id,c.status,c.excerpts.length]))`)
  await pick(NOTHING)
  await click('[data-testid=delete]')
  ok('Delete asks first: “It stays in the codebook, the transcript and the report.”', /Delete from the word cloud\? It stays in the codebook, the transcript and the report\./.test((await text('[data-testid=confirm]')) ?? ''))
  await click('[data-testid=confirm-delete]')
  ok('after Delete the statement leaves the list and the live number drops, with the difference line', (await count('[data-testid=statement]')) === 1 && /1 of 20 people/.test((await text('[data-testid=panel-numbers]')) ?? '') && /Codebook: 2 of 20\. Cloud: 1 of 20 \(1 deleted, 0 added\)/.test((await text('[data-testid=diff-line]')) ?? ''))
  ok('the chip counts it and the cloud has not changed yet', /1 change not applied/.test((await text('[data-testid=pending-chip]')) ?? '') && (await count(word(NOTHING))) === 1 && (await words()).find((w) => w.key === NOTHING).n === 2)
  await click('[data-testid=removed-toggle]')
  const rem = await text('[data-testid=removed-row]')
  ok('Removed (1) lists it with who removed it and when, and a Restore link', /Removed by Maya Ortiz, \w{3} \d+, \d+:\d\d/.test(rem ?? '') && /Restore/.test(rem ?? ''), rem)
  const logged = await run(`return cloudDoc().log.map(l=>l.action+'|'+l.by)`)
  ok('the delete is saved per study and logged with the researcher’s name', logged.some((l) => /Deleted a statement/.test(l) && /Maya Ortiz/.test(l)) && (await run(`return cloudDoc().removed.length`)) === 1)
  await click('[data-testid=regenerate]'); await b.sleep(500)
  ok('Regenerate applies it: the word drops below the minimum and leaves the cloud, and the chip clears', (await count(word(NOTHING))) === 0 && (await count('[data-testid=pending-chip]')) === 0 && await b.evaluate(`document.querySelector('[data-testid=regenerate]').disabled`))
  ok('its panel stays open with “This word no longer appears in the cloud.”', /no longer appears in the cloud/.test((await text('[data-testid=gone-note]')) ?? '') && (await count('[data-testid=panel]')) === 1)
  await open(); await kind('code')
  ok('the last regenerated cloud and the saved edit survive a reload', (await count(word(NOTHING))) === 0 && (await run(`return cloudDoc().removed.length`)) === 1)
  ok('a delete never touches the codebook', (await run(`const doc=store(); return JSON.stringify(doc.codes.map(c=>[c.id,c.status,c.excerpts.length]))`)) === cbBefore)
  await click('[data-testid=min-down]'); await b.sleep(300)
  await pick(NOTHING); await click('[data-testid=removed-toggle]')
  await click('[data-testid=restore]')
  ok('Restore brings it back into the list at once, and the chip counts the change', (await count('[data-testid=statement]')) === 2 && /1 change not applied/.test((await text('[data-testid=pending-chip]')) ?? ''))
  await click('[data-testid=regenerate]'); await b.sleep(400)
  await click('[data-testid=min-up]'); await b.sleep(300)
  ok('after Regenerate the word is back in the cloud with 2 of 20', (await words()).find((w) => w.key === NOTHING)?.n === 2)

  // ═══ Add ═══
  await pick(NOTHING)
  await click('[data-testid=add-statement]')
  ok('Add opens a search view titled “Add to: …” with a back link', /Add to: Nothing would have kept them/.test((await text('[data-testid=add-view]')) ?? '') && (await count('[data-testid=add-back]')) === 1)
  const setSearch = (v) => b.evaluate(`var i=document.querySelector('[data-testid=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${q(v)}); i.dispatchEvent(new Event('input',{bubbles:true})); true`)
  await setSearch('p'); await b.sleep(200)
  ok('it searches only after 2 characters', (await count('[data-testid=hit]')) === 0)
  await setSearch('price'); await b.sleep(400)
  const hitInfo = await b.evaluate(`({n:document.querySelectorAll('[data-testid=hit]').length,people:new Set([...document.querySelectorAll('[data-testid=hit]')].map(h=>h.dataset.participant)).size,mark:!!document.querySelector('[data-testid=hit] mark'),ids:[...document.querySelectorAll('[data-testid=hit]')].map(h=>h.dataset.participant)})`)
  ok('results are up to 20, with the term highlighted, from several people', hitInfo.n > 0 && hitInfo.n <= 20 && hitInfo.people >= 5 && hitInfo.mark, hitInfo)
  ok('and every result is from an accepted session (never P-3112 or P-3119)', !hitInfo.ids.some((id) => id === 'P-3112' || id === 'P-3119'))
  const firstHit = await b.evaluate(`(()=>{const h=[...document.querySelectorAll('[data-testid=hit]')].find(x=>!x.querySelector('[data-testid=already]'));return {p:h.dataset.participant,s:h.dataset.session}})()`)
  await b.evaluate(`document.querySelector('[data-testid=hit] [data-testid=add-hit]').click(); true`); await b.sleep(400)
  ok('Add returns to the list with the new statement first, tagged “Added by you”', (await count('[data-testid=add-view]')) === 0 && /Added by you/.test((await text('[data-testid=statement]:first-child')) ?? ''))
  const nAfterFirst = Number((await text('[data-testid=panel-numbers]')).match(/(\d+) of/)[1])
  ok('a person not already counted raises n by one', nAfterFirst === 3, await text('[data-testid=panel-numbers]'))
  ok('the difference line says 1 added, and the chip counts the add', /Cloud: 3 of 20 \(0 deleted, 1 added\)/.test((await text('[data-testid=diff-line]')) ?? '') && /1 change not applied/.test((await text('[data-testid=pending-chip]')) ?? ''))
  // A second statement from a person already counted does not change n: two "vet" segments from one person.
  await click('[data-testid=add-statement]'); await setSearch('vet'); await b.sleep(400)
  const vet = await b.evaluate(`(()=>{const hs=[...document.querySelectorAll('[data-testid=hit]')];const p=hs.find(h=>hs.filter(x=>x.dataset.participant===h.dataset.participant).length>1)?.dataset.participant;return {p,n:hs.filter(h=>h.dataset.participant===p).length}})()`)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=hit]')].find(h=>h.dataset.participant==='${vet.p}'&&h.querySelector('[data-testid=add-hit]')).querySelector('[data-testid=add-hit]').click(); true`); await b.sleep(400)
  const n1 = Number((await text('[data-testid=panel-numbers]')).match(/(\d+) of/)[1])
  await click('[data-testid=add-statement]'); await setSearch('vet'); await b.sleep(400)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=hit]')].find(h=>h.dataset.participant==='${vet.p}'&&h.querySelector('[data-testid=add-hit]')).querySelector('[data-testid=add-hit]').click(); true`); await b.sleep(400)
  const n2 = Number((await text('[data-testid=panel-numbers]')).match(/(\d+) of/)[1])
  ok('a second statement from a person already counted does not change n', vet.n >= 2 && n2 === n1 && (await count('[data-testid=statement][data-added=true]')) === 3, { vet, n1, n2 })
  await click('[data-testid=add-statement]'); await setSearch('price'); await b.sleep(300); await click('[data-testid=add-back]')
  // A second statement from the same person does not change n.
  await click('[data-testid=add-statement]'); await setSearch('price'); await b.sleep(400)
  const marked = await b.evaluate(`[...document.querySelectorAll('[data-testid=hit]')].filter(h=>h.querySelector('[data-testid=already]')).length`)
  ok('a segment already in this word shows “Already included” and is disabled', marked >= 1 && await b.evaluate(`[...document.querySelectorAll('[data-testid=already]')].every(x=>x.disabled)`))
  await click('[data-testid=add-back]')
  const stBefore = await count('[data-testid=statement]')
  await b.evaluate(`document.querySelector('[data-testid=statement][data-added=true] [data-testid=delete]').click(); true`); await b.sleep(200); await click('[data-testid=confirm-delete]')
  ok('the added statement can be deleted like any other: it leaves the list and goes to Removed', (await count('[data-testid=statement]')) === stBefore - 1 && /Removed \(1\)/.test((await text('[data-testid=removed-toggle]')) ?? ''), { stBefore })
  ok('adding wrote only to the cloud: the codebook is unchanged', (await run(`const doc=store(); return JSON.stringify(doc.codes.map(c=>[c.id,c.status,c.excerpts.length]))`)) === cbBefore)

  // ═══ An edit pointing at nothing is skipped ═══
  await b.evaluate(`(()=>{const k='pulseai-qual:wordcloud';const s=JSON.parse(localStorage.getItem(k));const d=s['pet-food-churn'];d.removed.push({id:'rm-x',wordKey:'code:c-gone',excerptId:'nope',by:'t',at:new Date().toISOString()},{id:'rm-y',wordKey:'code:c-price-rise',excerptId:'does-not-exist',by:'t',at:new Date().toISOString()});d.added.push({id:'ad-x',wordKey:'code:c-price-rise',sessionId:'P-0000-1',participantId:'P-0000',turnIndex:3,atSec:9,text:'x',by:'t',at:new Date().toISOString()});d.applied.removed=d.removed.map(r=>r.wordKey+'|'+r.excerptId);d.applied.added=d.added.map(a=>a.id);localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await open(); await kind('code')
  const price = (await words()).find((w) => w.key === 'code:c-price-rise')
  ok('edits that point at a missing statement, word or session are skipped silently; nothing breaks', !!price && price.n === 8 && !/Unexpected Application Error/.test(await b.evaluate('document.body.innerText')), price)

  // Everything below the minimum: every statement removed and applied, so no word has a person left.
  await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const rm=[]; for (const kind of ['theme','code']) for (const d of wc.wordDefs(doc,kind)) for (const s of wc.baseStatements(d,basis)) rm.push({id:'rm'+rm.length,wordKey:d.key,excerptId:s.id,by:'t',at:new Date().toISOString()}); const k='pulseai-qual:wordcloud'; const st=JSON.parse(localStorage.getItem(k)); const d=st['pet-food-churn']; d.removed=rm; d.applied.removed=rm.map(r=>r.wordKey+'|'+r.excerptId); localStorage.setItem(k,JSON.stringify(st)); return rm.length`)
  await open()
  ok('when every word is below the minimum it says so, with a hint to lower it', (await count('[data-testid=below-min]')) === 1 && /Everything is below the minimum of 2 people\. Lower the minimum to see words\./.test((await text('[data-testid=below-min]')) ?? ''))

  // ═══ Leadership preview ═══
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); true')
  await open(); await kind('code'); await pick(NOTHING)
  await click('[data-testid=ignore]')                     // an ignore, view only
  await b.evaluate(`document.querySelectorAll('[data-testid=delete]')[0].click(); true`); await b.sleep(200)
  await click('[data-testid=confirm-delete]')             // a delete, then applied
  await click('[data-testid=add-statement]')
  await b.evaluate(`var i=document.querySelector('[data-testid=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'price'); i.dispatchEvent(new Event('input',{bubbles:true})); true`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[data-testid=hit] [data-testid=add-hit]').click(); true`); await b.sleep(300)
  await click('[data-testid=min-down]')
  await click('[data-testid=regenerate]'); await b.sleep(300)
  // an ignore made after the Regenerate, and a delete not yet applied
  await b.evaluate(`document.querySelector('[data-testid=statement]:not([data-added=true]) [data-testid=ignore]')?.click(); true`); await b.sleep(200)
  const researcherN = Number((await text('[data-testid=panel-numbers]')).match(/(\d+) of/)[1])
  await b.evaluate(`document.querySelector('[role=switch][aria-label="Preview as leadership"]').click(); true`); await b.sleep(400)
  ok('Leadership preview shows the banner and keeps only Themes|Codes, Cloud|List and Colour by', /Leadership preview\. Read only\./.test((await text('[data-testid=leadership-banner]')) ?? '') && (await count('[data-testid=regenerate]')) === 0 && (await count('[data-testid=min-up]')) === 0 && (await count('[data-testid=kind]')) === 1 && (await count('[data-testid=colour]')) === 1)
  await pick(NOTHING); await b.sleep(300)
  const lead = await b.evaluate(`({panel:document.querySelector('[data-testid=panel]')?.innerText.replace(/\\s+/g,' '),controls:['ignore','delete','add-statement','removed','diff-line','pending-note'].map(t=>document.querySelectorAll('[data-testid='+t+']').length),details:[...document.querySelectorAll('[data-testid=details]')].map(d=>d.innerText),nums:document.querySelector('[data-testid=panel-numbers]').innerText})`)
  ok('in the preview the panel has no Ignore, Delete, Add, Removed, difference line or pending note', lead.controls.every((n) => n === 0), lead.controls)
  ok('user details in the preview are only the segment (and the participant ID), never age band or city', lead.details.length > 0 && lead.details.every((d) => /^(Dog|Cat) owner$/.test(d.trim())) && !/P-\d+ · P-\d+/.test(lead.panel), lead.details)
  const leadN = Number(lead.nums.match(/(\d+) of/)[1])
  const expectLead = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const d=wc.wordDefs(doc,'code').find(x=>x.id==='c-nothing'); const c=cloudDoc(); const applied=wc.appliedEdits({...c,removed:c.removed,added:c.added}); return {applied:wc.wordOf(d,doc,basis,applied).n,deleted:c.removed.length,added:c.added.length}`)
  ok('it applies the saved delete and add but not the ignore: the number is the last regenerated one, not the researcher’s live one', expectLead.deleted === 1 && expectLead.added === 1 && leadN === expectLead.applied && researcherN < leadN, { leadN, researcherN, expectLead })
  await b.evaluate(`document.querySelector('[role=switch][aria-label="Preview as leadership"]').click(); true`); await b.sleep(400)
  ok('turning it off returns the researcher view with everything as it was', (await count('[data-testid=regenerate]')) === 1 && (await count('[data-testid=panel]')) === 1 && (await text('[data-testid=panel-name]')) === 'Nothing would have kept them')

  // ═══ List view and colours ═══
  await b.evaluate(`document.querySelector('[data-testid=panel-close]')?.click(); true`)
  const cloudWords = await words()
  await click('[data-testid=view-list]')
  const rows = await b.evaluate(`[...document.querySelectorAll('[data-testid=list-row]')].map(r=>({key:r.dataset.key,n:Number(r.dataset.n),band:r.dataset.band}))`)
  ok('List view has the same words, numbers and bands as the cloud, in ranked order', JSON.stringify(rows.map((r) => [r.key, r.n, r.band]).sort()) === JSON.stringify(cloudWords.map((w) => [w.key, w.n, w.band]).sort()) && rows.every((r, i) => i === 0 || rows[i - 1].n >= r.n), { rows: rows.length, cloud: cloudWords.length })
  await pick('code:c-price-rise').catch(() => {})
  await click('[data-testid=view-cloud]')
  await click('[data-testid=colour-theme]')
  ok('Colour by theme lists the themes in the legend, with “Not in a theme”', /Price creep/.test((await text('[data-testid=colour-legend]')) ?? '') && /Not in a theme/.test((await text('[data-testid=colour-legend]')) ?? ''))
  await click('[data-testid=colour-confidence]')
  ok('Colour by confidence labels all three bands in words in the legend', /High confidence/.test((await text('[data-testid=colour-legend]')) ?? '') && /Medium/.test((await text('[data-testid=colour-legend]')) ?? '') && /Low/.test((await text('[data-testid=colour-legend]')) ?? ''))
  await open('?demo=error')
  ok('?demo=error shows “The word cloud didn’t load” with Retry', /The word cloud didn’t load/.test(await b.evaluate('document.body.innerText')))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A3 WORD CLOUD FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A3 WORD CLOUD OK')
