// The Evidence step is gone: seven steps, /evidence redirects to Review, R21 has no checkboxes and ends with "Next: Analysis".
import { launch } from './cdp.mjs'
const b = await launch()
const out = {}
const steps = `[...document.querySelectorAll('ol')].find(o=>o.innerText.includes('Moderator & Guide'))?.querySelectorAll(':scope > li').length`
const stepNames = `[...document.querySelectorAll('ol')].find(o=>o.innerText.includes('Moderator & Guide'))?.innerText.replace(/\\s+/g,' ').slice(0,400)`
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  // Pet Food: decided, so Analysis is open
  await b.goto('/researcher/studies/pet-food-churn/evidence'); await b.waitFor('Completed interviews'); await b.sleep(900)
  out.petRedirect = await b.evaluate(`location.pathname`)
  out.petSteps = await b.evaluate(steps); out.petStepNames = await b.evaluate(stepNames)
  out.petCheckboxes = await b.evaluate(`document.querySelectorAll('input[type=checkbox]').length`)
  out.petBanner = await b.evaluate(`document.querySelector('[data-testid=to-analysis]')?.outerHTML.slice(0,200)`)
  out.petBannerHref = await b.evaluate(`document.querySelector('a[data-testid=to-analysis]')?.getAttribute('href')`)
  out.railLine = await b.evaluate(`(()=>{const a=document.querySelector('aside');const rel=[...a.querySelectorAll('span')].find(s=>s.innerText.trim().startsWith('Release'));const chip=[...a.querySelectorAll('span')].find(s=>s.innerText.trim()==='Complete');return {chipTop:Math.round(chip.getBoundingClientRect().top),relTop:Math.round(rel.getBoundingClientRect().top)}})()`)
  await b.shot('ev-pet-r21')
  // Seed study
  await b.goto('/researcher/studies/moisturizer-concept/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(900)
  out.seedSteps = await b.evaluate(steps)
  out.seedStepper = await b.evaluate(stepNames)
  out.seedCheckboxes = await b.evaluate(`document.querySelectorAll('input[type=checkbox]').length`)
  out.seedBanner = await b.evaluate(`document.querySelector('[data-testid=to-analysis]')?.innerText ?? null`)
  await b.shot('ev-seed-r21')
  // seed once everything is decided
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  out.jumpText = await b.evaluate(`document.querySelector('[role=dialog]').innerText.replace(/\\s+/g,' ')`)
  out.jumpHasEvidence = /evidence|R24/i.test(out.jumpText)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(600)
  await b.evaluate(`__click('Dev demo: decide every session')`); await b.sleep(600)
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.goto('/researcher/studies/moisturizer-concept/review/queue'); await b.waitFor('Everything is reviewed'); await b.sleep(500)
  out.seedBannerAfter = await b.evaluate(`document.querySelector('[data-testid=to-analysis]')?.innerText ?? null`)
  out.seedBannerHref = await b.evaluate(`document.querySelector('a[data-testid=to-analysis]')?.getAttribute('href')`)
  // R22 decision record has no evidence link
  await b.goto('/researcher/studies/pet-food-churn/review/session/P-3112-1'); await b.waitFor('Decision record'); await b.sleep(500)
  out.r22EvidenceLinks = await b.evaluate(`[...document.querySelectorAll('a')].filter(a=>/evidence/i.test(a.innerText+a.getAttribute('href'))).length`)
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
