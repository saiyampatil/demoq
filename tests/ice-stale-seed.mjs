// A browser still holding the first Ice Cream seed's codebook (its quotes are gone) must start again from the current seed, not crash.
import { launch } from './cdp.mjs'
const b = await launch()
const failures = []
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  // a codebook saved by the first seed: no seedVersion, a code whose quote no longer exists, and a decision
  await b.evaluate(`localStorage.setItem('pulseai-qual:codebook', JSON.stringify({'ice-cream-flavours': {studyId:'ice-cream-flavours', codedAt:'x', builtOn:['P-4121-1'], codes:[{id:'ic-pick-caramel',name:'Would buy Salted Caramel Swirl first',definition:'d',questionId:'iq-pick',isNew:false,status:'Accepted',confidence:0.9,excerpts:['ic-pick-caramel-P-4121-7'],more:[]}], themes:[{id:'t-familiar',name:'Old',definition:'d',codeIds:['ic-pick-caramel'],by:'Maya Ortiz',at:'2026-10-23T09:30:00-04:00'}], pending:{},skipped:{},dismissedSuggestions:[],tensions:{},signalPicks:{},log:[]}})); true`)
  await b.goto('/researcher/studies/ice-cream-flavours/analysis/signals'); await b.sleep(3000)
  const t = await b.evaluate("document.body.innerText.replace(/\\s+/g,' ')")
  const progress = await b.evaluate(`document.querySelector('[data-testid=insights-progress]')?.innerText`)
  const themes = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-name]')].map(e=>e.innerText.trim())`)
  if (/Unexpected Application Error|Cannot read/.test(t)) failures.push('the page crashed on a codebook saved by the first seed')
  if (progress !== '1 of 3 insights decided · 3 tensions to review') failures.push(`it did not start again from the current seed (${progress})`)
  if (themes.join() !== 'The safe choice wins the shelf,Parents choose for the whole family,Curious about something different,Not in a theme') failures.push(`themes: ${themes}`)
  // The seed version: a browser saved from another version drops its Ice Cream state at load, and nothing of Pet Food's.
  await b.evaluate(`localStorage.setItem('pulseai-qual:seed-epoch', JSON.stringify({'ice-cream-flavours': 2})); localStorage.setItem('pulseai-qual:report', JSON.stringify({'ice-cream-flavours': {old: true}, 'pet-food-churn': {keep: true}})); localStorage.setItem('pulseai-qual:review-state', JSON.stringify({notes: {'P-4121-1': 'old', 'P-3101-1': 'keep'}, events: {'P-4112-1': [1], 'P-3102-1': [1]}})); true`)
  await b.goto('/researcher'); await b.sleep(800)
  const after = await b.evaluate(`({report: JSON.parse(localStorage.getItem('pulseai-qual:report')), review: JSON.parse(localStorage.getItem('pulseai-qual:review-state')), epoch: JSON.parse(localStorage.getItem('pulseai-qual:seed-epoch')), main: Object.keys(JSON.parse(localStorage.getItem('pulseai-qual:v2')).briefs)})`)
  if ('ice-cream-flavours' in after.report || !after.report['pet-food-churn']?.keep) failures.push(`a store keyed by study: ${JSON.stringify(after.report)}`)
  if (after.review.notes['P-4121-1'] || after.review.events['P-4112-1'] || !after.review.notes['P-3101-1'] || !after.review.events['P-3102-1']) failures.push(`review state: ${JSON.stringify(after.review)}`)
  if (after.epoch['ice-cream-flavours'] !== 3) failures.push(`the version was not recorded: ${JSON.stringify(after.epoch)}`)
  if (!after.main.includes('ice-cream-flavours') || !after.main.includes('pet-food-churn')) failures.push(`the main store lost a study: ${after.main}`)
  await b.evaluate(`localStorage.setItem('pulseai-qual:report', JSON.stringify({'ice-cream-flavours': {new: true}})); true`)
  await b.goto('/researcher'); await b.sleep(500)
  if (!(await b.evaluate(`'ice-cream-flavours' in JSON.parse(localStorage.getItem('pulseai-qual:report'))`))) failures.push('a browser already on this version lost its Ice Cream state')
} catch (e) { failures.push('stopped: ' + e.message) } finally { b.close() }
if (failures.length) { console.error('ICE STALE SEED FAILED:\n - ' + failures.join('\n - ')); process.exit(1) }
console.log('ICE STALE SEED OK')
