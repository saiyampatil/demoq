// Analysis base (A1): numbers, filters, the way into a session and back, and screenshots at 1440 and 1024.
import { launch } from './cdp.mjs'
const b = await launch()
const path = '/researcher/studies/pet-food-churn/analysis/base'
const out = {}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(path); await b.waitFor('Sessions in the base')
  const kpis = await b.evaluate(`[...document.querySelectorAll('[data-testid^=kpi-]')].map(e=>e.innerText.replace(/\\s+/g,' ').trim())`)
  out.kpis = kpis
  out.rows = await b.evaluate(`document.querySelectorAll('[data-testid=base-row]').length`)
  out.order = await b.evaluate(`[...document.querySelectorAll('[data-testid=base-row]')].map(r=>r.dataset.session+(r.dataset.inAnalysis==='true'?'':' (out)')).join(' ')`)
  out.p3104 = await b.evaluate(`document.querySelector('[data-session="P-3104-2"]').innerText.replace(/\\s+/g,' ')`)
  out.p3115 = await b.evaluate(`document.querySelector('[data-session="P-3115-1"]').innerText.replace(/\\s+/g,' ')`)
  out.p3107 = await b.evaluate(`document.querySelector('[data-session="P-3107-1"]').innerText.replace(/\\s+/g,' ')`)
  out.p3106 = await b.evaluate(`document.querySelector('[data-session="P-3106-1"]').innerText.replace(/\\s+/g,' ')`)
  out.p3112 = await b.evaluate(`document.querySelector('[data-session="P-3112-1"]').innerText.replace(/\\s+/g,' ')`)
  out.inv = await b.evaluate(`window.__invariants`)
  out.lockedTip = await b.evaluate(`[...document.querySelectorAll('[role=tooltip]')].map(e=>e.innerText).filter(t=>t.includes('Approve the base')).length`)
  await b.shot('a1-1440', true)
  await b.viewport(1024, 900); await b.sleep(400); out.overflow1024 = await b.evaluate(`(()=>{const w=document.querySelector('[data-testid=base-table]').parentElement;return [w.scrollWidth,w.clientWidth,document.documentElement.scrollWidth,innerWidth]})()`); out.stepRows1024 = await b.evaluate(`new Set([...document.querySelectorAll('nav[aria-label="Analysis steps"] li')].map(l=>Math.round(l.getBoundingClientRect().top))).size`); await b.shot('a1-1024', true); await b.viewport(1440, 1000)
  // KPI click filters the table
  await b.evaluate(`document.querySelector('[data-testid=kpi-caveat]').click(); true`); await b.sleep(300)
  out.caveatFilter = await b.evaluate(`[...document.querySelectorAll('[data-testid=base-row]')].map(r=>r.dataset.session).join(' ')`)
  await b.evaluate(`document.querySelector('[data-testid=kpi-video]').click(); true`); await b.sleep(300)
  out.audioFilter = await b.evaluate(`[...document.querySelectorAll('[data-testid=base-row]')].map(r=>r.dataset.session).join(' ')`)
  // Row click goes to Review with from=analysis-base, and the back link returns
  await b.evaluate(`document.querySelector('[data-testid=kpi-excluded]').click(); true`); await b.sleep(300)
  await b.evaluate(`document.querySelector('[data-session="P-3119-1"]').click(); true`); await b.sleep(1500)
  out.reviewUrl = await b.evaluate(`location.pathname+location.search`)
  out.back = await b.evaluate(`document.querySelector('nav[aria-label=Breadcrumb]')?.innerText.replace(/\\s+/g,' ')`)
  await b.evaluate(`[...document.querySelectorAll('nav[aria-label=Breadcrumb] a')][0].click(); true`); await b.sleep(900)
  out.afterBack = await b.evaluate(`location.pathname`)
  // other study: no base
  await b.goto('/researcher/studies/moisturizer-concept/analysis/base'); await b.sleep(900)
  out.moist = await b.evaluate(`document.querySelector('main')?.innerText.replace(/\\s+/g,' ').slice(0,200)`)
  // stepper entry
  await b.goto('/researcher/studies/pet-food-churn/review/queue'); await b.sleep(1200)
  out.stepperLink = await b.evaluate(`[...document.querySelectorAll('a')].find(a=>a.innerText.trim().startsWith('Analysis'))?.getAttribute('href')`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
