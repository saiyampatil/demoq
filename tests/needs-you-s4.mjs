// Needs you, row design: chips, time with zone, actions, order, the way into a session and back, the mock moderator no-show.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const out = {}
const rowsInfo = `[...document.querySelectorAll('#needs-you ul > li')].map(l=>({who:l.dataset.who||l.querySelector('a')?.innerText.trim(),kind:l.dataset.kind||l.dataset.testid,fault:l.querySelector('[data-testid=fault-chip]')?.dataset.fault,time:l.querySelector('[data-testid=needs-time]')?.innerText||'(clock line)',buttons:[...l.querySelectorAll('button')].map(x=>x.innerText.trim())}))`
// The fieldwork clock and the other dev controls live in the Screen jump panel (nothing dev-only shows on the page), so open it, act, close it.
const devOpen = async () => { await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(300) }
const devClose = async () => { await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(250) }
const step = async (label) => { await devOpen(); await b.evaluate(`[...document.querySelectorAll('[data-testid=needs-dev] button')].find(x=>x.innerText.trim()===${JSON.stringify(label)}).click(); true`); await b.sleep(500); await devClose() }
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

  // Mock moderator no-show: it joins the our-side rows (after P-2042's PulseAI row, which the +2 h step makes due and which is older), ahead of every participant-side row, with Send booking link.
  await step('+2 h'); await devOpen(); await b.evaluate(`document.querySelector('[data-testid=mock-moderator-no-show]').click(); true`); await b.sleep(500); await devClose(); out.noShowNotice = await b.evaluate(`document.querySelector('#needs-you [role=status]')?.innerText`); await showAll()
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
  const bad = []
  const must = (ok, msg) => { if (!ok) bad.push(msg) }
  must(out.sampleGiveUp === 0 && out.sampleActionsDisabled, 'sample data must show no Give up and only disabled actions')
  must(out.firstShown === 5 && out.allCount === 7, `expected 5 rows first and 7 in all, got ${out.firstShown} and ${out.allCount}`)
  const ours = out.order.findIndex((x) => x.endsWith(':Participant side'))
  must(ours === 2 && out.order.slice(0, 2).every((x) => x.endsWith(':Our side')), 'the two our-side rows must come first, ahead of every participant-side row')
  must(out.order.includes('P-2051:moderator-no-show:Our side'), 'the moderator no-show row is missing')
  must(out.ourSideButtons.includes('P-2051 => Send booking link | Give up and replace'), 'the moderator no-show row needs Send booking link and Give up')
  must(out.ourSideButtons.includes('P-2042 => Copy report for support'), 'PulseAI hasn’t recovered offers only Copy report for support (no Give up)')
  must(out.overflow1024[0] <= out.overflow1024[1] && out.overflow1024[2] <= out.overflow1024[3], 'no horizontal overflow at 1024 px')
  must(/\?from=needs-you$/.test(out.sessionUrl) && /^Fieldwork command center Needs you/.test(out.crumb), 'a row opens its session with a breadcrumb back to Needs you')
  must(out.backUrl.endsWith('/fieldwork/command-center'), 'the breadcrumb returns to the command center')
  must(out.modWho === 'P-2051' && out.afterSend === 'left' && /Booking link sent to P-2051/.test(out.notice ?? ''), 'Send booking link must remove the row and say so')
  must(!out.inv?.length, 'invariant violations')
  console.log(bad.length ? 'NEEDS-YOU S4 FAILED: ' + bad.join('; ') : 'NEEDS-YOU S4 OK')
  if (bad.length) process.exitCode = 1
} finally { b.close() }
