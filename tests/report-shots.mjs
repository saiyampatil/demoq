// Screenshots the Report workspace and two of its studios. Prints, never asserts. node tests/report-shots.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.viewport(1440, 1000)
  await b.goto(`${root}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(700)
  await b.shot('report-1')
  await b.evaluate(`document.querySelector('[data-testid=primary-action]').click(); true`); await b.sleep(700)
  await b.shot('report-review-studio')
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(300)
  await b.evaluate(`document.querySelector('[data-testid=tool-release]').click(); true`); await b.sleep(700)
  await b.shot('report-release-studio')
} finally { b.close() }
