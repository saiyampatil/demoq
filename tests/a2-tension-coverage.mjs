// A2 Tensions: every group on every card is accounted for. The rows plus the "rest" lines add up to the group, from the sessions;
// excluded sessions never count; audio-only people are "not read", never neutral; a thin group gets an amber line.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-tension-coverage.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const card = (kindRe) => `[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/${kindRe}/.test(c.innerText))`

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(900)

  // ═══ The logic: for every card, row + rest = group ═══
  const data = await b.evaluate(MOD + `; (async()=>{
    const sg=await window.__mod('/src/state/signals'); const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const rv=await window.__mod('/src/mock/review'); const sess=await window.__mod('/src/mock/sessions'); const em=await window.__mod('/src/mock/emotion'); const cm=await window.__mod('/src/mock/codebook')
    const doc=Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
    const parts=ms.ACCEPTED_PARTICIPANTS
    const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
    const basis=cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
    const t=sg.tensionsOf(doc,basis)
    const excluded=sess.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant)
    const cat=[...basis.participants].filter(p=>cm.petOf(p)==='Cat').length, dog=[...basis.participants].filter(p=>cm.petOf(p)==='Dog').length
    const pause=[...cb.peopleOf(doc.codes.find(c=>c.id==='c-idea-pause'),basis)]
    return {
      accepted: parts.length, excluded, excludedInBasis: excluded.filter(p=>basis.participants.has(p)), cat, dog,
      audioOnly: pause.filter(p=>!em.hasVideo(p)).length,
      cards: t.map(x=>({id:x.id,sides:x.sides.map(s=>({n:s.n,of:s.of,rest:(s.rest??[]).map(r=>({label:r.label,n:r.n,of:r.of,missing:!!r.missing}))})),coverage:x.coverage??[],summary:x.summary,title:x.title}))
    }
  })()`)
  const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]))
  const adds = (side) => side.n + (side.rest ?? []).reduce((n, r) => n + r.n, 0)
  const seg = byId['tn-pet-segments']
  ok('cat vs dog: flexibility + price + no clear lean add up to each group (4+1+3 of 8, 3+5+4 of 12)', adds(seg.sides[0]) + seg.sides[1].n === seg.sides[0].of && adds(seg.sides[2]) + seg.sides[3].n === seg.sides[2].of && seg.sides[0].rest[0].n === 3 && seg.sides[2].rest[0].n === 4 && seg.sides[0].of === 8 && seg.sides[2].of === 12, seg.sides)
  const funnel = data.cards.filter((c) => c.id !== 'tn-pet-segments').flatMap((c) => c.sides.filter((s) => s.rest.length).map((s) => ({ id: c.id, s })))
  ok('every other card’s “of those” row plus its other lines equals its group', funnel.length >= 4 && funnel.every((f) => adds(f.s) === f.s.of), funnel.map((f) => `${f.id}: ${adds(f.s)}/${f.s.of}`))
  ok('excluded sessions are never in a group: groups sum to the accepted people only', data.excluded.length === 2 && data.excludedInBasis.length === 0 && data.cat + data.dog === data.accepted && seg.sides[0].of + seg.sides[2].of === data.accepted, { excluded: data.excluded, cat: data.cat, dog: data.dog, accepted: data.accepted })
  const face = byId['tn-pause-portion-face']
  const audio = face.sides[0].rest.find((r) => /Audio-only/.test(r.label))
  ok('audio-only people get their own “no face read” line, and are not in any neutral or other-reading line', data.audioOnly === 3 && audio?.n === data.audioOnly && audio.missing && face.sides[0].n + audio.n === face.sides[0].of && face.sides[1].of === face.sides[0].n && !face.sides[1].rest.some((r) => /audio/i.test(r.label)) && adds(face.sides[1]) === face.sides[1].of, face.sides)
  const survey = byId['tn-pause-survey']
  ok('said vs survey: “Answered another way” is gone; there is “Answered positively” and “No clear survey answer”, and they and the no answers add up to the group of 6', !survey.sides[1].rest.some((r) => /another way/.test(r.label)) && survey.sides[1].rest.every((r) => /^(Answered positively|No clear survey answer)$/.test(r.label)) && survey.sides[1].rest.every((r) => r.n > 0) && adds(survey.sides[1]) === 6, survey.sides[1])
  ok('wording never says “the other group” or implies the rest chose the opposite', !data.cards.some((c) => /the other group|everyone else chose|the rest chose/i.test(c.summary + c.title)), seg.summary)

  // ═══ The screen ═══
  const segText = await b.evaluate(`(()=>{const c=${card('Between segments')};const rest=[...c.querySelectorAll('[data-testid=segment-rest]')].map(r=>r.innerText.replace(/\\s+/g,' '));return {rest,cov:[...c.querySelectorAll('[data-testid=tension-coverage]')].map(x=>x.innerText),grey:!!c.querySelector('[data-testid=segment-rest] .bg-mist-strong')&&!c.querySelector('[data-testid=segment-rest] .bg-iris-300')&&!c.querySelector('[data-testid=segment-rest] .bg-ink'),text:c.innerText.replace(/\\s+/g,' ')}})()`)
  ok('cat vs dog shows “No clear lean or didn’t say: 3 of 8” and “4 of 12”, in neutral grey', segText.rest.length === 1 && /No clear lean or didn’t say 3 of 8 4 of 12/.test(segText.rest[0]) && segText.grey, segText)
  ok('the group over a third unaccounted (cats, 3 of 8) gets the amber line; dogs (exactly a third) don’t', segText.cov.length === 1 && /Cat owners\. Based on 5 of 8 people\. Read it as a prompt to look\./.test(segText.cov[0]), segText.cov)
  const faceText = await b.evaluate(`(()=>{const c=${card('Said vs emotion')};return {rest:[...c.querySelectorAll('[data-testid=side-rest-line]')].map(r=>r.innerText.replace(/\\s+/g,' ')),cov:[...c.querySelectorAll('[data-testid=tension-coverage]')].map(x=>x.innerText)}})()`)
  ok('the face card shows the audio-only line and an amber “Based on 3 of 6 people”', faceText.rest.some((r) => /Audio-only, so no face read 3 of 6/.test(r)) && faceText.cov.some((c) => /Based on 3 of 6 people\. Read it as a prompt to look\./.test(c)), faceText)
  const surveyText = await b.evaluate(`(()=>{const c=[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs survey/.test(c.innerText)&&/pause/i.test(c.innerText));return {rest:[...c.querySelectorAll('[data-testid=side-rest-line]')].map(r=>r.innerText.replace(/\\s+/g,' ')),cov:c.querySelectorAll('[data-testid=tension-coverage]').length}})()`)
  ok('the survey card shows the two lines in words, and no “another way”', surveyText.rest.length >= 1 && surveyText.rest.every((r) => /^(Answered positively|No clear survey answer) \d+ of 6$/.test(r)) && !surveyText.rest.some((r) => /another way/.test(r)), surveyText)

  // ═══ Types: only real, distinct ones ═══
  const opts = await b.evaluate(`[...document.querySelectorAll('select option')].filter(o=>/Said vs|Between|All types/.test(o.textContent)).map(o=>o.textContent.trim())`)
  ok('“Said vs behaviour” is nowhere: not in the type filter, not on a card, not in the data', !opts.some((o) => /behaviour/i.test(o)) && !(await b.evaluate(`/Said vs behaviour/.test(document.body.innerText)`)) && !data.cards.some((c) => c.id === 'tn-flex-behaviour') && (await b.evaluate(MOD + `; (async()=>{const m=await window.__mod('/src/mock/signals');return m.TENSION_KINDS.includes('Said vs behaviour')||m.TENSION_DEFS.some(d=>d.kind==='Said vs behaviour')})()`)) === false, opts)
  ok('the type filter starts with All types, then only types that have cards, the one with most first, each with its count', opts[0] === 'All types' && opts.length === 5 - 1 + 1 - 1 + 1 - 1 + 1 && opts.slice(1).every((o) => /\(\d+\)$/.test(o)) && opts.slice(1).map((o) => +o.match(/\((\d+)\)$/)[1]).every((n, i, a) => i === 0 || a[i - 1] >= n), opts)
  ok('“Said vs emotion” and “Between concepts” are told apart by name in the filter: face at another concept, hesitation at the chosen concept', opts.some((o) => /^Said vs emotion · face at another concept/.test(o)) && opts.some((o) => /^Between concepts · hesitation at the chosen concept/.test(o)), opts)
  await b.evaluate(`document.querySelector('[data-testid=tf-All]').click(); true`); await b.sleep(300)
  const descr = await b.evaluate(`Object.fromEntries([...document.querySelectorAll('[data-testid=tension-card]')].map(c=>[c.dataset.kind+'|'+c.querySelector('h3').innerText.slice(0,12),c.querySelector('h3').nextElementSibling.innerText]))`)
  const face2 = Object.entries(descr).find(([k]) => /^Said vs emotion/.test(k))[1]
  const conc = Object.entries(descr).find(([k]) => /^Between concepts/.test(k))[1]
  ok('each of the two says exactly what it compares: a face at a different concept, versus hesitation at the same concept', /face at another concept|different concept/.test(face2) && /same concept/.test(conc) && face2 !== conc, [face2, conc])
  ok('they are different comparisons in the data: one reads a face at Concept C, the other hesitation at Concept A', await b.evaluate(MOD + `; (async()=>{const m=await window.__mod('/src/mock/signals');const f=m.TENSION_DEFS.find(d=>d.id==='tn-pause-portion-face'),c=m.TENSION_DEFS.find(d=>d.id==='tn-pause-concept');return f.momentId==='m-concept-c'&&c.momentId==='m-concept-a'&&f.kind!==c.kind})()`))

  // ═══ Locked cards never count as To review ═══
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const c=o[id].codes.find(c=>c.id==='c-idea-pause');c.status='Suggested';localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(900)
  const counts = await b.evaluate(`(()=>{const n=(k)=>+document.querySelector('[data-testid=tf-n-'+k+']').innerText;const badge=document.querySelector('[role=tab][aria-selected=true]')?.parentElement?.innerText;return {review:n('Suggested'),waiting:n('Waiting'),all:n('All'),badge:[...document.querySelectorAll('[role=tab]')].find(t=>/Tensions/.test(t.innerText)).innerText.replace(/\\s+/g,' '),foot:document.querySelector('[data-testid=report-footer-review]')?.innerText??document.body.innerText.match(/(\\d+) tensions? (?:still )?to review/)?.[0]}})()`)
  await b.evaluate(`document.querySelector('[data-testid=tf-Suggested]').click(); true`); await b.sleep(300)
  const reviewCards = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].map(c=>({w:c.dataset.waiting,s:c.dataset.status}))`)
  await b.evaluate(`document.querySelector('[data-testid=tf-Waiting]').click(); true`); await b.sleep(300)
  const waitCards = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].map(c=>({w:c.dataset.waiting,banner:/Accept “.*” in the codebook to review this\./.test(c.innerText),dim:c.className.includes('bg-paper')}))`)
  ok('with a code not accepted, the undecided cards that need it (2; the third was already added) are in “Waiting on codebook”, not in To review', counts.waiting === 2 && counts.review === 1 && reviewCards.every((c) => !c.w) && reviewCards.length === counts.review, { counts, reviewCards })
  ok('the waiting cards are dimmed and say which code to accept', waitCards.length === 2 && waitCards.every((c) => c.w === 'true' && c.banner && c.dim), waitCards)
  ok('the tab badge and the footer count agree with To review, and leave the waiting ones out', new RegExp(`Tensions ${counts.review}$`).test(counts.badge) && new RegExp(`${counts.review} tensions? (?:still )?to review`).test(counts.foot ?? ''), counts)
  ok('All still lists every card, waiting ones included', counts.all === 5, counts)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 TENSION COVERAGE FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A2 TENSION COVERAGE OK')
