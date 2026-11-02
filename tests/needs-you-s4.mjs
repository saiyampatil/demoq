// Needs you, row design: chips, time with zone, actions, order, the way into a session and back, the mock moderator no-show.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const out = {}
const rowsInfo = `[...document.querySelectorAll('#needs-you ul > li')].map(l=>({who:l.dataset.who||l.querySelector('a')?.innerText.trim(),kind:l.dataset.kind||l.dataset.testid,fault:l.querySelector('[data-testid=fault-chip]')?.dataset.fault,time:l.querySelector('[data-testid=needs-time]')?.innerText||'(clock line)',buttons:[...l.querySelectorAll('button')].map(x=>x.innerText.trim())}))`
const step = async (label) => { await b.evaluate(`[...document.querySelectorAll('[data-testid=needs-dev] button')].find(x=>x.innerText.trim()===${JSON.stringify(label)}).click(); true`); await b.sleep(500) }
const showAll = async () => { await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(250) }
const badge = `document.querySelector('#needs-you h2').innerText.replace(/\\s+/g,' ')`
try {
  // Before launch: sample data, no Give up anywhere.
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  out.sampleGiveUp = await b.evaluate(`[...document.querySelectorAll('#needs-you button')].filter(x=>x.innerText.includes('Give up')).length`)
  out.sampleActionsDisabled = await b.evaluate(`[...document.querySelectorAll('#needs-you ul > li button')].filter(x=>!/Show/.test(x.innerText)).every(x=>x.disabled)`)

  await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  out.firstShown = await b.evaluate(`document.querySelectorAll('#needs-you ul > li').length`)
  out.badgeSeed = await b.evaluate(badge)
  await showAll(); out.seedRows = await b.evaluate(rowsInfo)
  out.allCount = out.seedRows.length

  // Mock moderator no-show: becomes row 2, first among our-side rows, with Send booking link.
  await step('+2 h'); await b.evaluate(`document.querySelector('[data-testid=mock-moderator-no-show]').click(); true`); await b.sleep(500); out.noShowNotice = await b.evaluate(`document.querySelector('#needs-you [role=status]')?.innerText`); await showAll()
  const after = await b.evaluate(rowsInfo)
  out.order = after.map((r) => `${r.who}:${r.kind}:${r.fault}`)
  out.ourSideButtons = after.filter((r) => r.fault === 'Our side').map((r) => `${r.who} => ${r.buttons.join(' | ')}`)
  out.badgeAfter = await b.evaluate(badge)
  await b.evaluate(`document.getElementById('needs-you').scrollIntoView({block:'start'}); true`); await b.sleep(300)
  await b.shot('needs-you-s4')
  await b.viewport(1024, 900); await b.sleep(400); out.overflow1024 = await b.evaluate(`(()=>{const e=document.getElementById('needs-you');return [e.scrollWidth,e.clientWidth,document.documentElement.scrollWidth,innerWidth]})()`); await b.shot('needs-you-s4-1024'); await b.viewport(1440, 1000); await b.sleep(300)

  // Open a session from a row, and come back.
  await b.evaluate(`document.querySelector('#needs-you ul > li a').click(); true`); await b.sleep(1200)
  out.sessionUrl = await b.evaluate(`location.pathname+location.search`)
  out.crumb = await b.evaluate(`document.querySelector('nav[aria-label=Breadcrumb]')?.innerText.replace(/\\s+/g,' ')`)
  await b.evaluate(`[...document.querySelectorAll('nav[aria-label=Breadcrumb] a')][0].click(); true`); await b.sleep(1200)
  out.backUrl = await b.evaluate(`location.pathname+location.hash`)

  console.log(JSON.stringify(out, null, 1))
  // Send booking link on the moderator no-show row: the row leaves, and the participant is not a No-show.
  await showAll()
  const mod = (await b.evaluate(rowsInfo)).find((r) => r.kind === 'moderator-no-show')
  out.modWho = mod?.who
  await b.evaluate(`(()=>{const l=document.querySelector('#needs-you [data-kind=moderator-no-show]'); [...l.querySelectorAll('button')].find(x=>x.innerText.trim()==='Send booking link').click(); return true})()`); await b.sleep(600)
  out.afterSend = await b.evaluate(`document.querySelector('#needs-you [data-kind=moderator-no-show]') ? 'still there' : 'left'`)
  out.notice = await b.evaluate(`document.querySelector('#needs-you [role=status]')?.innerText`)
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
