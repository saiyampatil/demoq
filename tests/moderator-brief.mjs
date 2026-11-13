// The moderator's session brief as a preparation document: stimulus cards inline and in the session's own order, probes, what
// the AI already did for a session continued from AI, the human opening script, seeded dates that are never in the past,
// and print behaviour.
//   npx vite --port 5199 --strictPort &   then   node tests/moderator-brief.mjs
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
const as = async (id) => { await b.evaluate(`localStorage.setItem('pulseai-qual:moderator-view-as', ${JSON.stringify(id)}); true`) }
const brief = async (sid) => { await b.goto(`/moderator/sessions/${sid}/brief`); await b.waitFor('Session brief'); await b.sleep(450) }
const ASSIGNED = { 'P-9101-1': 'ABC', 'P-9102-1': 'BCA', 'P-9103-1': 'CAB' } // from the seeded plans

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await as('u-jordan')

  // ═══ A new, human-led session (P-9102) ═══
  await brief('P-9102-1')
  const cards = await b.evaluate(`[...document.querySelectorAll('[data-testid=stimulus-card]')].map(c=>({name:c.dataset.stimulus,pos:Number(c.dataset.position),inQuestion:!!c.closest('[data-testid=brief-question]'),inGuide:!!c.closest('[data-testid=brief-guide]'),text:c.innerText.replace(/\\s+/g,' ')}))`)
  const letters = cards.map((c) => c.name.match(/^Concept (\w)/)?.[1]).join('')
  ok('stimulus cards are in the participant’s assigned order (B, C, A), numbered 1 to 3', letters === ASSIGNED['P-9102-1'] && cards.map((c) => c.pos).join('') === '123', cards.map((c) => c.name))
  ok('they sit inside the guide, at their question, and there is no top block of stimuli', cards.length === 3 && cards.every((c) => c.inQuestion && c.inGuide) && (await count('[data-testid=brief-stimuli]')) === 0)
  ok('each card says Stimulus n of 3, has a thumbnail, a description and the first-reaction rule', cards.every((c, i) => new RegExp(`Stimulus ${i + 1} of 3`, 'i').test(c.text) && /Ask for the first reaction before describing it/.test(c.text) && c.text.length > 90) && (await count('[data-testid=stimulus-card] [role=img]')) === 3, cards[0]?.text)
  const qOrder = await b.evaluate(`[...document.querySelectorAll('[data-testid=brief-question]')].filter(q=>q.querySelector('[data-testid=stimulus-card]')).map(q=>{const m=q.innerText.match(/Here is (Concept \\w)/);return m&&m[1]})`)
  ok('the question beside each card names that same concept', qOrder.map((x) => x?.slice(-1)).join('') === 'BCA', qOrder)
  const header = (await text('[data-testid=brief-counts]')) ?? ''
  ok('the header has one line for the order only: "3 stimuli, assigned order: B, C, A"', /3 stimuli, assigned order: B, C, A/.test(header), header)
  const musts = await b.evaluate(`[...document.querySelectorAll('[data-testid=brief-question]')].filter(q=>/Must cover/.test(q.innerText)).length`)
  ok('must-cover is marked inline and counted once in the header; there is no separate list', Number(header.match(/(\d+) must-cover/)?.[1]) === musts && musts > 3 && (await count('[data-testid=brief-must]')) === 0, { header, musts })
  const probes = await b.evaluate(`(()=>{const qs=[...document.querySelectorAll('[data-testid=brief-question]')];return {withProbes:qs.filter(q=>q.querySelector('[data-testid=brief-probes]')).length,without:qs.filter(q=>!q.querySelector('[data-testid=brief-probes]')&&!/Done by AI/.test(q.innerText)).length,label:[...document.querySelectorAll('[data-testid=brief-probes] p')].every(p=>p.innerText.trim().toLowerCase()==='probes'),sample:document.querySelector('[data-testid=brief-probes]')?.innerText}})()`)
  ok('probes show under questions that have them, labelled Probes; questions without any show no label', probes.withProbes >= 5 && probes.without >= 1 && probes.label, probes)

  // ═══ The opening script ═══
  const all = (await text('[data-testid=session-brief]')) ?? ''
  const first = await b.evaluate(`document.querySelector('[data-testid=brief-question]').innerText.replace(/\\s+/g,' ')`)
  ok('a human moderator gets the human opening, with their first name', /Hi, I’m Jordan\. Thanks for joining\. This conversation is recorded, there are no right or wrong answers, and you can ask me to repeat, skip or pause at any time/.test(first), first)
  ok('and the AI phrasing never appears', !/AI interviewer|conversation with an AI|I’m an AI/i.test(all) && !/\bAI\b/.test(all.replace(/Done by AI|Shown by AI|Continued from AI/g, '')), all.match(/.{20}\bAI\b.{20}/)?.[0])
  ok('a new session shows none of the continued-from-AI marks', (await count('[data-testid=continued-banner]')) === 0 && (await count('[data-testid=done-by-ai]')) === 0 && (await count('[data-testid=start-here]')) === 0 && (await count('[data-testid=shown-by-ai]')) === 0)

  // ═══ Continued from AI (P-9101) ═══
  await brief('P-9101-1')
  const banner = (await text('[data-testid=continued-banner]')) ?? ''
  ok('the banner says Continued from AI, what the AI covered, where it stopped and where to start', /Continued from AI/.test(banner) && /The AI covered .+\./.test(banner) && /It stopped after Q\d+\./.test(banner) && /Start at (Section \d+|Q\d+, in Section \d+)\./.test(banner), banner)
  const qs = await b.evaluate(`[...document.querySelectorAll('[data-testid=brief-question]')].map(q=>({n:Number(q.dataset.q),done:q.dataset.done==='ai',start:q.dataset.start==='true',shown:q.innerText.length}))`)
  const doneCount = qs.filter((q) => q.done).length
  const startIdx = qs.findIndex((q) => q.start)
  ok('questions the AI completed are marked Done by AI', doneCount >= 3 && (await count('[data-testid=brief-question][data-done=ai] [data-testid=done-by-ai]')) === doneCount, { doneCount })
  ok('exactly one question is marked Start here, and it is the first one not done', qs.filter((q) => q.start).length === 1 && startIdx > 0 && !qs[startIdx].done && qs.slice(0, startIdx).every((q) => q.done), qs.map((q) => `${q.n}${q.done ? 'd' : ''}${q.start ? 's' : ''}`).join(' '))
  const collapsedLen = qs.find((q) => q.done).shown
  await b.evaluate(`document.querySelector('[data-testid=brief-question][data-done=ai] [data-testid=question-toggle], [data-testid=section-toggle]').click(); true`); await b.sleep(250)
  const hasContinuedHello = /I’m a researcher and I’ll take it from here\. We’ll pick up where you left off/.test((await text('[data-testid=session-brief]')) ?? '')
  ok('a continued session gets the "I’ll take it from here" opening', hasContinuedHello)
  const openLen = await b.evaluate(`Math.max(...[...document.querySelectorAll('[data-testid=brief-question][data-done=ai]')].map(q=>q.innerText.length))`)
  ok('done parts can be expanded to read what the AI asked', openLen > collapsedLen, { collapsedLen, openLen })
  const shownTag = await count('[data-testid=shown-by-ai]')
  ok('a stimulus the AI showed is tagged Shown by AI and left out of the remaining order', shownTag === 0 ? !/Shown by AI/.test((await text('[data-testid=brief-order]')) ?? '') : /Shown by AI/.test((await text('[data-testid=brief-order]')) ?? '') && /\d stimuli? left/.test((await text('[data-testid=brief-order]')) ?? ''), await text('[data-testid=brief-order]'))

  // ═══ No stimuli ═══
  await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));const d=s.fieldworks['pet-food-churn'];d.sessions.filter(x=>x.participantId==='P-9102').forEach(x=>{x.stimulusPlan.names=[];x.stimulusPlan.order=[]});localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await brief('P-9102-1')
  ok('a session with no stimuli has no cards and no order line', (await count('[data-testid=stimulus-card]')) === 0 && !/stimuli/.test((await text('[data-testid=brief-counts]')) ?? ''))

  // ═══ Dates ═══
  await b.goto('/moderator/sessions?tab=upcoming'); await b.waitFor('My sessions'); await b.sleep(500)
  const now = await b.evaluate('Date.now()')
  const slots = await b.evaluate(`[...document.querySelectorAll('[data-testid=upcoming-row] [data-slot]')].map(e=>Date.parse(e.dataset.slot))`)
  ok('every seeded upcoming session is in the future by the real clock: about +1 hour, +4 hours, tomorrow, the day after', slots.length === 4 && slots.every((t) => t > now) && slots[0] - now < 90 * 60e3 && slots[1] - now < 5 * 3600e3 && slots[1] - now > 3 * 3600e3, slots.map((t) => ((t - now) / 3600e3).toFixed(1)))
  // A record dated on an earlier day is dated again, and nothing is added twice.
  await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));const d=s.fieldworks['pet-food-churn'];d.modDay='2020-01-01';d.sessions.filter(x=>/^P-9[12]/.test(x.participantId)&&x.slot).forEach(x=>{x.slot='2020-01-01T10:00:00.000Z'});localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await b.goto('/moderator/sessions?tab=upcoming'); await b.waitFor('My sessions'); await b.sleep(600)
  const again = await b.evaluate(`[...document.querySelectorAll('[data-testid=upcoming-row] [data-slot]')].map(e=>Date.parse(e.dataset.slot))`)
  const people = await b.evaluate(`JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['pet-food-churn'].sessions.filter(s=>/^P-9[12]/.test(s.participantId)).length`)
  ok('a record dated on an earlier day is dated again, never left in the past, and not duplicated', again.length === 4 && again.every((t) => t > Date.now()) && people === 8 + 3, { again: again.length, people })

  // ═══ Print ═══
  await brief('P-9101-1')
  const before = await b.evaluate(`[...document.querySelectorAll('[data-testid=brief-question][data-done=ai]')].filter(q=>q.innerText.length<80).length`)
  await b.evaluate(`window.dispatchEvent(new Event('beforeprint')); true`); await b.sleep(250)
  const during = await b.evaluate(`[...document.querySelectorAll('[data-testid=brief-question][data-done=ai]')].filter(q=>q.innerText.length<80).length`)
  await b.evaluate(`window.dispatchEvent(new Event('afterprint')); true`); await b.sleep(250)
  const afterN = await b.evaluate(`[...document.querySelectorAll('[data-testid=brief-question][data-done=ai]')].filter(q=>q.innerText.length<80).length`)
  ok('printing opens every collapsed Done by AI part, and closing the dialog puts them back', before > 0 && during === 0 && afterN === before, { before, during, afterN })
  ok('Download brief is in the header and the print stylesheet hides buttons, navigation and floating controls', (await count('[data-testid=download-brief]')) === 1 && (await b.evaluate(`[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(r=>r.type===CSSRule.MEDIA_RULE&&/print/.test(r.conditionText||r.media.mediaText)&&/brief-root/.test(r.cssText))}catch(e){return false}})`)) && (await b.evaluate(`document.querySelector('header.sticky').className.includes('print:hidden')`)))
  const printable = await b.evaluate(`(()=>{window.print=()=>{window.__printed=true};document.querySelector('[data-testid=download-brief]').click();return !!window.__printed})()`)
  ok('Download brief opens the browser print dialog', printable)
  ok('the header carries study, participant, time, guide version and moderator for the paper copy', /Pet Food Subscription Churn/.test((await text('[data-testid=brief-title]')) ?? '') && /P-9101/.test((await text('[data-testid=brief-title]')) ?? '') && /Session: .*(EST|EDT)/.test((await text('[data-testid=brief-when]')) ?? '') && /Guide version \d+/.test((await text('[data-testid=brief-version]')) ?? '') && /Moderator Jordan Lee/.test((await text('[data-testid=brief-version]')) ?? ''), await text('[data-testid=brief-version]'))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('MODERATOR BRIEF FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('MODERATOR BRIEF OK')
