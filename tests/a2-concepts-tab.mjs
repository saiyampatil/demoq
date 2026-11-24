// A2, the Concepts tab (commit 2B): the tab, the table, the panel, the decisions, and the table in A3.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-concepts-tab.mjs
import { launch } from './cdp.mjs'

const b = await launch()
const ICE = '/researcher/studies/ice-cream-flavours/analysis'
const PET = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = JSON.stringify
const ev = (expr) => b.evaluate(expr)
const text = (sel) => ev(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ').trim() ?? null`)
const count = (sel) => ev(`document.querySelectorAll(${q(sel)}).length`)
const click = async (sel, i = 0) => {
  const done = await b.poll(`(()=>{const e=document.querySelectorAll(${q(sel)})[${i}];if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel} ${i}`)
  await b.sleep(250)
}
const lastToast = () => ev(`(()=>{const t=[...document.querySelectorAll('[data-testid=toast]')].pop();return t?t.innerText.replace(/\\s+/g,' '):null})()`)
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const run = (body, study) => ev(`(async()=>{${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const cn=await window.__mod('/src/state/concepts'); const mc=await window.__mod('/src/mock/concepts'); const sp=await window.__mod('/src/state/speech')
  const study=${q(study)}; const ppl=ms.acceptedParticipants(study); const basis=cb.basisOf(ppl.map(p=>({id:ms.sessionOfParticipant(p),participantId:p})))
  const rows=()=>cn.conceptRows(cb.getCodebook(study),basis); ${body}})()`)
const fresh = async (root, tab = 'concepts') => {
  await b.goto('/researcher')
  await ev('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals?tab=${tab}`)
  await b.waitFor(tab === 'concepts' ? 'Concept' : 'What stood out')
  await b.sleep(800)
}
const press = async (key, t) => {
  const vk = { ArrowDown: 40, ArrowUp: 38, Enter: 13 }[key] ?? key.toUpperCase().charCodeAt(0)
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: vk, text: t ?? (key.length === 1 ? key : key === 'Enter' ? '\r' : undefined) })
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: vk })
  await b.sleep(250)
}
const setValue = (sel, v) => ev(`(() => { const t=document.querySelector(${q(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${q(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
const statusOf = (name) => ev(`[...document.querySelectorAll('[data-testid=concept-row]')].find(r=>r.querySelector('[data-testid=concept-name]').innerText.trim()===${q(name)})?.querySelector('[data-testid=status-chip]')?.dataset.status ?? null`)
const open = (name) => ev(`[...document.querySelectorAll('[data-testid=concept-name]')].find(e=>e.innerText.trim()===${q(name)}).click(); true`).then(() => b.sleep(300))

try {
  // ── the tab ──
  await fresh(ICE, 'themes')
  const tabs = await ev(`[...document.querySelectorAll('[role=tab]')].map(t=>t.innerText.replace(/\\s+/g,' ').trim().replace(/ \\d+$/,''))`)
  ok('the tabs are Themes, Concepts, Tensions, in that order', JSON.stringify(tabs) === JSON.stringify(['Themes', 'Concepts', 'Tensions']), tabs)
  // The seed holds one accepted line (Cookie Dough Crunch), so two are still to decide.
  ok('the Concepts tab has a badge with the lines still to decide', (await text('[data-testid=concepts-badge]')) === '2')
  const none = await run(`const doc=cb.getCodebook(study); return cn.conceptRows({...doc, studyId:'a-study-with-no-concepts'}, basis)===undefined && mc.conceptStudyOf('a-study-with-no-concepts')===undefined`, 'ice-cream-flavours')
  ok('a study that showed no concepts has no Concepts tab (no concept data, so the logic returns nothing)', none)
  const cov = await text('[data-testid=coverage]')
  ok('the header coverage gains “Faces read at concept reveals for {n} of {N} ({k} audio-only)”', /Speech read for 20 of 20 · 5 audio-only, read on speech · Faces read at concept reveals for 15 of 20 \(5 audio-only\)/.test(cov ?? ''), cov)

  // ── the table: Ice Cream has a choice task, so all six columns ──
  await click('#sttab-concepts')
  const head = await ev(`[...document.querySelector('[data-testid=concept-head]').children].map(e=>e.innerText.trim())`)
  ok('six columns: Concept, Said, Did, Showed, Match, Status (the brief’s list, one more than the usual five)', JSON.stringify(head) === JSON.stringify(['Concept', 'Said', 'Did', 'Showed', 'Match', 'Status']), head)
  const want = await run(`return rows().rows.map(r=>({name:r.name,said:r.said?r.said.n+' of '+r.said.of:'—',did:r.did?r.did.n+' of '+r.did.of:'—',showed:r.showed.n+' of '+r.showed.of,match:r.match,line:r.line,leads:r.leads,status:r.decision.status}))`, 'ice-cream-flavours')
  const got = await ev(`[...document.querySelectorAll('[data-testid=concept-row]')].map(r=>({name:r.querySelector('[data-testid=concept-name]').innerText.trim(),said:r.querySelector('[data-testid=cell-said]').innerText.replace(/\\s+/g,' ').replace(' (highest)','').trim(),did:r.querySelector('[data-testid=cell-did]').innerText.replace(/\\s+/g,' ').replace(' (highest)','').trim(),showed:r.querySelector('[data-testid=cell-showed]').innerText.replace(/\\s+/g,' ').replace(' (highest)','').trim(),leads:{said:!!r.querySelector('[data-testid=cell-said][data-lead]'),did:!!r.querySelector('[data-testid=cell-did][data-lead]'),showed:!!r.querySelector('[data-testid=cell-showed][data-lead]')},match:r.querySelector('[data-testid=match-chip]').dataset.match,line:r.querySelector('[data-testid=concept-line]').innerText.replace(/\\s+/g,' ').trim(),status:r.querySelector('[data-testid=status-chip]').dataset.status,h:Math.round(r.getBoundingClientRect().height)}))`)
  ok('every row reads: name, its line, Said, Did, Showed as “n of N”, Match and Status, all from the logic', got.length === 3 && got.every((g, i) => g.name === want[i].name && g.said === want[i].said && g.did === want[i].did && g.showed === want[i].showed && g.match === want[i].match && g.line === want[i].line && g.status === want[i].status && g.h >= 72), [got, want])
  ok('the highest in each column is marked (bold, and “highest” for a screen reader); the logic says which', got.every((g, i) => JSON.stringify(g.leads) === JSON.stringify(want[i].leads)) && got.some((g) => g.leads.said) && got.some((g) => g.leads.did) && got.some((g) => g.leads.showed), got.map((g) => g.leads))
  ok('each concept has its own base (everyone saw every card): Said and Did are “of 20”, Showed is “of 15” on video', got.map((g) => `${g.said}|${g.did}|${g.showed}`).join() === '8 of 20|10 of 20|1 of 15,5 of 20|3 of 20|9 of 15,7 of 20|7 of 20|5 of 15')
  ok('Caramel and Mango Differ (Caramel is said and taken home but rarely warmest; Mango the other way round); Cookie Agrees', got.filter((g) => g.match === 'Differs').map((g) => g.name).join() === 'Salted Caramel Swirl,Mango Lassi' && got[2].match === 'Agrees')
  const bold = await ev(`(()=>{const w=(r,k)=>+getComputedStyle(document.querySelectorAll('[data-testid=concept-row]')[r].querySelector('[data-testid=cell-'+k+']')).fontWeight;return {caramelSaid:w(0,'said'),mangoSaid:w(1,'said'),caramelDid:w(0,'did'),cookieDid:w(2,'did'),mangoShowed:w(1,'showed'),caramelShowed:w(0,'showed')}})()`)
  ok('the leader’s number is heavier than the others’ (Caramel leads Said and Did, Mango leads Showed)', bold.caramelSaid > bold.mangoSaid && bold.caramelDid > bold.cookieDid && bold.mangoShowed > bold.caramelShowed, bold)
  const grey = await text('[data-testid=concepts-note]')
  ok('one grey line says what each measure counts', /Said: picked it first\. Did: chose it in the choice task\. Showed: warmest first reaction, people on video\./.test(grey ?? '') && !/isn’t shown/.test(grey ?? ''), grey)
  const flat = await ev(`document.querySelectorAll('[data-testid=concepts-table] canvas,[data-testid=concepts-table] meter,[data-testid=concepts-table] progress,[data-testid=concepts-table] [role=img]').length`)
  ok('no bars or charts in the table', flat === 0)

  // ── the panel ──
  await open('Salted Caramel Swirl')
  const order = await ev(`['insight','concept-figures','clips-section','tensions-section','note-section'].map(id=>{const e=document.querySelector('[data-testid=concept-panel] [data-testid='+id+']');return e?Math.round(e.getBoundingClientRect().top+document.querySelector('[data-testid=concept-panel] .overflow-y-auto').scrollTop):-1})`)
  const panelShape = await ev(`(()=>{const p=document.querySelector('[data-testid=concept-panel]');const d=p.querySelector('[data-testid=decision]');const sc=p.querySelector('.overflow-y-auto');return {outside:!sc.contains(d),last:p.lastElementChild.dataset.testid,buttons:[...d.querySelectorAll('[data-testid=actions] button')].map(x=>x.innerText.trim())}})()`)
  ok('the panel runs: insight, said · did · showed, first reactions, tensions, your note; the decision bar sits below the scroll and the approval line is last', order.every((y, i) => y >= 0 && (i === 0 || y >= order[i - 1])) && panelShape.outside && panelShape.last === 'approval-line' && panelShape.buttons.join() === 'Accept,Edit,Leave out', [order, panelShape])
  ok('the header says “Concept A: Salted Caramel Swirl”, the match, and “Seen by 20 of 20 people”', (await text('[data-testid=concept-panel-name]')) === 'Concept A: Salted Caramel Swirl' && (await text('[data-testid=concept-panel-seen]')) === 'Seen by 20 of 20 people' && (await ev(`document.querySelector('[data-testid=concept-panel] [data-testid=match-chip]').dataset.match`)) === 'Differs')
  const typo = await ev(`(()=>{const p=document.querySelector('[data-testid=concept-panel]');const f=(e)=>({size:parseFloat(getComputedStyle(e).fontSize),weight:+getComputedStyle(e).fontWeight});const heads=['insight','concept-figures','clips-section'].map(id=>f(p.querySelector('[data-testid='+id+']').querySelector('h3')));const others=[...p.querySelectorAll('p,li,span,button,h3')].filter(e=>!e.closest('h2')&&!e.closest('[data-testid=summary-sentence]')).map(e=>parseFloat(getComputedStyle(e).fontSize));const tag=[...p.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()==='AI-generated')).length;return {heads,sent:f(p.querySelector('[data-testid=summary-sentence]')),maxOther:Math.max(...others),title:f(p.querySelector('h2')),tag}})()`)
  ok('the line is the largest text under the title, with one AI-generated tag, and the headings share one style', typo.sent.size > typo.maxOther && typo.sent.size < typo.title.size && typo.tag === 1 && typo.heads.every((h) => h.size === typo.heads[0].size && h.weight === typo.heads[0].weight), typo)
  ok('the line is the logic’s line', (await text('[data-testid=concept-panel] [data-testid=summary-sentence]')) === want[0].line)
  const tiles = await ev(`[...document.querySelectorAll('[data-testid=measure-tiles] > button')].map(t=>({key:t.dataset.testid,n:+t.dataset.n,of:+t.dataset.of,text:t.innerText.replace(/\\s+/g,' ').trim()}))`)
  ok('three tiles, Said · Did · Showed, each with its own base written out (“of 20 people”, “of 15 on video”)', tiles.length === 3 && tiles[0].text === '8 Said of 20 people' && tiles[1].text === '10 Did of 20 people' && tiles[2].text === '1 Showed of 15 on video', tiles)
  for (const key of ['said', 'did', 'showed']) {
    await click(`[data-testid=fig-${key}]`)
    const listed = await ev(`[...document.querySelectorAll('[data-testid=measure-people] [data-testid=tile-person]')].map(li=>({id:li.querySelector('.font-medium').innerText,word:li.querySelector('[data-testid=tile-reason]').innerText}))`)
    const expect = await run(`return cn.peopleBehind(rows().input,'m-concept-a',${q(key)}).length`, 'ice-cream-flavours')
    ok(`the ${key} tile lists exactly its people, each with ID, segment and one word`, listed.length === expect && listed.length === tiles.find((t) => t.key === `fig-${key}`).n && listed.every((x) => /^P-\d{4}$/.test(x.id) && x.word.length > 3), [listed.length, expect])
  }
  ok('the coverage line says how many faces were read at this reveal, and who was left out', /^Faces read at the reveal for 15 of 20 people · 5 audio-only$/.test((await text('[data-testid=concept-coverage]')) ?? ''), await text('[data-testid=concept-coverage]'))
  const clips = await ev(`[...document.querySelectorAll('[data-testid=clips] [data-testid=clip]')].map(c=>({rank:+c.dataset.rank,who:c.dataset.person,reading:c.querySelector('[data-testid=clip-reading]').innerText.replace(/\\s+/g,' '),cue:c.querySelector('[data-testid=clip-cue]').innerText,href:c.querySelector('a').getAttribute('href')}))`)
  const clipWant = await run(`const r=rows(); const c=cn.clipsOf(r.input,'m-concept-a'); return {who:c.clips.map(x=>x.participantId),at:c.clips.map(x=>Math.round(x.reading.revealAtSec)),total:c.total}`, 'ice-cream-flavours')
  ok('first reactions: five, ranked 1 to 5, warmest first, each “reads as” a label with what was visible and when', clips.length === 5 && clips.every((c, i) => c.rank === i + 1 && /^reads as (Delight|Interest|Surprise|Neutral|Confusion|Doubt|Frustration) · (low|medium|high)/.test(c.reading) && /s after the reveal$/.test(c.cue) && c.cue.length > 20) && JSON.stringify(clips.map((c) => c.who)) === JSON.stringify(clipWant.who), [clips, clipWant])
  ok('Play opens the session at the reveal, and the list says how many there are', clips.every((c, i) => new RegExp(`at=${clipWant.at[i]}\\b`).test(c.href)) && (await text('[data-testid=clips-count]')) === `Showing 5 of ${clipWant.total} first reactions.`, clips.map((c) => c.href))
  ok('no audio-only person and nobody without consent is in the list', !clips.some((c) => ['P-4116', 'P-4117', 'P-4118', 'P-4119', 'P-4120'].includes(c.who)))
  ok('the panel never says a face “felt” anything: first reactions only “read as”', !/\bfelt\b|\bfeels?\b|\bhappy\b|\bangry\b/i.test((await text('[data-testid=concept-panel]')) ?? ''))

  // ── decisions ──
  ok('before a decision the status is Suggested and the footer says “Not decided yet”', (await statusOf('Salted Caramel Swirl')) === 'Suggested' && (await text('[data-testid=approval-line]')) === 'Not decided yet')
  await click('[data-testid=accept]')
  ok('Accept records who, when, the fingerprint and the data version, and the footer says so', (await statusOf('Salted Caramel Swirl')) === 'Accepted' && /^Accepted by Maya Ortiz · [A-Z][a-z]{2} \d{1,2}, \d{4} · data v1$/.test((await text('[data-testid=approval-line]')) ?? '') && (await lastToast())?.includes('Undo'))
  ok('and the badge on the tab goes down', (await text('[data-testid=concepts-badge]')) === '1')
  await click('[data-testid=toast] button')
  ok('Undo takes it back to Suggested', (await statusOf('Salted Caramel Swirl')) === 'Suggested')
  await click('[data-testid=accept]')
  await click('[data-testid=edit]')
  const line0 = want[0].line
  await setValue('[data-testid=insight-text]', line0.replace('1 of 15', '2 of 15')); await b.sleep(200)
  ok('Edit locks the numbers: changing a figure shows why and disables Save', /numbers are locked/i.test((await text('[data-testid=insight-problems]')) ?? '') && (await ev(`document.querySelector('[data-testid=insight-save]').disabled`)))
  await setValue('[data-testid=insight-text]', line0 + ' (about 40%)'); await b.sleep(200)
  ok('Edit runs the narration validator: a percentage is refused', (await count('[data-testid=insight-problems] li')) >= 1 && (await ev(`document.querySelector('[data-testid=insight-save]').disabled`)))
  await setValue('[data-testid=insight-text]', line0.replace('drew the warmest first reaction', 'got the warmest first reaction')); await b.sleep(200)
  ok('wording-only changes pass, with two figures allowed', (await count('[data-testid=insight-problems]')) === 0 && !(await ev(`document.querySelector('[data-testid=insight-save]').disabled`)))
  await click('[data-testid=insight-save]')
  ok('saved as Edited, with PulseAI’s line kept beside it', (await statusOf('Salted Caramel Swirl')) === 'Edited' && (await text('[data-testid=ai-original]')) === `PulseAI wrote: ${line0}`)
  // the data moves under an accepted line
  await run(`const p=mc.conceptStudyOf(study).choice.picks; window.__was=p['P-4102']; p['P-4102']='m-concept-a'; cb.updateCodebook(study,d=>({...d})); return true`, 'ice-cream-flavours'); await b.sleep(400)
  ok('when the data moves after a decision the line is Out of date, showing old and new', (await statusOf('Salted Caramel Swirl')) === 'Out of date' && /Was: /.test((await text('[data-testid=was]')) ?? '') && /Now: /.test((await text('[data-testid=now]')) ?? ''), await text('[data-testid=out-of-date]'))
  await run(`mc.conceptStudyOf(study).choice.picks['P-4102']=window.__was; cb.updateCodebook(study,d=>({...d})); return true`, 'ice-cream-flavours'); await b.sleep(400)
  await click('[data-testid=leave-out]')
  await setValue('[data-testid=leave-why]', 'Not for this report.'); await b.sleep(150)
  await click('[data-testid=leave-confirm]')
  ok('Leave out keeps the reason and says who', (await statusOf('Salted Caramel Swirl')) === 'Left out' && /Not for this report/.test((await text('[data-testid=left-out-why]')) ?? '') && /^Left out by Maya Ortiz/.test((await text('[data-testid=approval-line]')) ?? ''))
  await setValue('[data-testid=note]', 'x'); await ev(`document.querySelector('[data-testid=note]').dispatchEvent(new FocusEvent('focusout',{bubbles:true})); true`)
  await click('[data-testid=accept]')

  // ── keyboard ──
  await fresh(ICE)
  await ev(`document.querySelectorAll('[data-testid=concept-name]')[0].focus(); true`)
  await press('ArrowDown')
  ok('Down moves to the next concept', (await ev(`document.activeElement.innerText.trim()`)) === 'Mango Lassi')
  await press('Enter')
  ok('Enter opens it', (await text('[data-testid=concept-panel-name]')) === 'Concept B: Mango Lassi')
  await ev(`document.querySelectorAll('[data-testid=concept-name]')[0].focus(); true`)
  await press('a')
  ok('A accepts the focused concept’s line', (await statusOf('Salted Caramel Swirl')) === 'Accepted')
  await ev(`document.querySelectorAll('[data-testid=concept-name]')[1].focus(); true`)
  await press('e')
  ok('E opens its wording to edit', (await count('[data-testid=insight-text]')) === 1)
  await ev(`document.querySelectorAll('[data-testid=concept-name]')[1].focus(); true`)
  await press('l')
  ok('L opens the reason to leave it out', (await count('[data-testid=leave-form]')) === 1)

  // ── A3 shows the accepted lines ──
  await b.goto(`${ICE}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1500)
  ok('A3 has a Concepts section, with the two lines accepted (Cookie in the seed, Caramel by the keyboard step)', (await text('[data-testid=concepts-summary]')) === '2 concept lines accepted in Emotion & behaviour', await text('[data-testid=concepts-summary]'))
  await ev(`document.querySelector('[data-testid=concepts] > button').click(); true`); await b.sleep(300)
  const a3 = await ev(`[...document.querySelectorAll('[data-testid=concept-line-row]')].map(r=>({id:r.dataset.concept,said:r.querySelector('[data-testid=report-said]').innerText,did:r.querySelector('[data-testid=report-did]').innerText,showed:r.querySelector('[data-testid=report-showed]').innerText,text:r.querySelector('[data-testid=report-concept-text]').innerText,clips:[...r.querySelectorAll('[data-testid=report-clips] a')].map(a=>({text:a.innerText.replace(/\\s+/g,' ').trim(),href:a.getAttribute('href')}))}))`)
  const a3c = a3.find((r) => r.id === 'm-concept-c'), a3a = a3.find((r) => r.id === 'm-concept-a')
  ok('A3 shows Said · Did · Showed with each base, the accepted line, and up to three first reactions with Play', a3.length === 2 && a3c.said === '7 of 20' && a3c.did === '7 of 20' && a3c.showed === '5 of 15' && /^Cookie Dough Crunch drew the warmest first reaction for 5 of 15 on video, and 7 of 20/.test(a3c.text) && a3a.said === '8 of 20' && a3a.did === '10 of 20' && a3a.showed === '1 of 15' && a3c.clips.length === 3 && a3c.clips.every((c) => /reads as (delight|interest)/.test(c.text) && /at=\d+/.test(c.href)), a3)
  ok('a line that is not accepted is not in A3', !a3.some((r) => r.id === 'm-concept-b'))

  // ── Pet Food: no choice task, nothing to compare yet ──
  await fresh(PET)
  const pHead = await ev(`[...document.querySelector('[data-testid=concept-head]').children].map(e=>e.innerText.trim())`)
  ok('with no choice task the Did column is hidden: Concept, Said, Showed, Match, Status', JSON.stringify(pHead) === JSON.stringify(['Concept', 'Said', 'Showed', 'Match', 'Status']) && (await count('[data-testid=cell-did]')) === 0, pHead)
  ok('and one grey line says why', /Did isn’t shown: this study had no choice task\./.test((await text('[data-testid=concepts-note]')) ?? ''))
  const pet = await ev(`[...document.querySelectorAll('[data-testid=concept-row]')].map(r=>({said:r.querySelector('[data-testid=cell-said]').innerText.trim(),showed:r.querySelector('[data-testid=cell-showed]').innerText.replace(/\\s+/g,' ').replace(' (highest)','').trim(),match:r.querySelector('[data-testid=match-chip]').dataset.match,status:r.querySelector('[data-testid=status-chip]').dataset.status,line:r.querySelector('[data-testid=concept-line]').innerText.trim(),hasAccept:!!r.querySelector('[data-testid=row-accept]')}))`)
  ok('only Pause has a Said (its code is accepted), the others show a dash, and nothing can be accepted yet', pet[0].said === '6 of 20' && pet[1].said === '—' && pet[2].said === '—' && pet.every((p) => p.match === 'Not enough' && p.status === 'Nothing to decide' && !p.hasAccept), pet)
  ok('each concept says in plain words what it is waiting on', /^Waiting on the codebook: accept /.test(pet[0].line) && /^Accept “Recipe swap appeals” in the codebook to read what people said\.$/.test(pet[1].line), pet.map((p) => p.line))
  await open('Recipe swap guarantee')
  ok('its panel has Accept and Edit off, with the reason, and Leave out needs a reason', (await ev(`document.querySelector('[data-testid=accept]').disabled&&document.querySelector('[data-testid=edit]').disabled`)) && /two of Said, Did and Showed/.test((await ev(`[...document.querySelectorAll('[data-testid=actions] [role=tooltip]')].map(e=>e.textContent).join(' ')`)) ?? ''))
  await click('[data-testid=leave-out]')
  ok('leaving out without a reason is not possible', await ev(`document.querySelector('[data-testid=leave-confirm]').disabled`))
  ok('the panel has one tile (no Did, and Said waits on its code), and Showed is “of 14 on video” for the concept seen by 19', (await count('[data-testid=measure-tiles] > button')) === 1 && /3 Showed of 14 on video/.test((await text('[data-testid=fig-showed]')) ?? ''))

  // ── text signals in the code panel (Themes tab) ──
  await fresh(ICE, 'themes')
  await ev(`document.querySelector('[data-testid=expand-all]').click(); true`); await b.sleep(300)
  await ev(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Worried it would be too sweet/.test(r.innerText)).click(); true`); await b.sleep(400)
  const obs = await ev(`['hedged','raised'].map(k=>{const e=document.querySelector('[data-testid=signal-panel] [data-testid=observation-'+k+']');return {k,n:+e.dataset.n,of:+e.dataset.of,text:e.querySelector('[data-testid=observation-count]').innerText}})`)
  const obsWant = await run(`const doc=cb.getCodebook(study); const c=doc.codes.find(x=>x.id==='ic-sweet-worry'); const t=cn.textSignalsOf(c,doc,basis); return [t.hedged,t.raised]`, 'ice-cream-flavours')
  ok('the code panel shows “Hedged n of N people” and “Raised before asked n of N people”, from the logic, as observations only', obs.length === 2 && obs.every((o, i) => o.n === obsWant[i].n && o.of === obsWant[i].of && o.text === `${o.n} of ${o.of} people`) && obs[1].n === 2, [obs, obsWant])
  const verdictBefore = await ev(`document.querySelector('[data-testid=signal-row][aria-current=true] [data-verdict-chip]').dataset.verdictChip`)
  ok('they sit in the panel only, and the row’s verdict is the speech verdict', !!verdictBefore && !/Hedged|Raised before asked/.test((await text('[data-testid=themes-table]')) ?? ''))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 CONCEPTS TAB FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A2 CONCEPTS TAB OK')
