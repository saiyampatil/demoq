// A3 executive summary: at most six sentences, each one claim and short, numbers from approved codes and accepted sessions only,
// tension sentences only for tensions added as a theme, and the calmer layout.
//   npx vite --port 5199 --strictPort &   then   node tests/a3-exec-summary.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const STUDY = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const count = (sel) => b.evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
// Everything the summary says, from the page's own modules: the codebook, the accepted people, and a function to render it with a given basis.
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const rl=await window.__mod('/src/state/reportLogic'); const ex=await window.__mod('/src/state/execSummary')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
  const render=(doc,basis)=>ex.execDraft({doc,basis}).map(s=>({id:s.id,text:rl.renderTemplate(s.template,{doc,basis}),cites:s.cites.length}))`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const wordsOf = (t) => t.trim().split(/\s+/).length
const figures = (t) => (t.match(/\d+ of (?:the )?\d+/g) ?? []).length
const read = async () => b.evaluate(`[...document.querySelectorAll('[data-testid=exec-card] [data-testid=sentence]')].map(s=>({id:s.dataset.id,state:s.dataset.state,dot:s.dataset.dot,text:s.querySelector('[data-testid=sentence-text]').innerText.replace(/\\s+/g,' '),hasDot:!!s.querySelector('[data-testid=state-dot]'),marks:[...s.querySelectorAll('[data-testid=cite-mark]')].map(m=>m.innerText.trim())}))`)

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${STUDY}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1500)

  // ═══ What it says today ═══
  const today = await read()
  ok('at most six sentences', today.length >= 3 && today.length <= 6, today.length)
  ok('no sentence is over 25 words', today.every((s) => wordsOf(s.text) <= 25), today.map((s) => wordsOf(s.text)))
  ok('no percent signs, no “the other group”', today.every((s) => !/%|the other group/i.test(s.text)))
  const close = today.find((s) => /close to even/.test(s.text))
  ok('one claim to a sentence: one “n of N”, except the close-to-even sentence, which gives two', today.every((s) => (s === close ? figures(s.text) === 2 : figures(s.text) <= 1)), today.map((s) => figures(s.text)))
  ok('flexibility 7 and price 6 are within one person, so it says close to even, gives both, and says how many gave no clear answer', !!close && /7 of 20 chose flexibility/.test(close.text) && /6 of 20 chose price/.test(close.text) && /7 gave no clear answer/.test(close.text) && !/mattered more/.test(close.text), close?.text)
  ok('the first sentence is the main reason people cancelled, with its own n of N, in two claims not one', /^The most often given reason for cancelling was “Price went up”: 8 of 20 people\.$/.test(today[0].text) && figures(today[0].text) === 1, today[0].text)
  ok('6 of 20 is not a majority, so the pause sentence never says “most people”', !today.some((s) => /\b(most people|majority)\b/i.test(s.text)) && today.some((s) => /6 of 20 people said pause would have kept them/.test(s.text)), today.map((s) => s.text))
  ok('“nothing would have kept them” is there, with 2 of 20 and no implication', today.some((s) => /^For 2 of 20 people, nothing the company could have done would have kept them\.$/.test(s.text)))
  ok('the evidence-strength sentence names the weak questions: “2 of 7 guide questions”', today.some((s) => /^Evidence is thin on 2 of 7 guide questions: “The delivery schedule”, “What would bring them back”\.$/.test(s.text)), today.at(-1)?.text)
  ok('every sentence has a state dot and at least one citation mark', today.every((s) => s.hasDot && s.marks.length === 1), today.map((s) => [s.hasDot, s.marks]))
  ok('two or more sources show one range mark such as 1–2, not separate numbers', today.some((s) => s.marks[0] === '1–2') && today.every((s) => s.marks.length === 1))
  ok('counts are from the 20 accepted sessions: no excluded person, and no figure above 20', (await run(`const excl=sess.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant);const basis=basisOf(ms.ACCEPTED_PARTICIPANTS);return {inBasis:excl.filter(p=>basis.participants.has(p)).length,N:basis.participants.size}`)).inBasis === 0 && today.every((s) => (s.text.match(/\d+ of (?:the )?(\d+)/g) ?? []).every((f) => Number(f.match(/(\d+)$/)[1]) <= 20)))

  // ═══ No tension sentence unless it was added as a theme ═══
  ok('5 suggested and 1 dismissed tensions: none of them is in the summary', today.every((s) => !s.id.startsWith('exec-tn-')) && !today.some((s) => /locked survey|marked hesitation|on video|cat owners/.test(s.text)), today.map((s) => s.id))
  const FACE = ['c-idea-pause']
  await b.evaluate(`${MOD}; (async()=>{const cb=await window.__mod('/src/state/codebook'); cb.updateCodebook('pet-food-churn', d=>cb.turnTensionIntoTheme(d,{id:'tn-pause-portion-face',title:'Picked pause in words'},${JSON.stringify(FACE)},'Pause in words, portions in the face','test',{by:'Maya Ortiz'}))})()`); await b.sleep(900)
  const added = await read()
  const face = added.find((s) => s.id === 'exec-tn-tn-pause-portion-face')
  ok('adding a tension as a theme adds its one sentence, and for a face tension says how many were on video', !!face && /^3 of 3 people on video who picked pause showed delight or interest at first sight of Concept C\.$/.test(face.text) && figures(face.text) === 1 && added.length === today.length + 1 && added.length <= 6, added.map((s) => s.text))
  ok('the new sentence is in the second paragraph group, before the evidence sentence', added.findIndex((s) => s.id === face.id) < added.findIndex((s) => s.id === 'exec-thin'))
  await b.evaluate(`${MOD}; (async()=>{const cb=await window.__mod('/src/state/codebook'); cb.updateCodebook('pet-food-churn', d=>cb.dismissTension(d,{id:'tn-pause-portion-face',title:'x'},{by:'Maya Ortiz'},'Too few to read'))})()`); await b.sleep(900)
  ok('dismissing it removes the sentence', (await read()).every((s) => s.id !== 'exec-tn-tn-pause-portion-face') && (await read()).length === today.length)
  await b.evaluate(`${MOD}; (async()=>{const cb=await window.__mod('/src/state/codebook'); cb.updateCodebook('pet-food-churn', d=>cb.restoreTension(d,{id:'tn-pause-portion-face',title:'x'},{by:'Maya Ortiz'}))})()`); await b.sleep(900)
  ok('restoring it only returns it to Suggested, so the summary still leaves it out', (await read()).every((s) => !s.id.startsWith('exec-tn-')))
  // Six at most, however many tensions are added.
  await b.evaluate(`${MOD}; (async()=>{const cb=await window.__mod('/src/state/codebook'); for (const [id,codes] of [['tn-pause-survey',['c-idea-pause']],['tn-flex-behaviour',['c-flex-first']],['tn-pause-portion-face',['c-idea-pause']],['tn-pause-concept',['c-idea-pause']],['tn-pet-segments',['c-flex-first','c-price-first']]]) cb.updateCodebook('pet-food-churn', d=>cb.turnTensionIntoTheme(d,{id,title:id},codes,'T '+id,'test',{by:'Maya Ortiz'}))})()`); await b.sleep(1000)
  const many = await read()
  ok('with every tension added there are still six sentences at most, and the evidence sentence is kept', many.length === 6 && many.at(-1).id === 'exec-thin', many.map((s) => s.id))

  // ═══ The rules, on other data ═══
  const most = await run(`const doc=store(); const rise=cb.peopleOf(doc.codes.find(c=>c.id==='c-price-rise'),cb.basisOf([]).participants?basisOf(ms.ACCEPTED_PARTICIPANTS):basisOf(ms.ACCEPTED_PARTICIPANTS)); const others=ms.ACCEPTED_PARTICIPANTS.filter(p=>!rise.has(p)).slice(0,2); const basis=basisOf([...rise,...others]); return {N:basis.participants.size, s:render(doc,basis)[0].text}`)
  ok('“most” only when n is more than half: 8 of 10 reads “Most people…”, 8 of 20 does not', most.N === 10 && /^Most people cancelled for one reason, “Price went up”: 8 of 10 people\.$/.test(most.s) && !/most people/i.test(today[0].text), most)
  const noWeak = await run(`const doc=JSON.parse(JSON.stringify(store())); doc.codes.forEach(c=>{if(c.status==='Suggested')c.status='Accepted'}); const skipped=new Set(rl.questionLabel?[]:[]); const asked=ms.ACCEPTED_PARTICIPANTS; const q=(await window.__mod('/src/state/codebook')).CODE_QUESTIONS; const skip=new Set(q.flatMap(x=>x.skipped.map(s=>s.participantId))); const basis=basisOf(asked.filter(p=>!skip.has(p))); const r=render(doc,basis); return {n:basis.participants.size, thin:r.some(s=>s.id==='exec-thin'), ids:r.map(s=>s.id)}`)
  ok('when no guide question is weak or unanswered the evidence sentence is left out, with no filler in its place', noWeak.thin === false && noWeak.ids.length >= 3, noWeak)

  // ═══ Layout ═══
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); true'); await b.goto(`${STUDY}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1500)
  const css = await b.evaluate(`(()=>{const p=document.querySelector('[data-testid=exec-paragraph]');const prose=document.querySelector('[data-testid=exec-card] [data-testid=prose]');const cs=getComputedStyle(p);const h=document.querySelector('[data-testid=exec-card] h2');const other=[...document.querySelectorAll('h2')].find(x=>/Findings by guide section/i.test(x.innerText));const unapp=document.querySelector('[data-testid=exec-card] [data-testid=sentence-text]');const card=document.querySelector('[data-testid=exec-card]');return {fs:cs.fontSize,lh:cs.lineHeight,gap:getComputedStyle(prose).rowGap,maxw:getComputedStyle(prose).maxWidth,counts:[...document.querySelectorAll('[data-testid=exec-paragraph]')].map(x=>Number(x.dataset.count)),h:getComputedStyle(h).fontSize,other:getComputedStyle(other).fontSize,deco:getComputedStyle(unapp).textDecorationLine,bg:getComputedStyle(unapp).backgroundColor,pad:getComputedStyle(card).padding,aiTags:document.querySelectorAll('[data-testid=exec-card] [data-testid=ai-generated], [data-testid=exec-card] header [aria-label*="AI"]').length,headerText:document.querySelector('[data-testid=exec-card] header').innerText,footer:document.querySelector('[data-testid=exec-card] footer').innerText.replace(/\\s+/g,' ')}})()`)
  ok('body text is 16px with line height 1.6 and about 68 characters wide', css.fs === '16px' && Math.abs(parseFloat(css.lh) - 25.6) < 0.6 && /68ch|\d+px/.test(css.maxw), css)
  ok('paragraphs hold at most two sentences, 12px apart', css.counts.length >= 2 && css.counts.every((n) => n >= 1 && n <= 2) && css.gap === '12px', css)
  ok('the heading is the same size as the page’s other section headings, and the card padding is 24px', css.h === css.other && css.pad === '24px', css)
  ok('an unapproved sentence has no dotted underline and no grey fill until hovered or selected', css.deco === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(css.bg), css)
  ok('the AI-generated tag is there once', (css.headerText.match(/AI-generated/gi) ?? []).length === 1 && (await count('[data-testid=exec-card] [data-testid=sentence] [data-testid=ai-generated]')) === 0, css.headerText)
  ok('the footer is one quiet line: “5 sentences · 0 approved”, All sources, then the toggle; no helper text on the AI draft', /5 sentences · 0 approved/.test(css.footer) && /All sources/.test(css.footer) && !/The report uses Mine/.test(css.footer), css.footer)
  await b.evaluate(`document.querySelector('[data-testid=exec-card] [data-testid=draft-researcher]').click(); true`); await b.sleep(400)
  const mine = await b.evaluate(`({footer:document.querySelector('[data-testid=exec-card] footer').innerText.replace(/\\s+/g,' '),tag:/AI-generated/i.test(document.querySelector('[data-testid=exec-card] header').innerText),add:!!document.querySelector('[data-testid=exec-card] [data-testid=add-sentence]')})`)
  ok('on Mine the helper reads “The report uses Mine.” and the AI tag goes', /The report uses Mine\./.test(mine.footer) && !mine.tag, mine)
  await b.evaluate(`document.querySelector('[data-testid=exec-card] [data-testid=draft-ai]').click(); true`); await b.sleep(300)

  // ═══ Publish ═══
  ok('Publish stays blocked until every sentence is approved: the primary button is Review, not Publish', /^Review \d+ sentences$/.test(await b.evaluate(`document.querySelector('[data-testid=primary-action]').innerText`)))
  // Approve every sentence of the summary only: the rest of the report still blocks it.
  for (let i = 0; i < 5; i++) {
    await b.evaluate(`document.querySelectorAll('[data-testid=exec-card] [data-testid=sentence-text]')[${i}].click(); true`); await b.sleep(250)
    await b.evaluate(`document.querySelector('[data-testid=exec-card] [data-testid=approve]')?.click(); true`); await b.sleep(250)
  }
  const after = await b.evaluate(`({count:document.querySelector('[data-testid=exec-count]').innerText.replace(/\\s+/g,' '),primary:document.querySelector('[data-testid=primary-action]').innerText})`)
  ok('approving the whole summary still leaves Publish blocked while findings are unapproved', /5 approved/.test(after.count) && /^Review \d+ sentences?$/.test(after.primary), after)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A3 EXEC SUMMARY FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A3 EXEC SUMMARY OK')
