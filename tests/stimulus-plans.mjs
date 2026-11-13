// Even-split stimulus assignment and the moderator's session brief. The assignment rules run on synthetic sessions, so they are
// exact; the brief and the Fieldwork balance card are checked in the page.
//   npx vite --port 5199 --strictPort &   then   node tests/stimulus-plans.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const count = (sel) => b.evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const as = async (id) => { await b.evaluate(`localStorage.setItem('pulseai-qual:moderator-view-as', ${JSON.stringify(id)}); true`) }

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/moderator/sessions?tab=upcoming'); await b.waitFor('My sessions'); await b.sleep(600)

  // ═══ The rules, on synthetic sessions ═══
  const rules = await withMod(`(async()=>{
    const sp = await window.__mod('/src/state/stimulusPlans')
    const items = (n) => Array.from({length:n},(_,i)=>({id:'s'+i,name:'Stimulus '+i,kind:'concept',active:true}))
    const sess = (id, plan, extra={}) => ({ id, participantId:id, status:'Booked', access:'Consented', stimuli:[], stimulusPlan: plan && {...plan, guideVersion:1, segment: extra.segment ?? 'All participants', assignedAt:'x'}, ...extra })
    const fill = (plans, n, segment) => { const ss=[]; for (let i=0;i<n;i++){ const p = sp.pickPlan(plans, ss, segment ?? 'All participants'); ss.push(sess('p'+i, p, segment?{segment}:{})) } return ss }
    const tally = (ss, n) => { const saw={}, first={}; ss.forEach(s=>{ s.stimulusPlan.order.forEach(id=>saw[id]=(saw[id]??0)+1); first[s.stimulusPlan.order[0]]=(first[s.stimulusPlan.order[0]]??0)+1 }); return {saw:Object.values(saw), first:Object.values(first), kinds:Object.keys(saw).length} }
    // 1. 10 stimuli, everyone sees all, rotated: 10 plans; 10 people see each equally and see each first equally.
    const rot = sp.buildPlans(items(10), {mode:'all', rotate:true})
    const a = tally(fill(rot,10),10)
    // 2. split into 2 groups of 5, rotated: 10 plans; 10 people: each seen by 5, each first once.
    const split = sp.buildPlans(items(10), {mode:'split', groups:2, rotate:true})
    const c = tally(fill(split,10),10)
    // 3. Uneven split is a problem; an even one is not; "each person sees" works too.
    const bad = [sp.assignmentProblem({mode:'split',groups:3,rotate:false},10), sp.assignmentProblem({mode:'split',perPerson:3,rotate:false},10), sp.assignmentProblem({mode:'split',groups:5,rotate:false},10), sp.assignmentProblem({mode:'split',perPerson:2,rotate:true},10)]
    // 4. A cancelled or no-show person releases their plan, unless a stimulus was already shown.
    const plans = sp.buildPlans(items(3), {mode:'all', rotate:true})
    const three = fill(plans,3)
    const released = three.map((s,i)=> i===1 ? {...s, access:'No-show'} : s)
    const re = sp.pickPlan(plans, released, 'All participants')
    const spent = three.map((s,i)=> i===1 ? {...s, access:'No-show', stimuli:[{name:'Stimulus 0',result:'Shown'}]} : s)
    const re2 = sp.pickPlan(plans, spent, 'All participants')
    const cancelled = three.map((s,i)=> i===2 ? {...s, escalation:{status:'Cancelled by participant'}} : s)
    const excluded = sp.pickPlan(plans, three.map((s,i)=> i===0 ? {...s, validationStatus:'Excluded'} : s), 'All participants')
    // 5. A replacement takes over the replaced person's plan.
    const inherit = sp.inheritablePlan(released)
    const none = sp.inheritablePlan(spent)
    // 6. Segments balance on their own.
    const seg = [...fill(plans,3,'North'), ...fill(plans,1,'South')]
    const nextSouth = sp.pickPlan(plans, seg, 'South'), nextNorth = sp.pickPlan(plans, seg, 'North')
    // 7. A reschedule keeps the plan, and a person with none gets one when there are plans to give.
    const has = sess('x', plans[1])
    const kept = sp.planned(has, plans, three, 1, 'now') === has
    const given = sp.planned({...sess('y', null)}, plans, three, 1, 'now').stimulusPlan
    // 8. Balance: uneven warning and the unfilled line, from the sessions.
    const two = sp.buildPlans(items(2), {mode:'split', groups:2, rotate:false})
    const lopsided = [0,1,2].map(i=>sess('l'+i, two[0]))
    const bal = sp.balanceOf(two, lopsided)
    const few = sp.balanceOf(two, [sess('only', two[0])])
    const balanced = sp.balanceOf(two, [sess('a',two[0]), sess('b',two[1])])
    return { rotN: rot.length, a, splitN: split.length, c, bad, re: re.id, gone: three[1].stimulusPlan.id, re2: re2.id, cancelledPick: sp.pickPlan(plans, cancelled, 'All participants').id, cancelledGone: three[2].stimulusPlan.id, excluded: excluded.id, exGone: three[0].stimulusPlan.id, inherit: inherit && {id: inherit.id, from: inherit.inheritedFrom}, none: none ?? null, nextSouth: nextSouth.id, nextNorth: nextNorth.id, southHolds: seg.filter(s=>s.segment==='South').map(s=>s.stimulusPlan.id), northHolds: seg.filter(s=>s.segment==='North').map(s=>s.stimulusPlan.id), kept, given: given?.id, uneven: !!bal[0].uneven, unfilled: !!few[0].unfilled, even: !balanced[0].uneven }
  })()`)
  ok('10 stimuli, everyone sees all, rotated: 10 plans', rules.rotN === 10, rules.rotN)
  ok('10 participants: each stimulus is seen by all 10 and first by exactly 1', rules.a.kinds === 10 && rules.a.saw.every((n) => n === 10) && rules.a.first.length === 10 && rules.a.first.every((n) => n === 1), rules.a)
  ok('split into 2 groups of 5, rotated: 10 plans; 10 participants: each stimulus seen by 5 and first by 1', rules.splitN === 10 && rules.c.kinds === 10 && rules.c.saw.every((n) => n === 5) && rules.c.first.length === 10 && rules.c.first.every((n) => n === 1), rules.c)
  ok('an uneven split is a problem (10 into 3, 3 each, 5 groups… only 5 groups works) and an even one is not', !!rules.bad[0] && !!rules.bad[1] && rules.bad[2] === null && rules.bad[3] === null, rules.bad)
  ok('a no-show releases their plan; so does a cancellation and an exclusion', rules.re === rules.gone && rules.cancelledPick === rules.cancelledGone && rules.excluded === rules.exGone, rules)
  ok('but a plan whose stimulus was already shown stays counted', rules.re2 !== rules.gone, rules)
  ok('a replacement inherits the released plan, and nothing is left to inherit once it was shown', rules.inherit?.id === rules.gone && !!rules.inherit?.from && rules.none === null, rules.inherit)
  ok('segments balance separately: each continues from its own count', rules.nextSouth.startsWith('g1-r1') && rules.nextNorth.startsWith('g1-r0') && rules.southHolds.length === 1 && rules.northHolds.length === 3, rules)
  ok('a reschedule keeps the plan; a person without one is given one', rules.kept && !!rules.given, rules)
  ok('the balance warns when any stimulus differs by more than 1, and says when a segment can’t fill every plan', rules.uneven && rules.unfilled && rules.even, rules)

  // ═══ A study that doesn’t split behaves as before ═══
  const same = await withMod(`(async()=>{
    const fw = await window.__mod('/src/state/fieldwork')
    const raw = JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['pet-food-churn']
    const before = raw.sessions.filter(s=>s.stimulusPlan).length
    const after = fw.assignPlans(raw).sessions.filter(s=>s.stimulusPlan).length
    return { before, after, hasPlans: !!raw.plan.stimulusPlans }
  })()`)
  ok('a study with the default setting compiles no plans and assigns none', same.hasPlans === false && same.before === same.after, same)
  await b.goto('/researcher/studies/pet-food-churn/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(500)
  ok('Fieldwork shows no balance card for it', (await count('[data-testid=stimulus-balance]')) === 0)

  // The balance card appears once the release splits or rotates: give the pet study the three rotations its seeded sessions hold.
  await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));const d=s.fieldworks['pet-food-churn'];const names=[...new Set(d.plan.sections.flatMap(x=>x.items.map(i=>i.stimulus)).filter(Boolean))].filter(n=>/^Concept/.test(n));d.plan.stimulusPlans=[0,1,2].map(r=>{const o=[...names.slice(r),...names.slice(0,r)];return {id:'g1-r'+r,group:1,order:o,names:o}});localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await b.goto('/researcher/studies/pet-food-churn/fieldwork/command-center'); await b.waitFor('Stimulus balance'); await b.sleep(400)
  const rowsOf = await b.evaluate(`[...document.querySelectorAll('[data-testid=balance-row]')].map(r=>({n:r.dataset.stimulus,saw:Number(r.dataset.saw),first:Number(r.dataset.first)}))`)
  ok('Fieldwork shows the balance per stimulus: people and seen first, for the sessions that hold a plan', rowsOf.length === 3 && rowsOf.every((r) => r.saw === 8) && rowsOf.reduce((n, r) => n + r.first, 0) === 8, rowsOf)
  ok('even here, so no warning', (await count('[data-testid=balance-warning]')) === 0)
  await withMod(`(async()=>{})()`)
  await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));const d=s.fieldworks['pet-food-churn'];d.sessions.filter(x=>['P-9102','P-9202'].includes(x.participantId)).forEach(x=>{x.access='No-show'});localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await b.goto('/researcher/studies/pet-food-churn/fieldwork/command-center'); await b.waitFor('Stimulus balance'); await b.sleep(400)
  const after = await b.evaluate(`[...document.querySelectorAll('[data-testid=balance-row]')].map(r=>Number(r.dataset.saw))`)
  ok('two no-shows leave the balance: their plans are released', after.every((n) => n === 6), after)

  // ═══ The Stimuli step: the setting and the lock ═══
  const blockers = await withMod(`(async()=>{
    const g = await window.__mod('/src/state/guide')
    const doc = JSON.parse(localStorage.getItem('pulseai-qual:v2')).guides['pet-food-churn']
    const split = { ...doc, stimuli: { ...doc.stimuli, assignment: { mode: 'split', groups: 2, rotate: false } } }
    const even = { ...doc, stimuli: { ...doc.stimuli, assignment: { mode: 'split', groups: 3, rotate: true } } }
    return { plain: g.approvalBlockers(doc, false).filter(x=>x.startsWith('Stimuli')), uneven: g.approvalBlockers(split, false).filter(x=>x.startsWith('Stimuli')), even: g.approvalBlockers(even, false).filter(x=>x.startsWith('Stimuli')) }
  })()`)
  ok('the guide can’t be locked on an uneven split, and can on an even one', blockers.plain.length === 0 && blockers.uneven.length === 1 && blockers.even.length === 0, blockers)
  await b.goto('/researcher/studies/pet-food-churn/guide/stimuli'); await b.waitFor('Stimulus library'); await b.sleep(500)
  ok('the setting is on the Stimuli step, defaulting to everyone sees all', (await count('[data-testid=assign-all][aria-checked=true]')) === 1 || (await count('[role=radio][aria-checked=true]')) >= 1)

  // ═══ The brief ═══
  await as('u-jordan')
  await b.goto('/moderator/sessions?tab=upcoming'); await b.waitFor('My sessions'); await b.sleep(500)
  ok('Upcoming rows have View brief', (await count('[data-testid=upcoming-row] [data-testid=view-brief]')) === 4)
  await b.goto('/moderator/sessions/P-9101-1/brief'); await b.waitFor('Session brief'); await b.sleep(400)
  const brief = (await text('[data-testid=session-brief]')) ?? ''
  const order1 = await b.evaluate(`[...document.querySelectorAll('[data-testid=stimulus-card]')].map(l=>l.dataset.stimulus)`)
  ok('the brief shows the objective, the guide version, sections with minutes, questions and a must-cover count', (await text('[data-testid=brief-objective]'))?.length > 40 && /Guide version 2/.test((await text('[data-testid=brief-version]')) ?? '') && (await count('[data-testid=brief-section]')) >= 3 && (await count('[data-testid=brief-question]')) >= 5 && /min/.test(brief) && /\d+ must-cover questions/.test(brief), brief.slice(0, 200))
  await b.goto('/moderator/sessions/P-9102-1/brief'); await b.waitFor('Session brief'); await b.sleep(400)
  const order2 = await b.evaluate(`[...document.querySelectorAll('[data-testid=stimulus-card]')].map(l=>l.dataset.stimulus)`)
  ok('stimulus cards sit in the guide in each participant’s own order', order1.length === 3 && order2.length === 3 && order1[0] !== order2[0] && (await count('[data-testid=stimulus-card] [role=img]')) === 3, { order1, order2 })
  const all = (await text('[data-testid=session-brief]')) ?? ''
  ok('the brief never shows screener answers, criteria, the balance table or other plans', !/screener|criteria|eligib|needs review|balance|seen first|P-9101|P-9103/i.test(all), all.match(/screener|criteria|eligib|needs review|balance|seen first|P-9101|P-9103/i)?.[0])
  await b.goto('/moderator/sessions/P-9103-1/brief'); await b.waitFor('Session brief'); await b.sleep(400)
  ok('a session booked under an earlier guide shows "Guide updated" with the version', /Guide updated to version 2/.test((await text('[data-testid=guide-updated]')) ?? ''))
  await b.goto('/moderator/sessions/P-9101-1/brief'); await b.waitFor('Session brief'); await b.sleep(300)
  ok('and one booked under the current guide doesn’t', (await count('[data-testid=guide-updated]')) === 0)
  await as('tm-ravi')
  await b.goto('/moderator/sessions/P-9101-1/brief'); await b.waitFor('This brief isn’t available'); await b.sleep(200)
  ok('another moderator can’t open it', (await count('[data-testid=session-brief]')) === 0)
  await as('u-jordan')
  await b.goto('/moderator/sessions?tab=requests'); await b.waitFor('My sessions'); await b.sleep(500)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=request-row] button')].find(x=>x.innerText.trim()==='Details')?.click(); true`); await b.sleep(500)
  ok('the Requests details drawer has View brief', (await count('[data-testid=rq-drawer] [data-testid=view-brief]')) === 1)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('STIMULUS PLANS FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('STIMULUS PLANS OK')
